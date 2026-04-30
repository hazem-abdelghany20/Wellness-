import { useState, useEffect, useCallback } from 'react';
import { listTenants, createTenant } from '../../lib/supabase-admin';

export function useTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTenants(await listTenants()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const create = useCallback(async (payload) => {
    const created = await createTenant(payload);
    await refetch();
    return created;
  }, [refetch]);

  return { tenants, loading, error, create, refetch };
}
