import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn() }));
vi.mock('../../../lib/push', () => ({
  getPushState: vi.fn(),
  enableRoutineReminders: vi.fn(),
  disableRoutineReminders: vi.fn(),
}));

import { getPushState, enableRoutineReminders, disableRoutineReminders } from '../../../lib/push';
import { THEMES } from '../../design-system.jsx';
import { RemindersSetting, ReminderPrompt, ASK_KEY } from '../reminders.jsx';

const T = THEMES.brand;
const push = (state, extra = {}) => ({
  state,
  permission: state === 'denied' ? 'denied' : state === 'subscribed' || state === 'unsubscribed' ? 'granted' : 'default',
  endpoint: state === 'subscribed' ? 'https://push.test/1' : null,
  support: { supported: state !== 'unsupported', reason: null, ios: false, standalone: false, ...(extra.support || {}) },
});
const prefs = (on) => ({ routine_reminders: on, muted_item_ids: [] });
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const err = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Me → Reminders', () => {
  it('unsupported browser: one plain line, no switch, no prompt', async () => {
    getPushState.mockResolvedValue(push('unsupported', { support: { reason: 'no_push_manager' } }));
    render(<RemindersSetting theme={T} lang="en" remindersOn={false}/>);
    expect(await screen.findByText(/This browser can’t show reminders/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(enableRoutineReminders).not.toHaveBeenCalled();
  });

  it('iPhone Safari tab: the two "Add to Home Screen" steps instead of a switch', async () => {
    getPushState.mockResolvedValue(push('unsupported', { support: { reason: 'ios_needs_install', ios: true } }));
    render(<RemindersSetting theme={T} lang="en" remindersOn={false}/>);
    const card = await screen.findByTestId('ios-install-steps');
    expect(within(card).getByText('Add to Home Screen first')).toBeInTheDocument();
    const steps = within(card).getAllByRole('listitem');
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent(/Share .*Add to Home Screen/);
    expect(steps[1]).toHaveTextContent(/Open Wellness\+ from the new icon/);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('blocked: says how to allow it again in settings, and checks again on tap', async () => {
    getPushState.mockResolvedValue(push('denied', { support: { ios: true } }));
    render(<RemindersSetting theme={T} lang="en" remindersOn={true}/>);
    expect(await screen.findByText(/Settings → Notifications → Wellness\+ → Allow Notifications/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    getPushState.mockResolvedValue(push('prompt'));
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByRole('switch', { name: 'Reminders' })).toHaveAttribute('aria-checked', 'false');
  });

  it('never asked: switch off; permission is asked only on the tap', async () => {
    getPushState.mockResolvedValue(push('prompt'));
    const onPrefs = vi.fn();
    const d = deferred();
    enableRoutineReminders.mockReturnValue(d.promise);
    render(<RemindersSetting theme={T} lang="en" remindersOn={false} onPrefs={onPrefs}/>);
    const sw = await screen.findByRole('switch', { name: 'Reminders' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAccessibleDescription(/A nudge at each routine time/);
    expect(enableRoutineReminders).not.toHaveBeenCalled();

    fireEvent.click(sw);
    expect(enableRoutineReminders).toHaveBeenCalledWith({ lang: 'en' });
    expect(screen.getByRole('switch', { name: 'Reminders' })).toBeDisabled(); // busy
    getPushState.mockResolvedValue(push('subscribed'));
    await act(async () => { d.resolve(prefs(true)); });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Reminders' })).toHaveAttribute('aria-checked', 'true'));
    expect(onPrefs).toHaveBeenCalledWith(prefs(true));
  });

  it('allowed but no subscription on this phone: switch off, tap subscribes', async () => {
    getPushState.mockResolvedValue(push('unsubscribed'));
    enableRoutineReminders.mockResolvedValue(prefs(true));
    render(<RemindersSetting theme={T} lang="ar" remindersOn={true}/>);
    const sw = await screen.findByRole('switch', { name: 'التذكيرات' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    getPushState.mockResolvedValue(push('subscribed'));
    fireEvent.click(sw);
    expect(enableRoutineReminders).toHaveBeenCalledWith({ lang: 'ar' });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'التذكيرات' })).toHaveAttribute('aria-checked', 'true'));
  });

  it('subscribed and on: tap switches routine reminders off', async () => {
    getPushState.mockResolvedValue(push('subscribed'));
    disableRoutineReminders.mockResolvedValue(prefs(false));
    render(<RemindersSetting theme={T} lang="en" remindersOn={true}/>);
    const sw = await screen.findByRole('switch', { name: 'Reminders' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    expect(disableRoutineReminders).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Reminders' })).toHaveAttribute('aria-checked', 'false'));
  });

  it('subscribed for HR messages only: the switch reads off', async () => {
    getPushState.mockResolvedValue(push('subscribed'));
    render(<RemindersSetting theme={T} lang="en" remindersOn={false}/>);
    expect(await screen.findByRole('switch', { name: 'Reminders' })).toHaveAttribute('aria-checked', 'false');
  });

  it('“Block” on the prompt: shows how to allow it again', async () => {
    getPushState.mockResolvedValue(push('prompt'));
    enableRoutineReminders.mockRejectedValue(err('push_denied'));
    render(<RemindersSetting theme={T} lang="en" remindersOn={false}/>);
    const sw = await screen.findByRole('switch', { name: 'Reminders' });
    getPushState.mockResolvedValue(push('denied'));
    fireEvent.click(sw);
    expect(await screen.findByText(/Notifications are blocked for this site/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('prompt closed without an answer: stays off and says tap again', async () => {
    getPushState.mockResolvedValue(push('prompt'));
    enableRoutineReminders.mockRejectedValue(err('push_dismissed'));
    render(<RemindersSetting theme={T} lang="en" remindersOn={false}/>);
    fireEvent.click(await screen.findByRole('switch', { name: 'Reminders' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No answer yet. Tap again and choose Allow.');
    expect(screen.getByRole('switch', { name: 'Reminders' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Today → one-time reminder card', () => {
  it('asks once; "Yes, remind me" turns reminders on and says so', async () => {
    getPushState.mockResolvedValue(push('prompt'));
    enableRoutineReminders.mockResolvedValue(prefs(true));
    render(<ReminderPrompt theme={T} lang="en" remindersOn={false}/>);
    const card = await screen.findByRole('region', { name: 'Reminders' });
    expect(within(card).getByText('Get a nudge at each routine time?')).toBeInTheDocument();
    expect(enableRoutineReminders).not.toHaveBeenCalled();
    getPushState.mockResolvedValue(push('subscribed'));
    fireEvent.click(within(card).getByRole('button', { name: 'Yes, remind me' }));
    expect(enableRoutineReminders).toHaveBeenCalledWith({ lang: 'en' });
    expect(await screen.findByText('Reminders are on')).toBeInTheDocument();
    expect(localStorage.getItem(ASK_KEY)).toBe('yes');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('reminder-prompt')).toBeNull();
  });

  it('"Not now" hides it for good', async () => {
    getPushState.mockResolvedValue(push('prompt'));
    const { unmount } = render(<ReminderPrompt theme={T} lang="en" remindersOn={false}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('reminder-prompt')).toBeNull();
    expect(enableRoutineReminders).not.toHaveBeenCalled();
    unmount();
    render(<ReminderPrompt theme={T} lang="en" remindersOn={false}/>);
    await act(async () => {});
    expect(screen.queryByTestId('reminder-prompt')).toBeNull();
  });

  it('not shown when reminders are already on, blocked or impossible here', async () => {
    for (const [state, on, reason] of [['subscribed', true], ['denied', false], ['unsupported', false, 'no_push_manager']]) {
      getPushState.mockResolvedValue(push(state, { support: { reason } }));
      const { unmount } = render(<ReminderPrompt theme={T} lang="en" remindersOn={on}/>);
      await act(async () => {});
      expect(screen.queryByTestId('reminder-prompt')).toBeNull();
      unmount();
    }
  });

  it('iPhone Safari tab: shows the Home Screen steps once, "Got it" hides them', async () => {
    getPushState.mockResolvedValue(push('unsupported', { support: { reason: 'ios_needs_install', ios: true } }));
    render(<ReminderPrompt theme={T} lang="en" remindersOn={false}/>);
    expect(await screen.findByTestId('ios-install-steps')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, remind me' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByTestId('reminder-prompt')).toBeNull();
  });

  it('a "Block" on the prompt explains how to allow it again', async () => {
    getPushState.mockResolvedValue(push('prompt'));
    enableRoutineReminders.mockRejectedValue(err('push_denied'));
    render(<ReminderPrompt theme={T} lang="en" remindersOn={false}/>);
    getPushState.mockResolvedValue(push('denied'));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, remind me' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Notifications are blocked for this site/);
  });

  it('Arabic', async () => {
    getPushState.mockResolvedValue(push('prompt'));
    render(<ReminderPrompt theme={T} lang="ar" remindersOn={false}/>);
    expect(await screen.findByText('عايز تنبيه في ميعاد كل تمرين؟')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'أيوه، فكّرني' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مش دلوقتي' })).toBeInTheDocument();
  });
});
