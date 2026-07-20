const CACHE_NAME = "nothingSports-shell-v24";
const APP_SHELL = [
  "/",
  "/index.html",
  "/404.html",
  "/config/brand-copy.js",
  "/config/vector-assets.js",
  "/config/sport-domain-registry.js",
  "/config/canonical-sports-taxonomy.js",
  "/config/profile-storage.js",
  "/config/preference-system.js",
  "/config/enrichment-engine.js",
  "/config/card-lifecycle.js",
  "/config/reminder-engine.js",
  "/config/soundtrack.js",
  "/config/selector-taxonomy.js",
  "/config/au-broadcast-weights.js",
  "/data/cwg-events.js",
  "/data/feed-meta.json",
  "/data/events.json",
  "/data/canonical/afl-nrl-2026.json",
  "/schemas/preference-graph.schema.json",
  "/schemas/enriched-event.schema.json",
  "/schemas/derived-card-cache.schema.json",
  "/manifest.webmanifest",
  "/assets/brand/web/nothingsport-logo-day.png",
  "/assets/brand/web/nothingsport-logo-night.png",
  "/assets/brand/web/nothingsport-compact-icon-day.png",
  "/assets/brand/web/nothingsport-compact-icon-night.png",
  "/assets/icons/sporticon/motorsports.svg",
  "/assets/icons/sporticon/rugby.svg",
  "/assets/icons/sporticon/tennis.svg",
  "/assets/icons/sporticon/soccer.svg",
  "/assets/icons/sporticon/cycling.svg",
  "/assets/icons/sporticon/golf.svg",
  "/assets/icons/sporticon/ski_and_snowboard.svg",
  "/assets/icons/sporticon/american_football.svg",
  "/assets/icons/sporticon/australian_football.svg",
  "/assets/icons/sporticon/basketball.svg",
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

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => "focus" in client);
      if (existing){
        existing.navigate?.(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })
  );
});
