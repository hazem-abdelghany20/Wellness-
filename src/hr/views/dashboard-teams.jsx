import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader } from '../../shared/components.jsx';
import { fmtNum, fmtPct, msgText } from '../../shared/authoring/text.js';
import { teamRowLabel, TEAMS_FOLDED, TEAMS_SUPPRESSED } from '../../shared/authoring/report-shape.js';
import { listTeams } from '../../lib/supabase-teams';
import { getRoutineReport } from '../../lib/supabase-routines';
import { listHabitChallenges } from '../../lib/supabase-hr';
import { listPeopleInvites } from '../../lib/supabase-invites';
import { buildTeamCard } from '../lib/teams.js';

const defaultApi = {
  teams: () => listTeams(),
  report: () => getRoutineReport('7d'),
  challenges: () => listHabitChallenges(),
  invites: (companyId) => (companyId ? listPeopleInvites(companyId) : Promise.resolve([])),
};

// Dashboard → Teams: people per team (joined / invited), this week's team
// challenge, and the routine over the last 7 days with the backend's privacy
// folding ("Other teams"; no team breakdown when too few people).
export function DashboardTeamsCard({ theme, lang, density, companyId, setNav, api = defaultApi }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const n = (v) => fmtNum(v, lang);
  const [state, setState] = React.useState({ loading: true, error: null, data: null });

  React.useEffect(() => {
    let live = true;
    Promise.all([
      api.teams(),
      api.report().catch(() => null),
      api.challenges().catch(() => []),
      api.invites(companyId).catch(() => []),
    ]).then(([teams, report, challenges, invites]) => {
      if (live) setState({ loading: false, error: null, data: { teams, report, challenges, invites } });
    }).catch((e) => { if (live) setState({ loading: false, error: e, data: null }); });
    return () => { live = false; };
  }, [api, companyId]);

  const header = (
    <PanelHeader theme={T} density={density} title={s('Teams', 'الفرق')}
      subtitle={s('People per team, and how the routine went in the last 7 days', 'الناس في كل فريق، والروتين ماشي إزاي آخر ٧ أيام')}
      right={setNav ? <HRButton theme={T} size="sm" onClick={() => setNav('people', 'teams')}>{s('Manage teams', 'إدارة الفرق')}</HRButton> : null}/>
  );

  if (state.loading) {
    return <Panel theme={T} density={density} pad={false}>{header}<div style={{ padding: DENSITY[density].cardPad, fontSize: 13, color: T.textMuted }}>{s('Loading…', 'جارٍ التحميل…')}</div></Panel>;
  }
  if (state.error || !state.data) {
    return <Panel theme={T} density={density} pad={false}>{header}<div role="alert" style={{ padding: DENSITY[density].cardPad, fontSize: 13, color: T.textMuted }}>{s('Teams couldn’t load right now.', 'الفرق مقدرتش تتحمّل دلوقتي.')}</div></Panel>;
  }

  const { teams, report, challenges, invites } = state.data;
  const card = buildTeamCard({
    teams: teams?.teams || [], noTeam: teams?.no_team || 0, invites, report, challenges,
  });

  if (!card.rows.length) {
    return (
      <Panel theme={T} density={density} pad={false}>
        {header}
        <div style={{ padding: DENSITY[density].cardPad, fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
          {s('No teams yet. Make teams so routines, challenges and messages can go to one team.', 'لسه مفيش فرق. اعمل فرق علشان الروتين والتحديات والرسايل تقدر تروح لفريق واحد.')}
          {setNav && <div style={{ marginTop: 12 }}><HRButton theme={T} size="sm" variant="primary" icon="plus" onClick={() => setNav('people', 'teams')}>{s('Create a team', 'اعمل فريق')}</HRButton></div>}
        </div>
      </Panel>
    );
  }

  const showRoutine = card.hasRoutine && !card.breakdownSuppressed;
  const th = { textAlign: 'start', padding: '8px 14px', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700, color: T.textMuted, whiteSpace: 'nowrap' };
  const td = { padding: '9px 14px', fontSize: 12, color: T.text, borderTop: `1px solid ${T.divider}` };
  const routineCell = (r) => {
    if (r.kind === 'pct') return <span className="mono">{fmtPct(r.pct, lang)}</span>;
    if (r.kind === 'grouped') return <span style={{ color: T.textMuted }}>{s('In “Other teams”', 'في «فرق تانية»')}</span>;
    return <span style={{ color: T.textFaint }}>—</span>;
  };

  return (
    <Panel theme={T} density={density} pad={false}>
      {header}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label={s('Teams', 'الفرق')}>
          <thead>
            <tr>
              <th style={th}>{s('Team', 'الفريق')}</th>
              <th style={th}>{s('Joined', 'انضموا')}</th>
              <th style={th}>{s('Invited', 'مدعوين')}</th>
              {card.showChallenge && <th style={th}>{s('Took part this week', 'شاركوا الأسبوع ده')}</th>}
              {showRoutine && <th style={th}>{s('Routine done', 'الروتين اتعمل')}</th>}
            </tr>
          </thead>
          <tbody>
            {card.rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 600 }}>
                  {r.name}
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>
                    {r.leads.length ? s(`Lead: ${r.leads.join(', ')}`, `القائد: ${r.leads.join('، ')}`) : (r.department || '')}
                  </div>
                </td>
                <td style={td} className="mono">{n(r.joined)}</td>
                <td style={td} className="mono">{r.invited ? n(r.invited) : '—'}</td>
                {card.showChallenge && <td style={td} className="mono">{r.tookPart == null ? '—' : n(r.tookPart)}</td>}
                {showRoutine && <td style={td}>{routineCell(r.routine)}</td>}
              </tr>
            ))}
            {showRoutine && card.other && (
              <tr>
                <td style={{ ...td, fontWeight: 600 }}>
                  {teamRowLabel({ small: true, teams: card.other.teams }, lang)}
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>{s('Grouped to protect privacy', 'متجمّعين علشان الخصوصية')}</div>
                </td>
                <td style={td} className="mono">{n(card.other.members)}</td>
                <td style={td}/>
                {card.showChallenge && <td style={td}/>}
                <td style={td} className="mono">{fmtPct(card.other.pct, lang)}</td>
              </tr>
            )}
            {(card.noTeam > 0 || card.noTeamInvited > 0) && (
              <tr>
                <td style={{ ...td, color: T.textMuted }}>{s('No team', 'من غير فريق')}</td>
                <td style={{ ...td, color: T.textMuted }} className="mono">{n(card.noTeam)}</td>
                <td style={{ ...td, color: T.textMuted }} className="mono">{card.noTeamInvited ? n(card.noTeamInvited) : '—'}</td>
                {card.showChallenge && <td style={td}/>}
                {showRoutine && <td style={td}/>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {card.breakdownSuppressed && (
        <div role="note" style={{ padding: '10px 14px', fontSize: 12, color: T.textMid, borderTop: `1px solid ${T.divider}` }}>
          {msgText(TEAMS_SUPPRESSED, lang)}
        </div>
      )}
      {card.foldedNote && (
        <div role="note" style={{ padding: '10px 14px', fontSize: 11, color: T.textMuted, borderTop: `1px solid ${T.divider}` }}>
          {msgText(TEAMS_FOLDED, lang)}
        </div>
      )}
    </Panel>
  );
}
