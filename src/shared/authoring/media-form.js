// The "how-to media" part of the exercise and challenge forms: nothing, an
// uploaded video / picture, or a YouTube link. Pure functions.
import { parseYouTubeUrl } from '../habit-meta.js';
import { msg } from './text.js';

export const MAX_MEDIA_MB = 50;
const MAX_BYTES = MAX_MEDIA_MB * 1024 * 1024;
const KIND_BY_MIME = {
  'video/mp4': 'video', 'video/quicktime': 'video',
  'image/png': 'image', 'image/jpeg': 'image',
  'application/pdf': 'pdf',
};
const MIME_BY_EXT = { mp4: 'video/mp4', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };

export function emptyMedia() {
  return { mode: 'none', file: null, youtube_url: '' };
}

// Row fields (exercise row or challenge payload) → form media.
export function mediaToForm(row) {
  const r = row || {};
  if (r.media_type === 'youtube' && r.media_youtube_id) {
    return { mode: 'youtube', file: null, youtube_url: `https://youtu.be/${r.media_youtube_id}` };
  }
  if ((r.media_type === 'video' || r.media_type === 'image') && (r.media_path || r.media_url)) {
    return {
      mode: 'upload',
      file: {
        bucket: r.media_bucket || null, path: r.media_path || null, mime: r.media_mime || null,
        kind: r.media_type, url: r.media_url || null, name: String(r.media_path || r.media_url || '').split('/').pop(),
      },
      youtube_url: '',
    };
  }
  return emptyMedia();
}

export function youtubeMessage(reason) {
  if (reason === 'empty') return msg('Paste the YouTube link.', 'حط لينك اليوتيوب.');
  return msg('That is not a YouTube video link. Copy the link from the Share button on YouTube.',
    'ده مش لينك فيديو يوتيوب. انسخ اللينك من زرار المشاركة في يوتيوب.');
}

// { media: {en, ar} } when the media part isn't complete, else {}.
export function validateMedia(media) {
  const m = media || emptyMedia();
  if (m.mode === 'upload') {
    if (!m.file || !m.file.path || !(m.file.kind === 'video' || m.file.kind === 'image')) {
      return { media: msg('Upload a video or a picture, or choose "None".', 'ارفع فيديو أو صورة، أو اختار «من غير».') };
    }
  } else if (m.mode === 'youtube') {
    const yt = parseYouTubeUrl(m.youtube_url);
    if (!yt.ok) return { media: youtubeMessage(yt.reason) };
  }
  return {};
}

// Form media → the shared media columns (media_type, media_bucket, …).
export function mediaFields(media) {
  const m = media || emptyMedia();
  if (m.mode === 'youtube') {
    const yt = parseYouTubeUrl(m.youtube_url);
    if (yt.ok) return { media_type: 'youtube', media_bucket: null, media_path: null, media_mime: null, media_youtube_id: yt.id };
  }
  if (m.mode === 'upload' && m.file?.path && (m.file.kind === 'video' || m.file.kind === 'image')) {
    return {
      media_type: m.file.kind, media_bucket: m.file.bucket || null, media_path: m.file.path,
      media_mime: m.file.mime || null, media_youtube_id: null,
    };
  }
  return { media_type: null, media_bucket: null, media_path: null, media_mime: null, media_youtube_id: null };
}

export function formatMB(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
}

// Check a picked file before uploading. kinds: which of video / image / pdf are allowed.
// → { ok: true, mime, kind } or { ok: false, error: {en, ar} }.
export function checkFile(file, kinds = ['video', 'image']) {
  if (!file) return { ok: false, error: msg('Choose a file.', 'اختار ملف.') };
  let mime = String(file.type || '').toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (!KIND_BY_MIME[mime]) {
    const ext = String(file.name || '').toLowerCase().split('.').pop();
    mime = MIME_BY_EXT[ext] || '';
  }
  const kind = KIND_BY_MIME[mime];
  if (!kind || !kinds.includes(kind)) {
    return {
      ok: false,
      error: kinds.includes('pdf')
        ? msg('Use a PNG or JPEG picture, or a PDF.', 'استخدم صورة PNG أو JPEG، أو ملف PDF.')
        : msg('Use an MP4 or MOV video, or a PNG or JPEG picture.', 'استخدم فيديو MP4 أو MOV، أو صورة PNG أو JPEG.'),
    };
  }
  if (!file.size) return { ok: false, error: msg('That file is empty.', 'الملف ده فاضي.') };
  if (file.size > MAX_BYTES) {
    const mb = formatMB(file.size);
    return {
      ok: false,
      error: kind === 'video'
        ? msg(`That video is ${mb} MB. The limit is 50 MB: export it at 720p or paste a YouTube link.`,
              `الفيديو ده ${mb} ميجا. الحد ٥٠ ميجا: صدّره بجودة 720p أو حط لينك يوتيوب.`)
        : msg(`That file is ${mb} MB. The limit is 50 MB.`, `الملف ده ${mb} ميجا. الحد ٥٠ ميجا.`),
    };
  }
  return { ok: true, mime, kind };
}

// Upload failure → message.
export function uploadError(err) {
  const status = Number(err?.status ?? err?.statusCode);
  const text = String(err?.message || err?.code || '');
  if (err?.name === 'AbortError') return msg('Upload cancelled.', 'الرفع اتلغى.');
  if (status === 413 || /too_large|exceeded the maximum|too large/i.test(text)) {
    return msg('That file is over 50 MB. Export it at 720p or paste a YouTube link.', 'الملف أكبر من ٥٠ ميجا. صدّره بجودة 720p أو حط لينك يوتيوب.');
  }
  if (status === 415 || /bad_type|mime type|invalid_mime/i.test(text)) {
    return msg('Use an MP4 or MOV video, or a PNG or JPEG picture.', 'استخدم فيديو MP4 أو MOV، أو صورة PNG أو JPEG.');
  }
  if (status === 401 || status === 403 || /row-level security|unauthori[sz]ed|not_signed_in|not_in_company|jwt/i.test(text)) {
    return msg('You can’t upload here. Sign in again and retry.', 'مش مسموح لك ترفع هنا. سجّل دخول تاني وجرّب.');
  }
  return msg('Upload failed. Check your connection and try again.', 'الرفع فشل. اتأكد من النت وجرّب تاني.');
}
