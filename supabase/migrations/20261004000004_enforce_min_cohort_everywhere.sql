-- Enforce the HR privacy floor on every aggregate HR can read.
--
-- The promise (Settings → Privacy, Reports): HR sees aggregates only, never a
-- group smaller than the minimum cohort (default 5). Three paths broke it:
--
--  1. hr_company_overview's daily trend averaged whoever checked in that day,
--     with no floor, so a day with 1–4 check-ins exposed those people's scores.
--  2. hr_team_drilldown measured the floor on the team's profile count, not on
--     who actually checked in, so one respondent in a 5-person team was shown.
--  3. The HR "Minimum cohort size" setting was saved to companies.settings but
--     every function hard-coded 5, and the UI offered 3.
--
-- hr_min_cohort() reads the company's setting and never returns less than 5.
-- All three HR read paths (overview KPIs + trend, drilldown, hr_team_overview)
-- now use it on the number of distinct people who checked in.

-- ── helper ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_min_cohort(p_company_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT greatest(
    5,
    coalesce(
      (SELECT CASE WHEN (settings ->> 'min_cohort') ~ '^\d+$'
                   THEN (settings ->> 'min_cohort')::int END
         FROM public.companies WHERE id = p_company_id),
      5));
$$;

REVOKE EXECUTE ON FUNCTION public.hr_min_cohort(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.hr_min_cohort(uuid) TO authenticated, service_role;

-- ── 1. overview: floor on KPIs and on every trend day ────────
CREATE OR REPLACE FUNCTION public.hr_company_overview(p_range TEXT DEFAULT '30d')
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
  v_total      INT := 0;
  v_active     INT := 0;
  v_kpis       JSONB;
  v_trend      JSONB;
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

  v_floor := public.hr_min_cohort(v_company_id);

  SELECT COUNT(*) INTO v_total
    FROM public.profiles
   WHERE company_id = v_company_id
     AND deleted_at IS NULL
     AND onboarded = true;

  SELECT COUNT(DISTINCT user_id) INTO v_active
    FROM public.checkins
   WHERE company_id = v_company_id
     AND checked_at >= v_start;

  IF v_active < v_floor THEN
    v_kpis := jsonb_build_object(
      'suppressed',    true,
      'group_size',    v_active,
      'min_cohort',    v_floor,
      'avg_mood',      NULL,
      'avg_stress',    NULL,
      'avg_sleep',     NULL,
      'avg_energy',    NULL,
      'participation', CASE WHEN v_total = 0 THEN 0 ELSE round((v_active::numeric / v_total), 2) END,
      'wellbeing_index', NULL,
      'total_employees', v_total,
      'active_users',  v_active,
      'at_risk_teams', 0,
      'safety_flags',  0
    );
  ELSE
    SELECT jsonb_build_object(
      'suppressed', false,
      'group_size', v_active,
      'min_cohort', v_floor,
      'avg_mood',   round(avg(mood)::numeric, 1),
      'avg_stress', round(avg(stress)::numeric, 1),
      'avg_sleep',  round(avg(sleep)::numeric, 1),
      'avg_energy', round(avg(energy)::numeric, 1),
      'participation', CASE WHEN v_total = 0 THEN 0 ELSE round((v_active::numeric / v_total), 2) END,
      'wellbeing_index', round(((avg(mood) + avg(energy) + avg(sleep) + (10 - avg(stress))) / 4)::numeric, 1),
      'total_employees', v_total,
      'active_users', v_active,
      'at_risk_teams', 0,
      'safety_flags',  0
    )
      INTO v_kpis
      FROM public.checkins
     WHERE company_id = v_company_id
       AND checked_at >= v_start;
  END IF;

  -- A day below the floor returns NULL metrics and suppressed = true, so a
  -- quiet day can not reveal the few people who checked in.
  SELECT jsonb_agg(jsonb_build_object(
    'date',       t.day,
    'suppressed', t.n < v_floor,
    'mood',       CASE WHEN t.n >= v_floor THEN t.mood   END,
    'stress',     CASE WHEN t.n >= v_floor THEN t.stress END,
    'sleep',      CASE WHEN t.n >= v_floor THEN t.sleep  END,
    'energy',     CASE WHEN t.n >= v_floor THEN t.energy END
  ) ORDER BY t.day)
    INTO v_trend
    FROM (
      SELECT d::date AS day,
             COUNT(DISTINCT c.user_id)          AS n,
             round(avg(c.mood)::numeric,   1)   AS mood,
             round(avg(c.stress)::numeric, 1)   AS stress,
             round(avg(c.sleep)::numeric,  1)   AS sleep,
             round(avg(c.energy)::numeric, 1)   AS energy
        FROM generate_series(v_start, current_date, '1 day'::interval) AS d
        LEFT JOIN public.checkins c
          ON c.checked_at = d::date
         AND c.company_id = v_company_id
       GROUP BY d
    ) t;

  RETURN jsonb_build_object(
    'kpis',  coalesce(v_kpis, '{}'::jsonb),
    'trend', coalesce(v_trend, '[]'::jsonb),
    'range', p_range
  );
END;
$$;

-- ── 2. drilldown: floor on respondents, not team size ────────
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

  IF v_respondents < v_floor THEN
    RETURN jsonb_build_object(
      'team', v_team_json,
      'suppressed', true,
      'size', v_size,
      'group_size', v_respondents,
      'min_cohort', v_floor,
      'range', p_range
    );
  END IF;

  SELECT jsonb_build_object(
    'team',       v_team_json,
    'suppressed', false,
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

-- ── 3. hr_team_overview: company floor instead of a fixed 5 ──
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
      public.hr_min_cohort(t.company_id) AS floor,
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
  )
  SELECT
    tc.company_id,
    tc.team_id,
    tc.team_name,
    tc.department,
    coalesce(r.week_start, date_trunc('week', current_date)::date),
    coalesce(tc.member_count, 0),
    coalesce(r.group_size, 0),
    coalesce(r.group_size, 0) >= tc.floor,
    coalesce(r.group_size, 0) <  tc.floor,
    CASE WHEN coalesce(r.group_size, 0) >= tc.floor THEN r.avg_mood   END,
    CASE WHEN coalesce(r.group_size, 0) >= tc.floor THEN r.avg_stress END,
    CASE WHEN coalesce(r.group_size, 0) >= tc.floor THEN r.avg_sleep  END,
    CASE WHEN coalesce(r.group_size, 0) >= tc.floor THEN r.avg_energy END
  FROM team_counts tc
  CROSS JOIN caller
  LEFT JOIN recent r
    ON r.team_id = tc.team_id
   AND r.company_id = tc.company_id
  WHERE caller.all_tenants OR tc.company_id = caller.company_id;
$$;
