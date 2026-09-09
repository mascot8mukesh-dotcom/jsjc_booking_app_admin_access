// ============================================================
// service-worker.js — JSJC Smart Booking App v97
// v97 FIX ISSUE 1: Added SKIP_WAITING message handler so the
// update handler in index.html can activate new SW immediately
// on next page load without requiring manual hard-refresh.
// ============================================================

const CACHE_NAME = 'jsjc-app-v97';

// Files to cache for offline PWA functionality
const PRECACHE_URLS = [
  './',
  './manifest.json'
  // index.html itself is NOT pre-cached — it must always be fetched fresh
  // from the server so SW updates are detected on every load.
];

// ── Install: pre-cache shell assets ─────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Installing v97');
  // v97 FIX: Do NOT call skipWaiting() here automatically.
  // We wait for the SKIP_WAITING message from index.html so the
  // page can control WHEN the new SW activates (after prompting user or
  // on next natural navigation). Calling skipWaiting() immediately on
  // install can cause partial updates mid-session.
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
  console.log('[SW] Activating v97');
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
      // Take control of all open clients immediately after activation
      return clients.claim();
    })
  );
});

// ── Fetch: network-first strategy ────────────────────────────
// Always try the network first. On failure, serve from cache.
// This ensures users always get the latest version when online,
// while still being able to use the app offline.
self.addEventListener('fetch', function(event) {
  // Only handle GET requests; skip cross-origin requests
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cache successful responses for offline use
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // Network failed — try cache
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // Last resort: return a simple offline message for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./');
          }
        });
      })
  );
});

// ── Message: SKIP_WAITING ─────────────────────────────────────
// v97 FIX ISSUE 1: The index.html update handler posts this message
// when it detects a new SW in the 'installed'/'waiting' state.
// We call skipWaiting() ONLY when explicitly requested — not automatically
// on install — so mid-session disruption is avoided.
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING — activating new version');
    self.skipWaiting();
  }
});
