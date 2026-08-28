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
assert(html.includes('id="startupFeedLoading"') && html.includes("startup-card-skeleton") && html.includes("startup-skeleton-logo"), "startup must show blurred card-shaped skeletons rather than a text or sports-ball loader");
assert(!html.includes("startup-sports-ball") && !html.includes("Loading your sports feed"), "the old text and sports-ball startup loader must be removed");
assert(html.includes('id="startupLaunch"') && html.includes('class="startup-launch-glass"'), "startup must begin with the logo as a glass vessel");
assert(html.includes('class="startup-launch-original"') && html.includes('src="assets/brand/web/nothingsport-logo.png"'), "the liquid fill must reveal the exact original logo pixels");
assert(html.includes("-webkit-mask:var(--startup-logo-mask)") && html.includes("@keyframes startup-original-logo-fill"), "the glass silhouette and original logo must use the existing alpha mask and rising fill");
assert(html.includes("startup-launch-meniscus") && html.includes("@keyframes startup-meniscus-rise"), "the rising fill must carry an uneven viscous meniscus");
assert(html.includes("@keyframes startup-logo-shine") && /animation:startup-logo-shine \.(?:[1-9]\d*)s/.test(html), "the completed original logo must receive a bounded specular settle");
assert(html.includes("window.setTimeout(() => {") && html.includes("}, duration + 220);") && html.includes("LOADING_PROGRESS?.FUNNEL_DURATION_MS || 1000"), "the launch must reveal the usable shell and retain a bounded header-flight fallback");
assert(html.includes("startup-logo-flight") && html.includes("getElementById(\"headerBrandLogo\")") && html.includes("getBoundingClientRect()"), "the final logo must FLIP into the real responsive header bounds");
assert(html.includes("startup-shell-visible") && html.includes("transition-delay:40ms"), "the app screen must use a short stagger behind the logo flight");
assert(/@media \(prefers-reduced-motion: reduce\)[\s\S]*#mainContent[\s\S]*animation:none !important/.test(html), "reduced-motion users must bypass the delayed screen transition");
assert(html.includes("@supports not ((-webkit-mask") && html.includes("startup-launch-fallback"), "browsers without CSS masking must receive the PNG launch fallback");
assert(!html.includes('id="startupProgress"') && !html.includes("setStartupProgress("), "the header percentage loader and its progress bookkeeping must be removed");
assert(html.includes("STARTUP_FEED_TIMEOUT_MS = 6000") && html.includes('id="startupFeedRetryBtn"') && html.includes("runStartupFeedBarrier()"), "a six-second failed or stalled load must stop pulsing and expose a functional centred retry");
assert(html.includes("Promise.allSettled(startupTasks)") && html.includes("task.valid(value)") && html.includes("completeStartupFeedHydration()"), "all card-producing startup tasks must settle and validate before hydration releases cards");
assert(!/requestAnimationFrame\(\(\) => \{\s*startupCoordinator\.markHydrationComplete\(\)/.test(html), "startup must not reveal cards on the first animation frame");
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

function validateScrollIdleMutationQueue(){
  const queueSource = html.match(/let scrollMomentumActive = false;[\s\S]*?function queueScrollIdleMutation\(mutation\)\{[\s\S]*?\n\}/);
  assert(queueSource, "the scroll-idle mutation queue must remain independently testable");
  let idleTask = null;
  const applied = [];
  const sandbox = {
    window: {
      clearTimeout(){ idleTask = null; },
      setTimeout(callback, delay){
        assert.equal(delay, 150, "background list mutations must use the bounded scroll-idle fallback");
        idleTask = callback;
        return 1;
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${queueSource[0]}\nglobalThis.__note = noteScrollMomentum; globalThis.__queue = queueScrollIdleMutation;`, sandbox, { filename: "index.html" });
  sandbox.__note();
  sandbox.__queue(() => applied.push("stale"));
  sandbox.__queue(() => applied.push("latest"));
  assert.deepEqual(applied, [], "active momentum must not rebuild a visible list");
  assert.equal(typeof idleTask, "function", "the latest mutation must remain queued until scrolling settles");
  idleTask();
  assert.deepEqual(applied, ["latest"], "only the latest background mutation may flush after scrolling settles");
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
  Promise.resolve().then(validateScrollIdleMutationQueue),
])
  .then(() => console.log("Refresh lifecycle valid: first load is automatic, unchanged hydration is render-gated, and direct-file recovery reloads the generated feed."))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
