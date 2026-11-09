import { describe, it, expect } from 'vitest';
import {
  buildMatchRows, planUploads, exerciseOptions, editableExercises, skipReasonText, exercisesWithoutMedia,
} from '../video-match.js';

const neck = { id: 'ex-neck', scope: 'company', status: 'published', name_en: 'Neck release', name_ar: 'فك الرقبة', media_type: null };
const wall = { id: 'ex-wall', scope: 'company', status: 'published', name_en: 'Wall push-ups', name_ar: null, media_type: 'video' };
const ankle = { id: 'ex-ankle', scope: 'company', status: 'published', name_en: 'Ankle circles', name_ar: null, media_type: null };
const pub = { id: 'ex-pub', scope: 'public', status: 'published', name_en: 'Shoulder rolls', media_type: null, can_edit: false };
const old = { id: 'ex-old', scope: 'company', status: 'archived', name_en: 'Old stretch', media_type: null };
const exercises = [neck, wall, ankle, pub, old];

const file = (name, { type = 'video/mp4', size = 1000 } = {}) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('which exercises can get a video', () => {
  it('keeps only the company’s own, not archived', () => {
    expect(editableExercises(exercises).map((e) => e.id)).toEqual(['ex-neck', 'ex-wall', 'ex-ankle']);
    expect(exerciseOptions(exercises, 'en').map((o) => o.label)).toEqual(['Ankle circles', 'Neck release', 'Wall push-ups']);
    expect(exerciseOptions(exercises, 'ar').find((o) => o.id === 'ex-neck').label).toBe('فك الرقبة');
    expect(exercisesWithoutMedia(exercises, 'en')).toEqual(['Neck release', 'Ankle circles']);
  });
});

describe('matching files to exercises', () => {
  it('matches by name (case, punctuation, Arabic, extension ignored) and leaves the rest', () => {
    const rows = buildMatchRows([
      file('Neck_RELEASE.MP4'), file('فك الرقبة.mov'), file('ankle-circles.mp4'), file('Shoulder rolls.mp4'), file('random.mp4'),
    ], exercises);
    expect(rows.map((r) => [r.name, r.exerciseId, r.auto])).toEqual([
      ['Neck_RELEASE.MP4', 'ex-neck', true],
      ['فك الرقبة.mov', 'ex-neck', true],
      ['ankle-circles.mp4', 'ex-ankle', true],
      ['Shoulder rolls.mp4', '', false],   // Wellness House exercise: read-only
      ['random.mp4', '', false],
    ]);
  });

  it('drops a repeated file name and flags bad files', () => {
    const rows = buildMatchRows([
      file('Neck release.mp4'), file('Neck release.mp4'), file('notes.pdf', { type: 'application/pdf' }), file('Ankle circles.mp4', { size: 60 * 1024 * 1024 }),
    ], exercises);
    expect(rows).toHaveLength(3);
    expect(rows[1].error.en).toMatch(/MP4 or MOV/);
    expect(rows[2].error.en).toMatch(/limit is 50 MB/);
    expect(rows[2].exerciseId).toBe('');
  });
});

describe('the upload plan', () => {
  const rows = () => buildMatchRows([
    file('Neck release.mp4'), file('neck-release-take2.mp4'), file('Wall push-ups.mp4'), file('bad.txt', { type: 'text/plain' }), file('who.mp4'),
  ], exercises);

  it('marks ready / duplicate / kept / invalid / unmatched, with counts', () => {
    const r = rows();
    r[1].exerciseId = 'ex-neck'; // fixed by hand → same exercise twice
    const plan = planUploads(r, exercises, { overwrite: false });
    expect(plan.rows.map((x) => x.status)).toEqual(['ready', 'duplicate', 'kept', 'invalid', 'unmatched']);
    expect(plan).toMatchObject({ ready: 1, duplicate: 1, kept: 1, invalid: 1, unmatched: 1 });
  });

  it('replaces existing videos only when asked', () => {
    const plan = planUploads(rows(), exercises, { overwrite: true });
    expect(plan.rows.map((x) => x.status)).toEqual(['ready', 'unmatched', 'ready', 'invalid', 'unmatched']);
    expect(plan.ready).toBe(2);
  });

  it('explains what the backend skipped', () => {
    expect(skipReasonText('has_media', 'en')).toBe('Already has a video (kept).');
    expect(skipReasonText('public_item_read_only', 'ar')).toMatch(/استخدمه/);
    expect(skipReasonText('something_else', 'en')).toBe('Not saved.');
  });
});
