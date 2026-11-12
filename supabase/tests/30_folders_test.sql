-- Folders inside list sections, and per-item icons.
\set ON_ERROR_STOP on
\set QUIET on
\set dev     '00000000-0000-0000-0000-0000000000d1'
\set hr      '00000000-0000-0000-0000-0000000000c3'
\set kitchen '00000000-0000-0000-0000-0000000000c1'

select id as hrsec   from content_nodes where key = 'hr' \gset
select id as village from content_nodes where key = 'village' \gset
select id as flight  from content_nodes where key = 'flight' \gset

begin;

select test.as_admin(:'dev');
select admin_register_account(:'hr', 'hr@example.test', 'HR admin', 'delegate');
select admin_register_account(:'kitchen', 'kitchen@example.test', 'Kitchen admin', 'delegate');

-- Folder + an item inside it
select admin_create_entry(:'hrsec', 'folder', 'Benefits & Rewards') as folder \gset
select test.check((select kind::text from content_nodes where id = :'folder') = 'folder', 'Folder created in a list section');
select admin_create_entry(:'folder', 'url', 'Glencore Rewards', 'https://example.test/rewards') as inner_item \gset
select test.check((select parent_id from content_nodes where id = :'inner_item') = :'folder'::uuid, 'Item created inside the folder');

select test.expect_error(format($$select admin_create_entry(%L,'folder','Nested')$$, :'folder'),
  'Folders cannot contain folders', '22023');
select test.expect_error(format($$select admin_create_entry(%L,'folder','Bad')$$, :'flight'),
  'Folders only go in list sections', '22023');
select test.expect_error(format($$select admin_update_entry(%L, null, 'url', 'https://example.test')$$, :'folder'),
  'A folder cannot be turned into a link', '22023');
select test.expect_error(format($$select admin_delete_entry(%L)$$, :'folder'),
  'A folder with items cannot be removed', '22023');

-- Icons
select test.expect_ok(format($$select admin_set_entry_icon(%L,'handshake-outline')$$, :'inner_item'), 'Icon set on an item');
select test.check((select icon from content_nodes where id = :'inner_item') = 'handshake-outline', 'Icon stored');
select test.expect_error(format($$select admin_set_entry_icon(%L,'<script>')$$, :'inner_item'), 'Invalid icon name rejected', '23514');

-- Permissions: a grant on the section covers items inside its folders
select admin_create_role('HR test') as role_hr \gset
select admin_set_role_grants(:'role_hr', jsonb_build_array(
  jsonb_build_object('permission_id','content.access','node_id',:'hrsec'),
  jsonb_build_object('permission_id','content.edit','node_id',:'hrsec')));
select admin_set_account_roles(:'hr', array[:'role_hr'::uuid]);
select admin_create_role('Kitchen test') as role_k \gset
select admin_set_role_grants(:'role_k', jsonb_build_array(
  jsonb_build_object('permission_id','content.access','node_id',:'village'),
  jsonb_build_object('permission_id','content.edit','node_id',:'village')));
select admin_set_account_roles(:'kitchen', array[:'role_k'::uuid]);

select test.as_admin(:'hr');
select test.expect_ok(format($$select admin_update_entry(%L,'Glencore Rewards 2026',null,'https://example.test/r2')$$, :'inner_item'),
  'HR (section grant) edits an item inside the folder');
select test.expect_ok(format($$select admin_create_entry(%L,'url','Another benefit','https://example.test/b')$$, :'folder'),
  'HR adds an item inside the folder');
select test.check((admin_me()->'content'->:'inner_item'->>'edit')::boolean, 'admin_me reports edit rights on folder items');

select test.as_admin(:'kitchen');
select test.expect_error(format($$select admin_update_entry(%L,'Hacked')$$, :'inner_item'),
  'Kitchen cannot edit items in an HR folder', '42501');
select test.expect_error(format($$select admin_create_entry(%L,'url','x','https://example.test')$$, :'folder'),
  'Kitchen cannot add to an HR folder', '42501');

-- Moving items into and out of folders
select test.as_admin(:'dev');
select admin_create_entry(:'hrsec', 'url', 'Loose link', 'https://example.test/loose') as loose \gset
select admin_create_entry(:'hrsec', 'url', 'Loose link 2', 'https://example.test/loose2') as loose2 \gset
select test.check(admin_move_entries(array[:'loose', :'loose2']::uuid[], :'folder') = 2, 'Two items moved into a folder in one go');
select test.check((select count(*) from content_nodes where parent_id = :'folder' and id in (:'loose', :'loose2')) = 2, 'Moved items are inside the folder');
select test.check((select position from content_nodes where id = :'loose2') > (select position from content_nodes where id = :'loose'),
  'Moved items keep their order, at the end of the folder');
select test.check(admin_move_entries(array[:'loose']::uuid[], :'hrsec') = 1, 'Item moved back out to the section');
select admin_create_entry(:'hrsec', 'folder', 'Second folder') as folder2 \gset
select test.expect_error(format($$select admin_move_entries(array[%L]::uuid[], %L)$$, :'folder2', :'folder'),
  'A folder cannot be moved inside another folder', '22023');
select test.expect_error(format($$select admin_move_entries(array[%L]::uuid[], %L)$$, :'loose', :'village'),
  'Items cannot be moved to a different section', '22023');
select test.as_admin(:'kitchen');
select test.expect_error(format($$select admin_move_entries(array[%L]::uuid[], %L)$$, :'loose', :'folder'),
  'Kitchen cannot move HR items', '42501');
select test.as_admin(:'hr');
select test.check(admin_move_entries(array[:'loose']::uuid[], :'folder2') = 1, 'HR (section edit rights) moves items between its folders');

-- The public app can read folders and icons
select test.as_anon();
select test.check((select count(*) from content_nodes where kind = 'folder') >= 1, 'App can read folders');
select test.check((select icon from content_nodes where id = :'inner_item') = 'handshake-outline', 'App can read icons');

rollback;
\echo 'folder tests passed'
