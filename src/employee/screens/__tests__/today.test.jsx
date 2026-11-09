import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({
  ...(await orig()),
  getMyToday: vi.fn(),
  checkRoutineItem: vi.fn(),
  setItemMuted: vi.fn(),
  getMyRoutineWeek: vi.fn(),
  getRecognitionBoard: vi.fn(),
  resolveMedia: vi.fn(),
  getMediaUrl: vi.fn(),
}));
vi.mock('../../../lib/push', () => ({
  getPushState: vi.fn(),
  enableRoutineReminders: vi.fn(),
  disableRoutineReminders: vi.fn(),
}));

import {
  getMyToday, checkRoutineItem, setItemMuted, getMyRoutineWeek, getRecognitionBoard, resolveMedia, getMediaUrl,
} from '../../../lib/supabase-routines';
import { getPushState, enableRoutineReminders } from '../../../lib/push';
import { THEMES } from '../../design-system.jsx';
import { ScreenToday } from '../today.jsx';
import { useRoutineToday } from '../../hooks/use-routine-today.js';
import { applyTick } from '../../lib/routine-today.js';
import { makeToday, makeWeek, makeBoard } from '../../test-fixtures/routine.js';

const go = vi.fn();
function Harness({ dir = 'ltr', ...rest }) {
  const routine = useRoutineToday(true);
  return <ScreenToday theme={THEMES.brand} dir={dir} go={go} state={{ unreadCount: 0 }} routine={routine} {...rest}/>;
}
const pushState = (state, reason = null) => ({ state, permission: 'default', endpoint: null, support: { supported: state !== 'unsupported', reason, ios: false, standalone: false } });
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getPushState.mockResolvedValue(pushState('unsupported', 'no_service_worker'));
  getRecognitionBoard.mockResolvedValue({ enabled: false, mode: 'off', teams: [], named: null, me: { opted_in: false, items_done: 0, streak: 0 } });
  getMediaUrl.mockResolvedValue(null);
  resolveMedia.mockResolvedValue({ media_type: 'video', media_url: 'https://cdn.test/neck.mp4', media_youtube_id: null, media_mime: 'video/mp4', poster_url: null });
});

describe('Today tab', () => {
  it('shows the day, the focus, progress, the next item and the timed list', async () => {
    getMyToday.mockResolvedValue(makeToday());
    render(<Harness/>);
    expect(await screen.findByText(/^Tuesday,? 10 November$/)).toBeInTheDocument();
    expect(screen.getByText('Upper body')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '1 of 4 done' })).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('3-day streak')).toBeInTheDocument();

    const next = screen.getByRole('region', { name: 'Next up' });
    expect(within(next).getByText('Wrist stretch')).toBeInTheDocument();
    expect(within(next).getByText('11:30')).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Today’s list' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[2]).toHaveAttribute('data-next', 'true');
    expect(within(list).getByRole('checkbox', { name: 'Shoulder rolls' })).toHaveAttribute('aria-checked', 'true');
    expect(within(list).getByRole('checkbox', { name: 'Neck release' })).toHaveAttribute('aria-checked', 'false');
    // Past and not ticked: "Not yet", never "missed".
    expect(within(rows[1]).getByText('Not yet')).toBeInTheDocument();
    expect(screen.queryByText(/missed/i)).toBeNull();
    // Untimed items read "Any time".
    expect(within(rows[3]).getByText('Any time')).toBeInTheDocument();
  });

  it('one tap ticks an item at once, and the server answer sticks', async () => {
    const s = makeToday();
    getMyToday.mockResolvedValue(s);
    const d = deferred();
    checkRoutineItem.mockReturnValue(d.promise);
    render(<Harness/>);
    const box = await screen.findByRole('checkbox', { name: 'Wrist stretch' });
    fireEvent.click(box);
    expect(checkRoutineItem).toHaveBeenCalledWith('i3', true);
    expect(box).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('progressbar', { name: '2 of 4 done' })).toBeInTheDocument();
    await act(async () => { d.resolve(applyTick(s, 'i3', true)); });
    expect(screen.getByRole('checkbox', { name: 'Wrist stretch' })).toHaveAttribute('aria-checked', 'true');
  });

  it('a past item can still be ticked, and a second tap undoes it', async () => {
    const s = makeToday();
    getMyToday.mockResolvedValue(s);
    checkRoutineItem.mockImplementation(async (id, v) => applyTick(s, id, v));
    render(<Harness/>);
    const box = await screen.findByRole('checkbox', { name: 'Neck release' });
    fireEvent.click(box);
    await waitFor(() => expect(checkRoutineItem).toHaveBeenCalledWith('i2', true));
    const ticked = screen.getByRole('checkbox', { name: 'Neck release' });
    expect(ticked).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Shoulder rolls' }));
    await waitFor(() => expect(checkRoutineItem).toHaveBeenCalledWith('i1', false));
  });

  it('rolls the tick back and says so when saving fails', async () => {
    getMyToday.mockResolvedValue(makeToday());
    const d = deferred();
    checkRoutineItem.mockReturnValue(d.promise);
    render(<Harness/>);
    const box = await screen.findByRole('checkbox', { name: 'Wrist stretch' });
    fireEvent.click(box);
    expect(box).toHaveAttribute('aria-checked', 'true');
    await act(async () => { d.reject(new Error('Failed to fetch')); });
    expect(screen.getByRole('checkbox', { name: 'Wrist stretch' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('progressbar', { name: '1 of 4 done' })).toBeInTheDocument();
  });

  it('celebrates when the last item is ticked', async () => {
    const s = makeToday();
    const almost = applyTick(applyTick(s, 'i2', true), 'i3', true);
    getMyToday.mockResolvedValue(almost);
    checkRoutineItem.mockImplementation(async (id, v) => applyTick(almost, id, v));
    const { container } = render(<Harness/>);
    const confetti = () => container.querySelectorAll('[style*="confetti-"]').length;
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Drink a glass of water' }));
    expect(await screen.findByText('All done for today!')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Next up' })).toBeNull();
    expect(confetti()).toBeGreaterThan(0);
  });

  it('no confetti when the day was already done on opening', async () => {
    const s = makeToday();
    const done = applyTick(applyTick(applyTick(s, 'i2', true), 'i3', true), 'i4', true);
    getMyToday.mockResolvedValue(done);
    const { container } = render(<Harness/>);
    expect(await screen.findByText('All done for today!')).toBeInTheDocument();
    expect(container.querySelectorAll('[style*="confetti-"]').length).toBe(0);
  });

  it('a row opens the exercise: video, how to, what it helps, Done and Mute', async () => {
    const s = makeToday();
    getMyToday.mockResolvedValue(s);
    checkRoutineItem.mockImplementation(async (id, v) => applyTick(s, id, v));
    setItemMuted.mockResolvedValue({});
    const { container } = render(<Harness/>);
    const list = await screen.findByRole('list', { name: 'Today’s list' });
    fireEvent.click(within(list).getByRole('button', { name: /Neck release/ }));

    const sheet = await screen.findByRole('dialog', { name: 'Neck release' });
    expect(within(sheet).getByText('Tilt your ear to your shoulder and hold.')).toBeInTheDocument();
    expect(within(sheet).getByText('Eases a stiff neck.')).toBeInTheDocument();
    expect(within(sheet).getByText('Neck, Shoulders')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('video')).toHaveAttribute('src', 'https://cdn.test/neck.mp4'));
    expect(resolveMedia).toHaveBeenCalledWith(expect.objectContaining({ media_path: 'c1/exercises/neck.mp4' }));
    expect(container.querySelector('video')).not.toHaveAttribute('autoplay');

    expect(within(sheet).getByText('Stops this one’s reminder. The others still come.')).toBeInTheDocument();
    expect(within(sheet).queryByText(/coming soon/i)).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: /Mute this one/ }));
    expect(setItemMuted).toHaveBeenCalledWith('i2', true);
    expect(within(sheet).getByText('No reminder for this one. The others still come.')).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(checkRoutineItem).toHaveBeenCalledWith('i2', true);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('friendly empty state on a day off', async () => {
    getMyToday.mockResolvedValue(makeToday({ is_workday: false, weekday: 5, items: [], progress: { done: 0, total: 0, pct: null, all_done: false, points: 0 }, next_item_id: null }));
    render(<Harness/>);
    expect(await screen.findByText(/Enjoy your day off/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'This week' })).toBeInTheDocument();
  });

  it('friendly empty state when nothing is due today', async () => {
    getMyToday.mockResolvedValue(makeToday({ items: [], progress: { done: 0, total: 0, pct: null, all_done: false, points: 0 }, next_item_id: null }));
    render(<Harness/>);
    expect(await screen.findByText('Nothing on your list today')).toBeInTheDocument();
  });

  it('works right to left in Arabic', async () => {
    getMyToday.mockResolvedValue(makeToday());
    render(<Harness dir="rtl"/>);
    const root = await screen.findByTestId('screen-today');
    expect(root).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { name: 'النهارده' })).toBeInTheDocument();
    expect(screen.getByText('الجزء العلوي')).toBeInTheDocument();
    const next = screen.getByRole('region', { name: 'اللي عليه الدور' });
    expect(within(next).getByText('إطالة الرسغ')).toBeInTheDocument();
    expect(within(next).getByText('١١:٣٠')).toBeInTheDocument();
    expect(within(next).getByRole('button', { name: 'خلّصتها' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'إطالة الرقبة' })).toBeInTheDocument();
    expect(screen.getByText('لسه')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '١ من ٤ خلصوا' })).toBeInTheDocument();
  });

  it('this week: Sun–Thu with done / due and each day’s focus', async () => {
    getMyToday.mockResolvedValue(makeToday());
    getMyRoutineWeek.mockResolvedValue(makeWeek());
    render(<Harness/>);
    fireEvent.click(await screen.findByRole('button', { name: 'This week' }));
    const sheet = await screen.findByRole('dialog', { name: 'This week' });
    expect(await within(sheet).findByText('From Coach Karim.')).toBeInTheDocument();
    const days = within(sheet).getByRole('group', { name: 'Days' });
    const buttons = within(days).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Sun: 2 of 2 done', 'Mon: 1 of 2 done', 'Tue: 1 of 3 done', 'Wed: 0 of 2 done', 'Thu: 0 of 1 done',
    ]);
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'true'); // today
    expect(within(sheet).getByText('Wall push-ups')).toBeInTheDocument();
    expect(within(sheet).getByText(/Upper body/)).toBeInTheDocument();
    fireEvent.click(buttons[3]);
    expect(within(sheet).getByText('Squats')).toBeInTheDocument();
    expect(within(sheet).getByText(/Lower body/)).toBeInTheDocument();
    expect(within(sheet).queryByText('Not yet')).toBeNull(); // future day: no "not yet"
    expect(within(sheet).getByText(/4 of 10 done · 1 full day/)).toBeInTheDocument();
  });

  it('this week: another day’s item opens its video, read-only', async () => {
    getMyToday.mockResolvedValue(makeToday());
    getMyRoutineWeek.mockResolvedValue(makeWeek());
    const { container } = render(<Harness/>);
    fireEvent.click(await screen.findByRole('button', { name: 'This week' }));
    const week = await screen.findByRole('dialog', { name: 'This week' });
    const days = within(week).getByRole('group', { name: 'Days' });
    fireEvent.click(within(days).getAllByRole('button')[1]); // Monday
    fireEvent.click(within(week).getByRole('button', { name: /Neck release/ }));

    const sheet = await screen.findByRole('dialog', { name: 'Neck release' });
    expect(screen.queryByRole('dialog', { name: 'This week' })).toBeNull();
    await waitFor(() => expect(container.querySelector('video')).toHaveAttribute('src', 'https://cdn.test/neck.mp4'));
    expect(resolveMedia).toHaveBeenCalledWith(expect.objectContaining({ media_path: 'c1/exercises/neck.mp4' }));
    expect(within(sheet).getByText('Tilt your ear to your shoulder and hold.')).toBeInTheDocument();
    expect(within(sheet).getByText(/Monday,? 9 November/)).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Done' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: /Mute this one/ })).toBeNull();

    // Close goes back to the week, on the same day.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    const back = await screen.findByRole('dialog', { name: 'This week' });
    expect(within(within(back).getByRole('group', { name: 'Days' })).getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('this week: today’s item keeps its Done button', async () => {
    const s = makeToday();
    getMyToday.mockResolvedValue(s);
    checkRoutineItem.mockImplementation(async (id, v) => applyTick(s, id, v));
    const week = makeWeek();
    week.days[2].items = [{ ...week.days[2].items[1], id: 'i2' }]; // today's Neck release
    getMyRoutineWeek.mockResolvedValue(week);
    render(<Harness/>);
    fireEvent.click(await screen.findByRole('button', { name: 'This week' }));
    const weekSheet = await screen.findByRole('dialog', { name: 'This week' });
    fireEvent.click(await within(weekSheet).findByRole('button', { name: /Neck release/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Neck release' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(checkRoutineItem).toHaveBeenCalledWith('i2', true);
    expect(await screen.findByRole('dialog', { name: 'This week' })).toBeInTheDocument();
  });

  it('opened from a reminder: that item’s sheet opens', async () => {
    getMyToday.mockResolvedValue(makeToday());
    const onOpenHandled = vi.fn();
    render(<Harness openItemId="i3" onOpenHandled={onOpenHandled}/>);
    expect(await screen.findByRole('dialog', { name: 'Wrist stretch' })).toBeInTheDocument();
    expect(onOpenHandled).toHaveBeenCalled();
  });

  it('a reminder for an item no longer on today’s list just shows Today', async () => {
    getMyToday.mockResolvedValue(makeToday());
    const onOpenHandled = vi.fn();
    render(<Harness openItemId="gone" onOpenHandled={onOpenHandled}/>);
    await screen.findByRole('list', { name: 'Today’s list' });
    await waitFor(() => expect(onOpenHandled).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks once about reminders when the phone can get them', async () => {
    getMyToday.mockResolvedValue(makeToday());
    getPushState.mockResolvedValue(pushState('prompt'));
    enableRoutineReminders.mockResolvedValue({ routine_reminders: true, muted_item_ids: [] });
    render(<Harness/>);
    const card = await screen.findByRole('region', { name: 'Reminders' });
    expect(within(card).getByText('Get a nudge at each routine time?')).toBeInTheDocument();
    getPushState.mockResolvedValue(pushState('subscribed'));
    fireEvent.click(within(card).getByRole('button', { name: 'Yes, remind me' }));
    expect(enableRoutineReminders).toHaveBeenCalledWith({ lang: 'en' });
    expect(await screen.findByText('Reminders are on')).toBeInTheDocument();
  });

  it('no reminder card where the browser can’t do it, or reminders are on', async () => {
    getMyToday.mockResolvedValue(makeToday({ reminders: { enabled: true, muted_item_ids: [] } }));
    getPushState.mockResolvedValue(pushState('subscribed'));
    render(<Harness/>);
    await screen.findByRole('list', { name: 'Today’s list' });
    await act(async () => {});
    expect(screen.queryByTestId('reminder-prompt')).toBeNull();
  });

  it('links the original table when HR attached one', async () => {
    getMyToday.mockResolvedValue(makeToday({
      routines: [{ ...makeToday().routines[0], source_file_bucket: 'company-media', source_file_path: 'c1/routines/plan.pdf', source_file_mime: 'application/pdf' }],
    }));
    getMediaUrl.mockResolvedValue('https://signed.test/plan.pdf');
    render(<Harness/>);
    const link = await screen.findByRole('link', { name: /Original table/ });
    expect(link).toHaveAttribute('href', 'https://signed.test/plan.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(getMediaUrl).toHaveBeenCalledWith({ bucket: 'company-media', path: 'c1/routines/plan.pdf' });
  });

  it('shows "Top today" in one line when the company board is on', async () => {
    getMyToday.mockResolvedValue(makeToday());
    getRecognitionBoard.mockResolvedValue(makeBoard('teams'));
    render(<Harness/>);
    const line = await screen.findByTestId('top-today');
    expect(line).toHaveTextContent('Top team today: Finance');
    expect(line).not.toHaveTextContent('Amira');
    fireEvent.click(screen.getByRole('button', { name: 'See board' }));
    expect(go).toHaveBeenCalledWith('score');
  });
});
