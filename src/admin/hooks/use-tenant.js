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

  const invite = useCallback(async (email) => {
    if (!companyId) throw new Error('no_company');
    await inviteCompanyAdmin(companyId, email);
  }, [companyId]);

  return { tenant, loading, error, invite, refetch };
}
