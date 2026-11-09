import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  getTenant: vi.fn(),
  inviteCompanyAdmin: vi.fn(),
}));

import { getTenant, inviteCompanyAdmin } from '../../../lib/supabase-admin';
import { useTenant } from '../use-tenant';

beforeEach(() => {
  vi.clearAllMocks();
  getTenant.mockResolvedValue({ id: 't1', name: 'Acme', billing_state: { plan: 'starter' } });
});

describe('useTenant', () => {
  it('loads tenant when id provided', async () => {
    const { result } = renderHook(() => useTenant('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tenant.name).toBe('Acme');
  });

  it('invite returns the HR sign-up invite (no email is sent)', async () => {
    inviteCompanyAdmin.mockResolvedValue({ status: 'invited', email: 'boss@acme.com', token: 'tok', role: 'hr_admin', company_id: 't1' });
    const { result } = renderHook(() => useTenant('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const res = await result.current.invite('boss@acme.com', 'Bassem');
    expect(inviteCompanyAdmin).toHaveBeenCalledWith('t1', 'boss@acme.com', 'Bassem');
    expect(res.token).toBe('tok');
  });

  it('skips fetch when id is null', async () => {
    const { result } = renderHook(() => useTenant(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getTenant).not.toHaveBeenCalled();
  });
});
