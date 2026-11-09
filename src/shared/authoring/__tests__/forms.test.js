import { describe, it, expect } from 'vitest';
import {
  emptyExerciseForm, exerciseToForm, validateExerciseForm, buildExerciseInput, toggleArea,
  filterExercises, exerciseMediaKind,
} from '../exercise-form.js';
import { checkFile, validateMedia, mediaFields, mediaToForm, uploadError } from '../media-form.js';
import {
  defaultSuccessDays, challengeDays, challengeEnd, emptyChallengeForm, setWeeks, validateChallengeForm,
  buildChallengeInput, challengeToForm, templateWeeks, templateSuccessDays, payloadMediaKind,
} from '../challenge-form.js';
import { emptyContentForm, validateContentForm, buildContentInput, readingMinutes } from '../content-form.js';
import { libraryError } from '../errors.js';
import { upcomingSunday, normalizeTime, addMinutes, fmtDate, addDays } from '../text.js';

const upload = { bucket: 'company-media', path: 'c1/exercises/1.mp4', mime: 'video/mp4', kind: 'video', name: 'neck.mp4' };

describe('exercise form', () => {
  it('needs only an English name', () => {
    expect(validateExerciseForm(emptyExerciseForm()).name_en.en).toBe('Add the name in English.');
    const f = { ...emptyExerciseForm(), name_en: 'Neck release' };
    expect(validateExerciseForm(f)).toEqual({});
    expect(buildExerciseInput(f)).toEqual({
      name_en: 'Neck release', name_ar: null, how_en: null, how_ar: null, helps_en: null, helps_ar: null,
      body_areas: [], default_sets_reps: null, default_sets_reps_ar: null,
      media_type: null, media_bucket: null, media_path: null, media_mime: null, media_youtube_id: null,
    });
  });

  it('builds an upload or a YouTube demo, and public only for a new admin row', () => {
    const f = { ...emptyExerciseForm(), name_en: ' Wall push-ups ', sets_reps: '3 × 10', body_areas: ['chest', 'arms'],
      media: { mode: 'upload', file: upload, youtube_url: '' } };
    const input = buildExerciseInput(f, { isPublic: true });
    expect(input).toMatchObject({ name_en: 'Wall push-ups', default_sets_reps: '3 × 10', body_areas: ['chest', 'arms'],
      media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/1.mp4', media_mime: 'video/mp4', public: true });
    const yt = buildExerciseInput({ ...f, id: 'e1', media: { mode: 'youtube', file: null, youtube_url: 'https://youtu.be/dQw4w9WgXcQ' } }, { isPublic: true });
    expect(yt).toMatchObject({ id: 'e1', media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ', media_path: null });
    expect(yt.public).toBeUndefined();
  });

  it('refuses a bad YouTube link or an upload choice without a file', () => {
    const base = { ...emptyExerciseForm(), name_en: 'X' };
    expect(validateExerciseForm({ ...base, media: { mode: 'youtube', youtube_url: 'https://vimeo.com/1' } }).media).toBeTruthy();
    expect(validateExerciseForm({ ...base, media: { mode: 'upload', file: null } }).media.en).toMatch(/Upload a video/);
    expect(() => buildExerciseInput({ ...base, name_en: '' })).toThrow('invalid_form');
  });

  it('round-trips a saved exercise and keeps body areas in list order', () => {
    const ex = { id: 'e1', name_en: 'Neck', name_ar: 'رقبة', body_areas: ['neck', 'bogus'], default_sets_reps: '2 × 10',
      media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ' };
    const f = exerciseToForm(ex);
    expect(f.body_areas).toEqual(['neck']);
    expect(f.media).toEqual({ mode: 'youtube', file: null, youtube_url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(toggleArea(['legs'], 'neck')).toEqual(['neck', 'legs']);
    expect(toggleArea(['neck', 'legs'], 'neck')).toEqual(['legs']);
    expect(exerciseMediaKind(ex)).toBe('youtube');
    expect(exerciseMediaKind({ media_type: 'video' })).toBe(null);
  });

  it('searches names in both languages and body areas', () => {
    const list = [
      { id: 1, name_en: 'Neck release', name_ar: 'فك الرقبة', body_areas: ['neck'] },
      { id: 2, name_en: 'Wall push-ups', name_ar: null, body_areas: ['chest'] },
    ];
    expect(filterExercises(list, 'wall').map((x) => x.id)).toEqual([2]);
    expect(filterExercises(list, 'الرقبه').map((x) => x.id)).toEqual([1]); // ة / ه folded
    expect(filterExercises(list, 'Chest').map((x) => x.id)).toEqual([2]);
    expect(filterExercises(list, '').length).toBe(2);
  });
});

describe('media checks', () => {
  it('accepts mp4 / mov / png / jpeg up to 50 MB with a clear message above it', () => {
    expect(checkFile({ name: 'a.MOV', type: '', size: 10 })).toMatchObject({ ok: true, mime: 'video/quicktime', kind: 'video' });
    expect(checkFile({ name: 'a.jpg', type: 'image/jpg', size: 10 })).toMatchObject({ ok: true, mime: 'image/jpeg' });
    expect(checkFile({ name: 'a.gif', type: 'image/gif', size: 10 }).ok).toBe(false);
    const big = checkFile({ name: 'a.mp4', type: 'video/mp4', size: 60 * 1024 * 1024 });
    expect(big.ok).toBe(false);
    expect(big.error.en).toMatch(/720p or paste a YouTube link/);
    expect(checkFile({ name: 't.pdf', type: 'application/pdf', size: 5 }, ['image', 'pdf'])).toMatchObject({ ok: true, kind: 'pdf' });
    expect(checkFile({ name: 't.pdf', type: 'application/pdf', size: 5 }).ok).toBe(false);
  });

  it('maps media to and from row fields', () => {
    expect(mediaFields({ mode: 'none' })).toMatchObject({ media_type: null });
    expect(mediaToForm({ media_type: 'video', media_bucket: 'company-media', media_path: 'c1/x/a.mp4', media_mime: 'video/mp4' }).file)
      .toMatchObject({ kind: 'video', path: 'c1/x/a.mp4', name: 'a.mp4' });
    expect(validateMedia({ mode: 'none' })).toEqual({});
    expect(uploadError({ status: 413 }).en).toMatch(/50 MB/);
    expect(uploadError({ name: 'AbortError' }).en).toBe('Upload cancelled.');
  });
});

describe('HR challenge form', () => {
  it('defaults days to win to 80% of the workdays', () => {
    expect([1, 2, 3, 4].map(defaultSuccessDays)).toEqual([4, 8, 12, 16]);
    const two = setWeeks(emptyChallengeForm(), 2);
    expect(two).toMatchObject({ weeks: 2, success_days: 8 });
    expect(setWeeks({ ...two, success_days: 9, success_touched: true }, 3).success_days).toBe(9);
    expect(setWeeks({ ...two, success_days: 9, success_touched: true }, 1).success_days).toBe(4); // 9 > 5
  });

  it('lists workdays week by week, never start + i', () => {
    const days = challengeDays('2026-11-15', 2);
    expect(days).toEqual(['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
      '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']);
    expect(challengeEnd('2026-11-15', 2)).toBe('2026-11-26');
  });

  it('validates and builds the template input', () => {
    const errs = validateChallengeForm(emptyChallengeForm());
    expect(Object.keys(errs).sort()).toEqual(['action_en', 'title_en']);
    const f = { ...setWeeks(emptyChallengeForm(), 2), title_en: 'Drink water', action_en: 'Drink 6 glasses.',
      media: { mode: 'youtube', youtube_url: 'youtu.be/dQw4w9WgXcQ' } };
    expect(buildChallengeInput(f)).toEqual({
      title_en: 'Drink water', weeks: 2, success_days: 8,
      payload: { action_en: 'Drink 6 glasses.', media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ' },
    });
    expect(validateChallengeForm({ ...f, success_days: 11 }).success_days.en).toBe('Pick 1 to 10 days.');
  });

  it('clears removed text and media on an update, and keeps the Arabic name in step', () => {
    const t = { id: 't1', title_en: 'Water', title_ar: 'Water', target: 8,
      payload: { action_en: 'Drink', tip_en: 'Old tip', weeks: 2, success_days: 8, media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ' } };
    const f = challengeToForm(t);
    expect(f).toMatchObject({ title_ar: '', weeks: 2, success_days: 8, tip_en: 'Old tip' });
    const input = buildChallengeInput({ ...f, tip_en: '', media: { mode: 'none' } });
    expect(input).toMatchObject({ id: 't1', title_ar: 'Water', payload: { tip_en: '', media_type: '' } });
    expect(templateWeeks({ weeks: 3 })).toBe(3);
    expect(templateSuccessDays({ payload: {}, target: 0, weeks: 2 })).toBe(8);
    expect(payloadMediaKind({ media_type: 'video', media_bucket: 'company-media', media_path: 'c1/a.mp4' })).toBe('video');
  });
});

describe('content form', () => {
  it('needs a title and text; facts stay short', () => {
    const f = emptyContentForm('fact');
    expect(Object.keys(validateContentForm(f)).sort()).toEqual(['body_en', 'title_en']);
    expect(validateContentForm({ ...f, title_en: 'Did you know', body_ar: 'x'.repeat(301) }).body_ar.en).toMatch(/300/);
    expect(buildContentInput({ ...f, title_en: 'Did you know', body_en: 'Stand up every 30 minutes.' }, 'published'))
      .toMatchObject({ kind: 'fact', status: 'published', duration_mins: 1, description_en: null });
  });

  it('estimates reading time for articles', () => {
    expect(readingMinutes('word '.repeat(450))).toBe(2);
    expect(buildContentInput({ ...emptyContentForm(), id: 'c1', title_en: 'T', body_en: 'Hello' }, 'draft'))
      .toMatchObject({ id: 'c1', kind: 'article', status: 'draft', duration_mins: 1, category: 'general' });
  });
});

describe('library errors', () => {
  it('maps sprint 2 codes in both languages and falls back to errors.ts', () => {
    expect(libraryError({ message: 'weekday_not_workday' }, 'en')).toMatch(/isn’t a workday/);
    expect(libraryError({ message: 'bad_success_days' }, 'ar')).toMatch(/أيام الفوز/);
    expect(libraryError({ message: 'invalid_setting', details: 'timezone' }, 'en')).toBe('That value isn’t allowed for “Time zone”.');
    expect(libraryError({ message: 'unknown_setting', details: 'foo' }, 'ar')).toBe('الإعداد ده مش مسموح.');
    expect(libraryError({ message: 'already_assigned' }, 'en')).toMatch(/already have this routine/);
    expect(libraryError({ message: 'public_item_read_only' }, 'en')).toMatch(/Wellness House library/);
    expect(libraryError({ message: 'item_title_required' }, 'en')).toMatch(/exercise or a step/);
  });
});

describe('dates and times', () => {
  it('picks this Sunday (today when it is one) and normalises clock times', () => {
    expect(upcomingSunday('2026-11-09')).toBe('2026-11-15'); // Monday → next Sunday
    expect(upcomingSunday('2026-11-15')).toBe('2026-11-15');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(normalizeTime('9:30')).toBe('09:30');
    expect(normalizeTime('25:00')).toBe(null);
    expect(addMinutes('23:30', 60)).toBe('23:59');
    expect(fmtDate('2026-11-15', 'en', { weekday: 'short' })).toBe('Sun');
  });
});
