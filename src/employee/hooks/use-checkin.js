import { useState, useEffect, useCallback } from 'react';
import { submitCheckin, getCheckinHistory } from '../../lib/supabase';

export function useCheckin(days = 30) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    await refetch();
    return row;
  }, [refetch]);

  return { history, loading, error, submit, refetch };
}
