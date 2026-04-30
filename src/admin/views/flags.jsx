import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { HRButton } from '../../shared/components.jsx';
import { FeatureFlags } from '../sections.jsx';

function AdminFlagsView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Feature flags','الخصائص التجريبية')}
        title={s('Rollout control','إدارة الإطلاق')}
        sub={s('6 active flags · 2 in rollout · staging mirrors prod','٦ خصائص نشطة · ٢ في الإطلاق التدريجي')}
        right={<HRButton theme={T} icon="plus">{s('New flag','خاصية جديدة')}</HRButton>}/>
      <FeatureFlags theme={T} density={density} lang={lang}/>
    </>
  );
}

export { AdminFlagsView };
