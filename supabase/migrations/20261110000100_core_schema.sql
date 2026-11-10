-- McArthur River Mine app — core schema
-- Supabase (Postgres 15+). All writes go through SECURITY DEFINER functions
-- that enforce permissions; tables are read-only (or invisible) to clients.

create extension if not exists pgcrypto;

create schema if not exists app;          -- private helpers, not exposed via the API
grant usage on schema app to anon, authenticated, service_role;

-------------------------------------------------------------------------------
-- Admin accounts, roles, permissions
-------------------------------------------------------------------------------

-- Fixed top-level tiers. 'delegate' = an administrator whose access comes only
-- from custom roles.
create type public.admin_tier as enum ('app_developer', 'super_admin', 'delegate');

create table public.admin_accounts (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  tier         public.admin_tier not null default 'delegate',
  disabled     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Custom roles: names are plain labels. Access depends on role_grants rows,
-- which reference stable permission ids — never role names.
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index roles_name_ci on public.roles (lower(name));

create table public.account_roles (
  user_id uuid not null references public.admin_accounts (user_id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (user_id, role_id)
);

-- Stable permission catalogue (seeded below; not editable from the website).
-- scope_kind: 'content' => grant needs a content node; 'source' => needs a
-- message source; 'none' => global.
create table public.permissions (
  id          text primary key,
  label       text not null,
  scope_kind  text not null check (scope_kind in ('content', 'source', 'none')),
  position    int  not null
);

-------------------------------------------------------------------------------
-- Content
-------------------------------------------------------------------------------

-- Sections are fixed (one per menu item, created by this migration).
-- Entries are rows whose parent is a section. Depth is exactly two.
create type public.node_kind as enum ('section', 'pdf', 'url', 'info', 'phone', 'map');

create table public.content_nodes (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.content_nodes (id) on delete cascade,
  key           text unique,                 -- stable key for sections only
  kind          public.node_kind not null,
  -- Section presentation type (sections only):
  --   list     = list of entries (PDF/url/info/phone/map)
  --   web      = single configured URL (Flight Tracker)
  --   weather  = widget or URL fallback
  --   messages = Employee Messages
  --   settings = Settings screen
  --   home     = Home
  section_type  text check (section_type in ('home','list','web','weather','messages','settings')),
  sort_mode     text not null default 'manual' check (sort_mode in ('manual','newest_first')),
  label         text not null check (length(trim(label)) between 1 and 120),
  position      int  not null default 0,
  url           text,                        -- url/form/map entries; web/weather sections
  body          text check (body is null or length(body) <= 20000),  -- info text (plain text)
  phone         text check (phone is null or phone ~ '^\+?[0-9 ()-]{3,30}$'),
  widget_html   text,                        -- weather section only; App Developer / Super Admin
  file_path     text,                        -- storage object path within bucket 'content'
  file_name     text,
  file_size     bigint,
  file_updated_at timestamptz,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sections_have_no_parent check ((kind = 'section') = (parent_id is null)),
  constraint section_type_only_on_sections check ((kind = 'section') = (section_type is not null)),
  constraint url_is_http check (url is null or url ~* '^(https?://|tel:|geo:|maps:)')
);
create index content_nodes_parent on public.content_nodes (parent_id, position);

-------------------------------------------------------------------------------
-- Messages
-------------------------------------------------------------------------------

create table public.message_sources (
  id          uuid primary key default gen_random_uuid(),
  label       text not null check (length(trim(label)) between 1 and 60),
  -- Whether this source appears as an optional subscription in the app's
  -- Settings (only used when departmental_push_mode = 'subscribers').
  subscribable boolean not null default true,
  position    int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create type public.message_scope as enum ('department', 'global_general', 'global_emergency');

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null unique,         -- client idempotency key
  source_id     uuid references public.message_sources (id) on delete set null,
  source_label  text not null,                -- snapshot: stays stable if the source is renamed
  scope         public.message_scope not null,
  body          text not null check (length(trim(body)) between 1 and 5000),
  push_requested boolean not null,            -- false when sender may publish but not push
  push_deadline timestamptz not null,         -- created_at + 24h, fixed at send time
  push_status   text not null default 'pending'
                check (push_status in ('pending','dispatching','done','expired','not_requested')),
  created_by    uuid references public.admin_accounts (user_id) on delete set null,
  created_at    timestamptz not null default now()
);
create index messages_created on public.messages (created_at desc);
create index messages_push_pending on public.messages (push_deadline) where push_status in ('pending','dispatching');

create table public.message_attachments (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  mime_type   text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp','image/heic')),
  file_size   bigint not null,
  position    int not null default 0
);

-------------------------------------------------------------------------------
-- Anonymous installations & push
-------------------------------------------------------------------------------

create table public.installations (
  id            uuid primary key,             -- random UUID generated on the device
  secret_hash   text not null,                -- sha256 of a device-held secret
  platform      text not null check (platform in ('ios','android')),
  push_token    text,
  push_enabled  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index installations_token on public.installations (push_token) where push_token is not null;

create table public.installation_subscriptions (
  installation_id uuid not null references public.installations (id) on delete cascade,
  source_id       uuid not null references public.message_sources (id) on delete cascade,
  primary key (installation_id, source_id)
);

-- One row per (message, installation): the idempotency guard for push sends.
create table public.push_deliveries (
  message_id      uuid not null references public.messages (id) on delete cascade,
  installation_id uuid not null references public.installations (id) on delete cascade,
  status          text not null check (status in ('claimed','sent','error','expired')),
  attempts        int  not null default 0,
  ticket_id       text,
  error_code      text,
  updated_at      timestamptz not null default now(),
  primary key (message_id, installation_id)
);

-------------------------------------------------------------------------------
-- Application configuration (App Developer)
-------------------------------------------------------------------------------

create table public.app_config (
  key   text primary key,
  value jsonb not null
);

-------------------------------------------------------------------------------
-- Role grants (needs content_nodes and message_sources)
-------------------------------------------------------------------------------

create table public.role_grants (
  id            uuid primary key default gen_random_uuid(),
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id),
  node_id       uuid references public.content_nodes (id) on delete cascade,
  source_id     uuid references public.message_sources (id) on delete cascade
);
create unique index role_grants_unique on public.role_grants
  (role_id, permission_id, coalesce(node_id, '00000000-0000-0000-0000-000000000000'),
   coalesce(source_id, '00000000-0000-0000-0000-000000000000'));
