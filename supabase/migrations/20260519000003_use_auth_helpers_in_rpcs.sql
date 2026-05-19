-- Wire hr_company_overview, hr_team_drilldown, and the companies/teams
-- read policies through public.auth_company_id() + public.auth_role()
-- so superadmins and freshly-onboarded users (whose JWT app_metadata
-- claims haven't been re-minted yet) can see + modify their company.

-- ── hr_company_overview ──────────────────────────────────────
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
  v_total      INT  := 0;
  v_active     INT  := 0;
  v_kpis       JSONB;
  v_trend      JSONB;
BEGIN
  IF v_company_id IS NULL OR v_role NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.profiles
   WHERE company_id = v_company_id
     AND deleted_at IS NULL
     AND onboarded = true;

  SELECT COUNT(DISTINCT user_id) INTO v_active
    FROM public.checkins
   WHERE company_id = v_company_id
     AND checked_at >= v_start;

  IF v_active < 5 THEN
    v_kpis := jsonb_build_object(
      'suppressed', true,
      'group_size', v_active,
      'avg_mood', NULL,
      'avg_stress', NULL,
      'avg_sleep', NULL,
      'avg_energy', NULL,
      'participation', CASE WHEN v_total = 0 THEN 0 ELSE round((v_active::numeric / v_total), 2) END,
      'avg_streak', (SELECT round(avg(streak_current)::numeric, 1) FROM public.profiles WHERE company_id = v_company_id AND deleted_at IS NULL)
    );
  ELSE
    SELECT jsonb_build_object(
      'suppressed', false,
      'group_size', COUNT(DISTINCT c.user_id),
      'avg_mood', round(avg(c.mood)::numeric, 1),
      'avg_stress', round(avg(c.stress)::numeric, 1),
      'avg_sleep', round(avg(c.sleep)::numeric, 1),
      'avg_energy', round(avg(c.energy)::numeric, 1),
      'participation', CASE WHEN v_total = 0 THEN 0 ELSE round((COUNT(DISTINCT c.user_id)::numeric / v_total), 2) END,
      'avg_streak', (SELECT round(avg(streak_current)::numeric, 1) FROM public.profiles WHERE company_id = v_company_id AND deleted_at IS NULL)
    )
    INTO v_kpis
    FROM public.checkins c
    WHERE c.company_id = v_company_id
      AND c.checked_at >= v_start;
  END IF;

  WITH series AS (
    SELECT generate_series(v_start, current_date, interval '1 day')::date AS d
  ),
  daily AS (
    SELECT date_trunc('day', c.checked_at)::date AS d,
           COUNT(DISTINCT c.user_id) AS group_size,
           round(avg(c.mood)::numeric, 1)   AS avg_mood,
           round(avg(c.stress)::numeric, 1) AS avg_stress
    FROM public.checkins c
    WHERE c.company_id = v_company_id
      AND c.checked_at >= v_start
    GROUP BY date_trunc('day', c.checked_at)::date
  )
  SELECT jsonb_agg(jsonb_build_object(
    'd', s.d,
    'group_size', coalesce(daily.group_size, 0),
    'avg_mood',   CASE WHEN coalesce(daily.group_size, 0) >= 5 THEN daily.avg_mood END,
    'avg_stress', CASE WHEN coalesce(daily.group_size, 0) >= 5 THEN daily.avg_stress END
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

-- ── hr_team_drilldown ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_team_drilldown(p_team_id UUID, p_range TEXT DEFAULT '30d')
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
  v_rows JSONB;
BEGIN
  IF v_company_id IS NULL OR v_role NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  WITH days AS (
    SELECT generate_series(current_date - (v_days - 1), current_date, interval '1 day')::date AS checked_at
  ),
  daily AS (
    SELECT
      d.checked_at,
      COUNT(DISTINCT c.user_id) AS group_size,
      round(avg(c.mood)::numeric, 1)   AS avg_mood,
      round(avg(c.stress)::numeric, 1) AS avg_stress,
      round(avg(c.sleep)::numeric, 1)  AS avg_sleep,
      round(avg(c.energy)::numeric, 1) AS avg_energy
    FROM days d
    LEFT JOIN public.checkins c
      ON c.checked_at::date = d.checked_at
     AND c.company_id = v_company_id
     AND EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = c.user_id
          AND p.team_id = p_team_id
     )
    GROUP BY d.checked_at
    ORDER BY d.checked_at
  )
  SELECT jsonb_agg(jsonb_build_object(
    'd', daily.checked_at,
    'group_size', daily.group_size,
    'avg_mood',   CASE WHEN daily.group_size >= 5 THEN daily.avg_mood END,
    'avg_stress', CASE WHEN daily.group_size >= 5 THEN daily.avg_stress END,
    'avg_sleep',  CASE WHEN daily.group_size >= 5 THEN daily.avg_sleep END,
    'avg_energy', CASE WHEN daily.group_size >= 5 THEN daily.avg_energy END
  ) ORDER BY daily.checked_at)
  INTO v_rows
  FROM daily;

  RETURN jsonb_build_object(
    'team_id', p_team_id,
    'range',   p_range,
    'trend',   coalesce(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_team_drilldown(UUID, TEXT) TO authenticated;

-- ── companies + teams SELECT policies use helpers ───────────
DROP POLICY IF EXISTS "company_members_read" ON public.companies;
CREATE POLICY "company_members_read" ON public.companies
  FOR SELECT
  USING (id = public.auth_company_id());

DROP POLICY IF EXISTS "team_company_read" ON public.teams;
CREATE POLICY "team_company_read" ON public.teams
  FOR SELECT
  USING (company_id = public.auth_company_id());
