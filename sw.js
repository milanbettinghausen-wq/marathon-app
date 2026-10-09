const CACHE = 'marathon-v3';
const FILES = ['./', 'index.html', 'style.css', 'style-v3.css', 'util.js', 'state.js', 'engine.js', 'coach.js', 'importer.js', 'strava.js', 'ui.js', 'gym.js', 'app.js', 'manifest.json', 'icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Netz zuerst, damit Updates ankommen; Cache als Offline-Fallback. Nur die eigenen Dateien, nie Strava-Aufrufe.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
