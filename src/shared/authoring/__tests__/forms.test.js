import { describe, it, expect } from 'vitest';
import {
  emptyExerciseForm, exerciseToForm, validateExerciseForm, buildExerciseInput, toggleArea,
  filterExercises, exerciseMediaKind,
} from '../exercise-form.js';
import { checkFile, validateMedia, mediaFields, mediaToForm, uploadError } from '../media-form.js';
import {
  defaultSuccessDays, challengeDays, challengeEnd, emptyChallengeForm, setWeeks, validateChallengeForm,
  buildChallengeInput, challengeToForm, templateWeeks, templateSuccessDays, payloadMediaKind,
  workdaysBetween, countWorkdays, daysBetween, defaultEndDate, defaultChallengeDates, defaultNeed, countableDays,
  validateSchedule, validateRoutineChallenge, buildRoutineChallengeInput, pickableRoutineRows, MAX_SPAN_DAYS,
} from '../challenge-form.js';
import { emptyContentForm, validateContentForm, buildContentInput, readingMinutes } from '../content-form.js';
import { libraryError, challengeError } from '../errors.js';
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

describe('challenge dates (sprint 4)', () => {
  it('counts only Sunday to Thursday between two dates', () => {
    expect(workdaysBetween('2026-11-15', '2026-11-19')).toEqual(['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
    expect(countWorkdays('2026-11-17', '2026-11-24')).toBe(6);   // Tue → next Tue: Tue Wed Thu + Sun Mon Tue
    expect(countWorkdays('2026-11-20', '2026-11-21')).toBe(0);   // Friday + Saturday
    expect(countWorkdays('2026-11-19', '2026-11-19')).toBe(1);   // one Thursday
    expect(countWorkdays('2026-11-15', '2026-12-19')).toBe(25);  // 5 full weeks
    expect(countWorkdays('2026-11-19', '2026-11-15')).toBe(0);   // end before start
    expect(countWorkdays('', '2026-11-15')).toBe(0);
    expect(daysBetween('2026-11-15', '2026-12-19')).toBe(MAX_SPAN_DAYS);
  });

  it('defaults to the coming Sunday → that Thursday, or the template’s last Thursday', () => {
    expect(defaultChallengeDates('2026-11-16')).toEqual({ startDate: '2026-11-22', endDate: '2026-11-26' }); // a Monday
    expect(defaultChallengeDates('2026-11-15')).toEqual({ startDate: '2026-11-15', endDate: '2026-11-19' }); // a Sunday: today
    expect(defaultChallengeDates('2026-11-16', 3)).toEqual({ startDate: '2026-11-22', endDate: '2026-12-10' });
    expect(defaultEndDate('2026-11-15', 2)).toBe(challengeEnd('2026-11-15', 2));
    expect(defaultEndDate('2026-11-17')).toBe('2026-11-19');   // Tuesday → that Thursday
    expect(defaultEndDate('2026-11-19')).toBe('2026-11-19');   // Thursday → the same day
    expect(defaultEndDate('2026-11-20')).toBe('2026-11-26');   // Friday → next Thursday
    expect(defaultEndDate('')).toBe('');
  });

  it('defaults days needed from the template, capped to the working days', () => {
    const water = { target: 4, payload: { success_days: 4 } };
    expect(defaultNeed(water, 5)).toBe(4);
    expect(defaultNeed(water, 3)).toBe(3);     // 3 days of walking: never more than the days
    expect(defaultNeed({ payload: { weeks: 2, success_days: 8 } }, 10)).toBe(8);
    expect(defaultNeed(null, 5)).toBe(4);      // no template: 80%, like the server
    expect(defaultNeed(null, 3)).toBe(3);
    expect(defaultNeed(null, 0)).toBe(1);
  });

  it('checks the dates and the days needed before asking the server', () => {
    const ok = { startDate: '2026-11-22', endDate: '2026-11-26', successDays: 4 };
    expect(validateSchedule(ok, '2026-11-16')).toEqual({});
    expect(validateSchedule({ ...ok, startDate: '' }, '2026-11-16').startDate.en).toBe('Pick a start date.');
    expect(validateSchedule({ ...ok, endDate: '2026-11-21' }, '2026-11-16').endDate.en).toMatch(/on or after the start/);
    expect(validateSchedule({ ...ok, endDate: '2026-12-27' }, '2026-11-16').endDate.en).toBe('Keep it to 5 weeks or less.');
    expect(validateSchedule({ ...ok, endDate: '2026-12-26' }, '2026-11-16').endDate).toBeUndefined(); // exactly 5 weeks
    expect(validateSchedule(ok, '2026-11-27').endDate.en).toMatch(/already over/);
    expect(validateSchedule({ ...ok, startDate: '2026-11-15' }, '2026-11-24')).toEqual({}); // started earlier, still running
    expect(validateSchedule({ startDate: '2026-11-20', endDate: '2026-11-21', successDays: 1 }, '2026-11-16').endDate.en).toMatch(/no working day/);
    expect(validateSchedule({ ...ok, successDays: 6 }, '2026-11-16').successDays.en).toBe('Pick 1 to 5 days.');
    expect(validateSchedule({ ...ok, successDays: '' }, '2026-11-16').successDays.ar).toBe('اختار من ١ لـ 5 يوم.');
    expect(validateSchedule({ ...ok, successDays: 2, maxDays: 1 }, '2026-11-16').successDays.en).toBe('Only 1 day can count in these dates.');
    expect(validateSchedule({ ...ok, successDays: 1, maxDays: 0 }, '2026-11-16').successDays.en).toMatch(/not due on any of these days/);
  });

  it('builds a challenge from routine rows: 1–20 rows, a name, the days that can count', () => {
    const detail = { routine: { workdays: [0, 1, 2, 3] }, items: [
      { id: 'i1', at_time: '09:00:00', weekday: null, title_en: null, exercise: { name_en: 'Neck release', name_ar: 'فك الرقبة' } },
      { id: 'i2', at_time: null, weekday: 2, title_en: 'Walk 10 minutes', title_ar: null, exercise: null },
      { id: 'i3', at_time: '11:00', weekday: null, hidden_at: '2026-11-15T08:00:00Z', exercise: { name_en: 'Squats' } },
    ] };
    expect(pickableRoutineRows(detail, 'en')).toEqual([
      { id: 'i1', time: '09:00', weekday: null, title: 'Neck release' },
      { id: 'i2', time: '', weekday: 2, title: 'Walk 10 minutes' },
    ]); // the hidden row is not offered
    expect(pickableRoutineRows(detail, 'ar')[0].title).toBe('فك الرقبة');

    const week = workdaysBetween('2026-11-22', '2026-11-26');
    expect(countableDays(week, [{ weekday: null }], [0, 1, 2, 3])).toHaveLength(4);  // Thursday isn't a routine day
    expect(countableDays(week, [{ weekday: 2 }], [0, 1, 2, 3])).toEqual(['2026-11-24']); // only Tuesday
    expect(countableDays(week, [{ weekday: 2 }, { weekday: 0 }])).toHaveLength(2);
    expect(countableDays(week, [])).toEqual([]);

    const form = { title_en: ' Stretch week ', title_ar: '', routineId: 'r1', itemIds: ['i1', 'i2'],
      startDate: '2026-11-22', endDate: '2026-11-26', successDays: 4, teamId: '' };
    expect(validateRoutineChallenge(form, '2026-11-16')).toEqual({});
    expect(Object.keys(validateRoutineChallenge({ ...form, title_en: '', itemIds: [] }, '2026-11-16')).sort()).toEqual(['items', 'title_en']);
    expect(validateRoutineChallenge({ ...form, routineId: '' }, '2026-11-16').routineId.en).toBe('Pick a routine.');
    expect(validateRoutineChallenge({ ...form, itemIds: Array.from({ length: 21 }, (_, i) => `i${i}`) }, '2026-11-16').items.en).toBe('Pick up to 20 exercises.');
    expect(validateRoutineChallenge({ ...form, title_en: 'x'.repeat(81) }, '2026-11-16').title_en.en).toMatch(/under 80/);
    expect(buildRoutineChallengeInput(form)).toEqual({
      title_en: 'Stretch week', routineItemIds: ['i1', 'i2'], startDate: '2026-11-22', endDate: '2026-11-26', successDays: 4, teamId: null,
    });
    expect(buildRoutineChallengeInput({ ...form, title_ar: 'أسبوع الإطالات', teamId: 't1' })).toMatchObject({ title_ar: 'أسبوع الإطالات', teamId: 't1' });
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

  it('maps the sprint 4 challenge codes, in both languages', () => {
    expect(libraryError({ message: 'week_in_the_past' }, 'en')).toBe('Those dates are already over. Pick later dates.');
    expect(libraryError({ message: 'only_upcoming_can_be_cancelled' }, 'en')).toBe('That challenge is already over.');
    expect(libraryError({ message: 'only_upcoming_can_be_cancelled' }, 'ar')).toBe('التحدي ده خلص بالفعل.');
    expect(libraryError({ message: 'habit_week_taken' }, 'en')).toBe('That challenge already runs on those days. Pick other dates.');
    expect(libraryError({ message: 'no_workdays' }, 'en')).toMatch(/no working day/);
    expect(libraryError({ message: 'start_required' }, 'ar')).toBe('اختار تاريخ البداية.');
    expect(libraryError({ message: 'challenge_is_automatic' }, 'en')).toMatch(/counts by itself/);
    expect(libraryError({ message: 'invalid_setting', details: 'everyone_visible' }, 'en')).toBe('That value isn’t allowed for “Everyone takes part”.');
    // The routine screens keep their own meaning of these codes…
    expect(libraryError({ message: 'bad_dates' }, 'en')).toMatch(/on or after the start date/);
    expect(libraryError({ message: 'too_many_items' }, 'en')).toMatch(/up to 100 rows/);
    // …scheduling a challenge has its own.
    expect(challengeError({ message: 'bad_dates' }, 'en')).toBe('The end date must be after the start, at most 5 weeks later.');
    expect(challengeError({ message: 'too_many_items' }, 'ar')).toBe('اختار لحد ٢٠ تمرين.');
    expect(challengeError({ message: 'item_not_found' }, 'en')).toMatch(/removed or hidden/);
    expect(challengeError({ message: 'title_required' }, 'en')).toBe('Add the name in English.');
    expect(challengeError({ message: 'title_too_long' }, 'en')).toMatch(/under 80/);
    expect(challengeError({ message: 'action_required' }, 'en')).toMatch(/tick the exercises/);
    expect(challengeError({ message: 'habit_week_taken', details: 'x | y' }, 'ar')).toBe('التحدي ده شغال بالفعل في الأيام دي. اختار تواريخ تانية.');
    expect(challengeError({ message: 'team_not_found' }, 'en')).toBe('That team no longer exists.');
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
