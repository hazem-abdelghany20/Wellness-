import { describe, it, expect } from 'vitest';
import { teamErrorText, inUseList, waitingByTeam, buildTeamCard } from '../teams.js';

describe('team errors', () => {
  it('names the team and the details the backend sends', () => {
    expect(teamErrorText({ message: 'team_not_empty', details: '12' }, 'en', 'Finance'))
      .toBe('“Finance” still has 12 people in it. Move them to “No team” first, or choose “Move them and delete”.');
    expect(teamErrorText({ message: 'team_in_use', details: 'routine,broadcast' }, 'en', 'Finance'))
      .toBe('“Finance” still has a routine and a scheduled message running. End or cancel it first, then delete the team.');
    expect(teamErrorText({ message: 'team_in_use', details: 'challenge' }, 'ar', 'المالية')).toMatch(/«المالية» \(تحدي\)/);
    expect(teamErrorText({ message: 'team_name_taken' }, 'en')).toBe('There’s already a team with that name.');
    expect(teamErrorText({ message: 'protected_role' }, 'en')).toMatch(/can’t be made team leads/);
    expect(teamErrorText({ message: 'person_has_no_team' }, 'ar')).toMatch(/حط الشخص ده في فريق/);
    expect(teamErrorText({ message: 'Failed to fetch' }, 'en')).toMatch(/Network problem/);
  });

  it('lists what still runs', () => {
    expect(inUseList('routine,challenge,broadcast', 'en')).toBe('a routine, a challenge and a scheduled message');
    expect(inUseList('', 'en')).toBe('');
    expect(inUseList('challenge,routine', 'ar')).toBe('تحدي وروتين');
  });
});

describe('dashboard team card', () => {
  const teams = [
    { id: 't-fin', name: 'Finance', department: 'Ops', members: 12, leads: [{ user_id: 'u1', display_name: 'Sara' }] },
    { id: 't-tech', name: 'Tech', department: null, members: 9, leads: [] },
    { id: 't-hr', name: 'People Ops', department: null, members: 3, leads: [] },
  ];
  const invites = [
    { team: 'Finance', status: 'pending' }, { team: 'finance ', status: 'expired' }, { team: 'Finance', status: 'joined' },
    { team: null, status: 'pending' },
  ];
  const report = {
    has_routine: true, min_cohort: 5, breakdown_suppressed: false, teams_folded: 1,
    by_team: [
      { team_id: 't-fin', small: false, members: 12, completion_pct: 64 },
      { team_id: null, small: true, teams: 2, members: 12, completion_pct: 40 },
    ],
  };

  it('joins teams, invites and the folded routine report', () => {
    expect(waitingByTeam(invites).get('finance')).toBe(2);
    const card = buildTeamCard({ teams, noTeam: 4, invites, report, challenges: [] });
    expect(card.rows.map((r) => [r.name, r.joined, r.invited, r.routine])).toEqual([
      ['Finance', 12, 2, { kind: 'pct', pct: 64 }],
      ['Tech', 9, 0, { kind: 'grouped' }],
      ['People Ops', 3, 0, { kind: 'grouped' }],
    ]);
    expect(card.rows[0].leads).toEqual(['Sara']);
    expect(card.other).toEqual({ teams: 2, members: 12, pct: 40 });
    expect(card).toMatchObject({ noTeam: 4, noTeamInvited: 1, foldedNote: true, breakdownSuppressed: false, showChallenge: false });
  });

  it('shows no team breakdown when the backend suppresses it', () => {
    const card = buildTeamCard({ teams, report: { ...report, breakdown_suppressed: true, by_team: [] } });
    expect(card.breakdownSuppressed).toBe(true);
    expect(card.other).toBe(null);
    expect(card.rows.every((r) => r.routine.kind === 'none')).toBe(true);
    expect(card.foldedNote).toBe(false);
  });

  it('has no routine column without a routine, and team challenges only at the floor', () => {
    const card = buildTeamCard({
      teams, report: { has_routine: false, by_team: [] },
      challenges: [
        { team_id: 't-fin', status: 'active', members: 12, participants: 8 },
        { team_id: 't-hr', status: 'active', members: 3, participants: 2 },
        { team_id: 't-tech', status: 'upcoming', members: 9, participants: 0 },
        { team_id: null, status: 'active', members: 40, participants: 20 },
      ],
    });
    expect(card.hasRoutine).toBe(false);
    expect(card.rows.map((r) => r.tookPart)).toEqual([8, null, null]);
    expect(card.showChallenge).toBe(true);
  });
});
