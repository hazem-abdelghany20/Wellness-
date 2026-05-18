-- HR broadcasts used by the HR portal communications workflow.

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title_en     TEXT NOT NULL,
  title_ar     TEXT,
  body_en      TEXT NOT NULL,
  body_ar      TEXT,
  scope        TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'team')),
  team_id      UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at      TIMESTAMPTZ,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_company_status
  ON public.broadcasts(company_id, status, scheduled_at DESC);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'broadcasts'
      AND policyname = 'broadcasts_hr_company_read'
  ) THEN
    CREATE POLICY "broadcasts_hr_company_read" ON public.broadcasts
      FOR SELECT USING (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'broadcasts'
      AND policyname = 'broadcasts_hr_company_insert'
  ) THEN
    CREATE POLICY "broadcasts_hr_company_insert" ON public.broadcasts
      FOR INSERT WITH CHECK (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'broadcasts'
      AND policyname = 'broadcasts_hr_company_update'
  ) THEN
    CREATE POLICY "broadcasts_hr_company_update" ON public.broadcasts
      FOR UPDATE USING (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      )
      WITH CHECK (
        company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'broadcasts'
      AND policyname = 'service_role_broadcasts'
  ) THEN
    CREATE POLICY "service_role_broadcasts" ON public.broadcasts
      USING (auth.role() = 'service_role');
  END IF;
END $$;
