-- Wellness+ sprint 3 — paste ONCE into the Supabase SQL editor (project ewfqkhfoodijhxaqiome), then Run.
-- NEW empty query tab, nothing highlighted; confirm the "destructive operations" warning (it replaces functions).
-- Contains 20261111000001_reminders_broadcasts_teams.sql: reminders (push subscriptions, per-minute job),
-- broadcasts at the set time + audio, teams management, privacy folding, weekly-habit auto-pause, fixes.
-- Enables pg_cron + pg_net. The per-minute job does nothing for push until the reminders function is
-- deployed and reminders_setup_after_deploy.sql is run; scheduled broadcasts start arriving in-app at once.
-- One transaction: if anything fails, nothing changes. Safe to run again.

BEGIN;

DO $$
DECLARE missing TEXT[] := '{}';
BEGIN
  IF to_regclass('public.routines') IS NULL THEN missing := array_append(missing, 'sprint 2 (routines)'::text); END IF;
  IF to_regprocedure('public.my_today()') IS NULL THEN missing := array_append(missing, 'sprint 2 (my_today)'::text); END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'company-media') THEN missing := array_append(missing, 'sprint 2 (company-media bucket)'::text); END IF;
  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'Stopped, nothing changed. Missing on this database: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- Sprint 3 foundation: routine reminders (Web Push), broadcasts at the set
-- time (+ audio), teams admin, secondary suppression, fixes.
--
-- Needs sprint 2 (20261110000001_routines_and_libraries.sql). One idempotent
-- file (CREATE OR REPLACE / IF NOT EXISTS / DROP … IF EXISTS everywhere):
-- paste it into the SQL editor of the live project as-is. It holds no
-- secret. The push half only starts once the owner runs
-- supabase/snippets/reminders_setup_after_deploy.sql (Vault secrets); until
-- then the per-minute job still delivers broadcasts in-app and does nothing
-- else.
--
--  1. Company settings gain quiet_hours (default on: deliveries 08:00–20:00
--     company time) in my_company_settings() / hr_set_company_settings().
--  2. push_subscriptions (Web Push endpoint + keys per browser, own rows
--     only) with save_push_subscription() / delete_push_subscription().
--  3. reminder_log: one routine reminder per person per item per day.
--     due_routine_reminders(at) picks (and claims) the reminders due at a
--     company-local minute; due_broadcast_pushes(at) the broadcasts just
--     delivered; record_push_results() feeds back delivery (removes dead
--     subscriptions). Service role only — called by the send-reminders
--     edge function.
--  4. Broadcasts: optional audio (company-media, audio/*), HR RPCs
--     hr_save_broadcast / hr_cancel_broadcast / hr_list_broadcasts, an
--     employee RPC broadcast_media, and send_due_broadcasts() which turns
--     due scheduled broadcasts into in-app notifications at the set time
--     (respecting quiet hours) and marks them sent. Scheduling no longer
--     sends at once.
--  5. pg_cron + pg_net: job "wellness-minute-tick" runs every minute:
--     send_due_broadcasts() in SQL, then POSTs to the send-reminders
--     function with the secret from Vault. No Vault secrets = no request.
--  6. Teams: hr_list_teams, hr_create_team, hr_rename_team, hr_delete_team,
--     hr_move_to_team, hr_set_team_lead (employee ⇄ manager only).
--  7. Privacy: secondary suppression. Wherever teams are broken out under the
--     5-person floor (hr_routine_report by_team, recognition_board teams,
--     hr_team_overview, hr_team_drilldown) the hidden remainder (company
--     total minus the teams shown) is either 0 or at least the floor:
--     cohort_shown_keys() folds the smallest shown teams into it.
--  8. Fixes: (a) the default weekly habit pauses for anyone with a routine
--     running (company or team); (b) my_routine_week items carry their
--     exercise; (c) hr_save_challenge_template clears title_ar on '' / null;
--     (d) hr_set_exercises_media() sets media on many exercises at once.

-- ═══════════════════════════════════════════════════════════════
-- 0. Extensions
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ═══════════════════════════════════════════════════════════════
-- 1. Company settings: quiet hours
-- ═══════════════════════════════════════════════════════════════

-- Quiet hours on (the default) = HR broadcasts arrive 08:00–20:00 company
-- time; one due at night waits for 08:00.
CREATE OR REPLACE FUNCTION public.quiet_hours_on(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT settings ->> 'quiet_hours' FROM public.companies WHERE id = p_company_id), 'true') <> 'false';
$$;

CREATE OR REPLACE FUNCTION public.company_settings_json(p_company_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'company_id',           c.id,
    'timezone',             public.company_tz(c.id),
    'today',                public.company_today(c.id),
    'now',                  to_char(public.company_now(c.id), 'YYYY-MM-DD"T"HH24:MI:SS'),
    'weekday',              EXTRACT(DOW FROM public.company_today(c.id))::int,
    'workweek',             '[0,1,2,3,4]'::jsonb,
    'recognition',          CASE WHEN c.settings ->> 'recognition' IN ('teams', 'named')
                                 THEN c.settings ->> 'recognition' ELSE 'off' END,
    'weekly_habit_enabled', COALESCE(c.settings ->> 'weekly_habit_enabled', 'true') <> 'false',
    'hr_people_view',       COALESCE(c.settings ->> 'hr_people_view', 'false') = 'true',
    'quiet_hours',          COALESCE(c.settings ->> 'quiet_hours', 'true') <> 'false',
    'quiet_window',         '{"from": "20:00", "to": "08:00"}'::jsonb,
    'min_cohort',           public.hr_min_cohort(c.id))
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

-- HR: change recognition / weekly_habit_enabled / hr_people_view /
-- quiet_hours / timezone / min_cohort. Unknown keys and bad values are
-- refused.
CREATE OR REPLACE FUNCTION public.hr_set_company_settings(p_patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_key     TEXT;
  v_val     JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023';
  END IF;

  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_patch) LOOP
    IF v_key = 'recognition' THEN
      IF jsonb_typeof(v_val) <> 'string' OR (v_val #>> '{}') NOT IN ('off', 'teams', 'named') THEN
        RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSIF v_key IN ('weekly_habit_enabled', 'hr_people_view', 'quiet_hours') THEN
      IF jsonb_typeof(v_val) <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSIF v_key = 'timezone' THEN
      IF jsonb_typeof(v_val) <> 'string'
         OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = v_val #>> '{}') THEN
        RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSIF v_key = 'min_cohort' THEN
      IF jsonb_typeof(v_val) <> 'number' OR (v_val #>> '{}') !~ '^\d+$'
         OR (v_val #>> '{}')::int NOT BETWEEN 5 AND 1000 THEN
        RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSE
      RAISE EXCEPTION 'unknown_setting' USING ERRCODE = '22023', DETAIL = v_key;
    END IF;
  END LOOP;

  UPDATE public.companies SET settings = COALESCE(settings, '{}'::jsonb) || p_patch
   WHERE id = v_company;

  -- Default weekly habit switched off: remove the app's own bookings that
  -- nobody has logged a day on yet (this week's and any upcoming one).
  IF p_patch -> 'weekly_habit_enabled' = 'false'::jsonb THEN
    DELETE FROM public.challenges d
     WHERE d.company_id = v_company AND d.kind = 'habit'
       AND d.payload ->> 'auto' = 'true'
       AND d.end_date >= public.company_today(v_company)
       AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.challenge_id = d.id);
  END IF;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'company.settings_updated',
          'company_settings', v_company, 'info', p_patch);

  RETURN public.company_settings_json(v_company);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Push subscriptions (Web Push)
-- ═══════════════════════════════════════════════════════════════

-- One row per browser / installed web app. endpoint is the push service URL
-- the browser gave us; p256dh + auth are its encryption keys (base64url).
-- lang = the app language when the person subscribed (payload language).
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE CHECK (endpoint ~ '^https?://' AND length(endpoint) <= 1000),
  p256dh       TEXT NOT NULL CHECK (p256dh ~ '^[A-Za-z0-9_-]{40,200}$'),
  auth         TEXT NOT NULL CHECK (auth ~ '^[A-Za-z0-9_-]{8,100}$'),
  lang         TEXT CHECK (lang IN ('en', 'ar')),
  user_agent   TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 500),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ok_at   TIMESTAMPTZ,
  failures     INT NOT NULL DEFAULT 0,
  last_error   TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_own_read ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_read ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Writes go through the two RPCs below (and the service role).
REVOKE ALL ON public.push_subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.push_subscriptions FROM authenticated;

-- Save (or refresh) this browser's subscription for the caller. p_sub is
-- PushSubscription.toJSON() — {endpoint, expirationTime, keys: {p256dh,
-- auth}} — plus optional lang ('en' | 'ar') and user_agent. An endpoint
-- saved before (same browser, maybe another account) moves to the caller.
-- Keeps the 10 most recent devices per person.
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_sub JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_company  UUID := public.auth_company_id();
  v_endpoint TEXT;
  v_p256dh   TEXT;
  v_auth     TEXT;
  v_lang     TEXT;
  v_ua       TEXT;
  v_exp      TIMESTAMPTZ;
  v_row      public.push_subscriptions%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.profiles
                     WHERE id = v_uid AND company_id = v_company AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_sub IS NULL OR jsonb_typeof(p_sub) <> 'object' THEN
    RAISE EXCEPTION 'invalid_subscription' USING ERRCODE = '22023';
  END IF;
  v_endpoint := btrim(p_sub ->> 'endpoint');
  -- Accept standard or URL-safe base64, with or without padding.
  v_p256dh := rtrim(translate(btrim(COALESCE(p_sub #>> '{keys,p256dh}', p_sub ->> 'p256dh')), '+/', '-_'), '=');
  v_auth   := rtrim(translate(btrim(COALESCE(p_sub #>> '{keys,auth}', p_sub ->> 'auth')), '+/', '-_'), '=');
  IF v_endpoint IS NULL OR v_endpoint !~ '^https://[^/\s]+/' OR length(v_endpoint) > 1000
     OR v_p256dh IS NULL OR v_p256dh !~ '^[A-Za-z0-9_-]{40,200}$'
     OR v_auth IS NULL OR v_auth !~ '^[A-Za-z0-9_-]{8,100}$' THEN
    RAISE EXCEPTION 'invalid_subscription' USING ERRCODE = '22023';
  END IF;
  v_lang := CASE WHEN p_sub ->> 'lang' IN ('en', 'ar') THEN p_sub ->> 'lang' END;
  v_ua   := left(nullif(btrim(p_sub ->> 'user_agent'), ''), 500);
  v_exp  := CASE WHEN (p_sub ->> 'expirationTime') ~ '^\d{10,16}$'
                 THEN to_timestamp((p_sub ->> 'expirationTime')::numeric / 1000) END;

  INSERT INTO public.push_subscriptions (user_id, company_id, endpoint, p256dh, auth, lang, user_agent, expires_at)
  VALUES (v_uid, v_company, v_endpoint, v_p256dh, v_auth, v_lang, v_ua, v_exp)
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id      = EXCLUDED.user_id,
    company_id   = EXCLUDED.company_id,
    p256dh       = EXCLUDED.p256dh,
    auth         = EXCLUDED.auth,
    lang         = COALESCE(EXCLUDED.lang, push_subscriptions.lang),
    user_agent   = COALESCE(EXCLUDED.user_agent, push_subscriptions.user_agent),
    expires_at   = EXCLUDED.expires_at,
    last_seen_at = now(),
    failures     = 0,
    last_error   = NULL
  RETURNING * INTO v_row;

  DELETE FROM public.push_subscriptions s
   WHERE s.user_id = v_uid
     AND s.id NOT IN (SELECT x.id FROM public.push_subscriptions x WHERE x.user_id = v_uid
                       ORDER BY x.last_seen_at DESC, x.created_at DESC LIMIT 10);

  RETURN jsonb_build_object('id', v_row.id, 'endpoint', v_row.endpoint, 'lang', v_row.lang,
                            'created_at', v_row.created_at, 'last_seen_at', v_row.last_seen_at);
END;
$$;

-- Forget this browser (the caller's own row only). True when a row went.
CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.push_subscriptions WHERE endpoint = btrim(p_endpoint) AND user_id = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Routine reminders: log + selection
-- ═══════════════════════════════════════════════════════════════

-- One reminder per person per item per company-local day. Rows are claimed
-- when picked (so overlapping runs never send twice); delivered / failed
-- count the devices reached. Pruned after 35 days by the minute job.
CREATE TABLE IF NOT EXISTS public.reminder_log (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES public.routine_items(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered  INT NOT NULL DEFAULT 0,
  failed     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id, day)
);
CREATE INDEX IF NOT EXISTS idx_reminder_log_day ON public.reminder_log (day);
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reminder_log FROM anon, authenticated;

-- Reminders due at p_at: for each company with a routine, the timed items
-- due today (company-local: routine running, its workday, item for every
-- workday or this weekday) whose time falls in the minute of p_at (or the
-- p_window_minutes before it, to ride out a late cron tick), for people
-- who: are onboarded, have routine_reminders on, didn't mute the item,
-- haven't ticked it today, weren't reminded of it today, and have at least
-- one push subscription. One row per person × item with their devices.
-- p_claim (default) writes reminder_log so the row is never picked again.
CREATE OR REPLACE FUNCTION public.due_routine_reminders(
  p_at TIMESTAMPTZ DEFAULT NULL, p_window_minutes INT DEFAULT 1, p_claim BOOLEAN DEFAULT true)
RETURNS TABLE (user_id UUID, company_id UUID, item_id UUID, day DATE, at_time TEXT,
               title_en TEXT, title_ar TEXT, sets_reps TEXT, sets_reps_ar TEXT, subscriptions JSONB)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_at  TIMESTAMPTZ := COALESCE(p_at, public.clock_now());
  v_win INT := LEAST(GREATEST(COALESCE(p_window_minutes, 1), 1), 15);
BEGIN
  RETURN QUERY
  WITH co AS (
    SELECT c.id AS cid, date_trunc('minute', v_at AT TIME ZONE public.company_tz(c.id)) AS lmin
      FROM public.companies c
     WHERE EXISTS (SELECT 1 FROM public.routine_assignments a WHERE a.company_id = c.id AND a.active)
  ), ppl AS (
    SELECT p.id AS uid, p.company_id AS cid, p.team_id AS tid, pp.muted_item_ids AS muted
      FROM public.profiles p
      JOIN public.profile_prefs pp ON pp.user_id = p.id AND pp.routine_reminders
     WHERE p.deleted_at IS NULL AND p.onboarded
       AND p.company_id IN (SELECT co.cid FROM co)
       AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.id)
  ), grp AS (
    SELECT DISTINCT ppl.cid, ppl.tid FROM ppl
  ), due AS (
    SELECT g.cid, g.tid, co.lmin::date AS d, i.id AS iid
      FROM grp g
      JOIN co ON co.cid = g.cid
     CROSS JOIN LATERAL public.routine_due_items(g.cid, g.tid, co.lmin::date) di
      JOIN public.routine_items i ON i.id = di.item_id
     WHERE i.at_time IS NOT NULL
       AND (co.lmin::date + i.at_time) <= co.lmin
       AND (co.lmin::date + i.at_time) > co.lmin - make_interval(mins => v_win)
  ), cand AS (
    SELECT DISTINCT ppl.uid, ppl.cid, due.iid, due.d
      FROM due
      JOIN ppl ON ppl.cid = due.cid AND ppl.tid IS NOT DISTINCT FROM due.tid
     WHERE NOT (due.iid = ANY (ppl.muted))
       AND NOT EXISTS (SELECT 1 FROM public.routine_checks rc
                        WHERE rc.user_id = ppl.uid AND rc.item_id = due.iid AND rc.check_date = due.d)
       AND NOT EXISTS (SELECT 1 FROM public.reminder_log l
                        WHERE l.user_id = ppl.uid AND l.item_id = due.iid AND l.day = due.d)
  ), claimed AS (
    INSERT INTO public.reminder_log AS l (user_id, item_id, day, company_id, sent_at)
    SELECT cand.uid, cand.iid, cand.d, cand.cid, v_at FROM cand WHERE COALESCE(p_claim, true)
    ON CONFLICT DO NOTHING
    RETURNING l.user_id AS uid, l.company_id AS cid, l.item_id AS iid, l.day AS d
  ), picked AS (
    SELECT claimed.uid, claimed.cid, claimed.iid, claimed.d FROM claimed
    UNION ALL
    SELECT cand.uid, cand.cid, cand.iid, cand.d FROM cand WHERE NOT COALESCE(p_claim, true)
  )
  SELECT pk.uid, pk.cid, pk.iid, pk.d, to_char(i.at_time, 'HH24:MI'),
         COALESCE(nullif(btrim(i.title_en), ''), e.name_en),
         COALESCE(nullif(btrim(i.title_ar), ''), e.name_ar),
         COALESCE(i.sets_reps, e.default_sets_reps),
         COALESCE(i.sets_reps_ar, e.default_sets_reps_ar),
         (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh,
                                              'auth', s.auth, 'lang', s.lang)
                           ORDER BY s.last_seen_at DESC)
            FROM public.push_subscriptions s WHERE s.user_id = pk.uid)
    FROM picked pk
    JOIN public.routine_items i ON i.id = pk.iid
    LEFT JOIN public.exercises e ON e.id = i.exercise_id
   ORDER BY pk.cid, i.at_time, pk.uid;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. Broadcasts: audio, delivery at the set time, quiet hours
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS media_type       TEXT,
  ADD COLUMN IF NOT EXISTS media_bucket     TEXT,
  ADD COLUMN IF NOT EXISTS media_path       TEXT,
  ADD COLUMN IF NOT EXISTS media_mime       TEXT,
  ADD COLUMN IF NOT EXISTS media_duration_s INT,
  ADD COLUMN IF NOT EXISTS recipients       INT,
  ADD COLUMN IF NOT EXISTS pushed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_sent        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_failed      INT NOT NULL DEFAULT 0;
-- An audio message may come without text.
ALTER TABLE public.broadcasts ALTER COLUMN body_en DROP NOT NULL;
ALTER TABLE public.broadcasts DROP CONSTRAINT IF EXISTS broadcasts_media_check;
ALTER TABLE public.broadcasts ADD CONSTRAINT broadcasts_media_check CHECK (
  (media_type IS NULL AND media_path IS NULL)
  OR (media_type = 'audio' AND media_bucket = 'company-media' AND media_path IS NOT NULL
      AND media_mime IN ('audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg')
      AND (media_duration_s IS NULL OR media_duration_s BETWEEN 0 AND 7200))) NOT VALID;
ALTER TABLE public.broadcasts DROP CONSTRAINT IF EXISTS broadcasts_body_or_audio;
ALTER TABLE public.broadcasts ADD CONSTRAINT broadcasts_body_or_audio
  CHECK (nullif(btrim(body_en), '') IS NOT NULL OR media_path IS NOT NULL) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_broadcasts_due ON public.broadcasts (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_broadcasts_push ON public.broadcasts (sent_at) WHERE status = 'sent' AND pushed_at IS NULL;

-- Which broadcast a notification came from (its audio, its push).
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES public.broadcasts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON public.notifications (broadcast_id)
  WHERE broadcast_id IS NOT NULL;

-- company-media takes voice notes / podcasts too.
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY(SELECT DISTINCT x FROM unnest(allowed_mime_types
                              || ARRAY['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg']) x ORDER BY 1)
 WHERE id = 'company-media' AND allowed_mime_types IS NOT NULL;

-- When something due at p_at may be delivered: p_at itself, or (quiet hours
-- on and p_at outside 08:00–20:00 company time) the next 08:00.
CREATE OR REPLACE FUNCTION public.broadcast_deliver_at(p_company_id UUID, p_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tz    TEXT;
  v_local TIMESTAMP;
BEGIN
  IF p_at IS NULL OR NOT public.quiet_hours_on(p_company_id) THEN RETURN p_at; END IF;
  v_tz := public.company_tz(p_company_id);
  v_local := p_at AT TIME ZONE v_tz;
  IF v_local::time >= TIME '08:00' AND v_local::time < TIME '20:00' THEN RETURN p_at; END IF;
  RETURN ((CASE WHEN v_local::time < TIME '08:00' THEN v_local::date ELSE v_local::date + 1 END)
          + TIME '08:00') AT TIME ZONE v_tz;
END;
$$;

-- A broadcast row as the HR app reads it.
CREATE OR REPLACE FUNCTION public.broadcast_json(b public.broadcasts)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT to_jsonb(b) || jsonb_build_object(
    'team_name',  (SELECT t.name FROM public.teams t WHERE t.id = b.team_id),
    'has_audio',  b.media_path IS NOT NULL,
    'deliver_at', CASE b.status
                    WHEN 'scheduled' THEN public.broadcast_deliver_at(b.company_id, GREATEST(b.scheduled_at, public.clock_now()))
                    WHEN 'sent' THEN b.sent_at END);
$$;

-- Turn one scheduled broadcast into in-app notifications for its audience
-- (everyone in the company, or the team) and mark it sent. Returns the
-- number of people. Internal.
CREATE OR REPLACE FUNCTION public.deliver_broadcast(p_broadcast_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b   public.broadcasts%ROWTYPE;
  v_n INT;
BEGIN
  SELECT * INTO b FROM public.broadcasts WHERE id = p_broadcast_id FOR UPDATE;
  IF b.id IS NULL OR b.status <> 'scheduled' THEN RETURN 0; END IF;
  INSERT INTO public.notifications (user_id, company_id, kind, title_en, title_ar, body_en, body_ar,
                                    deep_link, sent_at, broadcast_id)
  SELECT p.id, b.company_id, 'system', b.title_en, b.title_ar, b.body_en, b.body_ar,
         'notifications', public.clock_now(), b.id
    FROM public.profiles p
   WHERE p.company_id = b.company_id AND p.deleted_at IS NULL
     AND (b.scope = 'all' OR (b.scope = 'team' AND b.team_id IS NOT NULL AND p.team_id = b.team_id));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.broadcasts
     SET status = 'sent', sent_at = public.clock_now(), recipients = v_n, updated_at = now()
   WHERE id = b.id;
  RETURN v_n;
END;
$$;

-- Deliver every scheduled broadcast whose time has come, unless its
-- company is in quiet hours right now (then the next run after 08:00 does
-- it). Run every minute by the cron job. Returns how many went out.
CREATE OR REPLACE FUNCTION public.send_due_broadcasts()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := public.clock_now();
  v_n   INT := 0;
  r     RECORD;
BEGIN
  FOR r IN SELECT b.id, b.company_id FROM public.broadcasts b
            WHERE b.status = 'scheduled' AND b.scheduled_at <= v_now
            ORDER BY b.scheduled_at
            LIMIT 200
            FOR UPDATE SKIP LOCKED
  LOOP
    IF public.broadcast_deliver_at(r.company_id, v_now) <= v_now THEN
      PERFORM public.deliver_broadcast(r.id);
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN v_n;
END;
$$;

-- HR: create or update a scheduled broadcast. Input keys: id (update; only
-- while still scheduled; missing keys keep their value), title_en
-- (required), title_ar, body_en, body_ar (body_en or audio required),
-- scope 'all' | 'team', team_id (scope team), scheduled_at (ISO time;
-- missing / null / past = now), audio: media_path (a file uploaded to
-- company-media/{company_id}/broadcasts/…; null clears it), media_mime
-- (audio/mpeg | audio/mp4 | audio/x-m4a | audio/webm | audio/ogg),
-- media_duration_s. Due now (and not quiet hours) = delivered at once;
-- otherwise the minute job delivers it at deliver_at. Returns the row +
-- team_name, has_audio, deliver_at.
CREATE OR REPLACE FUNCTION public.hr_save_broadcast(p_input JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_now     TIMESTAMPTZ := public.clock_now();
  v_id      UUID;
  v_old     public.broadcasts%ROWTYPE;
  v_row     public.broadcasts%ROWTYPE;
  v_in      JSONB;
  v_scope   TEXT;
  v_team    UUID;
  v_at      TIMESTAMPTZ;
  v_path    TEXT;
  v_mime    TEXT;
  v_dur     INT;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_id := nullif(p_input ->> 'id', '')::uuid;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.broadcasts WHERE id = v_id AND company_id = v_company FOR UPDATE;
    IF v_old.id IS NULL THEN RAISE EXCEPTION 'broadcast_not_found' USING ERRCODE = 'P0002'; END IF;
    IF v_old.status <> 'scheduled' THEN
      RAISE EXCEPTION 'broadcast_not_editable' USING ERRCODE = '22023', DETAIL = v_old.status;
    END IF;
    v_in := (to_jsonb(v_old) - 'id') || p_input;
  ELSE
    v_in := p_input;
  END IF;

  IF public.jtxt(v_in, 'title_en') IS NULL THEN RAISE EXCEPTION 'title_required' USING ERRCODE = '22023'; END IF;
  IF length(public.jtxt(v_in, 'title_en')) > 160 OR length(COALESCE(public.jtxt(v_in, 'title_ar'), '')) > 160 THEN
    RAISE EXCEPTION 'title_too_long' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(v_in ->> 'body_en', '')) > 2000 OR length(COALESCE(v_in ->> 'body_ar', '')) > 2000 THEN
    RAISE EXCEPTION 'body_too_long' USING ERRCODE = '22023';
  END IF;

  v_scope := COALESCE(public.jtxt(v_in, 'scope'), 'all');
  IF v_scope NOT IN ('all', 'team') THEN RAISE EXCEPTION 'bad_scope' USING ERRCODE = '22023'; END IF;
  v_team := CASE WHEN v_scope = 'team' THEN nullif(v_in ->> 'team_id', '')::uuid END;
  IF v_scope = 'team' AND (v_team IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.teams WHERE id = v_team AND company_id = v_company)) THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    v_at := nullif(btrim(v_in ->> 'scheduled_at'), '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'bad_scheduled_at' USING ERRCODE = '22023';
  END;
  v_at := GREATEST(COALESCE(v_at, v_now), v_now);
  IF v_at > v_now + interval '366 days' THEN RAISE EXCEPTION 'bad_scheduled_at' USING ERRCODE = '22023'; END IF;

  v_path := public.jtxt(v_in, 'media_path');
  IF v_path IS NOT NULL THEN
    IF COALESCE(public.jtxt(v_in, 'media_bucket'), 'company-media') <> 'company-media' THEN
      RAISE EXCEPTION 'bad_media_bucket' USING ERRCODE = '22023';
    END IF;
    PERFORM public.check_media_path(v_company, 'company-media', v_path);
    v_mime := lower(btrim(split_part(public.jtxt(v_in, 'media_mime'), ';', 1)));
    IF v_mime IS NULL OR v_mime NOT IN ('audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg') THEN
      RAISE EXCEPTION 'bad_media_mime' USING ERRCODE = '22023';
    END IF;
    IF public.jtxt(v_in, 'media_duration_s') IS NOT NULL THEN
      IF (v_in ->> 'media_duration_s') !~ '^\d{1,5}(\.\d+)?$'
         OR round((v_in ->> 'media_duration_s')::numeric) > 7200 THEN
        RAISE EXCEPTION 'bad_media_duration' USING ERRCODE = '22023';
      END IF;
      v_dur := round((v_in ->> 'media_duration_s')::numeric)::int;
    END IF;
  END IF;
  IF public.jtxt(v_in, 'body_en') IS NULL AND v_path IS NULL THEN
    RAISE EXCEPTION 'body_required' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.broadcasts (company_id, title_en, title_ar, body_en, body_ar, scope, team_id, status,
                                   scheduled_at, media_type, media_bucket, media_path, media_mime,
                                   media_duration_s, created_by)
    VALUES (v_company, public.jtxt(v_in, 'title_en'), public.jtxt(v_in, 'title_ar'),
            public.jtxt(v_in, 'body_en'), public.jtxt(v_in, 'body_ar'), v_scope, v_team, 'scheduled', v_at,
            CASE WHEN v_path IS NOT NULL THEN 'audio' END,
            CASE WHEN v_path IS NOT NULL THEN 'company-media' END, v_path, v_mime, v_dur,
            (SELECT id FROM public.profiles WHERE id = auth.uid()))
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.broadcasts SET
      title_en = public.jtxt(v_in, 'title_en'), title_ar = public.jtxt(v_in, 'title_ar'),
      body_en = public.jtxt(v_in, 'body_en'), body_ar = public.jtxt(v_in, 'body_ar'),
      scope = v_scope, team_id = v_team, scheduled_at = v_at,
      media_type = CASE WHEN v_path IS NOT NULL THEN 'audio' END,
      media_bucket = CASE WHEN v_path IS NOT NULL THEN 'company-media' END,
      media_path = v_path, media_mime = v_mime, media_duration_s = v_dur,
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  IF v_row.scheduled_at <= v_now AND public.broadcast_deliver_at(v_company, v_now) <= v_now THEN
    PERFORM public.deliver_broadcast(v_row.id);
    SELECT * INTO v_row FROM public.broadcasts WHERE id = v_row.id;
  END IF;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(),
          CASE WHEN v_id IS NULL THEN 'broadcast.created' ELSE 'broadcast.updated' END, 'broadcast', v_row.id, 'info',
          jsonb_build_object('scope', v_scope, 'team_id', v_team, 'scheduled_at', v_row.scheduled_at,
                             'status', v_row.status, 'audio', v_path IS NOT NULL));
  RETURN public.broadcast_json(v_row);
END;
$$;

-- HR: cancel a broadcast that hasn't gone out yet.
CREATE OR REPLACE FUNCTION public.hr_cancel_broadcast(p_broadcast_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_row     public.broadcasts%ROWTYPE;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.broadcasts WHERE id = p_broadcast_id AND company_id = v_company FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'broadcast_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_row.status = 'sent' THEN RAISE EXCEPTION 'broadcast_already_sent' USING ERRCODE = '22023'; END IF;
  IF v_row.status = 'scheduled' THEN
    UPDATE public.broadcasts SET status = 'cancelled', updated_at = now() WHERE id = v_row.id RETURNING * INTO v_row;
    INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
    VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'broadcast.cancelled', 'broadcast', v_row.id,
            'info', '{}'::jsonb);
  END IF;
  RETURN public.broadcast_json(v_row);
END;
$$;

-- HR: the company's broadcasts, newest first (same shape as hr_save_broadcast).
CREATE OR REPLACE FUNCTION public.hr_list_broadcasts(p_limit INT DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_out     JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(public.broadcast_json(b) ORDER BY b.scheduled_at DESC, b.created_at DESC), '[]'::jsonb)
    INTO v_out
    FROM public.broadcasts b
   WHERE b.id IN (SELECT x.id FROM public.broadcasts x WHERE x.company_id = v_company
                   ORDER BY x.scheduled_at DESC, x.created_at DESC
                   LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500));
  RETURN v_out;
END;
$$;

-- Employee (or HR): audio of broadcasts the caller received. Returns
-- [{broadcast_id, media_type, media_bucket, media_path, media_mime,
-- media_duration_s}] for the ids that have audio; sign media_path with
-- Storage (company-media) to play it.
CREATE OR REPLACE FUNCTION public.broadcast_media(p_broadcast_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_hr      BOOLEAN := public.auth_role() IN ('hr_admin', 'company_admin');
  v_out     JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF cardinality(p_broadcast_ids) > 100 THEN RAISE EXCEPTION 'too_many_items' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'broadcast_id', b.id, 'media_type', b.media_type, 'media_bucket', b.media_bucket,
           'media_path', b.media_path, 'media_mime', b.media_mime, 'media_duration_s', b.media_duration_s)), '[]'::jsonb)
    INTO v_out
    FROM public.broadcasts b
   WHERE b.id = ANY (COALESCE(p_broadcast_ids, '{}'))
     AND b.company_id = v_company AND b.media_path IS NOT NULL
     AND (v_hr OR EXISTS (SELECT 1 FROM public.notifications n WHERE n.broadcast_id = b.id AND n.user_id = v_uid));
  RETURN v_out;
END;
$$;

-- Broadcasts delivered in the last 30 minutes that haven't been pushed:
-- one row per recipient with push devices. p_claim (default) marks them
-- pushed so no other run picks them. Service role only.
CREATE OR REPLACE FUNCTION public.due_broadcast_pushes(p_at TIMESTAMPTZ DEFAULT NULL, p_claim BOOLEAN DEFAULT true)
RETURNS TABLE (broadcast_id UUID, company_id UUID, user_id UUID, title_en TEXT, title_ar TEXT,
               body_en TEXT, body_ar TEXT, has_audio BOOLEAN, subscriptions JSONB)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_at  TIMESTAMPTZ := COALESCE(p_at, public.clock_now());
  v_ids UUID[];
BEGIN
  IF COALESCE(p_claim, true) THEN
    WITH c AS (
      UPDATE public.broadcasts b SET pushed_at = v_at
       WHERE b.id IN (SELECT x.id FROM public.broadcasts x
                       WHERE x.status = 'sent' AND x.pushed_at IS NULL
                         AND x.sent_at > v_at - interval '30 minutes' AND x.sent_at <= v_at + interval '1 minute'
                       ORDER BY x.sent_at LIMIT 50
                       FOR UPDATE SKIP LOCKED)
      RETURNING b.id)
    SELECT COALESCE(array_agg(c.id), '{}') INTO v_ids FROM c;
  ELSE
    SELECT COALESCE(array_agg(x.id), '{}') INTO v_ids FROM public.broadcasts x
     WHERE x.status = 'sent' AND x.pushed_at IS NULL
       AND x.sent_at > v_at - interval '30 minutes' AND x.sent_at <= v_at + interval '1 minute';
  END IF;

  RETURN QUERY
  SELECT b.id, b.company_id, n.user_id, b.title_en, b.title_ar, b.body_en, b.body_ar, b.media_path IS NOT NULL,
         (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh,
                                              'auth', s.auth, 'lang', s.lang)
                           ORDER BY s.last_seen_at DESC)
            FROM public.push_subscriptions s WHERE s.user_id = n.user_id)
    FROM public.broadcasts b
    JOIN public.notifications n ON n.broadcast_id = b.id
   WHERE b.id = ANY (v_ids)
     AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = n.user_id)
   ORDER BY b.sent_at, n.user_id;
END;
$$;

-- Delivery results from the edge function. p_results: [{subscription_id,
-- ok, status (HTTP), error, kind 'reminder' | 'broadcast', user_id,
-- item_id, day, broadcast_id}]. ok → device healthy; 404 / 410 → device
-- gone (deleted); other failures count up and the device is deleted after
-- 5 in a row. Service role only.
CREATE OR REPLACE FUNCTION public.record_push_results(p_results JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ok      INT := 0;
  v_failed  INT := 0;
  v_removed INT := 0;
  v_n       INT;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) = 0 THEN
    RETURN jsonb_build_object('ok', 0, 'failed', 0, 'removed', 0);
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _push_results (
    sid UUID, ok BOOLEAN, status INT, err TEXT, kind TEXT, uid UUID, item UUID, day DATE, bid UUID
  ) ON COMMIT DROP;
  DELETE FROM _push_results WHERE true;  -- (pg_safeupdate wants a WHERE)
  INSERT INTO _push_results
  SELECT CASE WHEN x ->> 'subscription_id' ~* '^[0-9a-f-]{36}$' THEN (x ->> 'subscription_id')::uuid END,
         COALESCE((x ->> 'ok')::boolean, false),
         CASE WHEN (x ->> 'status') ~ '^\d{1,3}$' THEN (x ->> 'status')::int END,
         left(x ->> 'error', 300),
         x ->> 'kind',
         CASE WHEN x ->> 'user_id' ~* '^[0-9a-f-]{36}$' THEN (x ->> 'user_id')::uuid END,
         CASE WHEN x ->> 'item_id' ~* '^[0-9a-f-]{36}$' THEN (x ->> 'item_id')::uuid END,
         CASE WHEN x ->> 'day' ~ '^\d{4}-\d{2}-\d{2}$' THEN (x ->> 'day')::date END,
         CASE WHEN x ->> 'broadcast_id' ~* '^[0-9a-f-]{36}$' THEN (x ->> 'broadcast_id')::uuid END
    FROM jsonb_array_elements(p_results) x;

  SELECT count(*) FILTER (WHERE ok), count(*) FILTER (WHERE NOT ok) INTO v_ok, v_failed FROM _push_results;

  UPDATE public.push_subscriptions s
     SET last_ok_at = now(), failures = 0, last_error = NULL
   WHERE s.id IN (SELECT r.sid FROM _push_results r WHERE r.ok);

  DELETE FROM public.push_subscriptions s
   WHERE s.id IN (SELECT r.sid FROM _push_results r WHERE NOT r.ok AND r.status IN (404, 410));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_removed := v_removed + v_n;

  UPDATE public.push_subscriptions s
     SET failures = s.failures + f.n, last_error = f.err
    FROM (SELECT r.sid, count(*)::int AS n, max(COALESCE(r.status::text || ' ', '') || COALESCE(r.err, '')) AS err
            FROM _push_results r
           WHERE NOT r.ok AND r.status IS DISTINCT FROM 404 AND r.status IS DISTINCT FROM 410
           GROUP BY r.sid) f
   WHERE s.id = f.sid;

  DELETE FROM public.push_subscriptions s
   WHERE s.failures >= 5 AND s.id IN (SELECT r.sid FROM _push_results r);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_removed := v_removed + v_n;

  UPDATE public.reminder_log l
     SET delivered = l.delivered + g.ok_n, failed = l.failed + g.fail_n
    FROM (SELECT r.uid, r.item, r.day, count(*) FILTER (WHERE r.ok)::int AS ok_n,
                 count(*) FILTER (WHERE NOT r.ok)::int AS fail_n
            FROM _push_results r WHERE r.kind = 'reminder' GROUP BY r.uid, r.item, r.day) g
   WHERE l.user_id = g.uid AND l.item_id = g.item AND l.day = g.day;

  UPDATE public.broadcasts b
     SET push_sent = b.push_sent + g.ok_n, push_failed = b.push_failed + g.fail_n
    FROM (SELECT r.bid, count(*) FILTER (WHERE r.ok)::int AS ok_n, count(*) FILTER (WHERE NOT r.ok)::int AS fail_n
            FROM _push_results r WHERE r.kind = 'broadcast' GROUP BY r.bid) g
   WHERE b.id = g.bid;

  DELETE FROM _push_results WHERE true;
  RETURN jsonb_build_object('ok', v_ok, 'failed', v_failed, 'removed', v_removed);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. The per-minute job
-- ═══════════════════════════════════════════════════════════════

-- 1) delivers due broadcasts (in-app, in SQL — needs no secret);
-- 2) when Vault holds wellness_functions_url + wellness_cron_secret, asks
--    the send-reminders edge function to push (reminders + the broadcasts
--    just delivered). Without them it stops there: no request, no error.
-- 3) once an hour, prunes reminder_log.
CREATE OR REPLACE FUNCTION public.cron_minute_tick()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_delivered INT := 0;
  v_url       TEXT;
  v_secret    TEXT;
  v_req       BIGINT;
BEGIN
  BEGIN
    v_delivered := public.send_due_broadcasts();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'wellness: send_due_broadcasts failed: %', SQLERRM;
  END;

  IF EXTRACT(MINUTE FROM now())::int = 17 THEN
    DELETE FROM public.reminder_log WHERE day < current_date - 35;
  END IF;

  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE $q$
      SELECT max(decrypted_secret) FILTER (WHERE name = 'wellness_functions_url'),
             max(decrypted_secret) FILTER (WHERE name = 'wellness_cron_secret')
        FROM vault.decrypted_secrets
       WHERE name IN ('wellness_functions_url', 'wellness_cron_secret')$q$
      INTO v_url, v_secret;
  END IF;
  v_url := nullif(btrim(v_url), '');
  v_secret := nullif(btrim(v_secret), '');
  IF v_url IS NULL OR v_secret IS NULL OR v_url !~ '^https?://'
     OR to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') IS NULL THEN
    RETURN jsonb_build_object('broadcasts_delivered', v_delivered, 'push', 'not_configured');
  END IF;

  -- The base functions URL or the function's own URL both work.
  v_url := rtrim(v_url, '/');
  IF v_url !~ '/send-reminders$' THEN v_url := v_url || '/send-reminders'; END IF;
  EXECUTE 'SELECT net.http_post(url := $1, body := $2, params := ''{}''::jsonb, headers := $3, timeout_milliseconds := 25000)'
     INTO v_req
    USING v_url,
          jsonb_build_object('at', now()),
          jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret);
  RETURN jsonb_build_object('broadcasts_delivered', v_delivered, 'push', 'requested', 'request_id', v_req);
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('wellness-minute-tick', '* * * * *', 'SELECT public.cron_minute_tick()');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 6. Teams
-- ═══════════════════════════════════════════════════════════════

-- HR / company admins / Wellness admins and the superadmin allowlist are
-- never changed by HR's team tools.
CREATE OR REPLACE FUNCTION public.person_is_protected(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                  WHERE id = p_user_id AND role IN ('hr_admin', 'company_admin', 'wellness_admin'))
      OR EXISTS (SELECT 1 FROM auth.users
                  WHERE id = p_user_id
                    AND lower(COALESCE(email, '')) IN ('hazemabdelghany43@gmail.com', 'hazemabdelghany@gmail.com'));
$$;

-- HR: every team with its member count and leads, plus how many people
-- have no team.
CREATE OR REPLACE FUNCTION public.hr_list_teams()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'teams', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'department', t.department, 'created_at', t.created_at,
               'members', (SELECT count(*) FROM public.profiles p
                            WHERE p.team_id = t.id AND p.company_id = v_company AND p.deleted_at IS NULL),
               'leads', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                  'user_id', p.id, 'display_name', p.display_name, 'initials', p.initials)
                                ORDER BY p.display_name), '[]'::jsonb)
                           FROM public.profiles p
                          WHERE p.team_id = t.id AND p.company_id = v_company AND p.deleted_at IS NULL
                            AND p.role = 'manager'))
             ORDER BY lower(t.name))
        FROM public.teams t WHERE t.company_id = v_company), '[]'::jsonb),
    'no_team', (SELECT count(*) FROM public.profiles p
                 WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.team_id IS NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_create_team(p_name TEXT, p_department TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_name    TEXT := btrim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g'));
  v_row     public.teams%ROWTYPE;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'name_required' USING ERRCODE = '22023'; END IF;
  IF length(v_name) > 80 OR length(COALESCE(p_department, '')) > 80 THEN
    RAISE EXCEPTION 'name_too_long' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.teams WHERE company_id = v_company AND lower(name) = lower(v_name)) THEN
    RAISE EXCEPTION 'team_name_taken' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.teams (company_id, name, department)
  VALUES (v_company, v_name, nullif(btrim(p_department), ''))
  RETURNING * INTO v_row;
  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'team.created', 'team', v_row.id, 'info',
          jsonb_build_object('name', v_row.name));
  RETURN to_jsonb(v_row) || jsonb_build_object('members', 0, 'leads', '[]'::jsonb);
END;
$$;

-- Rename a team. p_name NULL keeps the name; p_department NULL keeps it,
-- '' clears it.
CREATE OR REPLACE FUNCTION public.hr_rename_team(p_team_id UUID, p_name TEXT, p_department TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_name    TEXT := nullif(btrim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g')), '');
  v_row     public.teams%ROWTYPE;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.teams WHERE id = p_team_id AND company_id = v_company FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_name IS NULL AND p_department IS NULL THEN RAISE EXCEPTION 'name_required' USING ERRCODE = '22023'; END IF;
  IF length(COALESCE(v_name, '')) > 80 OR length(COALESCE(p_department, '')) > 80 THEN
    RAISE EXCEPTION 'name_too_long' USING ERRCODE = '22023';
  END IF;
  IF v_name IS NOT NULL AND EXISTS (SELECT 1 FROM public.teams
                                     WHERE company_id = v_company AND lower(name) = lower(v_name) AND id <> p_team_id) THEN
    RAISE EXCEPTION 'team_name_taken' USING ERRCODE = '23505';
  END IF;
  UPDATE public.teams SET
    name = COALESCE(v_name, name),
    department = CASE WHEN p_department IS NULL THEN department ELSE nullif(btrim(p_department), '') END
  WHERE id = p_team_id
  RETURNING * INTO v_row;
  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'team.renamed', 'team', v_row.id, 'info',
          jsonb_build_object('name', v_row.name, 'department', v_row.department));
  RETURN to_jsonb(v_row);
END;
$$;

-- Delete a team. Refused while it has members (team_not_empty, DETAIL =
-- count) unless p_move_members: then everyone moves to "no team" first and
-- its leads go back to employee. Refused while something still runs for the
-- team (team_in_use, DETAIL = routine / challenge / broadcast): end the
-- routine assignment, cancel the challenge or broadcast first.
CREATE OR REPLACE FUNCTION public.hr_delete_team(p_team_id UUID, p_move_members BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_today   DATE;
  v_team    public.teams%ROWTYPE;
  v_members INT;
  v_leads   INT := 0;
  v_moved   INT := 0;
  v_use     TEXT[] := '{}';
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id AND company_id = v_company FOR UPDATE;
  IF v_team.id IS NULL THEN RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002'; END IF;
  v_today := public.company_today(v_company);

  IF EXISTS (SELECT 1 FROM public.routine_assignments a
              WHERE a.team_id = p_team_id AND a.active AND (a.ends_on IS NULL OR a.ends_on >= v_today)) THEN
    v_use := v_use || 'routine'::text;
  END IF;
  IF EXISTS (SELECT 1 FROM public.challenges c
              WHERE c.team_id = p_team_id AND c.active
                AND c.end_date + CASE WHEN c.payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= v_today) THEN
    v_use := v_use || 'challenge'::text;
  END IF;
  IF EXISTS (SELECT 1 FROM public.broadcasts b WHERE b.team_id = p_team_id AND b.status = 'scheduled') THEN
    v_use := v_use || 'broadcast'::text;
  END IF;
  IF cardinality(v_use) > 0 THEN
    RAISE EXCEPTION 'team_in_use' USING ERRCODE = '23503', DETAIL = array_to_string(v_use, ',');
  END IF;

  SELECT count(*) INTO v_members FROM public.profiles WHERE team_id = p_team_id;
  IF v_members > 0 AND NOT COALESCE(p_move_members, false) THEN
    RAISE EXCEPTION 'team_not_empty' USING ERRCODE = '23503', DETAIL = v_members::text;
  END IF;
  IF v_members > 0 THEN
    UPDATE public.profiles SET role = 'employee' WHERE team_id = p_team_id AND role = 'manager';
    GET DIAGNOSTICS v_leads = ROW_COUNT;
    UPDATE public.profiles SET team_id = NULL WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
  END IF;

  -- Finished team challenges keep their team's name for the history list
  -- (their team_id becomes NULL with the team).
  UPDATE public.challenges SET payload = payload || jsonb_build_object('team_name', v_team.name)
   WHERE team_id = p_team_id;
  DELETE FROM public.teams WHERE id = p_team_id;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'team.deleted', 'team', p_team_id, 'info',
          jsonb_build_object('name', v_team.name, 'moved', v_moved, 'leads_unset', v_leads));
  RETURN jsonb_build_object('deleted', true, 'team_id', p_team_id, 'moved', v_moved, 'leads_unset', v_leads);
END;
$$;

-- Move people (one or many) to a team, or to "no team" (p_team_id NULL).
-- Everyone must be a current member of the caller's company. A lead stays
-- a lead (of the new team); use hr_set_team_lead to change that.
CREATE OR REPLACE FUNCTION public.hr_move_to_team(p_user_ids UUID[], p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_ids     UUID[] := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_user_ids, '{}')) x WHERE x IS NOT NULL);
  v_bad     UUID;
  v_n       INT;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF cardinality(v_ids) = 0 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023'; END IF;
  IF cardinality(v_ids) > 500 THEN RAISE EXCEPTION 'too_many_items' USING ERRCODE = '22023'; END IF;
  IF p_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT x INTO v_bad FROM unnest(v_ids) x
   WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = x AND p.company_id = v_company AND p.deleted_at IS NULL)
   LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'person_not_found' USING ERRCODE = 'P0002', DETAIL = v_bad::text; END IF;

  UPDATE public.profiles SET team_id = p_team_id
   WHERE id = ANY (v_ids) AND team_id IS DISTINCT FROM p_team_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'team.members_moved', 'team', p_team_id, 'info',
          jsonb_build_object('user_ids', to_jsonb(v_ids), 'moved', v_n));
  RETURN jsonb_build_object('team_id', p_team_id, 'moved', v_n, 'user_ids', to_jsonb(v_ids));
END;
$$;

-- Make someone their team's lead (role manager) or take it back (role
-- employee). Only employees and managers of the caller's company; HR /
-- company / Wellness admins are refused (protected_role). A lead needs a
-- team. The new role reaches their app at the next token refresh (≤ 1 h).
CREATE OR REPLACE FUNCTION public.hr_set_team_lead(p_user_id UUID, p_lead BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_p       public.profiles%ROWTYPE;
  v_role    TEXT;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_p FROM public.profiles
   WHERE id = p_user_id AND company_id = v_company AND deleted_at IS NULL FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'person_not_found' USING ERRCODE = 'P0002'; END IF;
  IF public.person_is_protected(p_user_id) OR v_p.role NOT IN ('employee', 'manager') THEN
    RAISE EXCEPTION 'protected_role' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_lead, true) AND v_p.team_id IS NULL THEN
    RAISE EXCEPTION 'person_has_no_team' USING ERRCODE = '22023';
  END IF;
  v_role := CASE WHEN COALESCE(p_lead, true) THEN 'manager' ELSE 'employee' END;
  IF v_p.role IS DISTINCT FROM v_role THEN
    UPDATE public.profiles SET role = v_role WHERE id = p_user_id;
    INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
    VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'team.lead_set', v_role, p_user_id, 'info',
            jsonb_build_object('previous_role', v_p.role, 'new_role', v_role, 'team_id', v_p.team_id));
  END IF;
  RETURN jsonb_build_object('user_id', p_user_id, 'team_id', v_p.team_id, 'role', v_role, 'lead', v_role = 'manager');
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 7. Privacy: secondary suppression
-- ═══════════════════════════════════════════════════════════════

-- Which groups may be shown on their own. p_groups: [{key, size,
-- showable}] — every group that adds to the company total (size = people;
-- showable false = never shown on its own, e.g. people with no team). A
-- group under p_floor is hidden. If the hidden ones together are 1 …
-- floor-1 people, subtracting the shown groups from the total would expose
-- them, so the smallest shown groups are folded in (hidden too) until the
-- hidden remainder reaches the floor. If even folding everything can't
-- reach it, nothing is shown. Returns the keys that stay shown.
CREATE OR REPLACE FUNCTION public.cohort_shown_keys(p_groups JSONB, p_floor INT)
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  WITH g AS (
    SELECT x ->> 'key' AS k,
           GREATEST(COALESCE(CASE WHEN (x ->> 'size') ~ '^\d+$' THEN (x ->> 'size')::int END, 0), 0) AS s,
           COALESCE((x ->> 'showable')::boolean, true) AS showable
      FROM jsonb_array_elements(COALESCE(p_groups, '[]'::jsonb)) x
  ), vis AS (
    SELECT g.k, g.s FROM g WHERE g.showable AND g.k IS NOT NULL AND g.s >= GREATEST(p_floor, 1)
  ), hid AS (
    SELECT COALESCE(sum(g.s), 0) AS n FROM g
     WHERE NOT (g.showable AND g.k IS NOT NULL AND g.s >= GREATEST(p_floor, 1))
  ), ord AS (
    SELECT vis.k, vis.s,
           sum(vis.s) OVER (ORDER BY vis.s, vis.k ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) - vis.s AS before
      FROM vis
  )
  SELECT COALESCE(array_agg(ord.k ORDER BY ord.s DESC, ord.k), '{}')
    FROM ord, hid
   WHERE hid.n = 0 OR hid.n + ord.before >= GREATEST(p_floor, 1);
$$;

-- Routine report: unchanged, except the team breakdown. Every group with
-- something due (teams, and people with no team as their own group) is
-- checked with cohort_shown_keys(); the rest — small teams, folded teams,
-- no-team people under the floor — is one "small" row, shown only when it
-- reaches the floor. New keys: teams_folded (teams at/over the floor folded
-- for privacy) and breakdown_suppressed (no team shown on its own).
CREATE OR REPLACE FUNCTION public.hr_routine_report(p_range TEXT DEFAULT '14d')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company  UUID := public.auth_company_id();
  v_days     INT := CASE p_range WHEN '7d' THEN 7 WHEN '30d' THEN 30 WHEN '90d' THEN 90 ELSE 14 END;
  v_tz       TEXT;
  v_today    DATE;
  v_from     DATE;
  v_floor    INT;
  v_members  INT;
  v_sup      BOOLEAN;
  v_out      JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_tz      := public.company_tz(v_company);
  v_today   := public.company_today(v_company);
  v_from    := v_today - (v_days - 1);
  v_floor   := public.hr_min_cohort(v_company);
  v_members := public.habit_members(v_company, NULL);
  v_sup     := v_members < v_floor;

  WITH tm AS (
    SELECT p.team_id, count(*)::int AS members
      FROM public.profiles p
     WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
     GROUP BY p.team_id
  ), cal AS (
    SELECT d::date AS day FROM generate_series(v_from, v_today, interval '1 day') d
  ), grid AS (
    SELECT tm.team_id, tm.members, cal.day, di.item_id
      FROM tm CROSS JOIN cal
     CROSS JOIN LATERAL public.routine_due_items(v_company, tm.team_id, cal.day) di
  ), gi AS (
    SELECT g.*, COALESCE(i.exercise_id, i.id) AS ex_key, i.exercise_id,
           COALESCE(nullif(btrim(i.title_en), ''), e.name_en) AS title_en,
           COALESCE(nullif(btrim(i.title_ar), ''), e.name_ar) AS title_ar
      FROM grid g
      JOIN public.routine_items i ON i.id = g.item_id
      LEFT JOIN public.exercises e ON e.id = i.exercise_id
  ), td AS (
    SELECT team_id, day, max(members)::int AS members, count(*)::int AS items
      FROM grid GROUP BY team_id, day
  ), chk AS (
    SELECT c.user_id, c.check_date, c.checked_at, c.item_id, c.exercise_id, p.team_id
      FROM public.routine_checks c
      JOIN public.profiles p ON p.id = c.user_id
     WHERE c.company_id = v_company AND c.check_date BETWEEN v_from AND v_today
       AND p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
  ), fulls AS (
    SELECT d.day, count(*)::int AS n
      FROM public.routine_days d
      JOIN public.profiles p ON p.id = d.user_id
     WHERE d.company_id = v_company AND d.all_done AND d.day BETWEEN v_from AND v_today
       AND p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
     GROUP BY d.day
  ), by_day AS (
    SELECT cal.day,
           COALESCE((SELECT sum(td.members) FROM td WHERE td.day = cal.day), 0)::int AS assigned,
           COALESCE((SELECT sum(td.members * td.items) FROM td WHERE td.day = cal.day), 0)::int AS due,
           (SELECT count(*) FROM chk WHERE chk.check_date = cal.day)::int AS done,
           (SELECT count(DISTINCT chk.user_id) FROM chk WHERE chk.check_date = cal.day)::int AS active,
           COALESCE((SELECT f.n FROM fulls f WHERE f.day = cal.day), 0)::int AS full_days
      FROM cal
  ), ts0 AS (
    SELECT tm.team_id, tm.members,
           COALESCE((SELECT sum(td.members * td.items) FROM td WHERE td.team_id IS NOT DISTINCT FROM tm.team_id), 0)::int AS due,
           (SELECT count(*) FROM td WHERE td.team_id IS NOT DISTINCT FROM tm.team_id)::int AS due_days,
           (SELECT count(*) FROM chk WHERE chk.team_id IS NOT DISTINCT FROM tm.team_id)::int AS done,
           (SELECT count(DISTINCT chk.user_id) FROM chk WHERE chk.team_id IS NOT DISTINCT FROM tm.team_id)::int AS active
      FROM tm
  ), fold AS (
    SELECT public.cohort_shown_keys(COALESCE(jsonb_agg(jsonb_build_object(
             'key', COALESCE(ts0.team_id::text, 'none'), 'size', ts0.members)), '[]'::jsonb), v_floor) AS keys
      FROM ts0 WHERE ts0.due_days > 0
  ), ts AS (
    SELECT ts0.*,
           COALESCE(ts0.team_id::text, 'none') = ANY (fold.keys) AS shown,
           ts0.team_id IS NULL AS no_team
      FROM ts0 CROSS JOIN fold
  ), small AS (
    SELECT (count(*) FILTER (WHERE ts.team_id IS NOT NULL))::int AS teams,
           COALESCE(sum(members), 0)::int AS members, COALESCE(sum(due), 0)::int AS due,
           COALESCE(sum(done), 0)::int AS done, COALESCE(sum(active), 0)::int AS active,
           COALESCE(sum(members * due_days), 0)::int AS person_days
      FROM ts WHERE NOT ts.shown AND ts.due_days > 0
  ), team_rows AS (
    SELECT jsonb_build_object(
             'team_id', ts.team_id, 'name', t.name, 'department', t.department,
             'small', false, 'no_team', ts.no_team, 'teams', 1,
             'members', ts.members, 'active', ts.active,
             'active_pct', round(100.0 * ts.active / ts.members),
             'done', ts.done, 'due', ts.due,
             'completion_pct', CASE WHEN ts.due > 0 THEN LEAST(100, round(100.0 * ts.done / ts.due)) END,
             'avg_items_per_day', CASE WHEN ts.due_days > 0 THEN round(ts.done::numeric / (ts.members * ts.due_days), 1) END
           ) AS j,
           CASE WHEN ts.due > 0 THEN ts.done::numeric / ts.due ELSE -1 END AS rank_key
      FROM ts LEFT JOIN public.teams t ON t.id = ts.team_id
     WHERE ts.shown AND ts.due_days > 0
    UNION ALL
    SELECT jsonb_build_object(
             'team_id', NULL, 'name', NULL, 'department', NULL,
             'small', true, 'no_team', false, 'teams', s.teams,
             'members', s.members, 'active', s.active,
             'active_pct', round(100.0 * s.active / s.members),
             'done', s.done, 'due', s.due,
             'completion_pct', CASE WHEN s.due > 0 THEN LEAST(100, round(100.0 * s.done / s.due)) END,
             'avg_items_per_day', CASE WHEN s.person_days > 0 THEN round(s.done::numeric / s.person_days, 1) END),
           -2
      FROM small s WHERE s.members >= v_floor
  ), ex_due AS (
    SELECT gi.ex_key, (array_agg(gi.exercise_id))[1] AS exercise_id,
           (array_agg(gi.title_en))[1] AS title_en, (array_agg(gi.title_ar))[1] AS title_ar,
           sum(gi.members)::int AS due
      FROM gi GROUP BY gi.ex_key
  ), ex_done AS (
    SELECT COALESCE(chk.exercise_id, chk.item_id) AS ex_key, count(*)::int AS done
      FROM chk GROUP BY 1
  ), hours AS (
    SELECT EXTRACT(HOUR FROM chk.checked_at AT TIME ZONE v_tz)::int AS hr, count(*)::int AS n
      FROM chk GROUP BY 1
  )
  SELECT jsonb_build_object(
    'range',       p_range,
    'from',        v_from,
    'to',          v_today,
    'timezone',    v_tz,
    'min_cohort',  v_floor,
    'members',     v_members,
    'suppressed',  v_sup,
    'has_routine', EXISTS (SELECT 1 FROM public.routine_assignments a
                            WHERE a.company_id = v_company AND a.active
                              AND (a.ends_on IS NULL OR a.ends_on >= v_today)),
    'today', (SELECT jsonb_build_object(
                'date', b.day, 'assigned', b.assigned, 'active', b.active, 'done', b.done, 'due', b.due,
                'full_days', b.full_days,
                'pct', CASE WHEN NOT v_sup AND b.due > 0 THEN LEAST(100, round(100.0 * b.done / b.due)) END,
                'active_pct', CASE WHEN NOT v_sup AND b.assigned > 0 THEN round(100.0 * b.active / b.assigned) END)
                FROM by_day b WHERE b.day = v_today),
    'totals', (SELECT jsonb_build_object(
                 'done', COALESCE(sum(b.done), 0), 'due', COALESCE(sum(b.due), 0),
                 'full_days', COALESCE(sum(b.full_days), 0),
                 'active_people', (SELECT count(DISTINCT chk.user_id) FROM chk),
                 'completion_pct', CASE WHEN NOT v_sup AND sum(b.due) > 0
                                        THEN LEAST(100, round(100.0 * sum(b.done) / sum(b.due))) END)
                 FROM by_day b),
    'by_day', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'date', b.day, 'weekday', EXTRACT(DOW FROM b.day)::int,
                 'assigned', b.assigned, 'active', b.active, 'done', b.done, 'due', b.due, 'full_days', b.full_days,
                 'pct', CASE WHEN NOT v_sup AND b.due > 0 THEN LEAST(100, round(100.0 * b.done / b.due)) END,
                 'active_pct', CASE WHEN NOT v_sup AND b.assigned > 0 THEN round(100.0 * b.active / b.assigned) END)
               ORDER BY b.day), '[]'::jsonb)
                 FROM by_day b WHERE b.due > 0 OR b.done > 0),
    'by_team', (SELECT COALESCE(jsonb_agg(tr.j ORDER BY tr.rank_key DESC, tr.j ->> 'name'), '[]'::jsonb) FROM team_rows tr),
    'small_teams_hidden', EXISTS (SELECT 1 FROM small s WHERE s.members > 0 AND s.members < v_floor),
    'teams_folded', (SELECT count(*) FROM ts
                      WHERE NOT ts.shown AND ts.due_days > 0 AND ts.team_id IS NOT NULL AND ts.members >= v_floor),
    'breakdown_suppressed', EXISTS (SELECT 1 FROM ts WHERE ts.due_days > 0)
                            AND NOT EXISTS (SELECT 1 FROM ts WHERE ts.due_days > 0 AND ts.shown),
    'by_exercise', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'key', d.ex_key, 'exercise_id', d.exercise_id, 'title_en', d.title_en, 'title_ar', d.title_ar,
                      'done', COALESCE(x.done, 0), 'due', d.due,
                      'pct', CASE WHEN d.due > 0 THEN LEAST(100, round(100.0 * COALESCE(x.done, 0) / d.due)) END)
                    ORDER BY CASE WHEN d.due > 0 THEN COALESCE(x.done, 0)::numeric / d.due END DESC NULLS LAST,
                             COALESCE(x.done, 0) DESC, d.title_en), '[]'::jsonb)
                      FROM ex_due d LEFT JOIN ex_done x ON x.ex_key = d.ex_key),
    'by_hour', (SELECT jsonb_agg(jsonb_build_object('hour', h, 'checks', COALESCE(hours.n, 0)) ORDER BY h)
                  FROM generate_series(0, 23) h LEFT JOIN hours ON hours.hr = h))
    INTO v_out;
  RETURN v_out;
END;
$$;

-- Recognition board: unchanged, except the team list. Teams are checked
-- with cohort_shown_keys() against everyone with something due in the
-- period (people with no team are never shown, but count as hidden), so
-- the teams left out can't be worked out from a company total.
CREATE OR REPLACE FUNCTION public.recognition_board(p_period TEXT DEFAULT 'today', p_limit INT DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_mode    TEXT;
  v_today   DATE;
  v_from    DATE;
  v_floor   INT;
  v_limit   INT := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
  v_opt     BOOLEAN;
  v_teams   JSONB;
  v_named   JSONB;
  v_me      JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_period, 'today') NOT IN ('today', 'week') THEN
    RAISE EXCEPTION 'bad_period' USING ERRCODE = '22023';
  END IF;
  v_mode  := public.company_settings_json(v_company) ->> 'recognition';
  v_today := public.company_today(v_company);
  v_from  := CASE WHEN p_period = 'week' THEN v_today - EXTRACT(DOW FROM v_today)::int ELSE v_today END;
  v_floor := public.hr_min_cohort(v_company);
  SELECT COALESCE(pp.recognition_opt_in, false) INTO v_opt FROM public.profile_prefs pp WHERE pp.user_id = v_uid;
  v_opt := COALESCE(v_opt, false);

  SELECT jsonb_build_object(
           'opted_in',   v_opt,
           'items_done', (SELECT count(*) FROM public.routine_checks c
                           WHERE c.user_id = v_uid AND c.check_date BETWEEN v_from AND v_today),
           'streak',     COALESCE((SELECT s.streak FROM public.routine_streaks(v_company, v_today, v_uid) s), 0))
    INTO v_me;

  IF v_mode = 'off' THEN
    RETURN jsonb_build_object('enabled', false, 'mode', 'off', 'period', COALESCE(p_period, 'today'),
                              'from', v_from, 'to', v_today, 'teams', '[]'::jsonb, 'named', NULL, 'me', v_me);
  END IF;

  WITH tm AS (
    SELECT p.team_id, count(*)::int AS members FROM public.profiles p
     WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
     GROUP BY p.team_id
  ), cal AS (
    SELECT d::date AS day FROM generate_series(v_from, v_today, interval '1 day') d
  ), td AS (
    SELECT tm.team_id, tm.members, cal.day,
           (SELECT count(*) FROM public.routine_due_items(v_company, tm.team_id, cal.day))::int AS items
      FROM tm CROSS JOIN cal
  ), chk AS (
    SELECT c.user_id, p.team_id FROM public.routine_checks c
      JOIN public.profiles p ON p.id = c.user_id
     WHERE c.company_id = v_company AND c.check_date BETWEEN v_from AND v_today
       AND p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
  ), ts AS (
    SELECT tm.team_id, tm.members,
           COALESCE((SELECT sum(td.members * td.items) FROM td WHERE td.team_id IS NOT DISTINCT FROM tm.team_id), 0)::int AS due,
           (SELECT count(*) FROM chk WHERE chk.team_id IS NOT DISTINCT FROM tm.team_id)::int AS done,
           (SELECT count(DISTINCT chk.user_id) FROM chk WHERE chk.team_id IS NOT DISTINCT FROM tm.team_id)::int AS active
      FROM tm
  ), fold AS (
    SELECT public.cohort_shown_keys(COALESCE(jsonb_agg(jsonb_build_object(
             'key', COALESCE(ts.team_id::text, 'none'), 'size', ts.members,
             'showable', ts.team_id IS NOT NULL)), '[]'::jsonb), v_floor) AS keys
      FROM ts WHERE ts.due > 0
  ), ranked AS (
    SELECT ts.*, t.name,
           round(100.0 * ts.active / ts.members) AS active_pct,
           CASE WHEN ts.due > 0 THEN LEAST(100, round(100.0 * ts.done / ts.due)) END AS completion_pct
      FROM ts JOIN public.teams t ON t.id = ts.team_id CROSS JOIN fold
     WHERE ts.due > 0 AND ts.team_id::text = ANY (fold.keys)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'team_id', r.team_id, 'name', r.name, 'members', r.members, 'active', r.active,
           'active_pct', r.active_pct, 'completion_pct', r.completion_pct,
           'rank', dense_rank_val)
         ORDER BY r.active_pct DESC, r.completion_pct DESC NULLS LAST, r.name), '[]'::jsonb)
    INTO v_teams
    FROM (SELECT ranked.*, dense_rank() OVER (ORDER BY ranked.active_pct DESC, ranked.completion_pct DESC NULLS LAST) AS dense_rank_val
            FROM ranked) r;

  IF v_mode = 'named' THEN
    WITH opted AS (
      SELECT p.id, p.display_name, p.initials, p.avatar_kind
        FROM public.profiles p
        JOIN public.profile_prefs pp ON pp.user_id = p.id AND pp.recognition_opt_in
       WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
    ), strk AS (
      SELECT * FROM public.routine_streaks(v_company, v_today)
    ), stats AS (
      SELECT o.*,
             (SELECT count(*) FROM public.routine_checks c
               WHERE c.user_id = o.id AND c.company_id = v_company
                 AND c.check_date BETWEEN v_from AND v_today)::int AS items_done,
             (SELECT count(*) FROM public.routine_days d
               WHERE d.user_id = o.id AND d.all_done AND d.day BETWEEN v_from AND v_today)::int AS full_days,
             EXISTS (SELECT 1 FROM public.routine_days d
                      WHERE d.user_id = o.id AND d.all_done AND d.day = v_today) AS full_today,
             COALESCE(s.streak, 0) AS streak
        FROM opted o
        LEFT JOIN strk s ON s.user_id = o.id
    ), did_all AS (
      SELECT count(*)::int AS n FROM public.routine_days d
        JOIN public.profiles p ON p.id = d.user_id
       WHERE d.company_id = v_company AND d.all_done AND d.day = v_today
         AND p.deleted_at IS NULL AND p.onboarded
    ), shown AS (
      SELECT s.* FROM stats s WHERE s.full_today ORDER BY s.display_name LIMIT v_limit
    )
    SELECT jsonb_build_object(
      'opted_in', (SELECT count(*) FROM opted),
      'top', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'user_id', s.id, 'display_name', s.display_name, 'initials', s.initials, 'avatar_kind', s.avatar_kind,
                'items_done', s.items_done, 'full_days', s.full_days, 'streak', s.streak)
              ORDER BY s.items_done DESC, s.streak DESC, s.display_name), '[]'::jsonb)
                FROM (SELECT * FROM stats WHERE items_done > 0
                       ORDER BY items_done DESC, streak DESC, display_name LIMIT v_limit) s),
      'did_everything', jsonb_build_object(
        'names', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'user_id', s.id, 'display_name', s.display_name, 'initials', s.initials,
                    'avatar_kind', s.avatar_kind) ORDER BY s.display_name), '[]'::jsonb) FROM shown s),
        'more',  GREATEST((SELECT n FROM did_all) - (SELECT count(*) FROM shown), 0)),
      'longest_streak', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                           'user_id', s.id, 'display_name', s.display_name, 'initials', s.initials,
                           'avatar_kind', s.avatar_kind, 'streak', s.streak)
                         ORDER BY s.streak DESC, s.display_name), '[]'::jsonb)
                           FROM (SELECT * FROM stats WHERE streak > 0
                                  ORDER BY streak DESC, display_name LIMIT v_limit) s))
      INTO v_named;
  END IF;

  RETURN jsonb_build_object('enabled', true, 'mode', v_mode, 'period', COALESCE(p_period, 'today'),
                            'from', v_from, 'to', v_today, 'teams', v_teams, 'named', v_named, 'me', v_me);
END;
$$;

-- HR Teams view (mood check-ins, last 30 days): a team is shown only when
-- its respondents reach the floor AND it isn't folded by
-- cohort_shown_keys() (respondents with no team count as hidden). Same
-- columns as before; folded teams come back suppressed.
CREATE OR REPLACE FUNCTION public.hr_team_overview_rows()
RETURNS TABLE (
  company_id   uuid,
  team_id      uuid,
  team_name    text,
  department   text,
  week_start   date,
  member_count bigint,
  group_size   bigint,
  has_signal   boolean,
  suppressed   boolean,
  avg_mood     numeric,
  avg_stress   numeric,
  avg_sleep    numeric,
  avg_energy   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT
      (auth.role() = 'service_role' OR public.is_wellness_admin()) AS all_tenants,
      CASE WHEN public.auth_role() IN ('hr_admin', 'company_admin', 'manager')
           THEN public.auth_company_id() END                         AS company_id
  ),
  team_counts AS (
    SELECT
      t.company_id,
      t.id          AS team_id,
      t.name        AS team_name,
      t.department,
      COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL AND p.onboarded = true) AS member_count
    FROM public.teams t
    LEFT JOIN public.profiles p
      ON p.team_id = t.id
     AND p.company_id = t.company_id
    GROUP BY t.company_id, t.id, t.name, t.department
  ),
  recent AS (
    SELECT
      p.team_id,
      c.company_id,
      COUNT(DISTINCT c.user_id) AS group_size,
      round(avg(c.mood)::numeric, 1)   AS avg_mood,
      round(avg(c.stress)::numeric, 1) AS avg_stress,
      round(avg(c.sleep)::numeric, 1)  AS avg_sleep,
      round(avg(c.energy)::numeric, 1) AS avg_energy,
      max(date_trunc('week', c.checked_at)::date) AS week_start
    FROM public.checkins c
    JOIN public.profiles p ON p.id = c.user_id
    WHERE c.checked_at >= current_date - interval '30 days'
    GROUP BY p.team_id, c.company_id
  ),
  fold AS (
    SELECT r.company_id,
           public.cohort_shown_keys(jsonb_agg(jsonb_build_object(
             'key', COALESCE(r.team_id::text, 'none'), 'size', r.group_size,
             'showable', r.team_id IS NOT NULL)), public.hr_min_cohort(r.company_id)) AS keys
      FROM recent r
     GROUP BY r.company_id
  )
  SELECT
    tc.company_id,
    tc.team_id,
    tc.team_name,
    tc.department,
    coalesce(r.week_start, date_trunc('week', current_date)::date),
    coalesce(tc.member_count, 0),
    coalesce(r.group_size, 0),
    COALESCE(tc.team_id::text = ANY (f.keys), false),
    NOT COALESCE(tc.team_id::text = ANY (f.keys), false),
    CASE WHEN tc.team_id::text = ANY (f.keys) THEN r.avg_mood   END,
    CASE WHEN tc.team_id::text = ANY (f.keys) THEN r.avg_stress END,
    CASE WHEN tc.team_id::text = ANY (f.keys) THEN r.avg_sleep  END,
    CASE WHEN tc.team_id::text = ANY (f.keys) THEN r.avg_energy END
  FROM team_counts tc
  CROSS JOIN caller
  LEFT JOIN recent r
    ON r.team_id = tc.team_id
   AND r.company_id = tc.company_id
  LEFT JOIN fold f
    ON f.company_id = tc.company_id
  WHERE caller.all_tenants OR tc.company_id = caller.company_id;
$$;

-- HR team drill-down (mood check-ins): suppressed when the team's
-- respondents are under the floor, or when it is folded for privacy
-- (folded: true) against the company total of the same range.
CREATE OR REPLACE FUNCTION public.hr_team_drilldown(p_team_id UUID, p_range TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID;
  v_role       TEXT := auth.jwt() -> 'app_metadata' ->> 'role';
  v_is_super   BOOLEAN := public.is_superadmin();
  v_uid        UUID := auth.uid();
  v_days       INT  := CASE p_range WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END;
  v_start      DATE := current_date - v_days;
  v_floor      INT;
  v_team       RECORD;
  v_size       INT := 0;
  v_respondents INT := 0;
  v_keys       TEXT[];
  v_team_json  JSONB;
  v_result     JSONB;
BEGIN
  IF v_company_id IS NULL AND v_uid IS NOT NULL THEN
    SELECT company_id, role
      INTO v_company_id, v_role
      FROM public.profiles
     WHERE id = v_uid;
  END IF;

  IF v_is_super THEN
    v_role := 'company_admin';
  END IF;

  IF v_company_id IS NULL OR v_role NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, department
    INTO v_team
    FROM public.teams
   WHERE id = p_team_id
     AND company_id = v_company_id;

  IF v_team.id IS NULL THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = '42P01';
  END IF;

  v_floor := public.hr_min_cohort(v_company_id);
  v_team_json := jsonb_build_object('id', v_team.id, 'name', v_team.name, 'department', v_team.department);

  SELECT COUNT(*) INTO v_size
    FROM public.profiles
   WHERE team_id = p_team_id
     AND deleted_at IS NULL;

  SELECT COUNT(DISTINCT c.user_id) INTO v_respondents
    FROM public.checkins c
    JOIN public.profiles p ON p.id = c.user_id
   WHERE p.team_id = p_team_id
     AND c.company_id = v_company_id
     AND c.checked_at >= v_start;

  SELECT public.cohort_shown_keys(COALESCE(jsonb_agg(jsonb_build_object(
           'key', COALESCE(g.team_id::text, 'none'), 'size', g.n, 'showable', g.team_id IS NOT NULL)), '[]'::jsonb),
         v_floor)
    INTO v_keys
    FROM (SELECT p.team_id, COUNT(DISTINCT c.user_id)::int AS n
            FROM public.checkins c
            JOIN public.profiles p ON p.id = c.user_id
           WHERE c.company_id = v_company_id AND c.checked_at >= v_start
           GROUP BY p.team_id) g;

  IF v_respondents < v_floor OR NOT (p_team_id::text = ANY (COALESCE(v_keys, '{}'))) THEN
    RETURN jsonb_build_object(
      'team', v_team_json,
      'suppressed', true,
      'folded', v_respondents >= v_floor,
      'size', v_size,
      'group_size', v_respondents,
      'min_cohort', v_floor,
      'range', p_range
    );
  END IF;

  SELECT jsonb_build_object(
    'team',       v_team_json,
    'suppressed', false,
    'folded',     false,
    'size',       v_size,
    'group_size', v_respondents,
    'min_cohort', v_floor,
    'range',      p_range,
    'avg_mood',   round(avg(c.mood)::numeric, 1),
    'avg_stress', round(avg(c.stress)::numeric, 1),
    'avg_sleep',  round(avg(c.sleep)::numeric, 1),
    'avg_energy', round(avg(c.energy)::numeric, 1)
  )
    INTO v_result
    FROM public.checkins c
    JOIN public.profiles p ON p.id = c.user_id
   WHERE p.team_id = p_team_id
     AND c.company_id = v_company_id
     AND c.checked_at >= v_start;

  RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 8. Fixes
-- ═══════════════════════════════════════════════════════════════

-- (a) The app's default weekly habit pauses for anyone with a routine
-- running for them that day (a company-wide one pauses it for everyone; a
-- team's own pauses it for that team). HR's own challenges are unaffected;
-- the manual switch (weekly_habit_enabled) still turns the default off.
CREATE OR REPLACE FUNCTION public.default_habit_paused(p_company_id UUID, p_team_id UUID, p_day DATE)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.routine_assignments_for(p_company_id, p_team_id, p_day));
$$;

CREATE OR REPLACE FUNCTION public.my_habit_challenge()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  v_today   DATE;
  c         public.challenges%ROWTYPE;
  v_status  TEXT;
  v_target  DATE;
  v_days    DATE[];
  v_elapsed INT;
  v_members INT;
  v_logs    INT;
  v_dates   JSONB;
  v_ended   RECORD;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT team_id INTO v_team FROM public.profiles WHERE id = v_uid;
  v_today := public.company_today(v_company);

  -- No challenge picked for this week? Put in the default one (HR can still
  -- swap it before anyone logs a day, or cancel an upcoming one).
  PERFORM public.ensure_default_habit_week(v_company);

  -- Settle any finished week for this company first (gives out rewards).
  FOR v_ended IN
    SELECT id FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit'
       AND COALESCE(payload ->> 'finalized', 'false') <> 'true'
       AND end_date < v_today
  LOOP
    PERFORM public.finalize_habit_challenge(v_ended.id);
  END LOOP;

  -- The default (auto) week gives way while a routine runs for the caller.
  SELECT * INTO c FROM public.challenges
   WHERE company_id = v_company AND kind = 'habit' AND active
     AND (team_id IS NULL OR team_id = v_team)
     AND start_date <= v_today
     AND end_date + CASE WHEN payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= v_today
     AND NOT (COALESCE(payload ->> 'auto', 'false') = 'true'
              AND public.default_habit_paused(v_company, v_team, v_today))
   ORDER BY start_date DESC LIMIT 1;

  IF c.id IS NOT NULL THEN
    v_status := 'active';
  ELSE
    SELECT * INTO c FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit' AND active
       AND (team_id IS NULL OR team_id = v_team)
       AND start_date > v_today
       AND NOT (COALESCE(payload ->> 'auto', 'false') = 'true'
                AND public.default_habit_paused(v_company, v_team, start_date))
     ORDER BY start_date LIMIT 1;
    IF c.id IS NULL THEN RETURN jsonb_build_object('status', 'none'); END IF;
    v_status := 'upcoming';
  END IF;

  v_target  := public.habit_target_date(c.payload, v_today);
  v_days    := public.habit_workdays(c.start_date, c.end_date);
  v_elapsed := (SELECT count(*)::int FROM unnest(v_days) d WHERE d <= v_target);
  v_members := public.habit_members(v_company, c.team_id);

  SELECT COALESCE(jsonb_agg(log_date ORDER BY log_date), '[]'::jsonb) INTO v_dates
    FROM public.habit_logs WHERE challenge_id = c.id AND user_id = v_uid;
  SELECT COUNT(*) INTO v_logs FROM public.habit_logs
   WHERE challenge_id = c.id AND log_date <= LEAST(v_target, c.end_date);

  RETURN jsonb_build_object(
    'status',       v_status,
    'challenge',    jsonb_build_object(
                      'id', c.id, 'title_en', c.title_en, 'title_ar', c.title_ar,
                      'start_date', c.start_date, 'end_date', c.end_date,
                      'team_id', c.team_id, 'payload', c.payload),
    'target_date',  v_target,
    'can_log',      v_status = 'active' AND v_target BETWEEN c.start_date AND c.end_date
                    AND EXTRACT(DOW FROM v_target) < 5,
    'logged_target', v_dates @> to_jsonb(v_target),
    'my_dates',     v_dates,
    'my_count',     jsonb_array_length(v_dates),
    'success_days', COALESCE((c.payload ->> 'success_days')::INT, 4),
    'days_total',   cardinality(v_days),
    'days',         to_jsonb(v_days),
    'weeks',        public.habit_weeks(c.payload),
    'elapsed',      v_elapsed,
    -- Shared progress only when the group is big enough to stay anonymous.
    'team_pct',     CASE WHEN v_members >= public.hr_min_cohort(v_company) AND v_elapsed > 0
                         THEN round(100.0 * v_logs / (v_members * v_elapsed)) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_habit(p_challenge_id UUID, p_done BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  c         public.challenges%ROWTYPE;
  v_target  DATE;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT team_id INTO v_team FROM public.profiles WHERE id = v_uid;
  SELECT * INTO c FROM public.challenges
   WHERE id = p_challenge_id AND kind = 'habit' AND active
     AND company_id = v_company AND (team_id IS NULL OR team_id = v_team);
  IF c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002'; END IF;
  -- A paused default week can't be logged (it isn't shown either).
  IF COALESCE(c.payload ->> 'auto', 'false') = 'true'
     AND public.default_habit_paused(v_company, v_team, public.company_today(v_company)) THEN
    RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_target := public.habit_target_date(c.payload, public.company_today(v_company));
  IF v_target < c.start_date OR v_target > c.end_date THEN
    RAISE EXCEPTION 'outside_challenge_window' USING ERRCODE = '22023';
  END IF;
  IF EXTRACT(DOW FROM v_target) >= 5 THEN
    RAISE EXCEPTION 'not_a_workday' USING ERRCODE = '22023';
  END IF;

  IF p_done THEN
    INSERT INTO public.habit_logs (challenge_id, user_id, company_id, log_date)
    VALUES (c.id, v_uid, v_company, v_target)
    ON CONFLICT (challenge_id, user_id, log_date) DO NOTHING;
    INSERT INTO public.challenge_participants (challenge_id, user_id, company_id)
    VALUES (c.id, v_uid, v_company)
    ON CONFLICT (challenge_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.habit_logs
     WHERE challenge_id = c.id AND user_id = v_uid AND log_date = v_target;
  END IF;

  RETURN public.my_habit_challenge();
END;
$$;

-- HR list: a default (auto) week shows status 'paused' while a
-- company-wide routine runs (for a team-only routine it stays 'active':
-- only that team's members don't see it).
CREATE OR REPLACE FUNCTION public.hr_habit_challenges()
RETURNS TABLE (
  id UUID, title_en TEXT, title_ar TEXT, template_id UUID, team_id UUID, team_name TEXT,
  start_date DATE, end_date DATE, status TEXT,
  members INT, participants INT, completed INT, completion_pct NUMERIC, auto BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_company UUID := public.auth_company_id();
  v_floor   INT;
  v_today   DATE;
  r         RECORD;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_floor := public.hr_min_cohort(v_company);
  v_today := public.company_today(v_company);
  PERFORM public.ensure_default_habit_week(v_company);

  FOR r IN SELECT c.id FROM public.challenges c
            WHERE c.company_id = v_company AND c.kind = 'habit'
              AND COALESCE(c.payload ->> 'finalized', 'false') <> 'true' AND c.end_date < v_today
  LOOP
    PERFORM public.finalize_habit_challenge(r.id);
  END LOOP;

  RETURN QUERY
  WITH base AS (
    SELECT c.*, public.habit_members(v_company, c.team_id) AS n_members,
           COALESCE((c.payload ->> 'success_days')::INT, 4) AS need,
           COALESCE(c.payload ->> 'auto', 'false') = 'true' AS is_auto
      FROM public.challenges c
     WHERE c.company_id = v_company AND c.kind = 'habit'
  ), per_user AS (
    SELECT l.challenge_id, l.user_id, COUNT(*) AS days
      FROM public.habit_logs l JOIN base b ON b.id = l.challenge_id
     GROUP BY l.challenge_id, l.user_id
  )
  SELECT b.id, b.title_en, b.title_ar, b.template_id, b.team_id, COALESCE(tm.name, b.payload ->> 'team_name'),
         b.start_date, b.end_date,
         CASE WHEN NOT b.active THEN 'cancelled'
              WHEN b.start_date > v_today THEN
                CASE WHEN b.is_auto AND public.default_habit_paused(v_company, NULL, b.start_date)
                     THEN 'paused' ELSE 'upcoming' END
              WHEN b.end_date + CASE WHEN b.payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= v_today THEN
                CASE WHEN b.is_auto AND public.default_habit_paused(v_company, NULL, v_today)
                     THEN 'paused' ELSE 'active' END
              ELSE 'done' END,
         b.n_members,
         (SELECT COUNT(*)::INT FROM per_user p WHERE p.challenge_id = b.id),
         (SELECT COUNT(*)::INT FROM per_user p WHERE p.challenge_id = b.id AND p.days >= b.need),
         CASE WHEN b.n_members >= v_floor
              THEN round(100.0 * (SELECT COUNT(*) FROM per_user p WHERE p.challenge_id = b.id AND p.days >= b.need) / b.n_members)
         END,
         b.is_auto
    FROM base b LEFT JOIN public.teams tm ON tm.id = b.team_id
   ORDER BY b.start_date DESC;
END;
$$;

-- (b) The caller's Sun–Thu week, as before, with each item's exercise
-- (name, sets, body areas, media fields — same shape as my_today) and
-- notes, so the week view can play the videos.
CREATE OR REPLACE FUNCTION public.my_routine_week(p_week_start DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_company  UUID := public.auth_company_id();
  v_team     UUID;
  v_today    DATE;
  v_week     DATE;
  v_days     JSONB;
  v_routines JSONB;
  v_totals   JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT p.team_id INTO v_team FROM public.profiles p WHERE p.id = v_uid;
  v_today := public.company_today(v_company);
  v_week := COALESCE(p_week_start, v_today);
  v_week := v_week - EXTRACT(DOW FROM v_week)::int;

  WITH cal AS (
    SELECT (v_week + g)::date AS day FROM generate_series(0, 4) g
  ), due AS (
    SELECT cal.day, d.item_id FROM cal
     CROSS JOIN LATERAL public.routine_due_items(v_company, v_team, cal.day) d
  ), it AS (
    SELECT due.day, i.id, i.routine_id, i.at_time, i.sort_order, i.exercise_id, i.note_en, i.note_ar,
           COALESCE(nullif(btrim(i.title_en), ''), e.name_en) AS title_en,
           COALESCE(nullif(btrim(i.title_ar), ''), e.name_ar, nullif(btrim(i.title_en), ''), e.name_en) AS title_ar,
           COALESCE(i.sets_reps, e.default_sets_reps) AS sets_reps,
           COALESCE(i.sets_reps_ar, e.default_sets_reps_ar, i.sets_reps, e.default_sets_reps) AS sets_reps_ar,
           c.id IS NOT NULL AS checked,
           CASE WHEN e.id IS NULL THEN NULL
                ELSE to_jsonb(e) - ARRAY['created_by', 'copied_from', 'created_at', 'updated_at'] END AS ex
      FROM due
      JOIN public.routine_items i ON i.id = due.item_id
      LEFT JOIN public.exercises e ON e.id = i.exercise_id
      LEFT JOIN public.routine_checks c
        ON c.item_id = i.id AND c.user_id = v_uid AND c.check_date = due.day
  )
  SELECT jsonb_agg(jsonb_build_object(
           'date',      cal.day,
           'weekday',   EXTRACT(DOW FROM cal.day)::int,
           'is_today',  cal.day = v_today,
           'is_past',   cal.day < v_today,
           'is_future', cal.day > v_today,
           'due',       (SELECT count(*) FROM it WHERE it.day = cal.day),
           'done',      (SELECT count(*) FROM it WHERE it.day = cal.day AND it.checked),
           'all_done',  (SELECT count(*) > 0 AND bool_and(it.checked) FROM it WHERE it.day = cal.day),
           'day_title', (SELECT r.day_titles -> (EXTRACT(DOW FROM cal.day)::int)::text
                           FROM public.routine_assignments_for(v_company, v_team, cal.day) a
                           JOIN public.routines r ON r.id = a.routine_id
                          WHERE r.day_titles ? (EXTRACT(DOW FROM cal.day)::int)::text
                          ORDER BY r.title_en LIMIT 1),
           'items',     (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                  'id',           it.id,
                                  'routine_id',   it.routine_id,
                                  'exercise_id',  it.exercise_id,
                                  'at_time',      to_char(it.at_time, 'HH24:MI'),
                                  'title_en',     it.title_en,
                                  'title_ar',     it.title_ar,
                                  'sets_reps',    it.sets_reps,
                                  'sets_reps_ar', it.sets_reps_ar,
                                  'note_en',      it.note_en,
                                  'note_ar',      it.note_ar,
                                  'checked',      it.checked,
                                  'exercise',     it.ex)
                                ORDER BY it.at_time NULLS LAST, it.sort_order, it.title_en), '[]'::jsonb)
                           FROM it WHERE it.day = cal.day))
         ORDER BY cal.day),
         jsonb_build_object(
           'due',           (SELECT count(*) FROM it),
           'done',          (SELECT count(*) FROM it WHERE it.checked),
           'all_done_days', (SELECT count(*) FROM public.routine_days rd
                              WHERE rd.user_id = v_uid AND rd.all_done
                                AND rd.day BETWEEN v_week AND v_week + 4))
    INTO v_days, v_totals
    FROM cal;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'title_en', r.title_en, 'title_ar', r.title_ar,
           'note_en', r.note_en, 'note_ar', r.note_ar, 'day_titles', r.day_titles,
           'source_file_bucket', r.source_file_bucket, 'source_file_path', r.source_file_path,
           'source_file_mime', r.source_file_mime)
         ORDER BY r.title_en), '[]'::jsonb)
    INTO v_routines
    FROM public.routines r
   WHERE r.id IN (SELECT a.routine_id FROM generate_series(0, 4) g
                   CROSS JOIN LATERAL public.routine_assignments_for(v_company, v_team, (v_week + g)::date) a);

  RETURN jsonb_build_object(
    'week_start', v_week,
    'today',      v_today,
    'days',       COALESCE(v_days, '[]'::jsonb),
    'totals',     v_totals,
    'routines',   v_routines);
END;
$$;

-- (c) HR's own habit challenge: as before, but title_ar follows the same
-- rule as every other optional field — a key sent as '' or null clears
-- it, a key left out keeps it (it was kept forever before). New templates
-- no longer copy the English title into title_ar.
CREATE OR REPLACE FUNCTION public.hr_save_challenge_template(p_input JSONB)
RETURNS public.challenge_templates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_id      UUID;
  v_old     public.challenge_templates%ROWTYPE;
  v_row     public.challenge_templates%ROWTYPE;
  v_p       JSONB;
  v_clean   JSONB;
  v_weeks   INT;
  v_need    INT;
  v_cat     TEXT;
  v_badge   JSONB;
  v_type    TEXT;
  v_title   TEXT;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_id := nullif(p_input ->> 'id', '')::uuid;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.challenge_templates WHERE id = v_id FOR UPDATE;
    IF v_old.id IS NULL THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
    IF v_old.company_id IS NULL THEN RAISE EXCEPTION 'public_item_read_only' USING ERRCODE = '42501'; END IF;
    IF v_old.company_id <> v_company THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;
  END IF;

  v_title := COALESCE(public.jtxt(p_input, 'title_en'), v_old.title_en);
  IF v_title IS NULL THEN RAISE EXCEPTION 'title_required' USING ERRCODE = '22023'; END IF;
  IF length(v_title) > 80 THEN RAISE EXCEPTION 'title_too_long' USING ERRCODE = '22023'; END IF;
  IF length(COALESCE(public.jtxt(p_input, 'title_ar'), '')) > 80 THEN
    RAISE EXCEPTION 'title_too_long' USING ERRCODE = '22023';
  END IF;

  v_p := COALESCE(v_old.payload, '{}'::jsonb)
         || CASE WHEN jsonb_typeof(p_input -> 'payload') = 'object' THEN p_input -> 'payload' ELSE '{}'::jsonb END;
  IF public.jtxt(v_p, 'action_en') IS NULL THEN RAISE EXCEPTION 'action_required' USING ERRCODE = '22023'; END IF;

  v_weeks := COALESCE(nullif(p_input ->> 'weeks', '')::int, nullif(v_p ->> 'weeks', '')::int, 1);
  IF v_weeks NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'bad_weeks' USING ERRCODE = '22023'; END IF;
  v_need := COALESCE(nullif(p_input ->> 'success_days', '')::int,
                     CASE WHEN p_input ? 'weeks' THEN NULL ELSE nullif(v_p ->> 'success_days', '')::int END,
                     ceil(0.8 * v_weeks * 5)::int);
  IF v_need NOT BETWEEN 1 AND v_weeks * 5 THEN RAISE EXCEPTION 'bad_success_days' USING ERRCODE = '22023'; END IF;

  IF COALESCE(public.jtxt(v_p, 'check_mode'), 'same_day') NOT IN ('same_day', 'next_morning') THEN
    RAISE EXCEPTION 'bad_check_mode' USING ERRCODE = '22023';
  END IF;
  v_cat := public.jtxt(v_p, 'category');
  IF v_cat IS NOT NULL AND v_cat NOT IN ('movement', 'sleep', 'mood', 'hydration', 'stress') THEN
    RAISE EXCEPTION 'bad_category' USING ERRCODE = '22023';
  END IF;
  v_badge := CASE v_cat
    WHEN 'movement'  THEN '{"badge_icon": "activity", "badge_color": "#8BBF7A"}'
    WHEN 'sleep'     THEN '{"badge_icon": "moon",     "badge_color": "#9C8BD9"}'
    WHEN 'mood'      THEN '{"badge_icon": "smile",    "badge_color": "#E39A7B"}'
    WHEN 'hydration' THEN '{"badge_icon": "drop",     "badge_color": "#6FB7D9"}'
    WHEN 'stress'    THEN '{"badge_icon": "wind",     "badge_color": "#C9A15B"}'
    ELSE '{"badge_icon": "trophy", "badge_color": "#F5B544"}' END::jsonb;

  v_type := public.jtxt(v_p, 'media_type');
  PERFORM public.check_media(v_company, v_type, public.jtxt(v_p, 'media_bucket'), public.jtxt(v_p, 'media_path'),
                             public.jtxt(v_p, 'media_mime'), public.jtxt(v_p, 'media_youtube_id'));

  -- Only the keys the app reads; media keys only for the media type chosen.
  SELECT COALESCE(jsonb_object_agg(k, v_p -> k), '{}'::jsonb) INTO v_clean
    FROM unnest(ARRAY['category', 'action_en', 'action_ar', 'why_en', 'why_ar', 'tip_en', 'tip_ar',
                      'reminder_en', 'reminder_ar', 'reminder_time', 'missed_en', 'missed_ar',
                      'check_mode', 'article_slug']) k
   WHERE public.jtxt(v_p, k) IS NOT NULL;
  IF v_type = 'youtube' THEN
    v_clean := v_clean || jsonb_build_object('media_type', 'youtube', 'media_youtube_id', public.jtxt(v_p, 'media_youtube_id'));
  ELSIF v_type IN ('video', 'image') THEN
    v_clean := v_clean || jsonb_strip_nulls(jsonb_build_object(
      'media_type', v_type, 'media_bucket', public.jtxt(v_p, 'media_bucket'),
      'media_path', public.jtxt(v_p, 'media_path'), 'media_mime', public.jtxt(v_p, 'media_mime'),
      'media_url', CASE WHEN public.jtxt(v_p, 'media_bucket') = 'content-assets'
                        AND public.jtxt(v_p, 'media_url') ~ '^https://' THEN public.jtxt(v_p, 'media_url') END));
  END IF;
  v_clean := v_clean || v_badge || jsonb_build_object(
    'check_mode', COALESCE(public.jtxt(v_p, 'check_mode'), 'same_day'),
    'weeks', v_weeks, 'success_days', v_need, 'company_template', true);

  IF v_id IS NULL THEN
    INSERT INTO public.challenge_templates (slug, title_en, title_ar, kind, default_window_days, target,
                                            metric, payload, company_id, created_by)
    VALUES ('co-' || left(replace(v_company::text, '-', ''), 8) || '-' || public.slugify_text(v_title)
              || '-' || substr(md5(gen_random_uuid()::text), 1, 5),
            v_title, public.jtxt(p_input, 'title_ar'), 'habit', v_weeks * 5, v_need,
            'habit', v_clean, v_company, auth.uid())
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.challenge_templates SET
      title_en = v_title,
      title_ar = CASE WHEN p_input ? 'title_ar' THEN public.jtxt(p_input, 'title_ar') ELSE title_ar END,
      default_window_days = v_weeks * 5, target = v_need, payload = v_clean, updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;

-- (d) Bulk media for the routine import ("drop many videos, matched by
-- file name" — the app matches names, then calls this once). p_items:
-- [{id, media_type ('video' | 'image' | 'youtube' | null to clear),
-- media_bucket (default company-media), media_path, media_mime,
-- media_youtube_id, poster_path}], up to 200. Only the caller's company's
-- exercises; public ones are skipped (copy them first). p_overwrite false =
-- skip exercises that already have media. Returns {updated, skipped:
-- [{id, reason}]} — reasons are the usual codes (exercise_not_found,
-- public_item_read_only, has_media, duplicate, bad_media_mime,
-- media_path_outside_company, …).
CREATE OR REPLACE FUNCTION public.hr_set_exercises_media(p_items JSONB, p_overwrite BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  it        JSONB;
  v_id      UUID;
  v_ex      public.exercises%ROWTYPE;
  v_type    TEXT;
  v_bucket  TEXT;
  v_updated INT := 0;
  v_skipped JSONB := '[]'::jsonb;
  v_done    UUID[] := '{}';
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN RAISE EXCEPTION 'too_many_items' USING ERRCODE = '22023'; END IF;

  FOR it IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_id := CASE WHEN jsonb_typeof(it) = 'object' AND it ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 THEN (it ->> 'id')::uuid END;
    v_ex := NULL;
    IF v_id IS NOT NULL THEN
      SELECT * INTO v_ex FROM public.exercises WHERE id = v_id FOR UPDATE;
    END IF;
    IF v_ex.id IS NULL OR (v_ex.company_id IS NOT NULL AND v_ex.company_id <> v_company) THEN
      v_skipped := v_skipped || jsonb_build_object('id', it -> 'id', 'reason', 'exercise_not_found');
      CONTINUE;
    END IF;
    IF v_ex.company_id IS NULL THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'public_item_read_only');
      CONTINUE;
    END IF;
    IF v_id = ANY (v_done) THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'duplicate');
      CONTINUE;
    END IF;
    IF NOT COALESCE(p_overwrite, true) AND v_ex.media_type IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'has_media');
      CONTINUE;
    END IF;
    v_type := public.jtxt(it, 'media_type');
    v_bucket := CASE WHEN v_type IN ('video', 'image') THEN COALESCE(public.jtxt(it, 'media_bucket'), 'company-media') END;
    BEGIN
      PERFORM public.check_media(v_company, v_type, v_bucket, public.jtxt(it, 'media_path'),
                                 public.jtxt(it, 'media_mime'), public.jtxt(it, 'media_youtube_id'));
      IF v_type IN ('video', 'image') AND public.jtxt(it, 'poster_path') IS NOT NULL THEN
        PERFORM public.check_media_path(v_company, v_bucket, public.jtxt(it, 'poster_path'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', SQLERRM);
      CONTINUE;
    END;
    UPDATE public.exercises SET
      media_type       = v_type,
      media_bucket     = v_bucket,
      media_path       = CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(it, 'media_path') END,
      media_mime       = CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(it, 'media_mime') END,
      media_youtube_id = CASE WHEN v_type = 'youtube' THEN public.jtxt(it, 'media_youtube_id') END,
      poster_path      = CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(it, 'poster_path') END,
      updated_at       = now()
    WHERE id = v_id;
    v_updated := v_updated + 1;
    v_done := v_done || v_id;
  END LOOP;
  RETURN jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 9. Grants
-- ═══════════════════════════════════════════════════════════════

-- Internal: the minute job, the edge function (service role) and other
-- SECURITY DEFINER functions only.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN (
                'quiet_hours_on', 'broadcast_deliver_at', 'broadcast_json', 'deliver_broadcast',
                'send_due_broadcasts', 'due_routine_reminders', 'due_broadcast_pushes',
                'record_push_results', 'cron_minute_tick', 'person_is_protected',
                'cohort_shown_keys', 'default_habit_paused')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- RPCs: signed-in only; each checks the caller inside. (Functions replaced
-- above keep the grants they had.)
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN (
                'save_push_subscription', 'delete_push_subscription',
                'hr_save_broadcast', 'hr_cancel_broadcast', 'hr_list_broadcasts', 'broadcast_media',
                'hr_list_teams', 'hr_create_team', 'hr_rename_team', 'hr_delete_team',
                'hr_move_to_team', 'hr_set_team_lead', 'hr_set_exercises_media')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Checks after running:
--   SELECT jobname, schedule, command, active FROM cron.job WHERE jobname = 'wellness-minute-tick';
--     → one row, '* * * * *', SELECT public.cron_minute_tick()
--   SELECT public.cron_minute_tick();
--     → {"push": "not_configured", ...} until the after-deploy snippet ran
--   SELECT allowed_mime_types FROM storage.buckets WHERE id = 'company-media';
--     → includes audio/mpeg, audio/mp4, audio/x-m4a, audio/webm, audio/ogg

COMMIT;
NOTIFY pgrst, 'reload schema';

-- Done if this returns one row with all four = true.
SELECT
  to_regclass('public.push_subscriptions') IS NOT NULL                                 AS push_ready,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_due_broadcasts')                  AS broadcasts_ready,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hr_create_team' OR proname LIKE 'hr_%team%') AS teams_ready,
  EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wellness-minute-tick')               AS job_ready;
