import { useState, useEffect, useCallback } from 'react';
import { getTodayPlan, completeAction, getPlanCompletions } from '../../lib/supabase';

export function useDailyPlan() {
  const [plan, setPlan] = useState(null);
  const [completedIds, setCompletedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = await getTodayPlan();
      setPlan(p);
      // generate-daily-plan returns the raw row (id, not plan_id) and no
      // completions, so ticks were lost on reload. Read them back.
      const planId = p?.id ?? p?.plan_id;
      const done = planId ? await getPlanCompletions(planId).catch(() => []) : [];
      setCompletedIds([...new Set([...(p?.completed_action_ids ?? []), ...done])]);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const complete = useCallback(async (actionId) => {
    if (!plan) return;
    // Optimistic: tick immediately, then persist.
    setCompletedIds(prev => prev.includes(actionId) ? prev : [...prev, actionId]);
    await completeAction(plan.id ?? plan.plan_id, actionId);
  }, [plan]);

  return { plan, completedIds, loading, error, complete, refetch };
}
