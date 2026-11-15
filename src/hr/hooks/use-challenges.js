import { useState, useEffect, useCallback } from 'react';
import {
  listHabitTemplates, listHabitChallenges, scheduleChallenge,
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

  // input: { templateId } or { title_en, title_ar?, routineItemIds }, plus
  // { startDate, endDate, successDays, teamId }. Several can run at once.
  const schedule = useCallback(async (input) => {
    const created = await scheduleChallenge(input);
    await refetch();
    return created;
  }, [refetch]);

  // Cancels an upcoming challenge, or ends one that is running.
  const cancel = useCallback(async (challengeId) => {
    await cancelHabitChallenge(challengeId);
    await refetch();
  }, [refetch]);

  return { templates, scheduled, teams, loading, error, schedule, cancel, refetch };
}
