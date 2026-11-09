import { useState, useEffect, useCallback } from 'react';
import { getTenant, inviteCompanyAdmin } from '../../lib/supabase-admin';

export function useTenant(companyId) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!companyId) { setTenant(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setTenant(await getTenant(companyId)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { refetch(); }, [refetch]);

  const invite = useCallback(async (email, name) => {
    if (!companyId) throw new Error('no_company');
    return inviteCompanyAdmin(companyId, email, name);
  }, [companyId]);

  return { tenant, loading, error, invite, refetch };
}
