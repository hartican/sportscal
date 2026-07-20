const CACHE_NAME = "nothingSports-shell-v20";
const APP_SHELL = [
  "/",
  "/index.html",
  "/404.html",
  "/config/brand-copy.js",
  "/config/canonical-sports-taxonomy.js",
  "/config/profile-storage.js",
  "/config/selector-taxonomy.js",
  "/config/au-broadcast-weights.js",
  "/data/cwg-events.js",
  "/data/feed-meta.json",
  "/data/events.json",
  "/data/canonical/afl-nrl-2026.json",
  "/manifest.webmanifest",
  "/assets/brand/web/nothingsport-logo-day.png",
  "/assets/brand/web/nothingsport-logo-night.png",
  "/assets/brand/web/nothingsport-compact-icon-day.png",
  "/assets/brand/web/nothingsport-compact-icon-night.png",
  "/icons/nothingsport-helm-32.png",
  "/icons/nothingsport-helm-180.png",
  "/icons/nothingsport-helm-192.png",
  "/icons/nothingsport-helm-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("/index.html")))
  );
});
