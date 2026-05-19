-- Admin-portal sweep, Phase A.2
--
-- Replace the legacy `<table>_wellness_admin_all` policies on the seven
-- admin tables. The old policies used the bare expression
-- `auth.jwt() -> 'app_metadata' ->> 'role' = 'wellness_admin'` (via
-- is_wellness_admin) which returned NULL for any caller without a
-- backfilled JWT — see the previous migration for the full story.
--
-- The new policy set:
--   - Reads: wellness_admin (via is_wellness_admin which now honours the
--     superadmin allowlist + profile fallback). For billing_state /
--     invoices / integrations the company's own company_admin /
--     hr_admin can read their own company's row.
--   - Writes: wellness_admin only.
--
-- Lower-privilege paths (toggling a flag, editing a string, marking an
-- integration configured) still flow through the SECURITY DEFINER
-- admin_* RPCs, which enforce is_wellness_admin() at the function body.

-- Drop the legacy single-policy-per-table set.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies', 'teams', 'profiles', 'content_items',
    'billing_state', 'invoices', 'integrations', 'feature_flags',
    'audit_log', 'localization_strings', 'challenge_templates'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_wellness_admin_all', t);
  END LOOP;
END $$;

-- ── billing_state ──────────────────────────────────────────────
DROP POLICY IF EXISTS "billing_state_wadmin_all" ON public.billing_state;
CREATE POLICY "billing_state_wadmin_all" ON public.billing_state
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

DROP POLICY IF EXISTS "billing_state_company_read" ON public.billing_state;
CREATE POLICY "billing_state_company_read" ON public.billing_state
  FOR SELECT
  USING (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );

-- ── invoices ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "invoices_wadmin_all" ON public.invoices;
CREATE POLICY "invoices_wadmin_all" ON public.invoices
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

DROP POLICY IF EXISTS "invoices_company_read" ON public.invoices;
CREATE POLICY "invoices_company_read" ON public.invoices
  FOR SELECT
  USING (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );

-- ── integrations ───────────────────────────────────────────────
DROP POLICY IF EXISTS "integrations_wadmin_all" ON public.integrations;
CREATE POLICY "integrations_wadmin_all" ON public.integrations
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

DROP POLICY IF EXISTS "integrations_company_read" ON public.integrations;
CREATE POLICY "integrations_company_read" ON public.integrations
  FOR SELECT
  USING (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );

-- ── feature_flags ──────────────────────────────────────────────
-- Global table — only platform-admins read or write. Lower-privilege
-- callers see flag values via app code (which reads through hooks the
-- public app already has, not this admin-only table).
DROP POLICY IF EXISTS "feature_flags_wadmin_all" ON public.feature_flags;
CREATE POLICY "feature_flags_wadmin_all" ON public.feature_flags
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

-- ── audit_log ──────────────────────────────────────────────────
-- Read-only for the UI; inserts come from the admin_* RPCs which run
-- as SECURITY DEFINER.
DROP POLICY IF EXISTS "audit_log_wadmin_read" ON public.audit_log;
CREATE POLICY "audit_log_wadmin_read" ON public.audit_log
  FOR SELECT
  USING (public.is_wellness_admin());

-- ── localization_strings ───────────────────────────────────────
DROP POLICY IF EXISTS "localization_strings_wadmin_all" ON public.localization_strings;
CREATE POLICY "localization_strings_wadmin_all" ON public.localization_strings
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

-- Localization strings are user-facing copy — any authenticated user
-- needs SELECT to render translated UI. The pre-existing pattern in
-- the codebase reads them client-side; expose READ globally.
DROP POLICY IF EXISTS "localization_strings_authenticated_read" ON public.localization_strings;
CREATE POLICY "localization_strings_authenticated_read" ON public.localization_strings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── challenge_templates ────────────────────────────────────────
DROP POLICY IF EXISTS "challenge_templates_wadmin_all" ON public.challenge_templates;
CREATE POLICY "challenge_templates_wadmin_all" ON public.challenge_templates
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

-- Templates are catalog data; HR portal lists them when an admin
-- launches a challenge. Grant authenticated SELECT.
DROP POLICY IF EXISTS "challenge_templates_authenticated_read" ON public.challenge_templates;
CREATE POLICY "challenge_templates_authenticated_read" ON public.challenge_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── content_items ──────────────────────────────────────────────
-- Recreate the platform-admin policy alongside the existing
-- `content_authenticated_read` (legacy) and `content_items_hr_write`
-- (HR sweep). Wellness admins get full CRUD; HR keeps update access.
DROP POLICY IF EXISTS "content_items_wadmin_all" ON public.content_items;
CREATE POLICY "content_items_wadmin_all" ON public.content_items
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

-- ── companies / teams / profiles ───────────────────────────────
-- These already have hr_company_read, profiles_admin_company_read, etc.
-- Add a platform-admin escape hatch so wellness_admin can read/write
-- across tenants from the admin portal.
DROP POLICY IF EXISTS "companies_wadmin_all" ON public.companies;
CREATE POLICY "companies_wadmin_all" ON public.companies
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

DROP POLICY IF EXISTS "teams_wadmin_all" ON public.teams;
CREATE POLICY "teams_wadmin_all" ON public.teams
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());

DROP POLICY IF EXISTS "profiles_wadmin_all" ON public.profiles;
CREATE POLICY "profiles_wadmin_all" ON public.profiles
  FOR ALL
  USING (public.is_wellness_admin())
  WITH CHECK (public.is_wellness_admin());
