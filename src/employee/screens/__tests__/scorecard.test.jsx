import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn(), getMyScorecard: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({ ...(await orig()), getRecognitionBoard: vi.fn(), setMyPrefs: vi.fn(), getMyPrefs: vi.fn() }));
const hook = vi.fn();
vi.mock('../../hooks/use-scorecard.js', () => ({ useScorecard: () => hook() }));

import { getRecognitionBoard, getMyPrefs } from '../../../lib/supabase-routines';
import { THEMES } from '../../design-system.jsx';
import { ScreenScorecard } from '../scorecard.jsx';
import { makeBoard } from '../../test-fixtures/routine.js';

const card = (me = {}) => ({
  week_start: '2026-11-08',
  me: {
    week: 50, total: 120, best_week: 70,
    week_parts: { habit_days: 2, weeks_done: 0, articles: 0, routine_items: 12, routine_full_days: 1 },
    total_parts: { habit_days: 5, weeks_done: 1, articles: 2, routine_items: 20, routine_full_days: 2 },
    weekly: [{ week_start: '2026-11-01', points: 70 }, { week_start: '2026-11-08', points: 50 }],
    routine: { streak: 3, best_streak: 7, week_days: 2 },
    ...me,
  },
  team: null, company: null,
});
const myPrefs = (company = {}) => ({
  routine_reminders: false, muted_item_ids: [], recognition_opt_in: false, share_with_hr: false, visibility_notice_seen_at: null,
  company: { recognition: 'off', hr_people_view: false, everyone_visible: false, ...company },
});
const team = { team: { name: 'Finance', members: 8, active: 6, avg_week: 40 }, company: { members: 30, active: 20, avg_week: 35 } };
const realMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.clearAllMocks();
  // Reduced motion: numbers render at their final value straight away.
  window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  getRecognitionBoard.mockResolvedValue(makeBoard('off'));
  getMyPrefs.mockResolvedValue(myPrefs());
});
afterEach(() => { window.matchMedia = realMatchMedia; });

describe('Score tab', () => {
  it('adds routine points (capped) and the routine streak, and keeps the privacy line', async () => {
    hook.mockReturnValue({ data: card(), loading: false, error: null, refetch: vi.fn() });
    render(<ScreenScorecard theme={THEMES.brand} dir="ltr" go={() => {}} hasRoutine/>);
    expect(screen.getByText('Only you see your points.')).toBeInTheDocument();
    const items = screen.getByText('Routine items ticked').closest('div').parentElement.parentElement;
    expect(within(items).getByText('+20')).toBeInTheDocument(); // 12 ticks, capped at 20 a day
    const full = screen.getByText('Full routine days').closest('div').parentElement.parentElement;
    expect(within(full).getByText('+10')).toBeInTheDocument();
    const streak = screen.getByTestId('routine-streak');
    expect(within(streak).getByText('Routine streak (days)')).toBeInTheDocument();
    expect(within(streak).getByText('3')).toBeInTheDocument();
    expect(within(streak).getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Each routine item you tick (up to 20 a day)')).toBeInTheDocument();
    expect(screen.getByText(/A full week with your routine is 220 points/)).toBeInTheDocument();
  });

  it('without a routine it looks as before', async () => {
    hook.mockReturnValue({ data: card({ week_parts: { habit_days: 2, weeks_done: 0, articles: 0 }, total_parts: { habit_days: 2, weeks_done: 0, articles: 0 }, routine: { streak: 0, best_streak: 0, week_days: 0 }, week: 20 }), loading: false, error: null, refetch: vi.fn() });
    render(<ScreenScorecard theme={THEMES.brand} dir="ltr" go={() => {}}/>);
    expect(screen.queryByText('Routine items ticked')).toBeNull();
    expect(screen.queryByTestId('routine-streak')).toBeNull();
    expect(screen.getByText('A full challenge week is 70 points.')).toBeInTheDocument();
  });

  it('shows the company board when HR turned it on', async () => {
    getRecognitionBoard.mockResolvedValue(makeBoard('teams'));
    hook.mockReturnValue({ data: card(), loading: false, error: null, refetch: vi.fn() });
    render(<ScreenScorecard theme={THEMES.brand} dir="ltr" go={() => {}} hasRoutine/>);
    expect(await screen.findByText('Company board')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Only you see your points.')).toBeInTheDocument();
  });

  it('team averages say "no names, no ranking" while the board shows no names', async () => {
    getMyPrefs.mockResolvedValue(myPrefs({ recognition: 'teams' }));
    hook.mockReturnValue({ data: { ...card(), ...team }, loading: false, error: null, refetch: vi.fn() });
    render(<ScreenScorecard theme={THEMES.brand} dir="ltr" go={() => {}} hasRoutine/>);
    await waitFor(() => expect(getMyPrefs).toHaveBeenCalled());
    expect(await screen.findByText('Averages per person this week. No names, no ranking.')).toBeInTheDocument();
    expect(screen.getByText('Only you see your points.')).toBeInTheDocument();
  });

  it('a named board: the averages line drops "no names, no ranking"', async () => {
    getMyPrefs.mockResolvedValue(myPrefs({ recognition: 'named' }));
    getRecognitionBoard.mockResolvedValue(makeBoard('named'));
    hook.mockReturnValue({ data: { ...card(), ...team }, loading: false, error: null, refetch: vi.fn() });
    render(<ScreenScorecard theme={THEMES.brand} dir="ltr" go={() => {}} hasRoutine/>);
    expect(await screen.findByText('Averages per person this week.')).toBeInTheDocument();
    expect(screen.queryByText(/No names, no ranking/)).toBeNull();
    expect(screen.getByText('Only you see your points.')).toBeInTheDocument();
    // Opt-in company: the invitation is still there.
    expect(await screen.findByRole('region', { name: 'Show your name on the company board?' })).toBeInTheDocument();
  });

  it('company shows everyone: no opt-in invitation, no "only people who chose", honest copy', async () => {
    getMyPrefs.mockResolvedValue(myPrefs({ recognition: 'named', hr_people_view: true, everyone_visible: true }));
    getRecognitionBoard.mockResolvedValue(makeBoard('named', { me: { opted_in: true, items_done: 4, streak: 2 } }));
    hook.mockReturnValue({ data: { ...card(), ...team }, loading: false, error: null, refetch: vi.fn() });
    render(<ScreenScorecard theme={THEMES.brand} dir="ltr" go={() => {}} hasRoutine/>);
    expect(await screen.findByText('Only you see your points. The board shows names with what they did.')).toBeInTheDocument();
    expect(await screen.findByText('Your name shows on the board, like everyone’s.')).toBeInTheDocument();
    expect(screen.getByText(/Your company shows everyone’s name/)).toBeInTheDocument();
    expect(screen.queryByText(/chose to show theirs/)).toBeNull();
    expect(screen.queryByText(/Change it in Me/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Show your name on the company board?' })).toBeNull();
    expect(screen.queryByText(/No names, no ranking/)).toBeNull();
    expect(screen.getByText('Averages per person this week.')).toBeInTheDocument();
  });

  it('Arabic', async () => {
    hook.mockReturnValue({ data: card(), loading: false, error: null, refetch: vi.fn() });
    render(<ScreenScorecard theme={THEMES.brand} dir="rtl" go={() => {}} hasRoutine/>);
    expect(screen.getByText('نقاطك محدش يشوفها غيرك.')).toBeInTheDocument();
    expect(screen.getByText('تمارين الروتين اللي علّمت عليها')).toBeInTheDocument();
    expect(screen.getByText('أيام الروتين ورا بعض')).toBeInTheDocument();
  });
});
