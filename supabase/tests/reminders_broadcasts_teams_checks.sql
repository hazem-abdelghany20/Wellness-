-- Behaviour checks for 20261111000001_reminders_broadcasts_teams.sql.
-- LOCAL STACK ONLY (needs seed.sql + supabase/demo_seed_routines.sql). One
-- transaction, rolled back at the end: the database is left as it was.
--
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -q -f supabase/tests/reminders_broadcasts_teams_checks.sql | grep -E '^(PASS|FAIL)'
--
-- Same harness as routines_and_libraries_checks.sql: calls run as the real
-- `authenticated` role with a JWT for the user; the clock is pinned with
-- wellness.now (honoured for direct postgres sessions only).

\pset tuples_only on
\pset format unaligned
BEGIN;

CREATE FUNCTION pg_temp.chk(p_name TEXT, p_ok BOOLEAN, p_detail TEXT DEFAULT NULL) RETURNS TEXT
LANGUAGE sql AS $$
  SELECT CASE WHEN COALESCE(p_ok, false) THEN 'PASS ' ELSE 'FAIL ' END || p_name
         || CASE WHEN COALESCE(p_ok, false) OR p_detail IS NULL THEN '' ELSE ' — ' || p_detail END;
$$;

CREATE FUNCTION pg_temp.err(p_name TEXT, p_sql TEXT, p_err TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE p_err THEN RETURN 'PASS ' || p_name; END IF;
    RETURN 'FAIL ' || p_name || ' — got: ' || SQLERRM;
  END;
  RETURN 'FAIL ' || p_name || ' — no error';
END;
$$;

CREATE FUNCTION pg_temp.act(p_uid UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    CASE WHEN p_uid IS NULL THEN '' ELSE json_build_object('sub', p_uid, 'role', 'authenticated')::text END, true);
END;
$$;

CREATE FUNCTION pg_temp.uid(p_email TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM auth.users WHERE email = p_email;
$$;

CREATE FUNCTION pg_temp.mk_user(p_email TEXT, p_code TEXT, p_name TEXT, p_role TEXT DEFAULT 'employee',
                                p_team UUID DEFAULT NULL) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE v UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          crypt('Check-Local-1!', gen_salt('bf')), now(), '{"provider":"email"}',
          jsonb_build_object('company_code', p_code, 'display_name', p_name), now(), now(), '', '', '', '');
  UPDATE public.profiles SET role = p_role, team_id = p_team, onboarded = true, display_name = p_name WHERE id = v;
  RETURN v;
END;
$$;

-- A push device for a user (direct insert as postgres; endpoint is fake).
CREATE FUNCTION pg_temp.mk_sub(p_uid UUID, p_tag TEXT, p_lang TEXT DEFAULT NULL) RETURNS UUID
LANGUAGE sql AS $$
  INSERT INTO public.push_subscriptions (user_id, company_id, endpoint, p256dh, auth, lang)
  SELECT p_uid, company_id, 'https://push.example.test/' || p_tag,
         'BAx' || repeat('a', 84), 'auth' || repeat('b', 18), p_lang
    FROM public.profiles WHERE id = p_uid
  RETURNING id;
$$;

-- ── fixtures ─────────────────────────────────────────────────
-- Wellhouse in Cairo time; Monday 9 Nov 2026, 10:30 Cairo (08:30 UTC).
-- "Neck tilt" (item …0022-…02) is a Desk Day item at 10:30, every workday.
UPDATE public.companies SET settings = settings || '{"timezone": "Africa/Cairo"}'
 WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT set_config('wellness.now', '2026-11-09 08:30:00+00', true);
-- Leftovers from manual runs on this stack must not leak into the counts.
DELETE FROM public.push_subscriptions WHERE true;
DELETE FROM public.reminder_log WHERE true;

SELECT set_config('t.wh',    '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('t.ng',    '00000000-0000-0000-0000-000000000002', true);
SELECT set_config('t.eng',   '00000000-0000-0000-0001-000000000001', true);
SELECT set_config('t.fin',   '00000000-0000-0000-0001-000000000002', true);
SELECT set_config('t.pno',   '00000000-0000-0000-0001-000000000003', true);
SELECT set_config('t.neck',  '00000000-0000-0000-0022-000000000002', true);
SELECT set_config('t.amira', pg_temp.uid('amira.hassan@demo.wellhouse.test')::text, true);
SELECT set_config('t.omar',  pg_temp.uid('omar.sami@demo.wellhouse.test')::text, true);
SELECT set_config('t.lina',  pg_temp.uid('lina.farouk@demo.wellhouse.test')::text, true);
SELECT set_config('t.nadia', pg_temp.uid('nadia.kamel@demo.wellhouse.test')::text, true);
SELECT set_config('t.sara',  pg_temp.uid('sara.hr@demo.wellhouse.test')::text, true);
SELECT set_config('t.ngemp', pg_temp.mk_user('nile.emp@check.local',  'NG-9130', 'Nile Employee')::text, true);
SELECT set_config('t.ngemp2', pg_temp.mk_user('nile.emp2@check.local', 'NG-9130', 'Nile Two')::text, true);
SELECT set_config('t.nghr',  pg_temp.mk_user('nile.hr@check.local',   'NG-9130', 'Nile HR', 'hr_admin')::text, true);
-- Reminder people, all in Engineering, no ticks yet.
SELECT set_config('t.r1', pg_temp.mk_user('rem1@check.local', 'WH-4782', 'Rem One',   'employee', '00000000-0000-0000-0001-000000000001')::text, true);
SELECT set_config('t.r2', pg_temp.mk_user('rem2@check.local', 'WH-4782', 'Rem Two',   'employee', '00000000-0000-0000-0001-000000000001')::text, true);
SELECT set_config('t.r3', pg_temp.mk_user('rem3@check.local', 'WH-4782', 'Rem Three', 'employee', '00000000-0000-0000-0001-000000000001')::text, true);
SELECT set_config('t.r4', pg_temp.mk_user('rem4@check.local', 'WH-4782', 'Rem Four',  'employee', '00000000-0000-0000-0001-000000000001')::text, true);
SELECT set_config('t.r5', pg_temp.mk_user('rem5@check.local', 'WH-4782', 'Rem Five',  'employee', '00000000-0000-0000-0001-000000000001')::text, true);
SELECT set_config('t.r6', pg_temp.mk_user('rem6@check.local', 'WH-4782', 'Rem Six',   'employee', '00000000-0000-0000-0001-000000000001')::text, true);
UPDATE public.profiles SET onboarded = false WHERE id = current_setting('t.r6')::uuid;
INSERT INTO public.profile_prefs (user_id, routine_reminders, muted_item_ids) VALUES
  (current_setting('t.r1')::uuid, true,  '{}'),
  (current_setting('t.r2')::uuid, true,  ARRAY[current_setting('t.neck')::uuid]),
  (current_setting('t.r3')::uuid, true,  '{}'),
  (current_setting('t.r4')::uuid, false, '{}'),
  (current_setting('t.r5')::uuid, true,  '{}'),
  (current_setting('t.r6')::uuid, true,  '{}');
SELECT set_config('t.s1', pg_temp.mk_sub(current_setting('t.r1')::uuid, 'r1', 'ar')::text, true);
SELECT pg_temp.mk_sub(current_setting('t.r1')::uuid, 'r1-laptop');
SELECT pg_temp.mk_sub(current_setting('t.r2')::uuid, 'r2');
SELECT pg_temp.mk_sub(current_setting('t.r3')::uuid, 'r3');
SELECT pg_temp.mk_sub(current_setting('t.r4')::uuid, 'r4');
SELECT pg_temp.mk_sub(current_setting('t.r6')::uuid, 'r6');
-- r3 ticked Neck tilt already.
SELECT pg_temp.act(current_setting('t.r3')::uuid);
SET LOCAL ROLE authenticated;
SELECT (public.check_routine_item(current_setting('t.neck')::uuid) -> 'progress' ->> 'done') = '1' AS r3_ticked;
RESET ROLE;
SELECT pg_temp.act(NULL);

-- ═══ 1. Grants ═══════════════════════════════════════════════
SELECT pg_temp.chk('grants: anon calls none of the new RPCs',
  NOT has_function_privilege('anon', 'public.save_push_subscription(jsonb)', 'execute')
  AND NOT has_function_privilege('anon', 'public.hr_save_broadcast(jsonb)', 'execute')
  AND NOT has_function_privilege('anon', 'public.hr_create_team(text, text)', 'execute')
  AND NOT has_function_privilege('anon', 'public.broadcast_media(uuid[])', 'execute'));
SELECT pg_temp.chk('grants: app users can not call the push / cron internals',
  NOT has_function_privilege('authenticated', 'public.due_routine_reminders(timestamptz, integer, boolean)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.due_broadcast_pushes(timestamptz, boolean)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.record_push_results(jsonb)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.send_due_broadcasts()', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.deliver_broadcast(uuid)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.cron_minute_tick()', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.cohort_shown_keys(jsonb, integer)', 'execute'));
SELECT pg_temp.chk('grants: service role can call the push internals',
  has_function_privilege('service_role', 'public.due_routine_reminders(timestamptz, integer, boolean)', 'execute')
  AND has_function_privilege('service_role', 'public.record_push_results(jsonb)', 'execute'));
SELECT pg_temp.chk('grants: signed-in users can call the new RPCs',
  has_function_privilege('authenticated', 'public.save_push_subscription(jsonb)', 'execute')
  AND has_function_privilege('authenticated', 'public.hr_set_team_lead(uuid, boolean)', 'execute')
  AND has_function_privilege('authenticated', 'public.hr_set_exercises_media(jsonb, boolean)', 'execute'));
SELECT pg_temp.chk('cron: the per-minute job is scheduled',
  EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wellness-minute-tick' AND schedule = '* * * * *' AND active));
SELECT pg_temp.chk('storage: company-media takes the five audio types',
  (SELECT allowed_mime_types @> ARRAY['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg']
     FROM storage.buckets WHERE id = 'company-media'));

-- ═══ 2. Push subscriptions ═══════════════════════════════════
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('push: save a browser subscription (toJSON shape + lang)',
  (public.save_push_subscription('{"endpoint": "https://fcm.googleapis.com/fcm/send/abc123", "expirationTime": null,
     "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
              "auth": "tBHItJI5svbpez7KI4CCXg=="}, "lang": "ar", "user_agent": "Test"}') ->> 'lang') = 'ar');
SELECT pg_temp.chk('push: keys stored URL-safe without padding',
  EXISTS (SELECT 1 FROM public.push_subscriptions WHERE endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'
           AND p256dh !~ '=' AND auth = 'tBHItJI5svbpez7KI4CCXg'));
-- (Each check below reads in its own statement: a SELECT doesn't see what a
-- function called earlier in the same statement changed.)
SELECT pg_temp.chk('push: saving again keeps the language when none is sent',
  (public.save_push_subscription('{"endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
     "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", "auth": "tBHItJI5svbpez7KI4CCXg"}}') ->> 'lang') = 'ar');
SELECT pg_temp.chk('push: … and refreshes the same row', (SELECT count(*) FROM public.push_subscriptions WHERE endpoint = 'https://fcm.googleapis.com/fcm/send/abc123') = 1);
SELECT pg_temp.err('push: an http endpoint is refused',
  $q$SELECT public.save_push_subscription('{"endpoint": "http://evil.test/x", "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u", "auth": "tBHItJI5svbpez7KI4CCXg"}}')$q$,
  'invalid_subscription');
SELECT pg_temp.err('push: missing keys are refused',
  $q$SELECT public.save_push_subscription('{"endpoint": "https://fcm.googleapis.com/fcm/send/x"}')$q$, 'invalid_subscription');
SELECT pg_temp.err('push: no direct inserts', $q$INSERT INTO public.push_subscriptions (user_id, company_id, endpoint, p256dh, auth)
  VALUES (auth.uid(), public.auth_company_id(), 'https://x.test/1', repeat('a', 60), repeat('b', 20))$q$, '%permission denied%');
SELECT pg_temp.chk('push: I see my own subscription',
  (SELECT count(*) FROM public.push_subscriptions) = 1);
RESET ROLE;
SELECT pg_temp.act(current_setting('t.omar')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('push: another person sees none of it', (SELECT count(*) FROM public.push_subscriptions) = 0);
SELECT pg_temp.chk('push: can not delete someone else''s device',
  NOT public.delete_push_subscription('https://fcm.googleapis.com/fcm/send/abc123'));
-- Same browser, now signed in as Omar: the endpoint moves to him.
SELECT public.save_push_subscription('{"endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
  "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", "auth": "tBHItJI5svbpez7KI4CCXg"}}') IS NOT NULL AS moved;
SELECT pg_temp.chk('push: a browser re-saved by another account moves to that account',
  (SELECT count(*) FROM public.push_subscriptions) = 1);
SELECT pg_temp.chk('push: delete my own device', public.delete_push_subscription('https://fcm.googleapis.com/fcm/send/abc123'));
RESET ROLE;
SELECT pg_temp.act(current_setting('t.lina')::uuid);
SET LOCAL ROLE authenticated;
SELECT count(*) AS lina_saved FROM (
  SELECT public.save_push_subscription(jsonb_build_object('endpoint', 'https://push.example.test/lina/' || g,
           'keys', jsonb_build_object('p256dh', repeat('L', 87), 'auth', repeat('a', 22))))
    FROM generate_series(1, 12) g) x;
SELECT pg_temp.chk('push: keeps the 10 most recent devices per person',
  (SELECT count(*) FROM public.push_subscriptions) = 10);
RESET ROLE;
SELECT pg_temp.act(NULL);
DELETE FROM public.push_subscriptions WHERE user_id = current_setting('t.lina')::uuid;

-- ═══ 3. Routine reminders (pinned clock) ═════════════════════
CREATE TEMP TABLE _r ON COMMIT DROP AS SELECT * FROM public.due_routine_reminders('2026-11-09 08:30:00+00', 1, false);
SELECT pg_temp.chk('reminders: 10:30 Cairo → only r1 among the reminder people (r2 muted it, r3 ticked it, r4 has reminders off, r5 has no device, r6 not onboarded)',
  (SELECT array_agg(DISTINCT user_id) FROM _r WHERE user_id IN (
     current_setting('t.r1')::uuid, current_setting('t.r2')::uuid, current_setting('t.r3')::uuid,
     current_setting('t.r4')::uuid, current_setting('t.r5')::uuid, current_setting('t.r6')::uuid))
  = ARRAY[current_setting('t.r1')::uuid],
  (SELECT string_agg(user_id::text, ',') FROM _r));
SELECT pg_temp.chk('reminders: the row is the 10:30 item, with titles and both of r1''s devices',
  EXISTS (SELECT 1 FROM _r WHERE user_id = current_setting('t.r1')::uuid AND item_id = current_setting('t.neck')::uuid
           AND day = DATE '2026-11-09' AND at_time = '10:30' AND title_en = 'Neck tilt' AND title_ar IS NOT NULL
           AND jsonb_array_length(subscriptions) = 2 AND subscriptions @> '[{"lang": "ar"}]'));
SELECT pg_temp.chk('reminders: nobody else''s item at 10:30 (only the Neck tilt row)',
  NOT EXISTS (SELECT 1 FROM _r WHERE item_id <> current_setting('t.neck')::uuid));
SELECT pg_temp.chk('reminders: 10:31 with a 1-minute window → nothing',
  NOT EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-09 08:31:00+00', 1, false)));
SELECT pg_temp.chk('reminders: 10:32 with a 3-minute window still catches 10:30 (late cron tick)',
  EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-09 08:32:59+00', 3, false)
           WHERE user_id = current_setting('t.r1')::uuid));
SELECT pg_temp.chk('reminders: 10:29 → nothing yet',
  NOT EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-09 08:29:00+00', 1, false)));
SELECT pg_temp.chk('reminders: Friday 10:30 (not a workday) → nothing',
  NOT EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-13 08:30:00+00', 1, false)));
-- The company's own zone decides the minute: in Dubai (+4) 10:30 is 06:30 UTC.
UPDATE public.companies SET settings = settings || '{"timezone": "Asia/Dubai"}' WHERE id = current_setting('t.wh')::uuid;
SELECT pg_temp.chk('reminders: company time zone — 10:30 Dubai is 06:30 UTC, not 08:30',
  EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-09 06:30:00+00', 1, false)
           WHERE user_id = current_setting('t.r1')::uuid AND item_id = current_setting('t.neck')::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-09 08:30:00+00', 1, false)
                   WHERE item_id = current_setting('t.neck')::uuid));
UPDATE public.companies SET settings = settings || '{"timezone": "Africa/Cairo"}' WHERE id = current_setting('t.wh')::uuid;
SELECT pg_temp.chk('reminders: a peek (p_claim false) writes no log',
  NOT EXISTS (SELECT 1 FROM public.reminder_log));
SELECT pg_temp.chk('reminders: claim → r1 once',
  (SELECT count(*) FROM public.due_routine_reminders('2026-11-09 08:30:00+00', 1, true)
    WHERE user_id = current_setting('t.r1')::uuid) = 1);
SELECT pg_temp.chk('reminders: the claim is in reminder_log',
  EXISTS (SELECT 1 FROM public.reminder_log WHERE user_id = current_setting('t.r1')::uuid
           AND item_id = current_setting('t.neck')::uuid AND day = DATE '2026-11-09'));
SELECT pg_temp.chk('reminders: at most one per person per item per day (second run picks nothing)',
  NOT EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-09 08:31:30+00', 3, true)
               WHERE user_id = current_setting('t.r1')::uuid));
-- r1 ticks the 11:30 item early: no reminder for it at 11:30.
SELECT pg_temp.act(current_setting('t.r1')::uuid);
SET LOCAL ROLE authenticated;
SELECT (public.check_routine_item('00000000-0000-0000-0022-000000000003') ->> 'date') IS NOT NULL AS r1_ticked_1130;
RESET ROLE;
SELECT pg_temp.act(NULL);
SELECT pg_temp.chk('reminders: an item already ticked today is skipped',
  NOT EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-09 09:30:00+00', 1, false)
               WHERE user_id = current_setting('t.r1')::uuid));
-- The routine stops: no reminders.
UPDATE public.routine_assignments SET ends_on = DATE '2026-11-08' WHERE company_id = current_setting('t.wh')::uuid;
SELECT pg_temp.chk('reminders: no reminder once the routine assignment ended',
  NOT EXISTS (SELECT 1 FROM public.due_routine_reminders('2026-11-09 10:30:00+00', 1, false)));
UPDATE public.routine_assignments SET ends_on = NULL WHERE company_id = current_setting('t.wh')::uuid;

-- ═══ 4. Push results ═════════════════════════════════════════
SELECT set_config('t.s_gone', pg_temp.mk_sub(current_setting('t.r1')::uuid, 'gone')::text, true);
SELECT set_config('t.s_bad',  pg_temp.mk_sub(current_setting('t.r1')::uuid, 'bad')::text, true);
SELECT pg_temp.chk('results: summary counts',
  public.record_push_results(jsonb_build_array(
    jsonb_build_object('subscription_id', current_setting('t.s1'), 'ok', true, 'status', 201, 'kind', 'reminder',
                       'user_id', current_setting('t.r1'), 'item_id', current_setting('t.neck'), 'day', '2026-11-09'),
    jsonb_build_object('subscription_id', current_setting('t.s_gone'), 'ok', false, 'status', 410, 'kind', 'reminder',
                       'user_id', current_setting('t.r1'), 'item_id', current_setting('t.neck'), 'day', '2026-11-09'),
    jsonb_build_object('subscription_id', current_setting('t.s_bad'), 'ok', false, 'status', 500, 'error', 'boom',
                       'kind', 'reminder', 'user_id', current_setting('t.r1'), 'item_id', current_setting('t.neck'), 'day', '2026-11-09')))
  = '{"ok": 1, "failed": 2, "removed": 1}'::jsonb);
SELECT pg_temp.chk('results: a healthy device is marked ok, a 410 device is deleted, a 500 is counted',
  (SELECT last_ok_at IS NOT NULL AND failures = 0 FROM public.push_subscriptions WHERE id = current_setting('t.s1')::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE id = current_setting('t.s_gone')::uuid)
  AND (SELECT failures = 1 AND last_error LIKE '500%boom' FROM public.push_subscriptions WHERE id = current_setting('t.s_bad')::uuid));
SELECT pg_temp.chk('results: the reminder log counts devices reached / failed',
  (SELECT delivered = 1 AND failed = 2 FROM public.reminder_log
    WHERE user_id = current_setting('t.r1')::uuid AND item_id = current_setting('t.neck')::uuid));
SELECT public.record_push_results(jsonb_build_array(jsonb_build_object('subscription_id', current_setting('t.s_bad'), 'ok', false, 'status', 503)))
  FROM generate_series(1, 4);
SELECT pg_temp.chk('results: a device failing 5 times in a row is deleted',
  NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE id = current_setting('t.s_bad')::uuid));
SELECT pg_temp.chk('results: empty / junk input is harmless',
  public.record_push_results('[]') = '{"ok": 0, "failed": 0, "removed": 0}'::jsonb
  AND public.record_push_results('[{"subscription_id": "nope"}]') ->> 'failed' = '1');

-- ═══ 5. Broadcasts at the set time, quiet hours, audio ═══════
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('t.b_later', public.hr_save_broadcast(
  '{"title_en": "At noon", "body_en": "Lunch walk", "scheduled_at": "2026-11-09T12:00:00+02:00"}') ->> 'id', true);
SELECT pg_temp.chk('broadcast: scheduled for later stays scheduled, nobody notified yet',
  (SELECT status = 'scheduled' AND sent_at IS NULL FROM public.broadcasts WHERE id = current_setting('t.b_later')::uuid)
  AND (SELECT count(*) FROM public.notifications WHERE broadcast_id = current_setting('t.b_later')::uuid) = 0);
SELECT pg_temp.chk('broadcast: deliver_at = the time HR picked (inside 08:00–20:00)',
  (SELECT (x ->> 'deliver_at')::timestamptz = '2026-11-09 10:00:00+00'
     FROM jsonb_array_elements(public.hr_list_broadcasts()) x WHERE x ->> 'id' = current_setting('t.b_later')));
SELECT set_config('t.b_now', public.hr_save_broadcast(jsonb_build_object(
  'title_en', 'Now', 'title_ar', 'دلوقتي', 'body_en', 'Hello', 'scope', 'team', 'team_id', current_setting('t.fin'))) ->> 'id', true);
SELECT pg_temp.chk('broadcast: due now → delivered at once (Finance: 2 people), marked sent',
  (SELECT status = 'sent' AND recipients = 2 FROM public.broadcasts WHERE id = current_setting('t.b_now')::uuid));
SELECT pg_temp.err('broadcast: a sent one can not be edited',
  format($q$SELECT public.hr_save_broadcast('{"id": "%s", "title_en": "x"}')$q$, current_setting('t.b_now')), 'broadcast_not_editable');
SELECT pg_temp.err('broadcast: a sent one can not be cancelled',
  format($q$SELECT public.hr_cancel_broadcast('%s')$q$, current_setting('t.b_now')), 'broadcast_already_sent');
SELECT pg_temp.chk('broadcast: editing a scheduled one keeps its time',
  (public.hr_save_broadcast(jsonb_build_object('id', current_setting('t.b_later'), 'title_en', 'At noon!')) ->> 'scheduled_at')::timestamptz
  = '2026-11-09 10:00:00+00');
SELECT set_config('t.b_cancel', public.hr_save_broadcast(
  '{"title_en": "Cancel me", "body_en": "x", "scheduled_at": "2026-11-09T15:00:00+02:00"}') ->> 'id', true);
SELECT pg_temp.chk('broadcast: cancel before its time',
  (public.hr_cancel_broadcast(current_setting('t.b_cancel')::uuid) ->> 'status') = 'cancelled');
SELECT set_config('t.b_night', public.hr_save_broadcast(
  '{"title_en": "Night", "body_en": "x", "scheduled_at": "2026-11-09T21:00:00+02:00"}') ->> 'id', true);
SELECT pg_temp.chk('quiet hours: due 21:00 → deliver_at next day 08:00 Cairo',
  (SELECT (x ->> 'deliver_at')::timestamptz = '2026-11-10 06:00:00+00'
     FROM jsonb_array_elements(public.hr_list_broadcasts()) x WHERE x ->> 'id' = current_setting('t.b_night')));
-- Audio
SELECT pg_temp.chk('audio: a voice note in our folder, no text needed',
  (public.hr_save_broadcast(jsonb_build_object('title_en', 'Podcast', 'scheduled_at', '2026-11-09T16:00:00+02:00',
     'media_path', current_setting('t.wh') || '/broadcasts/ep1.mp3', 'media_mime', 'audio/mpeg', 'media_duration_s', 42.4))
   @> '{"has_audio": true, "media_type": "audio", "media_bucket": "company-media", "media_mime": "audio/mpeg", "media_duration_s": 42}'));
SELECT set_config('t.b_audio', (SELECT id::text FROM public.broadcasts WHERE title_en = 'Podcast'), true);
SELECT pg_temp.chk('audio: MediaRecorder''s "audio/webm;codecs=opus" is accepted as audio/webm',
  (public.hr_save_broadcast(jsonb_build_object('title_en', 'Rec', 'scheduled_at', '2026-11-09T16:00:00+02:00',
     'media_path', current_setting('t.wh') || '/broadcasts/r.webm', 'media_mime', 'audio/webm;codecs=opus')) ->> 'media_mime') = 'audio/webm');
SELECT pg_temp.err('audio: neither text nor audio → body_required',
  $q$SELECT public.hr_save_broadcast('{"title_en": "Empty"}')$q$, 'body_required');
SELECT pg_temp.err('audio: another company''s folder is refused',
  format($q$SELECT public.hr_save_broadcast('{"title_en": "x", "media_path": "%s/broadcasts/a.mp3", "media_mime": "audio/mpeg"}')$q$,
         current_setting('t.ng')), 'media_path_outside_company');
SELECT pg_temp.err('audio: a video is not an audio message',
  format($q$SELECT public.hr_save_broadcast('{"title_en": "x", "media_path": "%s/broadcasts/a.mp4", "media_mime": "video/mp4"}')$q$,
         current_setting('t.wh')), 'bad_media_mime');
SELECT pg_temp.err('broadcast: team scope needs a team of ours',
  format($q$SELECT public.hr_save_broadcast('{"title_en": "x", "body_en": "y", "scope": "team", "team_id": "%s"}')$q$,
         '00000000-0000-0000-0001-000000000004'), 'team_not_found');
SELECT pg_temp.err('broadcast: a bad time is refused',
  $q$SELECT public.hr_save_broadcast('{"title_en": "x", "body_en": "y", "scheduled_at": "tomorrow-ish"}')$q$, 'bad_scheduled_at');
RESET ROLE;
SELECT pg_temp.chk('broadcast: the team broadcast reached exactly the team',
  (SELECT array_agg(user_id ORDER BY user_id) FROM public.notifications WHERE broadcast_id = current_setting('t.b_now')::uuid)
  = (SELECT array_agg(id ORDER BY id) FROM public.profiles WHERE team_id = current_setting('t.fin')::uuid AND deleted_at IS NULL));

SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.err('broadcast: an employee can not schedule', $q$SELECT public.hr_save_broadcast('{"title_en": "x", "body_en": "y"}')$q$, 'not_authorized');
SELECT pg_temp.chk('broadcast: an employee still can not read unsent broadcasts',
  (SELECT count(*) FROM public.broadcasts) = 0);
RESET ROLE;
SELECT pg_temp.act(NULL);

-- The minute job at 11:59, 12:00, 15:01, 16:00, 21:05, next day 08:00.
SELECT set_config('wellness.now', '2026-11-09 09:59:00+00', true);
SELECT pg_temp.chk('job: 11:59 Cairo → the noon one not yet',
  public.send_due_broadcasts() = 0
  AND (SELECT status FROM public.broadcasts WHERE id = current_setting('t.b_later')::uuid) = 'scheduled');
SELECT set_config('wellness.now', '2026-11-09 10:00:30+00', true);
SELECT pg_temp.chk('job: 12:00 Cairo → one delivered', public.send_due_broadcasts() = 1);
SELECT pg_temp.chk('job: … to everyone in the company, marked sent',
  (SELECT status = 'sent' AND recipients = (SELECT count(*) FROM public.profiles
                                                 WHERE company_id = current_setting('t.wh')::uuid AND deleted_at IS NULL)
         FROM public.broadcasts WHERE id = current_setting('t.b_later')::uuid)
  AND (SELECT count(*) FROM public.notifications WHERE broadcast_id = current_setting('t.b_later')::uuid
         AND title_en = 'At noon!' AND kind = 'system' AND deep_link = 'notifications') > 5);
SELECT pg_temp.chk('job: a delivered broadcast is never delivered twice',
  public.send_due_broadcasts() = 0
  AND (SELECT count(*) FROM public.notifications WHERE broadcast_id = current_setting('t.b_later')::uuid)
      = (SELECT recipients FROM public.broadcasts WHERE id = current_setting('t.b_later')::uuid));
SELECT set_config('wellness.now', '2026-11-09 13:01:00+00', true);
SELECT public.send_due_broadcasts() AS delivered_at_1501;
SELECT pg_temp.chk('job: a cancelled broadcast never goes out',
  (SELECT status FROM public.broadcasts WHERE id = current_setting('t.b_cancel')::uuid) = 'cancelled'
  AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE broadcast_id = current_setting('t.b_cancel')::uuid));
SELECT set_config('wellness.now', '2026-11-09 14:00:30+00', true);
SELECT public.send_due_broadcasts() AS delivered_at_1600;
SELECT pg_temp.chk('job: the audio broadcast went out at 16:00',
  (SELECT status FROM public.broadcasts WHERE id = current_setting('t.b_audio')::uuid) = 'sent');
SELECT set_config('wellness.now', '2026-11-09 19:05:00+00', true);
SELECT pg_temp.chk('quiet hours: 21:05 Cairo → the 21:00 one waits',
  public.send_due_broadcasts() = 0
  AND (SELECT status FROM public.broadcasts WHERE id = current_setting('t.b_night')::uuid) = 'scheduled');
SELECT set_config('wellness.now', '2026-11-10 06:00:30+00', true);
SELECT pg_temp.chk('quiet hours: 08:00 next day → delivered', public.send_due_broadcasts() = 1);
SELECT pg_temp.chk('quiet hours: … and marked sent',
  (SELECT status FROM public.broadcasts WHERE id = current_setting('t.b_night')::uuid) = 'sent');
-- Quiet hours off: 21:00 means 21:00.
SELECT set_config('wellness.now', '2026-11-09 08:30:00+00', true);
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('settings: quiet_hours off saved',
  NOT (public.hr_set_company_settings('{"quiet_hours": false}') ->> 'quiet_hours')::boolean);
SELECT pg_temp.chk('settings: … and shown to the app', NOT (public.my_company_settings() ->> 'quiet_hours')::boolean
  AND public.my_company_settings() -> 'quiet_window' = '{"from": "20:00", "to": "08:00"}');
SELECT pg_temp.err('settings: quiet_hours must be true / false',
  $q$SELECT public.hr_set_company_settings('{"quiet_hours": "no"}')$q$, 'invalid_setting');
SELECT set_config('t.b_night2', public.hr_save_broadcast(
  '{"title_en": "Night 2", "body_en": "x", "scheduled_at": "2026-11-09T21:00:00+02:00"}') ->> 'id', true);
SELECT pg_temp.chk('quiet hours off: deliver_at stays 21:00',
  (SELECT (x ->> 'deliver_at')::timestamptz = '2026-11-09 19:00:00+00'
     FROM jsonb_array_elements(public.hr_list_broadcasts()) x WHERE x ->> 'id' = current_setting('t.b_night2')));
SELECT public.hr_set_company_settings('{"quiet_hours": true}') IS NOT NULL AS quiet_back_on;
RESET ROLE;
SELECT pg_temp.act(NULL);

-- Who may hear the audio.
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('audio: a recipient gets the file reference',
  public.broadcast_media(ARRAY[current_setting('t.b_audio')::uuid, current_setting('t.b_later')::uuid])
  @> jsonb_build_array(jsonb_build_object('broadcast_id', current_setting('t.b_audio'), 'media_type', 'audio',
                                          'media_path', current_setting('t.wh') || '/broadcasts/ep1.mp3', 'media_duration_s', 42))
  AND jsonb_array_length(public.broadcast_media(ARRAY[current_setting('t.b_audio')::uuid, current_setting('t.b_later')::uuid])) = 1);
SELECT pg_temp.chk('broadcast: the notification carries broadcast_id (for its audio)',
  EXISTS (SELECT 1 FROM public.notifications WHERE broadcast_id = current_setting('t.b_audio')::uuid AND user_id = auth.uid()));
RESET ROLE;
SELECT pg_temp.act(current_setting('t.ngemp')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('audio: another company''s employee gets nothing',
  public.broadcast_media(ARRAY[current_setting('t.b_audio')::uuid]) = '[]'::jsonb);
RESET ROLE;
SELECT pg_temp.act(NULL);

-- Push for delivered broadcasts.
SELECT set_config('wellness.now', '2026-11-09 14:01:00+00', true);
SELECT pg_temp.chk('push: broadcasts delivered in the last 30 minutes, one row per recipient with a device',
  EXISTS (SELECT 1 FROM public.due_broadcast_pushes('2026-11-09 14:01:00+00', false)
           WHERE broadcast_id = current_setting('t.b_audio')::uuid AND user_id = current_setting('t.r1')::uuid
             AND has_audio AND jsonb_array_length(subscriptions) >= 1)
  AND NOT EXISTS (SELECT 1 FROM public.due_broadcast_pushes('2026-11-09 14:01:00+00', false)
                   WHERE user_id = current_setting('t.amira')::uuid));
SELECT pg_temp.chk('push: an old delivery (> 30 min) is not pushed late',
  NOT EXISTS (SELECT 1 FROM public.due_broadcast_pushes('2026-11-09 15:00:00+00', false)
               WHERE broadcast_id = current_setting('t.b_audio')::uuid));
SELECT pg_temp.chk('push: claim the delivered broadcast',
  EXISTS (SELECT 1 FROM public.due_broadcast_pushes('2026-11-09 14:01:00+00', true) WHERE broadcast_id = current_setting('t.b_audio')::uuid));
SELECT pg_temp.chk('push: … only once',
  NOT EXISTS (SELECT 1 FROM public.due_broadcast_pushes('2026-11-09 14:01:00+00', true) WHERE broadcast_id = current_setting('t.b_audio')::uuid)
  AND (SELECT pushed_at IS NOT NULL FROM public.broadcasts WHERE id = current_setting('t.b_audio')::uuid));
SELECT public.record_push_results(jsonb_build_array(jsonb_build_object(
  'subscription_id', current_setting('t.s1'), 'ok', true, 'status', 201, 'kind', 'broadcast', 'broadcast_id', current_setting('t.b_audio'))));
SELECT pg_temp.chk('push: broadcast push counts recorded',
  (SELECT push_sent = 1 AND push_failed = 0 FROM public.broadcasts WHERE id = current_setting('t.b_audio')::uuid));

-- ═══ 6. The per-minute job and Vault ═════════════════════════
DELETE FROM vault.secrets WHERE name IN ('wellness_functions_url', 'wellness_cron_secret');
SELECT set_config('t.q0', (SELECT count(*) FROM net.http_request_queue)::text, true);
SELECT pg_temp.chk('cron: without the Vault secrets the job only delivers broadcasts — no request, no error',
  (public.cron_minute_tick() ->> 'push') = 'not_configured'
  AND (SELECT count(*) FROM net.http_request_queue) = current_setting('t.q0')::int);
SELECT vault.create_secret('https://example-ref.supabase.co/functions/v1', 'wellness_functions_url') IS NOT NULL AS url_secret;
SELECT pg_temp.chk('cron: one secret alone is still not configured',
  (public.cron_minute_tick() ->> 'push') = 'not_configured'
  AND (SELECT count(*) FROM net.http_request_queue) = current_setting('t.q0')::int);
SELECT vault.create_secret('a-long-local-test-secret-0123456789', 'wellness_cron_secret') IS NOT NULL AS cron_secret;
SELECT pg_temp.chk('cron: with both, it requests the push function', (public.cron_minute_tick() ->> 'push') = 'requested');
SELECT pg_temp.chk('cron: … a POST to …/send-reminders with x-cron-secret',
  EXISTS (SELECT 1 FROM net.http_request_queue
               WHERE url = 'https://example-ref.supabase.co/functions/v1/send-reminders' AND method = 'POST'
                 AND headers ->> 'x-cron-secret' = 'a-long-local-test-secret-0123456789'));
-- A broadcast due now is delivered by the job.
SELECT set_config('wellness.now', '2026-11-09 08:30:00+00', true);
INSERT INTO public.broadcasts (company_id, title_en, body_en, scheduled_at)
VALUES (current_setting('t.wh')::uuid, 'Direct row', 'x', '2026-11-09 08:29:00+00');
SELECT pg_temp.chk('cron: the job delivers a due broadcast', (public.cron_minute_tick() ->> 'broadcasts_delivered')::int = 1);
SELECT pg_temp.chk('cron: … marked sent', (SELECT status FROM public.broadcasts WHERE title_en = 'Direct row') = 'sent');

-- ═══ 7. Teams ════════════════════════════════════════════════
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('teams: list with members, leads and the no-team count',
  (SELECT (x ->> 'members')::int = (SELECT count(*) FROM public.profiles WHERE team_id = current_setting('t.pno')::uuid AND deleted_at IS NULL)
          AND x -> 'leads' @> jsonb_build_array(jsonb_build_object('user_id', current_setting('t.nadia')))
     FROM jsonb_array_elements(public.hr_list_teams() -> 'teams') x WHERE x ->> 'id' = current_setting('t.pno'))
  AND (public.hr_list_teams() ->> 'no_team')::int
      = (SELECT count(*) FROM public.profiles WHERE company_id = current_setting('t.wh')::uuid AND team_id IS NULL AND deleted_at IS NULL));
SELECT set_config('t.design', public.hr_create_team('  Design   team ', 'Product') ->> 'id', true);
SELECT pg_temp.chk('teams: create (spaces tidied)',
  EXISTS (SELECT 1 FROM public.teams WHERE id = current_setting('t.design')::uuid AND name = 'Design team' AND department = 'Product'));
SELECT pg_temp.err('teams: names are unique per company (any case)', $q$SELECT public.hr_create_team('design TEAM')$q$, 'team_name_taken');
SELECT pg_temp.err('teams: a name is required', $q$SELECT public.hr_create_team('   ')$q$, 'name_required');
SELECT pg_temp.chk('teams: rename keeps the department when not given',
  public.hr_rename_team(current_setting('t.design')::uuid, 'Design') @> '{"name": "Design", "department": "Product"}');
SELECT pg_temp.chk('teams: '''' clears the department, NULL name keeps the name',
  public.hr_rename_team(current_setting('t.design')::uuid, NULL, '') @> '{"name": "Design", "department": null}');
SELECT pg_temp.err('teams: rename to a taken name', format($q$SELECT public.hr_rename_team('%s', 'Finance')$q$, current_setting('t.design')), 'team_name_taken');
SELECT pg_temp.chk('teams: move two people (duplicates ignored)',
  (public.hr_move_to_team(ARRAY[current_setting('t.r4')::uuid, current_setting('t.r5')::uuid, current_setting('t.r5')::uuid],
                          current_setting('t.design')::uuid) ->> 'moved')::int = 2);
SELECT pg_temp.chk('teams: moving someone already there changes nothing',
  (public.hr_move_to_team(ARRAY[current_setting('t.r4')::uuid], current_setting('t.design')::uuid) ->> 'moved')::int = 0);
SELECT pg_temp.chk('teams: make r4 the lead (employee → manager)',
  public.hr_set_team_lead(current_setting('t.r4')::uuid, true) @> '{"role": "manager", "lead": true}');
SELECT pg_temp.chk('teams: … stored on the profile', (SELECT role FROM public.profiles WHERE id = current_setting('t.r4')::uuid) = 'manager');
SELECT pg_temp.err('teams: HR can not be made a lead', format($q$SELECT public.hr_set_team_lead('%s', true)$q$, current_setting('t.sara')), 'protected_role');
SELECT pg_temp.err('teams: HR can not be demoted through the lead switch either', format($q$SELECT public.hr_set_team_lead('%s', false)$q$, current_setting('t.sara')), 'protected_role');
SELECT pg_temp.chk('teams: move r5 to no team', (public.hr_move_to_team(ARRAY[current_setting('t.r5')::uuid], NULL) ->> 'moved')::int = 1);
SELECT pg_temp.err('teams: a lead needs a team', format($q$SELECT public.hr_set_team_lead('%s', true)$q$, current_setting('t.r5')), 'person_has_no_team');
SELECT pg_temp.err('teams: someone from another company is not found',
  format($q$SELECT public.hr_move_to_team(ARRAY['%s']::uuid[], NULL)$q$, current_setting('t.ngemp')), 'person_not_found');
SELECT pg_temp.err('teams: delete with people in it → team_not_empty', format($q$SELECT public.hr_delete_team('%s')$q$, current_setting('t.design')), 'team_not_empty');
SELECT public.hr_save_broadcast(jsonb_build_object('title_en', 'Design only', 'body_en', 'x', 'scope', 'team',
  'team_id', current_setting('t.design'), 'scheduled_at', '2026-11-20T10:00:00+02:00')) IS NOT NULL AS design_broadcast;
SELECT pg_temp.err('teams: delete while a broadcast is scheduled for it → team_in_use',
  format($q$SELECT public.hr_delete_team('%s', true)$q$, current_setting('t.design')), 'team_in_use');
SELECT public.hr_cancel_broadcast((SELECT id FROM public.broadcasts WHERE title_en = 'Design only')) IS NOT NULL AS cancelled;
SELECT pg_temp.chk('teams: delete, moving its people to no team',
  public.hr_delete_team(current_setting('t.design')::uuid, true) @> '{"deleted": true, "moved": 1, "leads_unset": 1}');
SELECT pg_temp.chk('teams: … the lead is an employee with no team now',
  (SELECT team_id IS NULL AND role = 'employee' FROM public.profiles WHERE id = current_setting('t.r4')::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = current_setting('t.design')::uuid));
RESET ROLE;
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.err('teams: an employee can not create teams', $q$SELECT public.hr_create_team('Mine')$q$, 'not_authorized');
SELECT pg_temp.err('teams: an employee can not set leads', format($q$SELECT public.hr_set_team_lead('%s', true)$q$, current_setting('t.omar')), 'not_authorized');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.nghr')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.err('teams: Nile HR can not delete a Wellhouse team', format($q$SELECT public.hr_delete_team('%s', true)$q$, current_setting('t.fin')), 'team_not_found');
SELECT pg_temp.err('teams: Nile HR can not make a Wellhouse person a lead', format($q$SELECT public.hr_set_team_lead('%s', true)$q$, current_setting('t.omar')), 'person_not_found');
RESET ROLE;
SELECT pg_temp.act(NULL);

-- ═══ 8. Privacy: secondary suppression ═══════════════════════
SELECT pg_temp.chk('fold: 8 / 2 / 2 → the 4 hidden would show by subtraction, so 8 is folded too',
  public.cohort_shown_keys('[{"key":"a","size":8},{"key":"b","size":2},{"key":"c","size":2}]', 5) = '{}'::text[]);
SELECT pg_temp.chk('fold: 9 / 7 / 2 → fold the smallest shown (7), keep 9',
  public.cohort_shown_keys('[{"key":"a","size":9},{"key":"b","size":7},{"key":"c","size":2}]', 5) = ARRAY['a']);
SELECT pg_temp.chk('fold: 9 / 7, nothing hidden → both shown',
  public.cohort_shown_keys('[{"key":"a","size":9},{"key":"b","size":7}]', 5) = ARRAY['a', 'b']);
SELECT pg_temp.chk('fold: hidden already ≥ floor (3 + 2) → every big team shown',
  public.cohort_shown_keys('[{"key":"a","size":9},{"key":"b","size":5},{"key":"c","size":3},{"key":"d","size":2}]', 5) = ARRAY['a', 'b']);
SELECT pg_temp.chk('fold: a never-shown group (no team) counts as hidden',
  public.cohort_shown_keys('[{"key":"a","size":9},{"key":"b","size":6},{"key":"none","size":1,"showable":false}]', 5) = ARRAY['a']
  AND public.cohort_shown_keys('[{"key":"a","size":9},{"key":"none","size":6,"showable":false}]', 5) = ARRAY['a']);
SELECT pg_temp.chk('fold: the floor of the company is used (7)',
  public.cohort_shown_keys('[{"key":"a","size":9},{"key":"b","size":7},{"key":"c","size":6}]', 7) = ARRAY['a']);
SELECT pg_temp.chk('fold: total under the floor → nothing',
  public.cohort_shown_keys('[{"key":"a","size":3},{"key":"b","size":1}]', 5) = '{}'::text[]);

-- Wellhouse now: Engineering 6 onboarded (amira, yusuf, r1–r3, ex-Design r4 went to no team…).
-- Make it concrete: Finance gets 6 more (8), so People & Ops (2) + no-team (r4, r5) = 4 hidden
-- → fold the smallest shown team.
SELECT pg_temp.mk_user('fin' || g || '@check.local', 'WH-4782', 'Fin ' || g, 'employee', current_setting('t.fin')::uuid)
  FROM generate_series(1, 6) g;
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE _rep ON COMMIT DROP AS SELECT public.hr_routine_report('14d') AS r;
SELECT pg_temp.chk('report: Finance (8) shown, Engineering (5) folded with People & Ops + no-team into one row ≥ 5',
  (SELECT array_agg(x ->> 'name' ORDER BY x ->> 'name') FILTER (WHERE NOT (x ->> 'small')::boolean)
     FROM _rep, jsonb_array_elements(r -> 'by_team') x) = ARRAY['Finance']
  AND (SELECT (x ->> 'members')::int >= 5 FROM _rep, jsonb_array_elements(r -> 'by_team') x WHERE (x ->> 'small')::boolean)
  AND (SELECT (r ->> 'teams_folded')::int = 1 AND NOT (r ->> 'breakdown_suppressed')::boolean FROM _rep),
  (SELECT r ->> 'by_team' FROM _rep));
SELECT pg_temp.chk('report: everyone − the teams shown by name is 0 or ≥ the floor (no subtraction attack)',
  (SELECT n = 0 OR n >= 5 FROM (
     SELECT (SELECT count(*) FROM public.profiles WHERE company_id = current_setting('t.wh')::uuid AND deleted_at IS NULL AND onboarded)
            - (SELECT COALESCE(sum((x ->> 'members')::int), 0) FROM _rep, jsonb_array_elements(r -> 'by_team') x
                WHERE NOT (x ->> 'small')::boolean) AS n) z));
SELECT pg_temp.chk('report: the rows add up to everyone with a routine',
  (SELECT sum((x ->> 'members')::int) FROM _rep, jsonb_array_elements(r -> 'by_team') x)
  = (SELECT count(*) FROM public.profiles WHERE company_id = current_setting('t.wh')::uuid AND deleted_at IS NULL AND onboarded));
RESET ROLE;
SELECT pg_temp.act(current_setting('t.omar')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('board: only Finance on the team board (Engineering folded, no-team never shown)',
  (SELECT array_agg(x ->> 'name') FROM jsonb_array_elements(public.recognition_board('today') -> 'teams') x) = ARRAY['Finance']);
RESET ROLE;
SELECT pg_temp.act(NULL);

-- Mood check-ins (Teams view + drill-down): Eng 6, Finance 5, P&O 1 respondents
-- → the 1 would show by subtraction → fold Finance (5), keep Engineering.
DELETE FROM public.checkins WHERE company_id = current_setting('t.wh')::uuid;
INSERT INTO public.checkins (user_id, company_id, checked_at, sleep, stress, energy, mood)
SELECT p.id, p.company_id, current_date - 1, 6, 4, 6, 7
  FROM public.profiles p
 WHERE p.id IN (SELECT id FROM public.profiles WHERE team_id = current_setting('t.eng')::uuid ORDER BY id LIMIT 6)
    OR p.id IN (SELECT id FROM public.profiles WHERE team_id = current_setting('t.fin')::uuid ORDER BY id LIMIT 5)
    OR p.id = current_setting('t.nadia')::uuid;
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('teams view: Engineering shown, Finance (5 respondents) folded, P&O (1) suppressed',
  (SELECT has_signal AND avg_mood IS NOT NULL FROM public.hr_team_overview WHERE team_id = current_setting('t.eng')::uuid)
  AND (SELECT suppressed AND avg_mood IS NULL AND group_size = 5 FROM public.hr_team_overview WHERE team_id = current_setting('t.fin')::uuid)
  AND (SELECT suppressed FROM public.hr_team_overview WHERE team_id = current_setting('t.pno')::uuid));
SELECT pg_temp.chk('drill-down: Finance is suppressed as folded, Engineering is shown',
  public.hr_team_drilldown(current_setting('t.fin')::uuid, '30d') @> '{"suppressed": true, "folded": true}'
  AND public.hr_team_drilldown(current_setting('t.eng')::uuid, '30d') @> '{"suppressed": false}'
  AND public.hr_team_drilldown(current_setting('t.pno')::uuid, '30d') @> '{"suppressed": true, "folded": false}');
RESET ROLE;
SELECT pg_temp.act(NULL);
-- Four more respondents outside Engineering / Finance (Sara, r4, r5 and a new
-- no-team person) → the hidden group is 5 → nothing needs folding.
SELECT pg_temp.mk_user('noteam@check.local', 'WH-4782', 'No Team') IS NOT NULL AS no_team_person;
INSERT INTO public.checkins (user_id, company_id, checked_at, sleep, stress, energy, mood)
SELECT id, company_id, current_date - 1, 5, 5, 5, 5 FROM public.profiles
 WHERE id IN (current_setting('t.sara')::uuid, current_setting('t.r4')::uuid, current_setting('t.r5')::uuid,
              pg_temp.uid('noteam@check.local'));
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('teams view: once the hidden group reaches the floor, Engineering and Finance both show',
  (SELECT bool_and(has_signal) AND count(*) = 2 FROM public.hr_team_overview
    WHERE team_id IN (current_setting('t.eng')::uuid, current_setting('t.fin')::uuid)));
SELECT pg_temp.chk('drill-down: … Finance too', public.hr_team_drilldown(current_setting('t.fin')::uuid, '30d') @> '{"suppressed": false}');
RESET ROLE;
SELECT pg_temp.act(NULL);

-- ═══ 9. Fixes ════════════════════════════════════════════════
-- (a) default weekly habit pauses while a routine runs.
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('t.hab', public.my_habit_challenge()::text, true);
SELECT pg_temp.chk('habit: with the company routine running, Amira never gets the default (auto) week',
  COALESCE(current_setting('t.hab')::jsonb #>> '{challenge,payload,auto}', 'false') <> 'true', current_setting('t.hab'));
SELECT pg_temp.err('habit: the paused default week can not be logged',
  format($q$SELECT public.log_habit('%s')$q$,
         (SELECT id FROM public.challenges WHERE company_id = current_setting('t.wh')::uuid AND kind = 'habit'
             AND payload ->> 'auto' = 'true' AND start_date <= DATE '2026-11-09' AND end_date >= DATE '2026-11-09' LIMIT 1)),
  'challenge_not_found');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('habit: HR sees this week''s default as paused',
  EXISTS (SELECT 1 FROM public.hr_habit_challenges() h WHERE h.auto AND h.status = 'paused'
           AND h.start_date <= DATE '2026-11-09' AND h.end_date >= DATE '2026-11-09'));
SELECT pg_temp.chk('habit: HR''s own challenge still runs (not paused)',
  NOT EXISTS (SELECT 1 FROM public.hr_habit_challenges() h WHERE NOT h.auto AND h.status = 'paused'));
RESET ROLE;
-- Nile: no routine → the default runs; a routine for one team pauses it for that team only.
SELECT pg_temp.act(current_setting('t.ngemp')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('habit: Nile has no routine → the default week runs',
  (public.my_habit_challenge() ->> 'status') = 'active' AND (public.my_habit_challenge() #>> '{challenge,payload,auto}') = 'true');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.nghr')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('t.ngteam', public.hr_create_team('Ops') ->> 'id', true);
SELECT public.hr_move_to_team(ARRAY[current_setting('t.ngemp')::uuid], current_setting('t.ngteam')::uuid) IS NOT NULL AS moved;
SELECT set_config('t.ngr', public.save_routine('{"title_en": "Nile desk", "items": [{"title_en": "Stand up", "at_time": "11:00"}]}') #>> '{routine,id}', true);
SELECT public.hr_assign_routine(current_setting('t.ngr')::uuid, current_setting('t.ngteam')::uuid) IS NOT NULL AS assigned;
SELECT pg_temp.chk('habit: a team-only routine leaves the default active in HR''s list',
  EXISTS (SELECT 1 FROM public.hr_habit_challenges() h WHERE h.auto AND h.status = 'active'));
SELECT pg_temp.err('teams: a team with a routine running can not be deleted (team_in_use)',
  format($q$SELECT public.hr_delete_team('%s', true)$q$, current_setting('t.ngteam')), 'team_in_use');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.ngemp')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('habit: the team with the routine no longer gets the default',
  COALESCE(public.my_habit_challenge() #>> '{challenge,payload,auto}', 'false') <> 'true');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.ngemp2')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('habit: … while the rest of the company still does',
  (public.my_habit_challenge() #>> '{challenge,payload,auto}') = 'true');
RESET ROLE;

-- (b) week view items carry their exercise.
SELECT pg_temp.act(current_setting('t.r1')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('week: items carry the exercise (name, sets, body areas, media fields)',
  (SELECT bool_and(i -> 'exercise' ? 'name_en' AND i -> 'exercise' ? 'body_areas' AND i -> 'exercise' ? 'media_type'
                   AND i -> 'exercise' ? 'media_path' AND i -> 'exercise' ? 'media_youtube_id' AND i -> 'exercise' ? 'default_sets_reps')
     FROM jsonb_array_elements(public.my_routine_week() -> 'days') d, jsonb_array_elements(d -> 'items') i
    WHERE i ->> 'exercise_id' IS NOT NULL)
  AND (SELECT count(*) FROM jsonb_array_elements(public.my_routine_week() -> 'days') d, jsonb_array_elements(d -> 'items') i
        WHERE i ->> 'exercise_id' IS NOT NULL) > 0
  AND NOT (public.my_routine_week()::text ~ '"created_by"'));
RESET ROLE;

-- (c) clearing optional Arabic fields.
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('t.tpl', (public.hr_save_challenge_template(
  '{"title_en": "Clear test", "title_ar": "اختبار", "payload": {"action_en": "Do it", "action_ar": "اعملها"}}')).id::text, true);
SELECT pg_temp.chk('clear: template title_ar '''' → NULL, the payload kept',
  (SELECT title_ar IS NULL AND payload ->> 'action_ar' = 'اعملها'
     FROM public.hr_save_challenge_template(jsonb_build_object('id', current_setting('t.tpl'), 'title_ar', ''))));
SELECT public.hr_save_challenge_template(jsonb_build_object('id', current_setting('t.tpl'), 'title_ar', 'تاني')) IS NOT NULL AS set_again;
SELECT pg_temp.chk('clear: template title_ar null → NULL',
  (SELECT title_ar IS NULL FROM public.hr_save_challenge_template(jsonb_build_object('id', current_setting('t.tpl'), 'title_ar', NULL))));
SELECT public.hr_save_challenge_template(jsonb_build_object('id', current_setting('t.tpl'), 'title_ar', 'تالت')) IS NOT NULL AS set_third;
SELECT pg_temp.chk('clear: a key left out keeps title_ar',
  (SELECT title_ar = 'تالت' FROM public.hr_save_challenge_template(jsonb_build_object('id', current_setting('t.tpl'), 'title_en', 'Clear test 2'))));
SELECT pg_temp.chk('clear: payload action_ar '''' → gone',
  (SELECT NOT (payload ? 'action_ar') FROM public.hr_save_challenge_template(
     jsonb_build_object('id', current_setting('t.tpl'), 'payload', '{"action_ar": ""}'::jsonb))));
SELECT pg_temp.chk('clear: a new template without title_ar stores NULL (not the English title)',
  (SELECT title_ar IS NULL FROM public.hr_save_challenge_template('{"title_en": "No AR", "payload": {"action_en": "x"}}')));
SELECT set_config('t.ex', (public.save_exercise('{"name_en": "Clr", "name_ar": "ك", "how_ar": "ه"}')).id::text, true);
SELECT pg_temp.chk('clear: exercise name_ar '''' and how_ar null → NULL',
  (SELECT name_ar IS NULL AND how_ar IS NULL FROM public.save_exercise(
     jsonb_build_object('id', current_setting('t.ex'), 'name_ar', '', 'how_ar', NULL))));
SELECT set_config('t.rt', public.save_routine('{"title_en": "R clr", "title_ar": "ر", "note_ar": "ن"}') #>> '{routine,id}', true);
SELECT pg_temp.chk('clear: routine title_ar null and note_ar '''' → NULL',
  (public.save_routine(jsonb_build_object('id', current_setting('t.rt'), 'title_ar', NULL, 'note_ar', '')) -> 'routine')
  @> '{"title_ar": null, "note_ar": null}');
SELECT set_config('t.ci', (public.save_content_item('{"kind": "fact", "title_en": "F", "title_ar": "ف", "body_en": "b", "body_ar": "ب"}')).id::text, true);
SELECT pg_temp.chk('clear: content title_ar '''' and body_ar null → NULL',
  (SELECT title_ar IS NULL AND body_ar IS NULL FROM public.save_content_item(
     jsonb_build_object('id', current_setting('t.ci'), 'title_ar', '', 'body_ar', NULL))));

-- (d) bulk media for the import.
SELECT set_config('t.e1', (public.save_exercise('{"name_en": "Bulk one"}')).id::text, true);
SELECT set_config('t.e2', (public.save_exercise('{"name_en": "Bulk two"}')).id::text, true);
SELECT set_config('t.e3', (public.save_exercise('{"name_en": "Bulk three"}')).id::text, true);
SELECT set_config('t.e4', (public.save_exercise('{"name_en": "Bulk four"}')).id::text, true);
RESET ROLE;
INSERT INTO public.exercises (id, company_id, name_en, status) VALUES ('00000000-0000-0000-0099-000000000071', NULL, 'Public bulk', 'published');
INSERT INTO public.exercises (id, company_id, name_en, status) VALUES ('00000000-0000-0000-0099-000000000072', current_setting('t.ng')::uuid, 'Nile bulk', 'published');
SET LOCAL ROLE authenticated;
SELECT set_config('t.bulk', public.hr_set_exercises_media(jsonb_build_array(
  jsonb_build_object('id', current_setting('t.e1'), 'media_type', 'video', 'media_path', current_setting('t.wh') || '/exercises/bulk-one.mp4', 'media_mime', 'video/mp4'),
  jsonb_build_object('id', current_setting('t.e2'), 'media_type', 'youtube', 'media_youtube_id', 'dQw4w9WgXcQ'),
  jsonb_build_object('id', current_setting('t.e1'), 'media_type', 'video', 'media_path', current_setting('t.wh') || '/exercises/again.mp4'),
  jsonb_build_object('id', current_setting('t.e3'), 'media_type', 'video', 'media_path', current_setting('t.wh') || '/exercises/x.avi', 'media_mime', 'video/avi'),
  jsonb_build_object('id', current_setting('t.e4'), 'media_type', 'video', 'media_path', current_setting('t.ng') || '/exercises/x.mp4'),
  jsonb_build_object('id', '00000000-0000-0000-0099-000000000071', 'media_type', 'youtube', 'media_youtube_id', 'dQw4w9WgXcQ'),
  jsonb_build_object('id', '00000000-0000-0000-0099-000000000072', 'media_type', 'youtube', 'media_youtube_id', 'dQw4w9WgXcQ'),
  jsonb_build_object('id', 'not-a-uuid'))) ::text, true);
SELECT pg_temp.chk('bulk media: 2 updated, the rest skipped with a reason each',
  (current_setting('t.bulk')::jsonb ->> 'updated')::int = 2
  AND current_setting('t.bulk')::jsonb -> 'skipped' @> jsonb_build_array(
        jsonb_build_object('id', current_setting('t.e1'), 'reason', 'duplicate'),
        jsonb_build_object('id', current_setting('t.e3'), 'reason', 'bad_media_mime'),
        jsonb_build_object('id', current_setting('t.e4'), 'reason', 'media_path_outside_company'),
        jsonb_build_object('id', '00000000-0000-0000-0099-000000000071', 'reason', 'public_item_read_only'),
        jsonb_build_object('id', '00000000-0000-0000-0099-000000000072', 'reason', 'exercise_not_found'),
        jsonb_build_object('id', 'not-a-uuid', 'reason', 'exercise_not_found')),
  current_setting('t.bulk'));
SELECT pg_temp.chk('bulk media: the media landed (bucket defaults to company-media)',
  EXISTS (SELECT 1 FROM public.exercises WHERE id = current_setting('t.e1')::uuid AND media_type = 'video'
           AND media_bucket = 'company-media' AND media_path LIKE '%/bulk-one.mp4')
  AND EXISTS (SELECT 1 FROM public.exercises WHERE id = current_setting('t.e2')::uuid AND media_type = 'youtube'
               AND media_youtube_id = 'dQw4w9WgXcQ' AND media_path IS NULL));
SELECT pg_temp.chk('bulk media: overwrite false skips exercises that have media',
  public.hr_set_exercises_media(jsonb_build_array(jsonb_build_object('id', current_setting('t.e1'), 'media_type', NULL)), false)
  @> jsonb_build_object('updated', 0, 'skipped', jsonb_build_array(jsonb_build_object('id', current_setting('t.e1'), 'reason', 'has_media'))));
SELECT pg_temp.chk('bulk media: media_type null clears',
  (public.hr_set_exercises_media(jsonb_build_array(jsonb_build_object('id', current_setting('t.e1'), 'media_type', NULL))) ->> 'updated')::int = 1);
SELECT pg_temp.chk('bulk media: … the row has no media now',
  EXISTS (SELECT 1 FROM public.exercises WHERE id = current_setting('t.e1')::uuid AND media_type IS NULL AND media_path IS NULL));
RESET ROLE;
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.err('bulk media: employees can not', $q$SELECT public.hr_set_exercises_media('[]')$q$, 'not_authorized');
RESET ROLE;

ROLLBACK;
