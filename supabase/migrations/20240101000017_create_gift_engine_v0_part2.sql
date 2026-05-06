-- Wellness+ v2 gift engine (v0) part 2 — completes the Sprint 0 data
-- model. Sprint 1 HR Gifts screens consume these; the manual claim flow
-- in Sprint 2 inserts into gift_redemptions through a SECURITY DEFINER
-- RPC.

-- A budget pool HR allocates for awarding employees. Optionally linked
-- to a competition.
CREATE TABLE public.gift_pools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  budget_minor    INT  NOT NULL DEFAULT 0,
  spent_minor     INT  NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EGP',
  competition_id  UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gp_company        ON public.gift_pools(company_id, active);
CREATE INDEX idx_gp_competition    ON public.gift_pools(competition_id) WHERE competition_id IS NOT NULL;

-- Per-competition tier configuration (Bronze · Silver · Gold).
-- Either gift_catalog_item_id is set (HR pre-picks) or
-- allow_employee_choice + choice_options are set (employee picks).
CREATE TABLE public.tier_configurations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  competition_id           UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  tier                     TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  gift_catalog_item_id     UUID REFERENCES public.gift_catalog_items(id),
  allow_employee_choice    BOOLEAN NOT NULL DEFAULT false,
  choice_options           UUID[] NOT NULL DEFAULT '{}',
  value_minor_override     INT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competition_id, tier),
  -- Either a single item is picked, or employee-choice is enabled.
  -- When choice is enabled, choice_options must be non-empty.
  CHECK (
    (allow_employee_choice = false AND gift_catalog_item_id IS NOT NULL)
    OR
    (allow_employee_choice = true  AND array_length(choice_options, 1) >= 1)
  )
);

CREATE INDEX idx_tc_competition ON public.tier_configurations(competition_id, tier);
CREATE INDEX idx_tc_company     ON public.tier_configurations(company_id);

-- Redemption ledger. One row per fulfillment event.
CREATE TABLE public.gift_redemptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  awarded_reward_id    UUID NOT NULL UNIQUE REFERENCES public.awarded_rewards(id) ON DELETE CASCADE,
  profile_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id           UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  redeemed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_method      TEXT NOT NULL CHECK (delivery_method IN ('manual', 'tremendous', 'voucher_code')),
  delivery_details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivered_by         UUID REFERENCES auth.users(id),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gr_profile ON public.gift_redemptions(profile_id, redeemed_at DESC);
CREATE INDEX idx_gr_company ON public.gift_redemptions(company_id, redeemed_at DESC);

-- updated_at triggers (touch_updated_at function defined in 0016)
CREATE TRIGGER trg_gp_updated BEFORE UPDATE ON public.gift_pools          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tc_updated BEFORE UPDATE ON public.tier_configurations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.gift_pools          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_redemptions    ENABLE ROW LEVEL SECURITY;

-- Pools: HR/admin-only read+write (company-scoped). No employee access.
CREATE POLICY "gp_hr_read" ON public.gift_pools
  FOR SELECT USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
  );

CREATE POLICY "gp_hr_write" ON public.gift_pools
  FOR ALL USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
  );

CREATE POLICY "service_role_gp" ON public.gift_pools USING (auth.role() = 'service_role');

-- Tier configurations: HR/admin manage; employees see their company's
-- (so their Today screen can label "what tier earns what" without
-- exposing other companies' configs).
CREATE POLICY "tc_company_read" ON public.tier_configurations
  FOR SELECT USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
  );

CREATE POLICY "tc_hr_write" ON public.tier_configurations
  FOR ALL USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
  );

CREATE POLICY "service_role_tc" ON public.tier_configurations USING (auth.role() = 'service_role');

-- Redemptions: an employee reads their own row; HR reads all in
-- company. Inserts go through a SECURITY DEFINER RPC (Sprint 2) so no
-- direct INSERT policy is granted.
CREATE POLICY "gr_own_read" ON public.gift_redemptions
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "gr_hr_read" ON public.gift_redemptions
  FOR SELECT USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
  );

CREATE POLICY "service_role_gr" ON public.gift_redemptions USING (auth.role() = 'service_role');
