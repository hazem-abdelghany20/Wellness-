/* Wellness+ service worker — v4.
 * Strategy:
 *   - precache: HTML entry + manifest + icons + offline page at install time.
 *   - runtime: cache-first for hashed assets (JS / CSS / fonts / images).
 *   - runtime: network-first with cache fallback for everything else.
 *   - never cache /rest/v1/ or /functions/v1/ (Supabase API + edge fns).
 *   - bump VERSION whenever sw.js changes to force precache refresh.
 * Push (sprint 3): routine reminders + HR broadcasts sent by the
 * send-reminders edge function as JSON {title, body, url, tag, lang, dir}.
 * A tap focuses an open app window (or opens one) at `url` and posts
 * {type: 'OPEN_URL', url} to it so the app can switch tabs.
 */
const VERSION = 'wellness-v4';
const PRECACHE = `${VERSION}-precache`;
const RUNTIME  = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
  '/badge-96.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k !== PRECACHE && k !== RUNTIME)
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

const isAssetExtension = (pathname) =>
  /\.(js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|json)(\?|$)/.test(pathname);

const isApiCall = (url) =>
  /\/rest\/v1\//.test(url.pathname)
  || /\/functions\/v1\//.test(url.pathname)
  || /\/auth\/v1\//.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Skip cross-origin auth/api requests entirely.
  if (isApiCall(url)) return;

  // Cross-origin static assets (fonts.googleapis.com, etc.) — runtime cache.
  if (url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Same-origin static assets: cache-first.
  if (isAssetExtension(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Same-origin HTML / navigation: network-first with cache fallback.
  event.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type !== 'opaque') {
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    // Last-ditch fallback for asset failures: nothing to do.
    throw e;
  }
}

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Final fallback: branded offline page, then precached shell.
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    const shell = await caches.match('/index.html');
    if (shell) return shell;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && (res.status === 200 || res.type === 'opaque')) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  return cached || network || fetch(req);
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ── Web Push ─────────────────────────────────────────────────

const NOTIFICATION_ICON = '/icon-192.png';
const NOTIFICATION_BADGE = '/badge-96.png';  // white + on transparent (Android status bar)

function parsePush(event) {
  if (!event.data) return {};
  try { return event.data.json() || {}; } catch {
    try { return { body: event.data.text() }; } catch { return {}; }
  }
}

// Only our own pages: a relative URL, resolved against this origin.
function safeUrl(url) {
  try {
    const u = new URL(url || '/', self.location.origin);
    return u.origin === self.location.origin ? u.href : self.location.origin + '/';
  } catch {
    return self.location.origin + '/';
  }
}

self.addEventListener('push', (event) => {
  const p = parsePush(event);
  const title = String(p.title || 'Wellness+').slice(0, 120);
  const options = {
    body: String(p.body || '').slice(0, 400),
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    tag: p.tag || undefined,
    renotify: false,
    lang: p.lang || undefined,
    dir: p.dir || 'auto',
    data: { url: safeUrl(p.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((c) => new URL(c.url).origin === self.location.origin);
    if (win) {
      try { await win.focus(); } catch { /* focus can be refused */ }
      // The employee app handles OPEN_URL itself (and cleans its address bar),
      // so only navigate a window that is on another page (HR / admin / guide).
      const onEmployeeApp = ['/', '/index.html'].includes(new URL(win.url).pathname);
      if (onEmployeeApp) { win.postMessage({ type: 'OPEN_URL', url }); return; }
      try { if ('navigate' in win) { await win.navigate(url); return; } } catch { /* uncontrolled */ }
      await self.clients.openWindow(url);
      return;
    }
    await self.clients.openWindow(url);
  })());
});

// The push service rotated the subscription: re-subscribe with the same key
// and tell open pages, which save it (refreshPushSubscription in
// src/lib/push.ts) — the worker has no session to call the API itself.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const old = event.oldSubscription;
      const key = old && old.options && old.options.applicationServerKey;
      if (key) await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    } catch { /* the app re-subscribes on next open */ }
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach((c) => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
  })());
});
