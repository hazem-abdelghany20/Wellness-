import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listGiftCatalog, upsertGiftCatalogItem,
} from '../../lib/supabase-hr';

export function useGiftCatalog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listGiftCatalog()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const byCategory = useMemo(() => {
    const buckets = { wh_service: [], amazon: [], custom: [] };
    for (const it of items) {
      if (buckets[it.category]) buckets[it.category].push(it);
    }
    return buckets;
  }, [items]);

  const upsert = useCallback(async (item) => {
    const saved = await upsertGiftCatalogItem(item);
    await refetch();
    return saved;
  }, [refetch]);

  const deactivate = useCallback(async (id) => {
    return upsert({ id, active: false });
  }, [upsert]);

  return { items, byCategory, loading, error, upsert, deactivate, refetch };
}
