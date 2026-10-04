import { useState, useEffect, useCallback } from 'react';
import {
  listHabitTemplates, listHabitChallenges, scheduleHabitChallenge,
  cancelHabitChallenge, listCompanyTeams,
} from '../../lib/supabase-hr';

export function useChallenges() {
  const [templates, setTemplates] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [t, s, tm] = await Promise.all([
        listHabitTemplates(), listHabitChallenges(), listCompanyTeams().catch(() => []),
      ]);
      setTemplates(t); setScheduled(s); setTeams(tm);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const schedule = useCallback(async (templateId, weekStart, teamId) => {
    const created = await scheduleHabitChallenge(templateId, weekStart, teamId);
    await refetch();
    return created;
  }, [refetch]);

  const cancel = useCallback(async (challengeId) => {
    await cancelHabitChallenge(challengeId);
    await refetch();
  }, [refetch]);

  return { templates, scheduled, teams, loading, error, schedule, cancel, refetch };
}
