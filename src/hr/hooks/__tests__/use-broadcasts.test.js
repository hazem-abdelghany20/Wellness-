import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listBroadcasts: vi.fn(),
  scheduleBroadcast: vi.fn(),
  cancelBroadcast: vi.fn(),
}));

import {
  listBroadcasts, scheduleBroadcast, cancelBroadcast,
} from '../../../lib/supabase-hr';
import { useBroadcasts } from '../use-broadcasts';

beforeEach(() => {
  vi.clearAllMocks();
  listBroadcasts.mockResolvedValue([{ id: 'b1', status: 'scheduled' }]);
});

describe('useBroadcasts', () => {
  it('lists broadcasts on mount', async () => {
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.list).toHaveLength(1);
  });

  it('schedules a new broadcast', async () => {
    scheduleBroadcast.mockResolvedValue({ id: 'b2' });
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.schedule({ title_en: 'Hi', body_en: 'Hello', scope: 'all', scheduled_at: '2026-05-01T09:00:00Z' });
    });
    expect(scheduleBroadcast).toHaveBeenCalled();
  });

  it('cancels a broadcast', async () => {
    cancelBroadcast.mockResolvedValue();
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.cancel('b1'); });
    expect(cancelBroadcast).toHaveBeenCalledWith('b1');
  });
});
