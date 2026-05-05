-- Wellness+ v2 gift engine (v0) — Sprint 0 of BUILD_PLAN.md.
--
-- Scope: only the two tables consumed by the employee Mine-tab wallet
-- hero. The HR-facing tables (gift_pools, tier_configurations,
-- gift_redemptions) ship in Sprint 1 alongside their first consumer
-- screens.
--
-- This is v0 schema; column shape may evolve before first paying
-- customer signs. Update statements (ready → claimed, claimed →
-- fulfilled) will go through SECURITY DEFINER RPCs added in Sprint 2,
-- so no user-level UPDATE policy is granted on awarded_rewards.

CREATE TABLE public.gift_catalog_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,  -- NULL = global catalog
  name_en         TEXT NOT NULL,
  name_ar         TEXT,
  description_en  TEXT,
  description_ar  TEXT,
  category        TEXT NOT NULL CHECK (category IN ('wh_service', 'amazon', 'custom')),
  value_minor     INT  NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EGP',
  thumbnail_url   TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gci_company ON public.gift_catalog_items(company_id, active);

CREATE TABLE public.awarded_rewards (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id         UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  competition_id     UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  tier               TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  chosen_item_id     UUID REFERENCES public.gift_catalog_items(id),
  status             TEXT NOT NULL CHECK (status IN ('ready', 'claimed', 'fulfilled')) DEFAULT 'ready',
  fulfillment_method TEXT NOT NULL DEFAULT 'manual' CHECK (fulfillment_method IN ('manual', 'tremendous')),
  notes              TEXT,
  awarded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at         TIMESTAMPTZ,
  fulfilled_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ar_profile_status ON public.awarded_rewards(profile_id, status, awarded_at DESC);
CREATE INDEX idx_ar_company        ON public.awarded_rewards(company_id, status);

-- Shared updated_at trigger.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gci_updated
  BEFORE UPDATE ON public.gift_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_ar_updated
  BEFORE UPDATE ON public.awarded_rewards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.gift_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awarded_rewards    ENABLE ROW LEVEL SECURITY;

-- Catalog: visible to any authenticated company member (or globally for NULL company_id).
CREATE POLICY "gci_company_read" ON public.gift_catalog_items
  FOR SELECT USING (
    company_id IS NULL OR
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
  );

CREATE POLICY "service_role_gci" ON public.gift_catalog_items
  USING (auth.role() = 'service_role');

-- Awarded rewards: an employee reads their own rows only.
CREATE POLICY "ar_own_select" ON public.awarded_rewards
  FOR SELECT USING (profile_id = auth.uid());

-- HR admins read all rewards in their company for status reports.
CREATE POLICY "ar_hr_read" ON public.awarded_rewards
  FOR SELECT USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
  );

-- Updates flow through SECURITY DEFINER RPCs (Sprint 2). No direct
-- user UPDATE policy by design.
CREATE POLICY "service_role_ar" ON public.awarded_rewards
  USING (auth.role() = 'service_role');
