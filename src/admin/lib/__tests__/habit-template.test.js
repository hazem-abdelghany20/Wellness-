import { describe, it, expect } from 'vitest';
import {
  slugify, templateSlug, emptyTemplateForm, templateToForm, validateTemplateForm,
  buildTemplateRow, validateMediaFile, mediaUploadError, resolveBadge,
  TemplateValidationError, MAX_MEDIA_BYTES,
} from '../habit-template.js';

const validForm = (over = {}) => ({
  ...emptyTemplateForm(),
  name_en: 'Desk Stretch', name_ar: 'تمدد المكتب',
  category: 'movement',
  action_en: 'Stretch for two minutes every hour.', action_ar: 'اتمدد دقيقتين كل ساعة.',
  why_en: 'Sitting all day stiffens the back.', why_ar: 'القعدة طول اليوم بتتعب الضهر.',
  ...over,
});

const file = (name, type, size) => ({ name, type, size });

// The seeded "Water Bottle" template as stored in challenge_templates.
const seeded = {
  id: 't-water', slug: 'habit-water', title_en: 'The Water Bottle', title_ar: 'قزازة المية',
  kind: 'habit', target: 4, default_window_days: 5, metric: 'habit',
  payload: {
    category: 'hydration',
    action_en: 'Keep a bottle on your desk.', action_ar: 'قزازة مية على مكتبك.',
    why_en: 'Thirst feels like tiredness.', why_ar: 'العطش بيبان كإنه تعب.',
    tip_en: 'Keep it in sight.', tip_ar: 'خليها قدام عينك.',
    reminder_en: "How's the bottle doing?", reminder_ar: 'القزازة وصلت لفين؟', reminder_time: '12:00',
    missed_en: 'Half beats none.', missed_ar: 'النص أحسن من ولا حاجة.',
    check_mode: 'same_day', success_days: 4, article_slug: 'inside-out-performance',
    badge_icon: 'bolt', badge_color: '#6FB7D9',
  },
};

describe('slug generation', () => {
  it('turns the English name into a habit slug', () => {
    expect(slugify('Walk After Lunch!')).toBe('walk-after-lunch');
    expect(slugify('  Café   Break ')).toBe('cafe-break');
    expect(templateSlug('Walk After Lunch!', [])).toBe('habit-walk-after-lunch');
  });

  it('does not double the habit- prefix', () => {
    expect(templateSlug('Habit Water', [])).toBe('habit-water');
  });

  it('adds a number when the slug is taken', () => {
    expect(templateSlug('Water', ['habit-water'])).toBe('habit-water-2');
    expect(templateSlug('Water', ['habit-water', 'HABIT-WATER-2'])).toBe('habit-water-3');
  });

  it('falls back when the name has no latin letters', () => {
    expect(templateSlug('قزازة المية', [])).toBe('habit');
    expect(templateSlug('قزازة المية', ['habit'])).toBe('habit-2');
  });

  it('keeps slugs short', () => {
    expect(templateSlug('a'.repeat(200), []).length).toBeLessThanOrEqual(56);
  });
});

describe('validateTemplateForm', () => {
  it('passes a complete form', () => {
    expect(validateTemplateForm(validForm())).toEqual({});
  });

  it('requires name, category, action and why in both languages', () => {
    const e = validateTemplateForm(emptyTemplateForm());
    expect(Object.keys(e).sort()).toEqual(
      ['action_ar', 'action_en', 'category', 'name_ar', 'name_en', 'why_ar', 'why_en'].sort());
    expect(e.name_ar.en).toMatch(/Arabic/);
    expect(e.name_ar.ar).toBeTruthy();
  });

  it('treats whitespace as empty', () => {
    expect(validateTemplateForm(validForm({ action_ar: '   ' })).action_ar).toBeTruthy();
  });

  it('wants the tip in both languages or neither', () => {
    expect(validateTemplateForm(validForm({ tip_en: 'Use a timer.' })).tip).toBeTruthy();
    expect(validateTemplateForm(validForm({ tip_ar: 'استخدم منبه.' })).tip).toBeTruthy();
    expect(validateTemplateForm(validForm({ tip_en: 'Use a timer.', tip_ar: 'استخدم منبه.' })).tip).toBeUndefined();
  });

  it('caps text length', () => {
    expect(validateTemplateForm(validForm({ name_en: 'x'.repeat(81) })).name_en.en).toMatch(/80/);
  });

  it('keeps success days between 1 and 5 whole days', () => {
    for (const bad of [0, 6, -1, 2.5, 'x', null]) {
      expect(validateTemplateForm(validForm({ success_days: bad })).success_days).toBeTruthy();
    }
    for (const ok of [1, 3, 5, '4']) {
      expect(validateTemplateForm(validForm({ success_days: ok })).success_days).toBeUndefined();
    }
  });

  it('only allows the two check modes', () => {
    expect(validateTemplateForm(validForm({ check_mode: 'weekly' })).check_mode).toBeTruthy();
    expect(validateTemplateForm(validForm({ check_mode: 'next_morning' })).check_mode).toBeUndefined();
  });

  it('needs an uploaded file in upload mode', () => {
    expect(validateTemplateForm(validForm({ media_mode: 'upload', media: null })).media).toBeTruthy();
    expect(validateTemplateForm(validForm({
      media_mode: 'upload', media: { type: 'video', url: 'https://cdn/x.mp4', path: 'challenges/x.mp4' },
    })).media).toBeUndefined();
  });

  it('needs a real YouTube link in YouTube mode', () => {
    expect(validateTemplateForm(validForm({ media_mode: 'youtube', youtube_url: '' })).media.en).toMatch(/Paste/);
    expect(validateTemplateForm(validForm({ media_mode: 'youtube', youtube_url: 'https://vimeo.com/1' })).media.ar).toMatch(/يوتيوب/);
    expect(validateTemplateForm(validForm({ media_mode: 'youtube', youtube_url: 'https://youtu.be/dQw4w9WgXcQ' })).media).toBeUndefined();
  });
});

describe('buildTemplateRow', () => {
  it('builds a new habit row with the payload keys the app reads', () => {
    const row = buildTemplateRow(validForm({ tip_en: 'Use a timer.', tip_ar: 'استخدم منبه.', success_days: 3, article_slug: 'busy-trap' }),
      { existingSlugs: ['habit-desk-stretch'] });
    expect(row).toMatchObject({
      slug: 'habit-desk-stretch-2', title_en: 'Desk Stretch', title_ar: 'تمدد المكتب',
      kind: 'habit', metric: 'habit', default_window_days: 5, target: 3,
    });
    expect(row.payload).toEqual({
      category: 'movement',
      action_en: 'Stretch for two minutes every hour.', action_ar: 'اتمدد دقيقتين كل ساعة.',
      why_en: 'Sitting all day stiffens the back.', why_ar: 'القعدة طول اليوم بتتعب الضهر.',
      tip_en: 'Use a timer.', tip_ar: 'استخدم منبه.',
      check_mode: 'same_day', success_days: 3, article_slug: 'busy-trap',
      badge_icon: 'activity', badge_color: '#8BBF7A',
    });
  });

  it('throws field errors instead of building an invalid row', () => {
    expect(() => buildTemplateRow(validForm({ name_ar: '' }))).toThrow(TemplateValidationError);
    try { buildTemplateRow(validForm({ success_days: 9 })); } catch (e) { expect(e.fieldErrors.success_days).toBeTruthy(); }
  });

  it('adds uploaded media keys', () => {
    const row = buildTemplateRow(validForm({
      media_mode: 'upload',
      media: { type: 'video', url: 'https://cdn/c.mov', path: 'challenges/c.mov', mime: 'video/quicktime' },
    }));
    expect(row.payload).toMatchObject({
      media_type: 'video', media_url: 'https://cdn/c.mov', media_path: 'challenges/c.mov', media_mime: 'video/quicktime',
    });
    expect(row.payload.media_youtube_id).toBeUndefined();
  });

  it('stores only the YouTube video id', () => {
    const row = buildTemplateRow(validForm({ media_mode: 'youtube', youtube_url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share' }));
    expect(row.payload.media_type).toBe('youtube');
    expect(row.payload.media_youtube_id).toBe('dQw4w9WgXcQ');
    expect(row.payload.media_url).toBeUndefined();
  });

  it('edits keep the slug and untouched keys, and drop removed fields', () => {
    const existing = { ...seeded, payload: { ...seeded.payload, media_type: 'video', media_url: 'https://cdn/old.mp4', media_path: 'challenges/old.mp4' } };
    const form = { ...templateToForm(existing), tip_en: '', tip_ar: '', article_slug: '', media_mode: 'none', name_en: 'Water Bottle' };
    const row = buildTemplateRow(form, { existing });
    expect(row.slug).toBeUndefined();
    expect(row.title_en).toBe('Water Bottle');
    expect(row.payload).toMatchObject({
      reminder_en: "How's the bottle doing?", reminder_time: '12:00', missed_ar: 'النص أحسن من ولا حاجة.',
      badge_icon: 'bolt', badge_color: '#6FB7D9', category: 'hydration',
    });
    for (const k of ['tip_en', 'tip_ar', 'article_slug', 'media_type', 'media_url', 'media_path']) {
      expect(row.payload).not.toHaveProperty(k);
    }
  });

  it('switching media from upload to YouTube clears the file keys', () => {
    const existing = { ...seeded, payload: { ...seeded.payload, media_type: 'image', media_url: 'https://cdn/a.png', media_path: 'challenges/a.png', media_mime: 'image/png' } };
    const row = buildTemplateRow({ ...templateToForm(existing), media_mode: 'youtube', youtube_url: 'youtu.be/dQw4w9WgXcQ' }, { existing });
    expect(row.payload.media_type).toBe('youtube');
    expect(row.payload).not.toHaveProperty('media_url');
    expect(row.payload).not.toHaveProperty('media_mime');
  });
});

describe('templateToForm', () => {
  it('reads a seeded template back into the form', () => {
    const f = templateToForm(seeded);
    expect(f).toMatchObject({
      name_en: 'The Water Bottle', name_ar: 'قزازة المية', category: 'hydration',
      check_mode: 'same_day', success_days: 4, article_slug: 'inside-out-performance', media_mode: 'none',
    });
    expect(validateTemplateForm(f)).toEqual({});
  });

  it('reads YouTube and uploaded media', () => {
    expect(templateToForm({ ...seeded, payload: { ...seeded.payload, media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ' } }))
      .toMatchObject({ media_mode: 'youtube', youtube_url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(templateToForm({ ...seeded, payload: { ...seeded.payload, media_type: 'image', media_url: 'https://cdn/a.png' } }).media)
      .toMatchObject({ type: 'image', url: 'https://cdn/a.png' });
  });
});

describe('resolveBadge', () => {
  it('uses the category badge for new templates and on a category change', () => {
    expect(resolveBadge({ category: 'sleep' }, {})).toEqual({ badge_icon: 'moon', badge_color: '#9C8BD9' });
    expect(resolveBadge({ category: 'sleep' }, seeded.payload)).toEqual({ badge_icon: 'moon', badge_color: '#9C8BD9' });
  });
  it('keeps a hand-picked badge when the category stays', () => {
    expect(resolveBadge({ category: 'hydration' }, seeded.payload)).toEqual({ badge_icon: 'bolt', badge_color: '#6FB7D9' });
  });
});

describe('validateMediaFile', () => {
  it('accepts one mp4/mov video or png/jpeg image', () => {
    expect(validateMediaFile(file('a.mp4', 'video/mp4', 1000))).toEqual({ ok: true, kind: 'video', mime: 'video/mp4' });
    expect(validateMediaFile(file('a.mov', 'video/quicktime', 1000))).toEqual({ ok: true, kind: 'video', mime: 'video/quicktime' });
    expect(validateMediaFile(file('a.png', 'image/png', 1000))).toEqual({ ok: true, kind: 'image', mime: 'image/png' });
    expect(validateMediaFile(file('a.jpg', 'image/jpeg', 1000))).toEqual({ ok: true, kind: 'image', mime: 'image/jpeg' });
    expect(validateMediaFile(file('a.jpg', 'image/jpg', 1000)).mime).toBe('image/jpeg');
  });

  it('falls back to the extension when the browser gives no type', () => {
    expect(validateMediaFile(file('clip.MOV', '', 1000))).toEqual({ ok: true, kind: 'video', mime: 'video/quicktime' });
    expect(validateMediaFile(file('clip.mp4', 'application/octet-stream', 1000)).mime).toBe('video/mp4');
  });

  it('rejects other types', () => {
    for (const f of [file('a.gif', 'image/gif', 10), file('a.webm', 'video/webm', 10), file('a.pdf', 'application/pdf', 10), file('a', '', 10)]) {
      const r = validateMediaFile(f);
      expect(r.ok).toBe(false);
      expect(r.error.en).toMatch(/MP4 or MOV/);
      expect(r.error.ar).toBeTruthy();
    }
  });

  it('enforces the 50 MB cap', () => {
    expect(validateMediaFile(file('a.mp4', 'video/mp4', MAX_MEDIA_BYTES)).ok).toBe(true);
    const big = validateMediaFile(file('a.mp4', 'video/mp4', MAX_MEDIA_BYTES + 1));
    expect(big.ok).toBe(false);
    expect(big.error.en).toMatch(/50 MB/);
    expect(validateMediaFile(file('a.mp4', 'video/mp4', 80 * 1024 * 1024)).error.en).toMatch(/80 MB/);
  });

  it('rejects empty files and no file', () => {
    expect(validateMediaFile(file('a.mp4', 'video/mp4', 0)).ok).toBe(false);
    expect(validateMediaFile(null).ok).toBe(false);
  });
});

describe('mediaUploadError', () => {
  it('maps storage failures to admin-facing messages', () => {
    expect(mediaUploadError({ status: 413 }).en).toMatch(/50 MB/);
    expect(mediaUploadError({ status: 400, message: 'mime type video/webm is not supported' }).en).toMatch(/MP4/);
    expect(mediaUploadError({ status: 403, message: 'new row violates row-level security policy' }).en).toMatch(/Wellness House admins/);
    expect(mediaUploadError({ name: 'AbortError' }).en).toMatch(/cancelled/);
    expect(mediaUploadError({ status: 0, message: 'Network error' }).en).toMatch(/connection/);
    const own = { en: 'x', ar: 'y' };
    expect(mediaUploadError({ userMessage: own })).toBe(own);
  });
});
