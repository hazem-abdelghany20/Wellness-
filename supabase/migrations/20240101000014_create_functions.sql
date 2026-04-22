-- Utility functions and views

-- Secure function: get own checkin history (last N days)
CREATE OR REPLACE FUNCTION get_my_checkin_history(p_days INT DEFAULT 30)
RETURNS TABLE (
  checked_at DATE,
  sleep SMALLINT,
  stress SMALLINT,
  energy SMALLINT,
  mood SMALLINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT checked_at, sleep, stress, energy, mood
  FROM public.checkins
  WHERE user_id = auth.uid()
    AND checked_at >= current_date - p_days
  ORDER BY checked_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_my_checkin_history TO authenticated;

-- Secure function: get own progress stats
CREATE OR REPLACE FUNCTION get_my_progress_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_stats JSONB;
BEGIN
  WITH recent AS (
    SELECT
      checked_at,
      sleep, stress, energy, mood
    FROM public.checkins
    WHERE user_id = auth.uid()
      AND checked_at >= current_date - 30
    ORDER BY checked_at DESC
  ),
  agg AS (
    SELECT
      ROUND(AVG(sleep)::NUMERIC, 1)  AS avg_sleep,
      ROUND(AVG(stress)::NUMERIC, 1) AS avg_stress,
      ROUND(AVG(energy)::NUMERIC, 1) AS avg_energy,
      ROUND(AVG(mood)::NUMERIC, 1)   AS avg_mood,
      COUNT(*)                        AS total_checkins
    FROM recent
  )
  SELECT jsonb_build_object(
    'avg_sleep',      a.avg_sleep,
    'avg_stress',     a.avg_stress,
    'avg_energy',     a.avg_energy,
    'avg_mood',       a.avg_mood,
    'total_checkins', a.total_checkins,
    'streak_current', p.streak_current,
    'streak_best',    p.streak_best,
    'history',        (
      SELECT jsonb_agg(jsonb_build_object(
        'date', r.checked_at,
        'sleep', r.sleep, 'stress', r.stress,
        'energy', r.energy, 'mood', r.mood
      ) ORDER BY r.checked_at)
      FROM recent r
    )
  ) INTO v_stats
  FROM agg a, public.profiles p
  WHERE p.id = auth.uid();

  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_progress_stats TO authenticated;

-- Convenience view: today's plan with completion status
CREATE OR REPLACE VIEW my_today_plan AS
SELECT
  dp.id AS plan_id,
  dp.plan_date,
  dp.actions,
  dp.generated,
  (
    SELECT jsonb_agg(dpc.action_id)
    FROM public.daily_plan_completions dpc
    WHERE dpc.plan_id = dp.id
  ) AS completed_action_ids
FROM public.daily_plans dp
WHERE dp.user_id = auth.uid()
  AND dp.plan_date = current_date;

GRANT SELECT ON my_today_plan TO authenticated;
