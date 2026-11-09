// Routine report (hr_routine_report / hr_routine_people) → what the report
// page draws and the rows of the .xlsx export. Pure functions.
import { pickLang, fmtDate, msg } from './text.js';
import { weekdayLabel } from './routine-form.js';

export const REPORT_RANGES = ['7d', '14d', '30d', '90d'];

export function rangeLabel(range, lang) {
  const n = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[range] || 14;
  return lang === 'ar' ? `آخر ${new Intl.NumberFormat('ar-EG').format(n)} يوم` : `Last ${n} days`;
}

// A team row's display name: the team, "Small teams (3)" or "No team".
export function teamRowLabel(row, lang) {
  if (row.small) {
    return lang === 'ar'
      ? `فرق صغيرة (${new Intl.NumberFormat('ar-EG').format(row.teams || 0)})`
      : `Small teams (${row.teams || 0})`;
  }
  if (row.no_team) return lang === 'ar' ? 'من غير فريق' : 'No team';
  return row.name || (lang === 'ar' ? 'فريق' : 'Team');
}

// Hours to draw: 08:00–18:00 at least, widened to any hour with ticks.
export function hourWindow(byHour) {
  const busy = (byHour || []).filter((h) => (h.checks || 0) > 0).map((h) => h.hour);
  const from = Math.min(8, ...busy);
  const to = Math.max(18, ...busy);
  const map = new Map((byHour || []).map((h) => [h.hour, h.checks || 0]));
  const out = [];
  for (let h = from; h <= to; h++) out.push({ hour: h, checks: map.get(h) || 0 });
  return out;
}

export function shapeRoutineReport(report, lang) {
  const r = report || {};
  const today = r.today || {};
  const byDay = (r.by_day || []).map((d) => ({
    ...d,
    label: `${weekdayLabel(d.weekday, lang, true)} ${fmtDate(d.date, lang, { day: 'numeric' })}`,
    title: fmtDate(d.date, lang, { weekday: 'long', day: 'numeric', month: 'short' }),
  }));
  const teams = (r.by_team || []).map((t) => ({ ...t, label: teamRowLabel(t, lang) }));
  const exercises = (r.by_exercise || []).map((x) => ({ ...x, title: pickLang(lang, x.title_en, x.title_ar) }));
  const hours = hourWindow(r.by_hour);
  return {
    suppressed: !!r.suppressed,
    hasRoutine: !!r.has_routine,
    minCohort: r.min_cohort || 5,
    members: r.members || 0,
    today: {
      done: today.done || 0, due: today.due || 0, pct: today.pct ?? null,
      active: today.active || 0, assigned: today.assigned || 0, activePct: today.active_pct ?? null,
      fullDays: today.full_days || 0,
    },
    totals: {
      done: r.totals?.done || 0, due: r.totals?.due || 0, pct: r.totals?.completion_pct ?? null,
      activePeople: r.totals?.active_people || 0, fullDays: r.totals?.full_days || 0,
    },
    byDay,
    maxDayDue: Math.max(1, ...byDay.map((d) => d.due || 0)),
    teams,
    smallTeamsHidden: !!r.small_teams_hidden,
    exercises,
    hours,
    maxHour: Math.max(1, ...hours.map((h) => h.checks)),
    hasTicks: (r.totals?.done || 0) > 0,
  };
}

const pctCell = (v) => (v == null ? '—' : `${v}%`);

// Sheets for the .xlsx export: [{ sheet, rows: [[header…], [cells…]] }].
export function reportSheets(report, people, lang) {
  const ar = lang === 'ar';
  const t = (en, a) => (ar ? a : en);
  const shaped = shapeRoutineReport(report, lang);
  const r = report || {};
  const summary = [
    [t('Routine report', 'تقرير الروتين'), ''],
    [t('Period', 'الفترة'), rangeLabel(r.range, lang)],
    [t('From', 'من'), r.from || ''],
    [t('To', 'إلى'), r.to || ''],
    [t('Time zone', 'المنطقة الزمنية'), r.timezone || ''],
    [t('People on the app', 'على التطبيق'), shaped.members],
    [t('Today: items done', 'النهارده: اتعمل'), shaped.today.done],
    [t('Today: items due', 'النهارده: المطلوب'), shaped.today.due],
    [t('Today: completion', 'النهارده: نسبة الإنجاز'), pctCell(shaped.today.pct)],
    [t('Today: people active', 'النهارده: ناس نشطة'), shaped.today.active],
    [t('Period: items done', 'الفترة: اتعمل'), shaped.totals.done],
    [t('Period: items due', 'الفترة: المطلوب'), shaped.totals.due],
    [t('Period: completion', 'الفترة: نسبة الإنجاز'), pctCell(shaped.totals.pct)],
    [t('Period: people active', 'الفترة: ناس نشطة'), shaped.totals.activePeople],
    [t('Full days (everything done)', 'أيام كاملة (كله اتعمل)'), shaped.totals.fullDays],
  ];
  if (shaped.suppressed) {
    summary.push([t('Note', 'ملاحظة'), t(`Fewer than ${shaped.minCohort} people on the app: percentages are hidden.`,
      `أقل من ${shaped.minCohort} على التطبيق: النسب مخفية.`)]);
  }
  const sheets = [
    { sheet: t('Summary', 'ملخص'), rows: summary },
    {
      sheet: t('By day', 'باليوم'),
      rows: [
        [t('Date', 'التاريخ'), t('Day', 'اليوم'), t('People with the routine', 'عندهم الروتين'), t('Active', 'نشطين'),
          t('Done', 'اتعمل'), t('Due', 'المطلوب'), t('Completion', 'الإنجاز'), t('Full days', 'أيام كاملة')],
        ...(r.by_day || []).map((d) => [d.date, weekdayLabel(d.weekday, lang), d.assigned, d.active, d.done, d.due, pctCell(d.pct), d.full_days]),
      ],
    },
    {
      sheet: t('By team', 'بالفريق'),
      rows: [
        [t('Team', 'الفريق'), t('Department', 'القسم'), t('Members', 'العدد'), t('Active', 'نشطين'), t('Active %', 'نسبة النشاط'),
          t('Done', 'اتعمل'), t('Due', 'المطلوب'), t('Completion', 'الإنجاز'), t('Items a day', 'عناصر في اليوم')],
        ...shaped.teams.map((x) => [x.label, x.department || '', x.members, x.active, pctCell(x.active_pct), x.done, x.due,
          pctCell(x.completion_pct), x.avg_items_per_day ?? '—']),
      ],
    },
    {
      sheet: t('By exercise', 'بالتمرين'),
      rows: [
        [t('Exercise', 'التمرين'), t('Done', 'اتعمل'), t('Due', 'المطلوب'), t('Completion', 'الإنجاز')],
        ...shaped.exercises.map((x) => [x.title, x.done, x.due, pctCell(x.pct)]),
      ],
    },
    {
      sheet: t('By hour', 'بالساعة'),
      rows: [
        [t('Hour', 'الساعة'), t('Ticks', 'علامات')],
        ...(r.by_hour || []).map((h) => [`${String(h.hour).padStart(2, '0')}:00`, h.checks || 0]),
      ],
    },
  ];
  if (people?.enabled && (people.people || []).length) {
    sheets.push({
      sheet: t('People who share', 'اللي بيشاركوا تقدمهم'),
      rows: [
        [t('Name', 'الاسم'), t('Team', 'الفريق'), t('Days active', 'أيام نشاط'), t('Items done', 'عناصر اتعملت'),
          t('Full days', 'أيام كاملة'), t('Streak', 'أيام ورا بعض'), t('Last active', 'آخر نشاط')],
        ...people.people.map((p) => [p.display_name, p.team_name || '', p.days_active, p.items_done, p.full_days, p.streak, p.last_active || '']),
      ],
    });
  }
  return sheets;
}

export const PEOPLE_WHY = msg(
  'Only people who chose, in their app, to share their progress with HR are named here. Everyone else is only counted, never named.',
  'هنا بس أسامي الناس اللي اختاروا من التطبيق يشاركوا تقدمهم مع الـ HR. الباقي بيتعدّوا بس، من غير أسامي.',
);
