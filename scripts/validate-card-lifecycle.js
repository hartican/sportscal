#!/usr/bin/env node

const assert = require("node:assert/strict");
const lifecycle = require("../config/card-lifecycle.js");

const now = new Date("2026-07-20T12:00:00.000Z");
const recent = { id: "recent", status: "completed", startTimeUtc: "2026-07-10T10:00:00.000Z", endTimeUtc: "2026-07-10T12:00:00.000Z", name: "Recent" };
const expired = { id: "expired", status: "completed", startTimeUtc: "2026-07-01T10:00:00.000Z", endTimeUtc: "2026-07-01T12:00:00.000Z", name: "Expired" };
const future = { id: "future", status: "scheduled", startTimeUtc: "2026-07-25T10:00:00.000Z", endTimeUtc: "2026-07-25T12:00:00.000Z", name: "Future" };
const enrich = event => ({ cardVariant: event.id === "future" ? "marquee" : "standard", intensity: event.id === "future" ? 5 : 3, mustWatchScore: event.id === "future" ? 92 : 55 });

assert.equal(lifecycle.RETENTION_DAYS, 14);
assert.equal(lifecycle.isWithinRetention(recent, now), true);
assert.equal(lifecycle.isWithinRetention(expired, now), false);
assert.equal(lifecycle.isWithinRetention(future, now), true);

const cache = lifecycle.materialize([expired, recent, future], {
  profileId: "profile:test",
  enrich,
  now,
});
assert.deepEqual(cache.derivedCards.map(card => card.canonicalEventId), ["future", "recent"], "expired canonical events must not materialise cards");
assert.equal(cache.derivedCards[0].surface, "homeMustWatch");
assert.equal(cache.derivedCards[1].surface, "recent");
assert(cache.derivedCards.every(card => card.isArchived === false), "cache records must not absorb archive state");

const staleCache = {
  ...cache,
  derivedCards: [
    ...cache.derivedCards,
    { ...cache.derivedCards[0], id: "card:profile:test:recent:stale", canonicalEventId: "stale", expiresAt: "2026-07-19T12:00:00.000Z" },
  ],
};
const purged = lifecycle.purgeExpired(staleCache, now);
assert.equal(purged.removedCount, 1);
assert(!purged.cache.derivedCards.some(card => card.canonicalEventId === "stale"));

let archives = lifecycle.archiveReference([], expired, { profileId: "profile:test", archivedFromCardId: "card:old", now });
assert.equal(archives.length, 1);
assert.equal(archives[0].canonicalEventId, "expired");
assert(!purged.cache.derivedCards.some(card => card.canonicalEventId === "expired"), "archive references must not block cache cleanup");
assert.deepEqual(lifecycle.rebuildArchive(archives, [expired]).events.map(event => event.id), ["expired"], "archive view must rebuild from canonical truth after cache purge");
archives = lifecycle.removeArchiveReference(archives, "expired");
assert.equal(archives.length, 0);

console.log("Card lifecycle validation passed.");
