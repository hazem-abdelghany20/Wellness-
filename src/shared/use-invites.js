import { useState, useEffect, useCallback } from 'react';
import { listPeopleInvites } from '../lib/supabase-invites';

// Invites for one company (HR People page, admin tenant detail).
// `unavailable` = the database doesn't have list_people_invites yet.
export function useInvites(companyId) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(!!companyId);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  const refetch = useCallback(async () => {
    if (!companyId) { setInvites([]); setLoading(false); return []; }
    setLoading(true); setError(null);
    try {
      const rows = await listPeopleInvites(companyId);
      setInvites(rows); setUnavailable(false);
      return rows;
    } catch (e) {
      const missing = e?.code === 'PGRST202' || e?.code === '42883' || /could not find the function/i.test(e?.message || '');
      setUnavailable(missing);
      if (!missing) setError(e);
      setInvites([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { invites, loading, error, unavailable, refetch };
}
