-- Admin write API. Every function re-checks permissions server-side, so the
-- website hiding a button is never the only protection (acceptance H, W).

-------------------------------------------------------------------------------
-- Who am I / what may I do
-------------------------------------------------------------------------------

create or replace function public.admin_me() returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare acc public.admin_accounts;
begin
  select * into acc from public.admin_accounts where user_id = auth.uid() and not disabled;
  if not found then return null; end if;
  return jsonb_build_object(
    'user_id', acc.user_id, 'email', acc.email, 'display_name', acc.display_name, 'tier', acc.tier,
    'is_top', acc.tier in ('app_developer','super_admin'),
    'content', coalesce((
      select jsonb_object_agg(n.id, jsonb_build_object(
        'access', app.can_content('content.access', n.id),
        'upload', app.can_content('content.upload', n.id),
        'edit',   app.can_content('content.edit',   n.id),
        'delete', app.can_content('content.delete', n.id)))
      from public.content_nodes n where app.can_content('content.access', n.id)), '{}'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label,
        'push', app.can_source('push.department', s.id)) order by s.position, s.label)
      from public.message_sources s
      where s.is_active and app.can_source('message.publish', s.id)), '[]'::jsonb),
    'global_general',   app.can_global('push.global_general'),
    'global_emergency', app.can_global('push.global_emergency')
  );
end $$;

-------------------------------------------------------------------------------
-- Content
-------------------------------------------------------------------------------

create or replace function app.validate_entry_fields(p_kind public.node_kind, p_url text, p_phone text)
returns void language plpgsql as $$
begin
  if p_kind in ('url','map') and p_url is not null and p_url !~* '^https://' then
    raise exception 'Links must start with https://' using errcode = '22023';
  end if;
  if p_kind = 'phone' and p_phone is not null and p_phone !~ '^\+?[0-9 ()-]{3,30}$' then
    raise exception 'Phone number contains invalid characters' using errcode = '22023';
  end if;
end $$;

-- Create a non-PDF entry (link, form, info text, phone, map) in a list section.
create or replace function public.admin_create_entry(
  p_section uuid, p_kind public.node_kind, p_label text,
  p_url text default null, p_body text default null, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare sec public.content_nodes; new_id uuid;
begin
  select * into sec from public.content_nodes where id = p_section and kind = 'section';
  if not found or sec.section_type <> 'list' then raise exception 'Not a list section' using errcode='22023'; end if;
  if p_kind in ('section','pdf') then raise exception 'Use the PDF upload to create PDF entries' using errcode='22023'; end if;
  if not app.can_content('content.edit', p_section) then perform app.deny(); end if;
  perform app.validate_entry_fields(p_kind, nullif(trim(p_url),''), nullif(trim(p_phone),''));
  insert into public.content_nodes (parent_id, kind, label, position, url, body, phone)
  values (p_section, p_kind, trim(p_label),
          coalesce((select max(position) from public.content_nodes where parent_id = p_section), 0) + 10,
          nullif(trim(p_url),''), nullif(p_body,''), nullif(trim(p_phone),''))
  returning id into new_id;
  return new_id;
end $$;

-- Edit an entry's label/type/details, or a web/weather section's URL.
create or replace function public.admin_update_entry(
  p_id uuid, p_label text default null, p_kind public.node_kind default null,
  p_url text default null, p_body text default null, p_phone text default null)
returns void language plpgsql security definer set search_path = public, app as $$
declare n public.content_nodes; k public.node_kind;
begin
  select * into n from public.content_nodes where id = p_id;
  if not found then raise exception 'Not found' using errcode='P0002'; end if;
  if not app.can_content('content.edit', p_id) then perform app.deny(); end if;

  if n.kind = 'section' then
    -- Section labels and types are fixed; only web/weather destination URLs are editable.
    if n.section_type not in ('web','weather') then perform app.deny('This section has no editable link'); end if;
    if p_url is not null and p_url !~* '^https://' then
      raise exception 'Links must start with https://' using errcode='22023';
    end if;
    update public.content_nodes set url = nullif(trim(p_url),'') where id = p_id;
    return;
  end if;

  k := coalesce(p_kind, n.kind);
  if k = 'section' then raise exception 'Invalid type' using errcode='22023'; end if;
  if k = 'pdf' and n.kind <> 'pdf' then
    raise exception 'Upload a PDF to turn an entry into a document' using errcode='22023';
  end if;
  perform app.validate_entry_fields(k, nullif(trim(p_url),''), nullif(trim(p_phone),''));
  update public.content_nodes set
    label = coalesce(nullif(trim(p_label),''), label),
    kind  = k,
    url   = case when k in ('url','map') then nullif(trim(p_url),'') else null end,
    body  = case when k = 'info' then nullif(p_body,'') else body end,
    phone = case when k = 'phone' then nullif(trim(p_phone),'') else null end
  where id = p_id;
end $$;

-- Replace the PDF on an existing entry. The new object is already uploaded at a
-- fresh path, so a failed upload never touches the working document, and the
-- new URL defeats stale caches. Returns the old path for cleanup.
create or replace function public.admin_attach_pdf(
  p_id uuid, p_path text, p_file_name text, p_size bigint, p_label text default null)
returns text language plpgsql security definer set search_path = public, app as $$
declare n public.content_nodes; old_path text;
begin
  select * into n from public.content_nodes where id = p_id for update;
  if not found or n.kind <> 'pdf' then raise exception 'Not a document entry' using errcode='22023'; end if;
  if not app.can_content('content.upload', p_id) then perform app.deny(); end if;
  if p_path not like p_id::text || '/%' then raise exception 'Upload path does not match entry' using errcode='22023'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'content' and name = p_path) then
    raise exception 'Uploaded file not found' using errcode='P0002';
  end if;
  old_path := n.file_path;
  update public.content_nodes set
    file_path = p_path, file_name = p_file_name, file_size = p_size, file_updated_at = now(),
    label = coalesce(nullif(trim(p_label),''), label)
  where id = p_id;
  return case when old_path is distinct from p_path then old_path end;
end $$;

-- Create a new PDF entry in a list section (e.g. a Memorandum issue).
-- Label defaults to the file name; the entry id is chosen by the server when it
-- issues the signed upload URL so the object path can embed it.
create or replace function public.admin_create_pdf_entry(
  p_section uuid, p_entry_id uuid, p_path text, p_file_name text, p_size bigint, p_label text default null)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare sec public.content_nodes; lbl text;
begin
  select * into sec from public.content_nodes where id = p_section and kind = 'section';
  if not found or sec.section_type <> 'list' then raise exception 'Not a list section' using errcode='22023'; end if;
  if not app.can_content('content.upload', p_section) then perform app.deny(); end if;
  if p_path not like p_entry_id::text || '/%' then raise exception 'Upload path does not match entry' using errcode='22023'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'content' and name = p_path) then
    raise exception 'Uploaded file not found' using errcode='P0002';
  end if;
  lbl := coalesce(nullif(trim(p_label),''), regexp_replace(p_file_name, '\.pdf$', '', 'i'));
  insert into public.content_nodes (id, parent_id, kind, label, position, file_path, file_name, file_size, file_updated_at)
  values (p_entry_id, p_section, 'pdf', left(lbl, 120),
          coalesce((select max(position) from public.content_nodes where parent_id = p_section), 0) + 10,
          p_path, p_file_name, p_size, now());
  return p_entry_id;
end $$;

-- Delete an entry. Returns its file path (if any) so storage can be cleaned.
create or replace function public.admin_delete_entry(p_id uuid)
returns text language plpgsql security definer set search_path = public, app as $$
declare n public.content_nodes;
begin
  select * into n from public.content_nodes where id = p_id;
  if not found then raise exception 'Not found' using errcode='P0002'; end if;
  if n.kind = 'section' then perform app.deny('Sections cannot be deleted'); end if;
  if not app.can_content('content.delete', p_id) then perform app.deny(); end if;
  delete from public.content_nodes where id = p_id;
  return n.file_path;
end $$;

create or replace function public.admin_reorder_entries(p_section uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if not app.can_content('content.edit', p_section) then perform app.deny(); end if;
  update public.content_nodes n set position = x.ord * 10
  from unnest(p_ids) with ordinality as x(id, ord)
  where n.id = x.id and n.parent_id = p_section;
end $$;

-- Weather widget embed code: application configuration (top tiers only).
create or replace function public.admin_set_weather_widget(p_html text)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_top() then perform app.deny(); end if;
  if p_html is not null and length(trim(p_html)) > 0 then
    if length(p_html) > 8000 then raise exception 'Widget code too long' using errcode='22023'; end if;
    -- Only accept WillyWeather embed code; any src/href must point at willyweather.com.au.
    if p_html !~* 'willyweather\.com\.au'
       or exists (select 1 from regexp_matches(p_html, '(?:src|href)\s*=\s*["'']?(https?:)?//([^/"''\s>]+)', 'gi') m
                  where m[2] !~* '(^|\.)willyweather\.com\.au$') then
      raise exception 'Widget code must come from willyweather.com.au' using errcode='22023';
    end if;
  end if;
  update public.content_nodes set widget_html = nullif(trim(p_html),'') where key = 'weather';
end $$;

-------------------------------------------------------------------------------
-- Messages
-------------------------------------------------------------------------------

-- Send = save one message + queue its push. Idempotent on p_request_id
-- (repeat taps / network retries return the original message: acceptance L).
create or replace function public.admin_send_message(
  p_request_id uuid, p_source uuid, p_scope public.message_scope, p_body text,
  p_attachments jsonb default '[]'::jsonb)
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

  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_attachments,'[]'::jsonb)) > 5 then
    raise exception 'Up to 5 attachments' using errcode='22023';
  end if;

  insert into public.messages (request_id, source_id, source_label, scope, body, push_requested,
                               push_deadline, push_status, created_by)
  values (p_request_id, p_source, src.label, p_scope, trim(p_body), want_push,
          now() + interval '24 hours', case when want_push then 'pending' else 'not_requested' end, auth.uid())
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

create or replace function public.admin_delete_message(p_id uuid)
returns setof text language plpgsql security definer set search_path = public, app as $$
declare m public.messages;
begin
  select * into m from public.messages where id = p_id;
  if not found then raise exception 'Not found' using errcode='P0002'; end if;
  if not (app.is_top() or (m.source_id is not null and app.can_source('message.publish', m.source_id))) then
    perform app.deny();
  end if;
  return query select file_path from public.message_attachments where message_id = p_id;
  delete from public.messages where id = p_id;
end $$;

-- Recent messages visible to this admin (for the website's message list).
create or replace function public.admin_list_messages(p_limit int default 50)
returns table (id uuid, source_label text, scope public.message_scope, body text, created_at timestamptz,
               push_requested boolean, push_status text, can_delete boolean)
language sql stable security definer set search_path = public, app as $$
  select m.id, m.source_label, m.scope, m.body, m.created_at, m.push_requested, m.push_status,
         app.is_top() or (m.source_id is not null and app.can_source('message.publish', m.source_id))
  from public.messages m
  where app.my_tier() is not null
  order by m.created_at desc
  limit least(greatest(p_limit,1),200)
$$;

create or replace function public.admin_upsert_source(
  p_id uuid, p_label text, p_subscribable boolean default true, p_active boolean default true)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare rid uuid;
begin
  if not app.is_top() then perform app.deny(); end if;
  if p_id is null then
    insert into public.message_sources (label, subscribable, is_active, position)
    values (trim(p_label), p_subscribable, p_active,
            coalesce((select max(position) from public.message_sources),0)+10)
    returning id into rid;
  else
    update public.message_sources set label = trim(p_label), subscribable = p_subscribable, is_active = p_active
    where id = p_id returning id into rid;
    if rid is null then raise exception 'Not found' using errcode='P0002'; end if;
  end if;
  return rid;
end $$;

-------------------------------------------------------------------------------
-- Accounts and roles (top tiers only; hierarchy default: only the App
-- Developer appoints/removes Super Admins and App Developers)
-------------------------------------------------------------------------------

create or replace function app.assert_can_manage(p_target uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare t public.admin_tier;
begin
  if not app.is_top() then perform app.deny(); end if;
  if p_target = auth.uid() then perform app.deny('You cannot change your own access'); end if;
  select tier into t from public.admin_accounts where user_id = p_target;
  if t in ('app_developer','super_admin') and not app.is_app_developer() then
    perform app.deny('Only the App Developer manages Super Admin and App Developer accounts');
  end if;
end $$;

-- Called by the website server right after it creates the auth user.
create or replace function public.admin_register_account(
  p_user_id uuid, p_email text, p_display_name text, p_tier public.admin_tier default 'delegate')
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_top() then perform app.deny(); end if;
  if p_tier <> 'delegate' and not app.is_app_developer() then
    perform app.deny('Only the App Developer can appoint Super Admins or App Developers');
  end if;
  if exists (select 1 from public.admin_accounts where user_id = p_user_id) then
    perform app.assert_can_manage(p_user_id);
    update public.admin_accounts set display_name = p_display_name, tier = p_tier, email = lower(p_email)
    where user_id = p_user_id;
  else
    insert into public.admin_accounts (user_id, email, display_name, tier)
    values (p_user_id, lower(p_email), p_display_name, p_tier);
  end if;
  if p_tier <> 'delegate' then delete from public.account_roles where user_id = p_user_id; end if;
end $$;

create or replace function public.admin_set_disabled(p_user uuid, p_disabled boolean)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  perform app.assert_can_manage(p_user);
  update public.admin_accounts set disabled = p_disabled where user_id = p_user;
end $$;

-- Deletes the admin record; the website then deletes the auth user.
create or replace function public.admin_delete_account(p_user uuid)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  perform app.assert_can_manage(p_user);
  delete from public.admin_accounts where user_id = p_user;
end $$;

create or replace function public.admin_set_account_roles(p_user uuid, p_roles uuid[])
returns void language plpgsql security definer set search_path = public, app as $$
begin
  perform app.assert_can_manage(p_user);
  if (select tier from public.admin_accounts where user_id = p_user) <> 'delegate' then
    raise exception 'Custom roles apply to delegated administrators only' using errcode='22023';
  end if;
  delete from public.account_roles where user_id = p_user;
  insert into public.account_roles (user_id, role_id)
  select p_user, r from unnest(coalesce(p_roles,'{}')) r;
end $$;

create or replace function public.admin_create_role(p_name text)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare rid uuid;
begin
  if not app.is_top() then perform app.deny(); end if;
  insert into public.roles (name) values (trim(p_name)) returning id into rid;
  return rid;
end $$;

create or replace function public.admin_rename_role(p_role uuid, p_name text)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_top() then perform app.deny(); end if;
  update public.roles set name = trim(p_name) where id = p_role;
end $$;

-- Deleting a role cascades its grants and assignments: no stale access remains.
create or replace function public.admin_delete_role(p_role uuid)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_top() then perform app.deny(); end if;
  delete from public.roles where id = p_role;
end $$;

-- Replace a role's checkbox grants. p_grants: [{permission_id, node_id?, source_id?}]
create or replace function public.admin_set_role_grants(p_role uuid, p_grants jsonb)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_top() then perform app.deny(); end if;
  if not exists (select 1 from public.roles where id = p_role) then raise exception 'Not found' using errcode='P0002'; end if;
  delete from public.role_grants where role_id = p_role;
  insert into public.role_grants (role_id, permission_id, node_id, source_id)
  select distinct p_role, g->>'permission_id', (g->>'node_id')::uuid, (g->>'source_id')::uuid
  from jsonb_array_elements(coalesce(p_grants,'[]'::jsonb)) g;
end $$;

create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if p_key = 'departmental_push_mode' then
    if not app.is_app_developer() then perform app.deny(); end if;
    if p_value not in ('"subscribers"'::jsonb, '"everyone"'::jsonb) then raise exception 'Invalid value' using errcode='22023'; end if;
  elsif p_key = 'support_text' then
    if not app.is_top() then perform app.deny(); end if;
  else
    raise exception 'Unknown setting' using errcode='22023';
  end if;
  insert into public.app_config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end $$;

-------------------------------------------------------------------------------
-- Execute privileges
-------------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon;
grant execute on function
  public.admin_me(), public.admin_create_entry(uuid, public.node_kind, text, text, text, text),
  public.admin_update_entry(uuid, text, public.node_kind, text, text, text),
  public.admin_attach_pdf(uuid, text, text, bigint, text),
  public.admin_create_pdf_entry(uuid, uuid, text, text, bigint, text),
  public.admin_delete_entry(uuid), public.admin_reorder_entries(uuid, uuid[]),
  public.admin_set_weather_widget(text),
  public.admin_send_message(uuid, uuid, public.message_scope, text, jsonb),
  public.admin_delete_message(uuid), public.admin_list_messages(int),
  public.admin_upsert_source(uuid, text, boolean, boolean),
  public.admin_register_account(uuid, text, text, public.admin_tier),
  public.admin_set_disabled(uuid, boolean), public.admin_delete_account(uuid),
  public.admin_set_account_roles(uuid, uuid[]),
  public.admin_create_role(text), public.admin_rename_role(uuid, text), public.admin_delete_role(uuid),
  public.admin_set_role_grants(uuid, jsonb), public.admin_set_config(text, jsonb)
to authenticated;
