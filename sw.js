const CACHE = 'marathon-v1';
const FILES = ['./', 'index.html', 'style.css', 'plan.js', 'app.js', 'manifest.json', 'icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});
// Netz zuerst, damit Updates ankommen; Cache als Offline-Fallback
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
