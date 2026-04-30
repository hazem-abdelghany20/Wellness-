import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listTenants: vi.fn(),
  createTenant: vi.fn(),
}));

import { listTenants, createTenant } from '../../../lib/supabase-admin';
import { useTenants } from '../use-tenants';

beforeEach(() => {
  vi.clearAllMocks();
  listTenants.mockResolvedValue([{ id: 't1', name: 'Acme' }]);
});

describe('useTenants', () => {
  it('lists tenants on mount', async () => {
    const { result } = renderHook(() => useTenants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tenants).toHaveLength(1);
  });

  it('creates a tenant', async () => {
    createTenant.mockResolvedValue({ id: 't2', name: 'Beta' });
    const { result } = renderHook(() => useTenants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ name: 'Beta' }); });
    expect(createTenant).toHaveBeenCalledWith({ name: 'Beta' });
  });
});
