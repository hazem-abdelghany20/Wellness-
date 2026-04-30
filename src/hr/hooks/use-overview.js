import { useState, useEffect, useCallback } from 'react';
import { getCompanyOverview } from '../../lib/supabase-hr';

export function useOverview(range = '30d') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getCompanyOverview(range)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}
