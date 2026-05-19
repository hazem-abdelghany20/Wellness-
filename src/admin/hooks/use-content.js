import { useState, useEffect, useCallback } from 'react';
import { listGlobalContent, updateContent, createContentItem, uploadContentAsset } from '../../lib/supabase-admin';

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

  // Create a new content item, optionally uploading a file first.
  // `payload` matches createContentItem's shape; pass `file` to upload to
  // the content-assets bucket and use the resulting public URL.
  const create = useCallback(async ({ file, ...payload }) => {
    let asset_url = payload.asset_url;
    if (file) {
      const { publicUrl } = await uploadContentAsset(file);
      asset_url = publicUrl;
    }
    const row = await createContentItem({ ...payload, asset_url });
    await refetch();
    return row;
  }, [refetch]);

  return { items, loading, error, update, create, refetch };
}
