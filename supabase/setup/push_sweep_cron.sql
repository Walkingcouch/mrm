-- Run once per environment (staging, production) in the Supabase SQL editor
-- after deploying the dispatch-push function. Retries pending pushes every
-- minute, always within each message's original 24-hour window.
-- Requires the pg_cron and pg_net extensions (Database > Extensions).
-- Store the dispatch secret in Vault first:
--   select vault.create_secret('<same value as PUSH_DISPATCH_SECRET>', 'push_dispatch_secret');
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/dispatch-push', 'push_dispatch_url');

select cron.schedule(
  'push-sweep',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret')),
    body    := '{"sweep": true}'::jsonb
  )
  where exists (select 1 from public.messages
                where push_status in ('pending','dispatching') and push_deadline > now());
  $$
);
