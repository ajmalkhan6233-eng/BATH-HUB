// BATHCO COMMAND service worker — offline cache for static shell only.
// API requests (/api/*) always go to the network (live data + auth cookies).
//
// v2 (2026-07-05): the shell (HTML/JS/CSS) is now network-first, not
// cache-first. The old strategy (`cached || networkFetch`) served whatever
// was cached IMMEDIATELY and only updated the cache in the background for
// NEXT time - on an actively-developed app, every returning visitor was
// permanently exactly one deploy behind whatever was actually live (this is
// what caused "still seeing the old theme" even after a real code change
// and a normal page reload). Network-first fixes that: try the network,
// and only fall back to cache if the network genuinely fails (offline).
// CACHE_NAME bumped so browsers with the old v1 worker installed pick up
// this fix (their `activate` handler deletes any cache that isn't the
// current CACHE_NAME).
const CACHE_NAME = 'bathco-command-v4';
const STATIC_ASSETS = [
  '/owner',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — always live data, requires session cookie.
  if (url.pathname.startsWith('/api/')) return;
  // Never cache the sign-in / first-run pages.
  if (url.pathname === '/setup.html' || url.pathname === '/setup') return;

  // Only handle same-origin GET requests for the static shell.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
