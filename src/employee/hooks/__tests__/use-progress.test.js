import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ getProgressStats: vi.fn() }));

import { getProgressStats } from '../../../lib/supabase';
import { useProgress } from '../use-progress';

beforeEach(() => {
  vi.clearAllMocks();
  getProgressStats.mockResolvedValue({
    avg_sleep: 6.8, avg_stress: 4.2, avg_energy: 6.5, avg_mood: 7.1,
    total_checkins: 18, streak_current: 3, streak_best: 12,
    history: [],
  });
});

describe('useProgress', () => {
  it('loads progress stats on mount', async () => {
    const { result } = renderHook(() => useProgress());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.streak_current).toBe(3);
  });
});
