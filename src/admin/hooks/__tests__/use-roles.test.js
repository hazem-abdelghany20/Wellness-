import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listAdmins: vi.fn(),
  setRole: vi.fn(),
}));

import { listAdmins, setRole } from '../../../lib/supabase-admin';
import { useRoles } from '../use-roles';

beforeEach(() => {
  vi.clearAllMocks();
  listAdmins.mockResolvedValue([{ id: 'u1', display_name: 'Alex', role: 'hr_admin' }]);
});

describe('useRoles', () => {
  it('lists admins', async () => {
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.admins).toHaveLength(1);
  });

  it('promotes a user', async () => {
    setRole.mockResolvedValue();
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.promote('u1', 'hr_admin', 'co1'); });
    expect(setRole).toHaveBeenCalledWith('u1', 'hr_admin', 'co1');
  });
});
