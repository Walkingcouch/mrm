-- OPTIONAL starter roles & message sources from the brief (§5). Run once in
-- the SQL editor if the owner wants them; everything can be renamed, changed
-- or deleted afterwards on the admin website. Conservative by design:
--   * no role gets emergency sending
--   * Communications does NOT get site-wide sending unless ticked later
--   * Kitchen and Gun Club only get their own single PDF entry
do $$
declare
  s_kitchen uuid; s_gun uuid; s_clean uuid; s_ops uuid; s_hr uuid; s_comms uuid;
  r uuid;
  menu uuid := (select id from public.content_nodes where label = 'Menu' and parent_id = (select id from public.content_nodes where key='village'));
  gun  uuid := (select id from public.content_nodes where label = 'MRM Gun Club' and parent_id = (select id from public.content_nodes where key='village'));
  tt   uuid := (select id from public.content_nodes where key = 'timetables');
  hr   uuid := (select id from public.content_nodes where key = 'hr');
  memo uuid := (select id from public.content_nodes where key = 'memorandum');
begin
  insert into public.message_sources (label, position) values ('Kitchen', 10) returning id into s_kitchen;
  insert into public.message_sources (label, position) values ('Gun Club', 20) returning id into s_gun;
  insert into public.message_sources (label, position) values ('Cleaning', 30) returning id into s_clean;
  insert into public.message_sources (label, position) values ('Operations', 40) returning id into s_ops;
  insert into public.message_sources (label, position) values ('HR', 50) returning id into s_hr;
  select id into s_comms from public.message_sources where label = 'MRM Communications';  -- live_content.sql may have created it
  if s_comms is null then
    insert into public.message_sources (label, position, subscribable) values ('MRM Communications', 60, false) returning id into s_comms;
  end if;

  insert into public.roles (name) values ('Kitchen/Mess') returning id into r;
  insert into public.role_grants (role_id, permission_id, node_id, source_id) values
    (r,'content.access',menu,null),(r,'content.upload',menu,null),
    (r,'message.publish',null,s_kitchen),(r,'push.department',null,s_kitchen);

  insert into public.roles (name) values ('Gun Club') returning id into r;
  insert into public.role_grants (role_id, permission_id, node_id, source_id) values
    (r,'content.access',gun,null),(r,'content.upload',gun,null),
    (r,'message.publish',null,s_gun),(r,'push.department',null,s_gun);

  insert into public.roles (name) values ('Cleaning') returning id into r;
  insert into public.role_grants (role_id, permission_id, node_id, source_id) values
    (r,'message.publish',null,s_clean),(r,'push.department',null,s_clean);

  insert into public.roles (name) values ('Operations') returning id into r;
  insert into public.role_grants (role_id, permission_id, node_id, source_id) values
    (r,'content.access',tt,null),(r,'content.upload',tt,null),
    (r,'message.publish',null,s_ops),(r,'push.department',null,s_ops);

  insert into public.roles (name) values ('HR') returning id into r;
  insert into public.role_grants (role_id, permission_id, node_id, source_id) values
    (r,'content.access',hr,null),(r,'content.upload',hr,null),(r,'content.edit',hr,null),(r,'content.delete',hr,null),
    (r,'message.publish',null,s_hr),(r,'push.department',null,s_hr);

  insert into public.roles (name) values ('Communications') returning id into r;
  insert into public.role_grants (role_id, permission_id, node_id, source_id) values
    (r,'content.access',memo,null),(r,'content.upload',memo,null),(r,'content.delete',memo,null),
    (r,'message.publish',null,s_comms);
end $$;
