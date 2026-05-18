-- Remote UAT hardening: HR overview surfaces and reward fulfillment access.

CREATE OR REPLACE FUNCTION public.hr_company_overview(p_range TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID;
  v_role TEXT := auth.jwt() -> 'app_metadata' ->> 'role';
  v_days INT := CASE p_range WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END;
  v_start DATE := current_date - (CASE p_range WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END);
  v_total INT := 0;
  v_active INT := 0;
  v_kpis JSONB;
  v_trend JSONB;
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

  WITH weeks AS (
    SELECT generate_series(date_trunc('week', current_date)::date - interval '21 days',
                           date_trunc('week', current_date)::date,
                           interval '7 days')::date AS week_start
  ),
  weekly AS (
    SELECT
      w.week_start,
      COUNT(DISTINCT c.user_id) AS group_size,
      CASE WHEN COUNT(DISTINCT c.user_id) >= 5 THEN round(avg(c.mood)::numeric, 1) END AS avg_mood,
      CASE WHEN COUNT(DISTINCT c.user_id) >= 5 THEN round(avg(c.stress)::numeric, 1) END AS avg_stress
    FROM weeks w
    LEFT JOIN public.checkins c
      ON c.company_id = v_company_id
     AND c.checked_at >= w.week_start
     AND c.checked_at < w.week_start + interval '7 days'
    GROUP BY w.week_start
    ORDER BY w.week_start
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'week_start', week_start,
    'group_size', group_size,
    'suppressed', group_size < 5,
    'avg_mood', avg_mood,
    'avg_stress', avg_stress
  ) ORDER BY week_start), '[]'::jsonb)
  INTO v_trend
  FROM weekly;

  RETURN jsonb_build_object(
    'range', p_range,
    'kpis', v_kpis,
    'trend', v_trend
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_company_overview(TEXT) TO authenticated;

CREATE OR REPLACE VIEW public.hr_team_overview AS
WITH scoped AS (
  SELECT
    t.company_id,
    t.id AS team_id,
    t.name AS team_name,
    date_trunc('week', c.checked_at)::date AS week_start,
    COUNT(DISTINCT c.user_id) AS group_size,
    round(avg(c.mood)::numeric, 1) AS raw_avg_mood,
    round(avg(c.stress)::numeric, 1) AS raw_avg_stress,
    round(avg(c.sleep)::numeric, 1) AS raw_avg_sleep,
    round(avg(c.energy)::numeric, 1) AS raw_avg_energy
  FROM public.teams t
  LEFT JOIN public.profiles p
    ON p.team_id = t.id
   AND p.company_id = t.company_id
   AND p.deleted_at IS NULL
  LEFT JOIN public.checkins c
    ON c.user_id = p.id
   AND c.company_id = t.company_id
   AND c.checked_at >= current_date - interval '30 days'
  GROUP BY t.company_id, t.id, t.name, date_trunc('week', c.checked_at)::date
)
SELECT
  company_id,
  team_id,
  team_name,
  week_start,
  group_size,
  group_size < 5 AS suppressed,
  CASE WHEN group_size >= 5 THEN raw_avg_mood END AS avg_mood,
  CASE WHEN group_size >= 5 THEN raw_avg_stress END AS avg_stress,
  CASE WHEN group_size >= 5 THEN raw_avg_sleep END AS avg_sleep,
  CASE WHEN group_size >= 5 THEN raw_avg_energy END AS avg_energy
FROM scoped
WHERE company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin', 'manager');

GRANT SELECT ON public.hr_team_overview TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.awarded_rewards') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'awarded_rewards'
      AND policyname = 'awarded_rewards_hr_company_read'
  ) THEN
    CREATE POLICY "awarded_rewards_hr_company_read" ON public.awarded_rewards
      FOR SELECT USING (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'awarded_rewards'
      AND policyname = 'awarded_rewards_hr_company_update'
  ) THEN
    CREATE POLICY "awarded_rewards_hr_company_update" ON public.awarded_rewards
      FOR UPDATE USING (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      )
      WITH CHECK (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;
END $$;
