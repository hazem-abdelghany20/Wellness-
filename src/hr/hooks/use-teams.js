import { useState, useEffect, useCallback } from 'react';
import { listTeams } from '../../lib/supabase-teams';

// Teams with member counts and leads, plus how many people have no team.
export function useTeams() {
  const [data, setData] = useState({ teams: [], no_team: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const out = await listTeams();
      setData({ teams: out?.teams || [], no_team: out?.no_team || 0 });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { teams: data.teams, noTeam: data.no_team, loading, error, refetch };
}
