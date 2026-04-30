import { useState, useCallback } from 'react';
import { requestReportExport } from '../../lib/supabase-hr';

export function useReports() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastUrl, setLastUrl] = useState(null);

  const exportReport = useCallback(async (kind, range) => {
    setBusy(true); setError(null);
    try {
      const r = await requestReportExport(kind, range);
      setLastUrl(r.url);
      return r;
    } catch (e) {
      setError(e); throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  return { exportReport, busy, error, lastUrl };
}
