-- Wellness+ sprint 4 — paste ONCE into the Supabase SQL editor (project ewfqkhfoodijhxaqiome), then Run.
-- NEW empty query tab, nothing highlighted; confirm the "destructive operations" warning (it replaces functions).
-- Contains 20261115000001_sprint4_sections_challenges_visibility.sql: hide a routine row, several challenges
-- at once with their own dates, challenges that count from routine ticks, a note to people when a challenge
-- starts, and the company switch "Everyone takes part". No new extension, key or job.
-- One transaction: if anything fails, nothing changes. Safe to run again.

BEGIN;

DO $$
DECLARE missing TEXT[] := '{}';
BEGIN
  IF to_regclass('public.routine_items') IS NULL THEN missing := array_append(missing, 'sprint 2 (routines)'::text); END IF;
  IF to_regclass('public.profile_prefs') IS NULL THEN missing := array_append(missing, 'sprint 2 (profile_prefs)'::text); END IF;
  IF to_regclass('public.push_subscriptions') IS NULL THEN missing := array_append(missing, 'sprint 3 (push_subscriptions)'::text); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cohort_shown_keys') THEN missing := array_append(missing, 'sprint 3 (cohort_shown_keys)'::text); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'default_habit_paused') THEN missing := array_append(missing, 'sprint 3 (default_habit_paused)'::text); END IF;
  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'Stopped, nothing changed. Missing on this database: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- Sprint 4 (client meeting 15 Nov 2026): Today in sections, hide an
-- exercise, several challenges at once, challenges that count from routine
-- ticks, and a company switch that makes everyone visible.
-- Plan + API: docs/sprints/2026-11-15-sprint-4.md
--
-- Idempotent: safe to run twice. Builds on 20261111000001.
--
-- §0 What changes in existing functions (each is re-created in full in §2):
--   company_settings_json        + everyone_visible; hr_people_view is on while it is
--   hr_set_company_settings      accepts everyone_visible (boolean)
--   my_prefs / set_my_prefs      + visibility_notice_seen(_at)
--   routine_due_items            a hidden item is not due from the day it was hidden
--   check_routine_item           ticks feed challenges built from routine items
--   recognition_board            everyone counts as opted in under everyone_visible
--   hr_routine_people            everyone is listed under everyone_visible
--   hr_schedule_habit_challenge  several challenges at once (only the same template
--                                can't overlap itself); tells the people it is for
--   hr_cancel_habit_challenge    also ends a running challenge
--   log_habit                    refuses a challenge that counts by itself
-- New: hr_set_routine_item_hidden, hr_schedule_challenge, my_habit_challenges,
--      habit_challenge_state, sync_routine_challenges, notify_new_challenge.

-- ═══════════════════════════════════════════════════════════════
-- 1. New columns and functions
-- ═══════════════════════════════════════════════════════════════

-- HR hides one row of a routine without deleting it (and its history).
ALTER TABLE public.routine_items
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

-- When the employee saw the "your company shows everyone" notice.
ALTER TABLE public.profile_prefs
  ADD COLUMN IF NOT EXISTS visibility_notice_seen_at TIMESTAMPTZ;

-- Hide / show one routine item. Hidden: gone from Today, the week view,
-- reminders and the due counts from today on; earlier days keep it.
CREATE OR REPLACE FUNCTION public.hr_set_routine_item_hidden(p_item_id UUID, p_hidden BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_routine UUID;
  v_owner   UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT r.id, r.company_id INTO v_routine, v_owner
    FROM public.routine_items i JOIN public.routines r ON r.id = i.routine_id
   WHERE i.id = p_item_id;
  IF v_routine IS NULL THEN RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.assert_library_writer(v_owner);

  UPDATE public.routine_items SET
    hidden_at  = CASE WHEN COALESCE(p_hidden, true) THEN COALESCE(hidden_at, now()) ELSE NULL END,
    updated_at = now()
   WHERE id = p_item_id;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(),
          CASE WHEN COALESCE(p_hidden, true) THEN 'routine.item_hidden' ELSE 'routine.item_shown' END,
          'routine_item', p_item_id, 'info', jsonb_build_object('routine_id', v_routine));
  RETURN public.routine_detail(v_routine);
END;
$$;

-- An in-app note to everyone a new challenge is for.
CREATE OR REPLACE FUNCTION public.notify_new_challenge(p_challenge_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c   public.challenges%ROWTYPE;
  v_n INT;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = p_challenge_id;
  IF c.id IS NULL OR c.company_id IS NULL OR NOT c.active THEN RETURN 0; END IF;
  INSERT INTO public.notifications (user_id, company_id, kind, title_en, title_ar, body_en, body_ar, sent_at)
  SELECT p.id, c.company_id, 'challenge_update',
         'New challenge: ' || c.title_en,
         'تحدي جديد: ' || COALESCE(c.title_ar, c.title_en),
         COALESCE(nullif(btrim(c.description_en), ''), 'Open the app to see it.'),
         COALESCE(nullif(btrim(c.description_ar), ''), nullif(btrim(c.description_en), ''), 'افتح التطبيق وشوفه.'),
         now()
    FROM public.profiles p
   WHERE p.company_id = c.company_id AND p.deleted_at IS NULL AND p.onboarded
     AND (c.team_id IS NULL OR p.team_id = c.team_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Challenges built from routine items: a day counts by itself once every
-- linked item due that day is ticked (and stops counting on an untick).
CREATE OR REPLACE FUNCTION public.sync_routine_challenges(p_user_id UUID, p_day DATE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID;
  v_team    UUID;
  c         RECORD;
  v_ids     UUID[];
  v_due     INT;
  v_done    INT;
BEGIN
  SELECT company_id, team_id INTO v_company, v_team FROM public.profiles WHERE id = p_user_id;
  IF v_company IS NULL OR EXTRACT(DOW FROM p_day) >= 5 THEN RETURN; END IF;

  FOR c IN
    SELECT ch.id, ch.payload FROM public.challenges ch
     WHERE ch.company_id = v_company AND ch.kind = 'habit' AND ch.active
       AND ch.payload ? 'routine_item_ids'
       AND ch.start_date <= p_day AND ch.end_date >= p_day
       AND (ch.team_id IS NULL OR ch.team_id = v_team)
  LOOP
    v_ids := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(c.payload -> 'routine_item_ids') x);
    SELECT count(*), count(k.id) INTO v_due, v_done
      FROM public.routine_due_items(v_company, v_team, p_day) d
      LEFT JOIN public.routine_checks k
        ON k.item_id = d.item_id AND k.user_id = p_user_id AND k.check_date = p_day
     WHERE d.item_id = ANY (v_ids);
    IF v_due > 0 AND v_done >= v_due THEN
      INSERT INTO public.habit_logs (challenge_id, user_id, company_id, log_date)
      VALUES (c.id, p_user_id, v_company, p_day)
      ON CONFLICT (challenge_id, user_id, log_date) DO NOTHING;
      INSERT INTO public.challenge_participants (challenge_id, user_id, company_id)
      VALUES (c.id, p_user_id, v_company)
      ON CONFLICT (challenge_id, user_id) DO NOTHING;
    ELSE
      DELETE FROM public.habit_logs
       WHERE challenge_id = c.id AND user_id = p_user_id AND log_date = p_day;
    END IF;
  END LOOP;
END;
$$;

-- One challenge as the employee app shows it. Same keys as
-- my_habit_challenge(), plus auto_from_routine and routine_items.
CREATE OR REPLACE FUNCTION public.habit_challenge_state(p_challenge_id UUID, p_user_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c         public.challenges%ROWTYPE;
  v_company UUID;
  v_team    UUID;
  v_today   DATE;
  v_target  DATE;
  v_days    DATE[];
  v_elapsed INT;
  v_members INT;
  v_logs    INT;
  v_dates   JSONB;
  v_auto    BOOLEAN;
  v_ids     UUID[] := '{}';
  v_items   JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = p_challenge_id;
  IF c.id IS NULL THEN RETURN NULL; END IF;
  SELECT company_id, team_id INTO v_company, v_team FROM public.profiles WHERE id = p_user_id;
  v_today   := public.company_today(c.company_id);
  v_auto    := c.payload ? 'routine_item_ids';
  v_target  := CASE WHEN v_auto THEN v_today ELSE public.habit_target_date(c.payload, v_today) END;
  v_days    := public.habit_workdays(c.start_date, c.end_date);
  v_elapsed := (SELECT count(*)::int FROM unnest(v_days) d WHERE d <= v_target);
  v_members := public.habit_members(c.company_id, c.team_id);

  SELECT COALESCE(jsonb_agg(log_date ORDER BY log_date), '[]'::jsonb) INTO v_dates
    FROM public.habit_logs WHERE challenge_id = c.id AND user_id = p_user_id;
  SELECT COUNT(*) INTO v_logs FROM public.habit_logs
   WHERE challenge_id = c.id AND log_date <= LEAST(v_target, c.end_date);

  IF v_auto THEN
    v_ids := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(c.payload -> 'routine_item_ids') x);
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id',        i.id,
             'title_en',  COALESCE(nullif(btrim(i.title_en), ''), e.name_en),
             'title_ar',  COALESCE(nullif(btrim(i.title_ar), ''), e.name_ar, nullif(btrim(i.title_en), ''), e.name_en),
             'due_today', EXISTS (SELECT 1 FROM public.routine_due_items(v_company, v_team, v_today) d
                                   WHERE d.item_id = i.id),
             'checked',   EXISTS (SELECT 1 FROM public.routine_checks k
                                   WHERE k.item_id = i.id AND k.user_id = p_user_id AND k.check_date = v_today))
           ORDER BY i.at_time NULLS LAST, i.sort_order), '[]'::jsonb)
      INTO v_items
      FROM public.routine_items i
      LEFT JOIN public.exercises e ON e.id = i.exercise_id
     WHERE i.id = ANY (v_ids);
  END IF;

  RETURN jsonb_build_object(
    'status',        p_status,
    'challenge',     jsonb_build_object(
                       'id', c.id, 'title_en', c.title_en, 'title_ar', c.title_ar,
                       'start_date', c.start_date, 'end_date', c.end_date,
                       'team_id', c.team_id, 'payload', c.payload),
    'target_date',   v_target,
    'can_log',       NOT v_auto AND p_status = 'active' AND v_target BETWEEN c.start_date AND c.end_date
                     AND EXTRACT(DOW FROM v_target) < 5,
    'logged_target', v_dates @> to_jsonb(v_target),
    'my_dates',      v_dates,
    'my_count',      jsonb_array_length(v_dates),
    'success_days',  COALESCE((c.payload ->> 'success_days')::INT, 4),
    'days_total',    cardinality(v_days),
    'days',          to_jsonb(v_days),
    'weeks',         public.habit_weeks(c.payload),
    'elapsed',       v_elapsed,
    'team_pct',      CASE WHEN v_members >= public.hr_min_cohort(c.company_id) AND v_elapsed > 0
                          THEN round(100.0 * v_logs / (v_members * v_elapsed)) END,
    'auto_from_routine', v_auto,
    'routine_items', v_items
  );
END;
$$;

-- Every challenge running or coming up for the caller (HR can run several
-- at once): { challenges: [ … same shape as my_habit_challenge() … ] },
-- running ones first.
CREATE OR REPLACE FUNCTION public.my_habit_challenges()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  v_today   DATE;
  v_ended   RECORD;
  v_out     JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RETURN jsonb_build_object('challenges', '[]'::jsonb);
  END IF;
  SELECT team_id INTO v_team FROM public.profiles WHERE id = v_uid;
  v_today := public.company_today(v_company);

  PERFORM public.ensure_default_habit_week(v_company);
  FOR v_ended IN
    SELECT id FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit'
       AND COALESCE(payload ->> 'finalized', 'false') <> 'true'
       AND end_date < v_today
  LOOP
    PERFORM public.finalize_habit_challenge(v_ended.id);
  END LOOP;

  WITH pool AS (
    SELECT c.id, c.start_date,
           CASE WHEN c.start_date <= v_today THEN 'active' ELSE 'upcoming' END AS status
      FROM public.challenges c
     WHERE c.company_id = v_company AND c.kind = 'habit' AND c.active
       AND (c.team_id IS NULL OR c.team_id = v_team)
       AND c.end_date + CASE WHEN c.payload ->> 'check_mode' = 'next_morning'
                              AND NOT (c.payload ? 'routine_item_ids') THEN 1 ELSE 0 END >= v_today
       AND NOT (COALESCE(c.payload ->> 'auto', 'false') = 'true'
                AND public.default_habit_paused(v_company, v_team, GREATEST(c.start_date, v_today)))
     ORDER BY (c.start_date > v_today), c.start_date DESC, c.created_at DESC
     LIMIT 20
  )
  SELECT COALESCE(jsonb_agg(public.habit_challenge_state(pool.id, v_uid, pool.status)
                            ORDER BY (pool.status = 'upcoming'), pool.start_date DESC), '[]'::jsonb)
    INTO v_out FROM pool;

  RETURN jsonb_build_object('challenges', v_out, 'today', v_today);
END;
$$;

-- HR: start a challenge with its own dates. Input keys:
--   template_id        a habit template (public or the company's), or
--   title_en, title_ar, action_en, action_ar   a challenge typed on the spot
--   routine_item_ids   uuid[] (optional): the day counts by itself when
--                      these routine items are ticked; no "Did it" button
--   start_date, end_date   any dates, at most 5 weeks apart, ≥ 1 workday
--   success_days       days needed (default: the template's, capped to the
--                      workdays in the window)
--   team_id            one team (default: everyone)
CREATE OR REPLACE FUNCTION public.hr_schedule_challenge(p_input JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_today   DATE;
  t         public.challenge_templates%ROWTYPE;
  v_tid     UUID;
  v_team    UUID;
  v_start   DATE;
  v_end     DATE;
  v_days    DATE[];
  v_n       INT;
  v_need    INT;
  v_ids     UUID[] := '{}';
  v_title   TEXT;
  v_title_ar TEXT;
  v_action  TEXT;
  v_action_ar TEXT;
  v_names   TEXT;
  v_names_ar TEXT;
  v_payload JSONB;
  v_row     public.challenges%ROWTYPE;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_today := public.company_today(v_company);

  BEGIN
    v_tid   := nullif(p_input ->> 'template_id', '')::uuid;
    v_team  := nullif(p_input ->> 'team_id', '')::uuid;
    v_start := nullif(p_input ->> 'start_date', '')::date;
    v_end   := nullif(p_input ->> 'end_date', '')::date;
    IF jsonb_typeof(p_input -> 'routine_item_ids') = 'array' THEN
      v_ids := ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(p_input -> 'routine_item_ids') x);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END;

  IF v_start IS NULL THEN RAISE EXCEPTION 'start_required' USING ERRCODE = '22023'; END IF;
  v_end := COALESCE(v_end, v_start + 4);
  IF v_end < v_start OR v_end - v_start > 34 THEN
    RAISE EXCEPTION 'bad_dates' USING ERRCODE = '22023';
  END IF;
  IF v_end < v_today THEN RAISE EXCEPTION 'week_in_the_past' USING ERRCODE = '22023'; END IF;
  v_days := public.habit_workdays(v_start, v_end);
  v_n := COALESCE(cardinality(v_days), 0);
  IF v_n = 0 THEN RAISE EXCEPTION 'no_workdays' USING ERRCODE = '22023'; END IF;

  IF v_team IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.teams WHERE id = v_team AND company_id = v_company) THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_tid IS NOT NULL THEN
    SELECT * INTO t FROM public.challenge_templates
     WHERE id = v_tid AND kind = 'habit' AND (company_id IS NULL OR company_id = v_company);
    IF t.id IS NULL THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
    IF t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'template_archived' USING ERRCODE = 'P0002'; END IF;
  END IF;

  IF cardinality(v_ids) > 20 THEN RAISE EXCEPTION 'too_many_items' USING ERRCODE = '22023'; END IF;
  IF cardinality(v_ids) > 0 THEN
    IF (SELECT count(*) FROM public.routine_items i JOIN public.routines r ON r.id = i.routine_id
         WHERE i.id = ANY (v_ids) AND r.company_id = v_company AND i.hidden_at IS NULL) <> cardinality(v_ids) THEN
      RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'P0002';
    END IF;
    SELECT string_agg(COALESCE(nullif(btrim(i.title_en), ''), e.name_en), ', ' ORDER BY i.at_time NULLS LAST, i.sort_order),
           string_agg(COALESCE(nullif(btrim(i.title_ar), ''), e.name_ar, nullif(btrim(i.title_en), ''), e.name_en), '، '
                      ORDER BY i.at_time NULLS LAST, i.sort_order)
      INTO v_names, v_names_ar
      FROM public.routine_items i LEFT JOIN public.exercises e ON e.id = i.exercise_id
     WHERE i.id = ANY (v_ids);
  END IF;

  v_title    := COALESCE(public.jtxt(p_input, 'title_en'), t.title_en);
  v_title_ar := COALESCE(public.jtxt(p_input, 'title_ar'), t.title_ar);
  IF v_title IS NULL THEN RAISE EXCEPTION 'title_required' USING ERRCODE = '22023'; END IF;
  IF length(v_title) > 80 OR length(COALESCE(v_title_ar, '')) > 80 THEN
    RAISE EXCEPTION 'title_too_long' USING ERRCODE = '22023';
  END IF;
  v_action    := COALESCE(public.jtxt(p_input, 'action_en'), t.payload ->> 'action_en',
                          CASE WHEN v_names IS NOT NULL THEN 'Tick these in today’s list: ' || v_names END);
  v_action_ar := COALESCE(public.jtxt(p_input, 'action_ar'), t.payload ->> 'action_ar',
                          CASE WHEN v_names_ar IS NOT NULL THEN 'علّم على دول في قايمة النهارده: ' || v_names_ar END);
  IF v_action IS NULL THEN RAISE EXCEPTION 'action_required' USING ERRCODE = '22023'; END IF;
  IF length(v_action) > 600 OR length(COALESCE(v_action_ar, '')) > 600 THEN
    RAISE EXCEPTION 'action_too_long' USING ERRCODE = '22023';
  END IF;

  v_need := COALESCE(
    CASE WHEN p_input ->> 'success_days' ~ '^\d{1,2}$' THEN (p_input ->> 'success_days')::int END,
    CASE WHEN t.payload ->> 'success_days' ~ '^\d{1,2}$' THEN (t.payload ->> 'success_days')::int END,
    t.target,
    CEIL(v_n * 0.8)::int);
  v_need := LEAST(GREATEST(v_need, 1), v_n);

  -- A default week the app put in gives way, as long as nobody logged a day.
  DELETE FROM public.challenges d
   WHERE d.company_id = v_company AND d.kind = 'habit'
     AND d.payload ->> 'auto' = 'true'
     AND d.start_date <= v_end AND d.end_date >= v_start
     AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.challenge_id = d.id);

  -- The same challenge can't run twice over the same days for the same people.
  IF EXISTS (SELECT 1 FROM public.challenges x
              WHERE x.company_id = v_company AND x.kind = 'habit' AND x.active
                AND x.start_date <= v_end AND x.end_date >= v_start
                AND (x.team_id IS NULL OR v_team IS NULL OR x.team_id = v_team)
                AND CASE WHEN v_tid IS NOT NULL THEN x.template_id = v_tid
                         ELSE x.template_id IS NULL AND lower(x.title_en) = lower(v_title) END) THEN
    RAISE EXCEPTION 'habit_week_taken' USING ERRCODE = '23P01', DETAIL = COALESCE(v_title_ar, v_title) || ' | ' || v_title;
  END IF;

  v_payload := (COALESCE(t.payload, '{}'::jsonb) - 'auto')
    || jsonb_build_object('weeks', LEAST(4, GREATEST(1, CEIL(v_n / 5.0)::int)), 'success_days', v_need,
                          'action_en', v_action, 'action_ar', COALESCE(v_action_ar, v_action),
                          'custom_dates', true);
  IF cardinality(v_ids) > 0 THEN
    v_payload := (v_payload - 'check_mode')
      || jsonb_build_object('routine_item_ids', to_jsonb(v_ids), 'auto_from_routine', true);
  END IF;

  INSERT INTO public.challenges (
    company_id, title_en, title_ar, description_en, description_ar,
    metric, goal_value, start_date, end_date, duration_days,
    badge_icon, badge_color, active, kind, template_id, team_id, payload)
  VALUES (
    v_company, v_title, v_title_ar, v_action, COALESCE(v_action_ar, v_action),
    'habit', v_need, v_start, v_end, v_n,
    COALESCE(t.payload ->> 'badge_icon', 'trophy'), COALESCE(t.payload ->> 'badge_color', '#F5B544'),
    true, 'habit', t.id, v_team, v_payload)
  RETURNING * INTO v_row;

  PERFORM public.notify_new_challenge(v_row.id);

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'challenge.habit_scheduled',
          COALESCE(t.slug, 'custom'), v_row.id, 'info',
          jsonb_build_object('start_date', v_start, 'end_date', v_end, 'team_id', v_team,
                             'workdays', v_n, 'routine_items', cardinality(v_ids)));
  RETURN to_jsonb(v_row) || jsonb_build_object('workdays', v_n, 'success_days', v_need);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Existing functions, patched (full bodies; changes marked in §0)
-- ═══════════════════════════════════════════════════════════════

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
    'hr_people_view',       COALESCE(c.settings ->> 'hr_people_view', 'false') = 'true'
                            OR COALESCE(c.settings ->> 'everyone_visible', 'false') = 'true',
    'everyone_visible',     COALESCE(c.settings ->> 'everyone_visible', 'false') = 'true',
    'quiet_hours',          COALESCE(c.settings ->> 'quiet_hours', 'true') <> 'false',
    'quiet_window',         '{"from": "20:00", "to": "08:00"}'::jsonb,
    'min_cohort',           public.hr_min_cohort(c.id))
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

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
    ELSIF v_key IN ('weekly_habit_enabled', 'hr_people_view', 'quiet_hours', 'everyone_visible') THEN
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

CREATE OR REPLACE FUNCTION public.my_prefs()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_out     JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
           'routine_reminders',     COALESCE(pp.routine_reminders, false),
           'muted_item_ids',        to_jsonb(COALESCE(pp.muted_item_ids, '{}'::uuid[])),
           'recognition_opt_in',    COALESCE(pp.recognition_opt_in, false),
           'recognition_opt_in_at', pp.recognition_opt_in_at,
           'share_with_hr',         COALESCE(pp.share_with_hr, false),
           'share_with_hr_at',      pp.share_with_hr_at,
           'visibility_notice_seen_at', pp.visibility_notice_seen_at,
           'consent_version',       p.consent_version)
    INTO v_out
    FROM public.profiles p
    LEFT JOIN public.profile_prefs pp ON pp.user_id = p.id
   WHERE p.id = v_uid;
  RETURN COALESCE(v_out, '{}'::jsonb) || jsonb_build_object(
    'company', public.company_settings_json(v_company)
               - ARRAY['company_id', 'today', 'now', 'weekday', 'min_cohort']);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_prefs(p_patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_key   TEXT;
  v_val   JSONB;
  v_muted UUID[];
BEGIN
  IF v_uid IS NULL OR public.auth_company_id() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid_pref' USING ERRCODE = '22023';
  END IF;
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_patch) LOOP
    IF v_key IN ('routine_reminders', 'recognition_opt_in', 'share_with_hr', 'visibility_notice_seen') THEN
      IF jsonb_typeof(v_val) <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_pref' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSIF v_key = 'muted_item_ids' THEN
      IF jsonb_typeof(v_val) <> 'array' OR jsonb_array_length(v_val) > 300 THEN
        RAISE EXCEPTION 'invalid_pref' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
      v_muted := ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(v_val) x);
    ELSE
      RAISE EXCEPTION 'unknown_pref' USING ERRCODE = '22023', DETAIL = v_key;
    END IF;
  END LOOP;

  INSERT INTO public.profile_prefs (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.profile_prefs pp SET
    routine_reminders = CASE WHEN p_patch ? 'routine_reminders'
                             THEN (p_patch ->> 'routine_reminders')::boolean ELSE pp.routine_reminders END,
    muted_item_ids    = CASE WHEN p_patch ? 'muted_item_ids' THEN v_muted ELSE pp.muted_item_ids END,
    recognition_opt_in_at = CASE WHEN NOT (p_patch ? 'recognition_opt_in') THEN pp.recognition_opt_in_at
                                 WHEN (p_patch ->> 'recognition_opt_in')::boolean
                                 THEN CASE WHEN pp.recognition_opt_in THEN pp.recognition_opt_in_at ELSE now() END
                                 ELSE NULL END,
    recognition_opt_in = CASE WHEN p_patch ? 'recognition_opt_in'
                              THEN (p_patch ->> 'recognition_opt_in')::boolean ELSE pp.recognition_opt_in END,
    share_with_hr_at  = CASE WHEN NOT (p_patch ? 'share_with_hr') THEN pp.share_with_hr_at
                             WHEN (p_patch ->> 'share_with_hr')::boolean
                             THEN CASE WHEN pp.share_with_hr THEN pp.share_with_hr_at ELSE now() END
                             ELSE NULL END,
    share_with_hr     = CASE WHEN p_patch ? 'share_with_hr'
                             THEN (p_patch ->> 'share_with_hr')::boolean ELSE pp.share_with_hr END,
    visibility_notice_seen_at = CASE WHEN p_patch -> 'visibility_notice_seen' = 'true'::jsonb
                                     THEN COALESCE(pp.visibility_notice_seen_at, now())
                                     ELSE pp.visibility_notice_seen_at END,
    updated_at        = now()
  WHERE pp.user_id = v_uid;

  IF p_patch -> 'recognition_opt_in' = 'true'::jsonb OR p_patch -> 'share_with_hr' = 'true'::jsonb THEN
    UPDATE public.profiles SET consent_version = 'v2'
     WHERE id = v_uid AND consent_version IS DISTINCT FROM 'v2';
  END IF;
  RETURN public.my_prefs();
END;
$$;

CREATE OR REPLACE FUNCTION public.routine_due_items(p_company_id UUID, p_team_id UUID, p_day DATE)
RETURNS TABLE (item_id UUID, routine_id UUID, assignment_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.routine_id, a.assignment_id
    FROM public.routine_assignments_for(p_company_id, p_team_id, p_day) a
    JOIN public.routines r ON r.id = a.routine_id
    JOIN public.routine_items i ON i.routine_id = r.id
   WHERE EXTRACT(DOW FROM p_day)::smallint = ANY (r.workdays)
     AND (i.weekday IS NULL OR i.weekday = EXTRACT(DOW FROM p_day)::int)
     AND i.created_at < (SELECT (p_day + 1)::timestamp AT TIME ZONE public.company_tz(p_company_id))
     AND (i.hidden_at IS NULL
          OR i.hidden_at >= (SELECT (p_day + 1)::timestamp AT TIME ZONE public.company_tz(p_company_id)));
$$;

CREATE OR REPLACE FUNCTION public.check_routine_item(p_item_id UUID, p_checked BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  v_today   DATE;
  v_item    public.routine_items%ROWTYPE;
  v_ex      public.exercises%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT p.team_id INTO v_team FROM public.profiles p
   WHERE p.id = v_uid AND p.company_id = v_company AND p.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_today := public.company_today(v_company);

  IF NOT EXISTS (SELECT 1 FROM public.routine_due_items(v_company, v_team, v_today) d
                  WHERE d.item_id = p_item_id) THEN
    RAISE EXCEPTION 'item_not_due_today' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(p_checked, true) THEN
    SELECT * INTO v_item FROM public.routine_items WHERE id = p_item_id;
    SELECT * INTO v_ex FROM public.exercises WHERE id = v_item.exercise_id;
    INSERT INTO public.routine_checks (company_id, user_id, routine_id, item_id, exercise_id,
                                       item_title, item_title_ar, check_date, checked_at)
    VALUES (v_company, v_uid, v_item.routine_id, v_item.id, v_item.exercise_id,
            COALESCE(nullif(btrim(v_item.title_en), ''), v_ex.name_en),
            COALESCE(nullif(btrim(v_item.title_ar), ''), v_ex.name_ar),
            v_today, public.clock_now())
    ON CONFLICT (user_id, item_id, check_date) DO NOTHING;
  ELSE
    DELETE FROM public.routine_checks
     WHERE user_id = v_uid AND item_id = p_item_id AND check_date = v_today;
  END IF;

  PERFORM public.refresh_routine_day(v_uid, v_today);
  PERFORM public.sync_routine_challenges(v_uid, v_today);
  RETURN public.my_today();
END;
$$;

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
  v_all     BOOLEAN;
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
  v_all := COALESCE((public.company_settings_json(v_company) ->> 'everyone_visible')::boolean, false);
  v_opt := COALESCE(v_opt, false) OR v_all;

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
        LEFT JOIN public.profile_prefs pp ON pp.user_id = p.id
       WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
         AND (v_all OR COALESCE(pp.recognition_opt_in, false))
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

CREATE OR REPLACE FUNCTION public.hr_routine_people(p_range TEXT DEFAULT '14d')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_days    INT := CASE p_range WHEN '7d' THEN 7 WHEN '30d' THEN 30 WHEN '90d' THEN 90 ELSE 14 END;
  v_today   DATE;
  v_from    DATE;
  v_members INT;
  v_people  JSONB;
  v_n       INT;
  v_all     BOOLEAN;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_today   := public.company_today(v_company);
  v_from    := v_today - (v_days - 1);
  v_members := public.habit_members(v_company, NULL);
  v_all     := COALESCE((public.company_settings_json(v_company) ->> 'everyone_visible')::boolean, false);

  IF NOT (public.company_settings_json(v_company) ->> 'hr_people_view')::boolean THEN
    RETURN jsonb_build_object('enabled', false, 'range', p_range, 'from', v_from, 'to', v_today,
                              'people', '[]'::jsonb, 'opted_in', 0, 'not_shared', v_members);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id', p.id, 'display_name', p.display_name, 'initials', p.initials, 'avatar_kind', p.avatar_kind,
           'team_id', p.team_id, 'team_name', t.name,
           'days_active', COALESCE(x.days, 0), 'items_done', COALESCE(x.items, 0),
           'full_days', COALESCE(f.n, 0), 'streak', COALESCE(s.streak, 0), 'last_active', x.last)
         ORDER BY COALESCE(x.items, 0) DESC, p.display_name), '[]'::jsonb),
         count(*)::int
    INTO v_people, v_n
    FROM public.profiles p
    LEFT JOIN public.profile_prefs pp ON pp.user_id = p.id
    LEFT JOIN public.teams t ON t.id = p.team_id
    LEFT JOIN LATERAL (SELECT count(*)::int AS items, count(DISTINCT c.check_date)::int AS days, max(c.check_date) AS last
                         FROM public.routine_checks c
                        WHERE c.user_id = p.id AND c.company_id = v_company
                          AND c.check_date BETWEEN v_from AND v_today) x ON true
    LEFT JOIN LATERAL (SELECT count(*)::int AS n FROM public.routine_days d
                        WHERE d.user_id = p.id AND d.all_done AND d.day BETWEEN v_from AND v_today) f ON true
    LEFT JOIN public.routine_streaks(v_company, v_today) s ON s.user_id = p.id
   WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
     AND (v_all OR COALESCE(pp.share_with_hr, false));

  RETURN jsonb_build_object('enabled', true, 'range', p_range, 'from', v_from, 'to', v_today,
                            'people', v_people, 'opted_in', v_n, 'not_shared', GREATEST(v_members - v_n, 0),
                            'everyone', v_all);
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_schedule_habit_challenge(
  p_template_id UUID, p_week_start DATE, p_team_id UUID DEFAULT NULL)
RETURNS public.challenges
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  t         public.challenge_templates%ROWTYPE;
  v_clash   public.challenges%ROWTYPE;
  v_row     public.challenges%ROWTYPE;
  v_weeks   INT;
  v_end     DATE;
  v_need    INT;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.challenge_templates
   WHERE id = p_template_id AND kind = 'habit' AND (company_id IS NULL OR company_id = v_company);
  IF t.id IS NULL THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
  IF t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'template_archived' USING ERRCODE = 'P0002'; END IF;
  IF EXTRACT(DOW FROM p_week_start) <> 0 THEN
    RAISE EXCEPTION 'week_must_start_on_sunday' USING ERRCODE = '22023';
  END IF;
  v_weeks := public.habit_weeks(t.payload);
  v_end   := p_week_start + 7 * (v_weeks - 1) + 4;
  v_need  := COALESCE(CASE WHEN t.payload ->> 'success_days' ~ '^\d{1,2}$' THEN (t.payload ->> 'success_days')::int END,
                      t.target, 4);
  IF v_end < public.company_today(v_company) THEN
    RAISE EXCEPTION 'week_in_the_past' USING ERRCODE = '22023';
  END IF;
  IF p_team_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.teams WHERE id = p_team_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- A default the app put in gives way to HR's pick, as long as nobody has
  -- logged a day on it yet.
  DELETE FROM public.challenges d
   WHERE d.company_id = v_company AND d.kind = 'habit'
     AND d.payload ->> 'auto' = 'true'
     AND d.start_date <= v_end AND d.end_date >= p_week_start
     AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.challenge_id = d.id);

  -- Several challenges can run together; the same one can't overlap itself.
  SELECT * INTO v_clash FROM public.challenges
   WHERE company_id = v_company AND kind = 'habit' AND active
     AND start_date <= v_end AND end_date >= p_week_start
     AND template_id = t.id
     AND (team_id IS NULL OR p_team_id IS NULL OR team_id = p_team_id)
   LIMIT 1;
  IF v_clash.id IS NOT NULL THEN
    RAISE EXCEPTION 'habit_week_taken' USING ERRCODE = '23P01',
      DETAIL = COALESCE(v_clash.title_ar, v_clash.title_en) || ' | ' || v_clash.title_en;
  END IF;

  INSERT INTO public.challenges (
    company_id, title_en, title_ar, description_en, description_ar,
    metric, goal_value, start_date, end_date, duration_days,
    badge_icon, badge_color, active, kind, template_id, team_id, payload)
  VALUES (
    v_company, t.title_en, t.title_ar, t.payload ->> 'action_en', t.payload ->> 'action_ar',
    'habit', v_need, p_week_start, v_end, v_weeks * 5,
    COALESCE(t.payload ->> 'badge_icon', 'trophy'), COALESCE(t.payload ->> 'badge_color', '#F5B544'),
    true, 'habit', t.id, p_team_id,
    t.payload || jsonb_build_object('weeks', v_weeks, 'success_days', v_need))
  RETURNING * INTO v_row;

  PERFORM public.notify_new_challenge(v_row.id);

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'challenge.habit_scheduled',
          t.slug, v_row.id, 'info',
          jsonb_build_object('week_start', p_week_start, 'team_id', p_team_id, 'weeks', v_weeks));
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_cancel_habit_challenge(p_challenge_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.challenges SET active = false
   WHERE id = p_challenge_id AND company_id = v_company AND kind = 'habit'
     AND active AND end_date >= public.company_today(v_company);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'only_upcoming_can_be_cancelled' USING ERRCODE = '22023';
  END IF;
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
  IF c.payload ? 'routine_item_ids' THEN
    RAISE EXCEPTION 'challenge_is_automatic' USING ERRCODE = '22023';
  END IF;
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

-- ═══════════════════════════════════════════════════════════════
-- 3. Grants
-- ═══════════════════════════════════════════════════════════════

-- Internal helpers: not callable by app users.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN ('company_settings_json', 'routine_due_items', 'sync_routine_challenges',
                                'notify_new_challenge', 'habit_challenge_state')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- RPCs: signed-in only. Each checks the caller inside.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN ('hr_set_company_settings', 'my_prefs', 'set_my_prefs', 'check_routine_item',
                                'recognition_board', 'hr_routine_people', 'hr_schedule_habit_challenge',
                                'hr_cancel_habit_challenge', 'log_habit', 'hr_set_routine_item_hidden',
                                'hr_schedule_challenge', 'my_habit_challenges')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Checks after running:
--   SELECT proname FROM pg_proc WHERE proname IN ('hr_schedule_challenge', 'my_habit_challenges',
--          'hr_set_routine_item_hidden', 'sync_routine_challenges', 'notify_new_challenge', 'habit_challenge_state');
--     → 6 rows
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND (table_name, column_name) IN
--          (('routine_items', 'hidden_at'), ('profile_prefs', 'visibility_notice_seen_at'));
--     → 2 rows

COMMIT;
NOTIFY pgrst, 'reload schema';

-- Done if this returns one row with all four = true.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'routine_items' AND column_name = 'hidden_at') AS hide_ready,
  to_regprocedure('public.hr_schedule_challenge(jsonb)') IS NOT NULL
    AND to_regprocedure('public.my_habit_challenges()') IS NOT NULL                                      AS challenges_ready,
  to_regprocedure('public.sync_routine_challenges(uuid, date)') IS NOT NULL                              AS auto_count_ready,
  (public.company_settings_json((SELECT id FROM public.companies LIMIT 1)) ? 'everyone_visible')         AS everyone_ready;
