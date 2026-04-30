import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTeamAggregates } from '../../lib/supabase-hr';

export function useSafety() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTeams(await getTeamAggregates()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const highRisk = useMemo(
    () => teams.filter(t => t.has_signal && t.avg_stress != null && t.avg_stress >= 7),
    [teams]
  );

  return { teams, highRisk, loading, error, refetch };
}
