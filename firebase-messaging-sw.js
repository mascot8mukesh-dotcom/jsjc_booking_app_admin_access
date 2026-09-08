// ============================================================
// firebase-messaging-sw.js
// JSJC Smart Booking App — v96.1 v9
// Deploy this file at the ROOT of your GitHub Pages repository.
// It MUST be served from the same origin as the app.
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// ── Firebase config — must match exactly what is in index.html ──────────────
const FIREBASE_CONFIG = {
  apiKey           : "AIzaSyD3GVbVRLPMGJEwnJkZCjFRuQ1-OSmMk_s",
  authDomain       : "jsjc-booking-app.firebaseapp.com",
  projectId        : "jsjc-booking-app",
  storageBucket    : "jsjc-booking-app.firebasestorage.app",
  messagingSenderId: "92282421131",
  appId            : "1:92282421131:web:f57b394fb1c0a918f71b9c"
};

// ── Initialise Firebase ──────────────────────────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();

// ── Background message handler ───────────────────────────────────────────────
// Fires when the app is in the background, closed, or the tab is not focused.
// The browser delivers the push; this handler shows the notification popup.
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  var title = (payload.notification && payload.notification.title)
    || (payload.data && payload.data.title)
    || '🔔 JSJC Booking Update';

  var body = (payload.notification && payload.notification.body)
    || (payload.data && payload.data.body)
    || '';

  var icon  = (payload.notification && payload.notification.icon)
    || '/icon-192.png';

  var badge = '/icon-72.png';

  // Build action URL — deep-link to the relevant booking if bookingId is present
  var bookingId = (payload.data && payload.data.bookingId) || null;
  var clickUrl  = self.location.origin + '/';

  var notifOptions = {
    body         : body,
    icon         : icon,
    badge        : badge,
    tag          : 'jsjc-booking-' + (bookingId || Date.now()),
    renotify     : true,
    requireInteraction: false,
    data         : { url: clickUrl, bookingId: bookingId }
  };

  return self.registration.showNotification(title, notifOptions);
});

// ── Notification click handler ───────────────────────────────────────────────
// Opens (or focuses) the app when the user taps the notification.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var targetUrl = (event.notification.data && event.notification.data.url)
    || self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(windowClients) {
        // If a tab with the app is already open, focus it
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Service Worker lifecycle ─────────────────────────────────────────────────
// Skip waiting so the new SW activates immediately on deploy.
self.addEventListener('install', function(event) {
  console.log('[firebase-messaging-sw.js] Installed v96.1-v9');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[firebase-messaging-sw.js] Activated v96.1-v9');
  event.waitUntil(clients.claim());
});
