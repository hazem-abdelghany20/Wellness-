import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({
  ...(await orig()),
  getMyPrefs: vi.fn(),
  setMyPrefs: vi.fn(),
}));
vi.mock('../../../lib/push', () => ({
  getPushState: vi.fn(),
  enableRoutineReminders: vi.fn(),
  disableRoutineReminders: vi.fn(),
}));

import { getMyPrefs, setMyPrefs } from '../../../lib/supabase-routines';
import { getPushState, enableRoutineReminders } from '../../../lib/push';
import { THEMES } from '../../design-system.jsx';
import { PrivacySettings, PRIVACY_POLICY_URL } from '../privacy-settings.jsx';

const T = THEMES.brand;
const prefs = (extra = {}) => ({
  routine_reminders: false, muted_item_ids: [], recognition_opt_in: false, recognition_opt_in_at: null,
  share_with_hr: false, share_with_hr_at: null, consent_version: 'v1',
  company: { timezone: 'Africa/Cairo', workweek: [0, 1, 2, 3, 4], recognition: 'named', weekly_habit_enabled: true, hr_people_view: true },
  ...extra,
});
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

const pushState = (state) => ({ state, permission: 'default', endpoint: null, support: { supported: true, reason: null, ios: false, standalone: false } });

beforeEach(() => {
  vi.clearAllMocks();
  getPushState.mockResolvedValue(pushState('prompt'));
});

describe('Me → Privacy', () => {
  it('two opt-ins, both off, each with one plain sentence; a working reminders switch', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    render(<PrivacySettings theme={T} lang="en"/>);
    const board = await screen.findByRole('switch', { name: 'Show me on the company board' });
    const share = screen.getByRole('switch', { name: 'Share my routine progress with HR' });
    expect(board).toHaveAttribute('aria-checked', 'false');
    expect(share).toHaveAttribute('aria-checked', 'false');
    expect(board).toHaveAccessibleDescription(/never anything about your health/);
    expect(share).toHaveAccessibleDescription(/HR sees your name with the days you were active/);
    const reminders = await screen.findByRole('switch', { name: 'Reminders' });
    expect(reminders).not.toBeDisabled();
    expect(reminders).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByText('Coming soon')).toBeNull();
    // The switch goes through push.ts (asks permission on the tap), not a bare prefs write.
    enableRoutineReminders.mockResolvedValue(prefs({ routine_reminders: true }));
    getPushState.mockResolvedValue(pushState('subscribed'));
    fireEvent.click(reminders);
    expect(enableRoutineReminders).toHaveBeenCalledWith({ lang: 'en' });
    expect(setMyPrefs).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Reminders' })).toHaveAttribute('aria-checked', 'true'));
    // The opt-ins are untouched.
    expect(screen.getByRole('switch', { name: 'Show me on the company board' })).toHaveAttribute('aria-checked', 'false');
  });

  it('flips at once and saves the opt-in', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    const d = deferred();
    setMyPrefs.mockReturnValue(d.promise);
    render(<PrivacySettings theme={T} lang="en"/>);
    const board = await screen.findByRole('switch', { name: 'Show me on the company board' });
    fireEvent.click(board);
    expect(board).toHaveAttribute('aria-checked', 'true');
    expect(setMyPrefs).toHaveBeenCalledWith({ recognition_opt_in: true });
    await act(async () => { d.resolve(prefs({ recognition_opt_in: true, consent_version: 'v2' })); });
    expect(screen.getByRole('switch', { name: 'Show me on the company board' })).toHaveAttribute('aria-checked', 'true');
  });

  it('rolls back and says so when saving fails', async () => {
    getMyPrefs.mockResolvedValue(prefs({ share_with_hr: true }));
    setMyPrefs.mockRejectedValue(new Error('Failed to fetch'));
    render(<PrivacySettings theme={T} lang="en"/>);
    const share = await screen.findByRole('switch', { name: 'Share my routine progress with HR' });
    expect(share).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(share);
    await waitFor(() => expect(setMyPrefs).toHaveBeenCalledWith({ share_with_hr: false }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Share my routine progress with HR' })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  });

  it('says when the company has the board or the HR view off', async () => {
    getMyPrefs.mockResolvedValue(prefs({ company: { recognition: 'off', hr_people_view: false } }));
    render(<PrivacySettings theme={T} lang="en"/>);
    expect(await screen.findByText(/hasn’t turned the board on/)).toBeInTheDocument();
    expect(screen.getByText(/HR sees nothing by name for now/)).toBeInTheDocument();
  });

  it('Arabic labels', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    render(<PrivacySettings theme={T} lang="ar"/>);
    expect(await screen.findByRole('switch', { name: 'اظهرني في لوحة الشركة' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'شارك تقدّمي في الروتين مع الـ HR' })).toBeInTheDocument();
    expect(await screen.findByRole('switch', { name: 'التذكيرات' })).toBeInTheDocument();
    expect(screen.getByText('الخصوصية')).toBeInTheDocument();
  });

  it('links to the public privacy policy, even when the choices fail to load (App Store 5.1.1(i))', async () => {
    getMyPrefs.mockRejectedValue(new Error('Failed to fetch'));
    render(<PrivacySettings theme={T} lang="en"/>);
    const link = await screen.findByRole('link', { name: 'Privacy policy' });
    expect(link).toHaveAttribute('href', PRIVACY_POLICY_URL);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('privacy policy link in Arabic', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    render(<PrivacySettings theme={T} lang="ar"/>);
    expect(await screen.findByRole('link', { name: 'سياسة الخصوصية' })).toHaveAttribute('href', PRIVACY_POLICY_URL);
  });
});
