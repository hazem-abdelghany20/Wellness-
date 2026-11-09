import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }) } },
}));

import { supabase } from '../../lib/supabase';
import { useWalkthrough, tourSeen, markTourSeen, guideHref } from '../walkthrough.jsx';
import { EMPLOYEE_TOUR, HR_TOUR, ADMIN_TOUR } from '../tours.js';

const user = (meta = {}) => ({ id: 'u1', user_metadata: meta });
const steps = [{ screen: 'a', title_en: 'A' }, { screen: 'b', title_en: 'B' }];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useRealTimers();
});

describe('tourSeen / markTourSeen', () => {
  it('is unseen for a new account and seen once marked', async () => {
    const u = user();
    expect(tourSeen(u, 'hr')).toBe(false);
    await markTourSeen(u, 'hr');
    expect(tourSeen(u, 'hr')).toBe(true);
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { tours_seen: { hr: expect.any(String) } },
    });
  });

  it('keeps tours already recorded on the account', async () => {
    await markTourSeen(user({ tours_seen: { employee: 'x' } }), 'hr');
    expect(supabase.auth.updateUser.mock.calls[0][0].data.tours_seen).toMatchObject({ employee: 'x' });
  });

  it('treats account metadata as seen even on a fresh device', () => {
    expect(tourSeen(user({ tours_seen: { admin: 'x' } }), 'admin')).toBe(true);
  });

  it('never runs without a signed-in user', () => {
    expect(tourSeen(null, 'hr')).toBe(true);
  });
});

describe('useWalkthrough', () => {
  it('starts on its own for a new account and navigates to the first screen', () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useWalkthrough({ key: 'hr', user: user(), steps, onNavigate }));
    expect(result.current.open).toBe(false);
    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current.open).toBe(true);
    expect(onNavigate).toHaveBeenLastCalledWith('a');
  });

  it('still starts when the app re-renders with a new navigate function and user object', () => {
    vi.useFakeTimers();
    const calls = [];
    const { result, rerender } = renderHook(
      ({ n }) => useWalkthrough({ key: 'employee', user: user(), steps, onNavigate: (s) => calls.push([n, s]) }),
      { initialProps: { n: 0 } },
    );
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ n: 1 });
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ n: 2 });
    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current.open).toBe(true);
    expect(calls.at(-1)).toEqual([2, 'a']);
  });

  it('does not start when already seen or when autoStart is off', () => {
    vi.useFakeTimers();
    const a = renderHook(() => useWalkthrough({ key: 'hr', user: user({ tours_seen: { hr: 'x' } }), steps }));
    const b = renderHook(() => useWalkthrough({ key: 'hr', user: user(), steps, autoStart: false }));
    act(() => { vi.advanceTimersByTime(800); });
    expect(a.result.current.open).toBe(false);
    expect(b.result.current.open).toBe(false);
  });

  it('steps forward and back, and finishing marks it seen', () => {
    const onNavigate = vi.fn();
    const u = user();
    const { result } = renderHook(() => useWalkthrough({ key: 'hr', user: u, steps, onNavigate, autoStart: false }));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    expect(onNavigate).toHaveBeenLastCalledWith('b');
    act(() => result.current.back());
    expect(result.current.index).toBe(0);
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.open).toBe(false);
    expect(tourSeen(u, 'hr')).toBe(true);
  });
});

describe('tour content', () => {
  it('every step has a screen and both languages', () => {
    for (const tour of [EMPLOYEE_TOUR, HR_TOUR, ADMIN_TOUR]) {
      for (const s of tour) {
        expect(s.screen).toBeTruthy();
        for (const k of ['title_en', 'title_ar', 'body_en', 'body_ar']) expect(s[k]?.length).toBeGreaterThan(3);
      }
    }
  });

  it('guide links point at the static guide pages', () => {
    expect(guideHref('hr', 'en')).toBe('/guides/hr.html');
    expect(guideHref('employee', 'ar')).toBe('/guides/employee.html#ar');
  });
});
