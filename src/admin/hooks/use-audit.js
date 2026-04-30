import { useState, useEffect, useCallback } from 'react';
import { listAudit } from '../../lib/supabase-admin';

export function useAudit(limit = 100) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setEntries(await listAudit(limit)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => { refetch(); }, [refetch]);
  return { entries, loading, error, refetch };
}
