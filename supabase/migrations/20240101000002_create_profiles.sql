-- User profiles extending auth.users
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id),
  team_id         UUID REFERENCES public.teams(id),
  display_name    TEXT NOT NULL DEFAULT '',
  initials        TEXT NOT NULL DEFAULT '',
  avatar_kind     TEXT NOT NULL DEFAULT 'monogram' CHECK (avatar_kind IN ('monogram','orbit','wave','bloom','stone','ember')),
  role            TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','manager','hr_admin','company_admin')),
  -- Onboarding baseline (1-10 scale)
  baseline_sleep  SMALLINT CHECK (baseline_sleep BETWEEN 1 AND 10),
  baseline_stress SMALLINT CHECK (baseline_stress BETWEEN 1 AND 10),
  baseline_energy SMALLINT CHECK (baseline_energy BETWEEN 1 AND 10),
  baseline_mood   SMALLINT CHECK (baseline_mood BETWEEN 1 AND 10),
  goals           TEXT[] DEFAULT '{}',
  -- Derived / cached
  streak_current  INT NOT NULL DEFAULT 0,
  streak_best     INT NOT NULL DEFAULT 0,
  checkins_total  INT NOT NULL DEFAULT 0,
  -- Consent
  consented_at    TIMESTAMPTZ,
  consent_version TEXT DEFAULT 'v1',
  -- Meta
  onboarded       BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_profiles_team_id ON public.profiles(team_id);

-- Auto-compute initials from display_name
CREATE OR REPLACE FUNCTION compute_initials(name TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(
    string_agg(left(word, 1), '')
  )
  FROM (
    SELECT regexp_split_to_table(trim(name), '\s+') AS word
    LIMIT 2
  ) w
  WHERE word <> '';
$$;

CREATE OR REPLACE FUNCTION set_initials()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name OR TG_OP = 'INSERT' THEN
    NEW.initials := compute_initials(NEW.display_name);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_initials
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_initials();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY "profiles_own_read" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- HR admins can read all profiles in their company (anonymized queries done via views)
CREATE POLICY "hr_company_read" ON public.profiles
  FOR SELECT USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
  );

CREATE POLICY "service_role_profiles" ON public.profiles
  USING (auth.role() = 'service_role');

-- Handle new user: create profile stub on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_company_id UUID;
  v_company_code TEXT;
BEGIN
  -- company_code stored in raw_user_meta_data during signup
  v_company_code := upper(trim((NEW.raw_user_meta_data ->> 'company_code')::TEXT));

  SELECT id INTO v_company_id
  FROM public.companies
  WHERE code = v_company_code;

  IF v_company_id IS NULL THEN
    -- Fail silently; Edge Function verify-company-code validates before signup
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, company_id, display_name)
  VALUES (NEW.id, v_company_id, coalesce(NEW.raw_user_meta_data ->> 'display_name', ''));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
