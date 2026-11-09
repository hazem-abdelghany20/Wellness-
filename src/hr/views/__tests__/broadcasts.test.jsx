import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { HRBroadcastsPage } from '../broadcasts.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';


// Render-heavy screens: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20000 });
const T = HR_THEMES.light;

const scheduled = {
  id: 'b1', status: 'scheduled', scope: 'all', team_id: null, team_name: null,
  title_en: 'Stretch at night', title_ar: null, body_en: 'Two minutes.', body_ar: null,
  scheduled_at: '2026-11-10T19:00:00Z', deliver_at: '2026-11-11T06:00:00Z', sent_at: null,
  has_audio: true, media_bucket: 'company-media', media_path: 'c1/broadcasts/x.m4a', media_mime: 'audio/mp4', media_duration_s: 65,
  recipients: null, push_sent: 0, push_failed: 0, updated_at: '2026-11-09T10:00:00Z',
};
const sent = {
  id: 'b2', status: 'sent', scope: 'team', team_id: 't-fin', team_name: 'Finance',
  title_en: 'Water day', title_ar: 'يوم المية', body_en: 'Drink up', body_ar: null,
  scheduled_at: '2026-11-09T07:00:00Z', deliver_at: '2026-11-09T07:00:00Z', sent_at: '2026-11-09T07:00:30Z',
  has_audio: false, media_path: null, recipients: 12, push_sent: 9, push_failed: 1, updated_at: '2026-11-09T07:00:30Z',
};
const cancelled = { ...sent, id: 'b3', status: 'cancelled', title_en: 'Old news', updated_at: '2026-11-08T07:00:00Z' };

let api;
beforeEach(() => {
  // Daytime in Cairo (12:00), so "now" is outside quiet hours whenever the tests run.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  api = {
    list: vi.fn(async () => [scheduled, sent, cancelled]),
    save: vi.fn(async (input) => ({ ...input, id: input.id || 'b-new', status: input.scheduled_at ? 'scheduled' : 'sent',
      scheduled_at: input.scheduled_at || '2026-11-09T10:00:00Z', deliver_at: input.scheduled_at || '2026-11-09T10:00:00Z', recipients: 40 })),
    cancel: vi.fn(async () => ({})),
    uploadAudio: vi.fn(async (file, { onProgress }) => { onProgress?.(40); return { path: 'c1/broadcasts/new.m4a', mime: 'audio/mp4', duration_s: 42 }; }),
    discardAudio: vi.fn(),
    audioUrl: vi.fn(async () => 'https://signed.test/x.m4a'),
    settings: vi.fn(async () => ({ timezone: 'Africa/Cairo', quiet_hours: true, quiet_window: { from: '20:00', to: '08:00' } })),
    teams: vi.fn(async () => [{ id: 't-fin', name: 'Finance' }]),
  };
});
afterEach(() => { vi.useRealTimers(); });

const view = (props = {}) => render(<HRBroadcastsPage theme={T} lang="en" density="comfortable" api={api} {...props}/>);

describe('Broadcasts list', () => {
  it('shows scheduled (with quiet hours), sent (with reach) and cancelled messages', async () => {
    view();
    expect(await screen.findByText('Stretch at night')).toBeInTheDocument();
    expect(screen.getByText('Will arrive Wed 11 Nov, 08:00 — quiet hours')).toBeInTheDocument();
    expect(screen.getByText(/Audio · 1:05/)).toBeInTheDocument();
    expect(screen.getByText('Sent Mon 9 Nov, 09:00')).toBeInTheDocument();
    expect(screen.getByText('12 people · push: 9 sent, 1 failed')).toBeInTheDocument();
    expect(screen.getAllByText('Finance').length).toBe(2); // sent + cancelled, both to Finance
    expect(screen.getByText(/Cancelled · was set for/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1); // only while scheduled
  });

  it('cancels a scheduled one after asking', async () => {
    view();
    await screen.findByText('Stretch at night');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('b1'));
    expect(await screen.findByText('Cancelled. Nobody will get it.')).toBeInTheDocument();
  });

  it('edits a scheduled one, keeping its audio unless removed', async () => {
    view();
    await screen.findByText('Stretch at night');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Edit scheduled message')).toBeInTheDocument();
    expect(screen.getByLabelText('Title (English)')).toHaveValue('Stretch at night');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-10');
    expect(screen.getByLabelText('Time')).toHaveValue('21:00');
    await waitFor(() => expect(api.audioUrl).toHaveBeenCalledWith({ media_bucket: 'company-media', media_path: 'c1/broadcasts/x.m4a' }));
    fireEvent.change(screen.getByLabelText('Title (English)'), { target: { value: 'Stretch tonight' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const input = api.save.mock.calls[0][0];
    expect(input).toMatchObject({ id: 'b1', title_en: 'Stretch tonight', scope: 'all', team_id: null });
    expect('audio' in input).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove audio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
    expect(api.save.mock.calls[1][0].audio).toBe(null);
    expect(api.discardAudio).not.toHaveBeenCalled(); // the saved file belongs to the broadcast
  });
});

describe('Broadcast composer', () => {
  it('sends a text message now', async () => {
    view();
    await screen.findByText('New message');
    expect(screen.getByRole('button', { name: 'Send now' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByText('Add the title in English.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title (English)'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByText('Write the message, or add a voice message.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message (English)'), { target: { value: 'Stand up and stretch.' } });
    fireEvent.change(screen.getByLabelText('Message (Arabic)'), { target: { value: 'قوم اتمطّع.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith({
      title_en: 'Hello', title_ar: null, body_en: 'Stand up and stretch.', body_ar: 'قوم اتمطّع.',
      scope: 'all', team_id: null, scheduled_at: null,
    }));
    expect(await screen.findByText('Sent to 40 people.')).toBeInTheDocument();
  });

  it('says when a message sent at night will arrive', async () => {
    vi.setSystemTime(new Date('2026-11-09T20:30:00Z')); // 22:30 in Cairo
    view();
    await screen.findByText('New message');
    expect(screen.getByText('Quiet hours now: it will arrive at 08:00 on Tue 10 Nov.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send (arrives at 08:00)' })).toBeInTheDocument();
  });

  it('schedules for one team in company time and shows when quiet hours move it', async () => {
    view();
    await screen.findByText('New message');
    fireEvent.change(screen.getByLabelText('Title (English)'), { target: { value: 'Night note' } });
    fireEvent.change(screen.getByLabelText('Message (English)'), { target: { value: 'See you tomorrow.' } });
    fireEvent.click(screen.getByRole('button', { name: 'One team' }));
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 't-fin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick a time' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-15' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '21:30' } });
    expect(screen.getByText('Will arrive at 08:00 — quiet hours (Wed 16 Jan).')).toBeInTheDocument();
    expect(screen.getByText(/Company time \(Cairo \(Egypt\)\)/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '10:00' } });
    expect(screen.getByText('Will arrive Tue 15 Jan, 10:00.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '21:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({
      title_en: 'Night note', scope: 'team', team_id: 't-fin', scheduled_at: '2030-01-15T19:30:00.000Z',
    })));
    expect(await screen.findByText(/^Scheduled\. Will arrive/)).toBeInTheDocument();
  });

  it('uploads an audio file with progress; then the text is optional', async () => {
    let finish;
    api.uploadAudio.mockImplementationOnce((file, { onProgress }) => new Promise((resolve) => {
      onProgress(40);
      finish = () => resolve({ path: 'c1/broadcasts/new.m4a', mime: 'audio/mp4', duration_s: 42 });
    }));
    view();
    await screen.findByText('New message');
    const input = screen.getByLabelText('Choose an audio file');
    expect(input).toHaveAttribute('accept', expect.stringContaining('.m4a'));
    fireEvent.change(input, { target: { files: [new File(['abc'], 'note.m4a', { type: 'audio/mp4' })] } });
    expect(await screen.findByRole('progressbar', { name: 'Upload progress' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByRole('button', { name: 'Send now' })).toBeDisabled();
    await act(async () => { finish(); });
    expect(await screen.findByRole('button', { name: 'Remove audio' })).toBeInTheDocument();
    expect(screen.getByText('0:42')).toBeInTheDocument();
    expect(screen.getByText('With a voice message, the text is optional.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title (English)'), { target: { value: 'Listen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({
      title_en: 'Listen', body_en: null, audio: { path: 'c1/broadcasts/new.m4a', mime: 'audio/mp4', duration_s: 42 },
    })));
    expect(api.discardAudio).not.toHaveBeenCalled();
  });

  it('refuses a file that isn’t audio, and drops an unsaved upload when replaced', async () => {
    view();
    await screen.findByText('New message');
    fireEvent.change(screen.getByLabelText('Choose an audio file'), { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText(/Use an audio file: MP3 or M4A/)).toBeInTheDocument();
    expect(api.uploadAudio).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Choose an audio file'), { target: { files: [new File(['abc'], 'a.mp3', { type: 'audio/mpeg' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove audio' }));
    expect(api.discardAudio).toHaveBeenCalledWith('c1/broadcasts/new.m4a');
  });
});

// A MediaRecorder stand-in: stop() hands back one chunk.
class FakeRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || 'audio/webm'; this.state = 'inactive'; FakeRecorder.last = this; }
  static isTypeSupported(m) { return m === 'audio/webm;codecs=opus' || m === 'audio/webm'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) }); this.onstop?.(); }
}
const recEnv = (getUserMedia) => ({
  isSecureContext: true,
  navigator: { mediaDevices: { getUserMedia } },
  MediaRecorder: FakeRecorder,
  URL: { createObjectURL: () => 'blob:rec', revokeObjectURL: () => {} },
});

describe('Recording a voice message', () => {
  it('records, stops, uploads and lets you record again', async () => {
    const stopTrack = vi.fn();
    const env = recEnv(vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })));
    view({ recorderEnv: env });
    await screen.findByText('New message');
    fireEvent.click(screen.getByRole('button', { name: 'Record in the browser' }));
    expect(screen.getByText(/Up to 3 minutes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '● Start recording' }));
    expect(await screen.findByText('Recording 0:00 / 3:00')).toBeInTheDocument();
    expect(FakeRecorder.last.mimeType).toBe('audio/webm;codecs=opus');
    expect(screen.getByRole('button', { name: 'Send now' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(api.uploadAudio).toHaveBeenCalledTimes(1));
    const file = api.uploadAudio.mock.calls[0][0];
    expect(file.name).toMatch(/^voice-note-.*\.webm$/);
    expect(file.type).toBe('audio/webm');
    expect(stopTrack).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Record again' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Record again' }));
    expect(api.discardAudio).toHaveBeenCalledWith('c1/broadcasts/new.m4a');
    expect(await screen.findByText('Recording 0:00 / 3:00')).toBeInTheDocument();
  });

  it('explains a blocked microphone and an unsupported browser', async () => {
    const env = recEnv(vi.fn(async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); }));
    const { unmount } = view({ recorderEnv: env });
    await screen.findByText('New message');
    fireEvent.click(screen.getByRole('button', { name: 'Record in the browser' }));
    fireEvent.click(screen.getByRole('button', { name: '● Start recording' }));
    expect(await screen.findByText(/The browser blocked the microphone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    unmount();

    view({ recorderEnv: { isSecureContext: true, navigator: {}, MediaRecorder: undefined }, lang: 'ar' });
    await screen.findByText('رسالة جديدة');
    fireEvent.click(screen.getByRole('button', { name: 'سجّل من المتصفح' }));
    fireEvent.click(screen.getByRole('button', { name: '● ابدأ التسجيل' }));
    expect(await screen.findByText(/المتصفح ده مبيسجّلش/)).toBeInTheDocument();
  });
});
