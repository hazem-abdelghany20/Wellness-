import { useState, useEffect, useCallback } from 'react';
import { getTeamAggregates, getTeamDrilldown } from '../../lib/supabase-hr';

export function useTeams() {
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

  const drilldown = useCallback((teamId, range = '30d') =>
    getTeamDrilldown(teamId, range), []);

  return { teams, loading, error, drilldown, refetch };
}
