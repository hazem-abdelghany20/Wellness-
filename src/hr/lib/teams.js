// Teams in the HR portal: error copy and the dashboard team card rows.
// Pure functions; the calls themselves are src/lib/supabase-teams.ts.
import { libraryError, errorCode } from '../../shared/authoring/errors.js';

const n = (v, lang) => (lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(v ?? 0) : String(v ?? 0));

// What still runs for a team (team_in_use details: 'routine,challenge,broadcast').
export function inUseList(details, lang) {
  const parts = String(details || '').split(',').map((x) => x.trim()).filter(Boolean);
  const label = {
    routine: lang === 'ar' ? 'روتين' : 'a routine',
    challenge: lang === 'ar' ? 'تحدي' : 'a challenge',
    broadcast: lang === 'ar' ? 'رسالة متجدولة' : 'a scheduled message',
  };
  const names = parts.map((p) => label[p]).filter(Boolean);
  if (!names.length) return '';
  if (lang === 'ar') return names.join(' و');
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// A teams error in the UI language, with the team's name and the details
// the backend sends (member count, what still runs).
export function teamErrorText(e, lang, teamName = '') {
  const code = errorCode(e);
  const ar = lang === 'ar';
  const name = teamName ? (ar ? `«${teamName}»` : `“${teamName}”`) : (ar ? 'الفريق ده' : 'This team');
  switch (code) {
    case 'team_not_empty': {
      const count = Number(e?.details);
      return ar
        ? `${name} لسه فيه ${Number.isFinite(count) && count > 0 ? `${n(count, 'ar')} شخص` : 'ناس'}. انقلهم لـ«من غير فريق» الأول، أو اختار «انقلهم واحذف».`
        : `${name} still has ${Number.isFinite(count) && count > 0 ? `${count} ${count === 1 ? 'person' : 'people'}` : 'people'} in it. Move them to “No team” first, or choose “Move them and delete”.`;
    }
    case 'team_in_use': {
      const what = inUseList(e?.details, lang);
      return ar
        ? `لسه فيه حاجة شغالة لـ${name}${what ? ` (${what})` : ''}. وقّفها أو الغيها الأول، وبعدين احذف الفريق.`
        : `${name} still has ${what || 'something'} running. End or cancel it first, then delete the team.`;
    }
    case 'team_name_taken':
      return ar ? 'فيه فريق بنفس الاسم ده.' : 'There’s already a team with that name.';
    case 'name_required':
      return ar ? 'اكتب اسم الفريق.' : 'Type the team’s name.';
    case 'name_too_long':
      return ar ? 'الاسم طويل. خليه أقل من ٨٠ حرف.' : 'Keep the name under 80 characters.';
    case 'protected_role':
      return ar ? 'حسابات الـ HR والمسؤولين مبتتغيرش من هنا.' : 'HR and admin accounts can’t be made team leads.';
    case 'person_has_no_team':
      return ar ? 'حط الشخص ده في فريق الأول، وبعدين خليه قائد الفريق.' : 'Put this person in a team first, then make them its lead.';
    case 'person_not_found':
      return ar ? 'فيه شخص مبقاش موجود. حدّث الصفحة وجرّب تاني.' : 'Someone is no longer in the company. Reload and try again.';
    case 'team_not_found':
      return ar ? 'الفريق ده مبقاش موجود. حدّث الصفحة.' : 'That team no longer exists. Reload the page.';
    case 'too_many_items':
      return ar ? 'لحد ٥٠٠ شخص في المرة.' : 'Up to 500 people at a time.';
    default:
      return libraryError(e, lang);
  }
}

// Note shown wherever a lead is set.
export const LEAD_NOTE = {
  en: 'A new team lead sees their lead features in the app within an hour.',
  ar: 'قائد الفريق الجديد بيشوف مميزات القائد في التطبيق خلال ساعة.',
};

// Invites still waiting, per team name (pending + expired).
export function waitingByTeam(invites) {
  const out = new Map();
  for (const i of invites || []) {
    if (!i || i.status === 'joined') continue;
    const key = String(i.team || '').trim().toLowerCase();
    out.set(key, (out.get(key) || 0) + 1);
  }
  return out;
}

// The dashboard team card.
//   teams:      listTeams().teams  ({ id, name, department, members, leads })
//   noTeam:     listTeams().no_team
//   invites:    list_people_invites rows (team name + status)
//   report:     getRoutineReport('7d') (folded by_team, teams_folded, breakdown_suppressed)
//   challenges: hr_habit_challenges rows (team challenges running this week)
//   minCohort:  the company's floor (report.min_cohort, default 5)
// → { rows, other, breakdownSuppressed, foldedNote, showChallenge, hasRoutine }
//   rows[i].routine: { kind: 'pct', pct } | { kind: 'grouped' } | { kind: 'none' }
//   rows[i].tookPart: number | null (team's own challenge this week, team ≥ floor)
export function buildTeamCard({ teams = [], noTeam = 0, invites = [], report = null, challenges = [], minCohort } = {}) {
  const floor = minCohort || report?.min_cohort || 5;
  const waiting = waitingByTeam(invites);
  const byTeam = new Map();
  let other = null;
  for (const row of report?.by_team || []) {
    if (row.small) other = row;
    else if (row.team_id) byTeam.set(row.team_id, row);
  }
  const breakdownSuppressed = !!report?.breakdown_suppressed;
  const hasRoutine = !!report?.has_routine;
  const running = new Map();
  for (const c of challenges || []) {
    if (c && c.team_id && c.status === 'active') running.set(c.team_id, c);
  }
  const rows = (teams || []).map((t) => {
    const shown = byTeam.get(t.id);
    let routine = { kind: 'none' };
    if (hasRoutine && !breakdownSuppressed) {
      if (shown) routine = { kind: 'pct', pct: shown.completion_pct ?? null };
      else if (other) routine = { kind: 'grouped' };
    }
    const ch = running.get(t.id);
    const tookPart = ch && (ch.members ?? 0) >= floor ? (ch.participants ?? 0) : null;
    const joined = t.members ?? 0;
    const invited = waiting.get(String(t.name || '').trim().toLowerCase()) || 0;
    return {
      id: t.id, name: t.name, department: t.department || null,
      leads: (t.leads || []).map((l) => l.display_name).filter(Boolean),
      joined, invited, members: joined + invited, routine, tookPart,
    };
  });
  return {
    rows,
    noTeam: noTeam || 0,
    noTeamInvited: waiting.get('') || 0,
    other: hasRoutine && !breakdownSuppressed && other
      ? { teams: other.teams || 0, members: other.members || 0, pct: other.completion_pct ?? null }
      : null,
    breakdownSuppressed: hasRoutine && breakdownSuppressed,
    foldedNote: hasRoutine && !breakdownSuppressed && (report?.teams_folded || 0) > 0,
    showChallenge: rows.some((r) => r.tookPart != null),
    hasRoutine,
    minCohort: floor,
  };
}
