import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = {
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  verifyOtp: vi.fn(),
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

describe('Supabase auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    auth.signInWithPassword.mockResolvedValue({ data: { session: 'demo' }, error: null });
    auth.verifyOtp.mockResolvedValue({ data: { session: 'otp' }, error: null });
  });

  it('does not send Supabase OTP for seeded .test demo users', async () => {
    const { signInWithOtp } = await import('../supabase.ts');
    const result = await signInWithOtp('amira.hassan@demo.wellhouse.test');

    expect(result.error).toBeNull();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('accepts any six-digit demo code by signing in with the seeded demo password', async () => {
    const { verifyOtp } = await import('../supabase.ts');
    await verifyOtp('amira.hassan@demo.wellhouse.test', '123456');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'amira.hassan@demo.wellhouse.test',
      password: 'WellnessDemo!2026',
    });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('continues to use Supabase OTP for non-demo users', async () => {
    const { signInWithOtp, verifyOtp } = await import('../supabase.ts');
    await signInWithOtp('real@example.com');
    await verifyOtp('real@example.com', '123456');

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'real@example.com',
      options: { shouldCreateUser: true },
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'real@example.com',
      token: '123456',
      type: 'email',
    });
  });
});
