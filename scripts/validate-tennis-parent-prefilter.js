"use strict";

const assert = require("node:assert/strict");
const tennis = require("../config/tennis-feed");
const policy = require("../config/follow-feed-policy");
const pipeline = require("../lib/server-feed-pipeline");
const projection = require("../data/tennis-feed-parents.v1.json");
const events = require("../lib/calendar-catalogue").catalogue();
const original = structuredClone(events);
const existingIds = new Set(events.map(event => String(event.canonicalEventId || event.eventId || event.id || "")));
const completeEvents = [...events, ...projection.contests.filter(event => !existingIds.has(String(event.canonicalEventId || event.eventId || event.id || "")))];
const reconcile = tennis.reconcile;
const calls = [];

try {
  tennis.reconcile = (parent, candidates) => {
    const result = reconcile(parent, candidates);
    assert.deepEqual(result, reconcile(parent, completeEvents), "Actual tournament children, participation, exclusions and dates match the complete catalogue");
    calls.push({
      candidates: candidates.length,
      unrelated: candidates.filter(event => !event || !policy.sportKey(event).startsWith("tennis")).length,
    });
    return result;
  };
  const output = pipeline.buildServerFeed({
    events,
    userId: "public-match-centre",
    userState: {
      preferences: {
        onboardingComplete: true,
        selectedSelectorEntityIds: [],
        preferenceGraph: {
          competitionPreferences: [{competitionId: "competition:premier-league-2026-27", enabled: true}],
          entityFollows: [],
          domainPreferences: [],
        },
      },
      event_user_state: {},
    },
    matchCentreOnly: true,
    limit: 50,
    now: new Date("2026-10-05T03:04:42.884Z"),
  });
  assert(calls.length > 0, "The actual shared pipeline rebuilds current tournament parents");
  assert(calls.every(call => call.unrelated === 0), "Tennis reconstruction must not repeatedly classify unrelated sports in the actual Football API path");
  assert(calls.every(call => call.candidates < events.length), "Mixed catalogue reconstruction remains bounded to possible tennis children");
  assert.equal(output.events.length, 0, "The captured quiet Football Match Centre remains empty");
  assert.deepEqual(events, original, "The actual canonical catalogue input remains immutable");
} finally {
  tennis.reconcile = reconcile;
}

console.log("Tennis parent scope: actual tournament output, quiet Football response and immutable inputs agree; unrelated sports are excluded from repeated reconstruction.");
