// Pure helpers for the Today tab (routine checklist). No React, no network:
// the hooks and screens use these so the rules are tested in one place.
//
// State shape: TodayState from src/lib/supabase-routines.ts (getMyToday()).

import { BODY_AREAS, WEEKDAYS } from '../../lib/supabase-routines';

// Same rule as score_events / my_today: +2 per ticked item (max 20 a day),
// +10 when everything due that day is ticked.
export const ROUTINE_POINTS = { item: 2, dailyItemCap: 20, fullDay: 10 };

export function routineDayPoints(done, total) {
  const d = Math.max(0, Number(done) || 0);
  const t = Math.max(0, Number(total) || 0);
  return Math.min(ROUTINE_POINTS.dailyItemCap, ROUTINE_POINTS.item * d)
    + (t > 0 && d >= t ? ROUTINE_POINTS.fullDay : 0);
}

// The most a routine can add in a Sun–Thu week (5 full days).
export const ROUTINE_FULL_WEEK = 5 * (ROUTINE_POINTS.dailyItemCap + ROUTINE_POINTS.fullDay);

// Next up, the same order my_today uses: the soonest unticked item still
// ahead, then untimed ones, then the earliest one already past.
export function nextItemId(items, now) {
  const open = (items || []).filter((i) => !i.checked);
  if (!open.length) return null;
  const t = typeof now === 'string' ? now : null;
  const ahead = t ? open.find((i) => i.at_time && i.at_time >= t) : null;
  if (ahead) return ahead.id;
  const untimed = open.find((i) => !i.at_time);
  if (untimed) return untimed.id;
  return open[0].id;
}

function progressOf(items) {
  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  return {
    done,
    total,
    pct: total > 0 ? Math.round((100 * done) / total) : null,
    all_done: total > 0 && done >= total,
    points: routineDayPoints(done, total),
  };
}

// The state after ticking / unticking one item (used for the optimistic UI).
// Unknown items leave the state as it is.
export function applyTick(state, itemId, checked) {
  if (!state || !Array.isArray(state.items)) return state;
  if (!state.items.some((i) => i.id === itemId)) return state;
  const items = state.items.map((i) => (i.id === itemId
    ? { ...i, checked: !!checked, checked_at: checked ? (i.checked_at || new Date().toISOString()) : null }
    : i));
  return { ...state, items, progress: progressOf(items), next_item_id: nextItemId(items, state.now) };
}

// Server state + every tick still in flight. pending: Map(itemId → { checked }).
export function applyPending(state, pending) {
  if (!state || !pending || pending.size === 0) return state;
  let s = state;
  for (const [itemId, op] of pending) s = applyTick(s, itemId, typeof op === 'object' ? op.checked : op);
  return s;
}

// Re-reads "past" and "next" against a newer company-local time, so the
// highlighted item moves on while the app stays open.
export function withClock(state, now) {
  if (!state || !Array.isArray(state.items) || !now || now === state.now) return state;
  const items = state.items.map((i) => {
    const isPast = !!i.at_time && i.at_time <= now;
    return isPast === i.is_past ? i : { ...i, is_past: isPast };
  });
  return { ...state, now, items, next_item_id: nextItemId(items, now) };
}

// The company's local date and time ('YYYY-MM-DD', 'HH:MM') right now, or
// null when the zone is unknown to this browser.
export function companyClock(timezone, at = new Date()) {
  if (!timezone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const hour = get('hour') === '24' ? '00' : get('hour');
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` };
  } catch {
    return null;
  }
}

const AR_DIGITS = new Intl.NumberFormat('ar-EG', { useGrouping: false });
const arNum = (s) => String(s).replace(/\d+/g, (d) => AR_DIGITS.format(Number(d)).padStart(d.length, AR_DIGITS.format(0)));

// '09:30' → '09:30' (EN) or '٠٩:٣٠' (AR). Empty for untimed items.
export function fmtTime(hhmm, lang) {
  if (!hhmm) return '';
  const t = String(hhmm).slice(0, 5);
  return lang === 'ar' ? arNum(t) : t;
}

// 'Tuesday, 10 November' / 'الثلاثاء، ١٠ نوفمبر'
export function fmtDateLong(iso, lang) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

export function weekdayShort(weekday, lang) {
  const w = (WEEKDAYS || []).find((d) => d.id === Number(weekday));
  if (!w) return '';
  return lang === 'ar' ? w.short_ar : w.short_en;
}

// obj[`${key}_ar`] in Arabic (falling back to English), obj[`${key}_en`] otherwise.
export function pick(obj, key, lang) {
  if (!obj) return '';
  const en = obj[`${key}_en`];
  const ar = obj[`${key}_ar`];
  return ((lang === 'ar' ? (ar || en) : (en || ar)) || '').trim();
}

export function dayTitleText(dayTitle, lang) {
  if (!dayTitle || typeof dayTitle !== 'object') return '';
  return ((lang === 'ar' ? (dayTitle.ar || dayTitle.en) : (dayTitle.en || dayTitle.ar)) || '').trim();
}

// "Today's focus": the first routine running today that has a title for this weekday.
export function todayFocus(state, lang) {
  for (const r of state?.routines || []) {
    const t = dayTitleText(r.day_title, lang);
    if (t) return t;
  }
  return '';
}

export function bodyAreaLabel(id, lang) {
  const a = (BODY_AREAS || []).find((b) => b.id === id);
  if (!a) return '';
  return lang === 'ar' ? a.ar : a.en;
}

export function bodyAreasText(exercise, lang) {
  const ids = Array.isArray(exercise?.body_areas) ? exercise.body_areas : [];
  return ids.map((id) => bodyAreaLabel(id, lang)).filter(Boolean).join(lang === 'ar' ? '، ' : ', ');
}

export function hasMedia(exercise) {
  if (!exercise || !exercise.media_type) return false;
  if (exercise.media_type === 'youtube') return !!exercise.media_youtube_id;
  return !!(exercise.media_path || exercise.media_url);
}

// The original table HR attached (picture or PDF), from the first routine that has one.
export function sourceFileOf(routines) {
  const r = (routines || []).find((x) => x && x.source_file_path);
  if (!r) return null;
  const mime = r.source_file_mime || '';
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(r.source_file_path);
  return {
    bucket: r.source_file_bucket || 'company-media',
    path: r.source_file_path,
    mime,
    kind: isPdf ? 'pdf' : 'image',
  };
}

// Routine points this week from the score card. week_parts.routine_items
// counts every tick, including the ones past the daily cap that earn 0, so
// the points come from the week total minus the other parts.
export function routineWeekPoints(me) {
  if (!me) return { items: 0, fullDays: 0, itemPoints: 0, fullDayPoints: 0 };
  const p = me.week_parts || {};
  const fullDays = Number(p.routine_full_days) || 0;
  const items = Number(p.routine_items) || 0;
  const other = 10 * (Number(p.habit_days) || 0) + 20 * (Number(p.weeks_done) || 0) + 5 * (Number(p.articles) || 0);
  const fullDayPoints = ROUTINE_POINTS.fullDay * fullDays;
  const itemPoints = Math.max(0, Math.min(ROUTINE_POINTS.item * items, (Number(me.week) || 0) - other - fullDayPoints));
  return { items, fullDays, itemPoints, fullDayPoints };
}
