-- Wellness+ HR unblock — fixes for super-admin login + Reports/Templates.
-- Safe to re-run (CREATE OR REPLACE + idempotent policy creation).
--
-- Problem set:
-- 1. hr_company_overview() + hr_team_drilldown() read auth.jwt() for
--    company_id / role. Super-admins (and freshly-onboarded users) have
--    stale JWT app_metadata until the next token mint, so the RPCs throw
--    42501 → useOverview falls back to mock data, hr-export-report returns
--    a non-2xx, Team drilldown is dead.
-- 2. challenge_templates / audit_log / feature_flags / integrations /
--    localization_strings have wellness_admin-only RLS. HR admins and
--    super-admins can't SELECT → empty template dropdowns, audit log, etc.
--
-- Fixes:
-- - is_superadmin() Postgres helper matching the email allowlist used by
--   the React + Edge layers.
-- - Both HR RPCs fall back to profile.company_id when JWT lacks the claim
--   and treat super-admins as company_admin.
-- - Add authenticated_read policies on the catalogue tables so HR admins
--   and super-admins can read them.

-- ── 1. Super-admin Postgres helper ───────────────────────────
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN (
    'hazemabdelghany43@gmail.com',
    'hazemabdelghany@gmail.com'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- ── 2. hr_company_overview: JWT fallback + super-admin bypass ─
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
  v_total      INT := 0;
  v_active     INT := 0;
  v_kpis       JSONB;
  v_trend      JSONB;
BEGIN
  -- JWT app_metadata is stale right after onboarding / profile backfill.
  -- Read the live profile row when the claim is missing.
  IF v_company_id IS NULL AND v_uid IS NOT NULL THEN
    SELECT company_id, role
      INTO v_company_id, v_role
      FROM public.profiles
     WHERE id = v_uid;
  END IF;

  -- Super-admin allowlist is implicitly company_admin everywhere.
  IF v_is_super THEN
    v_role := 'company_admin';
  END IF;

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
      'suppressed',    true,
      'group_size',    v_active,
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

  -- Daily trend series (last v_days days, 4 metrics).
  SELECT jsonb_agg(jsonb_build_object(
    'date',   d::date,
    'mood',   round(coalesce(avg(c.mood),   0)::numeric, 1),
    'stress', round(coalesce(avg(c.stress), 0)::numeric, 1),
    'sleep',  round(coalesce(avg(c.sleep),  0)::numeric, 1),
    'energy', round(coalesce(avg(c.energy), 0)::numeric, 1)
  ) ORDER BY d)
    INTO v_trend
    FROM generate_series(v_start, current_date, '1 day'::interval) AS d
    LEFT JOIN public.checkins c
      ON c.checked_at = d::date
     AND c.company_id = v_company_id
   GROUP BY d;

  RETURN jsonb_build_object(
    'kpis',  coalesce(v_kpis, '{}'::jsonb),
    'trend', coalesce(v_trend, '[]'::jsonb),
    'range', p_range
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_company_overview(TEXT) TO authenticated;

-- ── 3. hr_team_drilldown: same JWT fallback + super-admin bypass
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
  v_team       RECORD;
  v_size       INT := 0;
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

  SELECT COUNT(*) INTO v_size
    FROM public.profiles
   WHERE team_id = p_team_id
     AND deleted_at IS NULL;

  IF v_size < 5 THEN
    RETURN jsonb_build_object(
      'team', jsonb_build_object('id', v_team.id, 'name', v_team.name, 'department', v_team.department),
      'suppressed', true,
      'size', v_size,
      'range', p_range
    );
  END IF;

  SELECT jsonb_build_object(
    'team',       jsonb_build_object('id', v_team.id, 'name', v_team.name, 'department', v_team.department),
    'suppressed', false,
    'size',       v_size,
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
     AND c.checked_at >= v_start;

  RETURN coalesce(v_result, jsonb_build_object('team', jsonb_build_object('id', v_team.id, 'name', v_team.name, 'department', v_team.department), 'suppressed', true, 'size', v_size, 'range', p_range));
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_team_drilldown(UUID, TEXT) TO authenticated;

-- ── 4. SELECT policies for HR admins + super-admins on catalogue tables
-- challenge_templates is a global catalogue; anyone authenticated can read.
DROP POLICY IF EXISTS challenge_templates_authenticated_read ON public.challenge_templates;
CREATE POLICY challenge_templates_authenticated_read
  ON public.challenge_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- feature_flags is also a catalogue (global + company-scoped). Read-all
-- for authenticated; the UI filters by scope.
DROP POLICY IF EXISTS feature_flags_authenticated_read ON public.feature_flags;
CREATE POLICY feature_flags_authenticated_read
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- integrations are per-company. HR admin / company_admin / super-admin
-- read their own tenant.
DROP POLICY IF EXISTS integrations_hr_read ON public.integrations;
CREATE POLICY integrations_hr_read
  ON public.integrations
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND company_id = integrations.company_id
    )
  );

-- audit_log is global; readable by HR admins + super-admins. (Wellness
-- admins already covered by the wellness_admin policy.)
DROP POLICY IF EXISTS audit_log_hr_read ON public.audit_log;
CREATE POLICY audit_log_hr_read
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role IN ('hr_admin', 'company_admin')
    )
  );

-- localization_strings — same read access as audit_log.
DROP POLICY IF EXISTS localization_strings_hr_read ON public.localization_strings;
CREATE POLICY localization_strings_hr_read
  ON public.localization_strings
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role IN ('hr_admin', 'company_admin')
    )
  );

-- broadcasts read for HR admins / super-admins (in their own tenant).
DROP POLICY IF EXISTS broadcasts_hr_read ON public.broadcasts;
CREATE POLICY broadcasts_hr_read
  ON public.broadcasts
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND company_id = broadcasts.company_id
    )
  );
