import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { THEMES } from '../../design-system.jsx';
import { ScreenJoin } from '../onboarding.jsx';

const signInWithCode = vi.fn();

vi.mock('../../state/auth-context.jsx', () => ({
  useAuth: () => ({ signInWithCode }),
}));
vi.mock('../../hooks/use-profile.js', () => ({
  useProfile: () => ({ profile: null, update: vi.fn() }),
}));

const t = (key, vars) => (vars?.email ? `${key}:${vars.email}` : key);

function renderAt(search) {
  window.history.replaceState(null, '', `/${search}`);
  return render(<ScreenJoin theme={THEMES.brand} t={t} dir="ltr" onNext={() => {}}/>);
}

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'Lina@Acme.com' } });
  fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: 'secret1' } });
  fireEvent.click(screen.getByRole('button', { name: 'continue' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  signInWithCode.mockResolvedValue(null);
});
afterEach(() => window.history.replaceState(null, '', '/'));

describe('ScreenJoin', () => {
  it('starts with an empty company code (no hard-coded demo code)', () => {
    renderAt('');
    expect(screen.getByLabelText('companyCode')).toHaveValue('');
  });

  it('fills the code from ?code= and signs in with it', async () => {
    renderAt('?code=ab-1234');
    expect(screen.getByLabelText('companyCode')).toHaveValue('AB-1234');
    fillAndSubmit();
    await waitFor(() => expect(signInWithCode).toHaveBeenCalledWith('AB-1234', 'Lina@Acme.com', 'secret1', ''));
    expect(window.location.search).toBe('');
  });

  it('with ?invite= shows the invite notice, hides the code and passes the token', async () => {
    renderAt('?invite=0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c');
    expect(screen.getByRole('status')).toHaveTextContent('inviteNotice');
    expect(screen.queryByLabelText('companyCode')).toBeNull();
    fillAndSubmit();
    await waitFor(() => expect(signInWithCode).toHaveBeenCalledWith('', 'Lina@Acme.com', 'secret1', '0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c'));
  });

  it('signs in with just an email when no code is typed', async () => {
    renderAt('');
    fillAndSubmit();
    await waitFor(() => expect(signInWithCode).toHaveBeenCalledWith('', 'Lina@Acme.com', 'secret1', ''));
  });

  it('explains when no invite exists for the email', async () => {
    signInWithCode.mockRejectedValue(Object.assign(new Error('no_invite'), { code: 'no_invite' }));
    renderAt('');
    fillAndSubmit();
    expect(await screen.findByText('noInviteFound:lina@acme.com')).toBeInTheDocument();
  });

  it('translates an invalid company code', async () => {
    signInWithCode.mockRejectedValue(new Error('Invalid company code'));
    renderAt('?code=XX-0000');
    fillAndSubmit();
    expect(await screen.findByText('invalidCompanyCode')).toBeInTheDocument();
  });
});
