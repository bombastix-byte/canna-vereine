// Service Worker der Vereins-App.
//  - Offline-Grundgeruest: Seitenaufrufe network-first mit Offline-Fallback.
//    (Gehashte CSS/JS bewusst NICHT vorab gecacht, um keine veralteten
//     Assets auszuliefern.)
//  - Push-Benachrichtigungen: zeigt eingehende Nachrichten, Klick oeffnet Ziel.
const CACHE = 'verein-v1';
const OFFLINE = '/offline';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Nur Seitenaufrufe (Navigationen) behandeln: online normal, offline Fallback.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  }
});

self.addEventListener('push', (e) => {
  let daten = { titel: 'Vereins-App', text: '', url: '/mitglieder/bereich' };
  try {
    if (e.data) daten = Object.assign(daten, e.data.json());
  } catch (_) {
    if (e.data) daten.text = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(daten.titel, {
      body: daten.text,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: daten.url || '/mitglieder/bereich' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const ziel = (e.notification.data && e.notification.data.url) || '/mitglieder/bereich';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if ('focus' in c) {
          c.navigate(ziel);
          return c.focus();
        }
      }
      return self.clients.openWindow(ziel);
    }),
  );
});
