-- Score tab: your points and your team's average.
--
-- Points come only from things the app already records:
--   +10  each habit-challenge day logged
--   +20  bonus for completing a habit week (success_days reached)
--   +5   each article read to the end
-- Weeks run Sunday → Saturday, like the habit challenges.
--
-- Privacy: your own points are only returned to you. Team and company
-- numbers are averages per person and only appear when the group is at
-- least the company's minimum cohort (never fewer than 5). There is no
-- ranking of people.
--
-- Returns:
--   week_start            Sunday of the current week
--   me      { week, total, best_week,
--             week_parts  { habit_days, weeks_done, articles },
--             total_parts { habit_days, weeks_done, articles },
--             weekly [6 × { week_start, points }] }
--   team    { name, members, avg_week, active, weekly [6 × { week_start, avg }] } or null
--   company { members, avg_week, active, weekly [...] } or null

-- Every scoring event in a company, one row each, tagged with its week.
-- Internal: not callable by app users.
CREATE OR REPLACE FUNCTION public.score_events(p_company_id UUID)
RETURNS TABLE (user_id UUID, wk DATE, kind TEXT, pts INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.user_id, l.log_date - EXTRACT(DOW FROM l.log_date)::INT, 'habit_day', 10
    FROM public.habit_logs l
   WHERE l.company_id = p_company_id
  UNION ALL
  SELECT x.user_id, x.wk, 'week_done', 20 FROM (
    SELECT l.user_id, c.start_date - EXTRACT(DOW FROM c.start_date)::INT AS wk
      FROM public.habit_logs l
      JOIN public.challenges c ON c.id = l.challenge_id
     WHERE l.company_id = p_company_id
     GROUP BY l.challenge_id, l.user_id, c.start_date, c.payload
    HAVING COUNT(*) >= COALESCE((c.payload ->> 'success_days')::INT, 4)
  ) x
  UNION ALL
  SELECT a.user_id, a.d - EXTRACT(DOW FROM a.d)::INT, 'article', 5
    FROM (SELECT p.user_id, COALESCE(p.finished_at, p.started_at)::DATE AS d
            FROM public.content_progress p
            JOIN public.content_items i ON i.id = p.item_id AND i.kind = 'article'
           WHERE p.company_id = p_company_id AND p.completed) a;
$$;

-- Average points per person for a group (team, or whole company when
-- p_team_id is NULL) — this week, and each of the last 6 weeks.
CREATE OR REPLACE FUNCTION public.score_group(p_company_id UUID, p_team_id UUID, p_week DATE)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH m AS (
    SELECT id FROM public.profiles
     WHERE company_id = p_company_id AND deleted_at IS NULL AND onboarded = true
       AND (p_team_id IS NULL OR team_id = p_team_id)
  ), n AS (SELECT GREATEST(COUNT(*), 1)::NUMERIC AS n, COUNT(*)::INT AS members FROM m),
  ev AS (SELECT e.* FROM public.score_events(p_company_id) e JOIN m ON m.id = e.user_id),
  w AS (SELECT (p_week - 7 * g)::DATE AS wk FROM generate_series(0, 5) g)
  SELECT jsonb_build_object(
    'members',  (SELECT members FROM n),
    'avg_week', round(COALESCE((SELECT SUM(pts) FROM ev WHERE wk = p_week), 0) / (SELECT n FROM n)),
    'active',   (SELECT COUNT(DISTINCT user_id) FROM ev WHERE wk = p_week),
    'weekly',   (SELECT jsonb_agg(jsonb_build_object(
                          'week_start', w.wk,
                          'avg', round(COALESCE((SELECT SUM(pts) FROM ev WHERE ev.wk = w.wk), 0) / (SELECT n FROM n)))
                        ORDER BY w.wk) FROM w));
$$;

CREATE OR REPLACE FUNCTION public.my_scorecard()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  v_week    DATE := current_date - EXTRACT(DOW FROM current_date)::INT;
  v_floor   INT;
  v_me      JSONB;
  v_team_j  JSONB;
  v_comp_j  JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT team_id INTO v_team FROM public.profiles WHERE id = v_uid;
  v_floor := public.hr_min_cohort(v_company);

  WITH ev AS (SELECT * FROM public.score_events(v_company) e WHERE e.user_id = v_uid),
       w  AS (SELECT (v_week - 7 * g)::DATE AS wk FROM generate_series(0, 5) g)
  SELECT jsonb_build_object(
    'week',  COALESCE((SELECT SUM(pts) FROM ev WHERE wk = v_week), 0),
    'total', COALESCE((SELECT SUM(pts) FROM ev), 0),
    'best_week', COALESCE((SELECT MAX(s) FROM (SELECT SUM(pts) s FROM ev GROUP BY wk) b), 0),
    'week_parts', jsonb_build_object(
      'habit_days', (SELECT COUNT(*) FROM ev WHERE wk = v_week AND kind = 'habit_day'),
      'weeks_done', (SELECT COUNT(*) FROM ev WHERE wk = v_week AND kind = 'week_done'),
      'articles',   (SELECT COUNT(*) FROM ev WHERE wk = v_week AND kind = 'article')),
    'total_parts', jsonb_build_object(
      'habit_days', (SELECT COUNT(*) FROM ev WHERE kind = 'habit_day'),
      'weeks_done', (SELECT COUNT(*) FROM ev WHERE kind = 'week_done'),
      'articles',   (SELECT COUNT(*) FROM ev WHERE kind = 'article')),
    'weekly', (SELECT jsonb_agg(jsonb_build_object(
                        'week_start', w.wk,
                        'points', COALESCE((SELECT SUM(pts) FROM ev WHERE ev.wk = w.wk), 0))
                      ORDER BY w.wk) FROM w))
    INTO v_me;

  -- Group numbers only for groups big enough to stay anonymous.
  IF v_team IS NOT NULL AND public.habit_members(v_company, v_team) >= v_floor THEN
    v_team_j := public.score_group(v_company, v_team, v_week)
                || jsonb_build_object('name', (SELECT name FROM public.teams WHERE id = v_team));
  END IF;
  IF public.habit_members(v_company, NULL) >= v_floor THEN
    v_comp_j := public.score_group(v_company, NULL, v_week);
  END IF;

  RETURN jsonb_build_object(
    'week_start', v_week,
    'me',         v_me,
    'team',       v_team_j,
    'company',    v_comp_j
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.score_events(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_group(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.score_events(UUID) TO service_role;
GRANT  EXECUTE ON FUNCTION public.score_group(UUID, UUID, DATE) TO service_role;

REVOKE EXECUTE ON FUNCTION public.my_scorecard() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_scorecard() TO authenticated, service_role;
