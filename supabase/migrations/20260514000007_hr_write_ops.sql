-- HR portal write operations used by UAT: settings, content assignment, and publishing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND policyname = 'HR admins can update own company settings'
  ) THEN
    CREATE POLICY "HR admins can update own company settings"
      ON public.companies
      FOR UPDATE
      TO authenticated
      USING (
        id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      )
      WITH CHECK (
        id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'content_items'
      AND policyname = 'HR admins can publish content'
  ) THEN
    CREATE POLICY "HR admins can publish content"
      ON public.content_items
      FOR UPDATE
      TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin'))
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.content_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'team')),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((scope = 'all' AND team_id IS NULL) OR (scope = 'team' AND team_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_content_assignments_company_created
  ON public.content_assignments(company_id, created_at DESC);

ALTER TABLE public.content_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'content_assignments'
      AND policyname = 'HR admins manage content assignments'
  ) THEN
    CREATE POLICY "HR admins manage content assignments"
      ON public.content_assignments
      FOR ALL
      TO authenticated
      USING (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      )
      WITH CHECK (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'content_assignments'
      AND policyname = 'Employees read own company content assignments'
  ) THEN
    CREATE POLICY "Employees read own company content assignments"
      ON public.content_assignments
      FOR SELECT
      TO authenticated
      USING (company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_assignments TO authenticated;
