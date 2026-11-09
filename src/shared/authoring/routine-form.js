// Routine builder form <-> save_routine input, validation, row helpers and
// the phone preview of a day. Pure functions.
import { WEEKDAYS } from '../../lib/supabase-routines';
import { clean, orNull, msg, pickLang, normalizeTime, addMinutes } from './text.js';

export const DEFAULT_WORKDAYS = [0, 1, 2, 3, 4]; // Sun–Thu
export const MAX_ROWS = 100;
export const ROUTINE_LIMITS = { title: 120, dayTitle: 60, setsReps: 60, rowTitle: 120 };

let keySeq = 0;
const nextKey = () => `row-${Date.now().toString(36)}-${(keySeq += 1)}`;

export function weekdayLabel(id, lang, short = false) {
  const w = WEEKDAYS.find((d) => d.id === Number(id));
  if (!w) return '';
  if (short) return lang === 'ar' ? w.short_ar : w.short_en;
  return lang === 'ar' ? w.ar : w.en;
}

// "Sun–Thu" for a contiguous run, else "Sun, Tue, Thu".
export function workdaysLabel(days, lang) {
  const list = [...new Set((days || []).map(Number))].sort((a, b) => a - b);
  if (!list.length) return '';
  const contiguous = list.length > 2 && list.every((d, i) => i === 0 || d === list[i - 1] + 1);
  if (contiguous) return `${weekdayLabel(list[0], lang, true)}–${weekdayLabel(list[list.length - 1], lang, true)}`;
  return list.map((d) => weekdayLabel(d, lang, true)).join(lang === 'ar' ? '، ' : ', ');
}

export function emptyRow(overrides = {}) {
  return {
    key: nextKey(), id: null,
    mode: 'exercise',            // 'exercise' | 'text' (a step with no exercise)
    exercise_id: '', title_en: '', title_ar: '',
    at_time: '', sets_reps: '', sets_reps_ar: '',
    weekday: null,               // null = every workday
    note_en: '', note_ar: '',
    exercise: null,              // the exercise row from routine_detail (fallback label)
    ...overrides,
  };
}

// A new row: one hour after the last timed row (09:00 for the first one).
export function newRowAfter(rows) {
  const last = [...(rows || [])].reverse().find((r) => normalizeTime(r.at_time));
  return emptyRow({ at_time: last ? addMinutes(last.at_time, 60) : '09:00' });
}

export function emptyRoutineForm() {
  return {
    id: null,
    title_en: '', title_ar: '',
    note_en: '', note_ar: '',
    workdays: [...DEFAULT_WORKDAYS],
    day_titles: {},
    source: null,                // { bucket, path, mime, name }
    status: 'published',
    rows: [],
  };
}

export function routineToForm(detail) {
  const r = detail?.routine;
  if (!r) return emptyRoutineForm();
  const titles = {};
  for (const [k, v] of Object.entries(r.day_titles || {})) {
    if (v && (v.en || v.ar)) titles[k] = { en: v.en || '', ar: v.ar || '' };
  }
  return {
    id: r.id || null,
    title_en: r.title_en || '', title_ar: r.title_ar || '',
    note_en: r.note_en || '', note_ar: r.note_ar || '',
    workdays: (r.workdays && r.workdays.length ? r.workdays : DEFAULT_WORKDAYS).map(Number).sort((a, b) => a - b),
    day_titles: titles,
    source: r.source_file_path
      ? { bucket: r.source_file_bucket, path: r.source_file_path, mime: r.source_file_mime, name: r.source_file_path.split('/').pop() }
      : null,
    status: r.status || 'published',
    rows: (detail.items || []).map((it) => emptyRow({
      id: it.id,
      mode: it.exercise_id ? 'exercise' : 'text',
      exercise_id: it.exercise_id || '',
      title_en: it.title_en || '', title_ar: it.title_ar || '',
      at_time: it.at_time ? String(it.at_time).slice(0, 5) : '',
      sets_reps: it.sets_reps || '', sets_reps_ar: it.sets_reps_ar || '',
      weekday: it.weekday == null ? null : Number(it.weekday),
      note_en: it.note_en || '', note_ar: it.note_ar || '',
      exercise: it.exercise || null,
    })),
  };
}

export function toggleWorkday(days, id) {
  const set = new Set(days || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  return [...set].sort((a, b) => a - b);
}

export function moveRow(rows, index, delta) {
  const to = index + delta;
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row);
  return next;
}

// Rows by time (untimed last); rows with the same time keep their order.
export function sortRowsByTime(rows) {
  return (rows || [])
    .map((r, i) => ({ r, i, t: normalizeTime(r.at_time) }))
    .sort((a, b) => {
      if (a.t && b.t && a.t !== b.t) return a.t < b.t ? -1 : 1;
      if (!!a.t !== !!b.t) return a.t ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

// → { title_en, workdays, rows: { [key]: { field: msg } }, rowsList, day_titles: { [day]: msg } }
export function validateRoutineForm(form) {
  const f = form || {};
  const e = {};
  if (!clean(f.title_en)) e.title_en = msg('Add the name in English.', 'اكتب الاسم بالإنجليزي.');
  else if (clean(f.title_en).length > ROUTINE_LIMITS.title) e.title_en = msg('That name is too long.', 'الاسم ده طويل.');
  if (clean(f.title_ar).length > ROUTINE_LIMITS.title) e.title_ar = msg('That name is too long.', 'الاسم ده طويل.');

  const workdays = f.workdays || [];
  if (!workdays.length) e.workdays = msg('Pick at least one workday.', 'اختار يوم شغل واحد على الأقل.');

  const dayErrs = {};
  for (const [k, v] of Object.entries(f.day_titles || {})) {
    if (clean(v?.en).length > ROUTINE_LIMITS.dayTitle || clean(v?.ar).length > ROUTINE_LIMITS.dayTitle) {
      dayErrs[k] = msg('Keep it under 60 characters.', 'خليه أقل من ٦٠ حرف.');
    }
  }
  if (Object.keys(dayErrs).length) e.day_titles = dayErrs;

  const rows = f.rows || [];
  if (!rows.length) e.rowsList = msg('Add at least one row.', 'ضيف صف واحد على الأقل.');
  else if (rows.length > MAX_ROWS) e.rowsList = msg(`A routine can have up to ${MAX_ROWS} rows.`, `الروتين ممكن يكون فيه لحد ${MAX_ROWS} صف.`);

  const rowErrs = {};
  for (const r of rows) {
    const re = {};
    if (r.mode === 'text') {
      if (!clean(r.title_en)) re.title_en = msg('Type the step.', 'اكتب الخطوة.');
      else if (clean(r.title_en).length > ROUTINE_LIMITS.rowTitle) re.title_en = msg('Too long.', 'طويل.');
    } else if (!r.exercise_id) {
      re.exercise_id = msg('Pick an exercise.', 'اختار تمرين.');
    }
    if (clean(r.at_time) && !normalizeTime(r.at_time)) re.at_time = msg('Use a time like 09:30.', 'اكتب الوقت كده 09:30.');
    if (clean(r.sets_reps).length > ROUTINE_LIMITS.setsReps) re.sets_reps = msg('Too long.', 'طويل.');
    if (r.weekday != null && !workdays.includes(Number(r.weekday))) {
      re.weekday = msg('That day isn’t a workday any more.', 'اليوم ده مبقاش يوم شغل.');
    }
    if (Object.keys(re).length) rowErrs[r.key] = re;
  }
  if (Object.keys(rowErrs).length) e.rows = rowErrs;
  return e;
}

export function routineErrorCount(errors) {
  let n = 0;
  for (const [k, v] of Object.entries(errors || {})) {
    if (k === 'rows') n += Object.values(v).reduce((a, r) => a + Object.keys(r).length, 0);
    else if (k === 'day_titles') n += Object.keys(v).length;
    else if (v) n += 1;
  }
  return n;
}

// Form → save_routine input (the full list of rows; rows keep their id so
// their ticks stay). Throws { fieldErrors } when invalid.
export function buildRoutineInput(form, { isPublic = false } = {}) {
  const errors = validateRoutineForm(form);
  if (Object.keys(errors).length) {
    throw Object.assign(new Error('invalid_form'), { name: 'FormError', fieldErrors: errors });
  }
  const workdays = [...new Set(form.workdays.map(Number))].sort((a, b) => a - b);
  const dayTitles = {};
  for (const d of workdays) {
    const v = form.day_titles?.[String(d)];
    const en = orNull(v?.en);
    const ar = orNull(v?.ar);
    if (en || ar) dayTitles[String(d)] = { ...(en ? { en } : {}), ...(ar ? { ar } : {}) };
  }
  const input = {
    title_en: clean(form.title_en),
    title_ar: orNull(form.title_ar),
    note_en: orNull(form.note_en),
    note_ar: orNull(form.note_ar),
    workdays,
    day_titles: dayTitles,
    source_file_bucket: form.source?.path ? form.source.bucket : null,
    source_file_path: form.source?.path || null,
    source_file_mime: form.source?.path ? (form.source.mime || null) : null,
    items: form.rows.map((r, i) => {
      const text = r.mode === 'text';
      const item = {
        exercise_id: text ? null : r.exercise_id,
        title_en: text ? clean(r.title_en) : null,
        title_ar: text ? orNull(r.title_ar) : null,
        weekday: r.weekday == null ? null : Number(r.weekday),
        at_time: normalizeTime(r.at_time),
        sets_reps: orNull(r.sets_reps),
        sets_reps_ar: orNull(r.sets_reps_ar),
        note_en: orNull(r.note_en),
        note_ar: orNull(r.note_ar),
        sort_order: i + 1,
      };
      if (r.id) item.id = r.id;
      return item;
    }),
  };
  if (form.id) input.id = form.id;
  else if (isPublic) input.public = true;
  return input;
}

// Display title and sets × reps of a builder row.
export function rowText(row, exercisesById, lang) {
  const ex = (row.exercise_id && exercisesById?.get?.(row.exercise_id)) || row.exercise || null;
  const title = row.mode === 'text'
    ? pickLang(lang, clean(row.title_en), clean(row.title_ar))
    : pickLang(lang, ex?.name_en, ex?.name_ar);
  const setsReps = pickLang(lang, clean(row.sets_reps), clean(row.sets_reps_ar))
    || pickLang(lang, ex?.default_sets_reps, ex?.default_sets_reps_ar);
  return { title, setsReps, exercise: ex };
}

// What the employee's Today list shows on one weekday: every-workday rows
// plus that day's rows, by time (untimed last). [] when it isn't a workday.
export function previewDay(form, weekday, exercisesById, lang) {
  const wd = Number(weekday);
  if (!(form?.workdays || []).includes(wd)) return [];
  const rows = (form.rows || []).filter((r) => r.weekday == null || Number(r.weekday) === wd);
  return sortRowsByTime(rows)
    .map((r) => ({ key: r.key, time: normalizeTime(r.at_time), ...rowText(r, exercisesById, lang) }))
    .filter((x) => x.title);
}

export function dayFocus(form, weekday, lang) {
  const v = form?.day_titles?.[String(weekday)];
  return v ? pickLang(lang, clean(v.en), clean(v.ar)) : '';
}
