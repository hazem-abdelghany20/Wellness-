-- Wellness+ sprint 3: switch on push (routine reminders + broadcast push).
-- Run ONCE in the SQL editor of the live project, AFTER:
--   1. the migration 20261111000001_reminders_broadcasts_teams.sql ran
--      (it created the per-minute job "wellness-minute-tick");
--   2. supabase functions deploy send-reminders --no-verify-jwt
--   3. supabase secrets set CRON_SECRET=… VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… \
--        VAPID_SUBJECT=mailto:…
--
-- Replace the two placeholders below, keeping the quotes:
--   <FUNCTIONS_URL>  https://<project-ref>.supabase.co/functions/v1
--                    (the send-reminders URL itself works too)
--   <CRON_SECRET>    exactly the CRON_SECRET you set on the function
--
-- Both values go into Supabase Vault (encrypted); nothing is stored in the
-- repo or in the job. Safe to run again to change either value. To switch
-- push off again: DELETE FROM vault.secrets WHERE name = 'wellness_cron_secret';
-- (broadcasts keep arriving in-app at their time either way).

DO $$
DECLARE
  v_url    TEXT := btrim('<FUNCTIONS_URL>');
  v_secret TEXT := btrim('<CRON_SECRET>');
  v_id     UUID;
BEGIN
  IF v_url LIKE '<%' OR v_secret LIKE '<%' THEN
    RAISE EXCEPTION 'Fill in <FUNCTIONS_URL> and <CRON_SECRET> first — nothing changed.';
  END IF;
  IF v_url !~ '^https://[^/\s]+/functions/v1(/send-reminders)?/?$' THEN
    RAISE EXCEPTION 'FUNCTIONS_URL should look like https://<project-ref>.supabase.co/functions/v1 — got %', v_url;
  END IF;
  IF length(v_secret) < 24 THEN
    RAISE EXCEPTION 'Use a long random CRON_SECRET (24+ characters, e.g. openssl rand -hex 32).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wellness-minute-tick') THEN
    RAISE EXCEPTION 'Job wellness-minute-tick is missing — run migration 20261111000001 first.';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'wellness_functions_url';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_url, 'wellness_functions_url', 'Wellness+: edge functions base URL (send-reminders)');
  ELSE
    PERFORM vault.update_secret(v_id, v_url);
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'wellness_cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_secret, 'wellness_cron_secret', 'Wellness+: x-cron-secret for send-reminders');
  ELSE
    PERFORM vault.update_secret(v_id, v_secret);
  END IF;
  RAISE NOTICE 'Saved. The next minute tick will call send-reminders.';
END $$;

-- ── Checks (no secret values are shown) ─────────────────────
SELECT name, updated_at FROM vault.secrets WHERE name IN ('wellness_functions_url', 'wellness_cron_secret');
--   → 2 rows
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'wellness-minute-tick';
--   → '* * * * *', active = true

-- Wait a minute or two, then:
SELECT status, return_message, start_time
  FROM cron.job_run_details
 WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'wellness-minute-tick')
 ORDER BY start_time DESC LIMIT 5;
--   → status 'succeeded'
SELECT created, status_code, left(content::text, 200) AS body, error_msg
  FROM net._http_response ORDER BY created DESC LIMIT 5;
--   200 + {"ok":true,…}         working
--   401 {"error":"unauthorized"} the Vault secret ≠ the function's CRON_SECRET
--   503 {"error":"not_configured"} a function secret is missing (see "missing")
--   404                          function not deployed / wrong URL
