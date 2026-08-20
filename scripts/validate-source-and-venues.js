#!/usr/bin/env node
const assert = require("node:assert/strict");
const sourceTrust = require("../config/source-trust.js");
const venues = require("../config/venue-registry.js");
const feed = require("../data/events.json");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const feedUtils = require("./lib/feed-utils.js");
assert.equal(venues.VERSION, "venue-registry.v2", "the context-aware venue identity migration must be versioned");

assert.equal(sourceTrust.sourceTrustForEvent({ sourceType: "official" }).trust, "verified");
assert.equal(sourceTrust.sourceTrustForEvent({ sourceType: "reputable" }).label, "Unverified source");
assert.deepEqual(
  sourceTrust.mergeClaims(
    { date: "2026-08-22", score: "20-10", sourceType: "official" },
    { date: "2026-08-23", score: "25-10", sourceType: "scraped", selectedSentence: "New reporting" },
  ),
  {
    date: "2026-08-22",
    score: "20-10",
    sourceType: "scraped",
    selectedSentence: "New reporting",
    sourceTrust: "unverified",
    verifiedFactSource: {
      sourceType: "official",
      sourceName: null,
      sourceUrl: null,
      sourceCheckedAt: null,
      protectedFields: ["date", "score"],
    },
  },
  "unverified reporting must not overwrite verified fixture or result facts"
);
const protectedFeedEvent = feedUtils.protectVerifiedEventFacts(
  [{ eventId: "test", id: "test", key: "rugby", name: "All Blacks v South Africa", date: "2026-08-23", time: "19:00", score: "30-20", sourceType: "scraped", sourceName: "Public report", sourceUrl: "https://example.com/report", sourceCheckedAt: "2026-08-23T10:00:00Z" }],
  [{ eventId: "test", id: "test", key: "rugby", name: "All Blacks v South Africa", date: "2026-08-22", time: "17:00", score: "", sourceType: "official", sourceName: "Competition", sourceUrl: "https://example.com/fixture", sourceCheckedAt: "2026-08-20T10:00:00Z" }],
)[0];
assert.equal(protectedFeedEvent.date, "2026-08-22", "the publish boundary must retain the verified fixture date");
assert.equal(protectedFeedEvent.time, "17:00", "the publish boundary must retain the verified fixture time");
assert.equal(protectedFeedEvent.score, "", "the publish boundary must not accept a conflicting unverified result");
assert.equal(protectedFeedEvent.sourceTrust, "unverified", "mixed reporting must remain visibly unverified");
assert.equal(protectedFeedEvent.sourceName, "Public report", "the visible source must describe the unverified reporting actually shown");
const unrelatedNearbyFixture = feedUtils.protectVerifiedEventFacts(
  [{ eventId: "essendon-gws", id: "essendon-gws", key: "afl", name: "Essendon v Greater Western Sydney Giants", date: "2026-07-19", time: "16:40", sourceType: "reputable" }],
  [{ eventId: "gws-sydney", id: "gws-sydney", canonicalEventId: "event:afl:gws-sydney", key: "afl", name: "GWS GIANTS v Sydney Swans", date: "2026-07-25", time: "16:35", sourceType: "official" }],
)[0];
assert.equal(unrelatedNearbyFixture.date, "2026-07-19", "shared team tokens across different rounds must not import verified facts from another fixture");
assert.equal(unrelatedNearbyFixture.canonicalEventId, undefined, "a nearby but distinct fixture must never inherit another canonical event identity");
assert.equal(feedUtils.validateFeed(feedUtils.normalizeFeed({ schemaVersion: "events.v1", version: "source-test", publishedAt: "2026-08-20T10:00:00Z", events: [{ ...feed.events[0], sourceType: "scraped" }] })).length, 0, "scraped MVP sources must be accepted by the canonical feed contract");
assert.equal(venues.resolve("Ocean Protect Stadium").displayName, "Shark Park");
assert.equal(venues.resolve("Accor Stadium, Sydney").displayName, "Stadium Australia");
assert.equal(venues.resolve("Marvel Stadium").displayName, "Docklands Stadium");
assert.equal(venues.resolve("ENGIE Stadium, Sydney").id, "sydney-showground-stadium", "Sydney Showground must retain its own canonical venue identity");
assert.equal(venues.resolve("Netstrata Jubilee Stadium").id, "jubilee-oval", "Kogarah must retain its own canonical venue identity");
assert.notEqual(venues.resolve("ENGIE Stadium, Sydney").id, venues.resolve("Netstrata Jubilee Stadium").id, "ENGIE Stadium and Netstrata Jubilee Stadium must never be merged");
assert.equal(venues.resolve("Go Media Stadium").displayName, "Mt Smart");
assert.equal(venues.resolve("UTAS Stadium, Launceston").displayName, "York Park");
assert.equal(venues.resolve("Cincinnati, USA", { key: "tennis" }).displayName, "Cincinnati Open", "broad location aliases must resolve only with event context");
assert.equal(venues.resolve("Cincinnati, USA").audited, false, "a city must not globally collapse to one venue");
assert(html.includes('src="config/source-trust.js"') && html.includes('src="config/venue-registry.js"'), "the source trust and venue models must load before the app state");
assert(worker.includes('"/config/source-trust.js"') && worker.includes('"/config/venue-registry.js"'), "the source trust and venue models must remain available in the offline shell");
const audit = venues.audit(feed.events);
assert.equal(audit.total, new Set(feed.events.map(event => event.venue).filter(Boolean)).size, "the venue audit must inspect every currently published venue");
assert(audit.audited >= 87, "the registry must contain the researched venue aliases and context-specific identities");
assert.deepEqual(audit.unclassified, [], "every current venue input must be resolved or carry an explicit editorial disposition");
assert.equal(audit.pending.length, 8, "only route, competition-placeholder and quarantined inputs may remain unresolved");

console.log(`Source trust and venue registry valid: ${audit.total} current venues scanned; ${audit.audited} reviewed aliases, ${audit.pending.length} queued for editorial venue review.`);
