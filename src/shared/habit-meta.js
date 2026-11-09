// Shared facts about weekly habit templates, used by the admin builder, the
// HR picker and the employee Challenge tab.

// Categories an admin can file a habit under. icon names exist in the
// employee design-system Icon set; colors are the badge tint.
export const HABIT_CATEGORIES = [
  { id: 'movement',  en: 'Movement',  ar: 'حركة',      icon: 'activity', color: '#8BBF7A' },
  { id: 'sleep',     en: 'Sleep',     ar: 'نوم',       icon: 'moon',     color: '#9C8BD9' },
  { id: 'mood',      en: 'Mood',      ar: 'المزاج',    icon: 'smile',    color: '#E39A7B' },
  { id: 'hydration', en: 'Hydration', ar: 'شرب المية', icon: 'drop',     color: '#6FB7D9' },
  { id: 'stress',    en: 'Stress',    ar: 'التوتر',    icon: 'wind',     color: '#C9A15B' },
];

export function habitCategory(id) {
  return HABIT_CATEGORIES.find((c) => c.id === id) || null;
}

// Every payload key that describes the how-to media. A template has at most
// one media item: an uploaded video or image, or a YouTube video.
export const MEDIA_KEYS = ['media_type', 'media_url', 'media_path', 'media_mime', 'media_youtube_id'];

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

export function isYouTubeId(id) {
  return typeof id === 'string' && YT_ID.test(id);
}

// Accepts youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID and
// youtube.com/embed/ID (with or without https://, extra params allowed).
// Returns { ok: true, id } or { ok: false, reason }.
export function parseYouTubeUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'invalid' };

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id = null;
  if (SHORT_HOSTS.has(host)) {
    id = parts.length === 1 ? parts[0] : null;
  } else if (YT_HOSTS.has(host)) {
    if (parts.length === 1 && parts[0] === 'watch') id = url.searchParams.get('v');
    else if (parts.length === 2 && (parts[0] === 'shorts' || parts[0] === 'embed')) id = parts[1];
  } else {
    return { ok: false, reason: 'host' };
  }
  if (!id) return { ok: false, reason: 'missing_id' };
  if (!isYouTubeId(id)) return { ok: false, reason: 'bad_id' };
  return { ok: true, id };
}

export function youtubeEmbedUrl(id) {
  return isYouTubeId(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` : null;
}

// The media a template / challenge payload carries, or null.
//   { type: 'youtube', youtube_id }
//   { type: 'video' | 'image', url, path, mime }
export function mediaFromPayload(p) {
  if (!p || typeof p !== 'object') return null;
  if (p.media_type === 'youtube') {
    return isYouTubeId(p.media_youtube_id) ? { type: 'youtube', youtube_id: p.media_youtube_id } : null;
  }
  const url = typeof p.media_url === 'string' && /^https?:\/\//i.test(p.media_url) ? p.media_url : null;
  if (!url) return null;
  const type = p.media_type === 'image' || p.media_type === 'video'
    ? p.media_type
    : (/\.(png|jpe?g)(\?|#|$)/i.test(url) ? 'image' : 'video');
  return { type, url, path: p.media_path || null, mime: p.media_mime || null };
}
