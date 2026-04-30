import { useState, useEffect, useCallback } from 'react';
import { listStrings, setString } from '../../lib/supabase-admin';

export function useLocalization() {
  const [strings, setStrings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setStrings(await listStrings()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const save = useCallback(async (key, lang, value) => {
    const u = await setString(key, lang, value);
    await refetch();
    return u;
  }, [refetch]);

  return { strings, loading, error, save, refetch };
}
