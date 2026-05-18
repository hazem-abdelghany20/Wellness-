-- Platform admin console support tables, policies, and RPC helpers.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('employee','manager','hr_admin','company_admin','wellness_admin'));

ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft','review','published'));
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'global';
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS plays_30d INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.billing_state (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'starter',
  mrr_cents INT NOT NULL DEFAULT 0,
  seats INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','paused','canceled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'paid',
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  config JSONB NOT NULL DEFAULT '{}',
  configured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind)
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','company','user')),
  target_id UUID,
  enabled BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, scope, target_id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target TEXT,
  target_id UUID,
  severity TEXT NOT NULL DEFAULT 'info',
  details JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.localization_strings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, lang)
);

CREATE TABLE IF NOT EXISTS public.challenge_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  kind TEXT NOT NULL DEFAULT 'movement',
  default_window_days INT NOT NULL DEFAULT 14,
  target INT,
  metric TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localization_strings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_templates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_wellness_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role' = 'wellness_admin';
$$;

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
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = t || '_wellness_admin_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_wellness_admin()) WITH CHECK (public.is_wellness_admin())',
        t || '_wellness_admin_all',
        t
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO public.billing_state (company_id, plan, mrr_cents, seats, status)
SELECT id, plan, CASE WHEN slug = 'wellhouse' THEN 1250000 ELSE 450000 END, CASE WHEN slug = 'wellhouse' THEN 250 ELSE 90 END, 'active'
FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.integrations (company_id, kind, status, config, configured_at)
SELECT id, 'supabase', 'configured', '{}', now()
FROM public.companies
ON CONFLICT (company_id, kind) DO NOTHING;

INSERT INTO public.feature_flags (key, scope, enabled, payload)
VALUES
  ('gifts.v2', 'global', true, '{}'),
  ('arabic.rtl', 'global', true, '{}'),
  ('pwa.install', 'global', false, '{}')
ON CONFLICT (key, scope, target_id) DO NOTHING;

INSERT INTO public.localization_strings (key, lang, value)
VALUES
  ('app.name', 'en', 'Wellness+'),
  ('app.name', 'ar', 'ويلنس+'),
  ('gifts.title', 'en', 'Gifts'),
  ('gifts.title', 'ar', 'الهدايا')
ON CONFLICT (key, lang) DO NOTHING;

INSERT INTO public.challenge_templates (slug, title_en, title_ar, kind, default_window_days, target, metric)
VALUES
  ('sleep-sprint-21', '21-Day Sleep Sprint', 'تحدي النوم 21 يوماً', 'sleep', 21, 7, 'sleep'),
  ('sabr-21', 'Sabr — 21 Days of Patience', 'صبر — ٢١ يوماً من الصبر', 'mindfulness', 21, 21, 'completion'),
  ('niyyah-7', 'Niyyah — 7 Days of Intention', 'نيّة — ٧ أيام من النيّة', 'mindfulness', 7, 7, 'completion')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.audit_log (actor_email, action, target, severity, details)
VALUES ('system', 'remote_uat_seeded', 'admin_console', 'info', '{"source":"20260514000003_admin_console_support"}');

CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  p_name TEXT,
  p_locale TEXT DEFAULT 'en',
  p_timezone TEXT DEFAULT 'UTC',
  p_plan TEXT DEFAULT 'starter'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies%ROWTYPE;
  v_slug TEXT;
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN
    v_slug := 'tenant';
  END IF;

  INSERT INTO public.companies (name, slug, code, plan, settings)
  VALUES (
    p_name,
    v_slug || '-' || substr(gen_random_uuid()::text, 1, 6),
    upper(substr(md5(random()::text), 1, 2) || '-' || substr(md5(random()::text), 1, 4)),
    CASE WHEN p_plan IN ('starter','growth','enterprise') THEN p_plan ELSE 'starter' END,
    jsonb_build_object('locale', p_locale, 'timezone', p_timezone)
  )
  RETURNING * INTO v_company;

  INSERT INTO public.billing_state (company_id, plan, mrr_cents, seats, status)
  VALUES (v_company.id, p_plan, 0, 0, 'active')
  ON CONFLICT (company_id) DO NOTHING;

  RETURN to_jsonb(v_company);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_billing(p_company_id UUID, p_patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.billing_state%ROWTYPE;
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.billing_state (company_id)
  VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  UPDATE public.billing_state
  SET
    plan = coalesce(p_patch ->> 'plan', plan),
    status = coalesce(p_patch ->> 'status', status),
    mrr_cents = coalesce((p_patch ->> 'mrr_cents')::INT, mrr_cents),
    seats = coalesce((p_patch ->> 'seats')::INT, seats),
    updated_at = now()
  WHERE company_id = p_company_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_flag(
  p_key TEXT,
  p_scope TEXT,
  p_target_id UUID,
  p_enabled BOOLEAN,
  p_payload JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.feature_flags (key, scope, target_id, enabled, payload, updated_at)
  VALUES (p_key, p_scope, p_target_id, p_enabled, coalesce(p_payload, '{}'), now())
  ON CONFLICT (key, scope, target_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    payload = EXCLUDED.payload,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id UUID, p_role TEXT, p_company_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      company_id = coalesce(p_company_id, company_id)
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_invite_company_admin(p_company_id UUID, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pending_company_associations (email, company_id, verified)
  VALUES (lower(trim(p_email)), p_company_id, true)
  ON CONFLICT (email) DO UPDATE SET company_id = EXCLUDED.company_id, verified = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_wellness_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_tenant(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_billing(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_flag(TEXT, TEXT, UUID, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invite_company_admin(UUID, TEXT) TO authenticated;
