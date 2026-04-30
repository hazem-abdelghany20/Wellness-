import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRButton, Panel, Toggle } from '../components.jsx';
import { HRPageHeader } from './_header.jsx';

// ── SETTINGS PAGE ────────────────────────────────────────────────
function HRSettingsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [quietHours, setQuietHours] = React.useState(true);
  const [aggregateOnly, setAggregateOnly] = React.useState(true);
  const [escalationMins, setEscalationMins] = React.useState(15);
  const [minCohort, setMinCohort] = React.useState(5);
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Workspace','مساحة العمل')}
        title={s('Settings','الإعدادات')}
        sub="Nile Group · workspace.nilegroup.com"/>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: DENSITY[density].gap }}>
        <Panel theme={T} density={density} pad={false}>
          {[
            { l: s('Privacy & data','الخصوصية والبيانات'), active: true },
            { l: s('Notifications','الإشعارات') },
            { l: s('Roles & permissions','الأدوار والأذونات') },
            { l: s('Integrations','التكاملات') },
            { l: s('Localization','الترجمة') },
            { l: s('Billing','الفوترة') },
            { l: s('Audit log','سجل التدقيق') },
          ].map((it, i) => (
            <div key={i} style={{
              padding: '12px 16px', borderBottom: `1px solid ${T.divider}`,
              fontSize: 13, fontWeight: it.active ? 700 : 500, cursor: 'pointer',
              color: it.active ? T.accent : T.textMid,
              borderInlineStart: it.active ? `3px solid ${T.accent}` : '3px solid transparent',
              background: it.active ? T.panelSunk : 'transparent',
            }}>{it.l}</div>
          ))}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: DENSITY[density].gap }}>
          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Aggregate-only enforcement','الإلزام بالتجميع فقط')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('No individual records visible to HR. Min cohort enforced for all reports.','لا يمكن للموارد البشرية رؤية السجلات الفردية. يتم فرض حد أدنى للعينة لكل التقارير.')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Toggle theme={T} value={aggregateOnly} onChange={setAggregateOnly}/>
              <span style={{ fontSize: 13, color: T.textMid }}>{aggregateOnly ? s('Enforced','مفعَّل') : s('Disabled','معطَّل')}</span>
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.divider}` }}>
              <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8 }}>{s('Minimum cohort size','الحد الأدنى للعينة')}</div>
              <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
                {[3, 5, 10, 20].map(n => (
                  <button key={n} onClick={()=>setMinCohort(n)} style={{
                    padding: '6px 14px', borderRadius: 7, border: 'none',
                    background: minCohort===n ? T.panel : 'transparent',
                    color: minCohort===n ? T.text : T.textMuted,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Quiet hours','ساعات الهدوء')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('Suppress broadcasts and nudges outside 08:00–20:00 local time.','منع البث والتنبيهات خارج ٠٨:٠٠–٢٠:٠٠ بالتوقيت المحلي.')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Toggle theme={T} value={quietHours} onChange={setQuietHours}/>
              <span style={{ fontSize: 13, color: T.textMid }}>{quietHours ? s('On · 08:00–20:00','مفعَّل · ٠٨:٠٠–٢٠:٠٠') : s('Off','معطَّل')}</span>
            </div>
          </Panel>

          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Safety escalation','تصعيد السلامة')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('Auto-page on-call counsellor when high-severity flag is unacknowledged.','إخطار المستشار المناوب تلقائيًا عند عدم استلام إشارة عالية الخطورة.')}</div>
            <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8 }}>{s('Escalate after','التصعيد بعد')}</div>
            <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
              {[5, 15, 30, 60].map(n => (
                <button key={n} onClick={()=>setEscalationMins(n)} style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none',
                  background: escalationMins===n ? T.panel : 'transparent',
                  color: escalationMins===n ? T.text : T.textMuted,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>{n} {s('min','د')}</button>
              ))}
            </div>
          </Panel>

          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Data retention','الاحتفاظ بالبيانات')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('Individual check-ins are kept for 90 days then aggregated. Aggregates retained 24 months.','تُحفظ الفحوصات الفردية ٩٠ يومًا ثم تُجمَّع. تُحفظ المجاميع ٢٤ شهرًا.')}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <HRButton theme={T} variant="secondary">{s('View policy','عرض السياسة')}</HRButton>
              <HRButton theme={T} variant="ghost">{s('Request export','طلب تصدير')}</HRButton>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

export { HRSettingsPage };
