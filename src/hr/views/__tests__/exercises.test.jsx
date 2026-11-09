import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { HRExercisesPage } from '../exercises.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';

const own = {
  id: 'ex-own', company_id: 'c1', scope: 'company', status: 'published', name_en: 'Neck release', name_ar: 'فك الرقبة',
  body_areas: ['neck', 'shoulders'], default_sets_reps: '2 × 10', media_type: 'video', media_bucket: 'company-media',
  media_path: 'c1/exercises/neck.mp4', media_mime: 'video/mp4', hidden: false, pinned: false, can_edit: true,
};
const pub = {
  id: 'ex-pub', company_id: null, scope: 'public', status: 'published', name_en: 'Wall push-ups', name_ar: null,
  body_areas: ['chest'], default_sets_reps: '3 × 10', media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ',
  hidden: false, pinned: false, can_edit: false,
};
const archived = { ...own, id: 'ex-old', name_en: 'Old stretch', name_ar: null, status: 'archived' };

let api;
beforeEach(() => {
  api = {
    mode: 'hr',
    list: vi.fn(async () => [own, archived, pub]),
    save: vi.fn(async (input) => ({ id: 'ex-new', ...input })),
    setStatus: vi.fn(async () => ({})),
    setPref: vi.fn(async () => ({})),
    copy: vi.fn(async () => ({ id: 'ex-copy' })),
    media: {
      upload: vi.fn(),
      discard: vi.fn(),
      resolve: vi.fn(async (f) => (f.media_type === 'youtube'
        ? { media_type: 'youtube', media_youtube_id: f.media_youtube_id, media_url: null }
        : { media_type: f.media_type, media_url: `https://signed.test/${f.media_path}` })),
    },
  };
});

const view = (lang = 'en') => render(<HRExercisesPage theme={HR_THEMES.light} lang={lang} density="comfortable" api={api}/>);

describe('HR exercises', () => {
  it('lists your company’s exercises with body areas, sets × reps and media', async () => {
    view();
    expect(await screen.findByText('Neck release')).toBeInTheDocument();
    expect(screen.getByText('Neck')).toBeInTheDocument();
    expect(screen.getByText('Shoulders')).toBeInTheDocument();
    expect(screen.getByText('2 × 10')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.queryByText('Wall push-ups')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Your company · 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Archived (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith('ex-old', 'published'));
  });

  it('Wellness House tab: use, pin and hide, never edit', async () => {
    view();
    fireEvent.click(await screen.findByRole('tab', { name: 'Wellness House · 1' }));
    const card = screen.getByText('Wall push-ups').closest('div[style]').parentElement;
    expect(within(card).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(api.setPref).toHaveBeenCalledWith('ex-pub', { hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    await waitFor(() => expect(api.setPref).toHaveBeenCalledWith('ex-pub', { pinned: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }));
    await waitFor(() => expect(api.copy).toHaveBeenCalledWith('ex-pub'));
    expect(await screen.findByText(/Added to your company/)).toBeInTheDocument();
  });

  it('adds an exercise with a YouTube demo and a live preview', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Add exercise' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add exercise' }).at(-1));
    expect(await screen.findByText('Add the name in English.')).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name (English)'), { target: { value: 'Shoulder rolls' } });
    fireEvent.click(screen.getByRole('button', { name: '30 sec' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upper back' }));
    fireEvent.click(screen.getByRole('button', { name: 'YouTube link' }));
    fireEvent.change(screen.getByLabelText('YouTube link'), { target: { value: 'https://youtube.com/shorts/dQw4w9WgXcQ' } });
    expect(screen.getByText('YouTube video found.')).toBeInTheDocument();
    expect(await screen.findByTitle('How to do it: Shoulder rolls')).toBeInTheDocument(); // the shared player

    fireEvent.click(screen.getAllByRole('button', { name: 'Add exercise' }).at(-1));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    expect(api.save.mock.calls[0][0]).toMatchObject({
      name_en: 'Shoulder rolls', default_sets_reps: '30 sec', body_areas: ['upper_back'],
      media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ',
    });
    expect(await screen.findByText(/Exercise added/)).toBeInTheDocument();
  });

  it('uploads a video with progress and refuses files over 50 MB before sending', async () => {
    let progress;
    let finish;
    api.media.upload.mockImplementation((file, opts) => new Promise((resolve) => {
      progress = opts.onProgress;
      finish = () => resolve({ bucket: 'company-media', path: 'c1/exercises/new.mp4', mime: 'video/mp4', kind: 'video' });
    }));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Add exercise' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload video or picture' }));
    const input = screen.getByLabelText('Choose a video or picture');

    const big = new File(['x'], 'big.mp4', { type: 'video/mp4' });
    Object.defineProperty(big, 'size', { value: 60 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText(/export it at 720p or paste a YouTube link/)).toBeInTheDocument();
    expect(api.media.upload).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [new File(['abc'], 'neck.mp4', { type: 'video/mp4' })] } });
    await waitFor(() => expect(api.media.upload).toHaveBeenCalledTimes(1));
    expect(api.media.upload.mock.calls[0][1]).toMatchObject({ folder: 'exercises', contentType: 'video/mp4' });
    progress(42);
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    finish();
    expect(await screen.findByText('neck.mp4')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name (English)'), { target: { value: 'Neck tilt' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add exercise' }).at(-1));
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    expect(api.save.mock.calls[0][0]).toMatchObject({ media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/new.mp4' });
    expect(api.media.discard).not.toHaveBeenCalled(); // the saved file stays
  });

  it('removes an unsaved upload when the form is closed', async () => {
    api.media.upload.mockResolvedValue({ bucket: 'company-media', path: 'c1/exercises/tmp.mp4', mime: 'video/mp4', kind: 'video' });
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Add exercise' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload video or picture' }));
    fireEvent.change(screen.getByLabelText('Choose a video or picture'), { target: { files: [new File(['abc'], 'a.mp4', { type: 'video/mp4' })] } });
    expect(await screen.findByText('a.mp4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(api.media.discard).toHaveBeenCalledWith('c1/exercises/tmp.mp4'));
  });

  it('renders in Arabic', async () => {
    view('ar');
    expect(await screen.findByText('فك الرقبة')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ضيف تمرين' })).toBeInTheDocument();
    expect(screen.getByText('الرقبة')).toBeInTheDocument();
  });
});
