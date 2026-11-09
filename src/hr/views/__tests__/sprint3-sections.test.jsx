import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const lib = vi.hoisted(() => ({ getMyCompanySettings: vi.fn(), setCompanySettings: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({ ...(await orig()), ...lib }));
const challenges = vi.hoisted(() => ({
  templates: [], scheduled: [], teams: [], loading: false, error: null,
  schedule: vi.fn(), cancel: vi.fn(), refetch: vi.fn(async () => {}),
}));
vi.mock('../../hooks/use-challenges.js', () => ({ useChallenges: () => challenges }));

import { RoutineSettingsPanels } from '../settings-routine.jsx';
import { HRChallengesPage } from '../challenges.jsx';
import { BulkVideoPanel } from '../bulk-videos.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';


// Render-heavy screens: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20000 });
const T = HR_THEMES.light;
beforeEach(() => { vi.clearAllMocks(); });

describe('Settings: quiet hours and reminders', () => {
  it('turns quiet hours off on its own and explains reminders', async () => {
    lib.getMyCompanySettings.mockResolvedValue({ timezone: 'Africa/Cairo', recognition: 'off', weekly_habit_enabled: true,
      hr_people_view: false, quiet_hours: true, quiet_window: { from: '20:00', to: '08:00' } });
    lib.setCompanySettings.mockImplementation(async (patch) => ({ timezone: 'Africa/Cairo', recognition: 'off', quiet_hours: true,
      quiet_window: { from: '20:00', to: '08:00' }, ...patch }));
    const onSaved = vi.fn();
    render(<RoutineSettingsPanels theme={T} lang="en" density="comfortable" onSaved={onSaved}/>);
    expect(await screen.findByText('Quiet hours')).toBeInTheDocument();
    expect(screen.getByText('On · 08:00–20:00')).toBeInTheDocument();
    expect(screen.getByText(/messages from HR arrive only between 08:00 and 20:00 company time/)).toBeInTheDocument();
    expect(screen.getByText(/Employees switch reminders on in their app; iPhone users must add the app to the Home Screen first\./)).toBeInTheDocument();
    const quietPanel = screen.getByText('Quiet hours').parentElement;
    fireEvent.click(within(quietPanel).getAllByRole('button')[0]);
    await waitFor(() => expect(lib.setCompanySettings).toHaveBeenCalledWith({ quiet_hours: false }));
    expect(onSaved).toHaveBeenCalledWith({ quiet_hours: false });
    expect(await screen.findByText('Off: messages go at any hour')).toBeInTheDocument();
  });

  it('reads in Arabic', async () => {
    lib.getMyCompanySettings.mockResolvedValue({ timezone: 'Africa/Cairo', recognition: 'off', weekly_habit_enabled: true, quiet_hours: false });
    render(<RoutineSettingsPanels theme={T} lang="ar" density="comfortable"/>);
    expect(await screen.findByText('ساعات الهدوء')).toBeInTheDocument();
    expect(screen.getByText('مقفولة: الرسايل بتوصل في أي وقت')).toBeInTheDocument();
    expect(screen.getByText(/لازم يضيفوا التطبيق للشاشة الرئيسية الأول/)).toBeInTheDocument();
  });
});

describe('Challenges: the weekly habit pauses while a routine runs', () => {
  it('shows "Paused while a routine runs" with no cancel button', () => {
    challenges.scheduled = [
      { id: 'c1', title_en: 'Stand up hourly', team_name: null, start_date: '2026-11-08', end_date: '2026-11-12', status: 'paused', auto: true, participants: 0, completed: 0 },
    ];
    render(<HRChallengesPage theme={T} lang="en" density="comfortable"/>);
    expect(screen.getByText('Paused while a routine runs')).toBeInTheDocument();
    expect(screen.getByText('People do their routine instead this week.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});

describe('Upload many videos', () => {
  const exercises = [
    { id: 'ex-neck', scope: 'company', status: 'published', name_en: 'Neck release', name_ar: 'فك الرقبة', media_type: null },
    { id: 'ex-wall', scope: 'company', status: 'published', name_en: 'Wall push-ups', media_type: 'video' },
    { id: 'ex-ankle', scope: 'company', status: 'published', name_en: 'Ankle circles', media_type: null },
  ];
  const vid = (name) => new File(['data'], name, { type: 'video/mp4' });
  let api;
  beforeEach(() => {
    api = {
      list: vi.fn(async () => exercises),
      upload: vi.fn(async (file, { onProgress }) => { onProgress?.(50); return { bucket: 'company-media', path: `c1/exercises/${file.name}`, mime: 'video/mp4', kind: 'video' }; }),
      setMedia: vi.fn(async (items) => ({ updated: items.length - 1, skipped: [{ id: 'ex-ankle', reason: 'has_media' }] })),
      discard: vi.fn(),
    };
  });

  it('matches files by name, lets HR fix a row, uploads and sets them in one go', async () => {
    const onDone = vi.fn();
    render(<BulkVideoPanel theme={T} lang="en" density="comfortable" api={api} onDone={onDone} onClose={vi.fn()}/>);
    expect(await screen.findByText(/Still without a video: Neck release, Ankle circles/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Choose the videos'), { target: { files: [
      vid('Neck_release.mp4'), vid('Wall push-ups.mp4'), vid('ankle.mp4'),
    ] } });
    const table = await screen.findByRole('table', { name: 'Files and exercises' });
    expect(within(table).getByLabelText('Exercise for Neck_release.mp4')).toHaveValue('ex-neck');
    expect(within(table).getByText('Already has a video (kept)')).toBeInTheDocument();
    expect(within(table).getByText('Pick the exercise')).toBeInTheDocument();
    expect(screen.getByText('1 ready')).toBeInTheDocument();

    fireEvent.change(within(table).getByLabelText('Exercise for ankle.mp4'), { target: { value: 'ex-ankle' } });
    fireEvent.click(screen.getByLabelText('Replace videos that are already there'));
    expect(screen.getByText('3 ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upload 3 videos' }));

    await waitFor(() => expect(api.setMedia).toHaveBeenCalledTimes(1));
    expect(api.upload).toHaveBeenCalledTimes(3);
    expect(api.setMedia).toHaveBeenCalledWith([
      { id: 'ex-neck', media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/Neck_release.mp4', media_mime: 'video/mp4', media_youtube_id: null },
      { id: 'ex-wall', media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/Wall push-ups.mp4', media_mime: 'video/mp4', media_youtube_id: null },
      { id: 'ex-ankle', media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/ankle.mp4', media_mime: 'video/mp4', media_youtube_id: null },
    ], { overwrite: true });
    expect(await screen.findByText(/Videos added to 2 exercises\./)).toBeInTheDocument();
    expect(screen.getByText('Already has a video (kept).')).toBeInTheDocument(); // the skipped row
    expect(api.discard).toHaveBeenCalledWith('c1/exercises/ankle.mp4');
    expect(onDone).toHaveBeenCalled();
  });

  it('cleans up when saving fails, and works in Arabic', async () => {
    api.setMedia.mockRejectedValueOnce({ message: 'not_authorized' });
    render(<BulkVideoPanel theme={T} lang="ar" density="comfortable" api={api}/>);
    await screen.findByText(/لسه من غير فيديو/);
    fireEvent.change(screen.getByLabelText('اختار الفيديوهات'), { target: { files: [vid('فك الرقبة.mp4')] } });
    fireEvent.click(await screen.findByRole('button', { name: 'ارفع ١ فيديو' }));
    expect(await screen.findByText('ليست لديك صلاحية لتنفيذ هذا.')).toBeInTheDocument();
    expect(api.discard).toHaveBeenCalledWith('c1/exercises/فك الرقبة.mp4');
  });
});
