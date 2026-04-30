import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge, Spark } from '../components.jsx';
import { HR_DATA } from '../sections.jsx';
import { HRPageHeader } from './_header.jsx';

// ── TEAMS PAGE ───────────────────────────────────────────────────
function HRTeamsPage({ theme, S, lang, density, chartStyle, onOpenTeam }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [riskFilter, setRiskFilter] = React.useState('all');
  const [deptFilter, setDeptFilter] = React.useState('all');
  const depts = Array.from(new Set(HR_DATA.teams.map(t => t.dept)));
  const filtered = HR_DATA.teams.filter(t =>
    (riskFilter === 'all' || t.risk === riskFilter) &&
    (deptFilter === 'all' || t.dept === deptFilter)
  );
  const counts = {
    high: HR_DATA.teams.filter(t=>t.risk==='high').length,
    med:  HR_DATA.teams.filter(t=>t.risk==='med').length,
    low:  HR_DATA.teams.filter(t=>t.risk==='low').length,
  };
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('All teams','كل الفرق')}
        title={s('Teams','الفرق')}
        sub={`${HR_DATA.teams.length} ${s('teams · ',`فرق · `)}${HR_DATA.teams.reduce((s,t)=>s+t.size,0)} ${s('people in scope','شخص في النطاق')}`}
        right={<><HRButton theme={T} variant="secondary" icon="reports">{s('Export','تصدير')}</HRButton></>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('Total teams','إجمالي الفرق')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{HR_DATA.teams.length}</div>
        </Panel>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.danger, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('High risk','مخاطر مرتفعة')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{counts.high}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{s('Need intervention','تحتاج تدخل')}</div>
        </Panel>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.caution, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('Watchlist','قائمة المراقبة')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{counts.med}</div>
        </Panel>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.positive, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('Stable','مستقر')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{counts.low}</div>
        </Panel>
      </div>

      <Panel theme={T} density={density} pad={false}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Filter','تصفية')}</div>
          <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}>
            {[['all',s('All','الكل')],['high',s('High','مرتفع')],['med',s('Med','متوسط')],['low',s('Low','منخفض')]].map(([k,l])=>(
              <button key={k} onClick={() => setRiskFilter(k)} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: riskFilter===k ? T.panel : 'transparent',
                color: riskFilter===k ? T.text : T.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
          <select value={deptFilter} onChange={(e)=>setDeptFilter(e.target.value)} style={{
            padding: '7px 10px', background: T.panelSunk, border: `1px solid ${T.border}`,
            borderRadius: 8, color: T.text, fontSize: 12, fontFamily: 'inherit',
          }}>
            <option value="all">{s('All depts','كل الأقسام')}</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 11, color: T.textMuted }}>{filtered.length} {s('shown','معروض')}</div>
        </div>
        <div>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 0.7fr 1.2fr 1fr 36px',
            padding: `12px 18px`, gap: 10,
            fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
            borderBottom: `1px solid ${T.divider}`, background: T.panelSunk,
          }}>
            <div>{S.team}</div><div>{S.head}</div>
            <div style={{ textAlign:'end' }}>{S.size}</div>
            <div style={{ textAlign:'end' }}>{S.index}</div>
            <div>{s('30-day trend','اتجاه ٣٠ يوم')}</div>
            <div>{S.risk}</div><div></div>
          </div>
          {filtered.map((t, i) => {
            const tone = t.risk === 'high' ? 'danger' : t.risk === 'med' ? 'caution' : 'positive';
            const label = t.risk === 'high' ? S.high : t.risk === 'med' ? S.med : S.low;
            const sparkColor = t.risk === 'high' ? T.danger : t.risk === 'med' ? T.caution : T.positive;
            // synth a 14pt trend from index value
            const trend = Array.from({length: 14}, (_, k) => t.index + (Math.sin(k*0.6 + i)*0.4) + (t.trend * (k/14)));
            return (
              <div key={i} onClick={() => onOpenTeam && onOpenTeam(t)} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 0.7fr 1.2fr 1fr 36px',
                padding: `${DENSITY[density].cellPadY + 4}px 18px`, gap: 10,
                alignItems: 'center', cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.panelSunk}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.team}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t.dept}</div>
                </div>
                <div style={{ fontSize: 12, color: T.textMid }}>{t.head}</div>
                <div className="mono" style={{ textAlign: 'end', fontSize: 13, color: T.text }}>{t.size}</div>
                <div className="mono" style={{ textAlign: 'end', fontSize: 14, color: T.text, fontWeight: 700 }}>{t.index}</div>
                <div><Spark theme={T} values={trend} width={140} height={32} chartStyle={chartStyle === 'bar' ? 'bar' : (chartStyle || 'area')} color={sparkColor}/></div>
                <div><Badge theme={T} tone={tone} dot>{label}</Badge></div>
                <button style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', padding: 6 }} onClick={(e)=>e.stopPropagation()}>
                  <HRIcon name="chev" size={14}/>
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

export { HRTeamsPage };
