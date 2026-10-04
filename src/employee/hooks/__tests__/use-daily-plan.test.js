import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  getTodayPlan: vi.fn(),
  completeAction: vi.fn(),
  getPlanCompletions: vi.fn(),
}));

import { getTodayPlan, completeAction, getPlanCompletions } from '../../../lib/supabase';
import { useDailyPlan } from '../use-daily-plan';

beforeEach(() => {
  vi.clearAllMocks();
  // generate-daily-plan returns the raw row: `id`, no completions.
  getTodayPlan.mockResolvedValue({
    id: 'p1',
    actions: [{ id: 'a1', kind: 'breathe' }, { id: 'a2', kind: 'walk' }],
  });
  getPlanCompletions.mockResolvedValue(['a1']);
});

describe('useDailyPlan', () => {
  it('loads today plan and its saved completions', async () => {
    const { result } = renderHook(() => useDailyPlan());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plan.id).toBe('p1');
    expect(getPlanCompletions).toHaveBeenCalledWith('p1');
    expect(result.current.completedIds).toEqual(['a1']);
  });

  it('marks an action complete against the plan id', async () => {
    completeAction.mockResolvedValue({});
    const { result } = renderHook(() => useDailyPlan());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.complete('a2'); });

    expect(completeAction).toHaveBeenCalledWith('p1', 'a2');
    expect(result.current.completedIds).toEqual(['a1', 'a2']);
  });

  it('still accepts the legacy plan_id shape', async () => {
    getTodayPlan.mockResolvedValue({ plan_id: 'legacy', actions: [], completed_action_ids: ['x'] });
    getPlanCompletions.mockResolvedValue([]);
    completeAction.mockResolvedValue({});
    const { result } = renderHook(() => useDailyPlan());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.completedIds).toEqual(['x']);
    await act(async () => { await result.current.complete('y'); });
    expect(completeAction).toHaveBeenCalledWith('legacy', 'y');
  });
});
