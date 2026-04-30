import { useState, useEffect, useCallback } from 'react';
import { getContentItems, getFeaturedContent, saveContentProgress } from '../../lib/supabase';

export function useContent(category) {
  const [items, setItems] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [list, feat] = await Promise.all([
        getContentItems(category),
        getFeaturedContent(),
      ]);
      setItems(list); setFeatured(feat);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => { refetch(); }, [refetch]);

  const saveProgress = useCallback((id, progressS, completed = false) =>
    saveContentProgress(id, progressS, completed), []);

  return { items, featured, loading, error, saveProgress, refetch };
}
