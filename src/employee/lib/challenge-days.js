// The workdays of a habit challenge, for the Challenge tab's day dots.
//
// my_habit_challenge() returns `days` (every Sun–Thu date of the challenge,
// one or several weeks). Use it as-is. Only an older server without `days`
// falls back to the Sun–Thu dates between start_date and end_date; never
// start_date + i, which would put Fri / Sat dots on multi-week challenges.

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function challengeDays(state) {
  if (Array.isArray(state?.days) && state.days.length) {
    return state.days.map((d) => String(d).slice(0, 10)).filter((d) => ISO.test(d));
  }
  const c = state?.challenge;
  if (!c?.start_date || !ISO.test(String(c.start_date).slice(0, 10))) return [];
  const start = String(c.start_date).slice(0, 10);
  const end = c.end_date && ISO.test(String(c.end_date).slice(0, 10)) ? String(c.end_date).slice(0, 10) : addDays(start, 4);
  const out = [];
  for (let d = start, guard = 0; d <= end && guard < 62; d = addDays(d, 1), guard += 1) {
    if (dow(d) < 5) out.push(d);
  }
  return out;
}

// Days grouped into Sun-based weeks: [{ weekStart, days: [...] }, ...].
export function groupByWeek(days) {
  const weeks = [];
  for (const d of days || []) {
    const ws = addDays(d, -dow(d));
    const last = weeks[weeks.length - 1];
    if (last && last.weekStart === ws) last.days.push(d);
    else weeks.push({ weekStart: ws, days: [d] });
  }
  return weeks;
}

// How many weeks the challenge runs: the server's `weeks`, else counted from the days.
export function challengeWeeks(state, days = challengeDays(state)) {
  const n = Number(state?.weeks);
  if (Number.isInteger(n) && n >= 1) return n;
  return Math.max(1, groupByWeek(days).length);
}

// Rows of day dots (sprint 4: a challenge can have any dates — 3 days, 23
// days, starting mid-week). Always from the days themselves, never from
// days_total / 5.
//   One week: one row with just its days.
//   Several weeks: every row has the same columns (the weekdays the
//   challenge uses, Sun → Thu), with null where that week has no day, so the
//   dots line up under each other.
// → [{ weekStart, slots: ['YYYY-MM-DD' | null, …] }]
export function dotRows(days) {
  const weeks = groupByWeek(days);
  if (weeks.length <= 1) return weeks.map((w) => ({ weekStart: w.weekStart, slots: w.days }));
  const cols = [...new Set((days || []).map(dow))].sort((a, b) => a - b);
  return weeks.map((w) => ({
    weekStart: w.weekStart,
    slots: cols.map((c) => w.days.find((d) => dow(d) === c) || null),
  }));
}

// "Day X of Y": which workday of the challenge we are on. X is the server's
// `elapsed` (workdays up to the day being logged), else counted from the
// days; at least 1 once the challenge runs, never more than Y.
// null when the challenge has no days.
export function challengeDayOf(state, days = challengeDays(state)) {
  const total = days.length || Math.max(0, Number(state?.days_total) || 0);
  if (!total) return null;
  let day = state?.elapsed === null || state?.elapsed === undefined ? NaN : Number(state.elapsed);
  if (!Number.isFinite(day)) {
    const target = state?.target_date ? String(state.target_date).slice(0, 10) : null;
    day = target ? days.filter((d) => d <= target).length : 0;
  }
  const min = state?.status === 'active' ? 1 : 0;
  return { day: Math.min(total, Math.max(min, Math.round(day))), total };
}
