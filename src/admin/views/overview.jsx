import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton } from '../../shared/components.jsx';
import {
  AdminKpiStrip, DauMauChart, AdminTeam, TenantsTable,
  ContentHealth, IntegrationsStatus, AuditLog, FeatureFlags,
} from '../sections.jsx';

function AdminOverview({ theme, density, chartStyle, layout, lang, onOpenTenant }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Platform overview','نظرة عامة على المنصة')}
        title={s('All tenants · Live','كل العملاء · مباشر')}
        sub={s('47 tenants · 28,412 active seats · last refresh 14:42 UTC','٤٧ عميل · ٢٨٬٤١٢ مقعد نشط · آخر تحديث ١٤:٤٢ UTC')}
        right={<>
          <HRButton theme={T} variant="secondary" icon="calendar">Apr 2026</HRButton>
          <HRButton theme={T} variant="secondary" icon="filter"/>
        </>}/>

      <AdminKpiStrip theme={T} density={density} chartStyle={chartStyle} lang={lang}/>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: DENSITY[density].gap }}>
        <DauMauChart theme={T} density={density} chartStyle={chartStyle} lang={lang}/>
        <AdminTeam theme={T} density={density} lang={lang}/>
      </div>

      <TenantsTable theme={T} density={density} lang={lang} onOpen={onOpenTenant}/>

      <div style={{ display: 'grid', gridTemplateColumns: layout === 'split' ? '1fr 1fr' : '1.3fr 1fr', gap: DENSITY[density].gap }}>
        <ContentHealth theme={T} density={density} lang={lang}/>
        <IntegrationsStatus theme={T} density={density} lang={lang}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: DENSITY[density].gap }}>
        <AuditLog theme={T} density={density} lang={lang}/>
        <FeatureFlags theme={T} density={density} lang={lang}/>
      </div>
    </>
  );
}

export { AdminOverview };
