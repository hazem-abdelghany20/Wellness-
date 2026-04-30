import { useState, useEffect, useCallback } from 'react';
import { getCompanySettings, updateCompanySettings } from '../../lib/supabase-hr';

export function useSettings() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCompany(await getCompanySettings()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const update = useCallback(async (patch) => {
    const updated = await updateCompanySettings(patch);
    setCompany(updated);
    return updated;
  }, []);

  return { company, loading, error, update, refetch };
}
