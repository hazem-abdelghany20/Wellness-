import { useState, useEffect, useCallback } from 'react';
import { listIntegrations, setIntegration } from '../../lib/supabase-admin';

export function useIntegrations() {
  const [integrations, setIntegrationsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setIntegrationsState(await listIntegrations()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const set = useCallback(async (companyId, kind, status, config) => {
    const u = await setIntegration(companyId, kind, status, config);
    await refetch();
    return u;
  }, [refetch]);

  return { integrations, loading, error, set, refetch };
}
