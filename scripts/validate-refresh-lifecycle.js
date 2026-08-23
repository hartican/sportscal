const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const lifecycle = require("../config/feed-refresh-lifecycle.js");

const baseEvents = [{
  id: "fixture-1",
  eventId: "fixture-1",
  key: "nrl",
  name: "Raiders v Sharks",
  date: "2026-08-14",
  time: "20:00",
  participantIds: ["team:nrl:raiders"],
}];
const baseCards = [{
  id: "card:fixture-1",
  canonicalEventId: "fixture-1",
  generatedAt: "2026-08-11T00:00:00.000Z",
  rank: 0,
  renderPayload: { displayTitle: "Raiders v Sharks" },
}];
const first = lifecycle.presentationFingerprint({
  events: baseEvents,
  derivedCards: baseCards,
  feedVersion: "feed-v1",
  publishedAt: "2026-08-11T00:00:00.000Z",
});
const contextOnly = lifecycle.presentationFingerprint({
  events: [{
    ...baseEvents[0],
    participantIds: ["team:nrl:raiders", "team:nrl:sharks"],
    canonicalSourceCheckedAt: "2026-08-11T00:05:00.000Z",
  }],
  derivedCards: [{ ...baseCards[0], generatedAt: "2026-08-11T00:05:00.000Z" }],
  feedVersion: "feed-v1",
  publishedAt: "2026-08-11T00:00:00.000Z",
});
const changed = lifecycle.presentationFingerprint({
  events: [{ ...baseEvents[0], name: "Raiders v Sharks — venue changed" }],
  derivedCards: baseCards,
  feedVersion: "feed-v1",
  publishedAt: "2026-08-11T00:00:00.000Z",
});
const metadataOnly = lifecycle.presentationFingerprint({
  events: baseEvents,
  derivedCards: baseCards,
  feedVersion: "feed-v2",
  publishedAt: "2026-08-11T00:10:00.000Z",
});

assert.equal(first, contextOnly, "context-only hydration and generated timestamps must not force a visible feed rebuild");
assert.equal(first, metadataOnly, "feed-generation metadata must update its summary without rebuilding visible cards");
assert.notEqual(first, changed, "a visible event change must require a feed rebuild");
assert.equal(lifecycle.shouldRenderUpdate(null, first), true, "the first stable feed must render");
assert.equal(lifecycle.shouldRenderUpdate(first, first), false, "an unchanged refresh must not rerender the visible feed");
assert.equal(lifecycle.shouldRenderUpdate(first, changed), true, "changed visible content must rerender");

let controlledUpdateReloads = 0;
const controlledUpdate = lifecycle.createStartupCoordinator({
  hadControllerAtStartup: true,
  reloadForUpdate(){ controlledUpdateReloads += 1; },
});
assert.equal(controlledUpdate.isHydrating(), true, "the framework must expose a loading card surface while startup data settles");
assert.equal(controlledUpdate.controllerChanged(), false, "a worker update during startup must wait instead of interrupting the live app");
assert.equal(controlledUpdateReloads, 0, "controller changes must not reload an app that is still hydrating");
assert.equal(controlledUpdate.markHydrationComplete(), true, "startup completion must release one pending controlled update");
assert.equal(controlledUpdateReloads, 1, "a pending installed-app update must reload exactly once after startup is safe");
controlledUpdate.controllerChanged();
controlledUpdate.markHydrationComplete();
assert.equal(controlledUpdateReloads, 1, "repeated lifecycle signals must not create an update reload loop");

let firstInstallReloads = 0;
const firstInstall = lifecycle.createStartupCoordinator({
  hadControllerAtStartup: false,
  reloadForUpdate(){ firstInstallReloads += 1; },
});
firstInstall.controllerChanged();
firstInstall.markHydrationComplete();
assert.equal(firstInstallReloads, 0, "first-time service-worker control must not reload a fresh install");

assert(!html.includes('id="refreshBtn"'), "manual refresh must not remain in the primary top-bar UI");
assert(html.includes('id="refreshAndRebuildFeedBtn"'), "Settings must expose the combined refresh and cache rebuild recovery action");
assert(html.includes('id="refreshAndRebuildFeedStatus"') && html.includes('aria-live="polite"'), "the Settings recovery action must expose progress and completion status");
assert(html.includes("renderFeedIfPresentationChanged"), "background hydration must pass through the visible-change render gate");
assert(html.includes("refreshFeedOnFirstLoad()"), "the published feed must refresh automatically on first load");
assert(html.includes('id="startupFeedLoading"') && html.includes("Loading your sports feed"), "startup must render the interactive framework with a dedicated card-loading surface");
assert(html.includes('id="startupLaunch"') && html.includes('class="startup-launch-liquid"'), "startup must use the full-screen liquid brand launch instead of a numeric progress indicator");
assert(html.includes("-webkit-mask:var(--startup-logo-mask)") && html.includes("@keyframes startup-liquid-rise"), "the launch wordmark must fill through the existing logo mask with a rising liquid motion");
assert(html.includes("startup-launch-liquid-surface") && html.includes("@keyframes startup-liquid-surface-rise"), "the liquid leading edge must use a rounded, settling meniscus instead of a flat gradient fill");
assert(html.includes("@keyframes startup-liquid-sheen") && html.includes("@keyframes startup-launch-exit"), "the launch must include a moving liquid highlight and a bounded self-dismissal animation");
assert(html.includes("animation:startup-launch-exit 3s"), "the liquid launch must remain on screen for the requested three-second timer");
assert(html.includes("startup-launch-liquid-depth") && html.includes("startup-launch-liquid-backwash"), "the launch must layer depth currents and a backwash behind the foreground meniscus");
assert(html.includes("@keyframes startup-liquid-depth-rise") && html.includes("@keyframes startup-liquid-undercurrent") && html.includes("@keyframes startup-liquid-backwash-rise"), "the viscous ocean treatment must use independently timed depth, undercurrent and backwash motion");
assert(html.includes("perspective:900px") && html.includes("rotateX(45deg)"), "the liquid surface must retain visible perspective depth");
assert(html.includes("cubic-bezier(.18,.7,.22,1)"), "the foreground swell must use the slower viscous easing curve");
assert(html.includes("@keyframes startup-screen-arrive") && html.includes("animation-delay:2.36s"), "the launch must crossfade into a staggered app-screen arrival instead of disappearing abruptly");
assert(html.includes("transform:translate3d(0, -2.8vh, 0) scale(.978)"), "the launch surface must settle upward as the app screen takes focus");
assert(/@media \(prefers-reduced-motion: reduce\)[\s\S]*#mainContent[\s\S]*animation:none !important/.test(html), "reduced-motion users must bypass the delayed screen transition");
assert(html.includes("@supports not ((-webkit-mask") && html.includes("startup-launch-fallback"), "browsers without CSS masking must receive the PNG launch fallback");
assert(!html.includes('id="startupProgress"') && !html.includes("setStartupProgress("), "the header percentage loader and its progress bookkeeping must be removed");
assert(html.includes("const startupTasks = [") && html.includes("window.requestAnimationFrame(() => {") && html.includes("startupCoordinator.markHydrationComplete()"), "the bundled static feed must commit after one frame while canonical context and refresh continue in the background");
assert(html.includes("const alreadyAvailable = coerceEventList(globalThis.NOTHINGSPORTS_EVENTS || [])")
  && html.includes("if (alreadyAvailable.length) return Promise.resolve(alreadyAvailable)"), "direct-file recovery must preserve the last successfully loaded global bundle before requesting the offline script fallback");
assert(worker.includes("/config/feed-refresh-lifecycle.js"), "the refresh lifecycle helper must work offline");

async function validateServiceWorkerActivation(){
  const handlers = {};
  let navigations = 0;
  const sandbox = {
    URL,
    fetch: async () => ({ clone(){ return this; } }),
    caches: {
      open: async () => ({ addAll: async () => {}, put: async () => {} }),
      keys: async () => ["nothingsport-shell-v67", "nothingsport-shell-v68"],
      delete: async () => true,
      match: async () => null,
    },
    self: {
      location: { origin: "https://nothingsport.vercel.app" },
      addEventListener(type, handler){ handlers[type] = handler; },
      skipWaiting(){},
      clients: {
        claim: async () => {},
        matchAll: async () => [{
          url: "https://nothingsport.vercel.app/",
          async navigate(){ navigations += 1; },
        }],
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(worker, sandbox, { filename: "service-worker.js" });
  let activation;
  handlers.activate({ waitUntil(promise){ activation = promise; } });
  await activation;
  assert.equal(navigations, 0, "worker activation must never navigate a live Home Screen app during startup");
}

function validateScrollIdleRetraction(){
  const schedulerSource = html.match(/function scheduleCardRetractionDuringScroll\(\)\{[\s\S]*?\n\}/);
  assert(schedulerSource, "the card retraction scheduler must remain independently testable");
  let idleTask = null;
  let collapses = 0;
  const sandbox = {
    CARD_RETRACTION_SCROLL_IDLE_MS: 180,
    cardRetractionFrame: null,
    cardRetractionScrollTimer: null,
    lastCardRetractionScrollY: 0,
    pendingCardRetractionSpaceCards: new Set(),
    cardScrollDirection(){ return "down"; },
    clearPendingCardRetractionSpace(){},
    scheduleCardRetractionSpaceCleanup(){},
    collapseCardsOutsideActiveViewport(){ collapses += 1; },
    window: {
      scrollY: 120,
      requestAnimationFrame(callback){ callback(); return 1; },
      clearTimeout(){ idleTask = null; },
      setTimeout(callback, delay){
        assert.equal(delay, 180, "card retraction must use the bounded scroll-idle delay");
        idleTask = callback;
        return 1;
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${schedulerSource[0]}\nglobalThis.__scheduleRetraction = scheduleCardRetractionDuringScroll;`, sandbox, { filename: "index.html" });
  sandbox.__scheduleRetraction();
  assert.equal(collapses, 0, "active scrolling must not destroy and rebuild card icons");
  assert.equal(typeof idleTask, "function", "card retraction must be queued until scrolling settles");
  idleTask();
  assert.equal(collapses, 1, "expanded cards must still retract once scrolling is idle");
}

async function validateDirectFileBundleReload(){
  const loaderSource = html.match(/function reloadBundledEventsScript\(\)\{[\s\S]*?\n\}\n\nfunction loadLatestBundledEvents\(\)\{[\s\S]*?\n\}/);
  assert(loaderSource, "the direct-file generated-bundle loader must remain independently testable");

  const freshEvents = [
    { id: "rugby-japan-australia-2026-08-08" },
    { id: "rugby-australia-japan-2026-08-15" },
  ];
  let appendedSource = "";
  let removed = false;
  const sandbox = {
    URL,
    Date,
    Promise,
    EVENTS: [{ id: "stale-tab-snapshot" }],
    FEED_CONFIG: { eventsScriptUrl: "data/events.js" },
    location: { protocol: "file:" },
    coerceEventList(payload){ return Array.isArray(payload) ? payload : []; },
  };
  sandbox.globalThis = sandbox;
  sandbox.document = {
    baseURI: "file:///tmp/nothingsport/index.html",
    createElement(tagName){
      assert.equal(tagName, "script");
      return {
        async: false,
        remove(){ removed = true; },
      };
    },
    head: {
      appendChild(script){
        appendedSource = script.src;
        sandbox.NOTHINGSPORTS_EVENTS = freshEvents;
        script.onload();
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${loaderSource[0]}\nglobalThis.__loadLatestBundledEvents = loadLatestBundledEvents;`, sandbox, { filename: "index.html" });

  const reloaded = await sandbox.__loadLatestBundledEvents();
  assert.deepEqual(Array.from(reloaded, event => event.id), freshEvents.map(event => event.id), "direct-file recovery must replace the stale tab snapshot with every event in the regenerated bundle");
  assert.equal(appendedSource, "file:///tmp/nothingsport/data/events.js", "direct-file recovery must retain the stable script URL used by the service-worker offline cache");
  assert.equal(removed, true, "the one-shot recovery script must be removed after loading");
}

Promise.all([
  validateServiceWorkerActivation(),
  validateDirectFileBundleReload(),
  Promise.resolve().then(validateScrollIdleRetraction),
])
  .then(() => console.log("Refresh lifecycle valid: first load is automatic, unchanged hydration is render-gated, and direct-file recovery reloads the generated feed."))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
