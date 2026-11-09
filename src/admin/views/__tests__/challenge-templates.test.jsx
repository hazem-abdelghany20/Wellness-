import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const hook = {
  templates: [], habitTemplates: [], archivedTemplates: [], articles: [],
  loading: false, error: null,
  save: vi.fn(), archive: vi.fn(), restore: vi.fn(), uploadMedia: vi.fn(), discardMedia: vi.fn(),
};
vi.mock('../../hooks/use-challenge-templates.js', () => ({ useChallengeTemplates: () => hook }));

import { AdminChallengeTemplatesView } from '../challenge-templates.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';

const water = {
  id: 't-water', slug: 'habit-water', kind: 'habit', title_en: 'The Water Bottle', title_ar: 'قزازة المية', target: 4,
  payload: {
    category: 'hydration', action_en: 'Keep a bottle on your desk.', action_ar: 'قزازة مية على مكتبك.',
    why_en: 'Thirst feels like tiredness.', why_ar: 'العطش بيبان كإنه تعب.',
    check_mode: 'same_day', success_days: 4, badge_icon: 'bolt', badge_color: '#6FB7D9',
    media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ',
  },
};

const view = (lang = 'en') => render(<AdminChallengeTemplatesView theme={HR_THEMES.light} density="comfortable" lang={lang}/>);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(hook, {
    habitTemplates: [water], archivedTemplates: [{ ...water, id: 't-old', title_en: 'Old one', archived_at: '2026-11-01' }],
    articles: [{ slug: 'busy-trap', title_en: 'The busy trap', title_ar: 'فخ الانشغال', published: true }],
  });
  hook.save.mockResolvedValue({ id: 'new' });
  hook.archive.mockResolvedValue();
  hook.restore.mockResolvedValue();
});

describe('Admin habit template builder', () => {
  it('lists templates with category and media, and archives after a confirm', async () => {
    view();
    expect(screen.getByText('The Water Bottle')).toBeInTheDocument();
    expect(screen.getByText('Hydration')).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, archive' }));
    await waitFor(() => expect(hook.archive).toHaveBeenCalledWith('t-water'));
    fireEvent.click(screen.getByRole('button', { name: 'Archived (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(hook.restore).toHaveBeenCalledWith('t-old'));
  });

  it('shows field errors instead of saving an empty form', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'New template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create template' }));
    expect(await screen.findByText('Add the name in English.')).toBeInTheDocument();
    expect(screen.getByText('Pick a category.')).toBeInTheDocument();
    expect(hook.save).not.toHaveBeenCalled();
  });

  it('updates the live preview while typing and saves the form', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'New template' }));
    const set = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    set('Name (English)', 'Desk Stretch');
    set('Name (Arabic)', 'تمدد المكتب');
    set('The daily action (English)', 'Stretch for two minutes.');
    set('The daily action (Arabic)', 'اتمدد دقيقتين.');
    set('Why it helps (English)', 'Less stiffness.');
    set('Why it helps (Arabic)', 'تيبس أقل.');
    fireEvent.click(screen.getByRole('button', { name: /Movement/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next morning/ }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: 'YouTube link' }));
    set('YouTube link', 'https://youtube.com/shorts/dQw4w9WgXcQ');
    expect(screen.getByText('YouTube video found.')).toBeInTheDocument();

    // preview: title, action, evening button label, the embed and the day count
    expect(screen.getAllByText('Desk Stretch').length).toBeGreaterThan(0);
    expect(screen.getByText('✓ Did it last night')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 days for the reward')).toBeInTheDocument();
    expect(document.querySelector('iframe')?.getAttribute('src')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');

    fireEvent.click(screen.getByRole('button', { name: 'Create template' }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    const [form, existing] = hook.save.mock.calls[0];
    expect(existing).toBeNull();
    expect(form).toMatchObject({ name_en: 'Desk Stretch', category: 'movement', check_mode: 'next_morning', success_days: 3, media_mode: 'youtube' });
    expect(await screen.findByText('Template created. HR can pick it now.')).toBeInTheDocument();
  });

  it('rejects a non-YouTube link with a clear message', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'New template' }));
    fireEvent.click(screen.getByRole('button', { name: 'YouTube link' }));
    fireEvent.change(screen.getByLabelText('YouTube link'), { target: { value: 'https://vimeo.com/123' } });
    expect(screen.getByText(/That is not a YouTube video link/)).toBeInTheDocument();
  });

  it('opens an existing template for editing and uploads a replacement file', async () => {
    hook.uploadMedia.mockResolvedValue({ type: 'video', url: 'https://cdn/challenges/1.mp4', path: 'challenges/1.mp4', mime: 'video/mp4' });
    const { container } = view();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Name (English)')).toHaveValue('The Water Bottle');
    fireEvent.click(screen.getByRole('button', { name: 'Upload video or image' }));
    const input = container.querySelector('input[type="file"]');
    const file = new File(['x'], 'how.mp4', { type: 'video/mp4' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(hook.uploadMedia).toHaveBeenCalledWith(file, expect.objectContaining({ onProgress: expect.any(Function) })));
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://cdn/challenges/1.mp4');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    expect(hook.save.mock.calls[0][1]).toBe(water);
    expect(hook.discardMedia).not.toHaveBeenCalled();
  });

  it('blocks a file over 50 MB before uploading', () => {
    const { container } = view();
    fireEvent.click(screen.getByRole('button', { name: 'New template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload video or image' }));
    const big = new File(['x'], 'big.mp4', { type: 'video/mp4' });
    Object.defineProperty(big, 'size', { value: 60 * 1024 * 1024 });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [big] } });
    expect(screen.getByText('That file is 60 MB. The limit is 50 MB.')).toBeInTheDocument();
    expect(hook.uploadMedia).not.toHaveBeenCalled();
  });

  it('drops an unsaved upload when the builder is cancelled', async () => {
    hook.uploadMedia.mockResolvedValue({ type: 'image', url: 'https://cdn/challenges/2.png', path: 'challenges/2.png', mime: 'image/png' });
    const { container } = view();
    fireEvent.click(screen.getByRole('button', { name: 'New template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload video or image' }));
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await screen.findByRole('button', { name: 'Replace' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(hook.discardMedia).toHaveBeenCalledWith('challenges/2.png');
  });

  it('renders in Arabic', () => {
    view('ar');
    expect(screen.getByText('مكتبة العادات')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'قالب جديد' }));
    expect(screen.getByText('الإجراء اليومي')).toBeInTheDocument();
    expect(screen.getByText('تحدي الأسبوع')).toBeInTheDocument();
  });
});
