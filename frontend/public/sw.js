// Lakshya Smart Library — Service Worker for Web Push & PWA
const CACHE_NAME = 'lakshya-smart-library-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notification
self.addEventListener('push', (event) => {
  let notificationData = {
    title: '🔔 Lakshya Smart Library',
    body: 'You have a new library notification.',
    icon: '/Logo.png',
    badge: '/Logo.png',
    url: '/student/notifications',
  };

  if (event.data) {
    try {
      const json = event.data.json();
      notificationData = {
        ...notificationData,
        ...json,
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon || '/Logo.png',
    badge: notificationData.badge || '/Logo.png',
    vibrate: [200, 100, 200],
    tag: notificationData.tag || `lakshya-notice-${Date.now()}`,
    renotify: true,
    data: {
      url: notificationData.url || '/student/notifications',
      ...notificationData.data,
    },
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/student/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url && client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
