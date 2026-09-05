const CACHE_NAME = "nothingsport-shell-v231-r2";
const APP_SHELL = [
  // Navigations already share /index.html below; do not download/cache its
  // million-byte HTML a second time under the root alias during installation.
  "/index.html",
  "/404.html",
  "/participate.html",
  "/admin.html",
  "/admin-comms.html",
  "/privacy.html",
  "/terms.html",
  "/assets/styles/nothingsport-foundation.css?v=231",
  "/assets/js/app-shell-runtime.js?v=231",
  "/config/admin-comms-workspace.js?v=218",
  "/config/marquee-live-renderer.js?v=218",
  "/config/brand-copy.js",
  "/config/vector-assets.js",
  "/config/national-team-identities.js?v=230",
  "/config/nsc-visual.js?v=218",
  "/config/card-identities.js",
  "/config/card-results.js",
  "/config/country-flags.js",
  "/config/sport-domain-registry.js",
  "/config/canonical-sports-taxonomy.js",
  "/config/sport-hierarchy.js",
  "/config/competition-classification.js?v=222",
  "/config/team-follow-catalogue.js",
  "/config/event-taxonomy-compat.js",
  "/config/preference-taxonomy.js",
  "/config/tennis-coverage.js",
  "/config/sport-context.js",
  "/config/sport-hubs.js",
  "/config/feed-refresh-lifecycle.js",
  "/config/loading-progress.js",
  "/config/profile-storage.js",
  "/config/disposable-storage.js",
  "/config/product-events.js",
  "/config/event-action-identity.js",
  "/config/optimistic-mutation.js",
  "/config/preference-reset-ui.js?v=218",
  "/config/user-state-sync.js",
  "/config/chat-contract.js",
  "/config/marquee-campaigns.js",
  "/config/server-sync.js",
  "/config/follow-first.js?v=222",
  "/config/feed-controls.js",
  "/config/ticketing.js",
  "/config/major-events.js?v=223",
  "/config/follow-feed-policy.js?v=230",
  "/config/football-directory.js",
  "/config/personalised-feed.js",
  "/config/source-trust.js",
  "/config/venue-registry.js",
  "/config/preference-system.js",
  "/config/swipe-calibration.js",
  "/config/fine-tuning.js",
  "/config/rating-system.js",
  "/config/storyline-overrides.js",
  "/config/enrichment-engine.js",
  "/config/card-lifecycle.js",
  "/config/reminder-engine.js",
  "/config/soundtrack.js",
  "/config/joint-tennis-tournament.js",
  "/config/selector-taxonomy.js",
  "/config/discovery-catalogue.js",
  "/config/au-broadcast-weights.js",
  "/data/feed/manifest.json",
  "/data/feed/page-001.json",
  "/data/feed-meta.json",
  "/data/marquee-candidates.v1.json",
  "/data/follow-directory/manifest.v1.json",
  "/data/follow-directory/manifest.v1.js",
  // The generated script is retained only for no-network/direct-file recovery.
  // Live JSON remains network-first and is cached by the fetch handler after use.
  "/schemas/preference-graph.schema.json",
  "/schemas/feed-controls.schema.json",
  "/schemas/preference-taxonomy.schema.json",
  "/schemas/tennis-ranking-export.schema.json",
  "/schemas/tennis-tournament-export.schema.json",
  "/schemas/tennis-catalogue.schema.json",
  "/schemas/joint-tennis-tournament.schema.json",
  "/schemas/major-events.schema.json",
  "/schemas/marquee-candidates.schema.json",
  "/schemas/product-events.schema.json",
  "/schemas/user-state-patch.schema.json",
  "/schemas/enriched-event.schema.json",
  "/schemas/derived-card-cache.schema.json",
  "/schemas/sport-context.schema.json",
  "/schemas/sport-hierarchy.schema.json",
  "/schemas/catalog-event.schema.json",
  "/manifest.webmanifest",
  "/assets/brand/web/nothingsport-logo.png",
  "/assets/identities/f1/formula-one-red-512.png",
  "/assets/identities/f1/formula-one-red-256.png",
  "/assets/providers/kayo-sports-negative.svg",
  "/assets/providers/stan-sport.jpg",
  "/assets/providers/foxtel.svg",
  "/assets/providers/paramount-plus.svg",
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
  "/assets/licenses/FLAG-ICONS-MIT.txt"
];

// National marks remain offline-capable without making the first install pay
// their full multi-megabyte cost. Each mark is cached on first display.
const DEFERRED_IDENTITY_ASSETS = new Set([
  "/assets/identities/national/football/socceroos.png",
  "/assets/identities/national/football/matildas.png",
  "/assets/identities/national/football/turkiye.png",
  "/assets/identities/national/football/usa.png",
  "/assets/identities/national/football/paraguay.png",
  "/assets/identities/national/football/egypt.png",
  "/assets/identities/national/football/canada.png",
  "/assets/identities/national/football/morocco.png",
  "/assets/identities/national/football/france.png",
  "/assets/identities/national/football/brazil.png",
  "/assets/identities/national/football/norway.png",
  "/assets/identities/national/football/mexico.png",
  "/assets/identities/national/football/england.png",
  "/assets/identities/national/football/portugal.png",
  "/assets/identities/national/football/spain.png",
  "/assets/identities/national/football/belgium.png",
  "/assets/identities/national/football/argentina.png",
  "/assets/identities/national/football/switzerland.png",
  "/assets/identities/national/football/colombia.png",
  "/assets/identities/national/rugby/wallabies.png",
  "/assets/identities/national/rugby/ireland.png",
  "/assets/identities/national/rugby/france.png",
  "/assets/identities/national/rugby/italy.png",
  "/assets/identities/national/rugby/japan.png",
  "/assets/identities/national/rugby/springboks.png",
  "/assets/identities/national/rugby/all-blacks.png",
  "/assets/identities/national/rugby/argentina.png",
  "/assets/identities/national/rugby/england.png",
  "/assets/identities/national/rugby/scotland.png",
  "/assets/identities/national/rugby/wales.png",
  "/assets/identities/national/cricket/australia.jpg",
  "/assets/identities/national/cricket/bangladesh.jpg",
  "/assets/identities/national/cricket/england.jpg",
  "/assets/identities/national/cricket/new-zealand.jpg",
  "/assets/identities/national/cricket/south-africa.jpg",
  "/assets/identities/national/cricket/india.jpg",
  "/assets/identities/national/cricket/pakistan.jpg",
  "/assets/identities/national/cricket/sri-lanka.jpg",
  "/assets/identities/national/cricket/west-indies.jpg",
  "/assets/identities/national/rugby-league/kangaroos.svg",
  "/assets/identities/national/rugby-league/jillaroos.svg",
  "/assets/identities/national/rugby-league/kiwis.svg",
  "/assets/identities/national/rugby-league/kiwi-ferns.png",
  "/assets/identities/national/rugby-league/fiji-bati.svg",
  "/assets/identities/national/rugby-league/cook-islands-aitu.svg",
  "/assets/identities/national/netball/diamonds.svg",
  "/assets/identities/national/netball/england-roses.png",
  "/assets/identities/national/netball/malawi-queens.png",
  "/assets/identities/national/netball/south-africa-proteas.svg",
  "/assets/identities/national/netball/jamaica-sunshine-girls.png",
  "/assets/identities/national/netball/silver-ferns.svg",
  "/assets/identities/national/basketball/boomers.png",
  "/assets/identities/national/basketball/opals.png",
  "/assets/identities/national/hockey/kookaburras.svg",
  "/assets/identities/national/hockey/hockeyroos.png",
  "/assets/identities/national/multi-sport/team-australia.png",
  "/assets/identities/national/aflw/australia-coat-of-arms.svg",
  "/assets/identities/national/aflw/ireland-state-harp.svg",
]);

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

async function staleWhileRevalidate(request, event, cacheKey = request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheKey);
  const network = fetch(request).then(async response => {
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  }).catch(() => null);
  // Register the lifetime before returning a cached response. Registering it
  // only after fetch resolves can leave an installed app stuck on its old shell.
  event.waitUntil(network.then(() => undefined));
  return cached || await network || caches.match("/index.html");
}

async function cacheFirst(request, cacheKey = request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(cacheKey, response.clone());
  return response;
}

async function networkFirst(request, event, cacheKey = request){
  const cache = await caches.open(CACHE_NAME);
  try{
    const response = await fetch(request);
    if (response.ok) event.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }catch(_error){
    return cache.match(cacheKey).then(cached => cached || caches.match("/index.html"));
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const cacheKey = new Request(event.request.url, { method: "GET" });
  if (requestUrl.origin !== self.location.origin) return;
  // Safari requests HTML media in byte ranges. Partial responses cannot be
  // stored in Cache Storage and must retain the original Range header.
  if (event.request.headers.has("range") || requestUrl.pathname.startsWith("/assets/audio/")){
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === "navigate" && (/^\/fixture\//.test(requestUrl.pathname) || requestUrl.pathname === "/live")){
    event.respondWith(networkFirst(event.request, event, new Request("/participate.html")));
    return;
  }
  if (event.request.mode === "navigate" && /^\/admin\/(?:users|reports|comms)$/.test(requestUrl.pathname)){
    event.respondWith(networkFirst(event.request, event, new Request("/admin.html")));
    return;
  }
  if (event.request.mode === "navigate" && ["/admin.html", "/admin-comms.html", "/participate.html", "/privacy.html", "/terms.html", "/404.html"].includes(requestUrl.pathname)){
    event.respondWith(networkFirst(event.request, event, new Request(requestUrl.pathname)));
    return;
  }
  if (event.request.mode === "navigate"){
    event.respondWith(staleWhileRevalidate(event.request, event, new Request("/index.html")));
    return;
  }
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith("/api/")){
    event.respondWith(fetch(event.request));
    return;
  }
  if (/^\/data\/code-inspector\//.test(requestUrl.pathname)){
    event.respondWith(networkFirst(event.request, event, cacheKey));
    return;
  }
  if (/^\/data\/(?:feed|canonical|football|follow-directory)\//.test(requestUrl.pathname)){
    event.respondWith(staleWhileRevalidate(event.request, event, cacheKey));
    return;
  }
  if (DEFERRED_IDENTITY_ASSETS.has(requestUrl.pathname)){
    event.respondWith(cacheFirst(event.request, cacheKey));
    return;
  }
  if (/^\/assets\//.test(requestUrl.pathname)){
    event.respondWith(cacheFirst(event.request, cacheKey));
    return;
  }
  event.respondWith(staleWhileRevalidate(event.request, event, cacheKey));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  let target;
  try{
    target = new URL(targetUrl, self.location.origin);
    if (target.origin !== self.location.origin) target = new URL("/", self.location.origin);
  }catch(_error){
    target = new URL("/", self.location.origin);
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => "focus" in client);
      if (existing){
        const navigation = existing.navigate ? existing.navigate(target.href) : Promise.resolve(existing);
        return Promise.resolve(navigation).then(client => (client || existing).focus());
      }
      return self.clients.openWindow ? self.clients.openWindow(target.href) : undefined;
    })
  );
});

self.addEventListener("push", event => {
  let payload = {};
  try{ payload = event.data?.json?.() || {}; }catch(_error){ payload = { body:event.data?.text?.() || "" }; }
  const show = self.registration.showNotification(payload.title || "Nothing Sport reminder", {
    body:payload.body || "Open Nothing Sport for the latest update.",
    icon:"/icons/nothingsport-app-192.png",
    badge:"/icons/nothingsport-app-192.png",
    tag:payload.tag || "nothingsport-reminder",
    renotify:true,
    data:{ url:payload.url || "/", kind:payload.kind || "sport" },
  });
  const badge = payload.kind === "chat" && Number(payload.unreadCount) > 0
    ? self.navigator?.setAppBadge?.(Number(payload.unreadCount))
    : null;
  const receipt = payload.kind === "test" && payload.testId
    ? self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(clients => {
        clients.forEach(client => client.postMessage({ type:"nothingsport-notification-received", kind:"test", testId:payload.testId }));
      })
    : null;
  event.waitUntil(Promise.all([show, badge, receipt].filter(Boolean)));
});
