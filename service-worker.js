const CACHE_NAME = "nothingsport-shell-v76";
const APP_SHELL = [
  "/",
  "/index.html",
  "/404.html",
  "/config/brand-copy.js",
  "/config/vector-assets.js",
  "/config/sport-domain-registry.js",
  "/config/canonical-sports-taxonomy.js",
  "/config/sport-context.js",
  "/config/sport-hubs.js",
  "/config/feed-refresh-lifecycle.js",
  "/config/profile-storage.js",
  "/config/product-events.js",
  "/config/user-state-sync.js",
  "/config/server-sync.js",
  "/config/preference-system.js",
  "/config/swipe-calibration.js",
  "/config/fine-tuning.js",
  "/config/rating-system.js",
  "/config/enrichment-engine.js",
  "/config/card-lifecycle.js",
  "/config/reminder-engine.js",
  "/config/soundtrack.js",
  "/config/selector-taxonomy.js",
  "/config/au-broadcast-weights.js",
  "/data/events.js",
  "/data/feed-meta.json",
  "/data/events.json",
  "/data/canonical/afl-nrl-2026.json",
  "/data/canonical/contexts.js",
  "/data/canonical/f1-context-2026.json",
  "/data/canonical/tennis-context-2026.json",
  "/data/canonical/cycling-context-2026.json",
  "/data/canonical/nba-context-2026.json",
  "/data/canonical/cwg-context-2026.json",
  "/schemas/preference-graph.schema.json",
  "/schemas/product-events.schema.json",
  "/schemas/user-state-patch.schema.json",
  "/schemas/enriched-event.schema.json",
  "/schemas/derived-card-cache.schema.json",
  "/schemas/sport-context.schema.json",
  "/manifest.webmanifest",
  "/assets/brand/web/nothingsport-logo.png",
  "/assets/brand/web/nothingsport-hero-logo.png",
  "/assets/brand/web/nothingsport-app-icon.png",
  "/assets/brand/web/nothingsport-social-preview.png",
  "/assets/audio/sb_skyscrapersamba_eq_lessdrums.mp3",
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
  "/icons/nothingsport-app-32.png",
  "/icons/nothingsport-app-180.png",
  "/icons/nothingsport-app-192.png",
  "/icons/nothingsport-app-512.png",
  "/icons/nothingsport-app-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(async keys => {
      await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
      await self.clients.claim();
    })
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith("/api/")){
    event.respondWith(fetch(event.request));
    return;
  }
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
