-- Admin message log shows who sent each message (admin website only; the
-- staff app never sees it). Sender comes from messages.created_by.
drop function if exists public.admin_list_messages(int);
create function public.admin_list_messages(p_limit int default 50)
returns table (id uuid, source_label text, scope public.message_scope, body text, created_at timestamptz,
               push_requested boolean, push_status text, can_delete boolean,
               sent_by_name text, sent_by_email text)
language sql stable security definer set search_path = public, app as $$
  select m.id, m.source_label, m.scope, m.body, m.created_at, m.push_requested, m.push_status,
         app.is_top() or (m.source_id is not null and app.can_source('message.publish', m.source_id)),
         a.display_name, coalesce(a.email, u.email)
  from public.messages m
  left join public.admin_accounts a on a.user_id = m.created_by
  left join auth.users u on u.id = m.created_by
  where app.my_tier() is not null
  order by m.created_at desc
  limit least(greatest(p_limit,1),200)
$$;
revoke all on function public.admin_list_messages(int) from public, anon;
grant execute on function public.admin_list_messages(int) to authenticated;
