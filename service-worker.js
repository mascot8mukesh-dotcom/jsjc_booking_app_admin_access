// ============================================================
// service-worker.js — JSJC Smart Booking App v98 (N38)
// Based on v97. Same structure and same update flow:
//   - new SW installs and WAITS; index.html posts SKIP_WAITING, then reloads on controllerchange.
// Changes from v97 (only these three):
//   1. CACHE_NAME bumped to 'jsjc-app-v98' so browsers see a changed SW file and update.
//   2. Page / manifest requests bypass the browser HTTP cache (cache:'no-store'), so a new
//      GitHub Pages deploy is picked up immediately instead of after the ~10 min CDN cache.
//   3. Only same-origin GET responses are cached; Supabase / API calls are never touched (unchanged rule, kept explicit).
// ============================================================

const CACHE_NAME = 'jsjc-app-v98';

const PRECACHE_URLS = [
  './',
  './manifest.json'
  // index.html itself is NOT pre-cached — it must always be fetched fresh.
];

// ── Install: pre-cache shell assets ─────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Installing v98');
  // No automatic skipWaiting() — the page requests it via SKIP_WAITING (same as v97).
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).catch(function(err) {
      console.warn('[SW] Pre-cache failed (non-fatal):', err.message);
    })
  );
});

// ── Activate: remove old caches ──────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating v98');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

// ── Fetch: network-first strategy ────────────────────────────
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;   // Supabase, Firebase, CDNs: never intercepted

  // Pages and manifest: skip the browser HTTP cache so new deployments show up at once.
  var isShell = event.request.mode === 'navigate' ||
                url.pathname.endsWith('.html') ||
                url.pathname.endsWith('/') ||
                url.pathname.endsWith('manifest.json');
  var netReq = isShell ? new Request(event.request, { cache: 'no-store' }) : event.request;

  event.respondWith(
    fetch(netReq)
      .then(function(response) {
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./');
          }
        });
      })
  );
});

// ── Message: SKIP_WAITING (unchanged from v97) ───────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING — activating new version');
    self.skipWaiting();
  }
});
