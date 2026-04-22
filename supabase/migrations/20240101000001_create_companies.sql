-- Companies and team structure
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.companies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  code          TEXT NOT NULL UNIQUE CHECK (length(code) >= 4),
  logo_url      TEXT,
  plan          TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  department    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_company_id ON public.teams(company_id);

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Companies: only members of the company can read
CREATE POLICY "company_members_read" ON public.companies
  FOR SELECT USING (
    id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
  );

-- Teams: only members of same company can read
CREATE POLICY "team_company_read" ON public.teams
  FOR SELECT USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
  );

-- Service role can do anything
CREATE POLICY "service_role_companies" ON public.companies
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_teams" ON public.teams
  USING (auth.role() = 'service_role');
