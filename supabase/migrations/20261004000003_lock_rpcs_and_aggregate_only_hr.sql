-- Security follow-up to the Supabase advisor run + docs/e2e.md finding 1.
--
--  1. compute_hr_aggregate() and cleanup_expired_pending() are SECURITY
--     DEFINER with no caller check, and anon could call both over
--     /rest/v1/rpc. Only the compute-hr-aggregates edge function (service
--     role) calls the first; nothing in the app calls the second.
--  2. The guarded action RPCs (admin_*, hr_*, claim/mark reward, get_my_*)
--     check the caller inside, but there is no reason to expose them to
--     anon. The auth helpers (auth_role, auth_company_id, is_superadmin,
--     is_wellness_admin) stay callable: RLS policies evaluated for anon
--     requests call them and must not error.
--  3. Trigger / event-trigger functions are not meant to be RPCs.
--  4. my_today_plan ran with its owner's rights. It filters on auth.uid(),
--     and daily_plans / daily_plan_completions have own-row policies, so
--     security_invoker gives the same rows.
--  5. Pin search_path on the functions the linter flagged.
--  6. Finding 1: HR / managers could read every employee's raw check-ins
--     (mood, stress, notes) through checkins_admin_company_read. The only
--     HR reader was the hr_team_overview view, which already suppresses
--     teams under 5. Drop the policy and serve the view from a SECURITY
--     DEFINER function so HR gets the aggregates and nothing else.

-- ── 1. service-role only ─────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.compute_hr_aggregate(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_pending()               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.compute_hr_aggregate(uuid, uuid, date) TO service_role;
GRANT  EXECUTE ON FUNCTION public.cleanup_expired_pending()               TO service_role;

-- ── 2. signed-in only ────────────────────────────────────────
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'admin_create_tenant', 'admin_invite_company_admin', 'admin_set_billing',
         'admin_set_flag', 'admin_set_role', 'claim_my_reward', 'mark_reward_fulfilled',
         'get_my_checkin_history', 'get_my_progress_stats',
         'hr_company_overview', 'hr_team_drilldown')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ── 3. triggers are not RPCs ─────────────────────────────────
-- EXECUTE is checked when a trigger is created, not when it fires.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_streak()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;
GRANT  EXECUTE ON FUNCTION public.update_streak()   TO service_role;

-- ── 4. my_today_plan runs as the caller ──────────────────────
ALTER VIEW public.my_today_plan SET (security_invoker = on);

-- ── 5. pinned search_path ────────────────────────────────────
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proconfig IS NULL
       AND p.proname IN (
         'compute_initials', 'handle_new_user', 'update_streak', 'notify_leaderboard_stale',
         'cleanup_expired_pending', 'set_initials', 'custom_access_token_hook',
         'normalize_company_code', 'get_my_checkin_history', 'get_my_progress_stats',
         'touch_updated_at', 'dp_laplace', 'compute_hr_aggregate')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', f);
  END LOOP;
END $$;

-- ── 6. HR sees aggregates, not raw check-ins ─────────────────
DROP POLICY IF EXISTS checkins_admin_company_read ON public.checkins;

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
    -- service role (hr-export-report) and wellness admins see every tenant;
    -- HR / company admins / managers see their own; everyone else nothing.
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
  )
  SELECT
    tc.company_id,
    tc.team_id,
    tc.team_name,
    tc.department,
    coalesce(r.week_start, date_trunc('week', current_date)::date),
    coalesce(tc.member_count, 0),
    coalesce(r.group_size, 0),
    coalesce(r.group_size, 0) >= 5,
    coalesce(r.group_size, 0) < 5,
    CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_mood   END,
    CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_stress END,
    CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_sleep  END,
    CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_energy END
  FROM team_counts tc
  CROSS JOIN caller
  LEFT JOIN recent r
    ON r.team_id = tc.team_id
   AND r.company_id = tc.company_id
  WHERE caller.all_tenants OR tc.company_id = caller.company_id;
$$;

REVOKE EXECUTE ON FUNCTION public.hr_team_overview_rows() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.hr_team_overview_rows() TO authenticated, service_role;

-- Same name and columns, so the HR app and hr-export-report need no change.
CREATE OR REPLACE VIEW public.hr_team_overview
WITH (security_invoker = on) AS
SELECT * FROM public.hr_team_overview_rows();

REVOKE ALL ON public.hr_team_overview FROM anon;
GRANT SELECT ON public.hr_team_overview TO authenticated, service_role;
