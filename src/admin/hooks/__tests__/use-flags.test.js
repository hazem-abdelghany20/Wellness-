import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listFlags: vi.fn(),
  setFlag: vi.fn(),
}));

import { listFlags, setFlag } from '../../../lib/supabase-admin';
import { useFlags } from '../use-flags';

beforeEach(() => {
  vi.clearAllMocks();
  listFlags.mockResolvedValue([{ id: 'f1', key: 'new_home', enabled: true }]);
});

describe('useFlags', () => {
  it('lists flags', async () => {
    const { result } = renderHook(() => useFlags());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.flags).toHaveLength(1);
  });

  it('toggles a flag', async () => {
    setFlag.mockResolvedValue({ id: 'f1', enabled: false });
    const { result } = renderHook(() => useFlags());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.set({ key: 'new_home', scope: 'global', enabled: false }); });
    expect(setFlag).toHaveBeenCalled();
  });
});
