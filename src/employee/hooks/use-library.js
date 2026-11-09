import { useState, useEffect, useCallback } from 'react';
import { listLibrary } from '../../lib/supabase-routines';
import { getContentItems } from '../../lib/supabase';

// Every library row I can see (my company's + Wellness House's), pinned first.
// If the sprint 2 library call isn't there yet, falls back to the plain list
// (all Wellness House) so the Library never goes blank.
export function useLibrary() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRows(await listLibrary('content', 'all'));
    } catch (e) {
      try {
        const legacy = await getContentItems();
        setRows((legacy || []).map((r) => ({ ...r, scope: r.company_id ? 'company' : 'public', pinned: false, hidden: false })));
      } catch (e2) { setError(e2); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { rows, loading, error, refetch };
}
