-- HR admins can manage company-scoped gift catalog items.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gift_catalog_items'
      AND policyname = 'gift_catalog_items_hr_company_insert'
  ) THEN
    CREATE POLICY "gift_catalog_items_hr_company_insert" ON public.gift_catalog_items
      FOR INSERT WITH CHECK (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gift_catalog_items'
      AND policyname = 'gift_catalog_items_hr_company_update'
  ) THEN
    CREATE POLICY "gift_catalog_items_hr_company_update" ON public.gift_catalog_items
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
