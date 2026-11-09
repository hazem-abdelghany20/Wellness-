import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getSession: vi.fn(), getUser: vi.fn(), onAuthStateChange: vi.fn() },
    rpc, from: vi.fn(), storage: { from: vi.fn() }, functions: { invoke: vi.fn() },
  })),
}));

let lib;
beforeEach(async () => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  lib = await import('../supabase-teams.ts');
});

describe('team RPC wrappers', () => {
  const cases = [
    [(l) => l.listTeams(), 'hr_list_teams', undefined],
    [(l) => l.createTeam('Design'), 'hr_create_team', { p_name: 'Design', p_department: null }],
    [(l) => l.createTeam('Design', 'Product'), 'hr_create_team', { p_name: 'Design', p_department: 'Product' }],
    [(l) => l.renameTeam('t1', 'New'), 'hr_rename_team', { p_team_id: 't1', p_name: 'New', p_department: null }],
    [(l) => l.renameTeam('t1', null, ''), 'hr_rename_team', { p_team_id: 't1', p_name: null, p_department: '' }],
    [(l) => l.renameTeam('t1', 'X', null), 'hr_rename_team', { p_team_id: 't1', p_name: 'X', p_department: '' }],
    [(l) => l.renameTeam('t1', undefined, 'Ops'), 'hr_rename_team', { p_team_id: 't1', p_name: null, p_department: 'Ops' }],
    [(l) => l.deleteTeam('t1'), 'hr_delete_team', { p_team_id: 't1', p_move_members: false }],
    [(l) => l.deleteTeam('t1', { moveMembers: true }), 'hr_delete_team', { p_team_id: 't1', p_move_members: true }],
    [(l) => l.movePersonToTeam('u1', 't2'), 'hr_move_to_team', { p_user_ids: ['u1'], p_team_id: 't2' }],
    [(l) => l.movePersonToTeam('u1', null), 'hr_move_to_team', { p_user_ids: ['u1'], p_team_id: null }],
    [(l) => l.movePeopleToTeam(['u1', 'u2'], 't2'), 'hr_move_to_team', { p_user_ids: ['u1', 'u2'], p_team_id: 't2' }],
    [(l) => l.setTeamLead('u1'), 'hr_set_team_lead', { p_user_id: 'u1', p_lead: true }],
    [(l) => l.setTeamLead('u1', false), 'hr_set_team_lead', { p_user_id: 'u1', p_lead: false }],
  ];

  it.each(cases)('%#: calls the right RPC with the right arguments', async (call, name, args) => {
    rpc.mockResolvedValue({ data: { name }, error: null });
    const out = await call(lib);
    if (args === undefined) expect(rpc).toHaveBeenCalledWith(name);
    else expect(rpc).toHaveBeenCalledWith(name, args);
    expect(out).toEqual({ name });
  });

  it('listTeams never returns null', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await lib.listTeams()).toEqual({ teams: [], no_team: 0 });
  });

  it('throws the Supabase error as-is (message is the SQL code, details where given)', async () => {
    const notEmpty = { message: 'team_not_empty', details: '3', code: '23503' };
    rpc.mockResolvedValue({ data: null, error: notEmpty });
    await expect(lib.deleteTeam('t1')).rejects.toBe(notEmpty);
    const prot = { message: 'protected_role', code: '42501' };
    rpc.mockResolvedValue({ data: null, error: prot });
    await expect(lib.setTeamLead('hr1')).rejects.toBe(prot);
  });
});

describe('friendly copy for the team errors', () => {
  it('maps the new codes (before the generic permission / duplicate rules)', async () => {
    const { friendlyError, friendlyErrorI18n } = await import('../errors.ts');
    expect(friendlyError({ message: 'protected_role', code: '42501' }).message).toMatch(/HR and admin accounts/);
    expect(friendlyError({ message: 'team_name_taken', code: '23505' }).message).toMatch(/already a team/);
    expect(friendlyError({ message: 'team_not_empty' }).message).toMatch(/No team/);
    expect(friendlyError({ message: 'team_in_use' }).message).toMatch(/End it first/);
    expect(friendlyError({ message: 'person_has_no_team' }).message).toMatch(/in a team first/);
    expect(friendlyErrorI18n({ message: 'team_name_taken' }, 'ar')).toBe('فيه فريق بنفس الاسم ده.');
  });
});
