import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel } from '../../shared/components.jsx';
import { IntegrationsStatus } from '../sections.jsx';

function AdminIntegrationsView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Integrations','التكاملات')}
        title={s('System health','صحة الأنظمة')}
        sub={s('7 of 8 healthy · 1 incident · last sweep 30s ago','٧ من ٨ سليم · ١ حادثة · آخر فحص قبل ٣٠ث')}
        right={<HRButton theme={T} icon="plus">{s('Add integration','أضف تكاملًا')}</HRButton>}/>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: DENSITY[density].gap }}>
        {[
          { label: s('Operational','يعمل'), val: '7', tone: '#6FC79B' },
          { label: s('Degraded','مُقلَّص'), val: '1', tone: '#F5B544' },
          { label: s('Down','معطّل'),    val: '1', tone: '#E08A6B' },
          { label: s('Total syncs / day','مزامنات / يوم'), val: '184', tone: T.text },
        ].map((k, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div className="display" style={{ fontSize: 32, color: k.tone, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>{k.val}</div>
          </Panel>
        ))}
      </div>

      <IntegrationsStatus theme={T} density={density} lang={lang}/>
    </>
  );
}

export { AdminIntegrationsView };
