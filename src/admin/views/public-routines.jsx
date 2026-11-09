import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { RoutineLibrary } from '../../shared/authoring/routine-library.jsx';
import { adminRoutineApi } from '../lib/public-library.js';
import { fmtNum } from '../../shared/authoring/text.js';

// Wellness House → Routine library: ready-made routines. Company HR taps
// "Use this" to get an editable copy, then assigns it.
function AdminPublicRoutinesView({ theme, density, lang, api = adminRoutineApi }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return (
    <div>
      <RoutineLibrary theme={T} lang={lang} density={density} api={api}
        header={({ count, add }) => (
          <div style={{ marginBottom: 18 }}>
            <AdminPageHeader theme={T}
              eyebrow={s('Starter library', 'المكتبة الجاهزة')}
              title={s('Routines', 'الروتين')}
              sub={s(`${count} public routines · HR copies one with “Use this”, changes it and assigns it`,
                     `${fmtNum(count, 'ar')} روتين عام · الـ HR بياخد نسخة بـ «استخدمه» ويعدّلها ويوزّعها`)}
              right={add}/>
          </div>
        )}/>
    </div>
  );
}

export { AdminPublicRoutinesView };
