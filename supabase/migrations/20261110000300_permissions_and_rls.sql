-- Permission helpers, row-level security and guard triggers.

-------------------------------------------------------------------------------
-- Identity helpers (private schema `app`)
-------------------------------------------------------------------------------

-- Active (non-disabled) admin tier of the caller, or null.
create or replace function app.my_tier() returns public.admin_tier
language sql stable security definer set search_path = public, app as $$
  select tier from public.admin_accounts
  where user_id = auth.uid() and not disabled
$$;

create or replace function app.is_top() returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce(app.my_tier() in ('app_developer','super_admin'), false)
$$;

create or replace function app.is_app_developer() returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce(app.my_tier() = 'app_developer', false)
$$;

-- Does the caller hold `perm` through a role grant on node or its parent section?
create or replace function app.has_grant_on_node(perm text, node uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1
    from public.account_roles ar
    join public.role_grants g on g.role_id = ar.role_id
    join public.admin_accounts a on a.user_id = ar.user_id and not a.disabled
    where ar.user_id = auth.uid()
      and g.permission_id = perm
      and g.node_id in (node, (select parent_id from public.content_nodes where id = node))
  )
$$;

-- Content permission check. Section scope AND action must both be satisfied:
-- a delegate needs 'content.access' plus the specific action, each on the node
-- itself or its parent section. Top tiers pass automatically.
create or replace function app.can_content(perm text, node uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.is_top()
      or (app.has_grant_on_node('content.access', node)
          and (perm = 'content.access' or app.has_grant_on_node(perm, node)))
$$;

create or replace function app.can_source(perm text, source uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.is_top() or exists (
    select 1
    from public.account_roles ar
    join public.role_grants g on g.role_id = ar.role_id
    join public.admin_accounts a on a.user_id = ar.user_id and not a.disabled
    where ar.user_id = auth.uid() and g.permission_id = perm and g.source_id = source
  )
$$;

create or replace function app.can_global(perm text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.is_top() or exists (
    select 1
    from public.account_roles ar
    join public.role_grants g on g.role_id = ar.role_id
    join public.admin_accounts a on a.user_id = ar.user_id and not a.disabled
    where ar.user_id = auth.uid() and g.permission_id = perm
      and g.node_id is null and g.source_id is null
  )
$$;

create or replace function app.deny(msg text default 'Not permitted') returns void
language plpgsql as $$ begin raise exception '%', msg using errcode = '42501'; end $$;

-------------------------------------------------------------------------------
-- Guard triggers
-------------------------------------------------------------------------------

create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger t_admin_accounts_touch before update on public.admin_accounts
  for each row execute function app.touch_updated_at();
create trigger t_roles_touch before update on public.roles
  for each row execute function app.touch_updated_at();
create trigger t_content_touch before update on public.content_nodes
  for each row execute function app.touch_updated_at();
create trigger t_installations_touch before update on public.installations
  for each row execute function app.touch_updated_at();

-- Never leave the system without an active App Developer.
create or replace function app.protect_last_app_developer() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare remaining int;
begin
  if (tg_op = 'DELETE' and old.tier = 'app_developer' and not old.disabled)
     or (tg_op = 'UPDATE' and old.tier = 'app_developer' and not old.disabled
         and (new.tier <> 'app_developer' or new.disabled)) then
    select count(*) into remaining from public.admin_accounts
      where tier = 'app_developer' and not disabled and user_id <> old.user_id;
    if remaining = 0 then
      raise exception 'Cannot remove or disable the last active App Developer' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger t_protect_last_app_developer
  before update or delete on public.admin_accounts
  for each row execute function app.protect_last_app_developer();

-- Grants must match their permission's scope kind.
create or replace function app.check_grant_scope() returns trigger
language plpgsql as $$
declare sk text;
begin
  select scope_kind into sk from public.permissions where id = new.permission_id;
  if sk = 'content' and (new.node_id is null or new.source_id is not null) then
    raise exception 'Permission % needs a content section/entry', new.permission_id;
  elsif sk = 'source' and (new.source_id is null or new.node_id is not null) then
    raise exception 'Permission % needs a message source', new.permission_id;
  elsif sk = 'none' and (new.node_id is not null or new.source_id is not null) then
    raise exception 'Permission % is global and takes no scope', new.permission_id;
  end if;
  return new;
end $$;

create trigger t_check_grant_scope before insert or update on public.role_grants
  for each row execute function app.check_grant_scope();

-------------------------------------------------------------------------------
-- Row-level security. Every table has RLS on. Clients may only SELECT what
-- the policies allow; all writes go through the functions in the next file.
-------------------------------------------------------------------------------

alter table public.admin_accounts             enable row level security;
alter table public.roles                      enable row level security;
alter table public.account_roles              enable row level security;
alter table public.permissions                enable row level security;
alter table public.role_grants                enable row level security;
alter table public.content_nodes              enable row level security;
alter table public.message_sources            enable row level security;
alter table public.messages                   enable row level security;
alter table public.message_attachments        enable row level security;
alter table public.installations              enable row level security;
alter table public.installation_subscriptions enable row level security;
alter table public.push_deliveries            enable row level security;
alter table public.app_config                 enable row level security;

-- Remove Supabase's default broad table privileges, then grant reads explicitly.
revoke all on all tables in schema public from anon, authenticated;

-- Public content (no employee login by design).
grant select on public.content_nodes, public.message_sources, public.message_attachments
  to anon, authenticated;
create policy content_public_read on public.content_nodes for select using (true);
create policy sources_public_read on public.message_sources for select using (true);
create policy attachments_public_read on public.message_attachments for select using (true);

-- Messages: public columns only (no sender account, no request id).
grant select (id, source_id, source_label, scope, body, created_at)
  on public.messages to anon, authenticated;
create policy messages_public_read on public.messages for select using (true);

-- Admin metadata: top tiers see everything; others see only themselves.
grant select on public.admin_accounts, public.roles, public.account_roles,
  public.role_grants, public.permissions to authenticated;
create policy accounts_read on public.admin_accounts for select
  using (app.is_top() or user_id = auth.uid());
create policy roles_read on public.roles for select using (app.is_top());
create policy account_roles_read on public.account_roles for select
  using (app.is_top() or user_id = auth.uid());
create policy role_grants_read on public.role_grants for select
  using (app.is_top() or role_id in (select role_id from public.account_roles where user_id = auth.uid()));
create policy permissions_read on public.permissions for select using (true);

-- installations, installation_subscriptions, push_deliveries, app_config:
-- no client policies => no client access. Service role bypasses RLS.

-- Lock down helper functions: callable only from the definer functions, except
-- the two identity checks that RLS policies evaluate as the calling role (they
-- only reveal the caller's own status).
revoke all on all functions in schema app from public, anon, authenticated;
grant execute on function app.is_top(), app.my_tier() to anon, authenticated;
