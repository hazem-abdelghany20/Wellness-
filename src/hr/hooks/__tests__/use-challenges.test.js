import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listHabitTemplates: vi.fn(),
  listHabitChallenges: vi.fn(),
  scheduleHabitChallenge: vi.fn(),
  cancelHabitChallenge: vi.fn(),
  listCompanyTeams: vi.fn(),
}));

import {
  listHabitTemplates, listHabitChallenges, scheduleHabitChallenge,
  cancelHabitChallenge, listCompanyTeams,
} from '../../../lib/supabase-hr';
import { useChallenges } from '../use-challenges';

beforeEach(() => {
  vi.clearAllMocks();
  listHabitTemplates.mockResolvedValue([{ id: 'tpl-water', title_en: 'The Water Bottle' }]);
  listHabitChallenges.mockResolvedValue([{ id: 'c1', status: 'upcoming', start_date: '2026-10-11', end_date: '2026-10-15' }]);
  listCompanyTeams.mockResolvedValue([{ id: 't1', name: 'Eng' }]);
});

describe('useChallenges (HR, weekly habits)', () => {
  it('loads templates, scheduled weeks and teams on mount', async () => {
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.scheduled).toHaveLength(1);
    expect(result.current.teams).toHaveLength(1);
  });

  it('schedules a template for a week and team, then refreshes', async () => {
    scheduleHabitChallenge.mockResolvedValue({ id: 'c2' });
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.schedule('tpl-water', '2026-10-18', 't1'); });
    expect(scheduleHabitChallenge).toHaveBeenCalledWith('tpl-water', '2026-10-18', 't1');
    expect(listHabitChallenges).toHaveBeenCalledTimes(2);
  });

  it('surfaces a week clash to the caller', async () => {
    scheduleHabitChallenge.mockRejectedValue(Object.assign(new Error('habit_week_taken'), { details: 'قزازة المية | The Water Bottle' }));
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.schedule('tpl-water', '2026-10-11', null)).rejects.toThrow('habit_week_taken');
  });

  it('cancels an upcoming week', async () => {
    cancelHabitChallenge.mockResolvedValue();
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.cancel('c1'); });
    expect(cancelHabitChallenge).toHaveBeenCalledWith('c1');
  });
});
