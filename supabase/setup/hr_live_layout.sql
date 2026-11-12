-- HR & Payroll laid out exactly like the live app (screenshots, 12 Nov 2026):
-- same order, two folders, live labels and icons. Run once after
-- live_content.sql (needs migrations ...0800 and ...0900).
-- The 2019 Enterprise Agreement exists in the live app but was not in the URL
-- List; it is created without a file and shows "Not yet available" until a PDF
-- is uploaded. (Payroll Schedule - 2025/26 was dropped at the owner's request.)
do $$
declare
  hr  uuid := (select id from public.content_nodes where key = 'hr');
  ben uuid;
  ea  uuid;
begin
  insert into public.content_nodes (parent_id, kind, label, position, icon)
  values (hr, 'folder', 'Benefits & Rewards', 10, 'handshake-outline') returning id into ben;
  insert into public.content_nodes (parent_id, kind, label, position, icon)
  values (hr, 'folder', 'MRM Enterprise Agreement', 40, 'handshake-outline') returning id into ea;

  -- Benefits & Rewards folder
  update public.content_nodes c set parent_id = ben, label = m.new_label, position = m.pos, icon = 'handshake-outline'
  from (values
    ('MRM Employee travel with AirNorth',       'MRM Employee travel with Airnorth',                10),
    ('Bupa Corp',                                'Bupa Corporate Health Insurance Phone Consults',   20),
    ('Corporate Travel Offer',                   'Corporate Travel Offer - Air Canada',              30),
    ('Medibank Private 2',                       'Medibank Private 2',                               40),
    ('Salary Packaging – RemServ',               'Salary Packaging - RemServ',                       50),
    ('Glencore Rewards',                         'Glencore Rewards',                                 60),
    ('Advance Learning Platform',                'Advance learning Platform',                        70),
    ('Employee Rewards & Benefits',              'Employee Rewards and Benefits',                    80)
  ) as m(old_label, new_label, pos)
  where c.parent_id = hr and c.label = m.old_label;

  -- MRM Enterprise Agreement folder
  insert into public.content_nodes (parent_id, kind, label, position, icon)
  values (ea, 'pdf', 'McArthur River Mining Pty Ltd Enterprise Agreement 2019', 10, 'handshake-outline');
  update public.content_nodes c set parent_id = ea, label = m.new_label, position = m.pos, icon = 'handshake-outline'
  from (values
    ('MRM Enterprise Agreement 2025',            'McArthur River Mining Pty Ltd Enterprise Agreement 2025', 20),
    ('MRM EA 2025 Classifications & Pay Rates',  'MRM EA 2025 Classifications and Pay Rates',              30),
    ('MRM EA 2026 Classifications & Pay Rates',  'MRM EA 2026 Classifications and Pay Rates',              40)
  ) as m(old_label, new_label, pos)
  where c.parent_id = hr and c.label = m.old_label;

  -- Top level of HR & Payroll
  update public.content_nodes c set label = m.new_label, position = m.pos, icon = m.icon
  from (values
    ('MRM & HR Team Contacts',                'MRM HR Team Contact List',                              20, 'account-group-outline'),
    ('Career Opportunities',                  'Career Opportunities',                                  30, 'briefcase-outline'),
    ('Leave Request Update',                  'Leave Request Update',                                  50, 'clipboard-text-outline'),
    ('Overtime Request Update',               'Overtime Request Update',                               60, 'clipboard-text-outline'),
    ('Payroll Schedule 2026–27',              'Payroll Schedule - 2026/27',                            80, 'calendar-clock-outline'),
    ('Payslip Guide',                         'Payslip Guide',                                         90, 'calendar-clock-outline'),
    ('NT Residency Payment – EA Employees',   'Northern Territory Residency Payment - EA Employees', 100, 'clipboard-text-outline')
  ) as m(old_label, new_label, pos, icon)
  where c.parent_id = hr and c.label = m.old_label;

end $$;

select c.position, c.kind, c.label, c.icon, f.label as in_folder
from public.content_nodes c
left join public.content_nodes f on f.id = c.parent_id and f.kind = 'folder'
where c.parent_id = (select id from public.content_nodes where key = 'hr')
   or c.parent_id in (select id from public.content_nodes where kind = 'folder')
order by coalesce(f.position, c.position), f.position is not null, c.position;
