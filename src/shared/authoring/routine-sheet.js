// Routine import from the coach's sheet: header mapping, cell clean-up and
// the template's rows. Pure functions (file reading / writing lives in
// sheet-files.js). The server (hr_import_routine) parses times, weekdays
// and YouTube links again and reports problems per row.
import { BODY_AREAS } from '../../lib/supabase-routines';
import { msg } from './text.js';

export const MAX_ROUTINE_ROWS = 100;

// Lowercase, trim, drop BOM / zero-width / tatweel, fold _ - × * to spaces.
function norm(v) {
  return String(v ?? '')
    .replace(/[﻿​-‏ـ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_\-×*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const foldArabic = (s) => s.replace(/[أإآ]/g, 'ا').replace(/[ؤئ]/g, 'ء').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const key = (v) => foldArabic(norm(v));

export const ROUTINE_COLUMNS = ['time', 'exercise', 'sets_reps', 'weekday', 'body_areas', 'youtube'];
const OPTIONAL_COLUMNS = ['exercise_ar', 'sets_reps_ar', 'how_en', 'how_ar', 'note_en', 'note_ar'];

const HEADER_ALIASES = {
  time: ['time', 'at', 'at time', 'start', 'start time', 'hour', 'الوقت', 'الساعه', 'الساعة', 'ميعاد', 'الميعاد', 'التوقيت'],
  exercise: ['exercise', 'exercise name', 'exercise en', 'name', 'movement', 'stretch', 'activity',
    'التمرين', 'تمرين', 'اسم التمرين', 'التمرينه', 'التمرينة', 'الحركه', 'الحركة'],
  exercise_ar: ['exercise ar', 'exercise arabic', 'exercise (arabic)', 'arabic name', 'name ar', 'name arabic',
    'التمرين بالعربي', 'اسم التمرين بالعربي', 'الاسم بالعربي'],
  sets_reps: ['sets reps', 'sets x reps', 'sets and reps', 'sets', 'reps', 'repetitions', 'how many', 'amount',
    'العدد', 'المجموعات', 'عدد المرات', 'التكرار', 'المجموعات التكرار', 'المجموعات x التكرار', 'مجموعات تكرار', 'مجموعات'],
  sets_reps_ar: ['sets reps ar', 'sets reps arabic', 'العدد بالعربي'],
  weekday: ['weekday', 'day', 'days', 'week day', 'اليوم', 'الايام', 'الأيام', 'يوم'],
  body_areas: ['body areas', 'body area', 'body part', 'body parts', 'area', 'areas', 'muscle', 'muscles',
    'منطقه الجسم', 'منطقة الجسم', 'المنطقه', 'المنطقة', 'الجزء', 'العضلات', 'مناطق الجسم'],
  youtube: ['youtube', 'youtube link', 'video', 'video link', 'link', 'url', 'demo', 'يوتيوب', 'لينك', 'رابط', 'فيديو', 'لينك الفيديو', 'رابط الفيديو', 'لينك يوتيوب'],
  how_en: ['how', 'how to', 'how to do it', 'instructions', 'how en'],
  how_ar: ['how ar', 'الطريقه', 'الطريقة', 'ازاي', 'إزاي', 'طريقة الأداء'],
  note_en: ['note', 'notes', 'note en', 'comment'],
  note_ar: ['note ar', 'ملاحظه', 'ملاحظة', 'ملاحظات'],
};
const HEADER_LOOKUP = new Map();
for (const [field, list] of Object.entries(HEADER_ALIASES)) for (const a of list) HEADER_LOOKUP.set(key(a), field);
for (const field of [...ROUTINE_COLUMNS, ...OPTIONAL_COLUMNS]) HEADER_LOOKUP.set(key(field), field);

export function routineHeaderField(cell) {
  const k = key(cellString(cell));
  if (!k) return null;
  if (HEADER_LOOKUP.has(k)) return HEADER_LOOKUP.get(k);
  // "Time / الوقت", "Exercise (EN)" → try each part.
  for (const part of k.split(/[/|()]/)) {
    const p = part.trim();
    if (p && HEADER_LOOKUP.has(p)) return HEADER_LOOKUP.get(p);
  }
  return null;
}

function cellString(v) {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  return String(v).replace(/[﻿​-‏]/g, '').replace(/\s+/g, ' ').trim();
}

const pad = (n) => String(n).padStart(2, '0');

// A time cell: Excel times arrive as a Date (on 1899-12-30/31) or as a
// fraction of a day; text is passed through for the server to parse.
export function timeCell(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  }
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  }
  return cellString(v);
}

const AREA_BY_KEY = new Map();
for (const a of BODY_AREAS) {
  AREA_BY_KEY.set(key(a.id), a.id);
  AREA_BY_KEY.set(key(a.en), a.id);
  AREA_BY_KEY.set(key(a.ar), a.id);
}
// Common extra names.
for (const [alias, id] of [['back', 'upper_back'], ['lower back', 'lower_back'], ['upper back', 'upper_back'],
  ['wrist', 'wrists'], ['shoulder', 'shoulders'], ['leg', 'legs'], ['arm', 'arms'], ['hip', 'hips'], ['eye', 'eyes'],
  ['abs', 'core'], ['stomach', 'core'], ['breath', 'breathing'], ['whole body', 'full_body'], ['full body', 'full_body'],
  ['الضهر', 'upper_back'], ['الظهر', 'upper_back'], ['اسفل الظهر', 'lower_back'], ['اعلى الظهر', 'upper_back'],
  ['الرقبه', 'neck'], ['الكتف', 'shoulders'], ['الكتفين', 'shoulders'], ['الايد', 'arms'], ['الرجل', 'legs'], ['البطن', 'core']]) {
  AREA_BY_KEY.set(key(alias), id);
}

// "Neck, upper back" / "الرقبة، الكتف" → ['neck', 'upper_back']. Unknown
// names stay as typed so the server can warn about them.
export function bodyAreasCell(v) {
  const out = [];
  for (const part of cellString(v).split(/[,;،/+]| و /)) {
    const raw = part.trim();
    if (!raw) continue;
    const id = AREA_BY_KEY.get(key(raw)) || raw.toLowerCase().replace(/\s+/g, '_');
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// Sheet rows (arrays of cells, first row = headers) → import rows.
// → { rows, columns, missing, unknownHeaders, warnings, tooMany }
export function sheetToRoutineRows(sheet) {
  const all = (sheet || []).filter((r) => Array.isArray(r));
  const headerIndex = all.findIndex((r) => r.some((c) => routineHeaderField(c)));
  const columns = {};
  const unknownHeaders = [];
  if (headerIndex < 0) {
    return { rows: [], columns, missing: ['exercise'], unknownHeaders, warnings: [], tooMany: false };
  }
  all[headerIndex].forEach((cell, i) => {
    const field = routineHeaderField(cell);
    if (field && columns[field] == null) columns[field] = i;
    else if (!field && cellString(cell)) unknownHeaders.push(cellString(cell));
  });
  const missing = columns.exercise == null ? ['exercise'] : [];

  const rows = [];
  const warnings = [];
  for (let r = headerIndex + 1; r < all.length; r++) {
    const cells = all[r];
    if (!cells.some((c) => cellString(c))) continue; // empty line
    const rowNo = r + 1;                               // the row number Excel shows
    const get = (field) => (columns[field] == null ? undefined : cells[columns[field]]);
    const out = { row: rowNo };
    const ex = cellString(get('exercise'));
    out.exercise = ex;
    if (columns.time != null) out.time = timeCell(get('time'));
    for (const f of ['exercise_ar', 'sets_reps', 'sets_reps_ar', 'weekday', 'youtube', 'how_en', 'how_ar', 'note_en', 'note_ar']) {
      if (columns[f] == null) continue;
      const v = get(f);
      if (v instanceof Date && f.startsWith('sets_reps')) {
        // Excel turned "8-10" into a date.
        warnings.push({ row: rowNo, reason: 'excel_date', value: cellString(v) });
        continue;
      }
      const s = cellString(v);
      if (s) out[f] = s;
    }
    if (columns.body_areas != null) {
      const areas = bodyAreasCell(get('body_areas'));
      if (areas.length) out.body_areas = areas;
    }
    rows.push(out);
  }
  return { rows, columns, missing, unknownHeaders, warnings, tooMany: rows.length > MAX_ROUTINE_ROWS };
}

// Problem / warning reasons (server + client) → text.
const REASONS = {
  missing_exercise: msg('No exercise name', 'مفيش اسم تمرين'),
  name_too_long: msg('Exercise name is too long', 'اسم التمرين طويل'),
  bad_time: msg('Time not understood (use 09:30)', 'الوقت مش مفهوم (اكتب 09:30)'),
  bad_weekday: msg('Day not understood (use Sunday, or leave empty for every workday)', 'اليوم مش مفهوم (اكتب الأحد، أو سيبه فاضي لكل أيام الشغل)'),
  weekday_not_workday: msg('That day isn’t a workday', 'اليوم ده مش يوم شغل'),
  bad_youtube: msg('Not a YouTube link (the row is kept without a video)', 'ده مش لينك يوتيوب (الصف اتضاف من غير فيديو)'),
  bad_video_path: msg('Video file not found (the row is kept without a video)', 'ملف الفيديو مش موجود (الصف اتضاف من غير فيديو)'),
  unknown_body_area: msg('Unknown body area (ignored)', 'منطقة جسم مش معروفة (اتجاهلت)'),
  excel_date: msg('Excel turned sets × reps into a date. Type it as text, e.g. 2 x 10', 'Excel حوّل العدد لتاريخ. اكتبه كنص، مثلاً 2 x 10'),
};

export function importReasonLabel(reason, lang) {
  const m = REASONS[reason];
  if (!m) return reason;
  return lang === 'ar' ? m.ar : m.en;
}

// Template: the data sheet's header row and the "How to fill" sheet.
export function routineTemplateHeaders(lang) {
  return lang === 'ar'
    ? ['الوقت', 'التمرين', 'المجموعات × التكرار', 'اليوم', 'منطقة الجسم', 'يوتيوب']
    : ['time', 'exercise', 'sets_reps', 'weekday', 'body_areas', 'youtube'];
}

export function routineTemplateHelpRows(lang) {
  const areas = BODY_AREAS.map((a) => (lang === 'ar' ? a.ar : a.en)).join(lang === 'ar' ? '، ' : ', ');
  if (lang === 'ar') {
    return [
      ['العمود', 'تكتب فيه إيه', 'مثال'],
      ['الوقت', 'ميعاد التمرين. سيبه فاضي لو أي وقت في اليوم.', '09:30'],
      ['التمرين', 'اسم التمرين بالإنجليزي. لو موجود في المكتبة هيتربط بيه، ولو مش موجود هيتعمل جديد.', 'Neck release'],
      ['المجموعات × التكرار', 'زي ما المدرب كاتبها. اكتبها كنص.', '2 x 10'],
      ['اليوم', 'سيبه فاضي لكل أيام الشغل، أو اكتب يوم واحد.', 'الأحد'],
      ['منطقة الجسم', `اختياري. أكتر من واحدة بفاصلة: ${areas}`, 'الرقبة، الكتف'],
      ['يوتيوب', 'اختياري. لينك فيديو الشرح.', 'https://youtu.be/…'],
      [],
      ['ملاحظة', 'لحد ١٠٠ صف. الصفوف اللي فيها مشكلة بتظهر في المعاينة قبل ما يتحفظ أي حاجة.', ''],
    ];
  }
  return [
    ['Column', 'What to write', 'Example'],
    ['time', 'When to do it. Leave empty for any time of the day.', '09:30'],
    ['exercise', 'The exercise name in English. If it is in your library it is linked; if not, a new exercise is created.', 'Neck release'],
    ['sets_reps', 'As the coach wrote it. Type it as text.', '2 x 10'],
    ['weekday', 'Leave empty for every workday, or write one day.', 'Sunday'],
    ['body_areas', `Optional. Several, separated by commas: ${areas}`, 'neck, shoulders'],
    ['youtube', 'Optional. A link to the demo video.', 'https://youtu.be/…'],
    [],
    ['Note', 'Up to 100 rows. Rows with a problem show in the preview before anything is saved.', ''],
  ];
}
