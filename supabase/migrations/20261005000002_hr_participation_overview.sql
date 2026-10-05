-- HR dashboard: participation only.
--
-- The employee app no longer collects check-ins, so HR stops seeing mood /
-- stress averages and instead sees who takes part: weekly habit
-- challenges (joined / completed) and library reads. Nothing about any
-- person's health is involved; percentages still respect the company's
-- minimum cohort.
--
-- Returns one JSON document for the dashboard:
--   members            onboarded employees
--   took_part          people who logged a habit day in the range
--   completed          people who completed at least one habit week in range
--   readers / reads    people who opened an article / articles opened
--   finished_reads     articles read to the end
--   participation_pct  took_part / members (null under the cohort floor)
--   current            the running (or next) habit challenge with counts
--   top_articles       most-opened articles in the range (title + count)
--   weekly             last 8 weeks: people taking part, people reading

CREATE OR REPLACE FUNCTION public.hr_participation_overview(p_range TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_days    INT  := CASE p_range WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END;
  v_start   DATE := current_date - v_days;
  v_floor   INT;
  v_members INT;
  v_took    INT;
  v_done    INT;
  v_readers INT;
  v_reads   INT;
  v_fin     INT;
  v_current JSONB;
  v_top     JSONB;
  v_weekly  JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_floor   := public.hr_min_cohort(v_company);
  v_members := public.habit_members(v_company, NULL);

  SELECT COUNT(DISTINCT l.user_id) INTO v_took
    FROM public.habit_logs l
   WHERE l.company_id = v_company AND l.log_date >= v_start;

  SELECT COUNT(DISTINCT x.user_id) INTO v_done FROM (
    SELECT l.user_id
      FROM public.habit_logs l
      JOIN public.challenges c ON c.id = l.challenge_id
     WHERE l.company_id = v_company AND c.end_date >= v_start
     GROUP BY l.challenge_id, l.user_id, c.payload
    HAVING COUNT(*) >= COALESCE((c.payload ->> 'success_days')::INT, 4)
  ) x;

  SELECT COUNT(DISTINCT p.user_id), COUNT(*), COUNT(*) FILTER (WHERE p.completed)
    INTO v_readers, v_reads, v_fin
    FROM public.content_progress p
    JOIN public.content_items i ON i.id = p.item_id AND i.kind = 'article'
   WHERE p.company_id = v_company AND p.started_at >= v_start;

  SELECT to_jsonb(h) INTO v_current FROM (
    SELECT r.id, r.title_en, r.title_ar, r.team_name, r.start_date, r.end_date,
           r.status, r.members, r.participants, r.completed, r.completion_pct
      FROM public.hr_habit_challenges() r
     WHERE r.status IN ('active', 'upcoming')
     ORDER BY (r.status = 'active') DESC, r.start_date
     LIMIT 1
  ) h;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.reads DESC, t.title_en), '[]'::jsonb) INTO v_top FROM (
    SELECT i.id, i.title_en, i.title_ar, COUNT(*) AS reads
      FROM public.content_progress p
      JOIN public.content_items i ON i.id = p.item_id AND i.kind = 'article'
     WHERE p.company_id = v_company AND p.started_at >= v_start
     GROUP BY i.id, i.title_en, i.title_ar
     ORDER BY COUNT(*) DESC
     LIMIT 5
  ) t;

  SELECT jsonb_agg(jsonb_build_object(
           'week_start', w.wk,
           'took_part', (SELECT COUNT(DISTINCT l.user_id) FROM public.habit_logs l
                          WHERE l.company_id = v_company AND l.log_date >= w.wk AND l.log_date < w.wk + 7),
           'readers',   (SELECT COUNT(DISTINCT p.user_id) FROM public.content_progress p
                          WHERE p.company_id = v_company AND p.started_at >= w.wk AND p.started_at < w.wk + 7))
         ORDER BY w.wk)
    INTO v_weekly
    FROM (SELECT (current_date - EXTRACT(DOW FROM current_date)::INT - 7 * g)::DATE AS wk
            FROM generate_series(0, 7) g) w;

  RETURN jsonb_build_object(
    'range',             p_range,
    'members',           v_members,
    'took_part',         v_took,
    'completed',         v_done,
    'readers',           v_readers,
    'reads',             v_reads,
    'finished_reads',    v_fin,
    'participation_pct', CASE WHEN v_members >= v_floor AND v_members > 0
                              THEN round(100.0 * v_took / v_members) END,
    'min_cohort',        v_floor,
    'current',           v_current,
    'top_articles',      v_top,
    'weekly',            COALESCE(v_weekly, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hr_participation_overview(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.hr_participation_overview(TEXT) TO authenticated, service_role;
