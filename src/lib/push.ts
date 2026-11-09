import { supabase } from './supabase';
import { setMyPrefs, type MyPrefs } from './supabase-routines';

// Sprint 3: Web Push for routine reminders and HR broadcasts (web app / PWA
// only; the iOS app bundle is not a browser and gets local notifications
// later — item 8). SQL: supabase/migrations/20261111000001_*.sql;
// sender: supabase/functions/send-reminders; display: public/sw.js.
//
// The flow for the "Remind me" switch (Me / Today):
//   const s = getPushSupport();
//   s.reason === 'ios_needs_install' → show the 3-step "Add to Home Screen" card
//   s.supported                      → on the tap: await enableRoutineReminders({ lang })
//   switch off                       → await disableRoutineReminders()
//   app start (signed in)            → refreshPushSubscription({ lang }) (cheap, no prompt)
//
// Errors thrown (error.code, message = the same code):
//   push_unsupported (error.reason = PushSupport.reason) · push_denied
//   (the person blocked notifications; only browser settings can undo it) ·
//   push_no_key (VITE_VAPID_PUBLIC_KEY missing in this build) ·
//   push_dismissed (the permission prompt was closed without an answer) ·
//   push_no_service_worker · plus the Supabase RPC errors
//   (invalid_subscription, not_authenticated).

export type PushUnsupportedReason =
  | 'no_window'           // not running in a browser
  | 'native_app'          // inside the Capacitor iOS / Android app
  | 'insecure'            // not https (or localhost)
  | 'no_service_worker'
  | 'ios_needs_install'   // iPhone / iPad Safari tab: Add to Home Screen first (iOS 16.4+)
  | 'no_push_manager'     // browser without Push API (e.g. iOS < 16.4 home-screen app)
  | 'no_notification'     // no Notification API
  | 'no_vapid_key';       // this build has no VITE_VAPID_PUBLIC_KEY

export interface PushSupport {
  supported: boolean;
  reason: PushUnsupportedReason | null;
  ios: boolean;           // iPhone / iPad (incl. iPadOS that reports as Mac)
  standalone: boolean;    // opened from the Home Screen / as an installed app
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export type PushStateName =
  | 'unsupported'   // see support.reason (incl. needs_install on iPhone)
  | 'denied'        // blocked in browser settings
  | 'prompt'        // never asked: the switch can ask on tap
  | 'unsubscribed'  // allowed, but this browser has no subscription
  | 'subscribed';   // this browser receives pushes

export interface PushState {
  state: PushStateName;
  permission: PushPermission;
  endpoint: string | null;
  support: PushSupport;
}

export interface SavedPushSubscription {
  id: string;
  endpoint: string;
  lang: 'en' | 'ar' | null;
  created_at: string;
  last_seen_at: string;
}

const SW_URL = '/sw.js';

function pushError(code: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { code, ...extra });
}

// The VAPID public key baked into this build (base64url), or null.
export function getVapidPublicKey(): string | null {
  const k = String(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();
  return k || null;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  } catch { /* old browsers */ }
  return (navigator as any).standalone === true;
}

function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

// Can this browser receive our Web Push, and if not, why.
export function getPushSupport(): PushSupport {
  const ios = isIOS();
  const standalone = isStandalone();
  const no = (reason: PushUnsupportedReason): PushSupport => ({ supported: false, reason, ios, standalone });
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return no('no_window');
  if (isNativeApp()) return no('native_app');
  if (window.isSecureContext === false) return no('insecure');
  if (!('serviceWorker' in navigator)) return no('no_service_worker');
  // iPhone Safari only allows Web Push for apps added to the Home Screen.
  if (ios && !standalone) return no('ios_needs_install');
  if (!('PushManager' in window)) return no('no_push_manager');
  if (!('Notification' in window)) return no('no_notification');
  if (!getVapidPublicKey()) return no('no_vapid_key');
  return { supported: true, reason: null, ios, standalone };
}

export function isPushSupported(): boolean {
  return getPushSupport().supported;
}

// base64url → bytes, for PushManager.subscribe({ applicationServerKey }).
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToUrlBase64(buf: ArrayBuffer | null | undefined): string {
  if (!buf) return '';
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function currentPermission(): PushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return (Notification.permission as PushPermission) || 'default';
}

// The page's service-worker registration (registers /sw.js when missing,
// e.g. in a dev build), with a timeout so a broken worker can't hang the tap.
async function getRegistration(register: boolean): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  let reg = (await navigator.serviceWorker.getRegistration()) ?? null;
  if (!reg && register) reg = await navigator.serviceWorker.register(SW_URL);
  if (!reg) return null;
  if (reg.active) return reg;
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
  ]);
  return ready ?? reg;
}

function sameKey(sub: PushSubscription, key: string): boolean {
  const current = bytesToUrlBase64(sub.options?.applicationServerKey ?? null);
  return !current || current === key.replace(/=+$/, '');
}

async function saveSubscription(sub: PushSubscription, lang?: 'en' | 'ar' | null): Promise<SavedPushSubscription> {
  const json = sub.toJSON() as Record<string, unknown>;
  const { data, error } = await supabase.rpc('save_push_subscription', {
    p_sub: {
      ...json,
      lang: lang ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    },
  });
  if (error) throw error;
  return data as SavedPushSubscription;
}

// Where this browser stands (no prompt, no network except the SW lookup).
export async function getPushState(): Promise<PushState> {
  const support = getPushSupport();
  const permission = currentPermission();
  if (!support.supported) return { state: 'unsupported', permission, endpoint: null, support };
  if (permission === 'denied') return { state: 'denied', permission, endpoint: null, support };
  const reg = await getRegistration(false).catch(() => null);
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  if (sub && permission === 'granted') return { state: 'subscribed', permission, endpoint: sub.endpoint, support };
  return { state: permission === 'granted' ? 'unsubscribed' : 'prompt', permission, endpoint: null, support };
}

// Ask for permission (call it from a tap), subscribe this browser and save
// it for the signed-in person. lang = the app language now (the push text
// language). Safe to call again: re-saves the same subscription.
export async function subscribePush(opts: { lang?: 'en' | 'ar' } = {}): Promise<SavedPushSubscription> {
  const support = getPushSupport();
  if (!support.supported) {
    if (support.reason === 'no_vapid_key') throw pushError('push_no_key');
    throw pushError('push_unsupported', { reason: support.reason });
  }
  const key = getVapidPublicKey()!;
  let permission = currentPermission();
  if (permission === 'default') permission = (await Notification.requestPermission()) as PushPermission;
  if (permission === 'denied') throw pushError('push_denied');
  if (permission !== 'granted') throw pushError('push_dismissed');

  const reg = await getRegistration(true);
  if (!reg) throw pushError('push_no_service_worker');
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another VAPID key can't receive our pushes.
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe().catch(() => false);
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  return saveSubscription(sub, opts.lang);
}

// Stop pushes to this browser: forget it on the server, then unsubscribe.
// True when this browser had a subscription.
export async function unsubscribePush(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const reg = await getRegistration(false).catch(() => null);
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  if (!sub) return false;
  const { error } = await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => false);
  if (error) throw error;
  return true;
}

// On app start (signed in): if this browser is already subscribed and
// allowed, save it again (new account on the same browser, changed
// endpoint after a pushsubscriptionchange, language). Never prompts.
// Returns the saved row, or null when there was nothing to refresh.
export async function refreshPushSubscription(opts: { lang?: 'en' | 'ar' } = {}): Promise<SavedPushSubscription | null> {
  const support = getPushSupport();
  if (!support.supported || currentPermission() !== 'granted') return null;
  const reg = await getRegistration(false).catch(() => null);
  if (!reg) return null;
  let sub = await reg.pushManager.getSubscription().catch(() => null);
  const key = getVapidPublicKey()!;
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe().catch(() => false);
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  }
  if (!sub) return null;
  return saveSubscription(sub, opts.lang);
}

// "Remind me" on: subscribe this browser (asks permission) and turn
// routine_reminders on. Returns the new prefs.
export async function enableRoutineReminders(opts: { lang?: 'en' | 'ar' } = {}): Promise<MyPrefs> {
  await subscribePush(opts);
  return setMyPrefs({ routine_reminders: true });
}

// "Remind me" off: no more routine reminders. The browser stays subscribed
// so HR broadcasts still arrive as pushes; pass { unsubscribe: true } to
// stop every push on this browser too.
export async function disableRoutineReminders(opts: { unsubscribe?: boolean } = {}): Promise<MyPrefs> {
  const prefs = await setMyPrefs({ routine_reminders: false });
  if (opts.unsubscribe) await unsubscribePush().catch(() => false);
  return prefs;
}
