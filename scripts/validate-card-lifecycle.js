#!/usr/bin/env node

const assert = require("node:assert/strict");
const lifecycle = require("../config/card-lifecycle.js");

const now = new Date("2026-07-20T12:00:00.000Z");
const recent = { id: "recent", status: "completed", startTimeUtc: "2026-07-17T10:00:00.000Z", endTimeUtc: "2026-07-17T12:00:00.000Z", name: "Recent" };
const archived = { id: "archived", status: "completed", startTimeUtc: "2026-07-10T10:00:00.000Z", endTimeUtc: "2026-07-10T12:00:00.000Z", name: "Archived" };
const expired = { id: "expired", status: "completed", startTimeUtc: "2026-07-01T10:00:00.000Z", endTimeUtc: "2026-07-01T12:00:00.000Z", name: "Expired" };
const future = { id: "future", status: "scheduled", startTimeUtc: "2026-07-25T10:00:00.000Z", endTimeUtc: "2026-07-25T12:00:00.000Z", name: "Future" };
const enrich = event => ({
  rankingVersion: "premium-ranking.v1",
  cardVariant: event.id === "future" ? "marquee" : "standard",
  intensity: event.id === "future" ? 5 : 3,
  mustWatchScore: event.id === "future" ? 92 : 55,
  followContext: event.id === "future" ? [{
    participantId: "team:test",
    participantType: "team",
    displayName: "Test Team",
    followLevel: "priority",
  }] : [],
  stakesScore: event.id === "future" ? 5 : 3,
  australiaRelevanceScore: 0,
  availabilityScore: 4,
  editorialBoost: 0,
  premiumSurface: event.id === "future" ? "homeMustWatch" : "sportFeed",
  editorialOverride: null,
});

assert.equal(lifecycle.ARCHIVE_DAYS, 7);
assert.equal(lifecycle.RETENTION_DAYS, 14);
assert.equal(lifecycle.isWithinRetention(recent, now), true);
assert.equal(lifecycle.lifecycleState(recent, { now }).state, "active");
assert.equal(lifecycle.lifecycleState(archived, { now }).state, "archived");
assert.equal(lifecycle.isWithinRetention(expired, now), false);
assert.equal(lifecycle.isWithinRetention(future, now), true);
assert.equal(lifecycle.lifecycleState(expired, { action: { watchLater: true }, now }).state, "saved");
assert.equal(lifecycle.lifecycleState(expired, { action: { archived: true }, now }).state, "saved", "a manual Archive action must remain retention-exempt indefinitely");
assert.equal(lifecycle.lifecycleState(expired, { action: { addedToFixtures: true }, now }).state, "saved", "a manually pinned past fixture must remain in Feed until it is removed");
assert.equal(lifecycle.isWithinRetention(expired, now, { action: { archived: true } }), true, "a manual archive must survive beyond day fourteen");
assert.equal(lifecycle.shouldAutoArchive(archived, now), true);
assert.equal(lifecycle.shouldAutoArchive(expired, now, { archived: true }), false, "a manual archive must not be mistaken for automatic expiry");
assert.equal(lifecycle.shouldAutoArchive(expired, now, { addedToFixtures: true }), false, "a manual Feed pin must not be auto-archived");

const cache = lifecycle.materialize([expired, archived, recent, future], {
  profileId: "profile:test",
  enrich,
  actionFor: event => event.id === "expired" ? { archived: true } : {},
  now,
});
assert.deepEqual(cache.derivedCards.map(card => card.canonicalEventId), ["future", "expired", "recent"], "only active and saved canonical events may materialise cards");
assert.equal(cache.derivedCards[0].surface, "homeMustWatch");
assert.deepEqual(cache.derivedCards[0].renderPayload.followContext, [{
  participantId: "team:test",
  participantType: "team",
  displayName: "Test Team",
  followLevel: "priority",
}], "disposable card payloads must carry rebuildable follow context");
assert.equal(cache.derivedCards[1].retentionExempt, true);
assert.equal(cache.derivedCards[2].surface, "recent");
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
assert(purged.cache.derivedCards.some(card => card.canonicalEventId === "expired"), "saved cards must survive cache expiry");

let archives = lifecycle.archiveReference([], archived, { profileId: "profile:test", archivedFromCardId: "card:old", now });
assert.equal(archives.length, 1);
assert.equal(archives[0].canonicalEventId, "archived");
assert.deepEqual(lifecycle.rebuildArchive(archives, [archived]).events.map(event => event.id), ["archived"], "archive view must rebuild from canonical truth after cache purge");
assert.equal(lifecycle.isWithinRetention(expired, now, { action: { archived: true } }), true, "existing manual archive records must migrate without data loss");
archives = lifecycle.removeArchiveReference(archives, "archived");
assert.equal(archives.length, 0);
assert.equal(lifecycle.isWithinRetention(expired, now), false, "reinstate/remove must restore the normal expiry boundary");

console.log("Card lifecycle validation passed.");
