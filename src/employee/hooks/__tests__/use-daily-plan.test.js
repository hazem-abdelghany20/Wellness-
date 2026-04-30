import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  getTodayPlan: vi.fn(),
  completeAction: vi.fn(),
}));

import { getTodayPlan, completeAction } from '../../../lib/supabase';
import { useDailyPlan } from '../use-daily-plan';

beforeEach(() => {
  vi.clearAllMocks();
  getTodayPlan.mockResolvedValue({
    plan_id: 'p1',
    actions: [{ id: 'a1', kind: 'breathe' }, { id: 'a2', kind: 'walk' }],
    completed_action_ids: ['a1'],
  });
});

describe('useDailyPlan', () => {
  it('loads today plan on mount', async () => {
    const { result } = renderHook(() => useDailyPlan());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plan.plan_id).toBe('p1');
    expect(result.current.completedIds).toEqual(['a1']);
  });

  it('marks an action complete and updates state', async () => {
    completeAction.mockResolvedValue({});
    const { result } = renderHook(() => useDailyPlan());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.complete('a2'); });

    expect(completeAction).toHaveBeenCalledWith('p1', 'a2');
    expect(result.current.completedIds).toEqual(['a1', 'a2']);
  });
});
