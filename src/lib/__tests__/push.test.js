import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// supabase client stub (signed-in employee).
const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt' } } })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1', app_metadata: { company_id: 'c1' } } } })),
      onAuthStateChange: vi.fn(),
    },
    rpc,
    from: vi.fn(),
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
  })),
}));

// A real-looking VAPID public key (65 bytes, 0x04 first).
const KEY_BYTES = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : i));
const KEY = btoa(String.fromCharCode(...KEY_BYTES)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const OTHER_KEY = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : 200 - i)).buffer;

function fakeSubscription(endpoint = 'https://push.example/abc', key = KEY_BYTES.buffer) {
  return {
    endpoint,
    options: { applicationServerKey: key },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) } }),
    unsubscribe: vi.fn(async () => true),
  };
}

let env;
function setEnv({ ua = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130', standalone = false, sw = true, push = true,
                  notification = true, permission = 'default', existing = null, registered = true } = {}) {
  const pushManager = {
    getSubscription: vi.fn(async () => env.current),
    subscribe: vi.fn(async (opts) => { env.subscribedWith = opts; env.current = fakeSubscription('https://push.example/new'); return env.current; }),
  };
  const reg = { active: {}, pushManager };
  env = {
    current: existing, reg, pushManager, subscribedWith: null,
    sw: {
      getRegistration: vi.fn(async () => (registered ? reg : undefined)),
      register: vi.fn(async () => reg),
      ready: Promise.resolve(reg),
    },
  };
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'platform', { value: /iPhone/.test(ua) ? 'iPhone' : 'Linux x86_64', configurable: true });
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true });
  if (sw) Object.defineProperty(navigator, 'serviceWorker', { value: env.sw, configurable: true });
  else delete navigator.serviceWorker;
  if (push) window.PushManager = function PushManager() {}; else delete window.PushManager;
  if (notification) {
    window.Notification = { permission, requestPermission: vi.fn(async () => env.grant ?? 'granted') };
  } else {
    delete window.Notification;
  }
  window.matchMedia = vi.fn((q) => ({ matches: standalone && q.includes('standalone'), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

let lib;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', KEY);
  rpc.mockImplementation(async (name, args) => ({ data: { name, args }, error: null }));
  delete window.Capacitor;
  setEnv();
  lib = await import('../push.ts');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
});

describe('getPushSupport', () => {
  it('Chrome on Android / desktop with a key → supported', () => {
    expect(lib.getPushSupport()).toEqual({ supported: true, reason: null, ios: false, standalone: false });
    expect(lib.isPushSupported()).toBe(true);
  });

  it('iPhone Safari tab → add to Home Screen first', () => {
    setEnv({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1' });
    expect(lib.getPushSupport()).toMatchObject({ supported: false, reason: 'ios_needs_install', ios: true, standalone: false });
  });

  it('iPhone app on the Home Screen (iOS 16.4+) → supported', () => {
    setEnv({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)', standalone: true });
    expect(lib.getPushSupport()).toMatchObject({ supported: true, ios: true, standalone: true });
  });

  it('old iOS home-screen app without the Push API', () => {
    setEnv({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', standalone: true, push: false });
    expect(lib.getPushSupport().reason).toBe('no_push_manager');
  });

  it('no service worker / no Notification / native app / no key', () => {
    setEnv({ sw: false });
    expect(lib.getPushSupport().reason).toBe('no_service_worker');
    setEnv({ notification: false });
    expect(lib.getPushSupport().reason).toBe('no_notification');
    setEnv();
    window.Capacitor = { isNativePlatform: () => true };
    expect(lib.getPushSupport().reason).toBe('native_app');
    delete window.Capacitor;
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    expect(lib.getVapidPublicKey()).toBeNull();
    expect(lib.getPushSupport().reason).toBe('no_vapid_key');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url without padding', () => {
    expect(Array.from(lib.urlBase64ToUint8Array(KEY))).toEqual(Array.from(KEY_BYTES));
    expect(Array.from(lib.urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });
});

describe('subscribePush', () => {
  it('asks permission on the tap, subscribes with our key and saves it with the language', async () => {
    const saved = await lib.subscribePush({ lang: 'ar' });
    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(env.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(env.subscribedWith.userVisibleOnly).toBe(true);
    expect(Array.from(env.subscribedWith.applicationServerKey)).toEqual(Array.from(KEY_BYTES));
    expect(rpc).toHaveBeenCalledWith('save_push_subscription', {
      p_sub: expect.objectContaining({
        endpoint: 'https://push.example/new',
        keys: { p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) },
        lang: 'ar',
        user_agent: expect.stringContaining('Chrome'),
      }),
    });
    expect(saved.name).toBe('save_push_subscription');
  });

  it('reuses an existing subscription made with our key', async () => {
    setEnv({ permission: 'granted', existing: fakeSubscription() });
    await lib.subscribePush();
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
    expect(env.pushManager.subscribe).not.toHaveBeenCalled();
    expect(rpc.mock.calls[0][1].p_sub.endpoint).toBe('https://push.example/abc');
  });

  it('replaces a subscription made with another VAPID key', async () => {
    const old = fakeSubscription('https://push.example/old', OTHER_KEY);
    setEnv({ permission: 'granted', existing: old });
    await lib.subscribePush();
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(env.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });

  it('registers /sw.js when the page has no worker yet (dev build)', async () => {
    setEnv({ registered: false });
    await lib.subscribePush();
    expect(env.sw.register).toHaveBeenCalledWith('/sw.js');
  });

  it('blocked → push_denied; prompt closed → push_dismissed; nothing saved', async () => {
    setEnv({ permission: 'denied' });
    await expect(lib.subscribePush()).rejects.toMatchObject({ code: 'push_denied' });
    setEnv();
    env.grant = 'default';
    await expect(lib.subscribePush()).rejects.toMatchObject({ code: 'push_dismissed' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('iPhone tab → push_unsupported with the reason; missing key → push_no_key', async () => {
    setEnv({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' });
    await expect(lib.subscribePush()).rejects.toMatchObject({ code: 'push_unsupported', reason: 'ios_needs_install' });
    setEnv();
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    await expect(lib.subscribePush()).rejects.toMatchObject({ code: 'push_no_key' });
  });

  it('a failed save is thrown as-is', async () => {
    const err = { message: 'invalid_subscription', code: '22023' };
    rpc.mockResolvedValueOnce({ data: null, error: err });
    await expect(lib.subscribePush()).rejects.toBe(err);
  });
});

describe('unsubscribe / state / refresh', () => {
  it('unsubscribePush forgets the endpoint on the server and in the browser', async () => {
    const sub = fakeSubscription();
    setEnv({ permission: 'granted', existing: sub });
    expect(await lib.unsubscribePush()).toBe(true);
    expect(rpc).toHaveBeenCalledWith('delete_push_subscription', { p_endpoint: 'https://push.example/abc' });
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it('unsubscribePush with no subscription does nothing', async () => {
    expect(await lib.unsubscribePush()).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('getPushState names each case', async () => {
    expect((await lib.getPushState()).state).toBe('prompt');
    setEnv({ permission: 'granted' });
    expect((await lib.getPushState()).state).toBe('unsubscribed');
    setEnv({ permission: 'granted', existing: fakeSubscription() });
    expect(await lib.getPushState()).toMatchObject({ state: 'subscribed', endpoint: 'https://push.example/abc', permission: 'granted' });
    setEnv({ permission: 'denied' });
    expect((await lib.getPushState()).state).toBe('denied');
    setEnv({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' });
    expect(await lib.getPushState()).toMatchObject({ state: 'unsupported', support: { reason: 'ios_needs_install' } });
  });

  it('refreshPushSubscription re-saves silently, and never prompts', async () => {
    expect(await lib.refreshPushSubscription()).toBeNull();
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
    setEnv({ permission: 'granted', existing: fakeSubscription() });
    await lib.refreshPushSubscription({ lang: 'en' });
    expect(rpc).toHaveBeenCalledWith('save_push_subscription', { p_sub: expect.objectContaining({ lang: 'en' }) });
  });
});

describe('Remind me switch', () => {
  it('on: subscribe, then routine_reminders = true', async () => {
    await lib.enableRoutineReminders({ lang: 'en' });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['save_push_subscription', 'set_my_prefs']);
    expect(rpc).toHaveBeenLastCalledWith('set_my_prefs', { p_patch: { routine_reminders: true } });
  });

  it('on: a refused permission never turns the pref on', async () => {
    setEnv({ permission: 'denied' });
    await expect(lib.enableRoutineReminders()).rejects.toMatchObject({ code: 'push_denied' });
    expect(rpc).not.toHaveBeenCalledWith('set_my_prefs', expect.anything());
  });

  it('off: pref off; the device stays subscribed unless asked', async () => {
    const sub = fakeSubscription();
    setEnv({ permission: 'granted', existing: sub });
    await lib.disableRoutineReminders();
    expect(rpc).toHaveBeenCalledWith('set_my_prefs', { p_patch: { routine_reminders: false } });
    expect(sub.unsubscribe).not.toHaveBeenCalled();
    await lib.disableRoutineReminders({ unsubscribe: true });
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
});
