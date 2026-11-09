-- Behaviour checks for 20261110000001_routines_and_libraries.sql.
-- LOCAL STACK ONLY (needs the demo users from seed.sql and
-- supabase/demo_seed_routines.sql). Everything runs in one transaction that
-- is rolled back at the end, so the database is left as it was.
--
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -q -f supabase/tests/routines_and_libraries_checks.sql | grep -E '^(PASS|FAIL)'
--
-- Each check prints PASS / FAIL. Calls are made as the real `authenticated`
-- role with a JWT for the user (SET ROLE + request.jwt.claims), so RLS and
-- grants apply exactly as for the app. The clock is pinned with
-- wellness.now (honoured only for direct postgres sessions).

\pset tuples_only on
\pset format unaligned
BEGIN;

CREATE FUNCTION pg_temp.chk(p_name TEXT, p_ok BOOLEAN, p_detail TEXT DEFAULT NULL) RETURNS TEXT
LANGUAGE sql AS $$
  SELECT CASE WHEN COALESCE(p_ok, false) THEN 'PASS ' ELSE 'FAIL ' END || p_name
         || CASE WHEN COALESCE(p_ok, false) OR p_detail IS NULL THEN '' ELSE ' — ' || p_detail END;
$$;

-- Runs p_sql and expects an error whose message matches p_err (LIKE).
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

-- Act as a user (NULL = back to postgres).
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

-- New user in a company (via the real sign-up trigger), onboarded.
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


-- ── fixtures ─────────────────────────────────────────────────
-- Wellhouse works in Cairo time for these checks; Monday 9 Nov 2026, 10:00
-- Cairo (08:00 UTC).
UPDATE public.companies SET settings = settings || '{"timezone": "Africa/Cairo"}'
 WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT set_config('wellness.now', '2026-11-09 08:00:00+00', true);

SELECT set_config('t.wh',   '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('t.ng',   '00000000-0000-0000-0000-000000000002', true);
SELECT set_config('t.eng',  '00000000-0000-0000-0001-000000000001', true);
SELECT set_config('t.amira', pg_temp.uid('amira.hassan@demo.wellhouse.test')::text, true);
SELECT set_config('t.omar',  pg_temp.uid('omar.sami@demo.wellhouse.test')::text, true);
SELECT set_config('t.sara',  pg_temp.uid('sara.hr@demo.wellhouse.test')::text, true);
SELECT set_config('t.ngemp', pg_temp.mk_user('nile.emp@check.local', 'NG-9130', 'Nile Employee')::text, true);
SELECT set_config('t.nghr',  pg_temp.mk_user('nile.hr@check.local',  'NG-9130', 'Nile HR', 'hr_admin')::text, true);
SELECT set_config('t.fresh', pg_temp.mk_user('fresh@check.local', 'WH-4782', 'Fresh Person', 'employee',
                                             '00000000-0000-0000-0001-000000000001')::text, true);

-- A public (Wellness House) exercise and routine to test read-only + "Use this".
INSERT INTO public.exercises (id, company_id, name_en, name_ar, default_sets_reps, status)
VALUES ('00000000-0000-0000-0099-000000000001', NULL, 'Public neck roll', 'لف الرقبة', '1 × 5', 'published');
INSERT INTO public.routines (id, company_id, title_en, status)
VALUES ('00000000-0000-0000-0099-000000000002', NULL, 'Public micro-break', 'published');
INSERT INTO public.routine_items (routine_id, exercise_id, at_time, sort_order)
VALUES ('00000000-0000-0000-0099-000000000002', '00000000-0000-0000-0099-000000000001', '11:00', 1);

-- ═══ 1. Company-local time ═══════════════════════════════════
SELECT pg_temp.chk('tz: Wellhouse is Cairo for this run', public.company_tz(current_setting('t.wh')::uuid) = 'Africa/Cairo');
SELECT pg_temp.chk('tz: missing / junk zone falls back to Cairo',
  (SELECT public.company_tz(id) FROM public.companies WHERE id = current_setting('t.ng')::uuid) = 'Africa/Cairo');

SELECT set_config('wellness.now', '2026-11-08 23:00:00+00', true);  -- Sun 23:00 UTC = Mon 01:00 Cairo (winter, +2)
SELECT pg_temp.chk('date: Mon 01:00 Cairo is Monday although UTC says Sunday',
  public.company_today(current_setting('t.wh')::uuid) = DATE '2026-11-09'
  AND (public.clock_now() AT TIME ZONE 'UTC')::date = DATE '2026-11-08');
SELECT set_config('wellness.now', '2026-07-15 21:30:00+00', true);  -- summer: 00:30 Cairo (+3) on the 16th
SELECT pg_temp.chk('date: summer time (+3) rolls the day at 21:00 UTC',
  public.company_today(current_setting('t.wh')::uuid) = DATE '2026-07-16');
SELECT set_config('wellness.now', '2026-01-15 21:30:00+00', true);  -- winter: 23:30 Cairo, still the 15th
SELECT pg_temp.chk('date: winter time (+2) at 21:30 UTC is still the same day',
  public.company_today(current_setting('t.wh')::uuid) = DATE '2026-01-15');

SELECT set_config('wellness.now', '2026-11-08 23:00:00+00', true);
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('my_today: at 01:00 Cairo Monday the app shows Monday',
  (public.my_today() ->> 'date') = '2026-11-09' AND (public.my_today() ->> 'weekday')::int = 1);
RESET ROLE;
SELECT set_config('wellness.now', '2026-11-09 08:00:00+00', true);  -- back to Mon 10:00 Cairo

-- ═══ 2. Grants ═══════════════════════════════════════════════
SELECT pg_temp.chk('grants: anon cannot call my_today / check_routine_item / hr_routine_report',
  NOT has_function_privilege('anon', 'public.my_today()', 'execute')
  AND NOT has_function_privilege('anon', 'public.check_routine_item(uuid, boolean)', 'execute')
  AND NOT has_function_privilege('anon', 'public.hr_routine_report(text)', 'execute'));
SELECT pg_temp.chk('grants: internal helpers are not callable by app users',
  NOT has_function_privilege('authenticated', 'public.refresh_routine_day(uuid, date)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.company_today(uuid)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.routine_due_items(uuid, uuid, date)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.score_events(uuid)', 'execute'));
SELECT pg_temp.chk('grants: authenticated can call the RPCs',
  has_function_privilege('authenticated', 'public.my_today()', 'execute')
  AND has_function_privilege('authenticated', 'public.recognition_board(text, integer)', 'execute'));

-- ═══ 3. Today + ticking (own items, today only) ═════════════
SELECT pg_temp.act(current_setting('t.fresh')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('my_today: Monday = 8 Desk Day + 3 weekly-split items, none ticked',
  (public.my_today() -> 'progress' ->> 'total')::int = 11 AND (public.my_today() -> 'progress' ->> 'done')::int = 0,
  public.my_today() ->> 'progress');
SELECT pg_temp.chk('my_today: day focus from the weekly split',
  public.my_today() -> 'routines' @> '[{"day_title": {"en": "Lower body"}}]');
SELECT pg_temp.chk('my_today: at 10:00 the next item is the 10:30 one (09:30 is past)',
  (SELECT (i ->> 'at_time') FROM jsonb_array_elements(public.my_today() -> 'items') i
    WHERE i ->> 'id' = public.my_today() ->> 'next_item_id') = '10:30');
SELECT pg_temp.chk('my_today: item carries the exercise (name, sets/reps)',
  (SELECT (i -> 'exercise' ->> 'name_en') = 'Neck tilt' AND i ->> 'sets_reps' = '2 × 20 s each side'
     FROM jsonb_array_elements(public.my_today() -> 'items') i WHERE i ->> 'at_time' = '10:30'));
SELECT pg_temp.err('rls: employee cannot insert into routine_checks directly',
  format($q$INSERT INTO public.routine_checks (company_id, user_id, item_id, check_date)
            VALUES (%L, %L, '00000000-0000-0000-0022-000000000001', current_date)$q$,
         current_setting('t.wh'), current_setting('t.fresh')), 'permission denied%');
SELECT pg_temp.err('check: an item due on another weekday is refused',
  $q$SELECT public.check_routine_item('00000000-0000-0000-0022-000000000011')$q$, 'item_not_due_today');
SELECT pg_temp.err('check: a random id is refused',
  $q$SELECT public.check_routine_item(gen_random_uuid())$q$, 'item_not_due_today');

-- Points: +2 per item (cap 20 a day) + 10 for a full day, counted once.
SELECT public.check_routine_item('00000000-0000-0000-0022-000000000001') IS NOT NULL AS tick1;
SELECT public.check_routine_item('00000000-0000-0000-0022-000000000002') IS NOT NULL AS tick2;
SELECT pg_temp.chk('points: 3 ticks = 6',
  (public.check_routine_item('00000000-0000-0000-0022-000000000003') -> 'progress' ->> 'points')::int = 6);
SELECT pg_temp.chk('check: ticking twice is idempotent',
  (public.check_routine_item('00000000-0000-0000-0022-000000000003') -> 'progress' ->> 'done')::int = 3);
SELECT pg_temp.chk('check: own ticks visible to me through RLS',
  (SELECT count(*) FROM public.routine_checks WHERE user_id = current_setting('t.fresh')::uuid) = 3);
SELECT pg_temp.chk('points: all 11 ticked = 20 (cap) + 10 (full day) = 30',
  (SELECT max((public.check_routine_item(d.item_id) -> 'progress' ->> 'points')::int)
     FROM (SELECT (i ->> 'id')::uuid AS item_id FROM jsonb_array_elements(public.my_today() -> 'items') i) d) = 30);
SELECT pg_temp.chk('points: untick one → 20, no day bonus',
  (public.check_routine_item('00000000-0000-0000-0022-000000000004', false) -> 'progress' ->> 'points')::int = 20);
SELECT pg_temp.chk('points: tick it again → 30, bonus once',
  (public.check_routine_item('00000000-0000-0000-0022-000000000004', true) -> 'progress' ->> 'points')::int = 30);
SELECT pg_temp.chk('score: my_scorecard week = 30, 11 routine items, 1 full day, streak 1',
  (public.my_scorecard() -> 'me' ->> 'week')::int = 30
  AND (public.my_scorecard() -> 'me' -> 'week_parts' ->> 'routine_items')::int = 11
  AND (public.my_scorecard() -> 'me' -> 'week_parts' ->> 'routine_full_days')::int = 1
  AND (public.my_scorecard() -> 'me' -> 'routine' ->> 'streak')::int = 1,
  public.my_scorecard() ->> 'me');
RESET ROLE;
SELECT pg_temp.chk('score: score_events for that day sums to 30',
  (SELECT sum(pts) FROM public.score_events(current_setting('t.wh')::uuid) e
    WHERE e.user_id = current_setting('t.fresh')::uuid AND e.kind LIKE 'routine%') = 30);

-- Yesterday can't be ticked: move the clock to Tuesday; Monday's item is not due "today".
SELECT set_config('wellness.now', '2026-11-10 08:00:00+00', true);
SELECT pg_temp.act(current_setting('t.fresh')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.err('check: a Monday split item cannot be ticked on Tuesday',
  $q$SELECT public.check_routine_item('00000000-0000-0000-0022-000000000021')$q$, 'item_not_due_today');
SELECT pg_temp.chk('streak: still 1 on Tuesday morning before any tick',
  (public.my_today() ->> 'streak')::int = 1);
SELECT pg_temp.chk('week view: Mon done 11/11, Tue due 11, Sun–Thu = 5 days',
  jsonb_array_length(public.my_routine_week() -> 'days') = 5
  AND (public.my_routine_week() -> 'days' -> 1 ->> 'done')::int = 11
  AND (public.my_routine_week() -> 'days' -> 1 ->> 'all_done')::boolean
  AND (public.my_routine_week() -> 'days' -> 2 ->> 'due')::int = 11);
RESET ROLE;
SELECT set_config('wellness.now', '2026-11-09 08:00:00+00', true);

-- ═══ 4. Two companies stay apart (RLS) ══════════════════════
SELECT pg_temp.act(current_setting('t.ngemp')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('rls: Nile employee sees no Wellhouse exercises / routines / items',
  NOT EXISTS (SELECT 1 FROM public.exercises WHERE company_id = current_setting('t.wh')::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.routines WHERE company_id = current_setting('t.wh')::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.routine_items WHERE routine_id = '00000000-0000-0000-0021-000000000001'));
SELECT pg_temp.chk('rls: Nile employee sees no Wellhouse ticks, days, prefs, assignments, library prefs',
  (SELECT count(*) FROM public.routine_checks) = 0 AND (SELECT count(*) FROM public.routine_days) = 0
  AND (SELECT count(*) FROM public.profile_prefs) = 0 AND (SELECT count(*) FROM public.routine_assignments) = 0
  AND (SELECT count(*) FROM public.company_library_prefs) = 0);
SELECT pg_temp.chk('rls: Nile employee cannot read Wellhouse private article or HR challenge template',
  NOT EXISTS (SELECT 1 FROM public.content_items WHERE company_id = current_setting('t.wh')::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.challenge_templates WHERE company_id = current_setting('t.wh')::uuid));
SELECT pg_temp.chk('rls: Nile employee still sees public exercises and articles',
  EXISTS (SELECT 1 FROM public.exercises WHERE id = '00000000-0000-0000-0099-000000000001')
  AND EXISTS (SELECT 1 FROM public.content_items WHERE company_id IS NULL));
SELECT pg_temp.chk('library_list: Nile gets public items only',
  NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.library_list('exercise')) x WHERE x ->> 'scope' = 'company')
  AND jsonb_array_length(public.library_list('exercise')) = 1);
SELECT pg_temp.err('rls: Nile employee gets routine_not_found for a Wellhouse routine',
  $q$SELECT public.routine_detail('00000000-0000-0000-0021-000000000001')$q$, 'routine_not_found');
SELECT pg_temp.err('rls: Nile employee cannot tick a Wellhouse item',
  $q$SELECT public.check_routine_item('00000000-0000-0000-0022-000000000001')$q$, 'item_not_due_today');
SELECT pg_temp.chk('my_today: Nile employee has no routine', (public.my_today() ->> 'assigned')::boolean = false);
RESET ROLE;

SELECT pg_temp.act(current_setting('t.nghr')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.err('rls: Nile HR cannot schedule Wellhouse''s private challenge',
  $q$SELECT public.hr_schedule_habit_challenge('00000000-0000-0000-0025-000000000001', DATE '2026-12-06')$q$,
  'template_not_found');
SELECT pg_temp.err('rls: Nile HR cannot edit a Wellhouse exercise',
  $q$SELECT public.save_exercise('{"id": "00000000-0000-0000-0020-000000000001", "name_en": "x"}')$q$, 'not_authorized');
SELECT pg_temp.err('rls: Nile HR cannot assign a Wellhouse routine',
  $q$SELECT public.hr_assign_routine('00000000-0000-0000-0021-000000000001')$q$, 'routine_not_found');
SELECT pg_temp.err('rls: Nile HR cannot point media at Wellhouse''s folder',
  format($q$SELECT public.save_exercise('{"name_en": "x", "media_type": "video", "media_bucket": "company-media", "media_path": "%s/exercises/a.mp4"}')$q$,
         current_setting('t.wh')), 'media_path_outside_company');
SELECT pg_temp.chk('rls: Nile HR report has no Wellhouse numbers',
  (public.hr_routine_report('14d') -> 'totals' ->> 'done')::int = 0);
-- Nile builds its own routine and its employee ticks it.
SELECT set_config('t.ngroutine', (public.save_routine(jsonb_build_object(
  'title_en', 'Nile stretch', 'items', jsonb_build_array(
    jsonb_build_object('title_en', 'Glass of water', 'at_time', '09:00'),
    jsonb_build_object('exercise_id', '00000000-0000-0000-0099-000000000001', 'at_time', '12:00')))) -> 'routine' ->> 'id'), true);
SELECT pg_temp.chk('author: HR builds a routine with a free-text row and a public exercise',
  jsonb_array_length(public.routine_detail(current_setting('t.ngroutine')::uuid) -> 'items') = 2);
SELECT pg_temp.chk('author: assign to everyone from today',
  (public.hr_assign_routine(current_setting('t.ngroutine')::uuid)).starts_on = DATE '2026-11-09');
SELECT pg_temp.err('author: a Wellhouse exercise cannot be used in a Nile routine',
  format($q$SELECT public.save_routine('{"id": "%s", "items": [{"exercise_id": "00000000-0000-0000-0020-000000000001"}]}')$q$,
         current_setting('t.ngroutine')), 'exercise_not_found');
SELECT pg_temp.err('author: assignments cannot start in the past',
  format($q$SELECT public.hr_assign_routine('%s', NULL, DATE '2026-11-01')$q$, current_setting('t.ngroutine')),
  'starts_in_the_past');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.ngemp')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('my_today: Nile employee sees the new routine right after it is saved',
  (public.my_today() -> 'progress' ->> 'total')::int = 2);
SELECT pg_temp.chk('check: Nile employee ticks a free-text row',
  (public.check_routine_item((SELECT (i ->> 'id')::uuid FROM jsonb_array_elements(public.my_today() -> 'items') i
                               WHERE i ->> 'title_en' = 'Glass of water')) -> 'progress' ->> 'done')::int = 1);
RESET ROLE;

-- ═══ 5. HR can't edit public rows; hide / pin per company ═══
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
WITH u AS (UPDATE public.content_items SET title_en = 'HACKED' WHERE company_id IS NULL RETURNING 1)
SELECT pg_temp.chk('rls: HR direct UPDATE of a shared article changes nothing', count(*) = 0) FROM u;
SELECT pg_temp.err('author: HR cannot save over a public article',
  $q$SELECT public.save_content_item('{"id": "00000000-0000-0000-0002-000000000005", "title_en": "x"}')$q$,
  'public_item_read_only');
SELECT pg_temp.err('author: HR cannot unpublish a public article for everyone',
  $q$SELECT public.set_library_status('content', '00000000-0000-0000-0002-000000000005', 'draft')$q$,
  'public_item_read_only');
SELECT pg_temp.err('author: HR cannot edit a public exercise',
  $q$SELECT public.save_exercise('{"id": "00000000-0000-0000-0099-000000000001", "name_en": "x"}')$q$,
  'public_item_read_only');
SELECT pg_temp.err('author: HR cannot create a public exercise',
  $q$SELECT public.save_exercise('{"name_en": "x", "public": true}')$q$, 'public_item_read_only');
SELECT pg_temp.chk('library: HR hides a public article for Wellhouse only',
  (public.hr_set_library_pref('content', '00000000-0000-0000-0002-000000000005', true) ->> 'hidden')::boolean);
SELECT pg_temp.chk('library: HR still sees it, flagged hidden',
  EXISTS (SELECT 1 FROM jsonb_array_elements(public.library_list('content', 'public')) x
           WHERE x ->> 'id' = '00000000-0000-0000-0002-000000000005' AND (x ->> 'hidden')::boolean));
SELECT pg_temp.err('library: own items are hidden via status, not prefs',
  $q$SELECT public.hr_set_library_pref('content', '00000000-0000-0000-0024-000000000001', true)$q$,
  'hide_public_items_only');
-- (Reads after a write go in their own statement: STABLE functions see the
-- snapshot taken when the statement started.)
SELECT pg_temp.chk('library: pin saved',
  (public.hr_set_library_pref('exercise', '00000000-0000-0000-0020-000000000014', NULL, true) ->> 'pinned')::boolean);
SELECT pg_temp.chk('library: pinning puts the item first',
  (public.library_list('exercise') -> 0 ->> 'id') = '00000000-0000-0000-0020-000000000014');
SELECT pg_temp.chk('copy: "Use this" makes a private, editable copy of a public exercise',
  (SELECT e.company_id = current_setting('t.wh')::uuid AND e.copied_from = '00000000-0000-0000-0099-000000000001'
     FROM public.hr_copy_exercise('00000000-0000-0000-0099-000000000001') e));
SELECT pg_temp.chk('copy: "Use this" copies a public routine with its rows',
  (SELECT (d -> 'routine' ->> 'company_id') = current_setting('t.wh')
          AND jsonb_array_length(d -> 'items') = 1 AND (d -> 'routine' ->> 'can_edit')::boolean
     FROM public.hr_copy_routine('00000000-0000-0000-0099-000000000002') d));
SELECT pg_temp.chk('author: HR writes a private fact (draft)',
  (SELECT c.company_id = current_setting('t.wh')::uuid AND c.kind = 'fact' AND NOT c.published
     FROM public.save_content_item('{"kind": "fact", "title_en": "Stand up", "body_en": "Short fact."}') c));
SELECT pg_temp.err('author: a fact over 300 characters is refused',
  format($q$SELECT public.save_content_item('{"kind": "fact", "title_en": "x", "body_en": "%s"}')$q$, repeat('a', 301)),
  'fact_too_long');
RESET ROLE;
SELECT pg_temp.chk('rls: the shared article title is unchanged',
  (SELECT title_en FROM public.content_items WHERE id = '00000000-0000-0000-0002-000000000005') <> 'HACKED');

SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('library: Wellhouse employee no longer sees the hidden article',
  NOT EXISTS (SELECT 1 FROM public.content_items WHERE id = '00000000-0000-0000-0002-000000000005')
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.library_list('content')) x
                   WHERE x ->> 'id' = '00000000-0000-0000-0002-000000000005'));
SELECT pg_temp.chk('library: Wellhouse employee sees the HR article and facts, not the draft fact',
  (SELECT count(*) FROM public.content_items WHERE company_id = current_setting('t.wh')::uuid) = 3);
RESET ROLE;
SELECT pg_temp.act(current_setting('t.ngemp')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('library: Nile employee still sees the article Wellhouse hid',
  EXISTS (SELECT 1 FROM public.content_items WHERE id = '00000000-0000-0000-0002-000000000005'));
RESET ROLE;

-- ═══ 6. Names only with opt-in; 5-person floor on teams ═════
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('people: HR sees only the two people who share with HR (Amira, Yusuf)',
  (SELECT array_agg(x ->> 'display_name' ORDER BY x ->> 'display_name')
     FROM jsonb_array_elements(public.hr_routine_people('14d') -> 'people') x) = ARRAY['Amira Hassan', 'Yusuf Naguib']
  AND (public.hr_routine_people('14d') ->> 'not_shared')::int = 5,
  public.hr_routine_people('14d') ::text);
SELECT pg_temp.chk('report: every team is under 5 → one "small teams" row, no team names',
  jsonb_array_length(public.hr_routine_report('14d') -> 'by_team') = 1
  AND (public.hr_routine_report('14d') -> 'by_team' -> 0 ->> 'small')::boolean
  AND (public.hr_routine_report('14d') -> 'by_team' -> 0 ->> 'name') IS NULL,
  public.hr_routine_report('14d') ->> 'by_team');
SELECT pg_temp.chk('report: no person''s name anywhere in the report',
  public.hr_routine_report('90d')::text !~ '(Amira|Yusuf|Lina|Omar|Nadia|Sara|Fresh)');
SELECT pg_temp.chk('report: by_exercise ranks exercises with done ≤ due',
  jsonb_array_length(public.hr_routine_report('14d') -> 'by_exercise') >= 10
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.hr_routine_report('14d') -> 'by_exercise') x
                   WHERE (x ->> 'done')::int > (x ->> 'due')::int));
SELECT pg_temp.chk('report: by_hour has 24 buckets',
  jsonb_array_length(public.hr_routine_report('14d') -> 'by_hour') = 24);
SELECT set_config('t.rep_today_done', public.hr_routine_report('7d') -> 'today' ->> 'done', true);
SELECT set_config('t.rep_14_due', public.hr_routine_report('14d') -> 'totals' ->> 'due', true);
RESET ROLE;
SELECT pg_temp.chk('report: today.done equals the ticks in the table',
  current_setting('t.rep_today_done')::int = (SELECT count(*) FROM public.routine_checks c JOIN public.profiles p ON p.id = c.user_id
                                              WHERE c.company_id = current_setting('t.wh')::uuid AND c.check_date = DATE '2026-11-09'
                                                AND p.onboarded AND p.deleted_at IS NULL));
-- Hand count of "due" over 14 days: per workday, (members) × (items that day):
-- every workday 8 Desk Day items + 3 split items = 11, from 27 Oct to 9 Nov
-- (10 workdays), 7 onboarded members (6 demo + Fresh).
SELECT pg_temp.chk('report: 14-day due equals members × items × workdays (7 × 11 × 10 = 770)',
  current_setting('t.rep_14_due')::int = 770, current_setting('t.rep_14_due'));

SELECT pg_temp.act(current_setting('t.omar')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('board: named board shows opted-in people only (Amira, Lina, Nadia)',
  NOT (public.recognition_board('week')::text ~ '(Omar|Yusuf|Sara|Fresh)')
  AND jsonb_array_length(public.recognition_board('week') -> 'named' -> 'top') > 0,
  public.recognition_board('week') ->> 'named');
SELECT pg_temp.chk('board: no team shown on its own while every team is under 5',
  jsonb_array_length(public.recognition_board('week') -> 'teams') = 0);
SELECT pg_temp.chk('board: no exercise / health data in the board',
  NOT (public.recognition_board('week')::text ~ '(body_areas|helps|Neck|exercise)'));
RESET ROLE;

-- Five more people in Engineering: it reaches the floor, but Finance (2) +
-- People & Ops (2) would then be 4 people that "company total minus
-- Engineering" exposes. Sprint 3 (20261111000001) folds Engineering into
-- the hidden group instead: one "small" row of everyone, no team named.
-- (supabase/tests/reminders_broadcasts_teams_checks.sql covers the case
-- where a team does stay on its own.)
SELECT pg_temp.mk_user('eng' || g || '@check.local', 'WH-4782', 'Eng ' || g, 'employee',
                       '00000000-0000-0000-0001-000000000001') FROM generate_series(1, 5) g;
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('report: Engineering (8) is folded while the 4 others would be exposed by subtraction',
  jsonb_array_length(public.hr_routine_report('14d') -> 'by_team') = 1
  AND (public.hr_routine_report('14d') -> 'by_team' -> 0 ->> 'small')::boolean
  AND (public.hr_routine_report('14d') -> 'by_team' -> 0 ->> 'members')::int = 12
  AND (public.hr_routine_report('14d') ->> 'teams_folded')::int = 1
  AND (public.hr_routine_report('14d') ->> 'breakdown_suppressed')::boolean
  AND NOT (public.hr_routine_report('14d') ->> 'small_teams_hidden')::boolean,
  public.hr_routine_report('14d') ->> 'by_team');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.omar')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('board: Engineering is folded too (no team on its own), no names in it',
  jsonb_array_length(public.recognition_board('week') -> 'teams') = 0
  AND NOT ((public.recognition_board('week') -> 'teams')::text ~ 'display_name'));
RESET ROLE;

-- Settings switch things off.
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('settings: recognition off saved',
  (public.hr_set_company_settings('{"recognition": "off"}') ->> 'recognition') = 'off');
SELECT pg_temp.chk('settings: recognition off → board disabled, no names',
  NOT (public.recognition_board() ->> 'enabled')::boolean AND public.recognition_board() -> 'named' = 'null'::jsonb);
SELECT pg_temp.chk('settings: teams-only saved',
  (public.hr_set_company_settings('{"recognition": "teams"}') ->> 'recognition') = 'teams');
SELECT pg_temp.chk('settings: teams-only mode has a team board and no named board',
  public.recognition_board() -> 'named' = 'null'::jsonb AND (public.recognition_board() ->> 'enabled')::boolean);
SELECT pg_temp.chk('settings: HR people view off saved',
  NOT (public.hr_set_company_settings('{"hr_people_view": false}') ->> 'hr_people_view')::boolean);
SELECT pg_temp.chk('settings: HR people view off → no names',
  NOT (public.hr_routine_people() ->> 'enabled')::boolean
  AND jsonb_array_length(public.hr_routine_people() -> 'people') = 0);
SELECT pg_temp.err('settings: unknown key refused', $q$SELECT public.hr_set_company_settings('{"foo": 1}')$q$, 'unknown_setting');
SELECT pg_temp.err('settings: bad timezone refused', $q$SELECT public.hr_set_company_settings('{"timezone": "Mars/Base"}')$q$, 'invalid_setting');
SELECT pg_temp.err('settings: bad recognition value refused', $q$SELECT public.hr_set_company_settings('{"recognition": "loud"}')$q$, 'invalid_setting');
SELECT pg_temp.err('settings: min_cohort under 5 refused', $q$SELECT public.hr_set_company_settings('{"min_cohort": 3}')$q$, 'invalid_setting');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.err('settings: an employee cannot change company settings',
  $q$SELECT public.hr_set_company_settings('{"recognition": "named"}')$q$, 'not_authorized');
SELECT pg_temp.err('report: an employee cannot read the HR report', $q$SELECT public.hr_routine_report()$q$, 'not_authorized');
SELECT pg_temp.err('people: an employee cannot read the HR people view', $q$SELECT public.hr_routine_people()$q$, 'not_authorized');
RESET ROLE;
SELECT pg_temp.act(current_setting('t.omar')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('prefs: default out of both opt-ins',
  NOT (public.my_prefs() ->> 'recognition_opt_in')::boolean AND NOT (public.my_prefs() ->> 'share_with_hr')::boolean);
SELECT pg_temp.chk('prefs: opting in returns consent v2',
  (public.set_my_prefs('{"recognition_opt_in": true}') ->> 'consent_version') = 'v2');
SELECT pg_temp.chk('prefs: opt-in time recorded',
  (public.my_prefs() ->> 'recognition_opt_in')::boolean AND public.my_prefs() ->> 'recognition_opt_in_at' IS NOT NULL);
SELECT pg_temp.err('prefs: unknown key refused', $q$SELECT public.set_my_prefs('{"role": "hr_admin"}')$q$, 'unknown_pref');
SELECT pg_temp.chk('prefs: muted items saved', jsonb_array_length(
  public.set_my_prefs('{"muted_item_ids": ["00000000-0000-0000-0022-000000000001"]}') -> 'muted_item_ids') = 1);
RESET ROLE;

-- ═══ 7. Default weekly habit on/off; HR's own 2-week challenge ═══
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT public.hr_set_company_settings('{"weekly_habit_enabled": false}') IS NOT NULL;
RESET ROLE;
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT public.my_habit_challenge() IS NOT NULL;
RESET ROLE;
SELECT pg_temp.chk('habit: weekly default off → no default booked this week',
  NOT EXISTS (SELECT 1 FROM public.challenges WHERE company_id = current_setting('t.wh')::uuid
               AND kind = 'habit' AND start_date = DATE '2026-11-08'));
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT public.hr_set_company_settings('{"weekly_habit_enabled": true}') IS NOT NULL;
SELECT public.hr_habit_challenges() IS NOT NULL;
RESET ROLE;
SELECT pg_temp.chk('habit: back on → this week gets a public default',
  EXISTS (SELECT 1 FROM public.challenges c JOIN public.challenge_templates t ON t.id = c.template_id
           WHERE c.company_id = current_setting('t.wh')::uuid AND c.start_date = DATE '2026-11-08'
             AND c.payload ->> 'auto' = 'true' AND t.company_id IS NULL));
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT public.hr_set_company_settings('{"weekly_habit_enabled": false}') IS NOT NULL;
RESET ROLE;
SELECT pg_temp.chk('habit: switching off removes the untouched default',
  NOT EXISTS (SELECT 1 FROM public.challenges WHERE company_id = current_setting('t.wh')::uuid
               AND kind = 'habit' AND start_date = DATE '2026-11-08'));

SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('t.tpl', (public.hr_save_challenge_template(
  '{"title_en": "Steps after lunch", "weeks": 2, "payload": {"action_en": "Walk 10 minutes after lunch.", "category": "movement"}}')).id::text, true);
SELECT pg_temp.chk('challenge: 2 weeks defaults to 8 of 10 days, movement badge',
  (SELECT t.target = 8 AND t.default_window_days = 10 AND t.payload ->> 'badge_icon' = 'activity'
          AND t.company_id = current_setting('t.wh')::uuid
     FROM public.challenge_templates t WHERE t.id = current_setting('t.tpl')::uuid));
SELECT pg_temp.err('challenge: 5 weeks refused',
  $q$SELECT public.hr_save_challenge_template('{"title_en": "x", "weeks": 5, "payload": {"action_en": "y"}}')$q$, 'bad_weeks');
SELECT pg_temp.err('challenge: HR cannot edit a public template',
  format($q$SELECT public.hr_save_challenge_template('{"id": "%s", "title_en": "x"}')$q$,
         (SELECT id FROM public.challenge_templates WHERE slug = 'habit-water')), 'public_item_read_only');
SELECT pg_temp.chk('challenge: scheduled from Sun 29 Nov it runs to Thu 10 Dec, 10 workdays',
  (SELECT c.end_date = DATE '2026-12-10' AND c.duration_days = 10 AND c.goal_value = 8
     FROM public.hr_schedule_habit_challenge(current_setting('t.tpl')::uuid, DATE '2026-11-29') c));
SELECT pg_temp.err('challenge: overlapping weeks are refused',
  format($q$SELECT public.hr_schedule_habit_challenge('%s', DATE '2026-12-06')$q$, current_setting('t.tpl')), 'habit_week_taken');
SELECT pg_temp.chk('challenge: HR picker lists it as a company template with 2 weeks',
  EXISTS (SELECT 1 FROM jsonb_array_elements(public.library_list('challenge_template', 'company')) x
           WHERE x ->> 'id' = current_setting('t.tpl') AND (x ->> 'weeks')::int = 2));
RESET ROLE;

SELECT set_config('wellness.now', '2026-12-04 08:00:00+00', true);   -- Friday in week 1
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT pg_temp.chk('challenge: 10 workday dates, Friday can''t be logged',
  (public.my_habit_challenge() ->> 'days_total')::int = 10
  AND jsonb_array_length(public.my_habit_challenge() -> 'days') = 10
  AND NOT (public.my_habit_challenge() ->> 'can_log')::boolean
  AND (public.my_habit_challenge() ->> 'weeks')::int = 2,
  public.my_habit_challenge()::text);
SELECT pg_temp.err('challenge: logging on Friday is refused',
  format($q$SELECT public.log_habit('%s')$q$, (public.my_habit_challenge() -> 'challenge' ->> 'id')), 'not_a_workday');
RESET ROLE;
SELECT set_config('wellness.now', '2026-12-08 08:00:00+00', true);   -- Tuesday week 2
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('t.ch', public.my_habit_challenge() -> 'challenge' ->> 'id', true);
SELECT pg_temp.chk('challenge: Tuesday of week 2 → "1 of 10" after one log, 8 workdays elapsed',
  (SELECT (s ->> 'my_count')::int = 1 AND (s ->> 'elapsed')::int = 8 AND (s ->> 'days_total')::int = 10
     FROM public.log_habit(current_setting('t.ch')::uuid) s));
RESET ROLE;
INSERT INTO public.habit_logs (challenge_id, user_id, company_id, log_date)
SELECT current_setting('t.ch')::uuid, current_setting('t.amira')::uuid, current_setting('t.wh')::uuid, d
  FROM unnest(ARRAY[DATE '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-06', '2026-12-07']) d
ON CONFLICT DO NOTHING;
SELECT set_config('wellness.now', '2026-12-13 08:00:00+00', true);   -- after the challenge
SELECT pg_temp.act(current_setting('t.amira')::uuid);
SET LOCAL ROLE authenticated;
SELECT public.my_habit_challenge() IS NOT NULL;
RESET ROLE;
SELECT pg_temp.chk('challenge: 8 of 10 days earns the reward once the two weeks end',
  EXISTS (SELECT 1 FROM public.awarded_rewards WHERE competition_id = current_setting('t.ch')::uuid
           AND profile_id = current_setting('t.amira')::uuid));
SELECT set_config('wellness.now', '2026-11-09 08:00:00+00', true);

-- ═══ 8. Import from sheet rows ══════════════════════════════
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('t.routines_before', (SELECT count(*) FROM public.routines)::text, true);
SELECT set_config('t.import', public.hr_import_routine(
  '{"title_en": "Coach sheet"}',
  '[{"row": 2, "time": "9:30", "exercise": "Neck tilt", "sets_reps": "2 × 10", "weekday": ""},
    {"row": 3, "time": "2:15 pm", "exercise": "Arm circles", "exercise_ar": "لف الدراع", "sets_reps": "2 × 15",
     "weekday": "الأحد", "body_areas": "Shoulders, arms", "youtube": "https://youtu.be/dQw4w9WgXcQ"},
    {"row": 4, "time": "25:00", "exercise": "Bad time"},
    {"row": 5, "time": "10:00", "exercise": ""},
    {"row": 6, "time": "11:00", "exercise": "Friday thing", "weekday": "Friday"},
    {"row": 7, "time": "11:00", "exercise": "Arm circles", "weekday": "mon", "youtube": "not a link"}]', true)::text, true);
SELECT pg_temp.chk('import: dry run reports 3 items, 1 new exercise, 3 problems, 1 warning',
  (current_setting('t.import')::jsonb ->> 'items')::int = 3
  AND (current_setting('t.import')::jsonb ->> 'exercises_created')::int = 1
  AND (current_setting('t.import')::jsonb ->> 'exercises_matched')::int = 2
  AND jsonb_array_length(current_setting('t.import')::jsonb -> 'problems') = 3
  AND jsonb_array_length(current_setting('t.import')::jsonb -> 'warnings') = 1,
  current_setting('t.import'));
SELECT pg_temp.chk('import: dry run saves nothing',
  (SELECT count(*) FROM public.routines)::text = current_setting('t.routines_before')
  AND NOT EXISTS (SELECT 1 FROM public.exercises WHERE name_en = 'Arm circles'));
SELECT set_config('t.import2', public.hr_import_routine(
  '{"title_en": "Coach sheet", "assign": true}',
  '[{"row": 2, "time": "9:30", "exercise": "neck TILT", "sets_reps": "2 × 10"},
    {"row": 3, "time": "2:15 pm", "exercise": "Arm circles", "weekday": "sun", "youtube": "dQw4w9WgXcQ"}]')::text, true);
SELECT pg_temp.chk('import: saves the routine, matches names case-insensitively, creates the new one with its video, assigns it',
  (SELECT count(*) FROM public.routine_items WHERE routine_id = (current_setting('t.import2')::jsonb ->> 'routine_id')::uuid) = 2
  AND EXISTS (SELECT 1 FROM public.exercises WHERE name_en = 'Arm circles' AND media_youtube_id = 'dQw4w9WgXcQ'
               AND company_id = current_setting('t.wh')::uuid)
  AND (SELECT at_time FROM public.routine_items WHERE routine_id = (current_setting('t.import2')::jsonb ->> 'routine_id')::uuid
        AND weekday = 0) = TIME '14:15'
  AND current_setting('t.import2')::jsonb ->> 'assignment_id' IS NOT NULL,
  current_setting('t.import2'));
SELECT set_config('t.routines_before', (SELECT count(*) FROM public.routines)::text, true);
SELECT pg_temp.chk('import: a sheet where every row has a problem saves nothing, not even an empty routine',
  (SELECT NOT (s ->> 'saved')::boolean AND s ->> 'routine_id' IS NULL AND jsonb_array_length(s -> 'problems') = 2
     FROM public.hr_import_routine('{"title_en": "All bad"}',
            '[{"row": 2, "exercise": ""}, {"row": 3, "exercise": "x", "time": "99:99"}]') s));
SELECT pg_temp.chk('import: …and the routine count is unchanged',
  (SELECT count(*) FROM public.routines)::text = current_setting('t.routines_before'));
SELECT set_config('t.import3', public.hr_import_routine('{"title_en": "Clips"}', format(
  '[{"row": 2, "time": "10:00", "exercise": "Clip move", "video_path": "%s/exercises/clip.MOV", "youtube": "dQw4w9WgXcQ"},
    {"row": 3, "time": "11:00", "exercise": "Other clip", "video_path": "%s/exercises/x.mp4"}]',
  current_setting('t.wh'), current_setting('t.ng'))::jsonb)::text, true);
SELECT pg_temp.chk('import: an uploaded clip in our folder becomes the exercise video (wins over YouTube)',
  EXISTS (SELECT 1 FROM public.exercises WHERE name_en = 'Clip move' AND media_type = 'video'
           AND media_bucket = 'company-media' AND media_mime = 'video/quicktime' AND media_youtube_id IS NULL));
SELECT pg_temp.chk('import: a clip path in another company''s folder is ignored with a warning',
  current_setting('t.import3')::jsonb -> 'warnings' @> '[{"row": 3, "reason": "bad_video_path"}]'
  AND EXISTS (SELECT 1 FROM public.exercises WHERE name_en = 'Other clip' AND media_type IS NULL),
  current_setting('t.import3'));
RESET ROLE;

-- Performance smoke test: the heaviest RPCs on the demo data.
SELECT pg_temp.act(current_setting('t.sara')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('t.t0', clock_timestamp()::text, true);
SELECT public.hr_routine_report('90d') IS NOT NULL AS report_90d;
SELECT public.recognition_board('week') IS NOT NULL AS board;
SELECT public.my_today() IS NOT NULL AS today;
SELECT public.my_scorecard() IS NOT NULL AS scorecard;
SELECT pg_temp.chk('perf: report 90d + board + today + scorecard under 2 s on demo data',
  clock_timestamp() - current_setting('t.t0')::timestamptz < interval '2 seconds',
  (clock_timestamp() - current_setting('t.t0')::timestamptz)::text);
RESET ROLE;

ROLLBACK;
