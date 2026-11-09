import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({
  ...(await orig()),
  getMyPrefs: vi.fn(),
  setMyPrefs: vi.fn(),
}));

import { getMyPrefs, setMyPrefs } from '../../../lib/supabase-routines';
import { THEMES } from '../../design-system.jsx';
import { PrivacySettings } from '../privacy-settings.jsx';

const T = THEMES.brand;
const prefs = (extra = {}) => ({
  routine_reminders: false, muted_item_ids: [], recognition_opt_in: false, recognition_opt_in_at: null,
  share_with_hr: false, share_with_hr_at: null, consent_version: 'v1',
  company: { timezone: 'Africa/Cairo', workweek: [0, 1, 2, 3, 4], recognition: 'named', weekly_habit_enabled: true, hr_people_view: true },
  ...extra,
});
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

beforeEach(() => { vi.clearAllMocks(); });

describe('Me → Privacy', () => {
  it('two opt-ins, both off, each with one plain sentence; reminders are "coming soon"', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    render(<PrivacySettings theme={T} lang="en"/>);
    const board = await screen.findByRole('switch', { name: 'Show me on the company board' });
    const share = screen.getByRole('switch', { name: 'Share my routine progress with HR' });
    expect(board).toHaveAttribute('aria-checked', 'false');
    expect(share).toHaveAttribute('aria-checked', 'false');
    expect(board).toHaveAccessibleDescription(/never anything about your health/);
    expect(share).toHaveAccessibleDescription(/HR sees your name with the days you were active/);
    const reminders = screen.getByRole('switch', { name: /Reminders/ });
    expect(reminders).toBeDisabled();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    fireEvent.click(reminders);
    expect(setMyPrefs).not.toHaveBeenCalled();
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
    expect(screen.getByText('قريب')).toBeInTheDocument();
    expect(screen.getByText('الخصوصية')).toBeInTheDocument();
  });
});
