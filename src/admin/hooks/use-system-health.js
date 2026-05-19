import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// Live system-health signal for the topbar pill. Buckets the last 24h of
// audit-log entries by severity. Refreshes every 60s so the pill reflects
// recent issues without hammering the API.
export function useSystemHealth(intervalMs = 60_000) {
  const [counts, setCounts] = useState({ info: 0, warn: 0, error: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error: e } = await supabase
        .from('audit_log')
        .select('severity')
        .gte('occurred_at', since)
        .limit(2000);
      if (e) throw e;
      const next = { info: 0, warn: 0, error: 0, total: 0 };
      for (const row of (data ?? [])) {
        // Collapse the legacy 'err' value into 'error'.
        const sev = (row.severity === 'err') ? 'error' : row.severity;
        if (sev === 'warn') next.warn += 1;
        else if (sev === 'error') next.error += 1;
        else next.info += 1;
        next.total += 1;
      }
      setCounts(next);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refetch();
    const t = window.setInterval(() => { if (!cancelled) void refetch(); }, intervalMs);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [refetch, intervalMs]);

  // Derive a single status: error > warn > ok.
  const status = counts.error > 0 ? 'error' : counts.warn > 0 ? 'warn' : 'ok';

  return { counts, status, loading, error, refetch };
}
