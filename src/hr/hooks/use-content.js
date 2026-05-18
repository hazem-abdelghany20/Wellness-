import { useState, useEffect, useCallback } from 'react';
import { getContentLibrary, assignContent, updateContentItem } from '../../lib/supabase-hr';

export function useContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await getContentLibrary()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const assign = useCallback((contentId, scope, teamId) =>
    assignContent(contentId, scope, teamId), []);

  const update = useCallback(async (contentId, patch) => {
    const updated = await updateContentItem(contentId, patch);
    setItems(prev => prev.map(item => item.id === contentId ? updated : item));
    return updated;
  }, []);

  return { items, loading, error, assign, update, refetch };
}
