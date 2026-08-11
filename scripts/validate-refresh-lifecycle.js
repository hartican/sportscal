const assert = require("node:assert/strict");
const fs = require("node:fs");

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
assert(worker.includes("/config/feed-refresh-lifecycle.js"), "the refresh lifecycle helper must work offline");

console.log("Refresh lifecycle valid: first load is automatic, unchanged hydration is render-gated, and Settings owns observable recovery.");
