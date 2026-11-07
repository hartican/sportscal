#!/usr/bin/env node

const assert = require("node:assert/strict");
const lifecycle = require("../config/card-lifecycle.js");
require("./validate-multiday-retention");

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
assert.equal(lifecycle.RETENTION_DAYS, 7);
assert.equal(lifecycle.sydneyEndOfDay("2026-07-10").toISOString(), "2026-07-10T13:59:59.999Z", "winter date-only retention must end at Sydney midnight");
assert.equal(lifecycle.sydneyEndOfDay("2026-12-10").toISOString(), "2026-12-10T12:59:59.999Z", "summer date-only retention must follow Sydney daylight saving");
assert.equal(lifecycle.isWithinRetention(recent, now), true);
assert.equal(lifecycle.lifecycleState(recent, { now }).state, "active");
assert.equal(lifecycle.lifecycleState(archived, { now }).state, "expired");
assert.equal(lifecycle.isWithinRetention(expired, now), false);
assert.equal(lifecycle.isWithinRetention(future, now), true);
assert.equal(lifecycle.lifecycleState(expired, { action: { watchLater: true }, now }).state, "expired");
assert.equal(lifecycle.lifecycleState(expired, { action: { archived: true }, now }).state, "expired", "ordinary manually archived cards retire after seven local days");
assert.equal(lifecycle.lifecycleState(expired, { action: { addedToFixtures: true }, now }).state, "expired", "ordinary manually pinned cards retire after seven local days");
assert.equal(lifecycle.isWithinRetention(expired, now, { action: { archived: true } }), false, "manual archive history does not exempt an ordinary card");
assert.equal(lifecycle.shouldAutoArchive(archived, now), false);
assert.equal(lifecycle.shouldAutoArchive(expired, now, { archived: true }), false, "a manual archive must not be mistaken for automatic expiry");
assert.equal(lifecycle.shouldAutoArchive(expired, now, { addedToFixtures: true }), false, "a manual Feed pin must not be auto-archived");

const cache = lifecycle.materialize([expired, archived, recent, future], {
  profileId: "profile:test",
  enrich,
  actionFor: event => event.id === "expired" ? { archived: true } : {},
  now,
});
assert.deepEqual(cache.derivedCards.map(card => card.canonicalEventId), ["future", "recent"], "only active and saved canonical events may materialise cards");
assert.equal(cache.derivedCards[0].surface, "homeMustWatch");
assert.deepEqual(cache.derivedCards[0].renderPayload.followContext, [{
  participantId: "team:test",
  participantType: "team",
  displayName: "Test Team",
  followLevel: "priority",
}], "disposable card payloads must carry rebuildable follow context");
assert.equal(cache.derivedCards[1].retentionExempt, false);
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
assert(!purged.cache.derivedCards.some(card => card.canonicalEventId === "expired"), "expired ordinary saved cards cannot survive cache expiry");
assert.equal(lifecycle.normalizeCache({...cache,schemaVersion:"derived-card-cache.v1"}).derivedCards.length,0,"old saved-exemption caches rebuild on upgrade");

let archives = lifecycle.archiveReference([], archived, { profileId: "profile:test", archivedFromCardId: "card:old", now });
assert.equal(archives.length, 1);
assert.equal(archives[0].canonicalEventId, "archived");
assert.deepEqual(lifecycle.rebuildArchive(archives, [archived]).events.map(event => event.id), ["archived"], "archive view must rebuild from canonical truth after cache purge");
assert.equal(lifecycle.isWithinRetention(expired, now, { action: { archived: true } }), false, "archive references are retained, while ordinary cards retire");
archives = lifecycle.removeArchiveReference(archives, "archived");
assert.equal(archives.length, 0);
assert.equal(lifecycle.isWithinRetention(expired, now), false, "reinstate/remove must restore the normal expiry boundary");


// State and calendar deadlines must remain exact while the current lifecycle
// owner avoids repeating the same Sydney conversion for its two output fields.
const calendar = require("../config/calendar-export");
const epic = require("../config/epic-classics");
const deadlineCases = [
  { id:"date-only", date:"2026-10-18", status:"scheduled" },
  { id:"multiday", date:"2026-10-18", endDate:"2026-10-22", status:"scheduled" },
  { id:"actual-final", date:"2026-10-18", endDate:"2026-10-22", status:"completed", actualEndTimeUtc:"2026-10-19T01:00:00Z" },
  { id:"unknown", date:"unknown", status:"scheduled" },
  { id:"invalid", date:"2026-02-30", status:"completed" },
  { id:"paused", date:"2026-10-18", status:"suspended" },
  { id:"postponed", date:"2026-10-18", status:"postponed" },
  { id:"ongoing", date:"2026-10-01", status:"live", statusCheckedAt:"2026-10-20T01:00:00Z", statusSourceUrl:"https://example.test/match" },
];
for(const iso of ["2026-04-04T15:59:59Z","2026-04-04T16:00:01Z","2026-10-03T15:59:59Z","2026-10-03T16:00:01Z","2026-10-20T01:01:00Z"]){
  const reference=new Date(iso);
  for(const input of deadlineCases)for(const action of [{},{watchLater:true},{archived:true},{addedToFixtures:true},{isPurged:true}]){
    const event=Object.freeze({...input});
    const expiresAt=lifecycle.expiresAtForEvent(event,reference);
    const saved=lifecycle.isRetentionExemptAction(action);
    assert.deepEqual(lifecycle.lifecycleState(event,{action,now:reference}),{
      state:action.isPurged||epic.retired(event,reference)?"expired":saved?"saved":"active",
      saved,
      archivesAt:expiresAt?new Date(+expiresAt-1).toISOString():null,
      expiresAt:expiresAt?.toISOString()||null,
    },"State keeps the same source-qualified final day, action and exact archive/expiry instants");
  }
}
const calendarStart=calendar.eventStart;
let lifecycleConversions=0;
try{
  calendar.eventStart=function(...args){lifecycleConversions++;return calendarStart.apply(this,args);};
  const reference=new Date("2026-10-20T01:01:00Z");
  const deadline=lifecycle.lifecycleState(deadlineCases[0],{now:reference});
  assert(deadline.expiresAt&&deadline.archivesAt,"The counter must exercise a real dated Sydney deadline");
  assert.equal(lifecycleConversions,1,"One state result reuses its exact lifecycle deadline for both output fields");
}finally{calendar.eventStart=calendarStart;}

console.log("Card lifecycle validation passed.");
