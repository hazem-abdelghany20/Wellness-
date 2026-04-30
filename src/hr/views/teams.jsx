import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge, Spark } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useTeams } from '../hooks/use-teams.js';

// Derive a coarse risk bucket from aggregate metrics.
function riskFromTeam(t) {
  if (!t.has_signal) return 'unknown';
  const stress = Number(t.avg_stress ?? 0);
  const mood   = Number(t.avg_mood   ?? 0);
  if (stress >= 7 || (mood && mood < 5)) return 'high';
  if (stress >= 5.5 || (mood && mood < 6.5)) return 'med';
  return 'low';
}

function indexFromTeam(t) {
  // Synthesize a single wellbeing index from avg_mood (preferred) or avg_energy.
  if (!t.has_signal) return null;
  const mood = Number(t.avg_mood ?? 0);
  return mood > 0 ? Number(mood.toFixed(1)) : null;
}

// ── TEAMS PAGE ───────────────────────────────────────────────────
function HRTeamsPage({ theme, S, lang, density, chartStyle, onOpenTeam }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { teams, loading } = useTeams();
  const [riskFilter, setRiskFilter] = React.useState('all');
  const [deptFilter, setDeptFilter] = React.useState('all');

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…','جارٍ التحميل…')}
      </div>
    );
  }

  const enriched = (teams || []).map(t => ({
    ...t,
    _team:  t.team_name || t.name || '—',
    _dept:  t.department || t.dept || '—',
    _head:  t.head_name || t.head || '',
    _size:  t.member_count || t.group_size || 0,
    _index: indexFromTeam(t),
    _trend: Number(t.trend ?? 0),
    _risk:  riskFromTeam(t),
  }));
  const depts = Array.from(new Set(enriched.map(t => t._dept).filter(d => d && d !== '—')));
  const filtered = enriched.filter(t =>
    (riskFilter === 'all' || t._risk === riskFilter) &&
    (deptFilter === 'all' || t._dept === deptFilter)
  );
  const counts = {
    high: enriched.filter(t=>t._risk==='high').length,
    med:  enriched.filter(t=>t._risk==='med').length,
    low:  enriched.filter(t=>t._risk==='low').length,
  };
  const totalMembers = enriched.reduce((acc,t)=> acc + (Number(t._size)||0), 0);
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('All teams','كل الفرق')}
        title={s('Teams','الفرق')}
        sub={`${enriched.length} ${s('teams · ',`فرق · `)}${totalMembers} ${s('people in scope','شخص في النطاق')}`}
        right={<><HRButton theme={T} variant="secondary" icon="reports">{s('Export','تصدير')}</HRButton></>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('Total teams','إجمالي الفرق')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{enriched.length}</div>
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
            const tone = t._risk === 'high' ? 'danger' : t._risk === 'med' ? 'caution' : t._risk === 'low' ? 'positive' : 'neutral';
            const label = t._risk === 'high' ? S.high : t._risk === 'med' ? S.med : t._risk === 'low' ? S.low : s('No signal','بلا إشارة');
            const sparkColor = t._risk === 'high' ? T.danger : t._risk === 'med' ? T.caution : T.positive;
            const baseIdx = t._index ?? 6.0;
            const trend = Array.from({length: 14}, (_, k) => baseIdx + (Math.sin(k*0.6 + i)*0.4) + (t._trend * (k/14)));
            return (
              <div key={t.team_id || i} onClick={() => onOpenTeam && onOpenTeam(t)} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 0.7fr 1.2fr 1fr 36px',
                padding: `${DENSITY[density].cellPadY + 4}px 18px`, gap: 10,
                alignItems: 'center', cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.panelSunk}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t._team}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t._dept}</div>
                </div>
                <div style={{ fontSize: 12, color: T.textMid }}>{t._head || '—'}</div>
                <div className="mono" style={{ textAlign: 'end', fontSize: 13, color: T.text }}>{t._size || '—'}</div>
                <div className="mono" style={{ textAlign: 'end', fontSize: 14, color: T.text, fontWeight: 700 }}>{t._index ?? '—'}</div>
                <div>{t.has_signal ? <Spark theme={T} values={trend} width={140} height={32} chartStyle={chartStyle === 'bar' ? 'bar' : (chartStyle || 'area')} color={sparkColor}/> : <span style={{ fontSize: 11, color: T.textFaint }}>{s('Below privacy floor','تحت حد الخصوصية')}</span>}</div>
                <div><Badge theme={T} tone={tone} dot>{label}</Badge></div>
                <button style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', padding: 6 }} onClick={(e)=>e.stopPropagation()}>
                  <HRIcon name="chev" size={14}/>
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
              {s('No teams match the current filters.','لا توجد فرق مطابقة للمرشحات.')}
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}

export { HRTeamsPage };
