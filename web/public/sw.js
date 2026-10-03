/* global self, caches, fetch, URL */
const CACHE = 'weggeef-resident-offline-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/offline.html', '/offline.css'])));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('weggeef-resident-offline-') && key !== CACHE).map((key) => caches.delete(key)))));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin && url.pathname === '/offline.css') {
    event.respondWith(caches.match('/offline.css').then((cached) => cached || fetch(event.request)));
    return;
  }
  // Deliberately do not intercept APIs, private routes, map tiles or asset requests.
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname !== '/') return;
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});
