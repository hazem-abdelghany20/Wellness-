-- Wellness+ v2 privacy hardening — Sprint 4.
-- Adds:
--   1. dp_laplace(sensitivity, epsilon) — Laplace noise via inverse CDF.
--   2. Replaces compute_hr_aggregate to apply ε=2 Laplace noise to mean
--      fields. Group-size floor of 5 is preserved.
--   3. NOTE: percentile fields (p25_sleep, p75_sleep) keep raw values
--      this release; quantile DP requires more sophisticated mechanisms
--      and is tracked as a Sprint 4+ follow-up.

-- DB-level belt-and-suspenders: reject any insert that bypasses the
-- function and tries to write a sub-5 group. Any path to writing this
-- table must respect the privacy floor.
ALTER TABLE public.hr_weekly_aggregates
  DROP CONSTRAINT IF EXISTS hr_agg_group_size_floor;
ALTER TABLE public.hr_weekly_aggregates
  ADD CONSTRAINT hr_agg_group_size_floor CHECK (group_size >= 5);

CREATE OR REPLACE FUNCTION public.dp_laplace(
  p_sensitivity NUMERIC,
  p_epsilon     NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE PARALLEL UNSAFE
AS $$
DECLARE
  u NUMERIC;
  scale NUMERIC;
BEGIN
  IF p_epsilon IS NULL OR p_epsilon <= 0 THEN
    RETURN 0;
  END IF;
  scale := p_sensitivity / p_epsilon;
  u := random() - 0.5;  -- uniform in [-0.5, 0.5)
  IF u = 0 THEN RETURN 0; END IF;
  RETURN - scale * sign(u) * ln(1 - 2 * abs(u));
END;
$$;

COMMENT ON FUNCTION public.dp_laplace(NUMERIC, NUMERIC)
  IS 'Laplace inverse-CDF sampler. Returns N(0, sensitivity/epsilon) Laplace noise. Used by HR aggregates to enforce ε-DP.';

-- Replace compute_hr_aggregate with the DP-noised version.
-- Sensitivity for 1-10 metrics over n participants: 9/n.
-- Sensitivity for checkin_rate over n: 1/n.
-- Each mean gets independent noise at ε=2.
CREATE OR REPLACE FUNCTION public.compute_hr_aggregate(
  p_company_id UUID,
  p_team_id    UUID,
  p_week_start DATE
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_size       INT;
  v_active_pop       INT;
  v_avg_sleep        NUMERIC;
  v_avg_stress       NUMERIC;
  v_avg_energy       NUMERIC;
  v_avg_mood         NUMERIC;
  v_p25_sleep        NUMERIC;
  v_p75_sleep        NUMERIC;
  v_checkin_rate     NUMERIC;
  v_eps              NUMERIC := 2.0;
  v_metric_sensitivity NUMERIC;
  v_rate_sensitivity   NUMERIC;
BEGIN
  SELECT COUNT(DISTINCT c.user_id) INTO v_group_size
  FROM public.checkins c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.company_id = p_company_id
    AND (p_team_id IS NULL OR p.team_id = p_team_id)
    AND c.checked_at >= p_week_start
    AND c.checked_at < p_week_start + INTERVAL '7 days';

  IF v_group_size < 5 THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_active_pop
  FROM public.profiles pp
  WHERE pp.company_id = p_company_id
    AND (p_team_id IS NULL OR pp.team_id = p_team_id)
    AND pp.onboarded = true
    AND pp.deleted_at IS NULL;

  SELECT AVG(c.sleep), AVG(c.stress), AVG(c.energy), AVG(c.mood),
         PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.sleep),
         PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.sleep)
  INTO v_avg_sleep, v_avg_stress, v_avg_energy, v_avg_mood,
       v_p25_sleep, v_p75_sleep
  FROM public.checkins c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.company_id = p_company_id
    AND (p_team_id IS NULL OR p.team_id = p_team_id)
    AND c.checked_at >= p_week_start
    AND c.checked_at < p_week_start + INTERVAL '7 days';

  v_checkin_rate := v_group_size::NUMERIC / NULLIF(v_active_pop, 0);

  -- DP noise scaled per record.
  v_metric_sensitivity := 9.0 / v_group_size;        -- 1-10 scale
  v_rate_sensitivity   := 1.0 / v_group_size;        -- 0-1 scale

  v_avg_sleep    := v_avg_sleep    + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_avg_stress   := v_avg_stress   + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_avg_energy   := v_avg_energy   + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_avg_mood     := v_avg_mood     + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_checkin_rate := v_checkin_rate + public.dp_laplace(v_rate_sensitivity,   v_eps);

  -- Clip to plausible ranges (post-noise) so downstream charts stay sane.
  v_avg_sleep    := GREATEST(1, LEAST(10, v_avg_sleep));
  v_avg_stress   := GREATEST(1, LEAST(10, v_avg_stress));
  v_avg_energy   := GREATEST(1, LEAST(10, v_avg_energy));
  v_avg_mood     := GREATEST(1, LEAST(10, v_avg_mood));
  v_checkin_rate := GREATEST(0, LEAST(1,  v_checkin_rate));

  INSERT INTO public.hr_weekly_aggregates (
    company_id, team_id, week_start, group_size,
    avg_sleep, avg_stress, avg_energy, avg_mood,
    checkin_rate, p25_sleep, p75_sleep
  )
  VALUES (
    p_company_id, p_team_id, p_week_start, v_group_size,
    ROUND(v_avg_sleep,  2),
    ROUND(v_avg_stress, 2),
    ROUND(v_avg_energy, 2),
    ROUND(v_avg_mood,   2),
    ROUND(v_checkin_rate, 2),
    ROUND(v_p25_sleep, 2),
    ROUND(v_p75_sleep, 2)
  )
  ON CONFLICT (company_id, team_id, week_start) DO UPDATE SET
    group_size   = EXCLUDED.group_size,
    avg_sleep    = EXCLUDED.avg_sleep,
    avg_stress   = EXCLUDED.avg_stress,
    avg_energy   = EXCLUDED.avg_energy,
    avg_mood     = EXCLUDED.avg_mood,
    checkin_rate = EXCLUDED.checkin_rate,
    p25_sleep    = EXCLUDED.p25_sleep,
    p75_sleep    = EXCLUDED.p75_sleep,
    computed_at  = now();
END;
$$;

COMMENT ON FUNCTION public.compute_hr_aggregate(UUID, UUID, DATE)
  IS 'Computes HR weekly aggregates with 5+ group floor and ε=2 Laplace noise on means + checkin_rate. Percentiles are raw (Sprint 4+ follow-up).';
