-- Content of the live app (MRM URL List supplied by the owner, 12 Nov 2026;
-- phone numbers from screenshots of the live app). Run once on a fresh project
-- after the migrations and BEFORE role_templates.sql (which grants access to the
-- Menu and Gun Club entries created here). Replaces the placeholder entries.
--
-- PDFs start out pointing at the live app's files (full https URLs in
-- file_path); the one-off import-files edge function then copies each one into
-- this project's storage and rewrites file_path, so nothing depends on the old
-- provider afterwards.
--
-- Sub-folders in the live app (Benefits & Rewards, MRM Enterprise Agreement)
-- are flat items in HR & Payroll: the new app has one level per section.

delete from public.content_nodes where kind <> 'section';

update public.content_nodes set url = 'https://flightaware.com/live/airport/YMHU' where key = 'flight';
update public.content_nodes set url = 'https://www.willyweather.com.au/nt/katherine/mcarthur-river-mine-airport.html' where key = 'weather';
-- Report & Fix It opens its form straight from the menu (no list in between).
update public.content_nodes set section_type = 'web', url = 'https://www.surveymonkey.com/r/mrm_report_fixit' where key = 'report';

with s as (select id, key from public.content_nodes where kind = 'section'),
f(base) as (select 'https://storage.googleapis.com/gs.appbuild.io/apps/mcarthur/attachments/')
insert into public.content_nodes (parent_id, kind, label, position, url, phone, file_path, file_name, file_updated_at, created_at)
select s.id, e.kind::public.node_kind, e.label, e.pos,
       case when e.kind = 'url' then e.val end,
       case when e.kind = 'phone' then e.val end,
       case when e.kind = 'pdf' then f.base || e.val end,
       case when e.kind = 'pdf' then e.val end,
       case when e.kind = 'pdf' then now() end,
       coalesce(e.created::timestamptz, now())
from s cross join f join (values
  ('timetables', 'pdf', 'Flight Timetable',                         10, 'App_Content_2024-07-25_Flight_Schedule.pdf', null),
  ('timetables', 'pdf', 'Community Bus Timetable',                  20, 'Community_Bus_Timetable.pdf', null),
  ('timetables', 'pdf', 'Site Bus Timetable',                       30, 'Bus_Timetable_of_Dec_2024.pdf', null),
  ('village',    'pdf', 'Village Map',                              10, '2025_Village_Map_-_WET_MESS_HOURS_UPDATED.pdf', null),
  ('village',    'pdf', 'Menu',                                     20, '12.11.26.pdf', null),
  ('village',    'pdf', 'MRM Gun Club',                             30, 'MAP-GM-0010-2300001.pdf', null),
  ('wellbeing',  'url', 'Book Psychologist',                        10, 'https://www.surveymonkey.com/r/MRM_Appt', null),
  ('wellbeing',  'url', 'Employee Assistance Program',              20, 'https://assureprograms.com.au/', null),
  ('wellbeing',  'url', 'R U OK?',                                  30, 'https://www.ruok.org.au/how-to-ask', null),
  ('wellbeing',  'pdf', 'Declaration of Prescription Medication',   40, 'Declaration_of_Prescription_Medication.pdf', null),
  ('wellbeing',  'pdf', 'Well for Work Declaration',                50, 'Well_For_Work_Declaration.pdf', null),
  ('hr',         'pdf', 'MRM Employee travel with AirNorth',        10, 'Airnorth_MRM_Employee_Travel_-_App_24-07-23.pdf', null),
  ('hr',         'pdf', 'Bupa Corp',                                20, 'Bupa_Glencore_June_July.pdf', null),
  ('hr',         'pdf', 'Corporate Travel Offer',                   30, 'Corporate-Leisure_QR-Code_EN.pdf', null),
  ('hr',         'pdf', 'Medibank Private 2',                       40, 'Medibank_Private___Glencore_Group.pdf', null),
  ('hr',         'pdf', 'Salary Packaging – RemServ',               50, 'Remote_Area_Flights.pdf', null),
  ('hr',         'pdf', 'Glencore Rewards',                         60, 'Glencore__Reward_Gateway_Welcome_Poster_2_29092021.pdf', null),
  ('hr',         'pdf', 'Advance Learning Platform',                70, 'Advance_Learning_Platform.pdf', null),
  ('hr',         'pdf', 'Employee Rewards & Benefits',              80, 'MRM_Employee_Benefits_-_Rewards.pdf', null),
  ('hr',         'pdf', 'MRM & HR Team Contacts',                   90, 'MRM_HR_Team_Contact_List.pdf', null),
  ('hr',         'pdf', 'Career Opportunities',                    100, 'MRM_Career_opportunities_-_IOS_ratio.pdf', null),
  ('hr',         'pdf', 'MRM Enterprise Agreement 2025',           110, 'McArthur_River_Mining_Pty_Ltd_Enterprise_Agreement_2025.pdf', null),
  ('hr',         'pdf', 'MRM EA 2025 Classifications & Pay Rates', 120, 'MRM_EA_2025_Classifications_and_pay_rates.pdf', null),
  ('hr',         'pdf', 'MRM EA 2026 Classifications & Pay Rates', 130, 'MRM_EA_2026_Classifications_and_Pay_Rates.pdf', null),
  ('hr',         'url', 'Leave Request Update',                    140, 'https://mcarthurrivermine.wufoo.com/forms/mjeybgg139u8ra/', null),
  ('hr',         'url', 'Overtime Request Update',                 150, 'https://www.surveymonkey.com/r/MRM_Overtime_Request', null),
  ('hr',         'pdf', 'Payroll Schedule 2026–27',                160, 'Payroll_Schedule_26-27.pdf', null),
  ('hr',         'pdf', 'Payslip Guide',                           170, 'Payslip_Guide_2025b.pdf', null),
  ('hr',         'url', 'NT Residency Payment – EA Employees',     180, null, null),
  ('memorandum', 'pdf', '25th May 2026',                            10, '20260525_Memorandum.pdf', '2026-05-25T00:00:00+09:30'),
  ('memorandum', 'pdf', '27 March 2026',                            20, '20260327_Memorandum.pdf', '2026-03-27T00:00:00+09:30'),
  ('call',       'phone', 'Call Emergency',                         10, '+61 8 8975 8222', null),
  ('call',       'phone', 'Call Safety',                            20, '+61 427 964 158', null),
  ('call',       'phone', 'Call First Aid Centre',                  30, '+61 8 8975 8121', null),
  ('call',       'phone', 'Call Airport',                           40, '+61 8 8975 8164', null),
  ('call',       'phone', 'Call Human Resources',                   50, '+61 8 8975 8234', null),
  ('find',       'url', 'MRM Website',                              10, 'https://www.mcarthurrivermine.com.au', null),
  ('find',       'url', 'Glencore Australia',                       20, 'https://www.glencore.com.au/ask-glencore-australia', null),
  ('find',       'url', 'Glencore Global',                          30, 'https://www.glencore.com', null),
  ('find',       'url', 'MRM Facebook',                             40, 'https://www.facebook.com/GlencoreMcArthurRiverMine', null)
) as e(section_key, kind, label, pos, val, created) on e.section_key = s.key;

-- The two Employee Messages listed for the live app. Already sent in March, so
-- they are stored without a push (push_status 'not_requested').
insert into public.message_sources (label, position, subscribable)
select 'MRM Communications', 60, false
where not exists (select 1 from public.message_sources where label = 'MRM Communications');

with src as (select id, label from public.message_sources where label = 'MRM Communications'),
ins as (
  insert into public.messages (request_id, source_id, source_label, scope, body, push_requested, push_deadline, push_status, created_at)
  select gen_random_uuid(), src.id, src.label, 'global_general', m.body, false, m.at + interval '24 hours', 'not_requested', m.at
  from src cross join (values
    ('Ex-TC Narelle update and staged return to normal operations (22 March 2026, 3:30 pm). Open the attached document for details.',
     '2026-03-22T15:30:00+09:30'::timestamptz),
    ('Ex-TC Narelle update and return to normal operations (23 March 2026, 3:30 pm). Open the attached document for details.',
     '2026-03-23T15:30:00+09:30'::timestamptz)
  ) as m(body, at)
  returning id, created_at
)
insert into public.message_attachments (message_id, file_path, file_name, mime_type, file_size, position)
select ins.id,
       'https://storage.googleapis.com/gs.appbuild.io/apps/mcarthur/attachments/' || a.file,
       a.name, 'application/pdf', 0, 0
from ins join (values
  ('2026-03-22T15:30:00+09:30'::timestamptz, '22_March_2026_330pm_Ex-TC_Nareelle_Update_and__Staged_Return_to_Normal_Operations.pdf', 'Ex-TC Narelle update, 22 March 2026.pdf'),
  ('2026-03-23T15:30:00+09:30'::timestamptz, '23_March_2026_330_PM_Ex-TC_Narelle_Update_and_Return_to_Normal_Operations.pdf', 'Ex-TC Narelle update, 23 March 2026.pdf')
) as a(at, file, name) on a.at = ins.created_at;
