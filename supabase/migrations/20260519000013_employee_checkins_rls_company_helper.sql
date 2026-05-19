-- Employee check-in INSERT policy was reading company_id directly off the JWT,
-- which is null/stale for freshly-signed-up users whose claims haven't been
-- refreshed yet. Switch to the auth_company_id() helper that falls back to
-- profiles.company_id (mirrors what 20260519000002 did for HR write paths).

DROP POLICY IF EXISTS "checkins_own_insert" ON public.checkins;
CREATE POLICY "checkins_own_insert" ON public.checkins
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.auth_company_id()
  );
