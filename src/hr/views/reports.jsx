import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../components.jsx';
import { HRPageHeader } from './_header.jsx';

// ── REPORTS PAGE ─────────────────────────────────────────────────
function HRReportsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const reports = [
    { title: s('Monthly wellbeing summary','ملخص الرفاهية الشهري'), desc: s('Aggregate index, deltas, top movers · 4 pages','مؤشر مجمع، تغييرات، أبرز التحركات · ٤ صفحات'), kind: 'PDF', cadence: s('Monthly · 1st','شهري · ١') },
    { title: s('Safety incident log','سجل حوادث السلامة'),         desc: s('Anonymized escalation timeline · CSV export','جدول التصعيدات مجهول · تصدير CSV'),         kind: 'CSV', cadence: s('Weekly','أسبوعي') },
    { title: s('Engagement by department','المشاركة حسب القسم'),    desc: s('DAU/WAU per dept · trend lines','نشاط يومي/أسبوعي حسب القسم · خطوط اتجاه'),                  kind: 'XLSX', cadence: s('Quarterly','فصلي') },
    { title: s('Challenge outcomes','نتائج التحديات'),              desc: s('Completion %, behavior change deltas','نسبة الإكمال، تغييرات السلوك'),                            kind: 'PDF', cadence: s('Per challenge','لكل تحدي') },
  ];
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Insights & exports','رؤى وتصدير')}
        title={s('Reports','التقارير')}
        sub={s('All reports use aggregate-only data. Min cohort = 5 people.','كل التقارير تستخدم بيانات مجمعة فقط. الحد الأدنى للعينة = ٥ أشخاص.')}
        right={<HRButton theme={T} variant="primary" icon="plus">{s('New custom report','تقرير مخصص')}</HRButton>}/>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Standard reports','التقارير القياسية')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {reports.map((r, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: T.panelSunk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <HRIcon name="reports" size={20} stroke={T.accent}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{r.title}</span>
                  <Badge theme={T} tone="neutral">{r.kind}</Badge>
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.5 }}>{r.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: T.textFaint }}>{s('Schedule:','جدولة:')}</span>
                  <span style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>{r.cadence}</span>
                  <div style={{ flex: 1 }}/>
                  <HRButton theme={T} variant="ghost" size="sm" icon="settings">{s('Configure','إعداد')}</HRButton>
                  <HRButton theme={T} variant="secondary" size="sm" icon="reports">{s('Generate','إنشاء')}</HRButton>
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Recent exports','تصديرات حديثة')}</div>
      <Panel theme={T} density={density} pad={false}>
        {[
          { name: s('Wellbeing summary · Mar 2026.pdf','ملخص الرفاهية · مارس ٢٠٢٦.pdf'), size: '342 KB', when: 'Apr 01' },
          { name: s('Safety log · week 17.csv','سجل السلامة · أسبوع ١٧.csv'),               size: '12 KB',  when: 'Apr 22' },
          { name: s('Engagement Q1.xlsx','المشاركة ر١.xlsx'),                                size: '88 KB',  when: 'Apr 04' },
        ].map((f, i) => (
          <div key={i} style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: i < 2 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: T.panelSunk, display: 'grid', placeItems: 'center' }}>
              <HRIcon name="content" size={16} stroke={T.textMuted}/>
            </div>
            <div style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 600 }}>{f.name}</div>
            <div className="mono" style={{ fontSize: 11, color: T.textMuted }}>{f.size}</div>
            <div style={{ fontSize: 12, color: T.textMid }}>{f.when}</div>
            <HRButton theme={T} variant="ghost" size="sm">{s('Download','تحميل')}</HRButton>
          </div>
        ))}
      </Panel>
    </>
  );
}

export { HRReportsPage };
