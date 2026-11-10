-- STAGING ONLY. Never run against production.
-- Visibly-labelled demo content so testers can exercise every entry type.
-- All demo rows have is_demo = true and the apps prefix them with [DEMO].
-- Remove with:  delete from public.content_nodes where is_demo;
do $$
begin
  if current_database() ilike '%prod%' then raise exception 'Refusing to seed demo data into a production-looking database'; end if;
end $$;

insert into public.content_nodes (parent_id, kind, label, position, url, body, phone, is_demo)
select (select id from public.content_nodes where key = k), kind::public.node_kind, label, 900, url, body, phone, true
from (values
  ('wellbeing', 'info',  'Demo information text', null, 'Demo text. Replace with real content supplied by the owner.', null),
  ('report',    'url',   'Demo external form',    'https://example.com/', null, null),
  ('call',      'phone', 'Demo phone link',       null, null, '+61 0 0000 0000'),
  ('find',      'map',   'Demo map link',         'https://maps.google.com/?q=-16.44,136.08', null, null)
) v(k, kind, label, url, body, phone);
