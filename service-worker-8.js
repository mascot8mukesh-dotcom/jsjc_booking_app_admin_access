// ============================================================
// service-worker.js — JSJC Smart Booking App v99 (N42)
// Same update flow as v98 (new SW installs, page posts SKIP_WAITING, page reloads on controllerchange).
//
// What changed from v98 (all fixes for "equipment shows old/cached data after a GitHub deploy"):
//   1. CACHE_NAME bumped to 'jsjc-app-v99-n39b' -> browsers see a changed SW file and update.
//   2. Page / manifest are fetched through a CLEAN Request (cache:'no-store', redirect:'follow').
//      v98 cloned the navigation request; cloning a navigate request keeps redirect:'manual',
//      which can make the fetch fail on GitHub Pages -> the catch() then served the OLD cached page.
//   3. The cache is now ONLY an offline fallback. It is never read while the network works.
//   4. Never touches or stores: Supabase / any cross-origin call, /rest/v1/, /auth/, /functions/,
//      /storage/, URLs with a query string (e.g. ?_vc= update checks), non-200 or opaque responses.
//   5. cache name is scoped per repo, so Admin and Prod no longer delete each other's cache.
//   6. install now calls skipWaiting() itself (no longer depends on the page sending SKIP_WAITING).
//   7. activate: deletes every old cache, claims clients, and reloads open tabs ONCE so devices that
//      were stuck on an old cached shell jump to the fresh page (the app then clears its own
//      localStorage catalogue cache because JSJC_VERSION changed).
// ============================================================

// Cache storage is shared by EVERY repo on mascot8mukesh.github.io (Admin, Prod, old apps).
// So the cache name includes this app's own scope, and activate only deletes THIS app's old caches.
const SCOPE_ID     = self.registration.scope.replace(/[^a-z0-9]+/gi, '_');
const CACHE_PREFIX = 'jsjc-' + SCOPE_ID + '-';
const CACHE_NAME   = CACHE_PREFIX + 'v99-n42';

const PRECACHE_URLS = [
  './',
  './manifest.json'
  // index.html is fetched fresh on every load; the copy kept here is only for offline use.
];

function isShellRequest(request, url) {
  return request.mode === 'navigate' ||
         url.pathname.endsWith('.html') ||
         url.pathname.endsWith('/') ||
         url.pathname.endsWith('manifest.json');
}

// ── Install ─────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  console.log('[SW] Installing v99 N42');
  // v99 N41: activate immediately. Devices still running an OLD cached page never send SKIP_WAITING,
  // so the new worker used to sit in "waiting" forever while the old one kept serving the stale app.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(PRECACHE_URLS.map(function (u) {
        return fetch(new Request(u, { cache: 'no-store' }))
          .then(function (res) { if (res && res.status === 200) return cache.put(u, res); })
          .catch(function () { /* non-fatal */ });
      }));
    })
  );
});

// ── Activate: wipe old caches, take control, refresh open tabs once ──
self.addEventListener('activate', function (event) {
  console.log('[SW] Activating v99 N42');
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.filter(function (n) {
                                  // this app's older caches + the legacy shared 'jsjc-app-vNN' caches
                                  return n !== CACHE_NAME && (n.indexOf(CACHE_PREFIX) === 0 || n.indexOf('jsjc-app-') === 0);
                                })
                                .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (wins) {
        wins.forEach(function (w) {
          // Reload the tab so it shows the freshly deployed page, not the old one.
          try { w.navigate(w.url); } catch (e) { /* ignore */ }
        });
      })
  );
});

// ── Fetch: network-first, cache only as offline fallback ─────
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // Supabase, CDNs, Firebase: never intercepted
  if (/\/(rest|auth|functions|storage|realtime)\/v1\//.test(url.pathname)) return;  // API paths: never intercepted
  if (url.search) return;                                          // ?_vc= / ?v= checks: always straight to network

  var shell = isShellRequest(req, url);

  event.respondWith((async function () {
    try {
      var netReq = shell
        ? new Request(req.url, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' })
        : req;
      var res = await fetch(netReq);
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        // Keep ONE entry per page: store navigations under './' so offline fallback always finds it.
        var key = req.mode === 'navigate' ? './' : req;
        event.waitUntil(caches.open(CACHE_NAME).then(function (c) { return c.put(key, copy); }));
      }
      return res;
    } catch (err) {
      // Offline (or network error): fall back to the last good copy.
      var cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        var shellCopy = await caches.match('./');
        if (shellCopy) return shellCopy;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

// ── Message: SKIP_WAITING (unchanged) ────────────────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING — activating new version');
    self.skipWaiting();
  }
});
