import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DashboardTeamsCard } from '../dashboard-teams.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';


// Render-heavy screens: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20000 });
const T = HR_THEMES.light;
const teams = {
  teams: [
    { id: 't-fin', name: 'Finance', department: 'Ops', members: 12, leads: [{ user_id: 'u1', display_name: 'Sara' }] },
    { id: 't-tech', name: 'Tech', department: null, members: 9, leads: [] },
    { id: 't-ops', name: 'People Ops', department: null, members: 3, leads: [] },
  ],
  no_team: 4,
};
const report = {
  has_routine: true, min_cohort: 5, breakdown_suppressed: false, teams_folded: 1,
  by_team: [
    { team_id: 't-fin', small: false, members: 12, completion_pct: 64 },
    { team_id: null, small: true, teams: 2, members: 12, completion_pct: 40 },
  ],
};
const makeApi = (over = {}) => ({
  teams: vi.fn(async () => teams),
  report: vi.fn(async () => report),
  challenges: vi.fn(async () => []),
  invites: vi.fn(async () => [{ team: 'Finance', status: 'pending' }, { team: null, status: 'pending' }]),
  ...over,
});

describe('Dashboard team card', () => {
  it('shows people per team and the folded routine numbers, with an "Other teams" row', async () => {
    const api = makeApi();
    const setNav = vi.fn();
    render(<DashboardTeamsCard theme={T} lang="en" density="comfortable" companyId="c1" setNav={setNav} api={api}/>);
    const table = await screen.findByRole('table', { name: 'Teams' });
    expect(api.invites).toHaveBeenCalledWith('c1');
    const rows = within(table).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      'TeamJoinedInvitedRoutine done',
      'FinanceLead: Sara12164%',
      'Tech9—In “Other teams”',
      'People Ops3—In “Other teams”',
      'Other teams (2)Grouped to protect privacy1240%',
      'No team41',
    ]);
    expect(screen.getByText('Some teams are grouped into “Other teams” to protect privacy.')).toBeInTheDocument();
    expect(screen.queryByText('Took part this week')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage teams' }));
    expect(setNav).toHaveBeenCalledWith('people', 'teams');
  });

  it('gives one line instead of a team breakdown when the backend suppresses it', async () => {
    const api = makeApi({ report: vi.fn(async () => ({ ...report, breakdown_suppressed: true, by_team: [] })) });
    render(<DashboardTeamsCard theme={T} lang="en" density="comfortable" api={api}/>);
    expect(await screen.findByText('Teams are grouped to protect privacy: too few people to show any team on its own.')).toBeInTheDocument();
    expect(screen.queryByText('Routine done')).not.toBeInTheDocument();
    expect(screen.queryByText(/Other teams/)).not.toBeInTheDocument();
  });

  it('adds this week’s team challenge, in Arabic, and works without a routine', async () => {
    const api = makeApi({
      report: vi.fn(async () => ({ has_routine: false, by_team: [] })),
      challenges: vi.fn(async () => [{ team_id: 't-fin', status: 'active', members: 12, participants: 8 }]),
    });
    render(<DashboardTeamsCard theme={T} lang="ar" density="comfortable" api={api}/>);
    const table = await screen.findByRole('table', { name: 'الفرق' });
    expect(within(table).getByText('شاركوا الأسبوع ده')).toBeInTheDocument();
    expect(within(table).getByText('٨')).toBeInTheDocument();
    expect(within(table).queryByText('الروتين اتعمل')).not.toBeInTheDocument();
  });

  it('invites HR to create teams when there are none, and survives a failed load', async () => {
    const setNav = vi.fn();
    const { unmount } = render(<DashboardTeamsCard theme={T} lang="en" density="comfortable" setNav={setNav}
      api={makeApi({ teams: vi.fn(async () => ({ teams: [], no_team: 10 })) })}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Create a team' }));
    expect(setNav).toHaveBeenCalledWith('people', 'teams');
    unmount();

    render(<DashboardTeamsCard theme={T} lang="en" density="comfortable" api={makeApi({ teams: vi.fn(async () => { throw new Error('x'); }) })}/>);
    expect(await screen.findByText('Teams couldn’t load right now.')).toBeInTheDocument();
  });
});
