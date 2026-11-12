-- 1) Notification wording. Normal messages: title = the team it is from
--    (e.g. "Kitchen"), body = a preview of the message. Emergency messages:
--    title "Emergency Notification" and a short instruction to read it, plus an
--    'urgent' flag so the app can use its high-priority Android channel.
-- 2) Live refresh: every new or deleted message sends a content-free Realtime
--    broadcast ("employee-messages" / "changed") so an open Employee Messages
--    screen reloads at once. No message text travels in the broadcast.

drop function if exists public.push_claim_batch(uuid, int);
create function public.push_claim_batch(p_message uuid, p_limit int default 100)
returns table (installation_id uuid, push_token text, title text, body text,
               expiration bigint, message_id uuid, urgent boolean)
language plpgsql security definer set search_path = public, app as $$
declare m public.messages; mode text; n_retry int;
begin
  select * into m from public.messages where id = p_message for update;
  if not found or not m.push_requested or m.push_status in ('done','expired','not_requested') then
    return;
  end if;
  if now() >= m.push_deadline then
    update public.messages set push_status = 'expired' where id = p_message;
    update public.push_deliveries set status = 'expired', updated_at = now()
      where push_deliveries.message_id = p_message and status in ('claimed','error');
    return;
  end if;

  select value #>> '{}' into mode from public.app_config where key = 'departmental_push_mode';
  update public.messages set push_status = 'dispatching' where id = p_message;

  create temp table if not exists _eligible (id uuid primary key, push_token text) on commit drop;
  truncate _eligible;
  insert into _eligible
  select i.id, i.push_token from public.installations i
  where i.push_enabled and i.push_token is not null
    and (m.scope <> 'department'
         or coalesce(mode,'subscribers') = 'everyone'
         or exists (select 1 from public.installation_subscriptions s
                    where s.installation_id = i.id and s.source_id = m.source_id));

  with picked as (
    select d.installation_id from public.push_deliveries d join _eligible e on e.id = d.installation_id
    where d.message_id = p_message and d.attempts < 3
      and (d.status = 'error' or (d.status = 'claimed' and d.updated_at < now() - interval '5 minutes'))
    limit p_limit
  )
  update public.push_deliveries d set status = 'claimed', attempts = d.attempts + 1, updated_at = now()
  from picked where d.message_id = p_message and d.installation_id = picked.installation_id;
  get diagnostics n_retry = row_count;

  insert into public.push_deliveries (message_id, installation_id, status, attempts)
  select p_message, e.id, 'claimed', 1 from _eligible e
  where not exists (select 1 from public.push_deliveries d
                    where d.message_id = p_message and d.installation_id = e.id)
  limit greatest(p_limit - n_retry, 0)
  on conflict do nothing;

  return query
  select e.id, e.push_token,
         case when m.scope = 'global_emergency' then 'Emergency Notification' else m.source_label end,
         case when m.scope = 'global_emergency'
              then 'Please read an important update from ' || m.source_label || ' in Employee Messages.'
              when length(m.body) > 178 then left(m.body, 175) || '…'
              else m.body end,
         extract(epoch from m.push_deadline)::bigint, m.id,
         m.scope = 'global_emergency'
  from _eligible e
  join public.push_deliveries d on d.installation_id = e.id and d.message_id = p_message
  where d.status = 'claimed' and d.updated_at = now();
end $$;

revoke all on function public.push_claim_batch(uuid, int) from public, anon, authenticated;
grant execute on function public.push_claim_batch(uuid, int) to service_role;

create or replace function app.broadcast_messages_changed() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  -- Supabase Realtime broadcast (public topic, no payload beyond a marker).
  -- Skipped where Realtime isn't installed (e.g. the local test database).
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    begin
      execute 'select realtime.send($1, $2, $3, $4)'
        using jsonb_build_object('at', now()), 'changed', 'employee-messages', false;
    exception when others then
      null; -- a broadcast failure must never block sending a message
    end;
  end if;
  return null;
end $$;

drop trigger if exists t_messages_broadcast on public.messages;
create trigger t_messages_broadcast after insert or delete on public.messages
  for each statement execute function app.broadcast_messages_changed();
