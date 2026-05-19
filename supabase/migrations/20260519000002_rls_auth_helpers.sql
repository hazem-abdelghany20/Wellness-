-- Stable helpers that resolve the caller's company_id and role for RLS.
-- Both fall back to profiles when JWT app_metadata is stale (the common
-- case for users whose claims were backfilled out of band) and honour
-- the superadmin email allowlist via public.is_superadmin().

CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID;
BEGIN
  IF v_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT company_id INTO v_id FROM public.profiles WHERE id = auth.uid();
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() -> 'app_metadata' ->> 'role';
BEGIN
  IF (v_role IS NULL OR v_role = '') AND auth.uid() IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  END IF;
  IF public.is_superadmin() THEN
    v_role := 'company_admin';
  END IF;
  RETURN COALESCE(v_role, 'employee');
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated;

-- ── Rewrite HR-portal write policies to use the helpers ───────

-- gift_catalog_items
DROP POLICY IF EXISTS "gift_catalog_items_hr_company_insert" ON public.gift_catalog_items;
DROP POLICY IF EXISTS "gift_catalog_items_hr_company_update" ON public.gift_catalog_items;
CREATE POLICY "gift_catalog_items_hr_company_insert" ON public.gift_catalog_items
  FOR INSERT WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );
CREATE POLICY "gift_catalog_items_hr_company_update" ON public.gift_catalog_items
  FOR UPDATE
  USING (
    (company_id = public.auth_company_id() OR company_id IS NULL)
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  )
  WITH CHECK (
    (company_id = public.auth_company_id() OR company_id IS NULL)
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );

-- tier_configurations
DROP POLICY IF EXISTS "tier_configurations_hr_company_insert" ON public.tier_configurations;
DROP POLICY IF EXISTS "tier_configurations_hr_company_update" ON public.tier_configurations;
DROP POLICY IF EXISTS "tier_configurations_hr_write" ON public.tier_configurations;
CREATE POLICY "tier_configurations_hr_write" ON public.tier_configurations
  FOR ALL
  USING (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );

-- content_items is a shared catalog (no company_id). HR/company admins can
-- publish/unpublish any item. Drop the old JWT-only policy + recreate.
DROP POLICY IF EXISTS "HR admins can publish content" ON public.content_items;
DROP POLICY IF EXISTS "content_items_hr_write" ON public.content_items;
CREATE POLICY "content_items_hr_write" ON public.content_items
  FOR UPDATE
  USING (public.auth_role() IN ('hr_admin', 'company_admin'))
  WITH CHECK (public.auth_role() IN ('hr_admin', 'company_admin'));

-- broadcasts (already created via Edge Function service-role insert, but
-- HR admin needs UPDATE for cancel + SELECT for list)
DROP POLICY IF EXISTS "broadcasts_hr_select" ON public.broadcasts;
DROP POLICY IF EXISTS "broadcasts_hr_update" ON public.broadcasts;
CREATE POLICY "broadcasts_hr_select" ON public.broadcasts
  FOR SELECT
  USING (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );
CREATE POLICY "broadcasts_hr_update" ON public.broadcasts
  FOR UPDATE
  USING (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );

-- companies (HR/Platform admin can update their own company row)
DROP POLICY IF EXISTS "HR admins can update own company settings" ON public.companies;
DROP POLICY IF EXISTS "companies_hr_update" ON public.companies;
CREATE POLICY "companies_hr_update" ON public.companies
  FOR UPDATE
  USING (
    id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  )
  WITH CHECK (
    id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );

-- challenges (HR admin can create + update their own company's challenges)
DROP POLICY IF EXISTS "challenges_hr_insert" ON public.challenges;
DROP POLICY IF EXISTS "challenges_hr_update" ON public.challenges;
CREATE POLICY "challenges_hr_insert" ON public.challenges
  FOR INSERT WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );
CREATE POLICY "challenges_hr_update" ON public.challenges
  FOR UPDATE
  USING (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_role() IN ('hr_admin', 'company_admin')
  );
