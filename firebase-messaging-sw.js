/* JSJC — firebase-messaging-sw.js  (RETIRED STUB)
 * Push notifications were removed in N21. Old phones may still hold the previous Firebase worker; this stub replaces it,
 * clears its caches and unregisters itself. Optional: deploy it next to service-worker.js, then you can delete it after a few weeks. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return /firebase|fcm|messaging/i.test(k); }).map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();   // the app re-registers service-worker.js on its next load
  })());
});
