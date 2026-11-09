// HR portal adapters for the shared authoring screens (src/shared/authoring).
// Everything goes through the sprint 2 contract in src/lib/supabase-routines.ts.
import {
  listExercises, listRoutines, saveExercise, saveRoutine, setLibraryStatus, setLibraryPref,
  copyExercise, copyRoutine, getRoutineDetail, uploadCompanyMedia, removeCompanyMedia,
  resolveMedia, getMediaUrl,
} from '../../lib/supabase-routines';

// Private company media: uploads go to company-media/{company_id}/…, the
// player gets signed URLs (reused for a day).
export const hrMedia = {
  bucket: 'company-media',
  upload: (file, opts) => uploadCompanyMedia(file, opts),
  discard: (path) => removeCompanyMedia(path).catch(() => {}),
  resolve: (fields) => resolveMedia(fields),
  url: (ref) => getMediaUrl(ref),
};

export const hrExerciseApi = {
  mode: 'hr',
  list: () => listExercises('all'),
  save: (input) => saveExercise(input),
  setStatus: (id, status) => setLibraryStatus('exercise', id, status),
  setPref: (id, pref) => setLibraryPref('exercise', id, pref),
  copy: (id) => copyExercise(id),
  media: hrMedia,
};

export const hrRoutineApi = {
  mode: 'hr',
  list: () => listRoutines('all'),
  detail: (id) => getRoutineDetail(id),
  save: (input) => saveRoutine(input),
  setStatus: (id, status) => setLibraryStatus('routine', id, status),
  setPref: (id, pref) => setLibraryPref('routine', id, pref),
  copy: (id) => copyRoutine(id),
  exercises: () => listExercises('all'),
  saveExercise: (input) => saveExercise(input),
  media: hrMedia,
};
