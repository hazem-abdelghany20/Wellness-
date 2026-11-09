// Exercise form <-> save_exercise input, validation, list filtering. Pure.
import { BODY_AREAS } from '../../lib/supabase-routines';
import { clean, orNull, msg, pickLang } from './text.js';
import { emptyMedia, mediaToForm, validateMedia, mediaFields } from './media-form.js';

export const EXERCISE_LIMITS = { name: 120, how: 500, helps: 300, setsReps: 60 };

// Quick picks under the sets × reps box.
export const SETS_REPS_PICKS = ['2 × 10', '3 × 10', '2 × 8–10', '30 sec', '1 min'];

const AREA_IDS = new Set(BODY_AREAS.map((a) => a.id));

export function bodyAreaLabel(id, lang) {
  const a = BODY_AREAS.find((x) => x.id === id);
  if (!a) return id;
  return lang === 'ar' ? a.ar : a.en;
}

export function emptyExerciseForm() {
  return {
    id: null,
    name_en: '', name_ar: '',
    how_en: '', how_ar: '',
    helps_en: '', helps_ar: '',
    body_areas: [],
    sets_reps: '',
    sets_reps_ar: '',
    media: emptyMedia(),
  };
}

export function exerciseToForm(ex) {
  if (!ex) return emptyExerciseForm();
  return {
    id: ex.id || null,
    name_en: ex.name_en || '', name_ar: ex.name_ar || '',
    how_en: ex.how_en || '', how_ar: ex.how_ar || '',
    helps_en: ex.helps_en || '', helps_ar: ex.helps_ar || '',
    body_areas: (ex.body_areas || []).filter((a) => AREA_IDS.has(a)),
    sets_reps: ex.default_sets_reps || '',
    sets_reps_ar: ex.default_sets_reps_ar || '',
    media: mediaToForm(ex),
  };
}

function maxLen(errors, key, value, max) {
  if (clean(value).length > max) errors[key] = msg(`Keep it under ${max} characters.`, `خليه أقل من ${max} حرف.`);
}

// → { field: {en, ar} }; {} when it can be saved.
export function validateExerciseForm(form) {
  const f = form || {};
  const e = {};
  if (!clean(f.name_en)) e.name_en = msg('Add the name in English.', 'اكتب الاسم بالإنجليزي.');
  maxLen(e, 'name_en', f.name_en, EXERCISE_LIMITS.name);
  maxLen(e, 'name_ar', f.name_ar, EXERCISE_LIMITS.name);
  maxLen(e, 'how_en', f.how_en, EXERCISE_LIMITS.how);
  maxLen(e, 'how_ar', f.how_ar, EXERCISE_LIMITS.how);
  maxLen(e, 'helps_en', f.helps_en, EXERCISE_LIMITS.helps);
  maxLen(e, 'helps_ar', f.helps_ar, EXERCISE_LIMITS.helps);
  maxLen(e, 'sets_reps', f.sets_reps, EXERCISE_LIMITS.setsReps);
  if ((f.body_areas || []).some((a) => !AREA_IDS.has(a))) e.body_areas = msg('Pick body areas from the list.', 'اختار من القائمة.');
  Object.assign(e, validateMedia(f.media));
  return e;
}

export class FormError extends Error {
  constructor(fieldErrors) {
    super('invalid_form');
    this.name = 'FormError';
    this.fieldErrors = fieldErrors;
  }
}

// Form → save_exercise input. `isPublic` (Wellness House admin) only applies
// to a new exercise. Throws FormError when the form isn't valid.
export function buildExerciseInput(form, { isPublic = false } = {}) {
  const errors = validateExerciseForm(form);
  if (Object.keys(errors).length) throw new FormError(errors);
  const input = {
    name_en: clean(form.name_en),
    name_ar: orNull(form.name_ar),
    how_en: orNull(form.how_en), how_ar: orNull(form.how_ar),
    helps_en: orNull(form.helps_en), helps_ar: orNull(form.helps_ar),
    body_areas: [...new Set(form.body_areas || [])],
    default_sets_reps: orNull(form.sets_reps),
    default_sets_reps_ar: orNull(form.sets_reps_ar),
    ...mediaFields(form.media),
  };
  if (form.id) input.id = form.id;
  else if (isPublic) input.public = true;
  return input;
}

export function toggleArea(list, id) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  return BODY_AREAS.map((a) => a.id).filter((a) => set.has(a));
}

// What kind of media an exercise has: 'video' | 'image' | 'youtube' | null.
export function exerciseMediaKind(ex) {
  if (!ex) return null;
  if (ex.media_type === 'youtube') return ex.media_youtube_id ? 'youtube' : null;
  if ((ex.media_type === 'video' || ex.media_type === 'image') && (ex.media_path || ex.media_url)) return ex.media_type;
  return null;
}

// Arabic letter variants people type interchangeably.
const fold = (s) => String(s || '').toLowerCase()
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

// Search by name (either language) or body area label.
export function filterExercises(list, query, lang = 'en') {
  const q = fold(query);
  if (!q) return list || [];
  return (list || []).filter((ex) => {
    const hay = [ex.name_en, ex.name_ar, ...(ex.body_areas || []).flatMap((a) => [bodyAreaLabel(a, 'en'), bodyAreaLabel(a, 'ar')])]
      .map(fold).join(' ');
    return hay.includes(q);
  });
}

export function exerciseName(ex, lang) {
  return pickLang(lang, ex?.name_en, ex?.name_ar);
}
