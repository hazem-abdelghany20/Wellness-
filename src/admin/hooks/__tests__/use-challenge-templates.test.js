import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listChallengeTemplates: vi.fn(),
  createChallengeTemplate: vi.fn(),
  updateChallengeTemplate: vi.fn(),
  setChallengeTemplateArchived: vi.fn(),
  listArticleOptions: vi.fn(),
  uploadChallengeMedia: vi.fn(),
  deleteContentAsset: vi.fn(),
}));

import {
  listChallengeTemplates, createChallengeTemplate, updateChallengeTemplate,
  setChallengeTemplateArchived, listArticleOptions, uploadChallengeMedia, deleteContentAsset,
} from '../../../lib/supabase-admin';
import { useChallengeTemplates } from '../use-challenge-templates';
import { emptyTemplateForm, TemplateValidationError } from '../../lib/habit-template.js';

const water = {
  id: 't-water', slug: 'habit-water', kind: 'habit', title_en: 'The Water Bottle', title_ar: 'قزازة المية', target: 4,
  payload: {
    category: 'hydration', action_en: 'Bottle on desk.', action_ar: 'قزازة على المكتب.',
    why_en: 'Thirst.', why_ar: 'العطش.', check_mode: 'same_day', success_days: 4,
    reminder_time: '12:00', badge_icon: 'bolt', badge_color: '#6FB7D9',
  },
};
const archivedWalk = { id: 't-walk', slug: 'habit-lunch-walk', kind: 'habit', title_en: 'Walk', archived_at: '2026-11-01T00:00:00Z', payload: {} };
const oldMetric = { id: 't-sleep', slug: 'sleep-sprint-21', kind: 'sleep', title_en: '21-Day Sleep Sprint', payload: {} };

const form = (over = {}) => ({
  ...emptyTemplateForm(),
  name_en: 'Desk Stretch', name_ar: 'تمدد المكتب', category: 'movement',
  action_en: 'Stretch 2 minutes.', action_ar: 'اتمدد دقيقتين.',
  why_en: 'Less stiffness.', why_ar: 'تيبس أقل.',
  ...over,
});

async function mount() {
  const hook = renderHook(() => useChallengeTemplates());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  listChallengeTemplates.mockResolvedValue([water, archivedWalk, oldMetric]);
  listArticleOptions.mockResolvedValue([{ slug: 'busy-trap', title_en: 'The busy trap', published: true }]);
});

describe('useChallengeTemplates', () => {
  it('lists templates, splits active / archived habits and hides old metric templates', async () => {
    const { result } = await mount();
    expect(result.current.templates).toHaveLength(3);
    expect(result.current.habitTemplates.map((t) => t.id)).toEqual(['t-water']);
    expect(result.current.archivedTemplates.map((t) => t.id)).toEqual(['t-walk']);
    expect(result.current.articles).toHaveLength(1);
  });

  it('still loads when the article list fails', async () => {
    listArticleOptions.mockRejectedValue(new Error('boom'));
    const { result } = await mount();
    expect(result.current.error).toBeNull();
    expect(result.current.articles).toEqual([]);
    expect(result.current.habitTemplates).toHaveLength(1);
  });

  it('keeps the raw create call', async () => {
    createChallengeTemplate.mockResolvedValue({ id: 't2', slug: 'walk' });
    const { result } = await mount();
    await act(async () => { await result.current.create({ slug: 'walk', title_en: 'Walk' }); });
    expect(createChallengeTemplate).toHaveBeenCalledWith({ slug: 'walk', title_en: 'Walk' });
  });

  it('creates a habit template from the builder form with a unique slug', async () => {
    listChallengeTemplates.mockResolvedValue([water, { ...archivedWalk, slug: 'habit-desk-stretch' }]);
    createChallengeTemplate.mockResolvedValue({ id: 't-new' });
    const { result } = await mount();
    await act(async () => { await result.current.save(form({ success_days: 3 })); });
    expect(createChallengeTemplate).toHaveBeenCalledTimes(1);
    const row = createChallengeTemplate.mock.calls[0][0];
    expect(row).toMatchObject({
      slug: 'habit-desk-stretch-2', kind: 'habit', metric: 'habit', default_window_days: 5, target: 3,
      title_en: 'Desk Stretch', title_ar: 'تمدد المكتب',
    });
    expect(row.payload).toMatchObject({ category: 'movement', success_days: 3, check_mode: 'same_day' });
    expect(updateChallengeTemplate).not.toHaveBeenCalled();
    expect(listChallengeTemplates).toHaveBeenCalledTimes(2);
  });

  it('retries once with a new slug when the slug was just taken', async () => {
    createChallengeTemplate
      .mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }))
      .mockResolvedValueOnce({ id: 't-new' });
    const { result } = await mount();
    await act(async () => { await result.current.save(form()); });
    expect(createChallengeTemplate).toHaveBeenCalledTimes(2);
    const [first, second] = createChallengeTemplate.mock.calls.map((c) => c[0].slug);
    expect(first).toBe('habit-desk-stretch');
    expect(second).toMatch(/^habit-desk-stretch-[a-z0-9]+$/);
  });

  it('does not retry other insert errors', async () => {
    createChallengeTemplate.mockRejectedValue(Object.assign(new Error('permission denied'), { code: '42501' }));
    const { result } = await mount();
    await expect(result.current.save(form())).rejects.toThrow('permission denied');
    expect(createChallengeTemplate).toHaveBeenCalledTimes(1);
  });

  it('updates an existing template by id, keeping its slug and other payload keys', async () => {
    updateChallengeTemplate.mockResolvedValue({ id: 't-water' });
    const { result } = await mount();
    const edit = {
      ...form({ name_en: 'Water Bottle', category: 'hydration' }),
      media_mode: 'youtube', youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
    };
    await act(async () => { await result.current.save(edit, water); });
    expect(updateChallengeTemplate).toHaveBeenCalledTimes(1);
    const [id, patch] = updateChallengeTemplate.mock.calls[0];
    expect(id).toBe('t-water');
    expect(patch).not.toHaveProperty('slug');
    expect(patch.title_en).toBe('Water Bottle');
    expect(patch.payload).toMatchObject({
      reminder_time: '12:00', badge_icon: 'bolt', media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ',
    });
    expect(createChallengeTemplate).not.toHaveBeenCalled();
  });

  it('refuses an incomplete form without calling Supabase', async () => {
    const { result } = await mount();
    await expect(result.current.save(form({ why_ar: '' }))).rejects.toBeInstanceOf(TemplateValidationError);
    await expect(result.current.save(form({ success_days: 6 }))).rejects.toMatchObject({ fieldErrors: { success_days: expect.any(Object) } });
    expect(createChallengeTemplate).not.toHaveBeenCalled();
    expect(updateChallengeTemplate).not.toHaveBeenCalled();
  });

  it('archives and restores templates, then refreshes', async () => {
    setChallengeTemplateArchived.mockResolvedValue({});
    const { result } = await mount();
    await act(async () => { await result.current.archive('t-water'); });
    expect(setChallengeTemplateArchived).toHaveBeenLastCalledWith('t-water', true);
    await act(async () => { await result.current.restore('t-walk'); });
    expect(setChallengeTemplateArchived).toHaveBeenLastCalledWith('t-walk', false);
    expect(listChallengeTemplates).toHaveBeenCalledTimes(3);
    expect(result.current.loading).toBe(false);
  });

  it('validates a file, then uploads it with its content type and progress', async () => {
    uploadChallengeMedia.mockImplementation(async (_f, opts) => {
      opts.onProgress?.(50);
      return { path: 'challenges/1-abc.mov', publicUrl: 'https://cdn/challenges/1-abc.mov' };
    });
    const onProgress = vi.fn();
    const { result } = await mount();
    const mov = { name: 'how.mov', type: 'video/quicktime', size: 1024 };
    let media;
    await act(async () => { media = await result.current.uploadMedia(mov, { onProgress }); });
    expect(uploadChallengeMedia).toHaveBeenCalledWith(mov, expect.objectContaining({ contentType: 'video/quicktime', onProgress }));
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(media).toEqual({ type: 'video', url: 'https://cdn/challenges/1-abc.mov', path: 'challenges/1-abc.mov', mime: 'video/quicktime' });
  });

  it('never uploads a file that is too big or the wrong type', async () => {
    const { result } = await mount();
    await expect(result.current.uploadMedia({ name: 'big.mp4', type: 'video/mp4', size: 51 * 1024 * 1024 }))
      .rejects.toMatchObject({ userMessage: { en: expect.stringMatching(/50 MB/) } });
    await expect(result.current.uploadMedia({ name: 'a.gif', type: 'image/gif', size: 10 }))
      .rejects.toMatchObject({ userMessage: { en: expect.stringMatching(/PNG or JPEG/) } });
    expect(uploadChallengeMedia).not.toHaveBeenCalled();
  });

  it('discards an unsaved upload and ignores cleanup failures', async () => {
    deleteContentAsset.mockRejectedValue(new Error('gone'));
    const { result } = await mount();
    await expect(result.current.discardMedia('challenges/1-abc.mp4')).resolves.toBeUndefined();
    expect(deleteContentAsset).toHaveBeenCalledWith('challenges/1-abc.mp4');
    await result.current.discardMedia(null);
    expect(deleteContentAsset).toHaveBeenCalledTimes(1);
  });
});
