import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const lib = vi.hoisted(() => ({ getRoutineReport: vi.fn(), getRoutinePeople: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({ ...(await orig()), ...lib }));
const files = vi.hoisted(() => ({ downloadRoutineReport: vi.fn(async () => {}) }));
vi.mock('../../../shared/authoring/sheet-files.js', () => files);

import { HRRoutineReportPage } from '../routine-report.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';

const report = (over = {}) => ({
  range: '14d', from: '2026-10-27', to: '2026-11-09', timezone: 'Africa/Cairo', min_cohort: 5, members: 40,
  suppressed: false, has_routine: true,
  today: { date: '2026-11-09', assigned: 40, active: 12, done: 37, due: 120, full_days: 3, pct: 31, active_pct: 30 },
  totals: { done: 400, due: 1000, full_days: 20, active_people: 30, completion_pct: 40 },
  by_day: [{ date: '2026-11-09', weekday: 1, assigned: 40, active: 12, done: 37, due: 120, full_days: 3, pct: 31, active_pct: 30 }],
  by_team: [
    { team_id: 't1', name: 'Finance', department: null, small: false, no_team: false, teams: 1, members: 10, active: 8, active_pct: 80, done: 150, due: 300, completion_pct: 50, avg_items_per_day: 1.5 },
    { team_id: null, name: null, department: null, small: true, no_team: false, teams: 3, members: 9, active: 4, active_pct: 44, done: 40, due: 200, completion_pct: 20, avg_items_per_day: 0.4 },
  ],
  small_teams_hidden: true,
  by_exercise: [
    { key: 'a', title_en: 'Neck release', done: 200, due: 400, pct: 50 },
    { key: 'b', title_en: 'Wall push-ups', done: 20, due: 400, pct: 5 },
  ],
  by_hour: [{ hour: 10, checks: 30 }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  lib.getRoutineReport.mockResolvedValue(report());
  lib.getRoutinePeople.mockResolvedValue({ enabled: false, people: [], opted_in: 0, not_shared: 40 });
});

const view = (props = {}) => render(<HRRoutineReportPage theme={HR_THEMES.light} lang="en" density="comfortable" {...props}/>);

describe('HR routine report', () => {
  it('shows today, teams (with the small-teams row) and exercises most to least done', async () => {
    view();
    expect(await screen.findByText('37/120')).toBeInTheDocument();
    expect(screen.getByText('31% of today’s items')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Other teams (3)')).toBeInTheDocument();
    expect(screen.getByText(/Some small teams together are still under 5 people/)).toBeInTheDocument();
    const names = screen.getAllByText(/Neck release|Wall push-ups/).map((n) => n.textContent);
    expect(names).toEqual(['Neck release', 'Wall push-ups']);
    expect(screen.getByText(/Names are off/)).toBeInTheDocument();
  });

  it('switches the period and exports the report', async () => {
    view({ companyName: 'Nile' });
    await screen.findByText('37/120');
    fireEvent.click(screen.getByRole('tab', { name: '30d' }));
    await waitFor(() => expect(lib.getRoutineReport).toHaveBeenLastCalledWith('30d'));
    expect(lib.getRoutinePeople).toHaveBeenLastCalledWith('30d');
    fireEvent.click(screen.getByRole('button', { name: 'Export .xlsx' }));
    await waitFor(() => expect(files.downloadRoutineReport).toHaveBeenCalledWith(expect.objectContaining({ range: '14d' }),
      expect.objectContaining({ enabled: false }), { lang: 'en', companyName: 'Nile' }));
  });

  it('says when teams are folded for privacy, and replaces the table when no team can be shown', async () => {
    lib.getRoutineReport.mockResolvedValueOnce(report({ teams_folded: 1, small_teams_hidden: false }));
    const { unmount } = view();
    expect(await screen.findByText('Other teams (3)')).toBeInTheDocument();
    expect(screen.getByText(/Some teams are grouped into “Other teams” to protect privacy/)).toBeInTheDocument();
    unmount();

    lib.getRoutineReport.mockResolvedValueOnce(report({ breakdown_suppressed: true, teams_folded: 2, by_team: [] }));
    view({ lang: 'ar' });
    expect(await screen.findByText(/الفرق متجمّعة علشان نحافظ على الخصوصية/)).toBeInTheDocument();
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
  });

  it('lists people who share their progress when the company view is on', async () => {
    lib.getRoutinePeople.mockResolvedValue({ enabled: true, opted_in: 1, not_shared: 39, people: [
      { user_id: 'u1', display_name: 'Amira Hassan', initials: 'AH', team_name: 'Finance', days_active: 5, items_done: 42, full_days: 2, streak: 3, last_active: '2026-11-09' },
    ] });
    view();
    expect(await screen.findByText('People who share their progress')).toBeInTheDocument();
    expect(screen.getByText('1 share · 39 don’t (counted, not named)')).toBeInTheDocument();
    expect(screen.getByText('Amira Hassan')).toBeInTheDocument();
    expect(screen.getByText(/Everyone else is only counted, never named/)).toBeInTheDocument();
  });

  it('hides percentages under the floor and shows an empty state with no routine', async () => {
    lib.getRoutineReport.mockResolvedValueOnce(report({ suppressed: true, today: { ...report().today, pct: null }, totals: { ...report().totals, completion_pct: null } }));
    const { unmount } = view();
    expect(await screen.findByText(/percentages are hidden to keep everyone anonymous/)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    unmount();

    lib.getRoutineReport.mockResolvedValueOnce(report({ has_routine: false, totals: { done: 0, due: 0, full_days: 0, active_people: 0, completion_pct: null } }));
    const setNav = vi.fn();
    view({ setNav });
    fireEvent.click(await screen.findByRole('button', { name: 'Go to Routines' }));
    expect(setNav).toHaveBeenCalledWith('routines');
  });
});
