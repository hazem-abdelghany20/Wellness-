import { useState, useEffect, useCallback } from 'react';
import { getMyRoutineWeek } from '../../lib/supabase-routines';

// My Sun–Thu routine week, loaded when the week view opens.
export function useRoutineWeek(enabled = true) {
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setWeek(await getMyRoutineWeek()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (enabled) refetch(); }, [enabled, refetch]);

  return { week, loading, error, refetch };
}
