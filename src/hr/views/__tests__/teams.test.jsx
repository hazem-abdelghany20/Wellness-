import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const teamsLib = vi.hoisted(() => ({
  listTeams: vi.fn(), createTeam: vi.fn(), renameTeam: vi.fn(), deleteTeam: vi.fn(),
  movePeopleToTeam: vi.fn(), setTeamLead: vi.fn(),
}));
vi.mock('../../../lib/supabase-teams', () => teamsLib);
const peopleHook = vi.hoisted(() => ({ people: [], loading: false, error: null, refetch: vi.fn(async () => {}) }));
vi.mock('../../hooks/use-people.js', () => ({ usePeople: () => peopleHook }));
vi.mock('../../state/auth-context.jsx', () => ({ useHRAuth: () => ({ company: { name: 'Nile' } }) }));

import { HRPeoplePage } from '../people.jsx';
import { TeamsPanel } from '../teams.jsx';
import { HR_THEMES, HR_STRINGS } from '../../../shared/tokens.jsx';


// Render-heavy screens: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20000 });
const T = HR_THEMES.light;
const teams = [
  { id: 't-fin', name: 'Finance', department: 'Ops', members: 12, leads: [{ user_id: 'u9', display_name: 'Sara', initials: 'S' }] },
  { id: 't-tech', name: 'Tech', department: null, members: 0, leads: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  teamsLib.listTeams.mockResolvedValue({ teams, no_team: 4 });
  teamsLib.createTeam.mockResolvedValue({ id: 't-new', name: 'Design' });
  teamsLib.renameTeam.mockResolvedValue({ id: 't-fin' });
  teamsLib.deleteTeam.mockResolvedValue({ deleted: true, moved: 12, leads_unset: 1 });
  teamsLib.movePeopleToTeam.mockResolvedValue({ team_id: 't-fin', moved: 2, user_ids: [] });
  teamsLib.setTeamLead.mockResolvedValue({ lead: true });
  peopleHook.people = [
    { id: 'u1', display_name: 'Amira Hassan', role: 'employee', team_id: null, teams: null },
    { id: 'u2', display_name: 'Omar Said', role: 'employee', team_id: 't-tech', teams: { name: 'Tech', department: null } },
    { id: 'u3', display_name: 'Sara Ali', role: 'manager', team_id: 't-fin', teams: { name: 'Finance', department: 'Ops' } },
    { id: 'u4', display_name: 'Hana HR', role: 'hr_admin', team_id: null, teams: null },
  ];
});

describe('Teams panel', () => {
  const renderPanel = (props = {}) => {
    const onChanged = vi.fn(async () => {});
    render(<TeamsPanel theme={T} lang="en" density="comfortable" teams={teams} noTeam={4} onChanged={onChanged} api={teamsLib} {...props}/>);
    return onChanged;
  };

  it('lists teams with people, leads and the no-team count, and creates a team', async () => {
    const onChanged = renderPanel();
    const fin = screen.getByRole('listitem', { name: 'Finance' });
    expect(within(fin).getByText('12 people')).toBeInTheDocument();
    expect(within(fin).getByText(/Lead: Sara/)).toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'Tech' })).getByText('No lead yet')).toBeInTheDocument();
    expect(screen.getByText('4 people')).toBeInTheDocument();
    expect(screen.getByText(/sees their lead features in the app within an hour/)).toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText('Team name')[0], { target: { value: '  Design ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    await waitFor(() => expect(teamsLib.createTeam).toHaveBeenCalledWith('Design', null));
    expect(onChanged).toHaveBeenCalled();
    expect(await screen.findByText(/Team “Design” created/)).toBeInTheDocument();
  });

  it('renames a team and its department', async () => {
    renderPanel();
    const fin = screen.getByRole('listitem', { name: 'Finance' });
    fireEvent.click(within(fin).getByRole('button', { name: 'Rename' }));
    fireEvent.change(within(fin).getByLabelText('Team name'), { target: { value: 'Money' } });
    fireEvent.change(within(fin).getByLabelText('Department'), { target: { value: '' } });
    fireEvent.click(within(fin).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(teamsLib.renameTeam).toHaveBeenCalledWith('t-fin', 'Money', ''));
  });

  it('deletes an empty team, and moves people out first when asked', async () => {
    renderPanel();
    const tech = screen.getByRole('listitem', { name: 'Tech' });
    fireEvent.click(within(tech).getByRole('button', { name: 'Delete' }));
    expect(within(tech).getByText('Delete “Tech”?')).toBeInTheDocument();
    teamsLib.deleteTeam.mockResolvedValueOnce({ deleted: true, moved: 0 });
    fireEvent.click(within(tech).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(teamsLib.deleteTeam).toHaveBeenCalledWith('t-tech', { moveMembers: false }));

    const fin = screen.getByRole('listitem', { name: 'Finance' });
    fireEvent.click(within(fin).getByRole('button', { name: 'Delete' }));
    expect(within(fin).getByText('“Finance” has 12 people. Move them to “No team” and delete the team?')).toBeInTheDocument();
    fireEvent.click(within(fin).getByRole('button', { name: 'Move them and delete' }));
    await waitFor(() => expect(teamsLib.deleteTeam).toHaveBeenCalledWith('t-fin', { moveMembers: true }));
    expect(await screen.findByText('“Finance” deleted. 12 people are now in “No team”.')).toBeInTheDocument();
  });

  it('explains team_in_use and team_not_empty', async () => {
    renderPanel();
    const fin = screen.getByRole('listitem', { name: 'Finance' });
    teamsLib.deleteTeam.mockRejectedValueOnce({ message: 'team_in_use', details: 'routine,challenge' });
    fireEvent.click(within(fin).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(fin).getByRole('button', { name: 'Move them and delete' }));
    expect(await within(fin).findByRole('alert')).toHaveTextContent('“Finance” still has a routine and a challenge running. End or cancel it first, then delete the team.');

    const tech = screen.getByRole('listitem', { name: 'Tech' });
    teamsLib.deleteTeam.mockRejectedValueOnce({ message: 'team_not_empty', details: '3' });
    fireEvent.click(within(tech).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(tech).getByRole('button', { name: 'Delete' }));
    expect(await within(tech).findByRole('alert')).toHaveTextContent('“Tech” still has 3 people in it.');
    // The question turns into the move offer.
    expect(within(tech).getByRole('button', { name: 'Move them and delete' })).toBeInTheDocument();
  });

  it('shows a taken name in Arabic', async () => {
    teamsLib.createTeam.mockRejectedValueOnce({ message: 'team_name_taken' });
    render(<TeamsPanel theme={T} lang="ar" density="comfortable" teams={teams} noTeam={0} api={teamsLib}/>);
    fireEvent.change(screen.getAllByLabelText('اسم الفريق')[0], { target: { value: 'Finance' } });
    fireEvent.click(screen.getByRole('button', { name: 'اعمل فريق' }));
    expect(await screen.findByText('فيه فريق بنفس الاسم ده.')).toBeInTheDocument();
  });
});

describe('People: move to a team and team leads', () => {
  const renderPage = (props = {}) => render(<HRPeoplePage theme={T} S={HR_STRINGS.en} lang="en" density="comfortable" {...props}/>);

  it('moves several people at once', async () => {
    renderPage();
    await waitFor(() => expect(teamsLib.listTeams).toHaveBeenCalled());
    expect(await screen.findByRole('tab', { name: 'Teams · 2' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select Amira Hassan'));
    fireEvent.click(screen.getByLabelText('Select Omar Said'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Move the selected people to'), { target: { value: 't-fin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move 2' }));
    await waitFor(() => expect(teamsLib.movePeopleToTeam).toHaveBeenCalledWith(['u1', 'u2'], 't-fin'));
    expect(await screen.findByText('Moved 2 people to Finance.')).toBeInTheDocument();
    expect(peopleHook.refetch).toHaveBeenCalled();
  });

  it('moves one person from their row, including to "No team"', async () => {
    renderPage();
    await screen.findByRole('tab', { name: 'Teams · 2' });
    fireEvent.change(screen.getByLabelText('Team for Omar Said'), { target: { value: '' } });
    await waitFor(() => expect(teamsLib.movePeopleToTeam).toHaveBeenCalledWith(['u2'], null));
    expect(await screen.findByText('Omar Said is now in “No team”.')).toBeInTheDocument();
  });

  it('makes and removes team leads; HR accounts and people without a team can’t be leads', async () => {
    renderPage();
    await screen.findByRole('tab', { name: 'Teams · 2' });
    const buttons = screen.getAllByRole('button', { name: 'Make team lead' });
    expect(buttons).toHaveLength(2); // Amira (no team, disabled) + Omar
    expect(buttons[0]).toBeDisabled();
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(teamsLib.setTeamLead).toHaveBeenCalledWith('u2', true));
    expect(await screen.findByText(/Omar Said is now the lead of Tech\. A new team lead sees their lead features in the app within an hour\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove lead' }));
    await waitFor(() => expect(teamsLib.setTeamLead).toHaveBeenCalledWith('u3', false));
    expect(screen.getAllByText('Team lead').length).toBeGreaterThan(0);

    teamsLib.setTeamLead.mockRejectedValueOnce({ message: 'protected_role' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Make team lead' })[1]);
    expect(await screen.findByText('HR and admin accounts can’t be made team leads.')).toBeInTheDocument();
  });

  it('opens on the Teams tab when asked (dashboard → Manage teams), in Arabic', async () => {
    render(<HRPeoplePage theme={T} S={HR_STRINGS.ar} lang="ar" density="comfortable" initialTab="teams"/>);
    expect(await screen.findByRole('tab', { name: 'الفرق · ٢' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('listitem', { name: 'Finance' })).toBeInTheDocument();
    expect(screen.getByText(/القائد: Sara/)).toBeInTheDocument();
  });
});
