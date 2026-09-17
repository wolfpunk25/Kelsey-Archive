// App-shell cache only. Firestore's own network calls (and anything
// cross-origin) are left untouched - this just lets the UI open offline.
//
// Network-first: always try to fetch the latest version when online, and
// only fall back to the cached copy when the network fails (offline). This
// matters because workers install this as a PWA - the app shell must never
// go stale just because it opened successfully once before.

const CACHE_NAME = 'kelsey-archive-v4';
const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css?v=3',
  'js/app.js?v=3',
  'js/zones.js?v=3',
  'js/floorplan.js?v=3',
  'js/firebase-config.js?v=3',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        SHELL_FILES.map(url => fetch(url, { cache: 'reload' }).then(resp => cache.put(url, resp)))
      ))
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
    fetch(event.request).then(resp => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
      }
      return resp;
    }).catch(() => caches.match(event.request))
  );
});
