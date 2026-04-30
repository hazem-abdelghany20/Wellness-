import { useState, useEffect, useCallback } from 'react';
import { listFlags, setFlag } from '../../lib/supabase-admin';

export function useFlags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setFlags(await listFlags()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const set = useCallback(async (payload) => {
    const u = await setFlag(payload);
    await refetch();
    return u;
  }, [refetch]);

  return { flags, loading, error, set, refetch };
}
