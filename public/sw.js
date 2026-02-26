self.addEventListener('push', function(event) {
  let data = { title: '🔥 אירוע חדש — ליתיום', body: 'נכנס אירוע חדש למערכת', url: '/' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body || 'נכנס אירוע חדש למערכת',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    dir: 'rtl',
    lang: 'he',
    tag: 'lithium-incident',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '📋 פתח דשבורד' },
      { action: 'dismiss', title: '❌ סגור' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || '🔥 אירוע חדש — ליתיום', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('lithium-dashboard') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
