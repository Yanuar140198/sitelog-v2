// Service Worker for web push notifications.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const data = (() => { try { return event.data.json(); } catch { return { title: 'Sitelog', body: event.data?.text() ?? '' }; } })();
  event.waitUntil(self.registration.showNotification(data.title ?? 'Sitelog', {
    body: data.body ?? '',
    icon: '/icon.png',
    badge: '/badge.png',
    data: data.data ?? {},
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? '/app';
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    for (const c of clients) {
      if (c.url.includes(href)) return c.focus();
    }
    return self.clients.openWindow(href);
  }));
});
