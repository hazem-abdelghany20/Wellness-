// Small text / date helpers for the sprint 2 authoring screens (HR portal +
// Wellness House admin console). Pure functions.

export const msg = (en, ar) => ({ en, ar });

export const clean = (v) => String(v ?? '').trim();

// Trimmed text, or null when empty.
export const orNull = (v) => {
  const c = clean(v);
  return c ? c : null;
};

// The text in a language, falling back to the other one.
export function pickLang(lang, en, ar) {
  return (lang === 'ar' ? (ar || en) : (en || ar)) || '';
}

// A { en, ar } message (or a plain string) in a language.
export function msgText(m, lang) {
  if (!m) return '';
  if (typeof m === 'string') return m;
  return lang === 'ar' ? (m.ar || m.en || '') : (m.en || m.ar || '');
}

export function fmtNum(n, lang) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n) : String(n);
}

export function fmtPct(n, lang) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return lang === 'ar' ? `${fmtNum(n, lang)}٪` : `${n}%`;
}

// 'YYYY-MM-DD' → short label. Dates are company-local calendar dates, so
// they are formatted in UTC to avoid shifting a day.
export function fmtDate(iso, lang, opts = { day: 'numeric', month: 'short' }) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { ...opts, timeZone: 'UTC' }).format(d);
}

const isoOf = (d) => d.toISOString().slice(0, 10);

export function addDays(iso, n) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoOf(d);
}

// 0 = Sunday … 6 = Saturday.
export function weekdayOf(iso) {
  return new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getUTCDay();
}

// The browser's local calendar date (fallback when the company date isn't known).
export function localTodayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Today when it is a Sunday, else the coming Sunday. Never in the past.
export function upcomingSunday(todayIso) {
  const wd = weekdayOf(todayIso);
  return wd === 0 ? String(todayIso).slice(0, 10) : addDays(todayIso, 7 - wd);
}

// 'HH:MM' (24h) or null. Accepts '9:30', '09:30', '9.30'.
export function normalizeTime(v) {
  const m = clean(v).match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// 'HH:MM' + minutes, capped at 23:59.
export function addMinutes(hhmm, minutes) {
  const t = normalizeTime(hhmm);
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
