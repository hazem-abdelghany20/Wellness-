-- Default weekly habit challenge.
--
-- The Challenge tab only showed something when HR had scheduled a habit
-- challenge for the current week. A company whose HR had not picked one yet
-- (every new or test tenant, and any week HR forgets) got an empty tab.
--
-- Now, when nothing is booked for the week, the first employee or HR read
-- books a company-wide default from the habit templates, rotating one
-- template per week. HR stays in charge:
--   * scheduling their own pick for that week replaces the default, as long
--     as nobody has logged a day on it yet;
--   * cancelling an upcoming default leaves that week empty on purpose (any
--     row for the week, cancelled or not, stops a new default);
--   * a team-only pick also counts as booked, so other teams get no default.
-- On Fri/Sat the default is for the coming week and shows as "upcoming".

-- ── helper: book the default for the current week if it is empty ─
CREATE OR REPLACE FUNCTION public.ensure_default_habit_week(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dow  INT := EXTRACT(DOW FROM current_date)::INT;
  -- Sun → Thu: this week. Fri / Sat: the week ahead.
  v_week DATE := CASE WHEN v_dow <= 4 THEN current_date - v_dow ELSE current_date + (7 - v_dow) END;
  v_n    INT;
  t      public.challenge_templates%ROWTYPE;
BEGIN
  IF p_company_id IS NULL THEN RETURN; END IF;
  -- Two employees opening the app at once must not book two defaults.
  PERFORM pg_advisory_xact_lock(hashtext('habit_default_week'), hashtext(p_company_id::text));

  IF EXISTS (SELECT 1 FROM public.challenges
              WHERE company_id = p_company_id AND kind = 'habit'
                AND start_date <= v_week + 4 AND end_date >= v_week) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_n FROM public.challenge_templates WHERE kind = 'habit';
  IF v_n = 0 THEN RETURN; END IF;
  SELECT * INTO t FROM public.challenge_templates WHERE kind = 'habit'
   ORDER BY slug OFFSET ((v_week - DATE '2026-01-04') / 7) % v_n LIMIT 1;

  INSERT INTO public.challenges (
    company_id, title_en, title_ar, description_en, description_ar,
    metric, goal_value, start_date, end_date, duration_days,
    badge_icon, badge_color, active, kind, template_id, team_id, payload)
  VALUES (
    p_company_id, t.title_en, t.title_ar, t.payload ->> 'action_en', t.payload ->> 'action_ar',
    'habit', COALESCE(t.target, 4), v_week, v_week + 4, 5,
    COALESCE(t.payload ->> 'badge_icon', 'trophy'), COALESCE(t.payload ->> 'badge_color', '#F5B544'),
    true, 'habit', t.id, NULL, t.payload || '{"auto": true}'::jsonb);
END;
$$;

-- ── employee: current challenge + my state ───────────────────
CREATE OR REPLACE FUNCTION public.my_habit_challenge()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  c         public.challenges%ROWTYPE;
  v_status  TEXT;
  v_target  DATE;
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

  -- No challenge picked for this week? Put in the default one (HR can still
  -- swap it before anyone logs a day, or cancel an upcoming one).
  PERFORM public.ensure_default_habit_week(v_company);

  -- Settle any finished week for this company first (gives out rewards).
  FOR v_ended IN
    SELECT id FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit'
       AND COALESCE(payload ->> 'finalized', 'false') <> 'true'
       AND end_date < current_date
  LOOP
    PERFORM public.finalize_habit_challenge(v_ended.id);
  END LOOP;

  SELECT * INTO c FROM public.challenges
   WHERE company_id = v_company AND kind = 'habit' AND active
     AND (team_id IS NULL OR team_id = v_team)
     AND start_date <= current_date
     AND end_date + CASE WHEN payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= current_date
   ORDER BY start_date DESC LIMIT 1;

  IF c.id IS NOT NULL THEN
    v_status := 'active';
  ELSE
    SELECT * INTO c FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit' AND active
       AND (team_id IS NULL OR team_id = v_team)
       AND start_date > current_date
     ORDER BY start_date LIMIT 1;
    IF c.id IS NULL THEN RETURN jsonb_build_object('status', 'none'); END IF;
    v_status := 'upcoming';
  END IF;

  v_target  := public.habit_target_date(c.payload);
  v_elapsed := GREATEST(0, LEAST(v_target, c.end_date) - c.start_date + 1);
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
    'can_log',      v_status = 'active' AND v_target BETWEEN c.start_date AND c.end_date,
    'logged_target', v_dates @> to_jsonb(v_target),
    'my_dates',     v_dates,
    'my_count',     jsonb_array_length(v_dates),
    'success_days', COALESCE((c.payload ->> 'success_days')::INT, 4),
    'days_total',   c.end_date - c.start_date + 1,
    'elapsed',      v_elapsed,
    -- Shared progress only when the group is big enough to stay anonymous.
    'team_pct',     CASE WHEN v_members >= public.hr_min_cohort(v_company) AND v_elapsed > 0
                         THEN round(100.0 * v_logs / (v_members * v_elapsed)) END
  );
END;
$$;

-- ── HR: schedule (a default gives way) ──────────────────────
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
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.challenge_templates WHERE id = p_template_id AND kind = 'habit';
  IF t.id IS NULL THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
  IF EXTRACT(DOW FROM p_week_start) <> 0 THEN
    RAISE EXCEPTION 'week_must_start_on_sunday' USING ERRCODE = '22023';
  END IF;
  IF p_week_start + 4 < current_date THEN
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
     AND d.start_date <= p_week_start + 4 AND d.end_date >= p_week_start
     AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.challenge_id = d.id);

  -- One habit challenge at a time for the same people.
  SELECT * INTO v_clash FROM public.challenges
   WHERE company_id = v_company AND kind = 'habit' AND active
     AND start_date <= p_week_start + 4 AND end_date >= p_week_start
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
    'habit', COALESCE(t.target, 4), p_week_start, p_week_start + 4, 5,
    COALESCE(t.payload ->> 'badge_icon', 'trophy'), COALESCE(t.payload ->> 'badge_color', '#F5B544'),
    true, 'habit', t.id, p_team_id, t.payload)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'challenge.habit_scheduled',
          t.slug, v_row.id, 'info',
          jsonb_build_object('week_start', p_week_start, 'team_id', p_team_id));
  RETURN v_row;
END;
$$;

-- ── HR: list (books the default too; flags auto rows) ───────
-- The return type gains a column, so drop and recreate.
DROP FUNCTION IF EXISTS public.hr_habit_challenges();
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
  r         RECORD;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_floor := public.hr_min_cohort(v_company);
  PERFORM public.ensure_default_habit_week(v_company);

  FOR r IN SELECT c.id FROM public.challenges c
            WHERE c.company_id = v_company AND c.kind = 'habit'
              AND COALESCE(c.payload ->> 'finalized', 'false') <> 'true' AND c.end_date < current_date
  LOOP
    PERFORM public.finalize_habit_challenge(r.id);
  END LOOP;

  RETURN QUERY
  WITH base AS (
    SELECT c.*, public.habit_members(v_company, c.team_id) AS n_members,
           COALESCE((c.payload ->> 'success_days')::INT, 4) AS need
      FROM public.challenges c
     WHERE c.company_id = v_company AND c.kind = 'habit'
  ), per_user AS (
    SELECT l.challenge_id, l.user_id, COUNT(*) AS days
      FROM public.habit_logs l JOIN base b ON b.id = l.challenge_id
     GROUP BY l.challenge_id, l.user_id
  )
  SELECT b.id, b.title_en, b.title_ar, b.template_id, b.team_id, tm.name,
         b.start_date, b.end_date,
         CASE WHEN NOT b.active THEN 'cancelled'
              WHEN b.start_date > current_date THEN 'upcoming'
              WHEN b.end_date + CASE WHEN b.payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= current_date THEN 'active'
              ELSE 'done' END,
         b.n_members,
         (SELECT COUNT(*)::INT FROM per_user p WHERE p.challenge_id = b.id),
         (SELECT COUNT(*)::INT FROM per_user p WHERE p.challenge_id = b.id AND p.days >= b.need),
         CASE WHEN b.n_members >= v_floor
              THEN round(100.0 * (SELECT COUNT(*) FROM per_user p WHERE p.challenge_id = b.id AND p.days >= b.need) / b.n_members)
         END,
         COALESCE(b.payload ->> 'auto', 'false') = 'true'
    FROM base b LEFT JOIN public.teams tm ON tm.id = b.team_id
   ORDER BY b.start_date DESC;
END;
$$;

-- ── grants ───────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.ensure_default_habit_week(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_default_habit_week(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.hr_habit_challenges() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.hr_habit_challenges() TO authenticated, service_role;
