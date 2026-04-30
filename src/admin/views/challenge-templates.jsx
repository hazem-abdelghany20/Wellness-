import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, Badge } from '../../shared/components.jsx';

function AdminChallengeTemplatesView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const templates = [
    { name: s('10k Steps × 2 weeks','١٠ آلاف خطوة × أسبوعين'), kind:'movement', uses: 142, success: '78%', emoji:'👟' },
    { name: s('No-screens after 22:00','لا شاشات بعد ٢٢:٠٠'),     kind:'sleep',    uses:  98, success: '52%', emoji:'🌙' },
    { name: s('5 check-ins / week','٥ فحوصات أسبوعيًا'),         kind:'mood',     uses: 220, success: '84%', emoji:'✓' },
    { name: s('Hydration: 8 cups','الترطيب: ٨ أكواب'),           kind:'movement', uses:  76, success: '61%', emoji:'💧' },
    { name: s('5-min stretch break','استراحة تمدد ٥ دقائق'),     kind:'movement', uses: 188, success: '69%', emoji:'🧘'},
    { name: s('Gratitude × 21 days','الامتنان × ٢١ يومًا'),      kind:'mood',     uses:  64, success: '74%', emoji:'☀️' },
  ];
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Challenge templates','قوالب التحديات')}
        title={s('Library','المكتبة')}
        sub={s('Tenants pick from these · 24 templates total · localized to 3+ languages','يختار العملاء من هذه القوالب')}
        right={<HRButton theme={T} icon="plus">{s('New template','قالب جديد')}</HRButton>}/>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: DENSITY[density].gap }}>
        {templates.map((t,i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 12 }}>
              <div style={{ width:42, height: 42, borderRadius:10, background:T.panelSunk, display:'grid', placeItems:'center', fontSize: 22 }}>{t.emoji}</div>
              <Badge theme={T} tone="neutral">{t.kind}</Badge>
            </div>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{t.name}</div>
            <div style={{ display: 'flex', justifyContent:'space-between', alignItems:'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{s('Used by','مستخدم من')}</div>
                <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.uses} {s('tenants','عملاء')}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700, textAlign:'end' }}>{s('Completion','إكمال')}</div>
                <div className="mono" style={{ fontSize: 13, color: T.accent, fontWeight: 600, textAlign:'end' }}>{t.success}</div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

export { AdminChallengeTemplatesView };
