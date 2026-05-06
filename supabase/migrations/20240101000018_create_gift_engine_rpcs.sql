-- Wellness+ v2 gift engine RPCs — Sprint 2.
-- Status transitions for awarded_rewards happen exclusively through
-- these SECURITY DEFINER functions so all checks run server-side and
-- the corresponding ledger rows are written atomically.

-- Employee claims a reward. Optional chosen_item_id is required when
-- the matching tier_configuration has allow_employee_choice=true.
CREATE OR REPLACE FUNCTION public.claim_my_reward(
  p_reward_id     UUID,
  p_chosen_item   UUID DEFAULT NULL
)
RETURNS public.awarded_rewards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward  public.awarded_rewards%ROWTYPE;
  v_config  public.tier_configurations%ROWTYPE;
  v_chosen  UUID;
BEGIN
  -- Load and lock the reward.
  SELECT * INTO v_reward
  FROM public.awarded_rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF v_reward.id IS NULL THEN
    RAISE EXCEPTION 'reward_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_reward.profile_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_reward.status <> 'ready' THEN
    RAISE EXCEPTION 'invalid_status: %', v_reward.status USING ERRCODE = '22023';
  END IF;

  -- Find the matching tier configuration (if competition was set).
  IF v_reward.competition_id IS NOT NULL THEN
    SELECT * INTO v_config
    FROM public.tier_configurations
    WHERE competition_id = v_reward.competition_id
      AND tier = v_reward.tier;
  END IF;

  -- Decide which catalog item to record.
  IF v_config.id IS NOT NULL AND v_config.allow_employee_choice THEN
    IF p_chosen_item IS NULL THEN
      RAISE EXCEPTION 'choice_required' USING ERRCODE = '22023';
    END IF;
    IF NOT (p_chosen_item = ANY(v_config.choice_options)) THEN
      RAISE EXCEPTION 'choice_not_allowed' USING ERRCODE = '22023';
    END IF;
    v_chosen := p_chosen_item;
  ELSIF v_config.id IS NOT NULL THEN
    -- HR-fixed reward: ignore caller's choice; lock to config.
    v_chosen := v_config.gift_catalog_item_id;
  ELSE
    -- No tier config available (legacy / ad-hoc award). Trust the
    -- existing chosen_item_id on the reward; otherwise record NULL.
    v_chosen := COALESCE(p_chosen_item, v_reward.chosen_item_id);
  END IF;

  UPDATE public.awarded_rewards
  SET status         = 'claimed',
      claimed_at     = now(),
      chosen_item_id = v_chosen,
      updated_at     = now()
  WHERE id = p_reward_id
  RETURNING * INTO v_reward;

  RETURN v_reward;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_my_reward(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_my_reward(UUID, UUID) TO authenticated;

-- HR transitions a claimed reward to fulfilled and inserts a
-- gift_redemptions ledger entry.
CREATE OR REPLACE FUNCTION public.mark_reward_fulfilled(
  p_reward_id        UUID,
  p_delivery_method  TEXT,
  p_delivery_details JSONB DEFAULT '{}'::jsonb,
  p_notes            TEXT  DEFAULT NULL
)
RETURNS public.awarded_rewards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward     public.awarded_rewards%ROWTYPE;
  v_role       TEXT;
  v_company    UUID;
BEGIN
  v_role    := (auth.jwt() -> 'app_metadata' ->> 'role');
  v_company := (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID;

  IF v_role NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_reward
  FROM public.awarded_rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF v_reward.id IS NULL THEN
    RAISE EXCEPTION 'reward_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_reward.company_id <> v_company THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_reward.status <> 'claimed' THEN
    RAISE EXCEPTION 'invalid_status: %', v_reward.status USING ERRCODE = '22023';
  END IF;

  IF p_delivery_method NOT IN ('manual', 'tremendous', 'voucher_code') THEN
    RAISE EXCEPTION 'invalid_delivery_method' USING ERRCODE = '22023';
  END IF;

  -- Ledger first (FK uniqueness on awarded_reward_id; if one exists
  -- the ON CONFLICT clause keeps this idempotent for retries).
  INSERT INTO public.gift_redemptions (
    awarded_reward_id, profile_id, company_id,
    delivery_method, delivery_details, delivered_by, notes
  )
  VALUES (
    v_reward.id, v_reward.profile_id, v_reward.company_id,
    p_delivery_method, COALESCE(p_delivery_details, '{}'::jsonb),
    auth.uid(), p_notes
  )
  ON CONFLICT (awarded_reward_id) DO NOTHING;

  UPDATE public.awarded_rewards
  SET status        = 'fulfilled',
      fulfilled_at  = now(),
      fulfillment_method = p_delivery_method,
      notes         = COALESCE(p_notes, notes),
      updated_at    = now()
  WHERE id = p_reward_id
  RETURNING * INTO v_reward;

  RETURN v_reward;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_reward_fulfilled(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_reward_fulfilled(UUID, TEXT, JSONB, TEXT) TO authenticated;
