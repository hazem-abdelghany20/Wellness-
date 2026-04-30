import { useState, useEffect, useCallback } from 'react';
import {
  getActiveChallenges, joinChallenge, getLeaderboard, subscribeToLeaderboard,
} from '../../lib/supabase';

export function useChallenges(activeChallengeId = null) {
  const [challenges, setChallenges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await getActiveChallenges();
      setChallenges(list);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!activeChallengeId) return;
    let cancelled = false;
    getLeaderboard(activeChallengeId).then(rows => { if (!cancelled) setLeaderboard(rows); });
    const sub = subscribeToLeaderboard(activeChallengeId, () => {
      getLeaderboard(activeChallengeId).then(rows => { if (!cancelled) setLeaderboard(rows); });
    });
    return () => { cancelled = true; sub?.unsubscribe?.(); };
  }, [activeChallengeId]);

  const join = useCallback(async (id) => {
    await joinChallenge(id);
    await refetch();
  }, [refetch]);

  return { challenges, leaderboard, loading, error, join, refetch };
}
