// Bath Hub owner app: service worker v5 (offline shell + saved copies of data).
//  - Static files (/owner, every screen, scripts, fonts, icons): precached, network-first, cache fallback.
//  - /api GET: network-first; when the network is down the LAST good answer is served and marked  X-Saved-Copy: 1
//    (pages show "saved copy"). Login, setup, auth, system and admin routes are never cached.
//  - /api writes (POST/PUT/PATCH/DELETE) are never touched here: the page's offline queue (offline-queue.js) handles them.
//  - Versioned caches; old versions are deleted on activate; the data cache is wiped on logout (message 'clear-api').
const VERSION = 'v11';
const STATIC_CACHE = 'apex-static-' + VERSION;
const API_CACHE = 'apex-api-' + VERSION;

const PRECACHE = [
  '/owner', '/manifest.json', '/bathhub-design.css', '/bathhub-logo.js', '/bathhub-theme.js', '/bathhub-icons.js', '/bathhub-a11y.js', '/brand/icon-192.png', '/brand/icon-512.png', '/brand/favicon-32.png', '/brand/logo-bh-transparent.png', '/fonts/inter.css', '/fonts/inter-latin.woff2', '/vendor/chart.umd.min.js',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png',
  '/salary.js', '/tile-gallery.js', '/tiles/stone-beige.webp', '/tiles/stone-pink.webp', '/tiles/stone-grey.webp', '/tiles/stone-beige-thumb.webp', '/tiles/stone-pink-thumb.webp', '/tiles/stone-grey-thumb.webp', '/website-editor.js', '/document-inbox.js', '/attach-widget.js', '/pos-picker.js', '/offline-queue.js',
  '/pos_billing.html', '/investor_loans.html', '/money-control.html', '/sale_commissions.html', '/settings.html', '/cheque_register.html', '/documents.html',
  '/customers.html', '/credit_aging.html', '/quotations.html', '/purchasing.html', '/accounting.html', '/audit_accounting.html',
  '/staff.html', '/reports_analytics.html', '/labels.html', '/assistant.html',
  '/admin_users.html', '/admin_audit.html', '/admin_settings.html', '/admin_corrections.html', '/admin_system.html',
];

// never cached (sign-in, first-run, security, admin data)
const NO_CACHE_API = /^\/api\/(login|logout|setup|auth|system|admin-core|app-settings|sync|users)(\/|$|\?)/;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(PRECACHE.map(async (url) => {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (res.ok && !res.redirected) await cache.put(url, res);        // a missing file or a sign-in redirect is simply skipped
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, API_CACHE]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'clear-api') event.waitUntil(caches.delete(API_CACHE));
});

async function tellClients(msg) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;       // writes and other sites: not ours
  if (url.pathname === '/setup.html' || url.pathname === '/setup') return;        // first-run page: never cached
  if (url.pathname === '/site' || url.pathname.startsWith('/website/')) return;      // public website: the owner app's saved copies never touch it

  if (url.pathname.startsWith('/api/')) {
    if (NO_CACHE_API.test(url.pathname + url.search)) return;
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const copy = res.clone(); caches.open(API_CACHE).then(c => c.put(req, copy)); }
        return res;
      } catch (e) {
        const cached = await caches.match(req, { cacheName: API_CACHE });
        if (cached) {
          const headers = new Headers(cached.headers); headers.set('X-Saved-Copy', '1');
          tellClients({ type: 'saved-copy', url: url.pathname });
          return new Response(await cached.blob(), { status: cached.status, statusText: cached.statusText, headers });
        }
        return new Response(JSON.stringify({ error: 'You are offline and there is no saved copy of this yet.', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // pages, scripts, fonts, images: network first, saved copy when offline
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(STATIC_CACHE).then(c => c.put(req, copy)); }
      return res;
    } catch (e) {
      const cached = await caches.match(req, { cacheName: STATIC_CACHE, ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') { const shell = await caches.match('/owner', { cacheName: STATIC_CACHE }); if (shell) return shell; }
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});