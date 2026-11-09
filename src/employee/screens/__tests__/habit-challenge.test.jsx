import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  supabase: {}, getContentBySlug: vi.fn(), listSignatureChallenges: vi.fn(async () => []),
}));
const hook = vi.fn();
vi.mock('../../hooks/use-habit-challenge.js', () => ({ useHabitChallenge: () => hook() }));

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

beforeEach(() => { vi.clearAllMocks(); });

describe('Challenge tab: days from the server', () => {
  it('a two-week HR challenge shows two rows of Sun–Thu, never Fri / Sat', () => {
    hook.mockReturnValue({ state: state(), loading: false, saving: false, error: null, toggle: vi.fn() });
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
    hook.mockReturnValue({
      state: state({ days: days.slice(0, 5), weeks: 1, days_total: 5, success_days: 4,
        challenge: { ...state().challenge, end_date: '2026-11-12' } }),
      loading: false, saving: false, error: null, toggle: vi.fn(),
    });
    render(<ScreenHabitChallenge theme={THEMES.brand} dir="ltr" go={() => {}} state={{}}/>);
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.queryByText(/Week 1 of/)).toBeNull();
    expect(screen.getAllByText('Sun')).toHaveLength(1);
  });

  it('Arabic week labels', () => {
    hook.mockReturnValue({ state: state(), loading: false, saving: false, error: null, toggle: vi.fn() });
    render(<ScreenHabitChallenge theme={THEMES.brand} dir="rtl" go={() => {}} state={{}}/>);
    expect(screen.getByText('الأسبوع ١ من ٢')).toBeInTheDocument();
    expect(screen.getByText('التحدي بتاعك')).toBeInTheDocument();
  });
});
