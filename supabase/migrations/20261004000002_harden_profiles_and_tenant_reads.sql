-- Security hardening found by the end-to-end run (see docs/e2e.md).
-- Apply separately from 20261004000001 if you want to review it on its own.
--
--  1. profiles_own_update was `USING (id = auth.uid())` with no column limits, so
--     any signed-in user could PATCH their own row and set role = 'hr_admin' or
--     company_id = <another tenant>, or rewrite streak_current to game reward
--     tiers. Guard those columns for direct client writes. SECURITY DEFINER
--     RPCs (admin_set_role, update_streak, …), the service role and wellness
--     admins are unaffected.
--  2. hr_unblock.sql added read policies that ignored role and tenant:
--       integrations_hr_read  → any employee could read their company's
--                               integrations (incl. config)
--       broadcasts_hr_read    → any employee could read unsent / cancelled
--                               broadcasts
--       audit_log_hr_read     → any HR admin could read every tenant's audit log
--       feature_flags_authenticated_read → any user read other tenants' flags
--     Older, correctly scoped policies already cover the legitimate access
--     (integrations_company_read, broadcasts_hr_select, audit_log_wadmin_read,
--     feature_flags_wadmin_all), so the broad ones are dropped and flags get a
--     scoped read.

-- ── 1. profiles: guard privileged columns ────────────────────
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- current_user is the role PostgREST switched to for a direct client write.
  -- Inside SECURITY DEFINER functions it is the function owner, and for the
  -- service role it is service_role — both skip the guard.
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_wellness_admin() THEN
    IF NEW.id            IS DISTINCT FROM OLD.id
    OR NEW.company_id    IS DISTINCT FROM OLD.company_id
    OR NEW.role          IS DISTINCT FROM OLD.role
    OR NEW.streak_current IS DISTINCT FROM OLD.streak_current
    OR NEW.streak_best   IS DISTINCT FROM OLD.streak_best
    OR NEW.checkins_total IS DISTINCT FROM OLD.checkins_total THEN
      RAISE EXCEPTION 'profiles: role, company and streak columns can not be changed directly'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_columns();

-- ── 2. tenant / role scoping of reads ────────────────────────
DROP POLICY IF EXISTS integrations_hr_read ON public.integrations;
DROP POLICY IF EXISTS broadcasts_hr_read   ON public.broadcasts;
DROP POLICY IF EXISTS audit_log_hr_read    ON public.audit_log;

DROP POLICY IF EXISTS feature_flags_authenticated_read ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_scoped_read ON public.feature_flags;
CREATE POLICY feature_flags_scoped_read
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (
    scope = 'global'
    OR (scope = 'company' AND target_id = public.auth_company_id())
    OR (scope = 'user'    AND target_id = auth.uid())
  );
