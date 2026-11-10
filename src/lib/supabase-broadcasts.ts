import { supabase } from './supabase';
import {
  getMediaUrl, mediaMimeOf, MEDIA_MIME_KINDS, uploadCompanyMedia, type UploadedMedia,
} from './supabase-routines';

// Sprint 3: HR broadcasts delivered at the set time, with an optional audio
// message. SQL: supabase/migrations/20261111000001_*.sql §4.
//
// Scheduling only stores the broadcast; a per-minute job delivers it
// (in-app notification for everyone or one team, plus Web Push) when its
// time comes. Quiet hours (company setting, default on) hold a broadcast
// due between 20:00 and 08:00 company time until 08:00 — deliver_at says
// when it will really go. Due now → delivered at once by the save.
//
// Errors (error.message): not_authorized · title_required · title_too_long
// (160) · body_too_long (2000) · body_required (text or audio) · bad_scope ·
// team_not_found · bad_scheduled_at · bad_media_bucket · bad_media_mime ·
// bad_media_duration · media_path_outside_company · broadcast_not_found ·
// broadcast_not_editable (details = its status) · broadcast_already_sent ·
// bad_audio_type / too_large (upload, before sending anything).

export type BroadcastStatus = 'scheduled' | 'sent' | 'cancelled';
export type AudioMime = 'audio/mpeg' | 'audio/mp4' | 'audio/x-m4a' | 'audio/webm' | 'audio/ogg';

export interface Broadcast {
  id: string;
  company_id: string;
  title_en: string;
  title_ar: string | null;
  body_en: string | null;
  body_ar: string | null;
  scope: 'all' | 'team';
  team_id: string | null;
  team_name: string | null;
  status: BroadcastStatus;
  scheduled_at: string;          // what HR picked (or the save time)
  deliver_at: string | null;     // scheduled: when it will really go (quiet hours) · sent: sent_at
  sent_at: string | null;
  recipients: number | null;     // people who got it in-app
  push_sent: number;             // devices reached by push
  push_failed: number;
  has_audio: boolean;
  media_type: 'audio' | null;
  media_bucket: 'company-media' | null;
  media_path: string | null;
  media_mime: AudioMime | null;
  media_duration_s: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BroadcastAudio {
  path: string;                  // from uploadBroadcastAudio()
  mime: string;
  duration_s?: number | null;
}

export interface BroadcastInput {
  id?: string;                   // update (only while scheduled); missing keys keep their value
  title_en?: string;
  title_ar?: string | null;
  body_en?: string | null;
  body_ar?: string | null;
  scope?: 'all' | 'team';
  team_id?: string | null;       // required for scope 'team'
  scheduled_at?: string | null;  // ISO time; null / missing / past = now
  audio?: BroadcastAudio | null; // null removes the audio; undefined keeps it
}

function toRpcInput(input: BroadcastInput): Record<string, unknown> {
  const { audio, ...rest } = input;
  const out: Record<string, unknown> = { ...rest };
  if (audio === null) {
    out.media_path = null;
  } else if (audio) {
    out.media_bucket = 'company-media';
    out.media_path = audio.path;
    out.media_mime = audio.mime;
    out.media_duration_s = audio.duration_s == null ? null : Math.round(audio.duration_s);
  }
  return out;
}

// HR: the company's broadcasts, newest first.
export async function listBroadcasts(limit = 100): Promise<Broadcast[]> {
  const { data, error } = await supabase.rpc('hr_list_broadcasts', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as Broadcast[];
}

// HR: create (no id) or edit (id, still scheduled) a broadcast.
export async function saveBroadcast(input: BroadcastInput): Promise<Broadcast> {
  const { data, error } = await supabase.rpc('hr_save_broadcast', { p_input: toRpcInput(input) });
  if (error) throw error;
  return data as Broadcast;
}

// HR: cancel one that hasn't gone out (sent → broadcast_already_sent).
export async function cancelBroadcast(id: string): Promise<Broadcast> {
  const { data, error } = await supabase.rpc('hr_cancel_broadcast', { p_broadcast_id: id });
  if (error) throw error;
  return data as Broadcast;
}

// The audio type of a file, or null when it isn't one company-media takes.
export function audioMimeOf(file: { type?: string; name?: string }): AudioMime | null {
  const mime = mediaMimeOf(file);
  return mime && MEDIA_MIME_KINDS[mime] === 'audio' ? (mime as AudioMime) : null;
}

// Length of an audio file in seconds (browser metadata); null if unknown.
export function readAudioDuration(file: Blob, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined' || typeof URL?.createObjectURL !== 'function') { resolve(null); return; }
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let done = false;
    const finish = (v: number | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(v);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    audio.onerror = () => finish(null);
    setTimeout(() => finish(null), timeoutMs);
    audio.src = url;
  });
}

// HR: upload a voice note / podcast to company-media/{company}/broadcasts/
// with progress (same uploader as exercise videos: 50 MB cap, refused
// before sending anything). Returns what saveBroadcast({ audio }) takes.
export async function uploadBroadcastAudio(
  file: Blob & { name?: string },
  opts: { onProgress?: (pct: number) => void; signal?: AbortSignal; companyId?: string } = {},
): Promise<BroadcastAudio & { upload: UploadedMedia }> {
  const mime = audioMimeOf(file);
  if (!mime) throw Object.assign(new Error('bad_audio_type'), { code: 'bad_audio_type', status: 415 });
  const [upload, duration] = await Promise.all([
    uploadCompanyMedia(file, { folder: 'broadcasts', contentType: mime, ...opts }),
    readAudioDuration(file).catch(() => null),
  ]);
  return { path: upload.path, mime: upload.mime, duration_s: duration, upload };
}

export interface BroadcastMedia {
  broadcast_id: string;
  media_type: 'audio';
  media_bucket: 'company-media';
  media_path: string;
  media_mime: AudioMime;
  media_duration_s: number | null;
}

// Employee (or HR): the audio of broadcasts I received (notification.broadcast_id).
// Only ids with audio come back.
export async function getBroadcastMedia(broadcastIds: string[]): Promise<BroadcastMedia[]> {
  if (!broadcastIds.length) return [];
  const { data, error } = await supabase.rpc('broadcast_media', { p_broadcast_ids: broadcastIds });
  if (error) throw error;
  return (data ?? []) as BroadcastMedia[];
}

// Employee: a playable (signed, cached for a day) URL for a broadcast's
// audio, or null when it has none / I didn't receive it.
export async function getBroadcastAudioUrl(broadcastId: string): Promise<{
  url: string; mime: AudioMime; duration_s: number | null;
} | null> {
  const [m] = await getBroadcastMedia([broadcastId]);
  if (!m) return null;
  const url = await getMediaUrl({ bucket: m.media_bucket, path: m.media_path });
  return url ? { url, mime: m.media_mime, duration_s: m.media_duration_s } : null;
}
