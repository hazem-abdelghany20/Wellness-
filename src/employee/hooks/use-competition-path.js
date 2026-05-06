import { useState, useEffect, useCallback, useMemo } from 'react';
import { getCompetitionPath, completePracticeDay } from '../../lib/supabase';

export function useCompetitionPath(challengeId) {
  const [challenge, setChallenge] = useState(null);
  const [days, setDays] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!challengeId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const out = await getCompetitionPath(challengeId);
      setChallenge(out.challenge);
      setDays(out.days);
      setCompletions(out.completions);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { refetch(); }, [refetch]);

  const completedSet = useMemo(
    () => new Set(completions.map(c => c.day_number)),
    [completions]
  );

  // The "active" day is the lowest day_number not yet completed.
  const activeDay = useMemo(() => {
    for (const d of days) {
      if (!completedSet.has(d.day_number)) return d.day_number;
    }
    return days.length ? days[days.length - 1].day_number : null;
  }, [days, completedSet]);

  const progress = useMemo(() => {
    if (!days.length) return 0;
    return completions.length / days.length;
  }, [days, completions]);

  const complete = useCallback(async (dayNumber, reflection) => {
    const saved = await completePracticeDay(challengeId, dayNumber, reflection);
    setCompletions(prev => {
      const without = prev.filter(c => c.day_number !== dayNumber);
      return [...without, saved].sort((a, b) => a.day_number - b.day_number);
    });
    return saved;
  }, [challengeId]);

  return {
    challenge, days, completions,
    completedSet, activeDay, progress,
    loading, error, complete, refetch,
  };
}
