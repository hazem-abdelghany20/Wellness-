import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge, AvatarMark } from '../../shared/components.jsx';
import { Tabs, Flash, inputStyle } from '../../shared/authoring/ui.jsx';
import { HRPageHeader } from './_header.jsx';
import { TeamsPanel } from './teams.jsx';
import { usePeople } from '../hooks/use-people.js';
import { useTeams } from '../hooks/use-teams.js';
import { useHRAuth } from '../state/auth-context.jsx';
import { movePeopleToTeam, setTeamLead } from '../../lib/supabase-teams';
import { useInvites } from '../../shared/use-invites.js';
import { PeopleImportPanel } from '../../shared/people-import-panel.jsx';
import { CopyButton } from '../../shared/join-link-card.jsx';
import { roleLabel, statusLabel, countByStatus, buildInviteLink } from '../../shared/people-import.js';
import { teamErrorText, LEAD_NOTE } from '../lib/teams.js';

const PROTECTED = new Set(['hr_admin', 'company_admin', 'wellness_admin']);
const NO_TEAM = '__none';
const personRole = (role, lang) => (role === 'manager' ? (lang === 'ar' ? 'قائد فريق' : 'Team lead') : roleLabel(role, lang));

// ── PEOPLE PAGE ──────────────────────────────────────────────────
// Two tabs: People (joined + invited, move to a team, team leads) and Teams.
function HRPeoplePage({ theme, S, lang, density, initialTab = 'people', teamApi }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const num = (n) => (lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n ?? 0) : String(n ?? 0));
  const api = teamApi || { movePeopleToTeam, setTeamLead };
  const { company } = useHRAuth();
  const companyId = company?.id || null;
  const { people, loading, refetch: refetchPeople } = usePeople();
  const { teams: teamList, noTeam, error: teamsError, refetch: refetchTeams } = useTeams();
  const { invites, refetch: refetchInvites, unavailable } = useInvites(companyId);
  const [page, setPage] = React.useState(initialTab === 'teams' ? 'teams' : 'people');
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [tab, setTab] = React.useState('joined');
  const [selected, setSelected] = React.useState(() => new Set());
  const [bulkTeam, setBulkTeam] = React.useState('');
  const [busy, setBusy] = React.useState(null);
  const [flash, setFlash] = React.useState(null);

  React.useEffect(() => { setPage(initialTab === 'teams' ? 'teams' : 'people'); }, [initialTab]);

  // Memoise team chip list directly from `people` so the hook order is
  // stable across the loading early-return below.
  const teams = React.useMemo(() => {
    const set = new Set();
    for (const p of (people || [])) {
      const t = p.teams?.name || p.team_name || '';
      if (t) set.add(t);
    }
    return Array.from(set).sort();
  }, [people]);

  const statusCounts = React.useMemo(() => countByStatus(invites), [invites]);
  const waiting = React.useMemo(() => (invites || []).filter((i) => i.status !== 'joined'), [invites]);

  if (loading && !(people || []).length) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…','جارٍ التحميل…')}
      </div>
    );
  }

  const roster = (people || []).map(p => ({
    id:     p.id,
    name:   p.display_name || '—',
    role:   p.role || '',
    teamId: p.team_id || '',
    team:   p.teams?.name || p.team_name || '',
    dept:   p.teams?.department || '',
  }));
  const q = search.toLowerCase();
  const filtered = roster.filter(p =>
    (filter === 'all' || p.team === filter) &&
    (search === '' || p.name.toLowerCase().includes(q) || (p.team || '').toLowerCase().includes(q))
  );
  const waitingFiltered = waiting.filter(i =>
    (filter === 'all' || i.team === filter) &&
    (search === '' || (i.name || '').toLowerCase().includes(q) || i.email.includes(q) || (i.team || '').toLowerCase().includes(q))
  );
  const teamChips = Array.from(new Set([...teams, ...waiting.map((i) => i.team).filter(Boolean)])).sort();
  const teamName = (id) => (teamList.find((t) => t.id === id)?.name) || '';
  const selectedShown = filtered.filter((p) => selected.has(p.id));
  const allShownSelected = filtered.length > 0 && selectedShown.length === filtered.length;

  const reload = async () => { await Promise.all([refetchPeople(), refetchTeams()]); };
  const onImported = () => { refetchPeople(); refetchInvites(); refetchTeams(); };

  const toggle = (id) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllShown = () => setSelected((cur) => {
    const next = new Set(cur);
    if (allShownSelected) filtered.forEach((p) => next.delete(p.id));
    else filtered.forEach((p) => next.add(p.id));
    return next;
  });

  // teamId null = "No team". who = the person's name when moving one.
  async function move(ids, teamId, who) {
    if (!ids.length) return;
    setBusy('move'); setFlash(null);
    try {
      const out = await api.movePeopleToTeam(ids, teamId || null);
      const target = teamId ? teamName(teamId) : '';
      const count = out?.moved ?? ids.length;
      setFlash({ kind: 'ok', text: who
        ? (target ? s(`${who} is now in ${target}.`, `${who} بقى في ${target}.`) : s(`${who} is now in “No team”.`, `${who} بقى في «من غير فريق».`))
        : (target ? s(`Moved ${count} ${count === 1 ? 'person' : 'people'} to ${target}.`, `اتنقل ${num(count)} شخص لـ${target}.`)
                  : s(`Moved ${count} ${count === 1 ? 'person' : 'people'} to “No team”.`, `اتنقل ${num(count)} شخص لـ«من غير فريق».`)) });
      setSelected(new Set());
      setBulkTeam('');
      await reload();
    } catch (e) {
      setFlash({ kind: 'err', text: teamErrorText(e, lang, teamId ? teamName(teamId) : '') });
    } finally {
      setBusy(null);
    }
  }

  async function lead(p, on) {
    setBusy(`lead-${p.id}`); setFlash(null);
    try {
      await api.setTeamLead(p.id, on);
      setFlash({ kind: 'ok', text: on
        ? s(`${p.name} is now the lead of ${p.team}. ${LEAD_NOTE.en}`, `${p.name} بقى قائد ${p.team}. ${LEAD_NOTE.ar}`)
        : s(`${p.name} is no longer a team lead.`, `${p.name} مبقاش قائد فريق.`) });
      await reload();
    } catch (e) {
      setFlash({ kind: 'err', text: teamErrorText(e, lang) });
    } finally {
      setBusy(null);
    }
  }

  const tabBtn = (k, label) => (
    <button key={k} onClick={() => setTab(k)} style={{
      padding: '6px 12px', borderRadius: 6, border: 'none',
      background: tab === k ? T.panel : 'transparent',
      color: tab === k ? T.text : T.textMuted,
      fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{label}</button>
  );
  // Team picker. With a placeholder (bulk move) "No team" is its own value.
  const teamSelect = (value, onChange, label, placeholder) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} disabled={busy === 'move'}
      style={{ ...inputStyle(T), width: 'auto', minWidth: 130, maxWidth: 200, padding: '6px 8px', fontSize: 12 }}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      <option value={placeholder ? NO_TEAM : ''}>{s('No team', 'من غير فريق')}</option>
      {teamList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Your company','شركتك')}
        title={s('People','الأشخاص')}
        sub={s('Who is on the app, their teams and team leads · no health data','مين على التطبيق وفرقهم وقادة الفرق · من غير بيانات صحية')}/>

      <div style={{ marginBottom: DENSITY[density].gap }}>
        <Tabs theme={T} value={page} onChange={setPage} label={s('People or teams', 'الأشخاص أو الفرق')} tabs={[
          { id: 'people', label: `${s('People', 'الأشخاص')} · ${num(roster.length)}` },
          { id: 'teams', label: `${s('Teams', 'الفرق')} · ${num(teamList.length)}` },
        ]}/>
      </div>

      {page === 'teams' ? (
        <TeamsPanel theme={T} lang={lang} density={density} teams={teamList} noTeam={noTeam} loadError={teamsError} onChanged={reload}/>
      ) : (
        <>
          {companyId && (
            <div style={{ marginBottom: DENSITY[density].gap }}>
              <PeopleImportPanel theme={T} lang={lang} density={density}
                companyId={companyId} companyName={company?.name}
                existingTeams={teamList} onImported={onImported}/>
            </div>
          )}

          <Flash theme={T} flash={flash}/>

          <Panel theme={T} density={density} pad={false}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}>
                {tabBtn('joined', `${s('Joined','انضموا')} · ${num(roster.length)}`)}
                {!unavailable && tabBtn('waiting', `${s('Invited, not joined','مدعوون لم ينضموا')} · ${num(statusCounts.pending + statusCounts.expired)}`)}
              </div>
              <div style={{ flex: 1, minWidth: 200, height: 36, background: T.panelSunk, borderRadius: 9, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
                <HRIcon name="search" size={15} stroke={T.textMuted}/>
                <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={s('Search people or teams…','ابحث عن أشخاص أو فرق…')}
                  aria-label={s('Search people or teams','ابحث عن أشخاص أو فرق')}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}/>
              </div>
              <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, flexWrap: 'wrap', maxWidth: '60%' }}>
                {[['all', s('All','الكل')], ...teamChips.map(t => [t, t])].map(([k, l]) => (
                  <button key={k} onClick={()=>setFilter(k)} style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none',
                    background: filter===k ? T.panel : 'transparent',
                    color: filter===k ? T.text : T.textMuted,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {tab === 'joined' ? (
              <div>
                {/* Select bar: tick people, then move them all at once. */}
                <div style={{
                  padding: '10px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  background: selected.size ? T.accentSoft : 'transparent',
                }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.textMid, cursor: 'pointer' }}>
                    <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} disabled={!filtered.length}
                      aria-label={s('Select everyone shown', 'اختار كل اللي ظاهرين')}/>
                    {selected.size
                      ? s(`${selected.size} selected`, `${num(selected.size)} متختارين`)
                      : s('Tick people to move several at once', 'علّم على الناس علشان تنقل كذا واحد مرة واحدة')}
                  </label>
                  {selected.size > 0 && (
                    <>
                      <span style={{ fontSize: 12, color: T.textMid }}>{s('Move to', 'انقلهم لـ')}</span>
                      {teamSelect(bulkTeam, setBulkTeam, s('Move the selected people to', 'انقل المختارين لـ'), s('Pick a team…', 'اختار فريق…'))}
                      <HRButton theme={T} size="sm" variant="primary" disabled={!bulkTeam || busy === 'move'}
                        onClick={() => move([...selected], bulkTeam === NO_TEAM ? null : bulkTeam)}>
                        {busy === 'move' ? s('Moving…', 'جارٍ النقل…') : s(`Move ${selected.size}`, `انقل ${num(selected.size)}`)}
                      </HRButton>
                      <HRButton theme={T} size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{s('Clear', 'امسح الاختيار')}</HRButton>
                    </>
                  )}
                </div>
                {filtered.map((p, i) => {
                  const isProtected = PROTECTED.has(p.role);
                  return (
                    <div key={p.id || i} style={{
                      padding: `${DENSITY[density].cellPadY + 4}px 18px`,
                      borderBottom: i < filtered.length - 1 ? `1px solid ${T.divider}` : 'none',
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    }}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                        aria-label={s(`Select ${p.name}`, `اختار ${p.name}`)}/>
                      <AvatarMark theme={T} name={p.name} size={36}/>
                      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                          {p.team || s('No team', 'من غير فريق')}{p.dept ? ` · ${p.dept}` : ''}
                        </div>
                      </div>
                      <Badge theme={T} tone={p.role === 'manager' ? 'info' : 'neutral'}>{p.role ? personRole(p.role, lang) : (lang==='ar'?'موظف':'Member')}</Badge>
                      {teamSelect(p.teamId, (v) => { if (v !== p.teamId) move([p.id], v || null, p.name); }, s(`Team for ${p.name}`, `فريق ${p.name}`))}
                      {!isProtected && (p.role === 'manager' ? (
                        <HRButton theme={T} size="sm" variant="ghost" disabled={busy === `lead-${p.id}`} onClick={() => lead(p, false)}>
                          {s('Remove lead', 'شيل القيادة')}
                        </HRButton>
                      ) : (
                        <HRButton theme={T} size="sm" variant="secondary" disabled={!p.teamId || busy === `lead-${p.id}`}
                          title={!p.teamId ? s('Put them in a team first', 'حطه في فريق الأول') : undefined}
                          onClick={() => lead(p, true)}>
                          {s('Make team lead', 'اجعله قائد الفريق')}
                        </HRButton>
                      ))}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
                    {s('No people match this search.','لا يوجد أشخاص مطابقون.')}
                  </div>
                )}
                {filtered.length > 0 && (
                  <div style={{ padding: '10px 18px', fontSize: 12, color: T.textMuted, borderTop: `1px solid ${T.divider}` }}>
                    {lang === 'ar' ? LEAD_NOTE.ar : LEAD_NOTE.en}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {waitingFiltered.map((inv, i) => (
                  <div key={inv.email} style={{
                    padding: `${DENSITY[density].cellPadY + 4}px 18px`,
                    borderBottom: i < waitingFiltered.length - 1 ? `1px solid ${T.divider}` : 'none',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <AvatarMark theme={T} name={inv.name || inv.email} size={40}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{inv.name || inv.email}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                        <span dir="ltr">{inv.email}</span>{inv.team ? ` · ${inv.team}` : ''} · {roleLabel(inv.role, lang)}
                      </div>
                    </div>
                    <Badge theme={T} tone={inv.status === 'expired' ? 'danger' : 'caution'}>{statusLabel(inv.status, lang)}</Badge>
                    <CopyButton theme={T} lang={lang} variant="ghost"
                      text={buildInviteLink(window.location.origin, inv.token, inv.role)}
                      label={s('Copy link','نسخ الرابط')}/>
                  </div>
                ))}
                {waitingFiltered.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
                    {waiting.length === 0
                      ? s('Everyone you invited has joined.','كل من دعوتهم انضموا.')
                      : s('No invites match this search.','لا توجد دعوات مطابقة.')}
                  </div>
                )}
                {statusCounts.expired > 0 && (
                  <div style={{ padding: '10px 18px', fontSize: 12, color: T.textMuted, borderTop: `1px solid ${T.divider}` }}>
                    {s('Expired links stop working. Import the same sheet again to renew them for 90 days.',
                       'الروابط المنتهية لا تعمل. أعد استيراد نفس الملف لتجديدها ٩٠ يومًا.')}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

export { HRPeoplePage };
