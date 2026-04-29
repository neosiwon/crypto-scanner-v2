// WOOS PWA Service Worker v4.7.25
const CACHE_NAME = "woos-pwa-v4-7-25";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/pwa-icon.jpg",
  "./assets/woos_roding.jpg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request);
    })
  );
});
