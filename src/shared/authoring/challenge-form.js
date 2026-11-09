// HR's own habit challenge (hr_save_challenge_template): form, validation,
// input, and the challenge's days. Pure functions.
import { clean, orNull, msg, addDays } from './text.js';
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
