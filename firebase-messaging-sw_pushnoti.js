// ============================================================
// firebase-messaging-sw.js
// JSJC Smart Booking App — Firebase Cloud Messaging Service Worker
// Firebase Project: jsjc-booking-app  |  Sender ID: 92282421131
//
// DEPLOYMENT:
//   Place this file at the ROOT of your GitHub Pages repo so it
//   is served from:  https://yourdomain.com/firebase-messaging-sw.js
//   It must be at the root — NOT inside a subfolder — for the
//   service worker scope to cover the full application.
//
// Replace VAPID_KEY below with your actual VAPID key from:
//   Firebase Console → Project Settings → Cloud Messaging
//   → Web Push certificates → Key pair
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// ── Firebase config ──────────────────────────────────────────
firebase.initializeApp({
  apiKey:            "AIzaSyC8csUtOBd8GY6vK3QmZXB1kjY46ijj8yw",
  authDomain:        "jsjc-booking-app.firebaseapp.com",
  projectId:         "jsjc-booking-app",
  storageBucket:     "jsjc-booking-app.firebasestorage.app",
  messagingSenderId: "92282421131",
  appId:             "1:92282421131:web:f08880ca301ef1afbcf98e"
});

const messaging = firebase.messaging();

// ── Background message handler ───────────────────────────────
// Fires when a push message arrives and the app is in the
// background, minimised, or the tab is closed.
messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM SW] Background message received:', payload);

  const title = (payload.notification && payload.notification.title)
    || (payload.data && payload.data.title)
    || 'JSJC Smart Booking App';

  const body = (payload.notification && payload.notification.body)
    || (payload.data && payload.data.body)
    || 'You have a new notification.';

  const icon  = (payload.notification && payload.notification.icon)
    || '/icon-192.png';

  const click = (payload.fcmOptions && payload.fcmOptions.link)
    || (payload.data && payload.data.click_action)
    || '/';

  const notificationOptions = {
    body:    body,
    icon:    icon,
    badge:   '/icon-72.png',
    tag:     'jsjc-push-' + Date.now(),
    data:    { click_action: click },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  return self.registration.showNotification(title, notificationOptions);
});

// ── Notification click handler ───────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.click_action) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus an existing window if one is open
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
