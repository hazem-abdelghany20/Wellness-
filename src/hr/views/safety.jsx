import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useSafety } from '../hooks/use-safety.js';

// ── SAFETY PAGE ──────────────────────────────────────────────────
function HRSafetyPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { highRisk, teams, loading } = useSafety();
  const [tab, setTab] = React.useState('open');

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…','جارٍ التحميل…')}
      </div>
    );
  }

  const flaggedCount = (highRisk || []).length;
  const watchCount = (teams || []).filter(t => t.has_signal && Number(t.avg_stress ?? 0) >= 5.5 && Number(t.avg_stress ?? 0) < 7).length;
  // Show high-risk teams in the "open" tab; the rest under "review" / "all".
  const visible = tab === 'open'
    ? (highRisk || [])
    : tab === 'review'
      ? (teams || []).filter(t => t.has_signal && Number(t.avg_stress ?? 0) >= 5.5 && Number(t.avg_stress ?? 0) < 7)
      : (teams || []);

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Safety queue','قائمة السلامة')}
        title={s('Escalations','التصعيدات')}
        sub={s('Anonymous self-reports + algorithmic flags · responses logged for compliance','تقارير ذاتية مجهولة + إشارات خوارزمية')}
        right={<HRButton theme={T} variant="secondary" icon="settings">{s('Routing rules','قواعد التوجيه')}</HRButton>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {[
          { l: s('High risk','مخاطر مرتفعة'), v: flaggedCount, c: T.danger },
          { l: s('Watchlist','قائمة المراقبة'), v: watchCount, c: T.caution },
          { l: s('Below privacy floor','تحت حد الخصوصية'), v: (teams||[]).filter(t => !t.has_signal).length, c: T.textMuted },
          { l: s('Total teams scanned','إجمالي الفرق'), v: (teams||[]).length, c: T.text },
        ].map((k,i)=>(
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{k.l}</div>
            <div className="display" style={{ fontSize: 30, color: k.c, letterSpacing: -0.6, lineHeight: 1 }}>{k.v}</div>
          </Panel>
        ))}
      </div>

      <Panel theme={T} density={density} pad={false}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', gap: 4 }}>
          {[['open',s('High risk','مرتفع')],['review',s('Watchlist','مراقبة')],['all',s('All','الكل')]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: tab===k ? T.panelSunk : 'transparent',
              color: tab===k ? T.text : T.textMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
        <div>
          {visible.map((it, i) => {
            const teamName = it.team_name || it.name || '—';
            const sev = !it.has_signal ? null : Number(it.avg_stress ?? 0) >= 7 ? 'high' : Number(it.avg_stress ?? 0) >= 5.5 ? 'med' : 'low';
            const sevTone = sev === 'high' ? 'danger' : sev === 'med' ? 'caution' : 'info';
            return (
              <div key={it.team_id || i} style={{
                padding: '16px 18px',
                borderBottom: i < visible.length - 1 ? `1px solid ${T.divider}` : 'none',
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: T.panelSunk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <HRIcon name="safety" size={18} stroke={sev === 'high' ? T.danger : sev === 'med' ? T.caution : T.textMuted}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{teamName}</span>
                    {sev && <Badge theme={T} tone={sevTone} dot>{sev === 'high' ? S.high : sev === 'med' ? S.med : S.low}</Badge>}
                    {!it.has_signal && <Badge theme={T} tone="neutral">{s('Below privacy floor','تحت حد الخصوصية')}</Badge>}
                  </div>
                  {!it.has_signal ? (
                    <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
                      {s('This team has fewer than 5 active members — metrics are suppressed for privacy.','عدد أعضاء هذا الفريق أقل من ٥ — البيانات محجوبة لحماية الخصوصية.')}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5 }}>
                      {s(`Avg stress ${Number(it.avg_stress ?? 0).toFixed(1)} · mood ${Number(it.avg_mood ?? 0).toFixed(1)} · sleep ${Number(it.avg_sleep ?? 0).toFixed(1)}`,
                         `متوسط التوتر ${Number(it.avg_stress ?? 0).toFixed(1)} · المزاج ${Number(it.avg_mood ?? 0).toFixed(1)} · النوم ${Number(it.avg_sleep ?? 0).toFixed(1)}`)}
                    </div>
                  )}
                </div>
                {it.has_signal && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <HRButton theme={T} variant="secondary" size="sm">{s('Acknowledge','استلام')}</HRButton>
                    <HRButton theme={T} variant="primary" size="sm">{s('Reach out','تواصل')}</HRButton>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
              {s('No teams in this bucket.','لا توجد فرق في هذه الفئة.')}
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}

export { HRSafetyPage };
