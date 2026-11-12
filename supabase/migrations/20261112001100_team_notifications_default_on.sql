-- Team notifications are ON by default (owner decision, 12 Nov 2026):
--  * a newly registered phone follows every team that offers notifications;
--  * a newly created team is followed by every phone;
--  * phones that never chose any teams are switched to all teams now.
-- Staff can still switch individual teams off in the app's Settings.

create or replace function public.app_register_installation(
  p_id uuid, p_secret text, p_platform text, p_push_token text, p_push_enabled boolean)
returns void language plpgsql security definer set search_path = public, app, extensions as $$
declare h text := encode(digest(p_secret, 'sha256'), 'hex'); cur public.installations; is_new boolean;
begin
  if p_secret is null or length(p_secret) < 32 then raise exception 'Invalid secret' using errcode='22023'; end if;
  if p_platform not in ('ios','android') then raise exception 'Invalid platform' using errcode='22023'; end if;
  if p_push_token is not null and p_push_token !~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid push token' using errcode='22023';
  end if;

  select * into cur from public.installations where id = p_id for update;
  if found and cur.secret_hash <> h then perform app.deny(); end if;
  is_new := not found;

  if p_push_token is not null then
    update public.installations set push_token = null, push_enabled = false
    where push_token = p_push_token and id <> p_id;
  end if;

  insert into public.installations (id, secret_hash, platform, push_token, push_enabled)
  values (p_id, h, p_platform, p_push_token, coalesce(p_push_enabled,false) and p_push_token is not null)
  on conflict (id) do update set
    platform = excluded.platform, push_token = excluded.push_token, push_enabled = excluded.push_enabled;

  if is_new then
    insert into public.installation_subscriptions (installation_id, source_id)
    select p_id, s.id from public.message_sources s where s.is_active and s.subscribable
    on conflict do nothing;
  end if;
end $$;

create or replace function app.subscribe_all_to_new_source() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if new.subscribable and new.is_active then
    insert into public.installation_subscriptions (installation_id, source_id)
    select i.id, new.id from public.installations i
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists t_sources_default_on on public.message_sources;
create trigger t_sources_default_on after insert on public.message_sources
  for each row execute function app.subscribe_all_to_new_source();

-- Phones registered before this change that never picked any team.
insert into public.installation_subscriptions (installation_id, source_id)
select i.id, s.id
from public.installations i cross join public.message_sources s
where s.is_active and s.subscribable
  and not exists (select 1 from public.installation_subscriptions x where x.installation_id = i.id)
on conflict do nothing;
