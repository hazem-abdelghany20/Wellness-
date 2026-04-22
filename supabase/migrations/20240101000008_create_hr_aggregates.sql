-- HR aggregate reports — privacy floor: never written if group_size < 5
CREATE TABLE public.hr_weekly_aggregates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES public.teams(id) ON DELETE CASCADE,  -- NULL = whole company
  week_start      DATE NOT NULL,
  group_size      INT NOT NULL,  -- number of participants; must be >= 5
  avg_sleep       NUMERIC(4,2),
  avg_stress      NUMERIC(4,2),
  avg_energy      NUMERIC(4,2),
  avg_mood        NUMERIC(4,2),
  checkin_rate    NUMERIC(4,2),  -- 0.0-1.0
  p25_sleep       NUMERIC(4,2),
  p75_sleep       NUMERIC(4,2),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, team_id, week_start)
);

CREATE INDEX idx_hr_agg_company ON public.hr_weekly_aggregates(company_id, week_start DESC);
CREATE INDEX idx_hr_agg_team    ON public.hr_weekly_aggregates(team_id, week_start DESC) WHERE team_id IS NOT NULL;

-- RLS: HR admins and company admins only
ALTER TABLE public.hr_weekly_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_agg_admin_read" ON public.hr_weekly_aggregates
  FOR SELECT USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
  );

CREATE POLICY "service_role_hr_agg" ON public.hr_weekly_aggregates
  USING (auth.role() = 'service_role');

-- Function to compute and write aggregates (called by Edge Function)
-- Enforces privacy floor: skips groups with fewer than 5 participants
CREATE OR REPLACE FUNCTION compute_hr_aggregate(
  p_company_id UUID,
  p_team_id    UUID,
  p_week_start DATE
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_size INT;
BEGIN
  -- Count participants in this group for the week
  SELECT COUNT(DISTINCT c.user_id) INTO v_group_size
  FROM public.checkins c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.company_id = p_company_id
    AND (p_team_id IS NULL OR p.team_id = p_team_id)
    AND c.checked_at >= p_week_start
    AND c.checked_at < p_week_start + INTERVAL '7 days';

  -- Privacy floor: skip if group too small
  IF v_group_size < 5 THEN
    RETURN;
  END IF;

  INSERT INTO public.hr_weekly_aggregates (
    company_id, team_id, week_start, group_size,
    avg_sleep, avg_stress, avg_energy, avg_mood,
    checkin_rate, p25_sleep, p75_sleep
  )
  SELECT
    p_company_id,
    p_team_id,
    p_week_start,
    COUNT(DISTINCT c.user_id),
    ROUND(AVG(c.sleep)::NUMERIC, 2),
    ROUND(AVG(c.stress)::NUMERIC, 2),
    ROUND(AVG(c.energy)::NUMERIC, 2),
    ROUND(AVG(c.mood)::NUMERIC, 2),
    ROUND((COUNT(DISTINCT c.user_id)::NUMERIC / NULLIF(
      (SELECT COUNT(*) FROM public.profiles pp
       WHERE pp.company_id = p_company_id
         AND (p_team_id IS NULL OR pp.team_id = p_team_id)
         AND pp.onboarded = true
         AND pp.deleted_at IS NULL
      ), 0
    )), 2),
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.sleep)::NUMERIC, 2),
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.sleep)::NUMERIC, 2)
  FROM public.checkins c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.company_id = p_company_id
    AND (p_team_id IS NULL OR p.team_id = p_team_id)
    AND c.checked_at >= p_week_start
    AND c.checked_at < p_week_start + INTERVAL '7 days'
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
