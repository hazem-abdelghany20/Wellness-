import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth,
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  })),
}));

const DEMO_EMAIL = 'amira.hassan@demo.wellhouse.test';

describe('signInOrUpWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signInWithPassword.mockResolvedValue({ data: { session: 'signed-in' }, error: null });
    auth.signUp.mockResolvedValue({ data: { session: 'signed-up' }, error: null });
  });

  it('signs seeded .test demo users in with the fixed demo password, ignoring what was typed', async () => {
    const { signInOrUpWithPassword } = await import('../supabase.ts');
    await signInOrUpWithPassword(DEMO_EMAIL, 'whatever-was-typed');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: DEMO_EMAIL,
      password: 'WellnessDemo!2026',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('never falls back to sign-up for a demo user, even when sign-in fails', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    const { signInOrUpWithPassword } = await import('../supabase.ts');

    await expect(signInOrUpWithPassword(DEMO_EMAIL, 'x')).rejects.toMatchObject({
      message: 'Invalid login credentials',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('normalises the email and signs a returning user in with their own password', async () => {
    const { signInOrUpWithPassword } = await import('../supabase.ts');
    const result = await signInOrUpWithPassword('  Real@Example.com ', 'hunter2');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'real@example.com', password: 'hunter2' });
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(result.data.session).toBe('signed-in');
  });

  it('signs a new user up when sign-in fails with invalid credentials, forwarding the company code', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    const { signInOrUpWithPassword } = await import('../supabase.ts');
    const result = await signInOrUpWithPassword('new@example.com', 'hunter2', { company_code: 'WH-4782' });

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'hunter2',
      options: { data: { company_code: 'WH-4782' } },
    });
    expect(result.data.session).toBe('signed-up');
  });

  it('surfaces non-credential sign-in errors immediately instead of creating an account', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Email rate limit exceeded' } });
    const { signInOrUpWithPassword } = await import('../supabase.ts');

    await expect(signInOrUpWithPassword('real@example.com', 'hunter2')).rejects.toMatchObject({
      message: 'Email rate limit exceeded',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('explains a wrong password when the email is already registered', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    auth.signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } });
    const { signInOrUpWithPassword } = await import('../supabase.ts');

    await expect(signInOrUpWithPassword('real@example.com', 'wrong')).rejects.toThrow(/Wrong password/);
  });

  it('fails loudly when sign-up returns no session (email confirmation still on)', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const { signInOrUpWithPassword } = await import('../supabase.ts');

    await expect(signInOrUpWithPassword('new@example.com', 'hunter2')).rejects.toThrow(/Confirm email/);
  });
});
