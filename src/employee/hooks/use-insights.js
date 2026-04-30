import { useState, useEffect, useCallback } from 'react';
import { getInsights } from '../../lib/supabase';

export function useInsights() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setInsights(await getInsights()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { insights, loading, error, refetch };
}
