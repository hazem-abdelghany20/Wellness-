import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
};
const rpc = vi.fn();
const invoke = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth,
    from: vi.fn(),
    rpc,
    functions: { invoke },
  })),
}));

const invalidCreds = { data: {}, error: { message: 'Invalid login credentials' } };

beforeEach(() => {
  vi.clearAllMocks();
  auth.signInWithPassword.mockResolvedValue({ data: { session: 's' }, error: null });
  auth.signUp.mockResolvedValue({ data: { session: 'new' }, error: null });
  auth.signOut.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: { placed: true, via: 'existing' }, error: null });
  invoke.mockResolvedValue({ data: { valid: true, company: { id: 'c1', name: 'Acme', slug: 'acme' } }, error: null });
});

describe('importPeople / listPeopleInvites', () => {
  it('sends every row with defaults for blank team / role', async () => {
    rpc.mockResolvedValue({ data: { invited: 2, updated: 0, teams_created: 1, new_teams: ['Ops'], skipped: [] }, error: null });
    const { importPeople } = await import('../supabase-invites.ts');
    const summary = await importPeople('c1', [
      { row: 2, name: 'يوسف نجيب', email: 'y@acme.com', team: 'Ops', role: 'manager' },
      { row: 3, email: 'hr@acme.com', role: 'hr_admin' },
    ]);
    expect(rpc).toHaveBeenCalledWith('import_people', {
      p_company_id: 'c1',
      p_rows: [
        { row: 2, name: 'يوسف نجيب', email: 'y@acme.com', team: 'Ops', role: 'manager' },
        { row: 3, name: '', email: 'hr@acme.com', team: '', role: 'hr_admin' },
      ],
    });
    expect(summary.invited).toBe(2);
  });

  it('surfaces RPC errors and refuses a missing company', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not_authorized', code: '42501' } });
    const { importPeople } = await import('../supabase-invites.ts');
    await expect(importPeople('c1', [{ email: 'a@acme.com' }])).rejects.toMatchObject({ message: 'not_authorized' });
    await expect(importPeople('', [])).rejects.toThrow('no_company');
  });

  it('lists invites for a company', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { listPeopleInvites } = await import('../supabase-invites.ts');
    expect(await listPeopleInvites('c1')).toEqual([]);
    expect(rpc).toHaveBeenCalledWith('list_people_invites', { p_company_id: 'c1' });
  });
});

describe('joinCompanyForMe', () => {
  it('upper-cases the code and passes the token', async () => {
    const { joinCompanyForMe } = await import('../supabase-invites.ts');
    await joinCompanyForMe({ code: ' ab-1234 ', inviteToken: ' tok ' });
    expect(rpc).toHaveBeenCalledWith('join_company_for_me', { p_company_code: 'AB-1234', p_invite_token: 'tok' });
  });

  it('reports "unavailable" when the migration is not applied yet', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.join_company_for_me' } });
    const { joinCompanyForMe } = await import('../supabase-invites.ts');
    expect(await joinCompanyForMe()).toEqual({ placed: null, unavailable: true });
  });
});

describe('employeeJoin', () => {
  it('invite link: no code check, token goes into the sign-up metadata', async () => {
    auth.signInWithPassword.mockResolvedValue(invalidCreds);
    rpc.mockResolvedValue({ data: { placed: true, via: 'invite_token', role: 'employee' }, error: null });
    const { employeeJoin } = await import('../supabase-invites.ts');
    const res = await employeeJoin({ email: 'Y@Acme.com', password: 'secret1', inviteToken: 'tok123tok123' });
    expect(invoke).not.toHaveBeenCalled();
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'y@acme.com', password: 'secret1', options: { data: { invite_token: 'tok123tok123' } },
    });
    expect(rpc).toHaveBeenCalledWith('join_company_for_me', { p_company_code: null, p_invite_token: 'tok123tok123' });
    expect(res.placement.via).toBe('invite_token');
  });

  it('company code: checked first, then forwarded', async () => {
    auth.signInWithPassword.mockResolvedValue(invalidCreds);
    const { employeeJoin } = await import('../supabase-invites.ts');
    const res = await employeeJoin({ email: 'new@acme.com', password: 'secret1', code: 'ab-1234' });
    expect(invoke).toHaveBeenCalledWith('verify-company-code', { body: { code: 'AB-1234', email: 'new@acme.com' } });
    expect(auth.signUp.mock.calls[0][0].options).toEqual({ data: { company_code: 'AB-1234' } });
    expect(res.company).toMatchObject({ name: 'Acme' });
  });

  it('invalid code: stops before creating an account', async () => {
    invoke.mockResolvedValue({ data: { valid: false, error: 'Invalid company code' }, error: null });
    const { employeeJoin } = await import('../supabase-invites.ts');
    await expect(employeeJoin({ email: 'a@acme.com', password: 'secret1', code: 'NOPE-1' })).rejects.toThrow('Invalid company code');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('no code: an imported email signs up and is placed', async () => {
    auth.signInWithPassword.mockResolvedValue(invalidCreds);
    rpc.mockResolvedValue({ data: { placed: true, via: 'invite_email' }, error: null });
    const { employeeJoin } = await import('../supabase-invites.ts');
    const res = await employeeJoin({ email: 'lina@acme.com', password: 'secret1' });
    expect(invoke).not.toHaveBeenCalled();
    expect(res.placement.via).toBe('invite_email');
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('no code and no invite: signs out again and throws no_invite', async () => {
    rpc.mockResolvedValue({ data: { placed: false }, error: null });
    const { employeeJoin } = await import('../supabase-invites.ts');
    await expect(employeeJoin({ email: 'Stranger@x.com', password: 'secret1' }))
      .rejects.toMatchObject({ code: 'no_invite', email: 'stranger@x.com' });
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('a failing placement call does not turn a good sign-in into an error', async () => {
    rpc.mockRejectedValue(new Error('network'));
    const { employeeJoin } = await import('../supabase-invites.ts');
    const res = await employeeJoin({ email: 'a@acme.com', password: 'secret1' });
    expect(res.placement).toEqual({ placed: null });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe('hrJoin', () => {
  it('passes the HR invite token on sign-up', async () => {
    auth.signInWithPassword.mockResolvedValue(invalidCreds);
    rpc.mockResolvedValue({ data: { placed: true, via: 'invite_token', role: 'hr_admin' }, error: null });
    const { hrJoin } = await import('../supabase-invites.ts');
    const res = await hrJoin({ email: 'omar@acme.com', password: 'secret1', inviteToken: 'tok123tok123' });
    expect(auth.signUp.mock.calls[0][0].options).toEqual({ data: { invite_token: 'tok123tok123' } });
    expect(res.role).toBe('hr_admin');
  });

  it('plain sign-in sends no metadata', async () => {
    const { hrJoin } = await import('../supabase-invites.ts');
    await hrJoin({ email: 'hr@acme.com', password: 'secret1' });
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('join_company_for_me', { p_company_code: null, p_invite_token: null });
  });
});

describe('inviteCompanyAdmin', () => {
  it('returns the invite (token) instead of nothing, name only when given', async () => {
    rpc.mockResolvedValue({ data: { status: 'invited', email: 'boss@beta.com', token: 'tok', role: 'hr_admin', company_id: 'c2' }, error: null });
    const { inviteCompanyAdmin } = await import('../supabase-admin.ts');
    const res = await inviteCompanyAdmin('c2', 'boss@beta.com');
    expect(rpc).toHaveBeenCalledWith('admin_invite_company_admin', { p_company_id: 'c2', p_email: 'boss@beta.com' });
    expect(res.token).toBe('tok');
    await inviteCompanyAdmin('c2', 'boss@beta.com', ' Bassem ');
    expect(rpc).toHaveBeenLastCalledWith('admin_invite_company_admin', { p_company_id: 'c2', p_email: 'boss@beta.com', p_name: 'Bassem' });
  });

  it('creates tenants in Africa/Cairo by default', async () => {
    rpc.mockResolvedValue({ data: { id: 'c3' }, error: null });
    const { createTenant } = await import('../supabase-admin.ts');
    await createTenant({ name: 'Nile' });
    expect(rpc).toHaveBeenCalledWith('admin_create_tenant', expect.objectContaining({ p_timezone: 'Africa/Cairo' }));
  });
});
