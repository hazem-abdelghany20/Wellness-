import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  supabase: {}, getContentBySlug: vi.fn(), listSignatureChallenges: vi.fn(async () => []),
}));
const hook = vi.fn();
vi.mock('../../hooks/use-habit-challenge.js', () => ({ useHabitChallenges: () => hook() }));

import { THEMES } from '../../design-system.jsx';
import { ScreenHabitChallenge } from '../habit-challenge.jsx';

const days = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
  '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
const state = (extra = {}) => ({
  status: 'active', can_log: true, logged_target: false, target_date: '2026-11-10',
  challenge: { id: 'c1', title_en: 'Two-week water', title_ar: 'مية لمدة أسبوعين', start_date: '2026-11-08', end_date: '2026-11-19', team_id: null, payload: { action_en: 'Drink 2 litres.' } },
  my_dates: ['2026-11-08', '2026-11-09'], my_count: 2, success_days: 8, days_total: 10, days, weeks: 2, elapsed: 3, team_pct: null,
  ...extra,
});

const hookValue = (list, extra = {}) => ({ list, loading: false, saving: null, error: null, toggle: vi.fn(), ...extra });
const one = (st) => hookValue([st]);
const show = (props = {}) => render(<ScreenHabitChallenge theme={THEMES.brand} dir="ltr" go={() => {}} state={{}} {...props}/>);

// Sprint 4 shapes.
const walk = (extra = {}) => state({
  challenge: { id: 'c2', title_en: 'Walk 10 minutes', title_ar: 'امشي ١٠ دقايق', start_date: '2026-11-09', end_date: '2026-11-11', team_id: null,
    payload: { action_en: 'A short walk after lunch.', why_en: 'Moving after a meal helps.' } },
  days: ['2026-11-09', '2026-11-10', '2026-11-11'], days_total: 3, weeks: 1, elapsed: 2, success_days: 3,
  my_dates: ['2026-11-09'], my_count: 1, team_pct: 40,
  ...extra,
});
const fromRoutine = (extra = {}) => state({
  challenge: { id: 'c3', title_en: 'Stretch streak', title_ar: 'سلسلة الإطالات', start_date: '2026-11-08', end_date: '2026-11-12', team_id: null,
    payload: { action_en: 'Do your neck and wrist stretches every workday.', auto_from_routine: true } },
  days: days.slice(0, 5), days_total: 5, weeks: 1, elapsed: 3, success_days: 4,
  can_log: false, logged_target: false, my_dates: ['2026-11-08'], my_count: 1,
  auto_from_routine: true,
  routine_items: [
    { id: 'i1', title_en: 'Neck release', title_ar: 'إطالة الرقبة', due_today: true, checked: true },
    { id: 'i2', title_en: 'Wrist stretch', title_ar: 'إطالة الرسغ', due_today: true, checked: false },
    { id: 'i3', title_en: 'Squats', title_ar: 'سكوات', due_today: false, checked: false },
  ],
  ...extra,
});

beforeEach(() => { vi.clearAllMocks(); });

describe('Challenge tab: days from the server', () => {
  it('a two-week HR challenge shows two rows of Sun–Thu, never Fri / Sat', () => {
    hook.mockReturnValue(one(state()));
    render(<ScreenHabitChallenge theme={THEMES.brand} dir="ltr" go={() => {}} state={{}}/>);
    expect(screen.getByText('Your challenge')).toBeInTheDocument();
    expect(screen.getByText('Week 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Week 2 of 2')).toBeInTheDocument();
    expect(screen.getAllByText('Sun')).toHaveLength(2);
    expect(screen.getAllByText('Thu')).toHaveLength(2);
    expect(screen.queryByText('Fri')).toBeNull();
    expect(screen.queryByText('Sat')).toBeNull();
    expect(screen.getByText('2 of 8 days for the reward')).toBeInTheDocument();
  });

  it('a one-week challenge looks as before (no week labels)', () => {
    hook.mockReturnValue(one(state({ days: days.slice(0, 5), weeks: 1, days_total: 5, success_days: 4,
      challenge: { ...state().challenge, end_date: '2026-11-12' } })));
    render(<ScreenHabitChallenge theme={THEMES.brand} dir="ltr" go={() => {}} state={{}}/>);
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.queryByText(/Week 1 of/)).toBeNull();
    expect(screen.getAllByText('Sun')).toHaveLength(1);
  });

  it('Arabic week labels', () => {
    hook.mockReturnValue(one(state()));
    render(<ScreenHabitChallenge theme={THEMES.brand} dir="rtl" go={() => {}} state={{}}/>);
    expect(screen.getByText('الأسبوع ١ من ٢')).toBeInTheDocument();
    expect(screen.getByText('التحدي بتاعك')).toBeInTheDocument();
  });
});

describe('Challenge tab: several at once (sprint 4)', () => {
  it('one challenge keeps the single look: no stack, no "More", no day X of Y', () => {
    hook.mockReturnValue(one(walk()));
    show();
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your challenges' })).toBeNull();
    expect(screen.queryByRole('button', { name: /More about this challenge|Show less/ })).toBeNull();
    expect(screen.queryByText(/Day 2 of 3/)).toBeNull();
    expect(screen.getByText('Your team')).toBeInTheDocument();
    expect(screen.getByText('Why this helps')).toBeInTheDocument();
  });

  it('a 3-day challenge shows exactly its 3 dots, from the days', () => {
    hook.mockReturnValue(one(walk()));
    const { container } = show();
    expect([...container.querySelectorAll('[data-day]')].map((el) => el.getAttribute('data-day')))
      .toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.queryByText('Sun')).toBeNull();
    expect(screen.queryByText('Thu')).toBeNull();
    expect(screen.queryByText(/Week 1 of/)).toBeNull();
    expect(screen.getByText('1 of 3 days for the reward')).toBeInTheDocument();
  });

  it('a 23-day challenge shows 23 dots in 5 week rows, never Fri / Sat', () => {
    // Tue 3 Nov → Thu 3 Dec 2026.
    const d23 = [];
    for (let t = Date.UTC(2026, 10, 3); t <= Date.UTC(2026, 11, 3); t += 86400000) {
      const d = new Date(t);
      if (d.getUTCDay() < 5) d23.push(d.toISOString().slice(0, 10));
    }
    hook.mockReturnValue(one(state({
      challenge: { ...state().challenge, start_date: '2026-11-03', end_date: '2026-12-03' },
      days: d23, days_total: 23, weeks: 4, elapsed: 6, success_days: 19, my_dates: [], my_count: 0,
    })));
    const { container } = show();
    expect(container.querySelectorAll('[data-day]')).toHaveLength(23);
    expect(screen.getByText('Week 1 of 5')).toBeInTheDocument();
    expect(screen.getByText('Week 5 of 5')).toBeInTheDocument();
    expect(screen.getAllByText('Sun')).toHaveLength(4); // the first week starts on Tuesday
    expect(screen.getAllByText('Thu')).toHaveLength(5);
    expect(screen.queryByText('Fri')).toBeNull();
    expect(screen.queryByText('Sat')).toBeNull();
    expect(screen.getByText('0 of 19 days for the reward')).toBeInTheDocument();
  });

  it('several: a card each with dates, day X of Y and its own button; the first one open', () => {
    const toggle = vi.fn();
    const upcoming = state({ status: 'upcoming', can_log: false,
      challenge: { ...state().challenge, id: 'c9', title_en: 'Sleep by 11', start_date: '2026-11-22', end_date: '2026-11-26' } });
    hook.mockReturnValue(hookValue([state(), walk(), upcoming], { toggle }));
    show();
    expect(screen.getByText('Your challenges')).toBeInTheDocument();
    const cards = within(screen.getByRole('list', { name: 'Your challenges' })).getAllByRole('listitem');
    expect(cards).toHaveLength(3);

    expect(within(cards[0]).getByText('Two-week water')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/Nov 8 → Nov 19/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('Day 3 of 10')).toBeInTheDocument();
    expect(within(cards[0]).getByText('2 of 8 days for the reward')).toBeInTheDocument();
    expect(within(cards[0]).getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(cards[0]).getByText('Your team')).toBeInTheDocument();

    expect(within(cards[1]).getByText('Walk 10 minutes')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Day 2 of 3')).toBeInTheDocument();
    expect(cards[1].querySelectorAll('[data-day]')).toHaveLength(3);
    expect(within(cards[1]).queryByText('Your team')).toBeNull();
    const more = within(cards[1]).getByRole('button', { name: 'More about this challenge' });
    expect(more).toHaveAttribute('aria-expanded', 'false');

    // Each card logs its own challenge.
    fireEvent.click(within(cards[1]).getByRole('button', { name: '✓ Did it today' }));
    expect(toggle).toHaveBeenCalledWith('c2');
    fireEvent.click(within(cards[0]).getByRole('button', { name: '✓ Did it today' }));
    expect(toggle).toHaveBeenLastCalledWith('c1');

    // "More" opens that card and closes the other.
    fireEvent.click(more);
    expect(within(cards[1]).getByText('Your team')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Moving after a meal helps.')).toBeInTheDocument();
    expect(within(cards[0]).queryByText('Your team')).toBeNull();

    // The one coming up says when it starts and has no button.
    expect(within(cards[2]).getByText(/Starts/)).toBeInTheDocument();
    expect(within(cards[2]).getByText('Sleep by 11')).toBeInTheDocument();
    expect(within(cards[2]).queryByRole('button', { name: /Did it/ })).toBeNull();
  });

  it('saving and a failed save show on that card only', () => {
    hook.mockReturnValue(hookValue([state(), walk()], { saving: 'c2', error: { id: 'c1', error: new Error('x') } }));
    show();
    const cards = within(screen.getByRole('list', { name: 'Your challenges' })).getAllByRole('listitem');
    expect(within(cards[1]).getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(within(cards[0]).getByRole('button', { name: '✓ Did it today' })).not.toBeDisabled();
    expect(within(cards[0]).getByRole('alert')).toHaveTextContent('Could not save');
    expect(within(cards[1]).queryByRole('alert')).toBeNull();
  });

  it('a challenge from routine exercises has no "Did it": it lists what to tick and sends you to Today', () => {
    const go = vi.fn();
    hook.mockReturnValue(one(fromRoutine()));
    show({ go, hasRoutine: true });
    expect(screen.queryByRole('button', { name: /Did it/ })).toBeNull();
    expect(screen.queryByText(/This week is over/)).toBeNull();
    const block = screen.getByTestId('challenge-auto');
    expect(within(block).getByText('This one counts by itself. Tick these in Today:')).toBeInTheDocument();
    const rows = within(block).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual(['Neck release', 'Wrist stretch', 'SquatsNot today']);
    expect(within(rows[0]).getByRole('img', { name: 'Ticked' })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('img')).toBeNull();
    expect(within(block).queryByText('Today is counted ✓')).toBeNull();
    fireEvent.click(within(block).getByRole('button', { name: 'Go to Today' }));
    expect(go).toHaveBeenCalledWith('today');
    // Its dots still come from the days.
    expect(screen.getByText('1 of 4 days for the reward')).toBeInTheDocument();
  });

  it('an automatic challenge: no "Go to Today" without a routine; says when today is counted', () => {
    hook.mockReturnValue(one(fromRoutine({ logged_target: true })));
    show({ hasRoutine: false });
    expect(screen.getByText('Today is counted ✓')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Today' })).toBeNull();
  });

  it('Arabic: stack, day X of Y and the automatic lines', () => {
    hook.mockReturnValue(hookValue([fromRoutine(), walk()]));
    render(<ScreenHabitChallenge theme={THEMES.brand} dir="rtl" go={() => {}} state={{}} hasRoutine/>);
    expect(screen.getByText('تحدياتك')).toBeInTheDocument();
    expect(screen.getByText('اليوم ٣ من ٥')).toBeInTheDocument();
    expect(screen.getByText('اليوم ٢ من ٣')).toBeInTheDocument();
    expect(screen.getByText('ده بيتحسب لوحده. علّم على دول في «النهارده»:')).toBeInTheDocument();
    expect(screen.getByText('مش النهارده')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'روح على «النهارده»' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تفاصيل أكتر عن التحدي' })).toBeInTheDocument();
  });

  it('keeps the empty state when there is no challenge', () => {
    hook.mockReturnValue(hookValue([]));
    show();
    expect(screen.getByText('No challenge this week')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open library' })).toBeInTheDocument();
    hook.mockReturnValue(hookValue(null, { loading: true }));
    show();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
