import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  getMyHabitChallenges: vi.fn(),
  logHabit: vi.fn(),
}));

import { getMyHabitChallenges, logHabit } from '../../../lib/supabase';
import { useHabitChallenges } from '../use-habit-challenge';

const active = (id, logged, extra = {}) => ({
  status: 'active', can_log: true, logged_target: logged,
  challenge: { id, title_en: id === 'c1' ? 'The Water Bottle' : 'Walk 10 minutes', start_date: '2026-10-04', end_date: '2026-10-08', payload: {} },
  my_dates: logged ? ['2026-10-05'] : [], my_count: logged ? 1 : 0, success_days: 4, days_total: 5,
  ...extra,
});
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

beforeEach(() => { vi.clearAllMocks(); });

describe('useHabitChallenges', () => {
  it('loads every challenge, in the server’s order', async () => {
    getMyHabitChallenges.mockResolvedValue([active('c1', false), active('c2', true)]);
    const { result } = renderHook(() => useHabitChallenges());
    expect(result.current.list).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.list.map((st) => st.challenge.id)).toEqual(['c1', 'c2']);
  });

  it('is an empty list when there is none (or only a "none" answer)', async () => {
    getMyHabitChallenges.mockResolvedValue([{ status: 'none' }]);
    const { result } = renderHook(() => useHabitChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.list).toEqual([]);
  });

  it('"Did it" logs that challenge and re-reads the list; a second tap undoes', async () => {
    getMyHabitChallenges
      .mockResolvedValueOnce([active('c1', false), active('c2', false)])
      .mockResolvedValueOnce([active('c1', false), active('c2', true)])
      .mockResolvedValue([active('c1', false), active('c2', false)]);
    logHabit.mockResolvedValueOnce(active('c2', true)).mockResolvedValueOnce(active('c2', false));
    const { result } = renderHook(() => useHabitChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.toggle('c2'); });
    expect(logHabit).toHaveBeenLastCalledWith('c2', true);
    expect(getMyHabitChallenges).toHaveBeenCalledTimes(2);
    expect(result.current.list[1].my_count).toBe(1);
    expect(result.current.list[0].my_count).toBe(0);
    expect(result.current.saving).toBeNull();

    await act(async () => { await result.current.toggle('c2'); });
    expect(logHabit).toHaveBeenLastCalledWith('c2', false);
    expect(getMyHabitChallenges).toHaveBeenCalledTimes(3);
    expect(result.current.list[1].my_count).toBe(0);
  });

  it('shows the saved tap at once, and keeps it when the re-read fails', async () => {
    const reread = deferred();
    getMyHabitChallenges.mockResolvedValueOnce([active('c1', false), active('c2', false)]).mockReturnValueOnce(reread.promise);
    logHabit.mockResolvedValue(active('c1', true));
    const { result } = renderHook(() => useHabitChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let done;
    act(() => { done = result.current.toggle('c1'); });
    await waitFor(() => expect(result.current.list[0].logged_target).toBe(true)); // before the re-read answers
    expect(result.current.saving).toBe('c1');
    await act(async () => { reread.reject(new Error('Failed to fetch')); await done; });
    expect(result.current.list[0].logged_target).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.saving).toBeNull();
  });

  it('says which challenge failed to save, and leaves the list alone', async () => {
    getMyHabitChallenges.mockResolvedValue([active('c1', false), active('c2', false)]);
    logHabit.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(() => useHabitChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.toggle('c2'); });
    expect(result.current.error).toMatchObject({ id: 'c2' });
    expect(result.current.list[1].logged_target).toBe(false);
    expect(getMyHabitChallenges).toHaveBeenCalledTimes(1);
  });

  it('does nothing when logging is not open, for an automatic challenge, or an unknown id', async () => {
    getMyHabitChallenges.mockResolvedValue([
      active('c1', false, { can_log: false }),
      active('c2', false, { can_log: true, auto_from_routine: true }),
    ]);
    const { result } = renderHook(() => useHabitChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.toggle('c1'); await result.current.toggle('c2'); await result.current.toggle('nope'); });
    expect(logHabit).not.toHaveBeenCalled();
  });

  it('a failed load leaves no list and reports the error', async () => {
    getMyHabitChallenges.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(() => useHabitChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.list).toBeNull();
    expect(result.current.error).toMatchObject({ id: null });
  });
});
