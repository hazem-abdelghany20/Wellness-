import { useState, useEffect, useCallback, useMemo } from 'react';
import { listMyAwardedRewards, claimMyReward } from '../../lib/supabase';

const STATUS_ORDER = { ready: 0, claimed: 1, fulfilled: 2 };

export function useWallet() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRewards(await listMyAwardedRewards()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const grouped = useMemo(() => {
    const buckets = { ready: [], claimed: [], fulfilled: [] };
    for (const r of rewards) {
      if (buckets[r.status]) buckets[r.status].push(r);
    }
    return buckets;
  }, [rewards]);

  // Sort: ready first, then claimed, then fulfilled — within a bucket,
  // newest awarded first (the server already orders, but be defensive).
  const sorted = useMemo(() => {
    return [...rewards].sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 99;
      const sb = STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime();
    });
  }, [rewards]);

  const claim = useCallback(async (rewardId, chosenItemId) => {
    const updated = await claimMyReward(rewardId, chosenItemId);
    await refetch();
    return updated;
  }, [refetch]);

  return { rewards: sorted, grouped, loading, error, refetch, claim };
}
