import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listGiftPools, listCompanyAwardedRewards, listGiftCatalog,
} from '../../lib/supabase-hr';

export function useGiftsOverview() {
  const [pools, setPools] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, r, c] = await Promise.all([
        listGiftPools(),
        listCompanyAwardedRewards(50),
        listGiftCatalog(),
      ]);
      setPools(p); setRewards(r); setCatalog(c);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const stats = useMemo(() => {
    const totalBudget   = pools.reduce((sum, p) => sum + (p.budget_minor || 0), 0);
    const totalSpent    = pools.reduce((sum, p) => sum + (p.spent_minor || 0), 0);
    const remaining     = Math.max(0, totalBudget - totalSpent);
    const counts = { ready: 0, claimed: 0, fulfilled: 0 };
    for (const r of rewards) {
      if (counts[r.status] !== undefined) counts[r.status] += 1;
    }
    return {
      totalBudget,
      totalSpent,
      remaining,
      currency: pools[0]?.currency || 'EGP',
      activePools: pools.filter(p => p.active).length,
      awarded: rewards.length,
      pendingFulfillment: counts.claimed,
      readyToClaim: counts.ready,
      fulfilled: counts.fulfilled,
    };
  }, [pools, rewards]);

  return { pools, rewards, catalog, stats, loading, error, refetch };
}
