// Habit template builder: form <-> challenge_templates row, validation, and
// media checks. Pure functions, no Supabase.
//
// A habit template is a challenge_templates row with kind 'habit'. The
// employee app reads everything from `payload` (copied into the challenge
// when HR schedules it):
//   category, action_*, why_*, tip_*, check_mode, success_days,
//   article_slug, badge_icon, badge_color,
//   media_type ('video' | 'image' | 'youtube'), media_url, media_path,
//   media_mime, media_youtube_id
// Keys the builder doesn't edit (reminder_*, missed_*, …) are kept as-is.

import { HABIT_CATEGORIES, habitCategory, MEDIA_KEYS, parseYouTubeUrl } from '../../shared/habit-meta.js';

export const WINDOW_DAYS = 5; // always Sun → Thu
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const LIMITS = { name: 80, action: 220, why: 500, tip: 220 };

// Upload types the content-assets bucket accepts for how-to media.
export const MEDIA_MIME_KINDS = {
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'image/png': 'image',
  'image/jpeg': 'image',
};
export const MEDIA_ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov,image/png,image/jpeg,.png,.jpg,.jpeg';
const EXT_MIME = { mp4: 'video/mp4', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

const msg = (en, ar) => ({ en, ar });

// ── slug ───────────────────────────────────────────────────────

// 'Walk After Lunch!' → 'walk-after-lunch'
export function slugify(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

// Unique slug for a new template, from its English name: 'habit-<name>',
// then 'habit-<name>-2', '-3', … if taken.
export function templateSlug(nameEn, existingSlugs = []) {
  const taken = new Set((existingSlugs || []).filter(Boolean).map((s) => String(s).toLowerCase()));
  const base = slugify(nameEn);
  const root = !base ? 'habit' : base.startsWith('habit-') || base === 'habit' ? base : `habit-${base}`;
  if (!taken.has(root)) return root;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// ── form ───────────────────────────────────────────────────────

export function emptyTemplateForm() {
  return {
    name_en: '', name_ar: '',
    category: '',
    action_en: '', action_ar: '',
    why_en: '', why_ar: '',
    tip_en: '', tip_ar: '',
    check_mode: 'same_day',
    success_days: 4,
    article_slug: '',
    media_mode: 'none',   // 'none' | 'upload' | 'youtube'
    media: null,          // uploaded { type, url, path, mime }
    youtube_url: '',
  };
}

export function templateToForm(t) {
  const p = (t && t.payload) || {};
  const form = emptyTemplateForm();
  form.name_en = t?.title_en || '';
  form.name_ar = t?.title_ar || '';
  form.category = habitCategory(p.category) ? p.category : '';
  for (const k of ['action_en', 'action_ar', 'why_en', 'why_ar', 'tip_en', 'tip_ar']) form[k] = p[k] || '';
  form.check_mode = p.check_mode === 'next_morning' ? 'next_morning' : 'same_day';
  const days = Number(p.success_days ?? t?.target ?? 4);
  form.success_days = Number.isFinite(days) ? days : 4;
  form.article_slug = p.article_slug || '';
  if (p.media_type === 'youtube' && p.media_youtube_id) {
    form.media_mode = 'youtube';
    form.youtube_url = `https://youtu.be/${p.media_youtube_id}`;
  } else if (p.media_url) {
    form.media_mode = 'upload';
    form.media = {
      type: p.media_type === 'image' ? 'image' : 'video',
      url: p.media_url, path: p.media_path || null, mime: p.media_mime || null,
    };
  }
  return form;
}

const clean = (v) => String(v ?? '').trim();
const MEDIA_KINDS = new Set(['video', 'image']);

function required(errors, form, key, max, message) {
  const v = clean(form[key]);
  if (!v) errors[key] = message;
  else if (v.length > max) errors[key] = msg(`Keep it under ${max} characters.`, `اجعله أقل من ${max} حرفًا.`);
}

export function youtubeError(reason) {
  if (reason === 'empty') return msg('Paste the YouTube link.', 'الصق رابط يوتيوب.');
  return msg(
    'That is not a YouTube video link. Use youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… or youtube.com/embed/….',
    'هذا ليس رابط فيديو يوتيوب. استخدم youtube.com/watch?v=… أو youtu.be/… أو youtube.com/shorts/… أو youtube.com/embed/….',
  );
}

// Returns { field: { en, ar } }; empty object when the form can be saved.
export function validateTemplateForm(form) {
  const f = form || {};
  const e = {};
  required(e, f, 'name_en', LIMITS.name, msg('Add the name in English.', 'أضف الاسم بالإنجليزية.'));
  required(e, f, 'name_ar', LIMITS.name, msg('Add the name in Arabic.', 'أضف الاسم بالعربية.'));
  if (!habitCategory(f.category)) e.category = msg('Pick a category.', 'اختر تصنيفًا.');
  required(e, f, 'action_en', LIMITS.action, msg('Write the daily action in English.', 'اكتب الإجراء اليومي بالإنجليزية.'));
  required(e, f, 'action_ar', LIMITS.action, msg('Write the daily action in Arabic.', 'اكتب الإجراء اليومي بالعربية.'));
  required(e, f, 'why_en', LIMITS.why, msg('Say why it helps, in English.', 'اكتب سبب فائدته بالإنجليزية.'));
  required(e, f, 'why_ar', LIMITS.why, msg('Say why it helps, in Arabic.', 'اكتب سبب فائدته بالعربية.'));

  const tipEn = clean(f.tip_en);
  const tipAr = clean(f.tip_ar);
  if (!!tipEn !== !!tipAr) {
    e.tip = msg('Add the tip in both languages, or leave both empty.', 'أضف النصيحة باللغتين أو اترك الحقلين فارغين.');
  } else if (tipEn.length > LIMITS.tip || tipAr.length > LIMITS.tip) {
    e.tip = msg(`Keep the tip under ${LIMITS.tip} characters.`, `اجعل النصيحة أقل من ${LIMITS.tip} حرفًا.`);
  }

  if (f.check_mode !== 'same_day' && f.check_mode !== 'next_morning') {
    e.check_mode = msg('Pick when it is checked.', 'اختر وقت التسجيل.');
  }
  const days = Number(f.success_days);
  if (!Number.isInteger(days) || days < 1 || days > WINDOW_DAYS) {
    e.success_days = msg('Days to win must be a whole number from 1 to 5.', 'يجب أن تكون أيام الفوز رقمًا صحيحًا من 1 إلى 5.');
  }

  if (f.media_mode === 'upload') {
    if (!f.media || !f.media.url || !MEDIA_KINDS.has(f.media.type)) {
      e.media = msg('Upload a video or image, or choose "No media".', 'ارفع فيديو أو صورة، أو اختر «بدون وسائط».');
    }
  } else if (f.media_mode === 'youtube') {
    const yt = parseYouTubeUrl(f.youtube_url);
    if (!yt.ok) e.media = youtubeError(yt.reason);
  } else if (f.media_mode && f.media_mode !== 'none') {
    e.media = msg('Pick a media option.', 'اختر نوع الوسائط.');
  }
  return e;
}

// Badge shown on the employee card. New templates (and a category change)
// take the category's icon and color; otherwise the existing badge stays.
export function resolveBadge(form, existingPayload) {
  const prev = existingPayload || {};
  const cat = habitCategory(form?.category);
  const keep = prev.badge_icon && !(prev.category && cat && prev.category !== cat.id);
  if (keep || !cat) return { badge_icon: prev.badge_icon || 'trophy', badge_color: prev.badge_color || '#F5B544' };
  return { badge_icon: cat.icon, badge_color: cat.color };
}

// The media payload keys for the current form, or {} for none.
export function mediaPayload(form) {
  if (form?.media_mode === 'upload' && form.media?.url) {
    const out = { media_type: form.media.type, media_url: form.media.url };
    if (form.media.path) out.media_path = form.media.path;
    if (form.media.mime) out.media_mime = form.media.mime;
    return out;
  }
  if (form?.media_mode === 'youtube') {
    const yt = parseYouTubeUrl(form.youtube_url);
    if (yt.ok) return { media_type: 'youtube', media_youtube_id: yt.id };
  }
  return {};
}

export class TemplateValidationError extends Error {
  constructor(fieldErrors) {
    super('invalid_template');
    this.name = 'TemplateValidationError';
    this.fieldErrors = fieldErrors;
  }
}

// Form → challenge_templates insert row (or update patch when `existing`).
// Throws TemplateValidationError when the form isn't valid.
export function buildTemplateRow(form, { existing = null, existingSlugs = [] } = {}) {
  const errors = validateTemplateForm(form);
  if (Object.keys(errors).length) throw new TemplateValidationError(errors);

  const prev = (existing && existing.payload) || {};
  const days = Number(form.success_days);
  const payload = { ...prev };
  for (const k of [...MEDIA_KEYS, 'tip_en', 'tip_ar', 'article_slug']) delete payload[k];
  Object.assign(payload, {
    category: form.category,
    action_en: clean(form.action_en), action_ar: clean(form.action_ar),
    why_en: clean(form.why_en), why_ar: clean(form.why_ar),
    check_mode: form.check_mode,
    success_days: days,
    ...resolveBadge(form, prev),
    ...mediaPayload(form),
  });
  if (clean(form.tip_en)) { payload.tip_en = clean(form.tip_en); payload.tip_ar = clean(form.tip_ar); }
  if (clean(form.article_slug)) payload.article_slug = clean(form.article_slug);

  const row = {
    title_en: clean(form.name_en),
    title_ar: clean(form.name_ar),
    kind: 'habit',
    metric: 'habit',
    default_window_days: WINDOW_DAYS,
    target: days,
    payload,
  };
  if (!existing) row.slug = templateSlug(form.name_en, existingSlugs);
  return row;
}

// ── media files ────────────────────────────────────────────────

export function formatMB(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
}

function resolveMime(file) {
  const type = String(file.type || '').toLowerCase();
  if (type === 'image/jpg') return 'image/jpeg';
  if (type && type !== 'application/octet-stream') return MEDIA_MIME_KINDS[type] ? type : null;
  const ext = String(file.name || '').toLowerCase().split('.').pop();
  return EXT_MIME[ext] || null;
}

// Checks a picked file before upload: one MP4/MOV video or one PNG/JPEG
// image, at most 50 MB. Returns { ok, kind, mime } or { ok: false, error }.
export function validateMediaFile(file) {
  if (!file) return { ok: false, error: msg('Choose a file.', 'اختر ملفًا.') };
  const mime = resolveMime(file);
  if (!mime) {
    return { ok: false, error: msg('Use an MP4 or MOV video, or a PNG or JPEG image.', 'استخدم فيديو MP4 أو MOV، أو صورة PNG أو JPEG.') };
  }
  if (!file.size) return { ok: false, error: msg('That file is empty.', 'هذا الملف فارغ.') };
  if (file.size > MAX_MEDIA_BYTES) {
    const mb = formatMB(file.size);
    return { ok: false, error: msg(`That file is ${mb} MB. The limit is 50 MB.`, `حجم الملف ${mb} ميجابايت، والحد الأقصى 50 ميجابايت.`) };
  }
  return { ok: true, kind: MEDIA_MIME_KINDS[mime], mime };
}

// Storage / network failure → message for the admin.
export function mediaUploadError(err) {
  if (err && err.userMessage) return err.userMessage;
  const status = Number(err?.status ?? err?.statusCode);
  const text = String(err?.message || '');
  if (err?.name === 'AbortError') return msg('Upload cancelled.', 'تم إلغاء الرفع.');
  if (status === 413 || /exceeded the maximum|too large/i.test(text)) {
    return msg('That file is over the 50 MB limit.', 'الملف أكبر من الحد الأقصى (50 ميجابايت).');
  }
  if (status === 415 || /mime type|invalid_mime/i.test(text)) {
    return msg('Use an MP4 or MOV video, or a PNG or JPEG image.', 'استخدم فيديو MP4 أو MOV، أو صورة PNG أو JPEG.');
  }
  if (status === 401 || status === 403 || /row-level security|unauthori[sz]ed|not_signed_in|jwt/i.test(text)) {
    return msg('Only Wellness House admins can upload media. Sign in again and retry.', 'رفع الوسائط متاح لمسؤولي Wellness House فقط. سجّل الدخول مجددًا وحاول مرة أخرى.');
  }
  return msg('Upload failed. Check your connection and try again.', 'تعذّر الرفع. تحقّق من الاتصال وحاول مرة أخرى.');
}

export { HABIT_CATEGORIES };
