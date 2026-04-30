import React, { useState } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useReports } from '../hooks/use-reports.js';

// ── REPORTS PAGE ─────────────────────────────────────────────────
function HRReportsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { exportReport, busy, error, lastUrl } = useReports();
  const [kind, setKind]   = useState('overview');
  const [range, setRange] = useState('30d');

  const handleExport = async () => {
    try {
      const r = await exportReport(kind, range);
      if (r?.url) window.open(r.url, '_blank');
    } catch {
      // error state already on hook
    }
  };

  const reports = [
    { kind: 'overview', title: s('Wellbeing overview','نظرة عامة على الرفاهية'),
      desc: s('Aggregate index, KPIs, weekly trend','مؤشر مجمّع، KPIs، الاتجاه الأسبوعي'),
      ext: 'PDF' },
    { kind: 'teams', title: s('Teams breakdown','تفصيل الفرق'),
      desc: s('Per-team aggregates with privacy floor enforced','تفاصيل لكل فريق مع تطبيق حد الخصوصية'),
      ext: 'CSV' },
  ];

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Insights & exports','رؤى وتصدير')}
        title={s('Reports','التقارير')}
        sub={s('All reports use aggregate-only data. Min cohort = 5 people.','كل التقارير تستخدم بيانات مجمعة فقط. الحد الأدنى للعينة = ٥ أشخاص.')}/>

      <Panel theme={T} density={density} style={{ marginBottom: DENSITY[density].gap }}>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>
          {s('Generate export','إنشاء تصدير')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Report','التقرير')}</div>
            <select value={kind} onChange={(e)=>setKind(e.target.value)} style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}>
              <option value="overview">{s('Wellbeing overview','نظرة عامة')}</option>
              <option value="teams">{s('Teams breakdown','تفصيل الفرق')}</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Range','المدى')}</div>
            <select value={range} onChange={(e)=>setRange(e.target.value)} style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </div>
          <HRButton theme={T} variant="primary" icon="reports" disabled={busy} onClick={handleExport}>
            {busy ? s('Generating…','جارٍ الإنشاء…') : s('Generate','إنشاء')}
          </HRButton>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, minHeight: 18 }}>
          {error && (
            <span style={{ fontSize: 12, color: T.danger }}>
              {s('Failed to generate report.','تعذّر إنشاء التقرير.')} {error.message ? `(${error.message})` : ''}
            </span>
          )}
          {lastUrl && !error && (
            <a href={lastUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.accent, textDecoration: 'underline' }}>
              {s('Open last export','فتح آخر تصدير')}
            </a>
          )}
        </div>
      </Panel>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Standard reports','التقارير القياسية')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: DENSITY[density].gap }}>
        {reports.map((r, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: T.panelSunk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <HRIcon name="reports" size={20} stroke={T.accent}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{r.title}</span>
                  <Badge theme={T} tone="neutral">{r.ext}</Badge>
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.5 }}>{r.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}/>
                  <HRButton theme={T} variant="secondary" size="sm" icon="reports"
                    onClick={async () => { setKind(r.kind); try { const x = await exportReport(r.kind, range); if (x?.url) window.open(x.url, '_blank'); } catch {} }}
                    disabled={busy}>
                    {busy ? s('Generating…','جارٍ الإنشاء…') : s('Generate','إنشاء')}
                  </HRButton>
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

export { HRReportsPage };
