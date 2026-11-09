import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getMyToday, checkRoutineItem, setItemMuted } from '../../lib/supabase-routines';
import { applyPending } from '../lib/routine-today.js';

// Today's routine for the signed-in employee. Lives in App so the tab bar
// knows whether to show the Today tab, and the list survives tab switches.
//
// Ticks are optimistic: the row flips at once, the server answer replaces
// it, and a failed tick rolls back to the last server state (with any other
// ticks still in flight re-applied on top).
export function useRoutineToday(enabled = true) {
  const [confirmed, setConfirmed] = useState(null);
  const [pending, setPending] = useState(() => new Map());
  const [loading, setLoading] = useState(!!enabled);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const pendingRef = useRef(new Map());
  const seqRef = useRef(0);
  const acceptedRef = useRef(0);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    const seq = ++seqRef.current;
    try {
      const next = await getMyToday();
      if (!aliveRef.current) return;
      if (seq > acceptedRef.current) { acceptedRef.current = seq; setConfirmed(next); }
    } catch (e) {
      if (aliveRef.current) setError(e);
    } finally {
      if (aliveRef.current) { setLoading(false); setReady(true); }
    }
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refetch();
  }, [enabled, refetch]);

  // Day flips and HR edits: refresh quietly when the app comes back to the front.
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;
    const onVis = () => { if (document.visibilityState === 'visible') refetch({ silent: true }); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enabled, refetch]);

  const syncPending = () => setPending(new Map(pendingRef.current));

  const toggle = useCallback(async (itemId, checked) => {
    if (!itemId) return false;
    const seq = ++seqRef.current;
    pendingRef.current.set(itemId, { checked: !!checked, seq });
    syncPending();
    setSaveError(null);
    try {
      const next = await checkRoutineItem(itemId, !!checked);
      if (!aliveRef.current) return true;
      if (pendingRef.current.get(itemId)?.seq === seq) pendingRef.current.delete(itemId);
      if (seq > acceptedRef.current) { acceptedRef.current = seq; setConfirmed(next); }
      syncPending();
      return true;
    } catch (e) {
      if (!aliveRef.current) return false;
      if (pendingRef.current.get(itemId)?.seq === seq) pendingRef.current.delete(itemId);
      syncPending();
      setSaveError({ itemId, error: e });
      // The list changed under us (HR edit, new day): reload it.
      if (/item_not_due_today/i.test(String(e?.message || ''))) refetch({ silent: true });
      return false;
    }
  }, [refetch]);

  // Mute / unmute one item's reminder. Optimistic too.
  const mute = useCallback(async (itemId, muted) => {
    const flip = (s, value) => (s ? {
      ...s,
      items: s.items.map((i) => (i.id === itemId ? { ...i, muted: value } : i)),
      reminders: {
        ...(s.reminders || {}),
        muted_item_ids: value
          ? [...new Set([...(s.reminders?.muted_item_ids || []), itemId])]
          : (s.reminders?.muted_item_ids || []).filter((x) => x !== itemId),
      },
    } : s);
    setConfirmed((s) => flip(s, !!muted));
    try {
      await setItemMuted(itemId, !!muted);
      return true;
    } catch (e) {
      if (aliveRef.current) { setConfirmed((s) => flip(s, !muted)); setSaveError({ itemId, error: e }); }
      return false;
    }
  }, []);

  const state = useMemo(() => applyPending(confirmed, pending), [confirmed, pending]);

  return {
    state,
    assigned: !!state?.assigned,
    loading,
    ready: !enabled || ready,
    error,
    saveError,
    clearSaveError: () => setSaveError(null),
    pendingIds: pending,
    toggle,
    mute,
    refetch,
  };
}
