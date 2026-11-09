// HR portal adapter for the Broadcasts screen (sprint 3 contract:
// src/lib/supabase-broadcasts.ts). Injectable so the screen can be tested.
import { listBroadcasts, saveBroadcast, cancelBroadcast, uploadBroadcastAudio } from '../../lib/supabase-broadcasts';
import { getMediaUrl, removeCompanyMedia, getMyCompanySettings } from '../../lib/supabase-routines';
import { listTeams } from '../../lib/supabase-teams';
import { listCompanyTeams } from '../../lib/supabase-hr';

export const broadcastApi = {
  list: () => listBroadcasts(),
  save: (input) => saveBroadcast(input),
  cancel: (id) => cancelBroadcast(id),
  uploadAudio: (file, opts) => uploadBroadcastAudio(file, opts),
  // A file uploaded in the composer but never saved.
  discardAudio: (path) => removeCompanyMedia(path).catch(() => {}),
  audioUrl: (b) => getMediaUrl({ bucket: b.media_bucket || 'company-media', path: b.media_path }),
  settings: () => getMyCompanySettings(),
  teams: () => listTeams().then((r) => r?.teams || []).catch(() => listCompanyTeams()),
};

// The browser's own zone, when the company's isn't known.
export function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}
