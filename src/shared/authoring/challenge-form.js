// HR's own habit challenge (hr_save_challenge_template): form, validation,
// input, and the challenge's days. Pure functions.
import { clean, orNull, msg, addDays, weekdayOf, upcomingSunday } from './text.js';
import { emptyMedia, mediaToForm, validateMedia, mediaFields } from './media-form.js';

export const CHALLENGE_LIMITS = { title: 80, action: 220, why: 500, tip: 220 };
export const MAX_WEEKS = 4;

// Default days needed to win: 80% of the workdays (4 of 5, 8 of 10, …).
export function defaultSuccessDays(weeks) {
  const w = Math.max(1, Math.min(MAX_WEEKS, Number(weeks) || 1));
  return Math.ceil((w * 5 * 8) / 10); // integer maths: 0.8 * 15 is 12.000…02 in floats
}

export function templateWeeks(t) {
  const w = Number(t?.weeks ?? t?.payload?.weeks);
  return Number.isInteger(w) && w >= 1 && w <= MAX_WEEKS ? w : 1;
}

export function templateSuccessDays(t) {
  const need = Number(t?.payload?.success_days ?? t?.target);
  return Number.isInteger(need) && need > 0 ? need : defaultSuccessDays(templateWeeks(t));
}

// The workdays (Sun–Thu) a challenge starting on `sunday` runs, week by
// week. Same as the server's days[] (habit_workdays): never start + i.
export function challengeDays(sunday, weeks) {
  const out = [];
  if (!sunday) return out;
  const n = Math.max(1, Math.min(MAX_WEEKS, Number(weeks) || 1));
  for (let w = 0; w < n; w++) {
    for (let d = 0; d < 5; d++) out.push(addDays(sunday, w * 7 + d));
  }
  return out;
}

// Last day (Thursday of the last week).
export function challengeEnd(sunday, weeks) {
  const days = challengeDays(sunday, weeks);
  return days[days.length - 1] || null;
}

export function emptyChallengeForm() {
  return {
    id: null,
    title_en: '', title_ar: '',
    action_en: '', action_ar: '',
    why_en: '', why_ar: '',
    tip_en: '', tip_ar: '',
    weeks: 1,
    success_days: defaultSuccessDays(1),
    success_touched: false,   // HR picked the days themselves
    media: emptyMedia(),
  };
}

export function challengeToForm(t) {
  if (!t) return emptyChallengeForm();
  const p = t.payload || {};
  const weeks = templateWeeks(t);
  return {
    id: t.id || null,
    title_en: t.title_en || '', title_ar: t.title_ar && t.title_ar !== t.title_en ? t.title_ar : '',
    action_en: p.action_en || '', action_ar: p.action_ar || '',
    why_en: p.why_en || '', why_ar: p.why_ar || '',
    tip_en: p.tip_en || '', tip_ar: p.tip_ar || '',
    weeks,
    success_days: templateSuccessDays(t),
    success_touched: true,
    media: mediaToForm(p),
  };
}

// Changing the length moves "days needed" to the new default unless HR set it.
export function setWeeks(form, weeks) {
  const w = Math.max(1, Math.min(MAX_WEEKS, Number(weeks) || 1));
  const next = { ...form, weeks: w };
  if (!form.success_touched || Number(form.success_days) > w * 5) next.success_days = defaultSuccessDays(w);
  return next;
}

function maxLen(e, key, v, max) {
  if (clean(v).length > max) e[key] = msg(`Keep it under ${max} characters.`, `خليه أقل من ${max} حرف.`);
}

export function validateChallengeForm(form) {
  const f = form || {};
  const e = {};
  if (!clean(f.title_en)) e.title_en = msg('Add the name in English.', 'اكتب الاسم بالإنجليزي.');
  maxLen(e, 'title_en', f.title_en, CHALLENGE_LIMITS.title);
  maxLen(e, 'title_ar', f.title_ar, CHALLENGE_LIMITS.title);
  if (!clean(f.action_en)) e.action_en = msg('Write the daily action in English.', 'اكتب الفعل اليومي بالإنجليزي.');
  maxLen(e, 'action_en', f.action_en, CHALLENGE_LIMITS.action);
  maxLen(e, 'action_ar', f.action_ar, CHALLENGE_LIMITS.action);
  maxLen(e, 'why_en', f.why_en, CHALLENGE_LIMITS.why);
  maxLen(e, 'why_ar', f.why_ar, CHALLENGE_LIMITS.why);
  maxLen(e, 'tip_en', f.tip_en, CHALLENGE_LIMITS.tip);
  maxLen(e, 'tip_ar', f.tip_ar, CHALLENGE_LIMITS.tip);
  const weeks = Number(f.weeks);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) e.weeks = msg('Pick 1 to 4 weeks.', 'اختار من ١ لـ ٤ أسابيع.');
  const need = Number(f.success_days);
  const total = (Number.isInteger(weeks) ? weeks : 1) * 5;
  if (!Number.isInteger(need) || need < 1 || need > total) {
    e.success_days = msg(`Pick 1 to ${total} days.`, `اختار من ١ لـ ${total} يوم.`);
  }
  Object.assign(e, validateMedia(f.media));
  return e;
}

// Form → hr_save_challenge_template input. Keys left empty are sent as ''
// on an update so a removed tip / why really goes away.
export function buildChallengeInput(form) {
  const errors = validateChallengeForm(form);
  if (Object.keys(errors).length) {
    throw Object.assign(new Error('invalid_form'), { name: 'FormError', fieldErrors: errors });
  }
  const text = (v) => (form.id ? clean(v) : orNull(v));
  const media = mediaFields(form.media);
  const payload = {
    action_en: clean(form.action_en),
    action_ar: text(form.action_ar),
    why_en: text(form.why_en), why_ar: text(form.why_ar),
    tip_en: text(form.tip_en), tip_ar: text(form.tip_ar),
    media_type: media.media_type,
    media_bucket: media.media_bucket,
    media_path: media.media_path,
    media_mime: media.media_mime,
    media_youtube_id: media.media_youtube_id,
  };
  for (const k of Object.keys(payload)) if (payload[k] === null) delete payload[k];
  if (!media.media_type) payload.media_type = form.id ? '' : undefined;
  if (payload.media_type === undefined) delete payload.media_type;
  const input = {
    title_en: clean(form.title_en),
    weeks: Number(form.weeks),
    success_days: Number(form.success_days),
    payload,
  };
  // No Arabic name: Arabic shows the English one (the server keeps an old
  // Arabic name on update unless one is sent).
  const ar = orNull(form.title_ar);
  if (ar) input.title_ar = ar;
  else if (form.id) input.title_ar = input.title_en;
  if (form.id) input.id = form.id;
  return input;
}

// Does a template / payload carry how-to media (upload or YouTube)?
export function payloadMediaKind(p) {
  if (!p) return null;
  if (p.media_type === 'youtube') return p.media_youtube_id ? 'youtube' : null;
  if ((p.media_type === 'video' || p.media_type === 'image') && (p.media_path || p.media_url)) return p.media_type;
  return null;
}

// ── Sprint 4: a challenge with its own dates (hr_schedule_challenge) ──
// Any start and end, at most 5 weeks apart; only Sun–Thu days count;
// several challenges can run at once.
export const MAX_SPAN_DAYS = 34;       // end − start, as the server checks it
export const MAX_ROUTINE_ITEMS = 20;   // rows a routine challenge can link

const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''));

// Whole days from a to b (negative when b is earlier).
export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// The working days (Sun–Thu) from start to end, both included. Same as the
// server's habit_workdays(). [] for missing dates or an end before the start.
export function workdaysBetween(start, end) {
  if (!isIso(start) || !isIso(end) || end < start) return [];
  const out = [];
  const span = Math.min(daysBetween(start, end), 366);
  for (let i = 0; i <= span; i++) {
    const d = addDays(start, i);
    if (weekdayOf(d) < 5) out.push(d);
  }
  return out;
}

export const countWorkdays = (start, end) => workdaysBetween(start, end).length;

// The Thursday that closes the week `start` is in (the next one for a
// Friday / Saturday start), `weeks` weeks long. Sunday + 1 week → that Thursday.
export function defaultEndDate(start, weeks = 1) {
  if (!isIso(start)) return '';
  const w = Math.max(1, Math.min(MAX_WEEKS, Number(weeks) || 1));
  return addDays(start, ((4 - weekdayOf(start) + 7) % 7) + 7 * (w - 1));
}

// Default dates: the coming Sunday (today when it is one) → the Thursday
// that ends the template's last week.
export function defaultChallengeDates(today, weeks = 1) {
  const startDate = upcomingSunday(today);
  return { startDate, endDate: defaultEndDate(startDate, weeks) };
}

// Days needed by default: the template's own, else 80% of the working days
// (the server's default). Never more than the days that can count.
export function defaultNeed(template, workdays) {
  const n = Math.max(0, Number(workdays) || 0);
  if (!n) return 1;
  const base = template ? templateSuccessDays(template) : Math.ceil((n * 8) / 10);
  return Math.max(1, Math.min(base, n));
}

// A routine challenge counts a day when every linked row due that day is
// ticked, so only days with a linked row due can count: the routine's
// workdays, and for an "only Tuesday" row only Tuesdays.
export function countableDays(days, rows, routineWorkdays = [0, 1, 2, 3, 4]) {
  const work = (routineWorkdays || []).map(Number);
  const list = rows || [];
  return (days || []).filter((d) => {
    const wd = weekdayOf(d);
    return work.includes(wd) && list.some((r) => r.weekday == null || Number(r.weekday) === wd);
  });
}

// Problems with the dates and the days needed, before the server is asked.
// maxDays: the days that can count when fewer than the working days.
export function validateSchedule({ startDate, endDate, successDays, maxDays } = {}, today) {
  const e = {};
  if (!isIso(startDate)) e.startDate = msg('Pick a start date.', 'اختار تاريخ البداية.');
  if (!isIso(endDate)) e.endDate = msg('Pick an end date.', 'اختار تاريخ النهاية.');
  if (e.startDate || e.endDate) return e;
  if (endDate < startDate) {
    e.endDate = msg('The end date must be on or after the start date.', 'تاريخ النهاية لازم يكون بعد البداية أو نفس اليوم.');
    return e;
  }
  if (daysBetween(startDate, endDate) > MAX_SPAN_DAYS) {
    e.endDate = msg('Keep it to 5 weeks or less.', 'خليه ٥ أسابيع أو أقل.');
    return e;
  }
  if (isIso(today) && endDate < today) {
    e.endDate = msg('Those dates are already over. Pick later dates.', 'التواريخ دي عدّت. اختار تواريخ بعد كده.');
    return e;
  }
  const workdays = countWorkdays(startDate, endDate);
  if (!workdays) {
    e.endDate = msg('Those dates have no working day (Sunday to Thursday).', 'التواريخ دي مفيهاش يوم شغل (من الأحد للخميس).');
    return e;
  }
  const total = maxDays == null ? workdays : Math.min(workdays, Number(maxDays) || 0);
  const need = Number(successDays);
  if (total < 1) {
    e.successDays = msg('The exercises you picked are not due on any of these days.', 'التمارين اللي اخترتها مش مطلوبة في أي يوم من دول.');
  } else if (!Number.isInteger(need) || need < 1 || need > total) {
    e.successDays = total === 1
      ? msg('Only 1 day can count in these dates.', 'يوم واحد بس اللي ممكن يتحسب في التواريخ دي.')
      : msg(`Pick 1 to ${total} days.`, `اختار من ١ لـ ${total} يوم.`);
  }
  return e;
}

// "Challenge from routine exercises": a typed name + 1–20 rows of one routine.
export function validateRoutineChallenge(form, today) {
  const f = form || {};
  const e = {};
  if (!clean(f.title_en)) e.title_en = msg('Add the name in English.', 'اكتب الاسم بالإنجليزي.');
  maxLen(e, 'title_en', f.title_en, CHALLENGE_LIMITS.title);
  maxLen(e, 'title_ar', f.title_ar, CHALLENGE_LIMITS.title);
  const ids = f.itemIds || [];
  if (!f.routineId) e.routineId = msg('Pick a routine.', 'اختار روتين.');
  else if (!ids.length) e.items = msg('Tick at least one exercise.', 'علّم على تمرين واحد على الأقل.');
  else if (ids.length > MAX_ROUTINE_ITEMS) e.items = msg(`Pick up to ${MAX_ROUTINE_ITEMS} exercises.`, `اختار لحد ${MAX_ROUTINE_ITEMS} تمرين.`);
  return { ...e, ...validateSchedule(f, today) };
}

// Form → scheduleChallenge() input for a routine challenge.
export function buildRoutineChallengeInput(form) {
  const input = {
    title_en: clean(form.title_en),
    routineItemIds: [...(form.itemIds || [])],
    startDate: form.startDate,
    endDate: form.endDate,
    successDays: Number(form.successDays),
    teamId: form.teamId || null,
  };
  const ar = orNull(form.title_ar);
  if (ar) input.title_ar = ar;
  return input;
}

// The rows of a routine a challenge can link: saved, not hidden, with the
// text the picker shows.
export function pickableRoutineRows(detail, lang) {
  return (detail?.items || [])
    .filter((it) => it.id && !it.hidden_at)
    .map((it) => ({
      id: it.id,
      time: it.at_time ? String(it.at_time).slice(0, 5) : '',
      weekday: it.weekday == null ? null : Number(it.weekday),
      title: (lang === 'ar'
        ? (clean(it.title_ar) || it.exercise?.name_ar || clean(it.title_en) || it.exercise?.name_en)
        : (clean(it.title_en) || it.exercise?.name_en || clean(it.title_ar) || it.exercise?.name_ar)) || '',
    }));
}
