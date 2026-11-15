import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// The employee app, signed in and onboarded, in a company that shows everyone.
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
  resolveMyCompanyId: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  subscribeToNotifications: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));
vi.mock('../../lib/supabase-routines', async (orig) => ({
  ...(await orig()),
  getMyToday: vi.fn(),
  checkRoutineItem: vi.fn(),
  setItemMuted: vi.fn(),
  getMyRoutineWeek: vi.fn(),
  getRecognitionBoard: vi.fn(),
  resolveMedia: vi.fn(),
  getMediaUrl: vi.fn(),
  getMyPrefs: vi.fn(),
  setMyPrefs: vi.fn(),
}));
vi.mock('../../lib/supabase-broadcasts', () => ({
  getBroadcastMedia: vi.fn(),
  getBroadcastAudioUrl: vi.fn(),
}));
vi.mock('../../lib/push', () => ({
  getPushState: vi.fn(),
  enableRoutineReminders: vi.fn(),
  disableRoutineReminders: vi.fn(),
  refreshPushSubscription: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { id: 'u1', email: 'sara@acme.test', user_metadata: { tours_seen: { employee: '2026-11-01' } } } }));
vi.mock('../state/auth-context.jsx', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    session: { user: auth.user }, profile: { id: 'u1', onboarded: true, display_name: 'Sara', streak_current: 0 },
    loading: false, profileLoaded: true, joining: false, company: { name: 'Acme' }, signOut: vi.fn(),
  }),
}));

import { getNotifications } from '../../lib/supabase';
import { getMyToday, getRecognitionBoard, getMediaUrl, resolveMedia, getMyPrefs, setMyPrefs } from '../../lib/supabase-routines';
import { getPushState, refreshPushSubscription } from '../../lib/push';
import { makeToday } from '../test-fixtures/routine.js';
import App from '../App.jsx';

const prefs = (extra = {}, company = {}) => ({
  routine_reminders: false, muted_item_ids: [], recognition_opt_in: false, share_with_hr: false,
  visibility_notice_seen_at: null, consent_version: 'v1',
  company: { timezone: 'Africa/Cairo', recognition: 'named', hr_people_view: true, everyone_visible: true, ...company },
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth.user = { id: 'u1', email: 'sara@acme.test', user_metadata: { tours_seen: { employee: '2026-11-01' } } };
  getMyToday.mockResolvedValue(makeToday());
  getRecognitionBoard.mockResolvedValue({ enabled: false, mode: 'off', teams: [], named: null, me: { opted_in: false, items_done: 0, streak: 0 } });
  getMediaUrl.mockResolvedValue(null);
  resolveMedia.mockResolvedValue(null);
  getNotifications.mockResolvedValue([]);
  getPushState.mockResolvedValue({ state: 'unsupported', permission: 'unsupported', endpoint: null, support: { supported: false, reason: 'no_service_worker' } });
  refreshPushSubscription.mockResolvedValue(null);
});
afterEach(() => { window.history.replaceState(null, '', '/'); });

describe('Employee app → "your company shows everyone" notice', () => {
  it('shows once after sign-in, and OK saves that it was seen', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    setMyPrefs.mockResolvedValue(prefs({ visibility_notice_seen_at: '2026-11-15T09:00:00Z' }));
    render(<App/>);
    await screen.findByTestId('screen-today', {}, { timeout: 3000 });
    const sheet = await screen.findByRole('dialog', { name: 'Your company shows everyone' });
    expect(sheet).toHaveTextContent('Never anything about your health.');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog', { name: 'Your company shows everyone' })).toBeNull();
    expect(setMyPrefs).toHaveBeenCalledWith({ visibility_notice_seen: true });
    // Moving around the app does not bring it back.
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    await act(async () => {});
    expect(screen.queryByRole('dialog', { name: 'Your company shows everyone' })).toBeNull();
    expect(setMyPrefs).toHaveBeenCalledTimes(1);
  });

  it('a failed save never blocks the app', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    setMyPrefs.mockRejectedValue(new Error('Failed to fetch'));
    render(<App/>);
    await screen.findByRole('dialog', { name: 'Your company shows everyone' }, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('screen-today')).toBeInTheDocument();
  });

  it('nothing to show when it was seen before, or the company keeps the opt-ins', async () => {
    getMyPrefs.mockResolvedValue(prefs({ visibility_notice_seen_at: '2026-11-14T09:00:00Z' }));
    const first = render(<App/>);
    await screen.findByTestId('screen-today', {}, { timeout: 3000 });
    await waitFor(() => expect(getMyPrefs).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    first.unmount();

    getMyPrefs.mockResolvedValue(prefs({}, { everyone_visible: false }));
    render(<App/>);
    await screen.findByTestId('screen-today', {}, { timeout: 3000 });
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(setMyPrefs).not.toHaveBeenCalled();
  });

  it('the first-time tour waits for the notice', async () => {
    auth.user = { id: 'u2', email: 'new@acme.test', user_metadata: {} };
    getMyPrefs.mockResolvedValue(prefs());
    setMyPrefs.mockResolvedValue(prefs({ visibility_notice_seen_at: '2026-11-15T09:00:00Z' }));
    render(<App/>);
    await screen.findByRole('dialog', { name: 'Your company shows everyone' }, { timeout: 3000 });
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    expect(screen.getAllByRole('dialog')).toHaveLength(1); // only the notice so far
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0), { timeout: 3000 });
    expect(screen.queryByRole('dialog', { name: 'Your company shows everyone' })).toBeNull();
  });
});
