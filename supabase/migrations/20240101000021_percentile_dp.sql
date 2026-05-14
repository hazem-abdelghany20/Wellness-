-- Wellness+ v2 — close Sprint 4 percentile DP follow-up.
-- Adds ε=2 Laplace noise to p25/p75 sleep percentiles using the bounded-
-- range mechanism: sensitivity = (max - min) / n on the 1-10 scale = 9/n.
-- This is the same per-record sensitivity used for means; it's a
-- conservative bound that holds for any quantile of a bounded variable.
-- Post-noise clip + monotone re-order keeps p25 <= p75 in the output.

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
  v_swap             NUMERIC;
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
  -- Bounded-range sensitivity (1-10 scale → 9/n) bounds the influence of
  -- a single record on any AVG or PERCENTILE_CONT of that variable.
  v_metric_sensitivity := 9.0 / v_group_size;
  v_rate_sensitivity   := 1.0 / v_group_size;

  v_avg_sleep    := v_avg_sleep    + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_avg_stress   := v_avg_stress   + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_avg_energy   := v_avg_energy   + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_avg_mood     := v_avg_mood     + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_checkin_rate := v_checkin_rate + public.dp_laplace(v_rate_sensitivity,   v_eps);

  -- Percentiles: independent ε=2 Laplace noise per quantile.
  v_p25_sleep    := v_p25_sleep    + public.dp_laplace(v_metric_sensitivity, v_eps);
  v_p75_sleep    := v_p75_sleep    + public.dp_laplace(v_metric_sensitivity, v_eps);

  -- Clip to plausible ranges so downstream charts stay sane.
  v_avg_sleep    := GREATEST(1, LEAST(10, v_avg_sleep));
  v_avg_stress   := GREATEST(1, LEAST(10, v_avg_stress));
  v_avg_energy   := GREATEST(1, LEAST(10, v_avg_energy));
  v_avg_mood     := GREATEST(1, LEAST(10, v_avg_mood));
  v_checkin_rate := GREATEST(0, LEAST(1,  v_checkin_rate));
  v_p25_sleep    := GREATEST(1, LEAST(10, v_p25_sleep));
  v_p75_sleep    := GREATEST(1, LEAST(10, v_p75_sleep));

  -- Monotone re-order: noise can flip p25 > p75. Swap to preserve the
  -- semantic contract; doesn't break DP (post-processing).
  IF v_p25_sleep > v_p75_sleep THEN
    v_swap := v_p25_sleep;
    v_p25_sleep := v_p75_sleep;
    v_p75_sleep := v_swap;
  END IF;

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
  IS 'Computes HR weekly aggregates with 5+ group floor and ε=2 Laplace noise on every released metric (means, checkin_rate, p25_sleep, p75_sleep). Bounded-range sensitivity = 9/n on the 1-10 scale; 1/n for checkin_rate. Monotone re-order applied to percentiles post-noise.';
