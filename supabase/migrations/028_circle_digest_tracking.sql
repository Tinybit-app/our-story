-- supabase/migrations/028_circle_digest_tracking.sql
-- Tracking columns to make digest cron idempotent (avoid duplicate sends on retry)

ALTER TABLE Circle
  ADD COLUMN last_weekly_digest_sent_at TIMESTAMPTZ,
  ADD COLUMN last_monthly_digest_sent_at TIMESTAMPTZ;

-- pg_cron schedules (manual setup in Supabase Studio after deploy):
--
-- SELECT cron.schedule(
--   'send-weekly-digest',
--   '0 9 * * 1',
--   $$SELECT net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/send-digest?frequency=weekly',
--     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
--   )$$
-- );
--
-- SELECT cron.schedule(
--   'send-monthly-digest',
--   '0 9 1 * *',
--   $$SELECT net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/send-digest?frequency=monthly',
--     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
--   )$$
-- );
