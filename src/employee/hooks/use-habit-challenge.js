import { useState, useEffect, useCallback } from 'react';
import { getMyHabitChallenge, logHabit } from '../../lib/supabase';

export function useHabitChallenge() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setState(await getMyHabitChallenge()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // Toggle today's "Did it". The server returns the fresh state, so the
  // dots and team bar update from one round trip.
  const toggle = useCallback(async () => {
    if (!state?.challenge?.id || !state.can_log) return;
    setSaving(true); setError(null);
    try { setState(await logHabit(state.challenge.id, !state.logged_target)); }
    catch (e) { setError(e); }
    finally { setSaving(false); }
  }, [state]);

  return { state, loading, saving, error, toggle, refetch };
}
