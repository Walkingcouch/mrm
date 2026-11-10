-- Fixed structure from the build brief (v1.1). Labels only — no destinations,
-- files, phone numbers or URLs are invented. Empty entries show a clear
-- "not yet available" state in the apps until an administrator fills them.

insert into public.permissions (id, label, scope_kind, position) values
  ('content.access',          'Access / manage section or entry',           'content', 10),
  ('content.upload',          'Upload / replace PDFs',                      'content', 20),
  ('content.edit',            'Edit information and URL / form links',      'content', 30),
  ('content.delete',          'Delete documents / entries',                 'content', 40),
  ('message.publish',         'Publish messages from this source',          'source',  50),
  ('push.department',         'Send push notifications for this source',    'source',  60),
  ('push.global_general',     'Send global general messages / push',        'none',    70),
  ('push.global_emergency',   'Send global emergency messages / push',      'none',    80);

-- Sections, in the agreed initial menu order.
insert into public.content_nodes (key, kind, section_type, label, position, sort_mode) values
  ('home',        'section', 'home',     'Home',              10,  'manual'),
  ('flight',      'section', 'web',      'Flight Tracker',    20,  'manual'),
  ('timetables',  'section', 'list',     'Timetables',        30,  'manual'),
  ('weather',     'section', 'weather',  'Weather',           40,  'manual'),
  ('messages',    'section', 'messages', 'Employee Messages', 50,  'manual'),
  ('village',     'section', 'list',     'MRM Village',       60,  'manual'),
  ('wellbeing',   'section', 'list',     'Wellbeing',         70,  'manual'),
  ('hr',          'section', 'list',     'HR & Payroll',      80,  'manual'),
  ('memorandum',  'section', 'list',     'Memorandum',        90,  'newest_first'),
  ('report',      'section', 'list',     'Report & Fix It',   100, 'manual'),
  ('call',        'section', 'list',     'Call Us',           110, 'manual'),
  ('find',        'section', 'list',     'Find Us',           120, 'manual'),
  ('settings',    'section', 'settings', 'Settings',          130, 'manual');

-- Initial entries (labels from the brief / screenshots; destinations supplied later).
with s as (select id, key from public.content_nodes where kind = 'section')
insert into public.content_nodes (parent_id, kind, label, position)
select s.id, e.kind::public.node_kind, e.label, e.pos
from s join (values
  ('timetables', 'pdf', 'Flight Timetable',          10),
  ('timetables', 'pdf', 'Community Bus Timetable',   20),
  ('timetables', 'pdf', 'Site Bus Timetable',        30),
  ('village',    'pdf', 'Village Map',               10),
  ('village',    'pdf', 'Menu',                      20),
  ('village',    'pdf', 'MRM Gun Club',              30),
  ('hr',         'url', 'Benefits & Rewards',        10),
  ('hr',         'url', 'MRM HR Team Contact List',  20),
  ('hr',         'url', 'Career Opportunities',      30),
  ('hr',         'url', 'MRM Enterprise Agreement',  40),
  ('hr',         'url', 'Leave Request Update',      50),
  ('hr',         'url', 'Overtime Request Update',   60),
  ('hr',         'url', 'Payroll Schedule 2025/26',  70),
  ('hr',         'url', 'Payroll Schedule 2026/27',  80),
  ('hr',         'url', 'Payslip Guide',             90),
  ('hr',         'url', 'Northern Territory Residency Payment – EA Employees', 100)
) as e(section_key, kind, label, pos) on e.section_key = s.key;

-- Departmental push routing. PENDING OWNER DECISION (brief §6):
--   'subscribers' = departmental pushes go only to installations that opted in (proposed default)
--   'everyone'    = every departmental push goes to every installation; app hides subscription controls
insert into public.app_config (key, value) values
  ('departmental_push_mode', '"subscribers"'),
  ('support_text', '""');

-- Storage buckets. Public read: content is viewable without login by design.
-- Writes happen only through server-issued signed upload URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('content',  'content',  true, 26214400, array['application/pdf']),
  ('messages', 'messages', true, 15728640, array['application/pdf','image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;
