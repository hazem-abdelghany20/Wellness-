import { useState, useEffect, useCallback } from 'react';
import { submitCheckin, getCheckinHistory } from '../../lib/supabase';
import { useAuth } from '../state/auth-context.jsx';

export function useCheckin(days = 30) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { refreshProfile } = useAuth();

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const rows = await getCheckinHistory(days);
      setHistory(rows);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { refetch(); }, [refetch]);

  const submit = useCallback(async (payload) => {
    const row = await submitCheckin(payload);
    // The DB trigger update_streak() bumps profiles.streak_current /
    // streak_best on each insert. Refresh profile so the home screen
    // and Progress stats reflect the new streak without a page reload.
    await Promise.all([refetch(), refreshProfile()]);
    return row;
  }, [refetch, refreshProfile]);

  return { history, loading, error, submit, refetch };
}
