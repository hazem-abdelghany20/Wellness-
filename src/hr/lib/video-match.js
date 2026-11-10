// "Upload many videos": which picked file goes to which exercise. Pure
// functions around matchFilesToExercises() (src/lib/supabase-routines.ts).
import { matchFilesToExercises } from '../../lib/supabase-routines';
import { checkFile } from '../../shared/authoring/media-form.js';
import { msg, pickLang } from '../../shared/authoring/text.js';

export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov,image/png,image/jpeg,.png,.jpg,.jpeg';
export const MAX_BULK_FILES = 200;

const hasMedia = (ex) => !!(ex && ex.media_type);

// The exercises HR can give a video to: the company's own, not archived
// (Wellness House exercises are read-only — "Use this" makes a copy first).
export function editableExercises(exercises) {
  return (exercises || []).filter((e) => e && e.id && e.scope !== 'public' && e.can_edit !== false && e.status !== 'archived');
}

// Exercise picker options, by name in the UI language.
export function exerciseOptions(exercises, lang) {
  return editableExercises(exercises)
    .map((e) => ({ id: e.id, label: pickLang(lang, e.name_en, e.name_ar), hasMedia: hasMedia(e) }))
    .sort((a, b) => a.label.localeCompare(b.label, lang === 'ar' ? 'ar' : 'en'));
}

// Picked files → table rows { key, file, name, exerciseId, auto, error }.
// Same file name twice: the second is dropped (it would overwrite the first).
export function buildMatchRows(files, exercises) {
  const list = Array.from(files || []).filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const f of list) {
    const name = String(f.name || '');
    if (seen.has(name)) continue;
    seen.add(name);
    unique.push(f);
  }
  const pool = editableExercises(exercises);
  const { matched } = matchFilesToExercises(unique.map((f) => String(f.name || '')), pool);
  return unique.slice(0, MAX_BULK_FILES).map((file, i) => {
    const check = checkFile(file, ['video', 'image']);
    const id = matched[String(file.name || '')] || '';
    return {
      key: `${i}-${file.name}`,
      file,
      name: String(file.name || ''),
      exerciseId: check.ok ? id : '',
      auto: !!id,
      error: check.ok ? null : check.error,
    };
  });
}

// Each row's status for the table and the counts for the button.
//   ready     → will be uploaded and set
//   unmatched → no exercise picked yet (skipped)
//   invalid   → wrong type / too big (skipped)
//   duplicate → another file already goes to that exercise (skipped)
//   kept      → the exercise already has a video and "replace" is off (skipped)
export function planUploads(rows, exercises, { overwrite = false } = {}) {
  const byId = new Map(editableExercises(exercises).map((e) => [e.id, e]));
  const taken = new Set();
  const out = (rows || []).map((row) => {
    let status = 'ready';
    if (row.error) status = 'invalid';
    else if (!row.exerciseId || !byId.has(row.exerciseId)) status = 'unmatched';
    else if (taken.has(row.exerciseId)) status = 'duplicate';
    else if (!overwrite && hasMedia(byId.get(row.exerciseId))) status = 'kept';
    if (status === 'ready' || status === 'kept') taken.add(row.exerciseId);
    return { ...row, status };
  });
  const count = (st) => out.filter((r) => r.status === st).length;
  return {
    rows: out,
    ready: count('ready'),
    unmatched: count('unmatched'),
    invalid: count('invalid'),
    duplicate: count('duplicate'),
    kept: count('kept'),
  };
}

export const ROW_STATUS = {
  ready: msg('Ready', 'جاهز'),
  unmatched: msg('Pick the exercise', 'اختار التمرين'),
  invalid: msg('Can’t use this file', 'الملف ده مينفعش'),
  duplicate: msg('Another file is already going to this exercise', 'فيه ملف تاني رايح للتمرين ده'),
  kept: msg('Already has a video (kept)', 'عنده فيديو بالفعل (هيفضل)'),
  uploading: msg('Uploading…', 'جارٍ الرفع…'),
  uploaded: msg('Uploaded', 'اترفع'),
  failed: msg('Upload failed', 'الرفع فشل'),
  done: msg('Video added', 'الفيديو اتضاف'),
};

// setExercisesMedia skip reasons → message.
const SKIP_REASONS = {
  exercise_not_found: msg('The exercise no longer exists.', 'التمرين مبقاش موجود.'),
  public_item_read_only: msg('Wellness House exercise: tap “Use this” for a copy first.', 'تمرين من Wellness House: دوس «استخدمه» علشان تاخد نسخة الأول.'),
  has_media: msg('Already has a video (kept).', 'عنده فيديو بالفعل (هيفضل).'),
  duplicate: msg('Another file already went to this exercise.', 'فيه ملف تاني راح للتمرين ده.'),
  bad_media_mime: msg('Use an MP4 or MOV video, or a PNG or JPEG picture.', 'استخدم فيديو MP4 أو MOV، أو صورة PNG أو JPEG.'),
  media_path_outside_company: msg('Upload the file again.', 'ارفع الملف تاني.'),
};
export function skipReasonText(reason, lang) {
  const m = SKIP_REASONS[reason] || msg('Not saved.', 'متحفظش.');
  return lang === 'ar' ? m.ar : m.en;
}

// Exercises in the list that still have no demo (names), for a hint.
export function exercisesWithoutMedia(exercises, lang) {
  return editableExercises(exercises).filter((e) => !hasMedia(e)).map((e) => pickLang(lang, e.name_en, e.name_ar));
}
