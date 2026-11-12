-- Folders (one level, inside list sections) and per-item icons, matching the
-- live app's HR & Payroll layout. Depth is now section → item, or
-- section → folder → item.

alter table public.content_nodes add column if not exists icon text
  constraint icon_name check (icon is null or icon ~ '^[a-z0-9-]{1,60}$');

-- Where an item may live.
create or replace function app.check_node_parent() returns trigger
language plpgsql set search_path = public, app as $$
declare p public.content_nodes;
begin
  if new.kind = 'section' then return new; end if;
  select * into p from public.content_nodes where id = new.parent_id;
  if not found then raise exception 'Parent not found' using errcode = '23503'; end if;
  if p.kind = 'section' then
    if p.section_type <> 'list' then raise exception 'Items can only be added to list sections' using errcode = '22023'; end if;
  elsif p.kind = 'folder' then
    if new.kind = 'folder' then raise exception 'Folders cannot contain folders' using errcode = '22023'; end if;
  else
    raise exception 'Items can only be placed in a section or folder' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and old.kind = 'folder' and new.kind <> 'folder'
     and exists (select 1 from public.content_nodes c where c.parent_id = new.id) then
    raise exception 'A folder with items cannot change type' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists t_check_node_parent on public.content_nodes;
create trigger t_check_node_parent before insert or update of parent_id, kind on public.content_nodes
  for each row execute function app.check_node_parent();

-- Grants on a section or folder now also cover the items inside a folder.
create or replace function app.has_grant_on_node(perm text, node uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1
    from public.account_roles ar
    join public.role_grants g on g.role_id = ar.role_id
    join public.admin_accounts a on a.user_id = ar.user_id and not a.disabled
    where ar.user_id = auth.uid()
      and g.permission_id = perm
      and g.node_id in (
        node,
        (select parent_id from public.content_nodes where id = node),
        (select p.parent_id from public.content_nodes c join public.content_nodes p on p.id = c.parent_id where c.id = node))
  )
$$;

-- Create a non-PDF item (link, form, info, phone, map) or a folder, in a list
-- section or in a folder.
create or replace function public.admin_create_entry(
  p_section uuid, p_kind public.node_kind, p_label text,
  p_url text default null, p_body text default null, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare sec public.content_nodes; new_id uuid;
begin
  select * into sec from public.content_nodes
  where id = p_section and (kind = 'folder' or (kind = 'section' and section_type = 'list'));
  if not found then raise exception 'Not a list section or folder' using errcode='22023'; end if;
  if p_kind in ('section','pdf') then raise exception 'Use the PDF upload to create PDF entries' using errcode='22023'; end if;
  if p_kind = 'folder' and sec.kind = 'folder' then raise exception 'Folders cannot contain folders' using errcode='22023'; end if;
  if not app.can_content('content.edit', p_section) then perform app.deny(); end if;
  perform app.validate_entry_fields(p_kind, nullif(trim(p_url),''), nullif(trim(p_phone),''));
  insert into public.content_nodes (parent_id, kind, label, position, url, body, phone)
  values (p_section, p_kind, trim(p_label),
          coalesce((select max(position) from public.content_nodes where parent_id = p_section), 0) + 10,
          case when p_kind = 'folder' then null else nullif(trim(p_url),'') end,
          case when p_kind = 'folder' then null else nullif(p_body,'') end,
          case when p_kind = 'folder' then null else nullif(trim(p_phone),'') end)
  returning id into new_id;
  return new_id;
end $$;

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
  if (k = 'folder') <> (n.kind = 'folder') then
    raise exception 'Folders and items cannot be converted into each other' using errcode='22023';
  end if;
  if k = 'folder' then
    update public.content_nodes set label = coalesce(nullif(trim(p_label),''), label) where id = p_id;
    return;
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

create or replace function public.admin_create_pdf_entry(
  p_section uuid, p_entry_id uuid, p_path text, p_file_name text, p_size bigint, p_label text default null)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare sec public.content_nodes; lbl text;
begin
  select * into sec from public.content_nodes
  where id = p_section and (kind = 'folder' or (kind = 'section' and section_type = 'list'));
  if not found then raise exception 'Not a list section or folder' using errcode='22023'; end if;
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

-- Folders must be emptied first, so no document is deleted by accident and no
-- stored file is left behind.
create or replace function public.admin_delete_entry(p_id uuid)
returns text language plpgsql security definer set search_path = public, app as $$
declare n public.content_nodes;
begin
  select * into n from public.content_nodes where id = p_id;
  if not found then raise exception 'Not found' using errcode='P0002'; end if;
  if n.kind = 'section' then perform app.deny('Sections cannot be deleted'); end if;
  if not app.can_content('content.delete', p_id) then perform app.deny(); end if;
  if n.kind = 'folder' and exists (select 1 from public.content_nodes where parent_id = p_id) then
    raise exception 'Remove the items in this folder first' using errcode='22023';
  end if;
  delete from public.content_nodes where id = p_id;
  return n.file_path;
end $$;

-- Icon shown next to an item in the app (Material Community icon name).
create or replace function public.admin_set_entry_icon(p_id uuid, p_icon text)
returns void language plpgsql security definer set search_path = public, app as $$
declare n public.content_nodes;
begin
  select * into n from public.content_nodes where id = p_id;
  if not found or n.kind = 'section' then raise exception 'Not an item' using errcode='22023'; end if;
  if not app.can_content('content.edit', p_id) then perform app.deny(); end if;
  update public.content_nodes set icon = nullif(trim(p_icon),'') where id = p_id;
end $$;

revoke all on function public.admin_set_entry_icon(uuid, text) from public, anon;
grant execute on function public.admin_set_entry_icon(uuid, text) to authenticated;
