// Pure helpers for send-reminders (no Deno / network APIs), so they can be
// unit-tested with vitest from src/ as well as run on the edge.

export type Lang = 'en' | 'ar';

// What public/sw.js shows: title, body, the URL to open on tap, and the tag
// that replaces an older notification of the same item.
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  lang?: Lang;
  dir?: 'ltr' | 'rtl';
}

export interface ReminderRow {
  user_id: string;
  company_id: string;
  item_id: string;
  day: string;            // company-local date
  at_time: string | null; // 'HH:MM'
  title_en: string | null;
  title_ar: string | null;
  sets_reps: string | null;
  sets_reps_ar: string | null;
  subscriptions: PushTarget[] | null;
}

export interface BroadcastRow {
  broadcast_id: string;
  company_id: string;
  user_id: string;
  title_en: string;
  title_ar: string | null;
  body_en: string | null;
  body_ar: string | null;
  has_audio: boolean;
  subscriptions: PushTarget[] | null;
}

export interface PushTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: string | null;
}

export function pickLang(lang: unknown): Lang | null {
  return lang === 'en' || lang === 'ar' ? lang : null;
}

export function truncate(s: string | null | undefined, n: number): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, Math.max(0, n - 1)).trimEnd()}…`;
}

// Routine reminder. Known language → that language only; unknown → the
// English title with an English + Arabic body.
export function buildReminderPayload(row: ReminderRow, lang: Lang | null): PushPayload {
  const nameEn = (row.title_en || row.title_ar || 'Routine').trim();
  const nameAr = (row.title_ar || row.title_en || 'الروتين').trim();
  const setsEn = (row.sets_reps || row.sets_reps_ar || '').trim();
  const setsAr = (row.sets_reps_ar || row.sets_reps || '').trim();
  const time = row.at_time ? `${row.at_time} · ` : '';
  const en = `${time}${setsEn ? `${setsEn}. ` : ''}Tap to open Today and tick it off.`;
  const ar = `${time}${setsAr ? `${setsAr}. ` : ''}افتح «اليوم» وعلّم عليها لما تخلّص.`;
  const base = {
    url: `/?open=today&item=${encodeURIComponent(row.item_id)}`,
    tag: `routine-${row.item_id}-${row.day}`,
  };
  if (lang === 'ar') return { ...base, title: truncate(nameAr, 80), body: truncate(ar, 180), lang: 'ar', dir: 'rtl' };
  if (lang === 'en') return { ...base, title: truncate(nameEn, 80), body: truncate(en, 180), lang: 'en', dir: 'ltr' };
  return {
    ...base,
    title: truncate(nameEn, 80),
    body: `${truncate(en, 140)}\n${truncate(nameAr === nameEn ? ar : `${nameAr} — ${ar}`, 160)}`,
  };
}

// HR broadcast. The body is the message text (or "Audio message" when it is
// audio only); unknown language → English title, English + Arabic body.
export function buildBroadcastPayload(row: BroadcastRow, lang: Lang | null): PushPayload {
  const titleEn = (row.title_en || row.title_ar || 'Message from HR').trim();
  const titleAr = (row.title_ar || row.title_en || 'رسالة من الموارد البشرية').trim();
  const audioEn = row.has_audio ? 'Audio message — tap to listen.' : '';
  const audioAr = row.has_audio ? 'رسالة صوتية — اضغط للاستماع.' : '';
  const bodyEn = truncate(row.body_en || row.body_ar || '', 160) || audioEn;
  const bodyAr = truncate(row.body_ar || row.body_en || '', 160) || audioAr;
  const base = {
    url: `/?open=notifs&broadcast=${encodeURIComponent(row.broadcast_id)}`,
    tag: `broadcast-${row.broadcast_id}`,
  };
  if (lang === 'ar') return { ...base, title: truncate(titleAr, 80), body: bodyAr, lang: 'ar', dir: 'rtl' };
  if (lang === 'en') return { ...base, title: truncate(titleEn, 80), body: bodyEn, lang: 'en', dir: 'ltr' };
  const second = titleAr === titleEn ? bodyAr : truncate(`${titleAr}${bodyAr ? ` — ${bodyAr}` : ''}`, 160);
  return { ...base, title: truncate(titleEn, 80), body: second && second !== bodyEn ? `${bodyEn}\n${second}`.trim() : bodyEn };
}

// Push services answer 404 / 410 for a subscription that no longer exists.
export function isGoneStatus(status: number | null | undefined): boolean {
  return status === 404 || status === 410;
}

// Constant-time string compare (for the cron secret).
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// VAPID keys as most tools print them (base64url: public = 65-byte
// uncompressed P-256 point, private = 32-byte scalar) → the JWK pair
// @negrel/webpush imports. Throws 'bad_vapid_keys' on anything else.
export function vapidKeysToJwk(publicKey: string, privateKey: string): {
  publicKey: JsonWebKey; privateKey: JsonWebKey;
} {
  let pub: Uint8Array;
  let priv: Uint8Array;
  try {
    pub = b64urlToBytes(publicKey.trim());
    priv = b64urlToBytes(privateKey.trim());
  } catch {
    throw new Error('bad_vapid_keys');
  }
  if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) throw new Error('bad_vapid_keys');
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  const d = bytesToB64url(priv);
  return {
    publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true },
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d, ext: false },
  };
}

// Run fn over items with at most `limit` at once; results keep the order.
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
