// WOOS service-worker v5.2.3.1 (Base: v4.9.5+phase2-v0-shadow-backfill-hotfix-r1)
// Network-first / no stale app shell. This prevents broken cached index from causing infinite loading.

const CACHE_NAME = "woos-pwa-v5-2-3-1";

self.addEventListener("install", event => {
  self.skipWaiting();
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
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
