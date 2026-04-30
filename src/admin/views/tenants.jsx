import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { HRButton } from '../../shared/components.jsx';
import { TenantsTable } from '../sections.jsx';

function AdminTenantsView({ theme, density, lang, onOpen }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Customers','العملاء')}
        title={s('All tenants','كل العملاء')}
        sub={s('47 active · 3 onboarding · 1 paused','٤٧ نشط · ٣ في الإعداد · ١ متوقف')}
        right={<>
          <HRButton theme={T} variant="secondary" icon="download">{s('Export','تصدير')}</HRButton>
          <HRButton theme={T} icon="plus">{s('Invite tenant','دعوة عميل')}</HRButton>
        </>}/>
      <TenantsTable theme={T} density={density} lang={lang} onOpen={onOpen}/>
    </>
  );
}

export { AdminTenantsView };
