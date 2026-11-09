import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  supabase: {},
  resolveMyCompanyId: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  subscribeToNotifications: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));
vi.mock('../../../lib/supabase-broadcasts', () => ({
  getBroadcastMedia: vi.fn(),
  getBroadcastAudioUrl: vi.fn(),
}));
vi.mock('../../state/auth-context.jsx', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));

import { getNotifications, markNotificationRead } from '../../../lib/supabase';
import { getBroadcastMedia, getBroadcastAudioUrl } from '../../../lib/supabase-broadcasts';
import { THEMES } from '../../design-system.jsx';
import { ScreenNotifs } from '../notifications.jsx';

const T = THEMES.brand;
const now = new Date().toISOString();
const notes = () => [
  { id: 'n1', kind: 'system', broadcast_id: 'b1', title_en: 'A word from Dr. Mona', title_ar: 'كلمة من د. منى', body_en: 'Listen when you have 2 minutes.', body_ar: null, read: false, created_at: now },
  { id: 'n2', kind: 'system', broadcast_id: 'b2', title_en: 'Office closed Thursday', title_ar: null, body_en: 'Enjoy the long weekend.', body_ar: null, read: false, created_at: now },
  { id: 'n3', kind: 'streak', broadcast_id: null, title_en: '3-day streak', title_ar: null, body_en: null, body_ar: null, read: true, created_at: now },
];
const media = { broadcast_id: 'b1', media_type: 'audio', media_bucket: 'company-media', media_path: 'c1/broadcasts/mona.m4a', media_mime: 'audio/mp4', media_duration_s: 75 };

let play, pause;
beforeEach(() => {
  vi.clearAllMocks();
  getNotifications.mockResolvedValue(notes());
  getBroadcastMedia.mockResolvedValue([media]);
  markNotificationRead.mockResolvedValue();
  // jsdom has no media playback: fake play / pause and their events.
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function play() {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {
    this.dispatchEvent(new Event('pause'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const renderNotifs = (props = {}) => render(<ScreenNotifs theme={T} dir="ltr" go={vi.fn()} {...props}/>);

describe('Notifications → audio messages', () => {
  it('a compact player only on broadcasts with audio; nothing fetched before play', async () => {
    renderNotifs();
    await screen.findByText('A word from Dr. Mona');
    await waitFor(() => expect(screen.getAllByTestId('audio-player')).toHaveLength(1));
    expect(getBroadcastMedia).toHaveBeenCalledTimes(1);
    expect(getBroadcastMedia).toHaveBeenCalledWith(['b1', 'b2']);
    const player = screen.getByTestId('audio-player');
    expect(within(player).getByRole('button', { name: 'Play the audio message: A word from Dr. Mona' })).toBeInTheDocument();
    expect(within(player).getByText('1:15')).toBeInTheDocument();
    expect(getBroadcastAudioUrl).not.toHaveBeenCalled();
  });

  it('play fetches the signed URL, plays, and pause pauses', async () => {
    getBroadcastAudioUrl.mockResolvedValue({ url: 'https://signed.test/mona.m4a', mime: 'audio/mp4', duration_s: 75 });
    const { container } = renderNotifs();
    const playBtn = await screen.findByRole('button', { name: /Play the audio message/ });
    fireEvent.click(playBtn);
    await waitFor(() => expect(getBroadcastAudioUrl).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(container.querySelector('audio')).toHaveAttribute('src', 'https://signed.test/mona.m4a');
    const pauseBtn = await screen.findByRole('button', { name: /Pause the audio message/ });

    // Progress moves with the audio.
    const audio = container.querySelector('audio');
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 30, writable: true });
    fireEvent.timeUpdate(audio);
    expect(screen.getByText('0:30 /', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Position' })).toHaveValue('30');

    fireEvent.click(pauseBtn);
    expect(pause).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /Play the audio message/ })).toBeInTheDocument();
    // The second play doesn't fetch again.
    fireEvent.click(screen.getByRole('button', { name: /Play the audio message/ }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(getBroadcastAudioUrl).toHaveBeenCalledTimes(1);
  });

  it('says so when the audio can’t be had', async () => {
    getBroadcastAudioUrl.mockResolvedValue(null);
    renderNotifs();
    fireEvent.click(await screen.findByRole('button', { name: /Play the audio message/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This audio can’t play right now.');
    expect(play).not.toHaveBeenCalled();
  });

  it('only one message plays at a time', async () => {
    getBroadcastMedia.mockResolvedValue([media, { ...media, broadcast_id: 'b2', media_duration_s: 20 }]);
    getBroadcastAudioUrl.mockImplementation(async (id) => ({ url: `https://signed.test/${id}.m4a`, mime: 'audio/mp4', duration_s: 20 }));
    renderNotifs();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Play the audio message/ })).toHaveLength(2));
    const [first, second] = screen.getAllByRole('button', { name: /Play the audio message/ });
    fireEvent.click(first);
    await screen.findByRole('button', { name: /Pause the audio message: A word/ });
    fireEvent.click(second);
    await screen.findByRole('button', { name: /Pause the audio message: Office closed/ });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Play the audio message: A word/ })).toBeInTheDocument();
  });

  it('Arabic: labels and digits', async () => {
    render(<ScreenNotifs theme={T} dir="rtl" go={vi.fn()}/>);
    const btn = await screen.findByRole('button', { name: 'شغّل الرسالة الصوتية: كلمة من د. منى' });
    expect(within(screen.getByTestId('audio-player')).getByText('١:١٥')).toBeInTheDocument();
    expect(btn).toBeInTheDocument();
  });
});

describe('Notifications → opened from a broadcast push', () => {
  it('highlights that message, marks it read and reports it handled', async () => {
    const onFocusHandled = vi.fn();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { container } = renderNotifs({ focusBroadcastId: 'b2', onFocusHandled });
    await screen.findByText('Office closed Thursday');
    await waitFor(() => expect(onFocusHandled).toHaveBeenCalled());
    const row = container.querySelector('[aria-current="true"]');
    expect(row).toHaveAttribute('data-notif-id', 'n2');
    expect(within(row).getByText('Office closed Thursday')).toBeInTheDocument();
    expect(markNotificationRead).toHaveBeenCalledWith('n2');
    expect(scroll).toHaveBeenCalled();
    delete Element.prototype.scrollIntoView;
  });

  it('an unknown broadcast just shows the list', async () => {
    const onFocusHandled = vi.fn();
    const { container } = renderNotifs({ focusBroadcastId: 'gone', onFocusHandled });
    await screen.findByText('Office closed Thursday');
    await waitFor(() => expect(onFocusHandled).toHaveBeenCalled());
    expect(container.querySelector('[aria-current="true"]')).toBeNull();
    expect(markNotificationRead).not.toHaveBeenCalled();
  });
});
