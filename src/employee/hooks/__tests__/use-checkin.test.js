import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  submitCheckin: vi.fn(),
  getCheckinHistory: vi.fn(),
}));

import { submitCheckin, getCheckinHistory } from '../../../lib/supabase';
import { useCheckin } from '../use-checkin';

beforeEach(() => {
  vi.clearAllMocks();
  getCheckinHistory.mockResolvedValue([
    { checked_at: '2026-04-29', sleep: 7, stress: 4, energy: 6, mood: 7 },
  ]);
});

describe('useCheckin', () => {
  it('loads history on mount', async () => {
    const { result } = renderHook(() => useCheckin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toHaveLength(1);
    expect(getCheckinHistory).toHaveBeenCalledWith(30);
  });

  it('submits a check-in and re-fetches history', async () => {
    submitCheckin.mockResolvedValue({ id: 'x' });
    const { result } = renderHook(() => useCheckin());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.submit({ sleep: 7, stress: 3, energy: 6, mood: 8 });
    });

    expect(submitCheckin).toHaveBeenCalledWith({ sleep: 7, stress: 3, energy: 6, mood: 8 });
    expect(getCheckinHistory).toHaveBeenCalledTimes(2);
  });
});
