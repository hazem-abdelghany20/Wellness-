-- HR / company admins need to see all profiles + check-ins inside their
-- company so dashboard aggregates (hr_team_overview, KPI tiles, sidebar
-- safety badge) render real values instead of an empty view.

-- profiles: admin SELECT inside their company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_admin_company_read'
  ) THEN
    CREATE POLICY "profiles_admin_company_read" ON public.profiles
      FOR SELECT
      USING (
        company_id = public.auth_company_id()
        AND public.auth_role() IN ('hr_admin', 'company_admin', 'manager')
      );
  END IF;
END $$;

-- checkins: admin SELECT inside their company (aggregate views read this)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'checkins' AND policyname = 'checkins_admin_company_read'
  ) THEN
    CREATE POLICY "checkins_admin_company_read" ON public.checkins
      FOR SELECT
      USING (
        company_id = public.auth_company_id()
        AND public.auth_role() IN ('hr_admin', 'company_admin', 'manager')
      );
  END IF;
END $$;

-- Reshape hr_company_overview's KPI payload so the dashboard's KPI strip
-- can read wellbeing_index / weekly_active / at_risk_teams / safety_flags
-- directly. Keep the legacy avg_* fields for back-compat with the
-- TrendChart pipeline.
CREATE OR REPLACE FUNCTION public.hr_company_overview(p_range TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := public.auth_company_id();
  v_role       TEXT := public.auth_role();
  v_days       INT  := CASE p_range WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END;
  v_start      DATE := current_date - v_days;
  v_total      INT := 0;
  v_active     INT := 0;
  v_at_risk    INT := 0;
  v_safety     INT := 0;
  v_index      NUMERIC;
  v_kpis       JSONB;
  v_trend      JSONB;
BEGIN
  IF v_company_id IS NULL OR v_role NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.profiles
   WHERE company_id = v_company_id AND deleted_at IS NULL AND onboarded = true;

  SELECT COUNT(DISTINCT user_id) INTO v_active
    FROM public.checkins
   WHERE company_id = v_company_id AND checked_at >= v_start;

  -- Team-level signals for at-risk + safety flag counts.
  SELECT
    COUNT(*) FILTER (WHERE has_signal AND avg_stress IS NOT NULL AND avg_stress >= 6),
    COUNT(*) FILTER (WHERE has_signal AND avg_stress IS NOT NULL AND avg_stress >= 7)
    INTO v_at_risk, v_safety
    FROM public.hr_team_overview
   WHERE company_id = v_company_id;

  IF v_active < 5 THEN
    v_kpis := jsonb_build_object(
      'suppressed', true,
      'group_size', v_active,
      'wellbeing_index', NULL,
      'weekly_active', v_active,
      'at_risk_teams', v_at_risk,
      'safety_flags',  v_safety,
      'avg_mood', NULL, 'avg_stress', NULL, 'avg_sleep', NULL, 'avg_energy', NULL,
      'participation', CASE WHEN v_total = 0 THEN 0 ELSE round((v_active::numeric / v_total), 2) END,
      'avg_streak', (SELECT round(avg(streak_current)::numeric, 1) FROM public.profiles WHERE company_id = v_company_id AND deleted_at IS NULL)
    );
  ELSE
    SELECT
      round(((avg(c.mood) + (10 - avg(c.stress)) + avg(c.sleep) + avg(c.energy)) / 4)::numeric, 1)
      INTO v_index
      FROM public.checkins c
      WHERE c.company_id = v_company_id AND c.checked_at >= v_start;

    SELECT jsonb_build_object(
      'suppressed', false,
      'group_size', COUNT(DISTINCT c.user_id),
      'wellbeing_index', v_index,
      'weekly_active', COUNT(DISTINCT c.user_id),
      'at_risk_teams',  v_at_risk,
      'safety_flags',   v_safety,
      'avg_mood',   round(avg(c.mood)::numeric, 1),
      'avg_stress', round(avg(c.stress)::numeric, 1),
      'avg_sleep',  round(avg(c.sleep)::numeric, 1),
      'avg_energy', round(avg(c.energy)::numeric, 1),
      'participation', CASE WHEN v_total = 0 THEN 0 ELSE round((COUNT(DISTINCT c.user_id)::numeric / v_total), 2) END,
      'avg_streak', (SELECT round(avg(streak_current)::numeric, 1) FROM public.profiles WHERE company_id = v_company_id AND deleted_at IS NULL)
    )
    INTO v_kpis
    FROM public.checkins c
    WHERE c.company_id = v_company_id AND c.checked_at >= v_start;
  END IF;

  WITH series AS (
    SELECT generate_series(v_start, current_date, interval '1 day')::date AS d
  ),
  daily AS (
    SELECT date_trunc('day', c.checked_at)::date AS d,
           COUNT(DISTINCT c.user_id) AS group_size,
           round(avg(c.mood)::numeric, 1)   AS avg_mood,
           round(avg(c.stress)::numeric, 1) AS avg_stress,
           round(avg(c.sleep)::numeric, 1)  AS avg_sleep,
           round(avg(c.energy)::numeric, 1) AS avg_energy
    FROM public.checkins c
    WHERE c.company_id = v_company_id AND c.checked_at >= v_start
    GROUP BY date_trunc('day', c.checked_at)::date
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', s.d,
    'group_size', coalesce(daily.group_size, 0),
    'avg_mood',   CASE WHEN coalesce(daily.group_size, 0) >= 5 THEN daily.avg_mood END,
    'avg_stress', CASE WHEN coalesce(daily.group_size, 0) >= 5 THEN daily.avg_stress END,
    'avg_sleep',  CASE WHEN coalesce(daily.group_size, 0) >= 5 THEN daily.avg_sleep END,
    'avg_energy', CASE WHEN coalesce(daily.group_size, 0) >= 5 THEN daily.avg_energy END
  ) ORDER BY s.d)
  INTO v_trend
  FROM series s
  LEFT JOIN daily ON daily.d = s.d;

  RETURN jsonb_build_object(
    'range', p_range,
    'kpis',  v_kpis,
    'trend', coalesce(v_trend, '[]'::jsonb),
    'total_employees', v_total,
    'active_employees', v_active
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_company_overview(TEXT) TO authenticated;
