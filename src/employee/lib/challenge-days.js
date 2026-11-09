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
