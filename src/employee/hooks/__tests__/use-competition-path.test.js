import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  getCompetitionPath: vi.fn(),
  completePracticeDay: vi.fn(),
}));

import { getCompetitionPath, completePracticeDay } from '../../../lib/supabase';
import { useCompetitionPath } from '../use-competition-path';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCompetitionPath', () => {
  it('loads challenge, days, and completions', async () => {
    getCompetitionPath.mockResolvedValue({
      challenge: { id: 'c1', theme: 'sabr', duration_days: 21 },
      days: [
        { id: 'd1', day_number: 1, title_en: 'Notice', body_en: '...' },
        { id: 'd2', day_number: 2, title_en: 'Observe', body_en: '...' },
      ],
      completions: [{ challenge_id: 'c1', day_number: 1, completed_at: 't' }],
    });
    const { result } = renderHook(() => useCompetitionPath('c1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.days).toHaveLength(2);
    expect(result.current.completedSet.has(1)).toBe(true);
    expect(result.current.completedSet.has(2)).toBe(false);
    expect(result.current.activeDay).toBe(2);
    expect(result.current.progress).toBeCloseTo(0.5, 5);
  });

  it('reports activeDay = first uncompleted', async () => {
    getCompetitionPath.mockResolvedValue({
      challenge: { id: 'c1' },
      days: [
        { day_number: 1, title_en: 'A' }, { day_number: 2, title_en: 'B' }, { day_number: 3, title_en: 'C' },
      ],
      completions: [
        { day_number: 1 }, { day_number: 3 },
      ],
    });
    const { result } = renderHook(() => useCompetitionPath('c1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeDay).toBe(2);
  });

  it('complete() inserts and updates the local set', async () => {
    getCompetitionPath.mockResolvedValue({
      challenge: { id: 'c1' },
      days: [{ day_number: 1, title_en: 'A' }],
      completions: [],
    });
    completePracticeDay.mockResolvedValue({
      challenge_id: 'c1', day_number: 1, completed_at: 't', reflection: 'ok',
    });
    const { result } = renderHook(() => useCompetitionPath('c1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.complete(1, 'ok'); });
    expect(result.current.completedSet.has(1)).toBe(true);
    expect(result.current.progress).toBe(1);
  });

  it('does not refetch when challengeId is null', async () => {
    const { result } = renderHook(() => useCompetitionPath(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCompetitionPath).not.toHaveBeenCalled();
  });
});
