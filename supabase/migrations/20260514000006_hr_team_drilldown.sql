-- Better HR team overview rows and drawer drilldown.

DROP VIEW IF EXISTS public.hr_team_overview;

CREATE OR REPLACE VIEW public.hr_team_overview AS
WITH team_counts AS (
  SELECT
    t.company_id,
    t.id AS team_id,
    t.name AS team_name,
    t.department,
    COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL AND p.onboarded = true) AS member_count
  FROM public.teams t
  LEFT JOIN public.profiles p ON p.team_id = t.id AND p.company_id = t.company_id
  GROUP BY t.company_id, t.id, t.name, t.department
),
recent AS (
  SELECT
    p.team_id,
    c.company_id,
    COUNT(DISTINCT c.user_id) AS group_size,
    round(avg(c.mood)::numeric, 1) AS avg_mood,
    round(avg(c.stress)::numeric, 1) AS avg_stress,
    round(avg(c.sleep)::numeric, 1) AS avg_sleep,
    round(avg(c.energy)::numeric, 1) AS avg_energy,
    max(date_trunc('week', c.checked_at)::date) AS week_start
  FROM public.checkins c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.checked_at >= current_date - interval '30 days'
  GROUP BY p.team_id, c.company_id
)
SELECT
  tc.company_id,
  tc.team_id,
  tc.team_name,
  tc.department,
  coalesce(r.week_start, date_trunc('week', current_date)::date) AS week_start,
  coalesce(tc.member_count, 0) AS member_count,
  coalesce(r.group_size, 0) AS group_size,
  coalesce(r.group_size, 0) >= 5 AS has_signal,
  coalesce(r.group_size, 0) < 5 AS suppressed,
  CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_mood END AS avg_mood,
  CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_stress END AS avg_stress,
  CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_sleep END AS avg_sleep,
  CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_energy END AS avg_energy
FROM team_counts tc
LEFT JOIN recent r ON r.team_id = tc.team_id AND r.company_id = tc.company_id
WHERE tc.company_id = NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin', 'manager');

GRANT SELECT ON public.hr_team_overview TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_team_drilldown(p_team_id UUID, p_range TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::UUID;
  v_role TEXT := auth.jwt() -> 'app_metadata' ->> 'role';
  v_days INT := CASE p_range WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END;
  v_rows JSONB;
BEGIN
  IF v_company_id IS NULL OR v_role NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  WITH days AS (
    SELECT generate_series(current_date - (v_days - 1), current_date, interval '1 day')::date AS checked_at
  ),
  daily AS (
    SELECT
      d.checked_at,
      COUNT(DISTINCT p.id) AS group_size,
      CASE WHEN COUNT(DISTINCT p.id) >= 5 THEN round(avg(c.sleep) FILTER (WHERE p.id IS NOT NULL)::numeric, 1) END AS avg_sleep,
      CASE WHEN COUNT(DISTINCT p.id) >= 5 THEN round(avg(c.stress) FILTER (WHERE p.id IS NOT NULL)::numeric, 1) END AS avg_stress,
      CASE WHEN COUNT(DISTINCT p.id) >= 5 THEN round(avg(c.energy) FILTER (WHERE p.id IS NOT NULL)::numeric, 1) END AS avg_energy,
      CASE WHEN COUNT(DISTINCT p.id) >= 5 THEN round(avg(c.mood) FILTER (WHERE p.id IS NOT NULL)::numeric, 1) END AS avg_mood
    FROM days d
    LEFT JOIN public.checkins c
      ON c.company_id = v_company_id
     AND c.checked_at = d.checked_at
    LEFT JOIN public.profiles p
      ON p.id = c.user_id
     AND p.company_id = v_company_id
     AND p.team_id = p_team_id
    GROUP BY d.checked_at
    ORDER BY d.checked_at
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'checked_at', checked_at,
    'group_size', group_size,
    'suppressed', group_size < 5,
    'avg_sleep', avg_sleep,
    'avg_stress', avg_stress,
    'avg_energy', avg_energy,
    'avg_mood', avg_mood
  ) ORDER BY checked_at), '[]'::jsonb)
  INTO v_rows
  FROM daily;

  RETURN jsonb_build_object('team_id', p_team_id, 'range', p_range, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_team_drilldown(UUID, TEXT) TO authenticated;
