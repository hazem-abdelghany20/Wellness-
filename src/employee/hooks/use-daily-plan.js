import { useState, useEffect, useCallback } from 'react';
import { getTodayPlan, completeAction } from '../../lib/supabase';

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
      setCompletedIds(p?.completed_action_ids ?? []);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const complete = useCallback(async (actionId) => {
    if (!plan) return;
    await completeAction(plan.plan_id, actionId);
    setCompletedIds(prev => prev.includes(actionId) ? prev : [...prev, actionId]);
  }, [plan]);

  return { plan, completedIds, loading, error, complete, refetch };
}
