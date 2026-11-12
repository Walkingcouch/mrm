-- Supabase security advisor fixes: pin search_path on helper functions.
alter function app.deny(text) set search_path = public, app;
alter function app.check_grant_scope() set search_path = public, app;
alter function app.touch_updated_at() set search_path = public, app;
alter function app.validate_entry_fields(public.node_kind, text, text) set search_path = public, app;
