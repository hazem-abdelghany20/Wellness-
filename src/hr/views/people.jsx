import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge, Delta, AvatarMark } from '../components.jsx';
import { HR_DATA } from '../sections.jsx';
import { HRPageHeader } from './_header.jsx';

// ── PEOPLE PAGE ──────────────────────────────────────────────────
function HRPeoplePage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  // expand HR_DATA.people with extras
  const allPeople = [
    ...HR_DATA.people,
    { name: 'Yara Adel',     role: 'Sr. Engineer',   team: 'Engineering — Mobile',         index: 6.7, trend: 0.0,  last: 'Today', flag: false },
    { name: 'Hesham Lotfy',  role: 'Ops Coordinator',team: 'Logistics — Night shift',      index: 5.0, trend: -0.5, last: '1d ago', flag: true },
    { name: 'Maya Khalil',   role: 'CS Specialist',  team: 'Customer Ops — Tier 1',        index: 6.2, trend: 0.1,  last: 'Today', flag: false },
    { name: 'Adam Rahim',    role: 'AP Clerk',       team: 'Finance — Accounts Payable',   index: 4.5, trend: -0.7, last: '3d ago', flag: true },
    { name: 'Salma Bakir',   role: 'People Partner', team: 'People & Culture',             index: 7.6, trend: 0.3,  last: 'Today', flag: false },
    { name: 'Karim Othman',  role: 'Driver Lead',    team: 'Logistics — Day',              index: 6.5, trend: 0.0,  last: '1d ago', flag: false },
  ];
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const filtered = allPeople.filter(p =>
    (filter === 'all' || (filter === 'flagged' && p.flag) || (filter === 'risk' && p.index < 5.5)) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase()))
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
            {[['all',s('All','الكل')],['flagged',s('Flagged','مُعلَّم')],['risk',s('At risk','في خطر')]].map(([k,l])=>(
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
          {filtered.map((p, i) => {
            const tone = p.index >= 6.5 ? 'positive' : p.index >= 5 ? 'caution' : 'danger';
            const label = lang==='ar' ? (p.index>=6.5?S.low:p.index>=5?S.med:S.high) : (p.index>=6.5?'Stable':p.index>=5?'Watch':'At risk');
            return (
              <div key={i} style={{
                padding: `${DENSITY[density].cellPadY + 4}px 18px`,
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.divider}` : 'none',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <AvatarMark theme={T} name={p.name} size={40}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{p.name}</span>
                    {p.flag && <Badge theme={T} tone="danger" dot>{lang==='ar'?'تنبيه':'Flagged'}</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{p.role} · {p.team}</div>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, minWidth: 80 }}>{s('Last check-in','آخر فحص')}<br/><span style={{ color: T.textMid, fontWeight: 600, fontSize: 12 }}>{p.last}</span></div>
                <div style={{ textAlign: 'end', minWidth: 70 }}>
                  <div className="mono" style={{ fontSize: 16, color: T.text, fontWeight: 700 }}>{p.index}</div>
                  <Delta theme={T} value={p.trend}/>
                </div>
                <Badge theme={T} tone={tone} dot>{label}</Badge>
                <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

export { HRPeoplePage };
