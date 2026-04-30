import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge, AvatarMark } from '../components.jsx';
import { HRPageHeader } from './_header.jsx';
import { usePeople } from '../hooks/use-people.js';

// ── PEOPLE PAGE ──────────────────────────────────────────────────
function HRPeoplePage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { people, loading } = usePeople();
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');

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
  const filtered = roster.filter(p =>
    (filter === 'all' /* role-based filters could be added later */) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || (p.team || '').toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Direct reports','تقارير مباشرة')}
        title={s('People','الأشخاص')}
        sub={s('Aggregate-only view · names visible only when consent + role allows','عرض مجمع فقط · الأسماء ظاهرة عند الموافقة')}
        right={<HRButton theme={T} variant="secondary" icon="content">{s('Export consented','تصدير المسموح')}</HRButton>}/>

      <Panel theme={T} density={density} pad={false}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, height: 36, background: T.panelSunk, borderRadius: 9, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
            <HRIcon name="search" size={15} stroke={T.textMuted}/>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={s('Search people or teams…','ابحث عن أشخاص أو فرق…')}
              style={{ flex: 1, background: 'transparent', border: 'none', color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}/>
          </div>
          <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}>
            {[['all',s('All','الكل')]].map(([k,l])=>(
              <button key={k} onClick={()=>setFilter(k)} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: filter===k ? T.panel : 'transparent',
                color: filter===k ? T.text : T.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>
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
                  {p.role}{p.role && p.team ? ' · ' : ''}{p.team}
                  {p.dept ? ` · ${p.dept}` : ''}
                </div>
              </div>
              <Badge theme={T} tone="neutral">{p.role || (lang==='ar'?'موظف':'Member')}</Badge>
              <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
              {s('No people match this search.','لا يوجد أشخاص مطابقون.')}
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}

export { HRPeoplePage };
