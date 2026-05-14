/* Wellness+ service worker — v2.
 * Strategy:
 *   - precache: HTML entry + manifest + icons + offline page at install time.
 *   - runtime: cache-first for hashed assets (JS / CSS / fonts / images).
 *   - runtime: network-first with cache fallback for everything else.
 *   - never cache /rest/v1/ or /functions/v1/ (Supabase API + edge fns).
 *   - bump VERSION whenever sw.js changes to force precache refresh.
 */
const VERSION = 'wellness-v2';
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
