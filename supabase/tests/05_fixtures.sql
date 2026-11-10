-- Test fixtures (test database only; never applied to Supabase).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'dev@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'dev2@example.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'super@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'super2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'kitchen@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'gunclub@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'hr@example.test'),
  ('00000000-0000-0000-0000-0000000000c4', 'ops@example.test'),
  ('00000000-0000-0000-0000-0000000000c5', 'nobody@example.test');

-- Bootstrap: the first App Developer is inserted directly (see docs/SETUP.md).
insert into public.admin_accounts (user_id, email, tier) values
  ('00000000-0000-0000-0000-0000000000d1', 'dev@example.test', 'app_developer');

insert into public.message_sources (id, label, position) values
  ('00000000-0000-0000-0000-00000000005a', 'Kitchen',        10),
  ('00000000-0000-0000-0000-00000000005b', 'Gun Club',       20),
  ('00000000-0000-0000-0000-00000000005c', 'Operations',     30),
  ('00000000-0000-0000-0000-00000000005d', 'HR',             40),
  ('00000000-0000-0000-0000-00000000005e', 'Communications', 50);

-- Fake uploaded storage objects.
insert into storage.objects (bucket_id, name)
select 'content', id::text || '/upload-1.pdf' from public.content_nodes where kind = 'pdf';
insert into storage.objects (bucket_id, name)
select 'content', id::text || '/upload-2.pdf' from public.content_nodes where kind = 'pdf';
