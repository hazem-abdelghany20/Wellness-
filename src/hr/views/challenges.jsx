import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../components.jsx';
import { HRPageHeader } from './_header.jsx';

// ── CHALLENGES PAGE ──────────────────────────────────────────────
function HRChallengesPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const active = [
    { title: s('Move April','تحرَّك أبريل'),         desc: s('150k steps · team total','١٥٠ ألف خطوة · إجمالي الفريق'), joined: 412, total: 487, end: s('8 days left','٨ أيام'), kind: s('movement','حركة'), progress: 64 },
    { title: s('Lights out by 11','النوم قبل الـ١١'), desc: s('21-day individual streak','تتابع فردي ٢١ يوم'),         joined: 287, total: 487, end: s('14 days left','١٤ يوم'), kind: s('sleep','نوم'),    progress: 38 },
    { title: s('3-min reset daily','استراحة ٣ دقائق يوميًا'), desc: s('30-day team check-in','فحص فريق ٣٠ يوم'),         joined: 198, total: 487, end: s('20 days left','٢٠ يوم'), kind: s('mood','مزاج'),     progress: 22 },
  ];
  const drafts = [
    { title: s('Hydration: 8 cups','الترطيب: ٨ أكواب'), kind: s('movement','حركة'), updated: s('2h ago','قبل ساعتين') },
    { title: s('Walking 1:1s','مشي ١:١'),               kind: s('movement','حركة'), updated: s('Yesterday','أمس') },
  ];
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Active + drafts','نشطة + مسودات')}
        title={s('Challenges','التحديات')}
        sub={s('Behavior change campaigns · pull from template library or build your own','حملات تغيير السلوك')}
        right={<><HRButton theme={T} variant="secondary" icon="challenges">{s('From template','من قالب')}</HRButton><HRButton theme={T} variant="primary" icon="plus">{S.newChallenge}</HRButton></>}/>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Active','نشطة')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {active.map((c, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <Badge theme={T} tone="neutral">{c.kind}</Badge>
              <span style={{ fontSize: 11, color: T.textMuted }}>{c.end}</span>
            </div>
            <div style={{ fontSize: 17, color: T.text, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 18 }}>{c.desc}</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
                <span>{s('Progress','التقدم')}</span>
                <span className="mono" style={{ color: T.text, fontWeight: 600 }}>{c.progress}%</span>
              </div>
              <div style={{ height: 6, background: T.panelSunk, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${c.progress}%`, height: '100%', background: T.accent, borderRadius: 3 }}/>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{s('Participation','المشاركة')}</div>
                <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{c.joined}/{c.total}</div>
              </div>
              <HRButton theme={T} variant="ghost" size="sm">{s('Manage','إدارة')}</HRButton>
            </div>
          </Panel>
        ))}
      </div>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Drafts','مسودات')}</div>
      <Panel theme={T} density={density} pad={false}>
        {drafts.map((d, i) => (
          <div key={i} style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: i < drafts.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: T.panelSunk, display: 'grid', placeItems: 'center' }}>
              <HRIcon name="challenges" size={18} stroke={T.textMuted}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{d.kind} · {s('Updated','تحديث')} {d.updated}</div>
            </div>
            <HRButton theme={T} variant="secondary" size="sm">{s('Resume','استئناف')}</HRButton>
          </div>
        ))}
      </Panel>
    </>
  );
}

export { HRChallengesPage };
