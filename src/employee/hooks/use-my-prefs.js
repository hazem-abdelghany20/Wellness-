import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyPrefs, setMyPrefs } from '../../lib/supabase-routines';

// My privacy switches (board opt-in, share with HR) and reminder prefs.
// set(key, value) flips the switch at once and rolls it back if saving fails.
export function useMyPrefs(enabled = true) {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null);       // key being saved
  const [saveError, setSaveError] = useState(null); // { key, error }
  const alive = useRef(true);
  const prefsRef = useRef(null);
  prefsRef.current = prefs;
  useEffect(() => () => { alive.current = false; }, []);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { const p = await getMyPrefs(); if (alive.current) setPrefs(p); }
    catch (e) { if (alive.current) setError(e); }
    finally { if (alive.current) setLoading(false); }
  }, []);

  useEffect(() => { if (enabled) refetch(); else setLoading(false); }, [enabled, refetch]);

  const set = useCallback(async (key, value) => {
    const before = prefsRef.current;
    if (before) setPrefs({ ...before, [key]: value });
    setSaving(key); setSaveError(null);
    try {
      const next = await setMyPrefs({ [key]: value });
      if (alive.current && next) setPrefs(next);
      return true;
    } catch (e) {
      if (alive.current) { setPrefs(before); setSaveError({ key, error: e }); }
      return false;
    } finally {
      if (alive.current) setSaving(null);
    }
  }, []);

  // Take prefs another call already saved (e.g. enableRoutineReminders).
  const replace = useCallback((next) => { if (next && alive.current) setPrefs(next); }, []);

  return { prefs, loading, error, saving, saveError, set, replace, refetch };
}
