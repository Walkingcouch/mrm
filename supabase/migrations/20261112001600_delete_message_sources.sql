-- Deleting a message source (team) from the admin website.
-- Soft delete: the row stays so every message already sent keeps its source
-- (id + the name it was sent under) and stays in Employee Messages and the
-- admin log. A deleted source can't send, can't be followed in the app, is
-- hidden from the Sources page, and its role permissions and phone
-- follow-settings are removed.
alter table public.message_sources add column if not exists deleted_at timestamptz;

create or replace function public.admin_delete_source(p_id uuid)
returns int language plpgsql security definer set search_path = public, app as $$
declare kept int;
begin
  if not app.is_top() then perform app.deny(); end if;
  update public.message_sources set deleted_at = now(), is_active = false
  where id = p_id and deleted_at is null;
  if not found then raise exception 'Not found' using errcode = 'P0002'; end if;
  delete from public.role_grants where source_id = p_id;
  delete from public.installation_subscriptions where source_id = p_id;
  select count(*) into kept from public.messages where source_id = p_id;
  return kept; -- messages kept from this source
end $$;
revoke all on function public.admin_delete_source(uuid) from public, anon;
grant execute on function public.admin_delete_source(uuid) to authenticated;

-- Deleted sources can't be edited or re-activated.
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
    where id = p_id and deleted_at is null returning id into rid;
    if rid is null then raise exception 'Not found' using errcode='P0002'; end if;
  end if;
  return rid;
end $$;
