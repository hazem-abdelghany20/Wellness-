import { useState, useEffect, useCallback } from 'react';
import { listChallengeTemplates, createChallengeTemplate } from '../../lib/supabase-admin';

export function useChallengeTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTemplates(await listChallengeTemplates()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const create = useCallback(async (payload) => {
    const t = await createChallengeTemplate(payload);
    await refetch();
    return t;
  }, [refetch]);

  return { templates, loading, error, create, refetch };
}
