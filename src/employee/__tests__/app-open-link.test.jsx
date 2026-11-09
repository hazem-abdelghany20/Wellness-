import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// The employee app, signed in and onboarded, opened from a notification.
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
const user = { id: 'u1', email: 'sara@acme.test', user_metadata: { tours_seen: { employee: '2026-11-01' } } };
vi.mock('../state/auth-context.jsx', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    session: { user }, profile: { id: 'u1', onboarded: true, display_name: 'Sara', streak_current: 0 },
    loading: false, profileLoaded: true, joining: false, company: { name: 'Acme' }, signOut: vi.fn(),
  }),
}));

import { getNotifications, markNotificationRead } from '../../lib/supabase';
import { getMyToday, getRecognitionBoard, getMediaUrl, resolveMedia } from '../../lib/supabase-routines';
import { getBroadcastMedia } from '../../lib/supabase-broadcasts';
import { getPushState, refreshPushSubscription } from '../../lib/push';
import { makeToday } from '../test-fixtures/routine.js';
import App from '../App.jsx';

let sw;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sw = new EventTarget();
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
  Element.prototype.scrollIntoView = vi.fn();
  getMyToday.mockResolvedValue(makeToday());
  getRecognitionBoard.mockResolvedValue({ enabled: false, mode: 'off', teams: [], named: null, me: { opted_in: false, items_done: 0, streak: 0 } });
  getMediaUrl.mockResolvedValue(null);
  resolveMedia.mockResolvedValue(null);
  getNotifications.mockResolvedValue([
    { id: 'n1', kind: 'system', broadcast_id: 'b1', title_en: 'Office closed Thursday', body_en: 'Enjoy the long weekend.', read: false, created_at: new Date().toISOString() },
  ]);
  markNotificationRead.mockResolvedValue();
  getBroadcastMedia.mockResolvedValue([]);
  getPushState.mockResolvedValue({ state: 'unsupported', permission: 'unsupported', endpoint: null, support: { supported: false, reason: 'no_service_worker' } });
  refreshPushSubscription.mockResolvedValue(null);
});
afterEach(() => {
  delete navigator.serviceWorker;
  delete Element.prototype.scrollIntoView;
  window.history.replaceState(null, '', '/');
});

describe('Employee app → open from a notification', () => {
  it('a reminder opens Today on that item, and the address bar is cleaned', async () => {
    window.history.replaceState(null, '', '/?open=today&item=i2');
    render(<App/>);
    expect(await screen.findByRole('dialog', { name: 'Neck release' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('screen-today')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('a broadcast opens Notifications on that message', async () => {
    window.history.replaceState(null, '', '/?open=notifs&broadcast=b1');
    const { container } = render(<App/>);
    await screen.findByText('Office closed Thursday', {}, { timeout: 3000 });
    await waitFor(() => expect(container.querySelector('[aria-current="true"]')).toHaveAttribute('data-notif-id', 'n1'));
    expect(markNotificationRead).toHaveBeenCalledWith('n1');
    expect(window.location.search).toBe('');
  });

  it('OPEN_URL from the service worker switches screens while the app is open', async () => {
    render(<App/>);
    await screen.findByTestId('screen-today', {}, { timeout: 3000 });
    act(() => { sw.dispatchEvent(new MessageEvent('message', { data: { type: 'OPEN_URL', url: '/?open=notifs&broadcast=b1' } })); });
    expect(await screen.findByText('Office closed Thursday')).toBeInTheDocument();
    act(() => { sw.dispatchEvent(new MessageEvent('message', { data: { type: 'OPEN_URL', url: '/?open=today&item=i3' } })); });
    expect(await screen.findByRole('dialog', { name: 'Wrist stretch' })).toBeInTheDocument();
  });

  it('re-saves this browser’s push subscription after sign-in, and when the worker says it changed', async () => {
    render(<App/>);
    await screen.findByTestId('screen-today', {}, { timeout: 3000 });
    expect(refreshPushSubscription).toHaveBeenCalledTimes(1);
    expect(refreshPushSubscription).toHaveBeenCalledWith({ lang: 'en' });
    act(() => { sw.dispatchEvent(new MessageEvent('message', { data: { type: 'PUSH_SUBSCRIPTION_CHANGED' } })); });
    expect(refreshPushSubscription).toHaveBeenCalledTimes(2);
  });
});
