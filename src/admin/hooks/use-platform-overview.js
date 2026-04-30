import { useState, useEffect, useCallback } from 'react';
import { getPlatformOverview } from '../../lib/supabase-admin';

export function usePlatformOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getPlatformOverview()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}
