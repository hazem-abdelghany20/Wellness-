import { useState, useEffect, useCallback } from 'react';
import { listBroadcasts, scheduleBroadcast, cancelBroadcast } from '../../lib/supabase-hr';

export function useBroadcasts() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setList(await listBroadcasts()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const schedule = useCallback(async (payload) => {
    const created = await scheduleBroadcast(payload);
    await refetch();
    return created;
  }, [refetch]);

  const cancel = useCallback(async (id) => {
    await cancelBroadcast(id);
    await refetch();
  }, [refetch]);

  return { list, loading, error, schedule, cancel, refetch };
}
