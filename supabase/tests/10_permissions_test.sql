-- Permission & access-model tests. Acceptance checks H, I, J, W (+ hierarchy).
\set ON_ERROR_STOP on
\set QUIET on
\set dev     '00000000-0000-0000-0000-0000000000d1'
\set dev2    '00000000-0000-0000-0000-0000000000d2'
\set super   '00000000-0000-0000-0000-0000000000a1'
\set super2  '00000000-0000-0000-0000-0000000000a2'
\set kitchen '00000000-0000-0000-0000-0000000000c1'
\set gun     '00000000-0000-0000-0000-0000000000c2'
\set hr      '00000000-0000-0000-0000-0000000000c3'
\set ops     '00000000-0000-0000-0000-0000000000c4'
\set nobody  '00000000-0000-0000-0000-0000000000c5'
\set src_kitchen '00000000-0000-0000-0000-00000000005a'
\set src_gun     '00000000-0000-0000-0000-00000000005b'

select id as menu    from content_nodes where label = 'Menu' \gset
select id as gunclub from content_nodes where label = 'MRM Gun Club' \gset
select id as village from content_nodes where key = 'village' \gset
select id as hrsec   from content_nodes where key = 'hr' \gset
select id as hrentry from content_nodes where label = 'Payslip Guide' \gset
select id as flight  from content_nodes where key = 'flight' \gset
select id as tt      from content_nodes where label = 'Flight Timetable' \gset
select id as callsec from content_nodes where key = 'call' \gset

begin;

---------------------------------------------------------------- hierarchy
select test.as_admin(:'dev');
select test.expect_ok(format($$select admin_register_account(%L,'super@example.test','Main Contact','super_admin')$$, :'super'),
  'App Developer appoints a Super Admin');
select test.expect_ok(format($$select admin_register_account(%L,'dev2@example.test','Backup dev','app_developer')$$, :'dev2'),
  'App Developer appoints a second App Developer');

select test.as_admin(:'super');
select test.check((admin_me()->>'tier') = 'super_admin', 'Super Admin can sign in to admin_me');
select test.expect_error(format($$select admin_register_account(%L,'super2@example.test','x','super_admin')$$, :'super2'),
  'Super Admin cannot appoint another Super Admin (hierarchy default)', '42501');
select test.expect_error(format($$select admin_register_account(%L,'super2@example.test','x','app_developer')$$, :'super2'),
  'Super Admin cannot grant App Developer access', '42501');
select test.expect_error(format($$select admin_set_disabled(%L,true)$$, :'dev'),
  'Super Admin cannot disable the App Developer', '42501');
select test.expect_error(format($$select admin_set_disabled(%L,true)$$, :'super'),
  'Super Admin cannot change their own access', '42501');

-- Delegated admins
select test.expect_ok(format($$select admin_register_account(%L,'kitchen@example.test','Kitchen admin','delegate')$$, :'kitchen'), 'Super Admin creates kitchen admin');
select test.expect_ok(format($$select admin_register_account(%L,'gunclub@example.test','Gun Club admin','delegate')$$, :'gun'), 'Super Admin creates gun club admin');
select test.expect_ok(format($$select admin_register_account(%L,'hr@example.test','HR admin','delegate')$$, :'hr'), 'Super Admin creates HR admin');
select test.expect_ok(format($$select admin_register_account(%L,'ops@example.test','Ops admin','delegate')$$, :'ops'), 'Super Admin creates ops admin');
select test.expect_ok(format($$select admin_register_account(%L,'nobody@example.test','No roles','delegate')$$, :'nobody'), 'Super Admin creates admin with no roles');

---------------------------------------------------------------- roles (I)
select admin_create_role('Kitchen/Mess') as r_kitchen \gset
select admin_create_role('Gun Club') as r_gun \gset
select admin_create_role('HR') as r_hr \gset
select admin_create_role('Operations') as r_ops \gset

select admin_set_role_grants(:'r_kitchen', jsonb_build_array(
  jsonb_build_object('permission_id','content.access','node_id', :'menu'),
  jsonb_build_object('permission_id','content.upload','node_id', :'menu'),
  jsonb_build_object('permission_id','message.publish','source_id', :'src_kitchen'),
  jsonb_build_object('permission_id','push.department','source_id', :'src_kitchen')));
select admin_set_role_grants(:'r_gun', jsonb_build_array(
  jsonb_build_object('permission_id','content.access','node_id', :'gunclub'),
  jsonb_build_object('permission_id','content.upload','node_id', :'gunclub'),
  jsonb_build_object('permission_id','message.publish','source_id', :'src_gun')));
select admin_set_role_grants(:'r_hr', jsonb_build_array(
  jsonb_build_object('permission_id','content.access','node_id', :'hrsec'),
  jsonb_build_object('permission_id','content.edit','node_id', :'hrsec'),
  jsonb_build_object('permission_id','content.delete','node_id', :'hrsec')));
-- Operations: upload but deliberately NO content.access => scope not satisfied.
select admin_set_role_grants(:'r_ops', jsonb_build_array(
  jsonb_build_object('permission_id','content.upload','node_id', :'tt')));

select test.expect_error(format($$select admin_set_role_grants(%L, '[{"permission_id":"content.upload"}]')$$, :'r_ops'),
  'Content permission without a section/entry is rejected');
select test.expect_error(format($$select admin_set_role_grants(%L, jsonb_build_array(jsonb_build_object('permission_id','push.global_emergency','node_id',%L)))$$, :'r_ops', :'menu'),
  'Global permission with a scope is rejected');

select admin_set_account_roles(:'kitchen', array[:'r_kitchen']::uuid[]);
select admin_set_account_roles(:'gun', array[:'r_gun']::uuid[]);
select admin_set_account_roles(:'hr', array[:'r_hr']::uuid[]);
select admin_set_account_roles(:'ops', array[:'r_ops']::uuid[]);

---------------------------------------------------------------- content isolation (H)
select test.as_admin(:'kitchen');
select test.expect_ok(format($$select admin_attach_pdf(%L, %L, 'menu-tue.pdf', 1000)$$, :'menu', :'menu' || '/upload-1.pdf'),
  'Kitchen admin replaces the Menu PDF');
select test.check((select label from content_nodes where id = :'menu') = 'Menu',
  'Replacing the menu keeps the existing entry label (no metadata needed)');
select test.check((select position from content_nodes where id = :'menu') = 20,
  'Replacing the menu keeps its position');
select test.expect_error(format($$select admin_attach_pdf(%L, %L, 'x.pdf', 1)$$, :'gunclub', :'gunclub' || '/upload-1.pdf'),
  'Kitchen admin cannot replace the Gun Club PDF (direct API request)', '42501');
select test.expect_error(format($$select admin_attach_pdf(%L, %L, 'x.pdf', 1)$$, :'tt', :'tt' || '/upload-1.pdf'),
  'Kitchen admin cannot replace a timetable', '42501');
select test.expect_error(format($$select admin_update_entry(%L, 'Hacked')$$, :'hrentry'),
  'Kitchen admin cannot edit HR entries', '42501');
select test.expect_error(format($$select admin_delete_entry(%L)$$, :'menu'),
  'Kitchen admin cannot delete the menu (no delete permission)', '42501');
select test.expect_error(format($$select admin_update_entry(%L, 'Menu 2')$$, :'menu'),
  'Kitchen upload permission does not imply edit permission', '42501');
select test.expect_error(format($$select admin_create_pdf_entry(%L, gen_random_uuid(), 'x/y.pdf', 'y.pdf', 1)$$, :'village'),
  'Kitchen entry permission does not allow new entries in MRM Village', '42501');
select test.expect_error(format($$select admin_attach_pdf(%L, %L, 'x.pdf', 1)$$, :'menu', :'gunclub' || '/upload-2.pdf'),
  'Upload path must belong to the entry being replaced');
select test.expect_error($$update content_nodes set label = 'direct' where true$$,
  'Direct table writes are refused');
select test.check((admin_me()->'content') ? :'menu' and not ((admin_me()->'content') ? :'gunclub'),
  'admin_me exposes Menu but not Gun Club to the kitchen admin');
select test.expect_error(format($$select admin_create_role('Self made')$$), 'Delegate cannot create roles', '42501');
select test.expect_error(format($$select admin_set_account_roles(%L, '{}')$$, :'kitchen'), 'Delegate cannot change role assignments (no self-elevation)', '42501');
select test.expect_error(format($$select admin_set_role_grants(%L, '[]')$$, :'r_kitchen'), 'Delegate cannot edit role grants', '42501');
select test.expect_error($$select admin_set_weather_widget('<script src="https://evil.example/x.js"></script>')$$, 'Delegate cannot set weather widget', '42501');

select test.as_admin(:'gun');
select test.expect_ok(format($$select admin_attach_pdf(%L, %L, 'club.pdf', 1)$$, :'gunclub', :'gunclub' || '/upload-1.pdf'),
  'Gun Club admin replaces the Gun Club PDF');
select test.expect_error(format($$select admin_attach_pdf(%L, %L, 'x.pdf', 1)$$, :'menu', :'menu' || '/upload-2.pdf'),
  'Gun Club admin cannot replace the menu', '42501');

select test.as_admin(:'ops');
select test.expect_error(format($$select admin_attach_pdf(%L, %L, 'x.pdf', 1)$$, :'tt', :'tt' || '/upload-2.pdf'),
  'Action permission without section access is denied (scope AND action)', '42501');

---------------------------------------------------------------- HR / list sections (W)
select test.as_admin(:'hr');
select admin_create_entry(:'hrsec', 'url', 'New Survey', 'https://www.surveymonkey.com/r/EXAMPLE') as newhr \gset
select test.check((select parent_id from content_nodes where id = :'newhr') = :'hrsec', 'HR admin adds an HR entry');
select test.expect_ok(format($$select admin_update_entry(%L, 'Renamed survey', 'url', 'https://www.surveymonkey.com/r/EXAMPLE2')$$, :'newhr'), 'HR admin renames/edits an entry');
select test.expect_ok(format($$select admin_reorder_entries(%L, array[%L, %L]::uuid[])$$, :'hrsec', :'newhr', :'hrentry'), 'HR admin reorders entries');
select test.check((select position from content_nodes where id = :'newhr') = 10, 'Reorder applied');
select test.expect_error(format($$select admin_update_entry(%L, null, 'url', 'javascript:alert(1)')$$, :'newhr'), 'Non-https links are rejected', '22023');
select test.expect_ok(format($$select admin_delete_entry(%L)$$, :'newhr'), 'HR admin removes an entry');
select test.expect_error(format($$select admin_create_entry(%L, 'phone', 'Security', null, null, '0889 000 000')$$, :'callsec'),
  'HR admin cannot add Call Us entries', '42501');

select test.as_admin(:'nobody');
select test.check(admin_me()->'content' = '{}'::jsonb, 'Admin with no roles sees no sections');
select test.expect_error(format($$select admin_update_entry(%L, null, null, 'https://flightaware.com/x')$$, :'flight'), 'Admin with no roles cannot change Flight Tracker URL', '42501');

select test.as_admin(:'super');
select test.expect_ok(format($$select admin_create_entry(%L, 'phone', 'Example Contact', null, null, '+61 8 0000 0000')$$, :'callsec'), 'Super Admin adds Call Us phone entry');
select test.expect_ok(format($$select admin_update_entry(%L, null, null, 'https://www.flightaware.com/live/airport/EXAMPLE')$$, :'flight'), 'Super Admin sets Flight Tracker URL');
select test.expect_error(format($$select admin_delete_entry(%L)$$, :'village'), 'Sections cannot be deleted');
select test.expect_ok($$select admin_set_weather_widget('<div><script src="https://www.willyweather.com.au/widget/loadView.html?id=1"></script></div>')$$, 'Super Admin sets WillyWeather widget');
select test.expect_error($$select admin_set_weather_widget('<script src="https://www.willyweather.com.au.evil.example/x.js"></script>')$$, 'Widget code from other domains rejected', '22023');

---------------------------------------------------------------- rename / revoke (I, J)
select admin_rename_role(:'r_kitchen', 'Mess Hall Team');
select test.as_admin(:'kitchen');
select test.expect_ok(format($$select admin_attach_pdf(%L, %L, 'menu-wed.pdf', 1000)$$, :'menu', :'menu' || '/upload-2.pdf'),
  'Renaming the role does not break access');

select test.as_admin(:'super');
select admin_set_role_grants(:'r_kitchen', jsonb_build_array(
  jsonb_build_object('permission_id','content.access','node_id', :'menu')));
select test.as_admin(:'kitchen');
select test.expect_error(format($$select admin_attach_pdf(%L, %L, 'x.pdf', 1)$$, :'menu', :'menu' || '/upload-1.pdf'),
  'Revoking a grant removes that access immediately', '42501');

select test.as_admin(:'super');
select admin_set_disabled(:'gun', true);
select test.as_admin(:'gun');
select test.check(admin_me() is null, 'Disabled admin has no admin session');
select test.expect_error(format($$select admin_attach_pdf(%L, %L, 'x.pdf', 1)$$, :'gunclub', :'gunclub' || '/upload-2.pdf'),
  'Disabled admin is denied even with a still-valid login token', '42501');

select test.as_admin(:'super');
select admin_delete_role(:'r_hr');
select test.check((select count(*) from role_grants where role_id = :'r_hr') = 0, 'Deleting a role removes its grants');
select test.check((select count(*) from account_roles where role_id = :'r_hr') = 0, 'Deleting a role removes its assignments');
select test.as_admin(:'hr');
select test.expect_error(format($$select admin_update_entry(%L, 'x')$$, :'hrentry'), 'Former role holder loses access', '42501');

---------------------------------------------------------------- last App Developer
reset role;
update admin_accounts set disabled = true where user_id = :'dev2';
select test.as_admin(:'dev');
select test.expect_error(format($$select admin_set_disabled(%L, true)$$, :'dev'), 'App Developer cannot disable self', '42501');
reset role;
select test.expect_error(format($$delete from admin_accounts where user_id = %L$$, :'dev'),
  'The last active App Developer cannot be deleted (even directly)', '42501');
select test.expect_error(format($$delete from auth.users where id = %L$$, :'dev'),
  'Deleting the auth user of the last App Developer is blocked', '42501');

---------------------------------------------------------------- public visibility
select test.as_anon();
select test.check((select count(*) from content_nodes where kind = 'section') = 13, 'Anonymous app can read the 13 menu sections');
select test.expect_error($$select count(*) from admin_accounts$$, 'Anonymous app cannot read admin accounts', '42501');
select test.expect_error($$select count(*) from installations$$, 'Anonymous app cannot read installations', '42501');
select test.expect_error($$select admin_me()$$, 'Anonymous cannot call admin functions', '42501');

rollback;
\echo 'permissions tests passed'
