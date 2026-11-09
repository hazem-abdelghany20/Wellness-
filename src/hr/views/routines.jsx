import React from 'react';
import { HRButton } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { RoutineLibrary } from '../../shared/authoring/routine-library.jsx';
import { Flash } from '../../shared/authoring/ui.jsx';
import { AssignPanel, AssignmentsPanel } from './routine-assign.jsx';
import { RoutineImportPanel } from './routine-import.jsx';
import { hrRoutineApi } from '../lib/library-api.js';
import { libraryError } from '../../shared/authoring/errors.js';
import { localTodayIso, weekdayOf, fmtNum } from '../../shared/authoring/text.js';
import {
  listRoutineAssignments, assignRoutine, endRoutineAssignment, getMyCompanySettings,
} from '../../lib/supabase-routines';
import { listCompanyTeams } from '../../lib/supabase-hr';

// HR → Routines: build the coach's timed table, assign it, import it from a
// sheet, or start from a Wellness House routine.
function HRRoutinesPage({ theme, lang, density, api = hrRoutineApi }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [assignments, setAssignments] = React.useState([]);
  const [teams, setTeams] = React.useState([]);
  const [today, setToday] = React.useState(localTodayIso());
  const [assigning, setAssigning] = React.useState(null);
  const [importing, setImporting] = React.useState(false);
  const [openRequest, setOpenRequest] = React.useState(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [flash, setFlash] = React.useState(null);
  const topRef = React.useRef(null);

  const loadAssignments = React.useCallback(async () => {
    try { setAssignments(await listRoutineAssignments()); } catch (e) { setFlash({ kind: 'err', text: libraryError(e, lang) }); }
  }, [lang]);

  React.useEffect(() => {
    loadAssignments();
    listCompanyTeams().then(setTeams).catch(() => setTeams([]));
    getMyCompanySettings().then((c) => { if (c?.today) setToday(String(c.today).slice(0, 10)); }).catch(() => {});
  }, [loadAssignments]);

  const scrollTop = () => requestAnimationFrame(() => topRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));

  async function handleAssign(opts) {
    await assignRoutine(opts);
    setAssigning(null);
    setFlash({ kind: 'ok', text: opts.startsOn <= today
      ? s('Assigned. People see it on their Today tab now.', 'اتوزّع. الناس هيشوفوه في «النهارده» دلوقتي.')
      : s('Assigned. People see it from the start date.', 'اتوزّع. الناس هيشوفوه من تاريخ البداية.') });
    setReloadKey((k) => k + 1);
    await loadAssignments();
  }

  async function handleEnd(a) {
    await endRoutineAssignment(a.id);
    setFlash({ kind: 'ok', text: a.status === 'upcoming' ? s('Cancelled.', 'اتلغى.') : s('Ended. It stops after today.', 'اتوقف. هيقف بعد النهارده.') });
    setReloadKey((k) => k + 1);
    await loadAssignments();
  }

  // The import panel stays open on its "add the videos" step.
  function onImported(summary) {
    setFlash({ kind: 'ok', text: s(
      `Imported ${summary.items} rows${summary.exercises_created ? ` and ${summary.exercises_created} new exercises` : ''}. Check the routine below${summary.assignment_id ? '' : ', then assign it'}.`,
      `اتضاف ${fmtNum(summary.items, 'ar')} صف${summary.exercises_created ? ` و${fmtNum(summary.exercises_created, 'ar')} تمرين جديد` : ''}. راجع الروتين تحت${summary.assignment_id ? '' : '، وبعدين وزّعه'}.`) });
    setReloadKey((k) => k + 1);
    loadAssignments();
    if (summary.routine_id) setOpenRequest({ id: summary.routine_id, key: Date.now() });
  }

  return (
    <div ref={topRef}>
      <RoutineLibrary theme={T} lang={lang} density={density} api={api} reloadKey={reloadKey} openRequest={openRequest}
        todayWeekday={weekdayOf(today)}
        onAssign={(r) => { setImporting(false); setAssigning(r); setFlash(null); scrollTop(); }}
        onSaved={(detail, { isNew }) => {
          // Offer "Who gets it?" for a new routine, or a saved copy nobody has yet.
          const live = (detail?.assignments || []).some((a) => a.active && (!a.ends_on || a.ends_on >= today));
          if (detail?.routine && (isNew || !live)) { setAssigning(detail.routine); scrollTop(); }
        }}
        header={({ count, add }) => (
          <>
            <HRPageHeader theme={T}
              eyebrow={s('Daily routine', 'الروتين اليومي')}
              title={s('Routines', 'الروتين')}
              sub={s(`${count} of your own · a timed list of exercises for the workday; employees tick each one`,
                     `${fmtNum(count, 'ar')} من عندك · قايمة تمارين بالوقت ليوم الشغل؛ الموظف بيعلّم على كل واحد`)}
              right={<>
                <HRButton theme={T} variant="secondary" icon="download" onClick={() => { setAssigning(null); setImporting((v) => !v); }}>
                  {s('Import from sheet', 'استورد من شيت')}
                </HRButton>
                {add}
              </>}/>
            <Flash theme={T} flash={flash}/>
            {assigning && (
              <AssignPanel key={assigning.id} theme={T} lang={lang} density={density} routine={assigning} teams={teams} today={today}
                onAssign={handleAssign} onClose={() => setAssigning(null)}/>
            )}
            {importing && (
              <RoutineImportPanel theme={T} lang={lang} density={density} teams={teams} today={today}
                onImported={onImported} onClose={() => setImporting(false)}/>
            )}
            <AssignmentsPanel theme={T} lang={lang} density={density} assignments={assignments} onEnd={handleEnd}/>
          </>
        )}/>
    </div>
  );
}

export { HRRoutinesPage };
