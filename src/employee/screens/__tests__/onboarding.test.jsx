import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { THEMES } from '../../design-system.jsx';
import { ScreenOTP, ScreenConsent, ScreenWelcome } from '../onboarding.jsx';

const verifyOtp = vi.fn();
const update = vi.fn();

vi.mock('../../state/auth-context.jsx', () => ({
  useAuth: () => ({
    verifyOtp,
    pendingEmail: 'amira.hassan@demo.wellhouse.test',
  }),
}));

vi.mock('../../hooks/use-profile.js', () => ({
  useProfile: () => ({
    profile: { display_name: 'Amira Hassan' },
    update,
  }),
}));

const t = (key, vars) => {
  const strings = {
    verifyTitle: "Verify it's you",
    verifySub: `We sent a verification code to ${vars?.dest}. Your employer never sees this.`,
    continue: 'Continue',
    resend: 'Resend code',
    consentTitle: 'Your data, your rules',
    consentBullet1: 'Your employer only sees aggregated, anonymised data.',
    consentBullet2: 'You can delete your account any time from Settings.',
    consentBullet3: 'Personal check-ins never leave your account.',
    iAgree: 'I understand',
    startApp: 'Start using Wellness+',
    welcome: 'Welcome, Amira',
    welcomeSub: 'Your plan is ready.',
  };
  return strings[key] ?? key;
};

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({});
  update.mockResolvedValue({});
});

describe('employee onboarding screens', () => {
  it('accepts an 8-digit OTP without overflowing into separate text inputs', async () => {
    const onNext = vi.fn();
    render(<ScreenOTP theme={THEMES.brand} t={t} dir="ltr" onNext={onNext} onBack={() => {}} />);

    const input = screen.getByLabelText('Verification code');
    expect(input).toHaveAttribute('maxLength', '8');

    fireEvent.change(input, { target: { value: '54028048' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith('54028048'));
    expect(onNext).toHaveBeenCalled();
  });

  it('saves consent using the remote profile column name', async () => {
    render(<ScreenConsent theme={THEMES.brand} t={t} dir="ltr" onNext={() => {}} onBack={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toHaveProperty('consented_at');
    expect(update.mock.calls[0][0]).not.toHaveProperty('consent_at');
  });

  it('marks onboarding complete using the remote profile flag', async () => {
    render(<ScreenWelcome theme={THEMES.brand} t={t} dir="ltr" onNext={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start using Wellness+' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ onboarded: true }));
  });
});
