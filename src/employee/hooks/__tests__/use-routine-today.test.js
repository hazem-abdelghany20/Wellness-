import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({
  ...(await orig()),
  getMyToday: vi.fn(),
  checkRoutineItem: vi.fn(),
  setItemMuted: vi.fn(),
}));

import { getMyToday, checkRoutineItem, setItemMuted } from '../../../lib/supabase-routines';
import { useRoutineToday } from '../use-routine-today.js';
import { makeToday } from '../../test-fixtures/routine.js';
import { applyTick } from '../../lib/routine-today.js';

const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const checked = (state, id) => state.items.find((i) => i.id === id).checked;

beforeEach(() => { vi.clearAllMocks(); });

describe('useRoutineToday', () => {
  it('loads today and says whether a routine is assigned', async () => {
    getMyToday.mockResolvedValue(makeToday());
    const { result } = renderHook(() => useRoutineToday(true));
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.assigned).toBe(true);
    expect(result.current.state.items).toHaveLength(4);
  });

  it('does nothing until enabled, and is "ready" so the app can land', () => {
    const { result } = renderHook(() => useRoutineToday(false));
    expect(getMyToday).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(true);
    expect(result.current.assigned).toBe(false);
  });

  it('a load error leaves the app as it was (no Today tab)', async () => {
    getMyToday.mockRejectedValue(new Error('function my_today does not exist'));
    const { result } = renderHook(() => useRoutineToday(true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.assigned).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('ticks at once, then takes the server answer', async () => {
    const s = makeToday();
    getMyToday.mockResolvedValue(s);
    const d = deferred();
    checkRoutineItem.mockReturnValue(d.promise);
    const { result } = renderHook(() => useRoutineToday(true));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let p;
    act(() => { p = result.current.toggle('i3', true); });
    expect(checked(result.current.state, 'i3')).toBe(true);           // optimistic
    expect(result.current.state.progress.done).toBe(2);
    expect(checkRoutineItem).toHaveBeenCalledWith('i3', true);

    const server = { ...applyTick(s, 'i3', true), streak: 4 };
    await act(async () => { d.resolve(server); await p; });
    expect(result.current.state.streak).toBe(4);
    expect(checked(result.current.state, 'i3')).toBe(true);
  });

  it('rolls back a failed tick and reports it', async () => {
    getMyToday.mockResolvedValue(makeToday());
    const d = deferred();
    checkRoutineItem.mockReturnValue(d.promise);
    const { result } = renderHook(() => useRoutineToday(true));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let p;
    act(() => { p = result.current.toggle('i1', false); });
    expect(checked(result.current.state, 'i1')).toBe(false);
    await act(async () => { d.reject(new Error('Failed to fetch')); await p; });
    expect(checked(result.current.state, 'i1')).toBe(true);
    expect(result.current.state.progress.done).toBe(1);
    expect(result.current.saveError).toMatchObject({ itemId: 'i1' });
  });

  it('a failed tick doesn’t undo another one still on its way', async () => {
    const s = makeToday();
    getMyToday.mockResolvedValue(s);
    const a = deferred(); const b = deferred();
    checkRoutineItem.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result } = renderHook(() => useRoutineToday(true));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let pa, pb;
    act(() => { pa = result.current.toggle('i2', true); pb = result.current.toggle('i3', true); });
    await act(async () => { a.reject(new Error('x')); await pa; });
    expect(checked(result.current.state, 'i2')).toBe(false);
    expect(checked(result.current.state, 'i3')).toBe(true);
    await act(async () => { b.resolve(applyTick(s, 'i3', true)); await pb; });
    expect(checked(result.current.state, 'i3')).toBe(true);
    expect(checked(result.current.state, 'i2')).toBe(false);
  });

  it('reloads the list when an item is no longer due', async () => {
    getMyToday.mockResolvedValue(makeToday());
    checkRoutineItem.mockRejectedValue(new Error('item_not_due_today'));
    const { result } = renderHook(() => useRoutineToday(true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.toggle('i3', true); });
    await waitFor(() => expect(getMyToday).toHaveBeenCalledTimes(2));
  });

  it('mutes optimistically and rolls back on failure', async () => {
    getMyToday.mockResolvedValue(makeToday());
    setItemMuted.mockRejectedValueOnce(new Error('x'));
    const { result } = renderHook(() => useRoutineToday(true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.mute('i2', true); });
    expect(setItemMuted).toHaveBeenCalledWith('i2', true);
    expect(result.current.state.items.find((i) => i.id === 'i2').muted).toBe(false);
    setItemMuted.mockResolvedValueOnce({});
    await act(async () => { await result.current.mute('i2', true); });
    expect(result.current.state.items.find((i) => i.id === 'i2').muted).toBe(true);
    expect(result.current.state.reminders.muted_item_ids).toContain('i2');
  });
});
