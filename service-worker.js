// JSJC Smart Booking App — service-worker.js
// v80.8: minimal registration-only service worker. This app talks live to
// Supabase for every booking/approval/issue/return action — caching those
// responses offline would risk showing stale equipment/booking state, which
// is worse than showing nothing. This worker exists ONLY to satisfy Chrome's
// installability requirement (a registered SW with a fetch handler is
// mandatory for the install prompt on Android — a manifest.json alone is not
// enough). It passes every request straight through to the network.
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
