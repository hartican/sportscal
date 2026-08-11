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

assert(!html.includes('id="refreshBtn"'), "manual refresh must not remain in the primary top-bar UI");
assert(html.includes('id="refreshAndRebuildFeedBtn"'), "Settings must expose the combined refresh and cache rebuild recovery action");
assert(html.includes('id="refreshAndRebuildFeedStatus"') && html.includes('aria-live="polite"'), "the Settings recovery action must expose progress and completion status");
assert(html.includes("renderFeedIfPresentationChanged"), "background hydration must pass through the visible-change render gate");
assert(html.includes("refreshFeedOnFirstLoad()"), "the published feed must refresh automatically on first load");
assert(html.includes("lastBundledEvents.length ? lastBundledEvents : EVENTS.slice()"), "a failed direct-file reload must preserve the last successfully loaded bundle instead of reverting to the tab's stale snapshot");
assert(worker.includes("/config/feed-refresh-lifecycle.js"), "the refresh lifecycle helper must work offline");

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
  assert.match(appendedSource, /^file:\/\/\/tmp\/nothingsport\/data\/events\.js\?refresh=\d+$/, "direct-file recovery must bypass the browser's cached script copy");
  assert.equal(removed, true, "the one-shot recovery script must be removed after loading");
}

validateDirectFileBundleReload()
  .then(() => console.log("Refresh lifecycle valid: first load is automatic, unchanged hydration is render-gated, and direct-file recovery reloads the generated feed."))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
