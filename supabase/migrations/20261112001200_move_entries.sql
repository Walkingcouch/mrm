-- Move items into a folder, out to the section's top level, or between folders
-- of the same section, keeping their relative order. Needs edit rights on the
-- items and on the destination (same rules as editing).
create or replace function public.admin_move_entries(p_ids uuid[], p_target uuid)
returns int language plpgsql security definer set search_path = public, app as $$
declare
  tgt public.content_nodes; tgt_section uuid; e public.content_nodes; e_section uuid; pos int; moved int := 0;
begin
  select * into tgt from public.content_nodes
  where id = p_target and (kind = 'folder' or (kind = 'section' and section_type = 'list'));
  if not found then raise exception 'Choose a section or folder to move to' using errcode = '22023'; end if;
  tgt_section := case when tgt.kind = 'section' then tgt.id else tgt.parent_id end;
  if not app.can_content('content.edit', p_target) then perform app.deny(); end if;

  pos := coalesce((select max(position) from public.content_nodes where parent_id = p_target), 0);
  for e in select * from public.content_nodes where id = any(coalesce(p_ids, '{}')) order by position loop
    if e.kind = 'section' then perform app.deny('Sections cannot be moved'); end if;
    if e.kind = 'folder' and tgt.kind = 'folder' then
      raise exception 'Folders cannot go inside folders' using errcode = '22023';
    end if;
    select case when p.kind = 'section' then p.id else p.parent_id end into e_section
    from public.content_nodes p where p.id = e.parent_id;
    if e_section is distinct from tgt_section then
      raise exception 'Items can only be moved within the same section' using errcode = '22023';
    end if;
    if not app.can_content('content.edit', e.id) then perform app.deny(); end if;
    continue when e.parent_id = p_target;
    pos := pos + 10;
    update public.content_nodes set parent_id = p_target, position = pos where id = e.id;
    moved := moved + 1;
  end loop;
  return moved;
end $$;

revoke all on function public.admin_move_entries(uuid[], uuid) from public, anon;
grant execute on function public.admin_move_entries(uuid[], uuid) to authenticated;
