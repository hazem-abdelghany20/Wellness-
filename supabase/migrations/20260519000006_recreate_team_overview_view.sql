-- Force-recreate hr_team_overview. The previous migration was a no-op
-- against an already-existing view in some environments and the deployed
-- definition returns 0 rows for authenticated callers even when the
-- underlying tables are visible to them. Explicit DROP + CREATE +
-- GRANT to make the view definition canonical and SECURITY INVOKER
-- (default) so it inherits the caller's RLS on teams / profiles / checkins.

DROP VIEW IF EXISTS public.hr_team_overview CASCADE;

CREATE VIEW public.hr_team_overview
WITH (security_invoker = on) AS
WITH team_counts AS (
  SELECT
    t.company_id,
    t.id          AS team_id,
    t.name        AS team_name,
    t.department,
    COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL AND p.onboarded = true) AS member_count
  FROM public.teams t
  LEFT JOIN public.profiles p
    ON p.team_id = t.id
   AND p.company_id = t.company_id
  GROUP BY t.company_id, t.id, t.name, t.department
),
recent AS (
  SELECT
    p.team_id,
    c.company_id,
    COUNT(DISTINCT c.user_id) AS group_size,
    round(avg(c.mood)::numeric, 1)   AS avg_mood,
    round(avg(c.stress)::numeric, 1) AS avg_stress,
    round(avg(c.sleep)::numeric, 1)  AS avg_sleep,
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
  coalesce(tc.member_count, 0)              AS member_count,
  coalesce(r.group_size, 0)                 AS group_size,
  coalesce(r.group_size, 0) >= 5            AS has_signal,
  coalesce(r.group_size, 0) < 5             AS suppressed,
  CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_mood   END AS avg_mood,
  CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_stress END AS avg_stress,
  CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_sleep  END AS avg_sleep,
  CASE WHEN coalesce(r.group_size, 0) >= 5 THEN r.avg_energy END AS avg_energy
FROM team_counts tc
LEFT JOIN recent r
  ON r.team_id = tc.team_id
 AND r.company_id = tc.company_id;

GRANT SELECT ON public.hr_team_overview TO authenticated;
