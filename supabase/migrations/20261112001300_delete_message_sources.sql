-- Let top-tier admins delete a message source (team).
-- Messages already sent are kept: messages.source_id is set to null and the
-- message keeps its source_label snapshot, so it still shows under the old
-- team name in the app and in the admin log. Role grants and phone follows for
-- the source are removed with it (they only make sense while it exists).
create or replace function public.admin_delete_source(p_id uuid)
returns int language plpgsql security definer set search_path = public, app as $$
declare kept int;
begin
  if not app.is_top() then perform app.deny(); end if;
  if not exists (select 1 from public.message_sources where id = p_id) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  select count(*) into kept from public.messages where source_id = p_id;
  delete from public.message_sources where id = p_id;
  return kept;
end $$;

revoke all on function public.admin_delete_source(uuid) from public, anon;
grant execute on function public.admin_delete_source(uuid) to authenticated;
