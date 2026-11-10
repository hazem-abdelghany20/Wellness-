import { describe, it, expect } from 'vitest';
import { webcrypto, generateKeyPairSync } from 'node:crypto';
import {
  buildBroadcastPayload, buildReminderPayload, isGoneStatus, mapPool, pickLang, safeEqual, truncate,
  vapidKeysToJwk, b64urlToBytes, bytesToB64url,
} from '../../../supabase/functions/send-reminders/payload.ts';

const reminder = {
  user_id: 'u1', company_id: 'c1', item_id: 'i1', day: '2026-11-09', at_time: '10:30',
  title_en: 'Neck tilt', title_ar: 'إمالة الرقبة', sets_reps: '2 × 10', sets_reps_ar: '٢ × ١٠', subscriptions: [],
};
const broadcast = {
  broadcast_id: 'b1', company_id: 'c1', user_id: 'u1', title_en: 'Water break', title_ar: 'استراحة مياه',
  body_en: 'Grab a glass of water.', body_ar: 'اشرب كوباية مياه.', has_audio: false, subscriptions: [],
};

describe('reminder payload', () => {
  it('English', () => {
    expect(buildReminderPayload(reminder, 'en')).toEqual({
      title: 'Neck tilt', body: '10:30 · 2 × 10. Tap to open Today and tick it off.',
      url: '/?open=today&item=i1', tag: 'routine-i1-2026-11-09', lang: 'en', dir: 'ltr',
    });
  });

  it('Arabic, right to left', () => {
    const p = buildReminderPayload(reminder, 'ar');
    expect(p).toMatchObject({ title: 'إمالة الرقبة', lang: 'ar', dir: 'rtl', tag: 'routine-i1-2026-11-09' });
    expect(p.body).toContain('٢ × ١٠');
    expect(p.body).toContain('«اليوم»');
  });

  it('unknown language → English title, English + Arabic body', () => {
    const p = buildReminderPayload(reminder, null);
    expect(p.title).toBe('Neck tilt');
    expect(p.body.split('\n')).toHaveLength(2);
    expect(p.body).toContain('Tap to open Today');
    expect(p.body).toContain('إمالة الرقبة');
    expect(p.lang).toBeUndefined();
  });

  it('missing Arabic / sets / time fall back cleanly', () => {
    const p = buildReminderPayload({ ...reminder, title_ar: null, sets_reps: null, sets_reps_ar: null, at_time: null }, 'ar');
    expect(p.title).toBe('Neck tilt');
    expect(p.body).toBe('افتح «اليوم» وعلّم عليها لما تخلّص.');
  });

  it('item ids are URL-encoded', () => {
    expect(buildReminderPayload({ ...reminder, item_id: 'a b&c' }, 'en').url).toBe('/?open=today&item=a%20b%26c');
  });
});

describe('broadcast payload', () => {
  it('per language', () => {
    expect(buildBroadcastPayload(broadcast, 'en')).toEqual({
      title: 'Water break', body: 'Grab a glass of water.', url: '/?open=notifs&broadcast=b1', tag: 'broadcast-b1', lang: 'en', dir: 'ltr',
    });
    expect(buildBroadcastPayload(broadcast, 'ar')).toMatchObject({ title: 'استراحة مياه', body: 'اشرب كوباية مياه.', dir: 'rtl' });
  });

  it('unknown language → both', () => {
    expect(buildBroadcastPayload(broadcast, null).body).toBe('Grab a glass of water.\nاستراحة مياه — اشرب كوباية مياه.');
  });

  it('audio only → "Audio message" body', () => {
    const p = buildBroadcastPayload({ ...broadcast, body_en: null, body_ar: null, has_audio: true }, 'en');
    expect(p.body).toBe('Audio message — tap to listen.');
    expect(buildBroadcastPayload({ ...broadcast, body_en: null, body_ar: null, has_audio: true }, 'ar').body)
      .toBe('رسالة صوتية — اضغط للاستماع.');
  });

  it('long text is cut to fit a push (≤ 4 KB)', () => {
    const p = buildBroadcastPayload({ ...broadcast, body_en: 'x'.repeat(3000) }, 'en');
    expect(p.body.length).toBeLessThanOrEqual(160);
    expect(p.body.endsWith('…')).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(buildBroadcastPayload({ ...broadcast, body_en: 'ب'.repeat(3000), body_ar: 'ب'.repeat(3000), title_en: 'x'.repeat(500) }, null))).length)
      .toBeLessThan(3000);
  });
});

describe('helpers', () => {
  it('pickLang / truncate / isGoneStatus', () => {
    expect(pickLang('ar')).toBe('ar');
    expect(pickLang('fr')).toBeNull();
    expect(pickLang(null)).toBeNull();
    expect(truncate('  a   b  ', 10)).toBe('a b');
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect([404, 410, 400, 500, null].map(isGoneStatus)).toEqual([true, true, false, false, false]);
  });

  it('safeEqual compares the whole string', () => {
    expect(safeEqual('secret-123', 'secret-123')).toBe(true);
    expect(safeEqual('secret-123', 'secret-124')).toBe(false);
    expect(safeEqual('secret', 'secret-123')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });

  it('base64url round trip', () => {
    const bytes = new Uint8Array([0, 251, 255, 62, 63, 1]);
    expect(Array.from(b64urlToBytes(bytesToB64url(bytes)))).toEqual(Array.from(bytes));
    expect(bytesToB64url(new Uint8Array([251, 255]))).toBe('-_8');
  });

  it('VAPID keys in the usual base64url format become a working ECDSA key pair', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = privateKey.export({ format: 'jwk' });
    const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
    const keys = vapidKeysToJwk(pub, jwk.d);
    const algo = { name: 'ECDSA', namedCurve: 'P-256' };
    const priv = await webcrypto.subtle.importKey('jwk', keys.privateKey, algo, false, ['sign']);
    const pubKey = await webcrypto.subtle.importKey('jwk', keys.publicKey, algo, true, ['verify']);
    const data = new TextEncoder().encode('hello');
    const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, data);
    expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, sig, data)).toBe(true);
  });

  it('bad VAPID keys are refused', () => {
    expect(() => vapidKeysToJwk('short', 'x')).toThrow('bad_vapid_keys');
    expect(() => vapidKeysToJwk(bytesToB64url(new Uint8Array(65)), bytesToB64url(new Uint8Array(32)))).toThrow('bad_vapid_keys');
  });

  it('mapPool keeps order and the concurrency limit', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapPool([5, 1, 3, 2, 4, 0], 2, async (n) => {
      running += 1; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running -= 1;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 30, 20, 40, 0]);
    expect(peak).toBe(2);
    expect(await mapPool([], 4, async () => 1)).toEqual([]);
  });
});
