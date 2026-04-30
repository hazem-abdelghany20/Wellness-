import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listInvoices: vi.fn(),
  setBilling: vi.fn(),
}));

import { listInvoices, setBilling } from '../../../lib/supabase-admin';
import { useBilling } from '../use-billing';

beforeEach(() => {
  vi.clearAllMocks();
  listInvoices.mockResolvedValue([{ id: 'i1', amount_cents: 50000 }]);
});

describe('useBilling', () => {
  it('lists invoices for tenant', async () => {
    const { result } = renderHook(() => useBilling('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invoices).toHaveLength(1);
  });

  it('updates billing state', async () => {
    setBilling.mockResolvedValue({ company_id: 't1', mrr_cents: 100000 });
    const { result } = renderHook(() => useBilling('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update({ mrr_cents: 100000 }); });
    expect(setBilling).toHaveBeenCalledWith('t1', { mrr_cents: 100000 });
  });
});
