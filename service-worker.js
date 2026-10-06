/* ============================================================================
 * JSJC Smart Booking App — service-worker.js        (matches app builds V99 N29+)
 * Registered by the app as:  navigator.serviceWorker.register('service-worker.js')
 *
 * What the app expects from this file (see the registration block near the end of the HTML):
 *   - message {type:'SKIP_WAITING'}  -> activate immediately; the page then reloads once on 'controllerchange'
 *   - it must NEVER serve a stale app page, and must NEVER touch Supabase / auth / API traffic
 *
 * Strategy
 *   page loads (navigations) : NETWORK-FIRST, HTTP cache bypassed -> a new deploy is seen on the very next open;
 *                              cached copy is used only when offline
 *   same-origin files        : stale-while-revalidate (icons, manifest, favicon)
 *   CDN scripts / fonts      : stale-while-revalidate (Chart.js etc. keep working offline)
 *   everything else          : NOT intercepted (Supabase REST/RPC/auth, Firebase, POST/PATCH/DELETE, range requests)
 *
 * Push notifications are retired in N21+, so there is intentionally no 'push' handler.
 * HOW TO DEPLOY: put this file in the SAME folder as the app HTML (same scope). Change VERSION below on every deploy
 * if you want old caches purged immediately (freshness does not depend on it, because pages are network-first).
 * ========================================================================== */
const VERSION = 'v99-n29';
const SHELL_CACHE   = 'jsjc-shell-'   + VERSION;
const RUNTIME_CACHE = 'jsjc-runtime-' + VERSION;
const KEEP = [SHELL_CACHE, RUNTIME_CACHE];

// Best-effort: files that 404 are simply skipped.
const PRECACHE = ['./', 'manifest.json', 'favicon.ico', 'icon-192.png', 'icon-512.png'];

const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.tailwindcss.com', 'code.jquery.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NEVER_PATHS = ['/rest/v1/', '/auth/v1/', '/storage/v1/', '/functions/v1/', '/realtime/v1/'];

/* ---- request classification (pure; unit-tested) ---- */
function classify(req, selfOrigin) {
  if (req.method !== 'GET') return 'skip';
  var url; try { url = new URL(req.url); } catch (e) { return 'skip'; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'skip';
  if (req.headers && req.headers.has && req.headers.has('range')) return 'skip';
  for (var i = 0; i < NEVER_PATHS.length; i++) if (url.pathname.indexOf(NEVER_PATHS[i]) !== -1) return 'skip';
  if (/(^|\.)supabase\.(co|in)$/.test(url.hostname)) return 'skip';
  if (url.origin !== selfOrigin) return CDN_HOSTS.indexOf(url.hostname) !== -1 ? 'cdn' : 'skip';
  if (req.mode === 'navigate' || (req.destination === 'document')) return 'navigate';
  return 'static';
}

/* ---- lifecycle ---- */
self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(PRECACHE.map(function (u) {
      return cache.add(new Request(u, { cache: 'reload' })).catch(function () { /* missing optional file */ });
    }));
    // No automatic skipWaiting(): the page posts SKIP_WAITING when it is ready to switch (avoids reloading mid-booking).
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const names = await caches.keys();
    await Promise.all(names.filter(function (n) { return KEEP.indexOf(n) === -1; }).map(function (n) { return caches.delete(n); })); // purge every older build
    // Intentionally no clients.claim(): avoids a needless reload on the very first install.
  })());
});

self.addEventListener('message', function (event) {
  const d = event.data || {};
  if (d.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (d.type === 'GET_VERSION' && event.source) { event.source.postMessage({ type: 'VERSION', version: VERSION }); return; }
  if (d.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
      .then(function () { if (event.source) event.source.postMessage({ type: 'CACHES_CLEARED' }); }));
  }
});

/* ---- strategies ---- */
async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req, { cache: 'no-store' });                 // bypass the browser HTTP cache: always the newest deploy
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (err) {                                                         // offline
    const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./')) || (await cache.match('index.html'));
    if (hit) return hit;
    return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:32px;text-align:center"><h2>You are offline</h2><p>JSJC Smart Booking needs a connection the first time. Reconnect and reload.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const refresh = fetch(req).then(function (res) {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(function () { return null; });
  return cached || (await refresh) || new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', function (event) {
  const kind = classify(event.request, self.location.origin);
  if (kind === 'skip') return;                                            // let the browser handle it normally
  if (kind === 'navigate') event.respondWith(networkFirst(event.request));
  else event.respondWith(staleWhileRevalidate(event.request, kind === 'cdn' ? RUNTIME_CACHE : SHELL_CACHE));
});
