import { useState, useEffect, useCallback, useRef } from 'react';
import { getPushState, enableRoutineReminders, disableRoutineReminders } from '../../lib/push';
import { reminderView } from '../lib/push-ui.js';

// The "Remind me" switch for this browser (Me → Privacy, and the one-time
// card on Today). Reads where the browser stands without prompting; the
// permission prompt only comes from enable(), i.e. from a tap.
//
// remindersOn = my routine_reminders pref (prefs or Today's reminders.enabled).
// enable() / disable() resolve to the new MyPrefs, or null when it failed
// (error then holds the thrown error).
export function usePushReminders({ lang = 'en', remindersOn = false } = {}) {
  const [push, setPush] = useState(null);
  const [on, setOn] = useState(!!remindersOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { setOn(!!remindersOn); }, [remindersOn]);

  const refresh = useCallback(async () => {
    try {
      const next = await getPushState();
      if (alive.current) setPush(next);
      return next;
    } catch {
      const none = { state: 'unsupported', permission: 'unsupported', endpoint: null, support: { supported: false, reason: null } };
      if (alive.current) setPush(none);
      return none;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Back from the phone's settings (allowed / blocked there): look again.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  const run = useCallback(async (fn, wantOn) => {
    setBusy(true); setError(null);
    try {
      const prefs = await fn();
      if (!alive.current) return prefs;
      setOn(prefs ? !!prefs.routine_reminders : wantOn);
      await refresh();
      return prefs;
    } catch (e) {
      if (alive.current) { setError(e); await refresh(); }
      return null;
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [refresh]);

  const enable = useCallback(() => run(() => enableRoutineReminders({ lang: lang === 'ar' ? 'ar' : 'en' }), true), [run, lang]);
  const disable = useCallback(() => run(() => disableRoutineReminders(), false), [run]);

  return {
    push,
    view: reminderView(push, on),
    on,
    busy,
    error,
    clearError: () => setError(null),
    enable,
    disable,
    refresh,
  };
}
