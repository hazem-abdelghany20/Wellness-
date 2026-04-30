import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { HRButton } from '../../shared/components.jsx';
import { AuditLog } from '../sections.jsx';

function AdminAuditView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Audit & compliance','التدقيق والامتثال')}
        title={s('Audit log','سجل التدقيق')}
        sub={s('All admin actions, immutable · SOC 2 Type II · GDPR/HIPAA','جميع الإجراءات الإدارية، ثابتة')}
        right={<HRButton theme={T} variant="secondary" icon="download">{s('Export 90 days','تصدير ٩٠ يومًا')}</HRButton>}/>
      <AuditLog theme={T} density={density} lang={lang}/>
    </>
  );
}

export { AdminAuditView };
