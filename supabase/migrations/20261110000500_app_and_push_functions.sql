-- Mobile app (anonymous) functions and push dispatch functions (service role).

-------------------------------------------------------------------------------
-- Anonymous installations. The device generates a random id + secret; only the
-- sha256 of the secret is stored, so one installation cannot overwrite another.
-------------------------------------------------------------------------------

create or replace function public.app_register_installation(
  p_id uuid, p_secret text, p_platform text, p_push_token text, p_push_enabled boolean)
returns void language plpgsql security definer set search_path = public, app as $$
declare h text := encode(digest(p_secret, 'sha256'), 'hex'); cur public.installations;
begin
  if p_secret is null or length(p_secret) < 32 then raise exception 'Invalid secret' using errcode='22023'; end if;
  if p_platform not in ('ios','android') then raise exception 'Invalid platform' using errcode='22023'; end if;
  if p_push_token is not null and p_push_token !~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid push token' using errcode='22023';
  end if;

  select * into cur from public.installations where id = p_id for update;
  if found and cur.secret_hash <> h then perform app.deny(); end if;

  -- A token belongs to one installation only (prevents duplicate pushes after reinstall).
  if p_push_token is not null then
    update public.installations set push_token = null, push_enabled = false
    where push_token = p_push_token and id <> p_id;
  end if;

  insert into public.installations (id, secret_hash, platform, push_token, push_enabled)
  values (p_id, h, p_platform, p_push_token, coalesce(p_push_enabled,false) and p_push_token is not null)
  on conflict (id) do update set
    platform = excluded.platform, push_token = excluded.push_token, push_enabled = excluded.push_enabled;
end $$;

create or replace function public.app_set_subscriptions(p_id uuid, p_secret text, p_sources uuid[])
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if not exists (select 1 from public.installations
                 where id = p_id and secret_hash = encode(digest(p_secret,'sha256'),'hex')) then
    perform app.deny();
  end if;
  delete from public.installation_subscriptions where installation_id = p_id;
  insert into public.installation_subscriptions (installation_id, source_id)
  select p_id, s.id from public.message_sources s
  where s.id = any(coalesce(p_sources,'{}')) and s.is_active and s.subscribable;
end $$;

create or replace function public.app_get_subscriptions(p_id uuid, p_secret text)
returns uuid[] language sql stable security definer set search_path = public, app as $$
  select coalesce(array_agg(sub.source_id), '{}')
  from public.installation_subscriptions sub
  join public.installations i on i.id = sub.installation_id
  where i.id = p_id and i.secret_hash = encode(digest(p_secret,'sha256'),'hex')
$$;

-- Public, non-secret configuration the app needs.
create or replace function public.app_public_config() returns jsonb
language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object(
    'departmental_push_mode', (select value from public.app_config where key = 'departmental_push_mode'),
    'support_text',           (select value from public.app_config where key = 'support_text'))
$$;

-------------------------------------------------------------------------------
-- Push dispatch (service role only; called by the dispatch-push edge function)
-------------------------------------------------------------------------------

-- Claim up to p_limit recipients for a message. A (message, installation) row
-- is inserted exactly once; only errored or stale-claimed rows are retried,
-- at most 3 attempts, and never after the 24-hour deadline (acceptance M, N).
create or replace function public.push_claim_batch(p_message uuid, p_limit int default 100)
returns table (installation_id uuid, push_token text, title text, body text,
               expiration bigint, message_id uuid)
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

  -- 1) Retries: errored, or claimed by a worker that died (>5 min), < 3 attempts.
  with picked as (
    select d.installation_id from public.push_deliveries d join _eligible e on e.id = d.installation_id
    where d.message_id = p_message and d.attempts < 3
      and (d.status = 'error' or (d.status = 'claimed' and d.updated_at < now() - interval '5 minutes'))
    limit p_limit
  )
  update public.push_deliveries d set status = 'claimed', attempts = d.attempts + 1, updated_at = now()
  from picked where d.message_id = p_message and d.installation_id = picked.installation_id;
  get diagnostics n_retry = row_count;

  -- 2) First-time recipients, never inserted before (the one-push guard).
  insert into public.push_deliveries (message_id, installation_id, status, attempts)
  select p_message, e.id, 'claimed', 1 from _eligible e
  where not exists (select 1 from public.push_deliveries d
                    where d.message_id = p_message and d.installation_id = e.id)
  limit greatest(p_limit - n_retry, 0)
  on conflict do nothing;

  return query
  select e.id, e.push_token, m.source_label,
         case when length(m.body) > 178 then left(m.body, 175) || '…' else m.body end,
         extract(epoch from m.push_deadline)::bigint, m.id
  from _eligible e
  join public.push_deliveries d on d.installation_id = e.id and d.message_id = p_message
  -- Rows claimed by this call: now() is the transaction start time, and each
  -- RPC call runs in its own transaction.
  where d.status = 'claimed' and d.updated_at = now();
end $$;

-- p_results: [{installation_id, ok, ticket_id?, error_code?}]
create or replace function public.push_record_results(p_message uuid, p_results jsonb)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  update public.push_deliveries d set
    status = case when (r->>'ok')::boolean then 'sent' else 'error' end,
    ticket_id = r->>'ticket_id', error_code = r->>'error_code', updated_at = now()
  from jsonb_array_elements(p_results) r
  where d.message_id = p_message and d.installation_id = (r->>'installation_id')::uuid;

  -- Provider says this token is dead: stop sending to it until it re-registers.
  update public.installations i set push_token = null, push_enabled = false
  from jsonb_array_elements(p_results) r
  where i.id = (r->>'installation_id')::uuid and r->>'error_code' = 'DeviceNotRegistered';
  update public.push_deliveries d set attempts = 3
  from jsonb_array_elements(p_results) r
  where d.message_id = p_message and d.installation_id = (r->>'installation_id')::uuid
    and r->>'error_code' = 'DeviceNotRegistered';
end $$;

-- Mark done when nothing is left to claim or retry; otherwise leave pending so
-- the scheduled sweep retries (still within the original deadline).
create or replace function public.push_finish(p_message uuid)
returns text language plpgsql security definer set search_path = public, app as $$
declare st text;
begin
  update public.messages m set push_status =
    case
      when now() >= m.push_deadline then 'expired'
      when exists (select 1 from public.push_deliveries d where d.message_id = m.id
                   and d.status in ('error','claimed') and d.attempts < 3) then 'pending'
      else 'done'
    end
  where m.id = p_message and m.push_status in ('pending','dispatching')
  returning push_status into st;
  return st;
end $$;

-- Messages the sweep should (re)dispatch. Expires overdue ones as a side effect.
create or replace function public.push_due_messages()
returns setof uuid language plpgsql security definer set search_path = public, app as $$
begin
  update public.messages set push_status = 'expired'
  where push_status in ('pending','dispatching') and now() >= push_deadline;
  update public.push_deliveries d set status = 'expired', updated_at = now()
  from public.messages m
  where m.id = d.message_id and m.push_status = 'expired' and d.status in ('claimed','error');
  return query select id from public.messages
    where push_status in ('pending','dispatching') and now() < push_deadline
    order by created_at limit 50;
end $$;

-------------------------------------------------------------------------------
-- Privileges
-------------------------------------------------------------------------------

revoke all on function
  public.app_register_installation(uuid, text, text, text, boolean),
  public.app_set_subscriptions(uuid, text, uuid[]),
  public.app_get_subscriptions(uuid, text),
  public.app_public_config(),
  public.push_claim_batch(uuid, int), public.push_record_results(uuid, jsonb),
  public.push_finish(uuid), public.push_due_messages()
from public, anon, authenticated;

grant execute on function
  public.app_register_installation(uuid, text, text, text, boolean),
  public.app_set_subscriptions(uuid, text, uuid[]),
  public.app_get_subscriptions(uuid, text),
  public.app_public_config()
to anon, authenticated;

grant execute on function
  public.push_claim_batch(uuid, int), public.push_record_results(uuid, jsonb),
  public.push_finish(uuid), public.push_due_messages()
to service_role;
