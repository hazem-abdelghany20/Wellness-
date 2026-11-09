// Wellness House admin: the public exercise and routine libraries.
//
// library_list() needs a company (it shows one company's view), so the
// admin console reads the public rows straight from the tables (the
// *_wadmin_all policies allow it) and writes through the same RPCs as HR
// with `public: true` (assert_library_writer checks is_wellness_admin()).
// Public rows may only use the public bucket, so media goes to
// content-assets.
import { supabase } from '../../lib/supabase';
import {
  saveExercise, saveRoutine, setLibraryStatus, getRoutineDetail, resolveMedia, getMediaUrl,
} from '../../lib/supabase-routines';
import { deleteContentAsset } from '../../lib/supabase-admin';

const BUCKET = 'content-assets';
const EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };
const KIND = { 'video/mp4': 'video', 'video/quicktime': 'video', 'image/png': 'image', 'image/jpeg': 'image', 'application/pdf': 'pdf' };

const asPublic = (row) => ({ ...row, scope: 'public', hidden: false, pinned: false, can_edit: true });

export async function listPublicExercises() {
  const { data, error } = await supabase.from('exercises').select('*').is('company_id', null).order('name_en');
  if (error) throw error;
  return (data ?? []).map(asPublic);
}

export async function listPublicRoutines() {
  const { data, error } = await supabase
    .from('routines').select('*, routine_items(count)').is('company_id', null).order('title_en');
  if (error) throw error;
  return (data ?? []).map(({ routine_items: items, ...r }) => asPublic({
    ...r, item_count: Array.isArray(items) ? Number(items[0]?.count ?? 0) : 0, assigned: false,
  }));
}

// Upload to the public bucket with progress (XHR: supabase-js storage has
// no progress events). Path: {folder}/{time}-{random}.{ext}.
export async function uploadPublicMedia(file, { folder = 'exercises', contentType, onProgress, signal } = {}) {
  const mime = contentType || file.type;
  if (!KIND[mime]) throw Object.assign(new Error('bad_type'), { code: 'bad_type', status: 415 });
  if (typeof file.size === 'number' && file.size > 50 * 1024 * 1024) {
    throw Object.assign(new Error('too_large'), { code: 'too_large', status: 413 });
  }
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw Object.assign(new Error('not_signed_in'), { status: 401 });
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[mime] || 'bin'}`;

  await new Promise((resolve, reject) => {
    const cancelled = () => Object.assign(new Error('Upload cancelled'), { name: 'AbortError' });
    if (signal?.aborted) { reject(cancelled()); return; }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (anonKey) xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('Cache-Control', 'max-age=86400');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
      let body = {};
      try { body = JSON.parse(xhr.responseText || '{}'); } catch { /* not JSON */ }
      reject(Object.assign(new Error(body.message || body.error || `Upload failed (${xhr.status})`), {
        status: Number(body.statusCode) || xhr.status, code: body.error,
      }));
    };
    xhr.onerror = () => reject(Object.assign(new Error('Network error'), { status: 0 }));
    xhr.onabort = () => reject(cancelled());
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
  onProgress?.(100);
  return { bucket: BUCKET, path, mime, kind: KIND[mime] };
}

export const publicMedia = {
  bucket: BUCKET,
  upload: (file, opts) => uploadPublicMedia(file, opts),
  discard: (path) => deleteContentAsset(path).catch(() => {}),
  resolve: (fields) => resolveMedia(fields),
  url: (ref) => getMediaUrl(ref),
};

export const adminExerciseApi = {
  mode: 'admin',
  list: listPublicExercises,
  save: (input) => saveExercise(input),
  setStatus: (id, status) => setLibraryStatus('exercise', id, status),
  media: publicMedia,
};

export const adminRoutineApi = {
  mode: 'admin',
  list: listPublicRoutines,
  detail: (id) => getRoutineDetail(id),
  save: (input) => saveRoutine(input),
  setStatus: (id, status) => setLibraryStatus('routine', id, status),
  exercises: listPublicExercises,
  saveExercise: (input) => saveExercise({ ...input, public: true }),
  media: publicMedia,
};
