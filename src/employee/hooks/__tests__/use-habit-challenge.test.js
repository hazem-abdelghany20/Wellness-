import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  getMyHabitChallenge: vi.fn(),
  logHabit: vi.fn(),
}));

import { getMyHabitChallenge, logHabit } from '../../../lib/supabase';
import { useHabitChallenge } from '../use-habit-challenge';

const active = (logged) => ({
  status: 'active', can_log: true, logged_target: logged,
  challenge: { id: 'c1', title_en: 'The Water Bottle', start_date: '2026-10-04', end_date: '2026-10-08', payload: {} },
  my_dates: logged ? ['2026-10-05'] : [], my_count: logged ? 1 : 0, success_days: 4, days_total: 5,
});

beforeEach(() => { vi.clearAllMocks(); });

describe('useHabitChallenge', () => {
  it('loads the current week', async () => {
    getMyHabitChallenge.mockResolvedValue(active(false));
    const { result } = renderHook(() => useHabitChallenge());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.challenge.id).toBe('c1');
  });

  it('"Did it" logs, a second tap undoes', async () => {
    getMyHabitChallenge.mockResolvedValue(active(false));
    logHabit.mockResolvedValueOnce(active(true)).mockResolvedValueOnce(active(false));
    const { result } = renderHook(() => useHabitChallenge());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.toggle(); });
    expect(logHabit).toHaveBeenLastCalledWith('c1', true);
    expect(result.current.state.my_count).toBe(1);
    await act(async () => { await result.current.toggle(); });
    expect(logHabit).toHaveBeenLastCalledWith('c1', false);
  });

  it('does nothing when logging is not open', async () => {
    getMyHabitChallenge.mockResolvedValue({ ...active(false), can_log: false });
    const { result } = renderHook(() => useHabitChallenge());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.toggle(); });
    expect(logHabit).not.toHaveBeenCalled();
  });
});
