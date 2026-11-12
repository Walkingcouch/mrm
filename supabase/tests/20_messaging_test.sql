-- Messaging & push tests. Acceptance checks K, L, M, N, R (+ installation safety).
-- Statements autocommit so each push_claim_batch call is its own transaction,
-- exactly as when the edge function calls it over the API.
\set ON_ERROR_STOP on
\set QUIET on
\set dev     '00000000-0000-0000-0000-0000000000d1'
\set super   '00000000-0000-0000-0000-0000000000a1'
\set kitchen '00000000-0000-0000-0000-0000000000c1'
\set gun     '00000000-0000-0000-0000-0000000000c2'
\set comms   '00000000-0000-0000-0000-0000000000c4'
\set src_kitchen '00000000-0000-0000-0000-00000000005a'
\set src_gun     '00000000-0000-0000-0000-00000000005b'
\set src_comms   '00000000-0000-0000-0000-00000000005e'
\set instA '10000000-0000-0000-0000-00000000000a'
\set instB '10000000-0000-0000-0000-00000000000b'
\set instC '10000000-0000-0000-0000-00000000000c'
\set instD '10000000-0000-0000-0000-00000000000d'
\set instE '10000000-0000-0000-0000-00000000000e'
\set secret 'test-secret-0123456789abcdef0123456789'

---------------------------------------------------------------- setup
select test.as_admin(:'dev');
select admin_register_account(:'super', 'super@example.test', 'Main', 'super_admin');
select test.as_admin(:'super');
select admin_register_account(:'kitchen', 'kitchen@example.test', 'Kitchen', 'delegate');
select admin_register_account(:'gun', 'gunclub@example.test', 'Gun', 'delegate');
select admin_register_account(:'comms', 'ops@example.test', 'Comms', 'delegate');
select admin_create_role('Kitchen/Mess') as r_k \gset
select admin_create_role('Gun Club') as r_g \gset
select admin_create_role('Communications') as r_c \gset
select admin_set_role_grants(:'r_k', jsonb_build_array(
  jsonb_build_object('permission_id','message.publish','source_id', :'src_kitchen'),
  jsonb_build_object('permission_id','push.department','source_id', :'src_kitchen')));
select admin_set_role_grants(:'r_g', jsonb_build_array(
  jsonb_build_object('permission_id','message.publish','source_id', :'src_gun')));
select admin_set_role_grants(:'r_c', jsonb_build_array(
  jsonb_build_object('permission_id','message.publish','source_id', :'src_comms'),
  jsonb_build_object('permission_id','push.global_general')));
select admin_set_account_roles(:'kitchen', array[:'r_k']::uuid[]);
select admin_set_account_roles(:'gun', array[:'r_g']::uuid[]);
select admin_set_account_roles(:'comms', array[:'r_c']::uuid[]);

-- Anonymous installations (as the mobile app would register them).
select test.as_anon();
select app_register_installation(:'instA', :'secret', 'ios',     'ExponentPushToken[AAAA]', true);
select app_register_installation(:'instB', :'secret', 'android', 'ExponentPushToken[BBBB]', true);
select app_register_installation(:'instC', :'secret', 'android', null, false);
select app_register_installation(:'instD', :'secret', 'ios',     'ExponentPushToken[DDDD]', true);
select app_set_subscriptions(:'instA', :'secret', array[:'src_kitchen']::uuid[]);
select app_set_subscriptions(:'instD', :'secret', array[:'src_gun']::uuid[]);
select test.check(app_get_subscriptions(:'instA', :'secret') = array[:'src_kitchen']::uuid[], 'Installation reads back its subscriptions');
select test.expect_error(format($$select app_register_installation(%L, 'another-secret-0123456789abcdef0123', 'ios', 'ExponentPushToken[ZZZZ]', true)$$, :'instA'),
  'Another device cannot hijack an installation id without its secret', '42501');
select test.expect_error(format($$select app_set_subscriptions(%L, 'wrong-secret-0123456789abcdef0123456', '{}')$$, :'instA'),
  'Subscriptions cannot be changed without the installation secret', '42501');
select test.expect_error(format($$select app_register_installation(gen_random_uuid(), %L, 'ios', 'not-a-token', true)$$, :'secret'),
  'Malformed push tokens are rejected', '22023');
select test.expect_error($$select push_claim_batch(gen_random_uuid(), 10)$$, 'Anonymous app cannot call push dispatch', '42501');

---------------------------------------------------------------- send (K, L)
select test.as_admin(:'kitchen');
select message_id as m1, created as m1_created, push_requested as m1_push from admin_send_message(
  '20000000-0000-0000-0000-000000000001', :'src_kitchen', 'department', 'Lunch moved to 12:30 today.') \gset
select test.check(:'m1_created'::boolean and :'m1_push'::boolean, 'Kitchen admin sends a departmental message with push');
select message_id as m1_again, created as m1_again_created from admin_send_message(
  '20000000-0000-0000-0000-000000000001', :'src_kitchen', 'department', 'Lunch moved to 12:30 today.') \gset
select test.check(:'m1_again' = :'m1' and not :'m1_again_created'::boolean, 'Repeat Send with same request id returns the same message (L)');
reset role;
select test.check((select count(*) from messages where request_id = '20000000-0000-0000-0000-000000000001') = 1, 'Exactly one message stored for repeated Send (L)');
select test.check((select source_label from messages where id = :'m1') = 'Kitchen', 'Message carries its source label (K)');
select test.check((select abs(extract(epoch from (push_deadline - created_at)) - 86400) < 1 from messages where id = :'m1'), 'Push deadline is created_at + 24h');
select test.check(not exists (select 1 from information_schema.columns where table_name = 'messages'
  and column_name in ('title','category','expires_at','scheduled_at','status_approval')), 'No title/category/schedule/expiry/approval fields exist (K)');

select test.as_admin(:'kitchen');
select test.expect_error(format($$select * from admin_send_message(gen_random_uuid(), %L, 'department', 'x')$$, :'src_gun'),
  'Kitchen admin cannot impersonate the Gun Club source', '42501');
select test.expect_error(format($$select * from admin_send_message(gen_random_uuid(), %L, 'global_general', 'x')$$, :'src_kitchen'),
  'Kitchen admin cannot send global general messages', '42501');
select test.expect_error(format($$select * from admin_send_message(gen_random_uuid(), %L, 'global_emergency', 'x')$$, :'src_kitchen'),
  'Kitchen admin cannot send emergency broadcasts', '42501');
select test.expect_error(format($$select * from admin_send_message(gen_random_uuid(), %L, 'department', '   ')$$, :'src_kitchen'),
  'Empty messages are rejected');
select test.expect_error(format($$select * from admin_send_message('20000000-0000-0000-0000-000000000009', %L, 'department', 'x', '[{"path":"other/x.pdf","name":"x.pdf","mime":"application/pdf","size":1}]')$$, :'src_kitchen'),
  'Attachment paths must belong to this send request', '22023');

select test.as_admin(:'comms');
select test.expect_error(format($$select * from admin_send_message('20000000-0000-0000-0000-000000000001', %L, 'global_general', 'x')$$, :'src_comms'),
  'Another admin cannot reuse someone else''s request id', '42501');
select test.expect_error(format($$select * from admin_send_message(gen_random_uuid(), %L, 'global_emergency', 'x')$$, :'src_comms'),
  'Global general permission does not imply emergency permission', '42501');

select test.as_admin(:'gun');
select message_id as mg, push_requested as mg_push from admin_send_message(
  '20000000-0000-0000-0000-000000000002', :'src_gun', 'department', 'Range closed Saturday.') \gset
select test.check(not :'mg_push'::boolean, 'Publish-only admin saves message without push');
select test.expect_error(format($$select admin_delete_message(%L)$$, :'m1'), 'Gun Club admin cannot delete a Kitchen message', '42501');

---------------------------------------------------------------- dispatch (M, R)
select test.as_service();
select test.check((select count(*) from push_claim_batch(:'mg', 100)) = 0, 'No push is dispatched for a publish-only message');
select test.check((select array_agg(installation_id order by installation_id) from push_claim_batch(:'m1', 100)) = array[:'instA']::uuid[],
  'Departmental push goes only to subscribed installations (R, subscribers mode)');
select test.check((select count(*) from push_claim_batch(:'m1', 100)) = 0, 'Second claim does not re-send to the same installation (M)');
select push_record_results(:'m1', jsonb_build_array(jsonb_build_object('installation_id', :'instA', 'ok', true, 'ticket_id', 't1')));
select test.check(push_finish(:'m1') = 'done', 'Message dispatch completes');
select test.check((select count(*) from push_claim_batch(:'m1', 100)) = 0, 'Completed message is never dispatched again (M)');
select test.check((select count(*) from push_deliveries where message_id = :'m1') = 1, 'One delivery row per installation/message (M)');

select test.as_admin(:'comms');
select message_id as mc from admin_send_message('20000000-0000-0000-0000-000000000003', :'src_comms', 'global_general', 'Site-wide notice.') \gset
select test.as_service();
select expiration as mc_exp from push_claim_batch(:'mc', 100) limit 1 \gset
reset role;
select test.check(:'mc_exp'::bigint = (select extract(epoch from push_deadline)::bigint from messages where id = :'mc'),
  'Provider expiration is the absolute 24h deadline');
select test.check((select count(*) from push_deliveries where message_id = :'mc') = 3,
  'Global push targets every push-enabled installation (R)');
select test.as_service();
select push_record_results(:'mc', jsonb_build_array(
  jsonb_build_object('installation_id', :'instA', 'ok', true),
  jsonb_build_object('installation_id', :'instB', 'ok', true),
  jsonb_build_object('installation_id', :'instD', 'ok', false, 'error_code', 'NetworkError')));
select test.check(push_finish(:'mc') = 'pending', 'A failed recipient leaves the message pending for retry');
select test.check((select array_agg(installation_id) from push_claim_batch(:'mc', 100)) = array[:'instD']::uuid[],
  'Retry targets only the failed installation');
reset role;
select test.check((select attempts from push_deliveries where message_id = :'mc' and installation_id = :'instD') = 2, 'Retry counted');
select test.check((select abs(extract(epoch from (push_deadline - created_at)) - 86400) < 1 from messages where id = :'mc'), 'Retries do not reset the 24h deadline');
select test.as_service();
select push_record_results(:'mc', jsonb_build_array(jsonb_build_object('installation_id', :'instD', 'ok', false, 'error_code', 'DeviceNotRegistered')));
select test.check(push_finish(:'mc') = 'done', 'Dead token is not retried');
reset role;
select test.check((select push_token is null and not push_enabled from installations where id = :'instD'), 'DeviceNotRegistered clears the token');

---------------------------------------------------------------- expiry (N)
select test.as_admin(:'kitchen');
select message_id as mx from admin_send_message('20000000-0000-0000-0000-000000000004', :'src_kitchen', 'department', 'Old news.') \gset
reset role;
update messages set created_at = now() - interval '25 hours', push_deadline = now() - interval '1 hour' where id = :'mx';
select test.as_service();
select test.check((select count(*) from push_claim_batch(:'mx', 100)) = 0, 'No late push after the 24h window (N)');
select test.check(not exists (select 1 from push_due_messages() d where d = :'mx'), 'Sweep ignores expired messages (N)');
reset role;
select test.check((select push_status from messages where id = :'mx') = 'expired', 'Message marked expired');
select test.as_anon();
select test.check(exists (select id, body from messages where id = :'mx'), 'Expired message remains manually readable (N, P)');
select test.expect_error($$select created_by from messages limit 1$$, 'App cannot see which admin sent a message', '42501');

---------------------------------------------------------------- 'everyone' routing mode
select test.as_admin(:'super');
select test.expect_error($$select admin_set_config('departmental_push_mode', '"everyone"')$$, 'Only the App Developer changes push routing', '42501');
select test.as_admin(:'dev');
select admin_set_config('departmental_push_mode', '"everyone"');
select test.as_admin(:'kitchen');
select message_id as me from admin_send_message('20000000-0000-0000-0000-000000000005', :'src_kitchen', 'department', 'Everyone mode.') \gset
select test.as_service();
select test.check((select count(*) from push_claim_batch(:'me', 100)) = 2, 'In everyone mode departmental pushes go to all push-enabled installations');
select test.as_admin(:'dev');
select admin_set_config('departmental_push_mode', '"subscribers"');

---------------------------------------------------------------- notification wording
select test.as_admin(:'kitchen');
select message_id as mw from admin_send_message('20000000-0000-0000-0000-000000000006', :'src_kitchen', 'department', 'Menu has been updated for tonight.') \gset
select test.as_service();
select title as mw_title, body as mw_body, urgent as mw_urgent from push_claim_batch(:'mw', 100) limit 1 \gset
select test.check(:'mw_title' = 'Kitchen' and :'mw_body' = 'Menu has been updated for tonight.' and not :'mw_urgent'::boolean,
  'Normal push: title is the team, body is a preview of the message');
select test.as_admin(:'super');
select message_id as mu from admin_send_message('20000000-0000-0000-0000-000000000007', :'src_comms', 'global_emergency', 'Cyclone warning: stay indoors.') \gset
select test.as_service();
select title as mu_title, body as mu_body, urgent as mu_urgent from push_claim_batch(:'mu', 100) limit 1 \gset
select test.check(:'mu_title' = 'Emergency Notification' and :'mu_body' like 'Please read an important update%' and :'mu_urgent'::boolean,
  'Emergency push: "Emergency Notification" title, read-now summary, urgent channel');

---------------------------------------------------------------- token reuse
select test.as_anon();
select app_register_installation(:'instE', :'secret', 'ios', 'ExponentPushToken[AAAA]', true);
reset role;
select test.check((select push_token is null from installations where id = :'instA'), 'Re-registered token moves to the new installation (no duplicate pushes)');

reset role;
\echo 'messaging tests passed'
