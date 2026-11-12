-- Lets the dispatch-push function verify the scheduled sweep's secret against
-- the Vault entry 'push_dispatch_secret', so the secret can be generated inside
-- the database and never has to be copied anywhere. Service role only.
create or replace function public.push_check_dispatch_secret(p_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(length(p_secret) >= 32 and exists (
    select 1 from vault.decrypted_secrets where name = 'push_dispatch_secret' and decrypted_secret = p_secret), false)
$$;
revoke all on function public.push_check_dispatch_secret(text) from public, anon, authenticated;
grant execute on function public.push_check_dispatch_secret(text) to service_role;
