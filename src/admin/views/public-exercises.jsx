import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { ExerciseLibrary } from '../../shared/authoring/exercise-library.jsx';
import { adminExerciseApi } from '../lib/public-library.js';
import { fmtNum } from '../../shared/authoring/text.js';

// Wellness House → Exercise library: public exercises every company can put
// in its routines (or copy with "Use this").
function AdminPublicExercisesView({ theme, density, lang, api = adminExerciseApi }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return (
    <div>
      <ExerciseLibrary theme={T} lang={lang} density={density} api={api}
        header={({ count, add }) => (
          <div style={{ marginBottom: 18 }}>
            <AdminPageHeader theme={T}
              eyebrow={s('Starter library', 'المكتبة الجاهزة')}
              title={s('Exercises', 'التمارين')}
              sub={s(`${count} public exercises · every company can use them in its routines`,
                     `${fmtNum(count, 'ar')} تمرين عام · كل الشركات تقدر تستخدمها في الروتين`)}
              right={add}/>
          </div>
        )}/>
    </div>
  );
}

export { AdminPublicExercisesView };
