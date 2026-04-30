import { useState, useEffect, useCallback } from 'react';
import { listInvoices, setBilling } from '../../lib/supabase-admin';

export function useBilling(companyId) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!companyId) { setInvoices([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setInvoices(await listInvoices(companyId)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { refetch(); }, [refetch]);

  const update = useCallback(async (patch) => {
    if (!companyId) throw new Error('no_company');
    return setBilling(companyId, patch);
  }, [companyId]);

  return { invoices, loading, error, update, refetch };
}
