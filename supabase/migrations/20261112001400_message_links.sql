-- A message can point at a menu item (e.g. "Menu has been updated" after a
-- PDF upload); the app shows an "Open …" button for it. If the item is later
-- deleted the link is cleared and the button disappears.
alter table public.messages
  add column link_node_id uuid references public.content_nodes(id) on delete set null;
grant select (link_node_id) on public.messages to anon, authenticated;

drop function if exists public.admin_send_message(uuid, uuid, public.message_scope, text, jsonb);
create function public.admin_send_message(
  p_request_id uuid, p_source uuid, p_scope public.message_scope, p_body text,
  p_attachments jsonb default '[]'::jsonb, p_link_node uuid default null)
returns table (message_id uuid, created boolean, push_requested boolean)
language plpgsql security definer set search_path = public, app as $$
declare
  existing public.messages;
  src public.message_sources;
  want_push boolean;
  new_id uuid;
  att jsonb;
  i int := 0;
begin
  if app.my_tier() is null then perform app.deny(); end if;

  select * into existing from public.messages where request_id = p_request_id;
  if found then
    if existing.created_by is distinct from auth.uid() then perform app.deny('Request id already used'); end if;
    return query select existing.id, false, existing.push_requested; return;
  end if;

  select * into src from public.message_sources where id = p_source and is_active;
  if not found then raise exception 'Unknown message source' using errcode='22023'; end if;
  if not app.can_source('message.publish', p_source) then perform app.deny(); end if;

  if p_scope = 'global_emergency' then
    if not app.can_global('push.global_emergency') then perform app.deny(); end if;
    want_push := true;
  elsif p_scope = 'global_general' then
    if not app.can_global('push.global_general') then perform app.deny(); end if;
    want_push := true;
  else
    want_push := app.can_source('push.department', p_source);
  end if;

  if p_link_node is not null and not exists (
       select 1 from public.content_nodes where id = p_link_node and kind <> 'section') then
    raise exception 'Linked item not found' using errcode='22023';
  end if;

  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_attachments,'[]'::jsonb)) > 5 then
    raise exception 'Up to 5 attachments' using errcode='22023';
  end if;

  insert into public.messages (request_id, source_id, source_label, scope, body, push_requested,
                               push_deadline, push_status, created_by, link_node_id)
  values (p_request_id, p_source, src.label, p_scope, trim(p_body), want_push,
          now() + interval '24 hours', case when want_push then 'pending' else 'not_requested' end, auth.uid(), p_link_node)
  on conflict (request_id) do nothing
  returning id into new_id;

  if new_id is null then  -- lost a race with an identical concurrent request
    select * into existing from public.messages where request_id = p_request_id;
    if existing.created_by is distinct from auth.uid() then perform app.deny('Request id already used'); end if;
    return query select existing.id, false, existing.push_requested; return;
  end if;

  for att in select * from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) loop
    if (att->>'path') not like p_request_id::text || '/%' then
      raise exception 'Attachment path does not match request' using errcode='22023';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'messages' and name = att->>'path') then
      raise exception 'Attachment not found' using errcode='P0002';
    end if;
    insert into public.message_attachments (message_id, file_path, file_name, mime_type, file_size, position)
    values (new_id, att->>'path', left(coalesce(att->>'name','attachment'),200), att->>'mime',
            coalesce((att->>'size')::bigint, 0), i);
    i := i + 1;
  end loop;

  return query select new_id, true, want_push;
end $$;

revoke all on function public.admin_send_message(uuid, uuid, public.message_scope, text, jsonb, uuid) from public, anon;
grant execute on function public.admin_send_message(uuid, uuid, public.message_scope, text, jsonb, uuid) to authenticated;
