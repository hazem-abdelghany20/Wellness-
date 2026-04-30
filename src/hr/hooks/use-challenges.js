import { useState, useEffect, useCallback } from 'react';
import {
  listChallengeTemplates, scheduleChallenge, getChallengeStatus,
} from '../../lib/supabase-hr';

export function useChallenges() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTemplates(await listChallengeTemplates()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const schedule = useCallback(async (template, window, scope, teamId) => {
    const created = await scheduleChallenge(template, window, scope, teamId);
    await refetch();
    return created;
  }, [refetch]);

  const status = useCallback((id) => getChallengeStatus(id), []);

  return { templates, loading, error, schedule, status, refetch };
}
