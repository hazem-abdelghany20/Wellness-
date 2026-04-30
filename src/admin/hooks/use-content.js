import { useState, useEffect, useCallback } from 'react';
import { listGlobalContent, updateContent } from '../../lib/supabase-admin';

export function useContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listGlobalContent()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const update = useCallback(async (id, patch) => {
    const u = await updateContent(id, patch);
    await refetch();
    return u;
  }, [refetch]);

  return { items, loading, error, update, refetch };
}
