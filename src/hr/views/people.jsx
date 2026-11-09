import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge, AvatarMark } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { usePeople } from '../hooks/use-people.js';
import { useHRAuth } from '../state/auth-context.jsx';
import { listCompanyTeams } from '../../lib/supabase-hr';
import { useInvites } from '../../shared/use-invites.js';
import { PeopleImportPanel } from '../../shared/people-import-panel.jsx';
import { CopyButton } from '../../shared/join-link-card.jsx';
import { roleLabel, statusLabel, countByStatus, buildInviteLink } from '../../shared/people-import.js';

// ── PEOPLE PAGE ──────────────────────────────────────────────────
function HRPeoplePage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const num = (n) => (lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n ?? 0) : String(n ?? 0));
  const { company } = useHRAuth();
  const companyId = company?.id || null;
  const { people, loading, refetch: refetchPeople } = usePeople();
  const { invites, refetch: refetchInvites, unavailable } = useInvites(companyId);
  const [companyTeams, setCompanyTeams] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [tab, setTab] = React.useState('joined');

  const loadTeams = React.useCallback(async () => {
    try { setCompanyTeams(await listCompanyTeams()); } catch { setCompanyTeams([]); }
  }, []);
  React.useEffect(() => { loadTeams(); }, [loadTeams]);

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

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…','جارٍ التحميل…')}
      </div>
    );
  }

  const roster = (people || []).map(p => ({
    id:    p.id,
    name:  p.display_name || '—',
    role:  p.role || '',
    team:  p.teams?.name || p.team_name || '',
    dept:  p.teams?.department || '',
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

  const onImported = () => { refetchPeople(); refetchInvites(); loadTeams(); };
  const tabBtn = (k, label) => (
    <button key={k} onClick={() => setTab(k)} style={{
      padding: '6px 12px', borderRadius: 6, border: 'none',
      background: tab === k ? T.panel : 'transparent',
      color: tab === k ? T.text : T.textMuted,
      fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{label}</button>
  );

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Direct reports','تقارير مباشرة')}
        title={s('People','الأشخاص')}
        sub={s('Aggregate-only view · names visible only when consent + role allows','عرض مجمع فقط · الأسماء ظاهرة عند الموافقة')}
        right={<HRButton theme={T} variant="secondary" icon="content">{s('Export consented','تصدير المسموح')}</HRButton>}/>

      {companyId && (
        <div style={{ marginBottom: DENSITY[density].gap }}>
          <PeopleImportPanel theme={T} lang={lang} density={density}
            companyId={companyId} companyName={company?.name}
            existingTeams={companyTeams} onImported={onImported}/>
        </div>
      )}

      <Panel theme={T} density={density} pad={false}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}>
            {tabBtn('joined', `${s('Joined','انضموا')} · ${num(roster.length)}`)}
            {!unavailable && tabBtn('waiting', `${s('Invited, not joined','مدعوون لم ينضموا')} · ${num(statusCounts.pending + statusCounts.expired)}`)}
          </div>
          <div style={{ flex: 1, minWidth: 200, height: 36, background: T.panelSunk, borderRadius: 9, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
            <HRIcon name="search" size={15} stroke={T.textMuted}/>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={s('Search people or teams…','ابحث عن أشخاص أو فرق…')}
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
            {filtered.map((p, i) => (
              <div key={p.id || i} style={{
                padding: `${DENSITY[density].cellPadY + 4}px 18px`,
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.divider}` : 'none',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <AvatarMark theme={T} name={p.name} size={40}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                    {p.role ? roleLabel(p.role, lang) : ''}{p.role && p.team ? ' · ' : ''}{p.team}
                    {p.dept ? ` · ${p.dept}` : ''}
                  </div>
                </div>
                <Badge theme={T} tone="neutral">{p.role ? roleLabel(p.role, lang) : (lang==='ar'?'موظف':'Member')}</Badge>
                <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
                {s('No people match this search.','لا يوجد أشخاص مطابقون.')}
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
  );
}

export { HRPeoplePage };
