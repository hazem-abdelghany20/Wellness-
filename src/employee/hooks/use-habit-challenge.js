import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyHabitChallenges, logHabit } from '../../lib/supabase';

const idOf = (st) => st?.challenge?.id || null;

// Every challenge running or coming up for me (sprint 4: HR can run several
// at once), running ones first. `list` is null until the first answer.
//   toggle(id)  today's "Did it" for one challenge; a second tap undoes it.
//   saving      the id being saved, or null.
//   error       { id, error } for a failed save, { id: null, error } for a failed load.
export function useHabitChallenges() {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  const listRef = useRef(null);
  listRef.current = list;
  useEffect(() => () => { alive.current = false; }, []);

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const next = await getMyHabitChallenges();
      if (alive.current) setList(Array.isArray(next) ? next.filter((st) => st && st.status !== 'none' && idOf(st)) : []);
      return true;
    } catch (e) {
      if (alive.current && !silent) setError({ id: null, error: e });
      return false;
    } finally {
      if (alive.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // The server answers with that challenge's fresh state, so its dots and
  // team bar update from one round trip; then the whole list is read again
  // (a quiet re-read: if it fails, the saved tap still shows). A challenge
  // that counts by itself from the routine has no button: nothing to log.
  const toggle = useCallback(async (id) => {
    const st = (listRef.current || []).find((x) => idOf(x) === id);
    if (!st || !st.can_log || st.auto_from_routine) return;
    setSaving(id); setError(null);
    try {
      const next = await logHabit(id, !st.logged_target);
      if (!alive.current) return;
      if (next && idOf(next) === id) setList((cur) => (cur || []).map((x) => (idOf(x) === id ? next : x)));
      await refetch({ silent: true });
    } catch (e) {
      if (alive.current) setError({ id, error: e });
    } finally {
      if (alive.current) setSaving(null);
    }
  }, [refetch]);

  return { list, loading, saving, error, toggle, refetch };
}
