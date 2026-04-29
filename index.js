// WOOS PWA Service Worker v4.7.28
// IMPORTANT:
// - Top UI logo remains existing: assets/logo.png
// - PWA app icon: assets/pwa-icon-192.png, assets/pwa-icon-512.png
// - Analyzer loading image: assets/loading-logo.png

const CACHE_NAME = "woos-pwa-v4-7-29-tracking-ui-fix";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/logo.png",
  "./assets/pwa-icon.png",
  "./assets/pwa-icon-192.png",
  "./assets/pwa-icon-512.png",
  "./assets/loading-logo.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, copy))
          .catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
