import React from 'react';
import { HRButton } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { ExerciseLibrary } from '../../shared/authoring/exercise-library.jsx';
import { hrExerciseApi } from '../lib/library-api.js';
import { fmtNum } from '../../shared/authoring/text.js';
import { BulkVideoPanel, bulkVideoApi } from './bulk-videos.jsx';

// HR → Exercises: the company's own exercises + the Wellness House library,
// and "Upload many videos" to give many exercises their demo at once.
function HRExercisesPage({ theme, lang, density, api = hrExerciseApi, bulkApi = bulkVideoApi }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [reload, setReload] = React.useState(0);
  // A new api object makes the library load again (after a bulk upload).
  const libApi = React.useMemo(() => ({ ...api }), [api, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ExerciseLibrary theme={T} lang={lang} density={density} api={libApi}
      header={({ count, add }) => (
        <>
          <HRPageHeader theme={T}
            eyebrow={s('Movement library', 'مكتبة الحركة')}
            title={s('Exercises', 'التمارين')}
            sub={s(`${count} of your own · each one with its demo video, used in your routines`,
                   `${fmtNum(count, 'ar')} من عندك · كل تمرين بفيديو الشرح بتاعه، وبتستخدمه في الروتين`)}
            right={<>
              {!bulkOpen && <HRButton theme={T} variant="secondary" icon="download" onClick={() => setBulkOpen(true)}>{s('Upload many videos', 'ارفع فيديوهات كتير')}</HRButton>}
              {add}
            </>}/>
          {bulkOpen && (
            <BulkVideoPanel theme={T} lang={lang} density={density} api={bulkApi}
              onDone={() => setReload((r) => r + 1)} onClose={() => setBulkOpen(false)}/>
          )}
        </>
      )}/>
  );
}

export { HRExercisesPage };
