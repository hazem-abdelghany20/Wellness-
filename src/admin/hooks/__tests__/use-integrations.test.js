import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listIntegrations: vi.fn(),
  setIntegration: vi.fn(),
}));

import { listIntegrations, setIntegration } from '../../../lib/supabase-admin';
import { useIntegrations } from '../use-integrations';

beforeEach(() => {
  vi.clearAllMocks();
  listIntegrations.mockResolvedValue([{ id: 'i1', kind: 'slack', status: 'pending' }]);
});

describe('useIntegrations', () => {
  it('lists integrations', async () => {
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.integrations).toHaveLength(1);
  });

  it('updates an integration', async () => {
    setIntegration.mockResolvedValue({ id: 'i1', status: 'configured' });
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.set('co1', 'slack', 'configured', { token: 'x' }); });
    expect(setIntegration).toHaveBeenCalledWith('co1', 'slack', 'configured', { token: 'x' });
  });
});
