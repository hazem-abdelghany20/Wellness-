import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listHabitTemplates: vi.fn(),
  listHabitChallenges: vi.fn(),
  scheduleChallenge: vi.fn(),
  cancelHabitChallenge: vi.fn(),
  listCompanyTeams: vi.fn(),
}));

import {
  listHabitTemplates, listHabitChallenges, scheduleChallenge,
  cancelHabitChallenge, listCompanyTeams,
} from '../../../lib/supabase-hr';
import { useChallenges } from '../use-challenges';

beforeEach(() => {
  vi.clearAllMocks();
  listHabitTemplates.mockResolvedValue([{ id: 'tpl-water', title_en: 'The Water Bottle' }]);
  listHabitChallenges.mockResolvedValue([{ id: 'c1', status: 'upcoming', start_date: '2026-10-11', end_date: '2026-10-15' }]);
  listCompanyTeams.mockResolvedValue([{ id: 't1', name: 'Eng' }]);
});

describe('useChallenges (HR, challenges with their own dates)', () => {
  it('loads templates, scheduled challenges and teams on mount', async () => {
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.scheduled).toHaveLength(1);
    expect(result.current.teams).toHaveLength(1);
  });

  it('schedules a template with its own dates, days needed and team, then refreshes', async () => {
    scheduleChallenge.mockResolvedValue({ id: 'c2', workdays: 3, success_days: 3 });
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const input = { templateId: 'tpl-water', startDate: '2026-10-19', endDate: '2026-10-21', successDays: 3, teamId: 't1' };
    let created;
    await act(async () => { created = await result.current.schedule(input); });
    expect(scheduleChallenge).toHaveBeenCalledWith(input);
    expect(created).toMatchObject({ id: 'c2', workdays: 3 });
    expect(listHabitChallenges).toHaveBeenCalledTimes(2);
  });

  it('schedules a challenge from routine rows', async () => {
    scheduleChallenge.mockResolvedValue({ id: 'c3', workdays: 5, success_days: 4 });
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const input = { title_en: 'Stretch week', routineItemIds: ['i1', 'i2'], startDate: '2026-10-18', endDate: '2026-10-22', successDays: 4, teamId: null };
    await act(async () => { await result.current.schedule(input); });
    expect(scheduleChallenge).toHaveBeenCalledWith(input);
  });

  it('surfaces "same challenge, same days" to the caller and does not refresh', async () => {
    scheduleChallenge.mockRejectedValue(Object.assign(new Error('habit_week_taken'), { details: 'قزازة المية | The Water Bottle' }));
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.schedule({ templateId: 'tpl-water', startDate: '2026-10-11', endDate: '2026-10-15' })).rejects.toThrow('habit_week_taken');
    expect(listHabitChallenges).toHaveBeenCalledTimes(1);
  });

  it('cancels an upcoming challenge or ends a running one, then refreshes', async () => {
    cancelHabitChallenge.mockResolvedValue();
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.cancel('c1'); });
    expect(cancelHabitChallenge).toHaveBeenCalledWith('c1');
    expect(listHabitChallenges).toHaveBeenCalledTimes(2);
  });

  it('lets the caller see why a challenge could not be ended', async () => {
    cancelHabitChallenge.mockRejectedValue(new Error('only_upcoming_can_be_cancelled'));
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.cancel('c1')).rejects.toThrow('only_upcoming_can_be_cancelled');
  });
});
