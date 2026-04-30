import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../components.jsx';
import { HR_DATA } from '../sections.jsx';
import { HRPageHeader } from './_header.jsx';

// ── SAFETY PAGE ──────────────────────────────────────────────────
function HRSafetyPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const sevTone = { high: 'danger', med: 'caution', low: 'info' };
  const [tab, setTab] = React.useState('open');
  const items = HR_DATA.safety.filter(i => tab === 'all' || i.status === (tab === 'open' ? 'open' : 'review'));
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Safety queue','قائمة السلامة')}
        title={s('Escalations','التصعيدات')}
        sub={s('Anonymous self-reports + algorithmic flags · responses logged for compliance','تقارير ذاتية مجهولة + إشارات خوارزمية')}
        right={<HRButton theme={T} variant="secondary" icon="settings">{s('Routing rules','قواعد التوجيه')}</HRButton>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {[
          { l: s('Open','مفتوح'), v: HR_DATA.safety.filter(i=>i.status==='open').length, c: T.danger },
          { l: s('Under review','قيد المراجعة'), v: HR_DATA.safety.filter(i=>i.status==='review').length, c: T.caution },
          { l: s('Resolved this month','مُغلق هذا الشهر'), v: 12, c: T.positive },
          { l: s('Avg response time','متوسط الرد'), v: '2.4h', c: T.text },
        ].map((k,i)=>(
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{k.l}</div>
            <div className="display" style={{ fontSize: 30, color: k.c, letterSpacing: -0.6, lineHeight: 1 }}>{k.v}</div>
          </Panel>
        ))}
      </div>

      <Panel theme={T} density={density} pad={false}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', gap: 4 }}>
          {[['open',s('Open','مفتوح')],['review',s('Under review','قيد المراجعة')],['all',s('All','الكل')]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: tab===k ? T.panelSunk : 'transparent',
              color: tab===k ? T.text : T.textMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
        <div>
          {items.map((it, i) => (
            <div key={it.id} style={{
              padding: '16px 18px',
              borderBottom: i < items.length - 1 ? `1px solid ${T.divider}` : 'none',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: T.panelSunk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <HRIcon name="safety" size={18} stroke={it.severity === 'high' ? T.danger : T.caution}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{it.id}</span>
                  <Badge theme={T} tone={sevTone[it.severity]} dot>{it.severity === 'high' ? S.high : it.severity === 'med' ? S.med : S.low}</Badge>
                  <span style={{ fontSize: 11, color: T.textMuted }}>· {it.opened}</span>
                </div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 4 }}>{it.who}</div>
                <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5 }}>{it.note[lang] || it.note.en}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <HRButton theme={T} variant="secondary" size="sm">{s('Acknowledge','استلام')}</HRButton>
                <HRButton theme={T} variant="primary" size="sm">{s('Reach out','تواصل')}</HRButton>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export { HRSafetyPage };
