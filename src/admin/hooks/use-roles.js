import { useState, useEffect, useCallback } from 'react';
import { listAdmins, setRole } from '../../lib/supabase-admin';

export function useRoles() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setAdmins(await listAdmins()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const promote = useCallback(async (userId, role, companyId) => {
    await setRole(userId, role, companyId);
    await refetch();
  }, [refetch]);

  return { admins, loading, error, promote, refetch };
}
