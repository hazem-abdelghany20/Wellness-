-- HR admins can schedule company-scoped challenges.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'challenges'
      AND policyname = 'challenges_hr_company_insert'
  ) THEN
    CREATE POLICY "challenges_hr_company_insert" ON public.challenges
      FOR INSERT WITH CHECK (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'challenges'
      AND policyname = 'challenges_hr_company_update'
  ) THEN
    CREATE POLICY "challenges_hr_company_update" ON public.challenges
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
