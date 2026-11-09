import React from 'react';
import { HRPageHeader } from './_header.jsx';
import { ExerciseLibrary } from '../../shared/authoring/exercise-library.jsx';
import { hrExerciseApi } from '../lib/library-api.js';
import { fmtNum } from '../../shared/authoring/text.js';

// HR → Exercises: the company's own exercises + the Wellness House library.
function HRExercisesPage({ theme, lang, density, api = hrExerciseApi }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return (
    <ExerciseLibrary theme={T} lang={lang} density={density} api={api}
      header={({ count, add }) => (
        <HRPageHeader theme={T}
          eyebrow={s('Movement library', 'مكتبة الحركة')}
          title={s('Exercises', 'التمارين')}
          sub={s(`${count} of your own · each one with its demo video, used in your routines`,
                 `${fmtNum(count, 'ar')} من عندك · كل تمرين بفيديو الشرح بتاعه، وبتستخدمه في الروتين`)}
          right={add}/>
      )}/>
  );
}

export { HRExercisesPage };
