// App-shell cache only. Firestore's own network calls (and anything
// cross-origin) are left untouched - this just lets the UI open offline.

const CACHE_NAME = 'kelsey-archive-v1';
const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/zones.js',
  'js/floorplan.js',
  'js/firebase-config.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
