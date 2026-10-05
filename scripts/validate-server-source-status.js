"use strict";

const assert = require("node:assert/strict");
const pipeline = require("../lib/server-feed-pipeline");
const matchCentre = require("../config/match-centre");
const pilots = new Set(require("../config/quality/coverage-contract.json").pilotCompetitions.map(pilot => pilot.id));
const finals = require("../data/code-inspector/football.json").fixtures.filter(fixture => pilots.has(fixture.competitionId) && fixture.status === "completed");
assert(finals.length > 0, "Current published pilot finals are available; the gate covers new finals as they arrive");
for (const fixture of finals) {
  const original = structuredClone(fixture);
  const now = new Date(fixture.scoreCheckedAt || fixture.statusCheckedAt || fixture.sourceCheckedAt);
  assert(Number.isFinite(+now), "Actual retained observation date is available");
  const normalized = pipeline.normalizeEvent(fixture, now);
  assert.equal(normalized.status, "completed", "A published Football final must remain final through shared API normalization");
  assert.equal(matchCentre.eligible(normalized, +now), matchCentre.eligible(fixture, +now), "Normalization cannot turn an old final into an unresolved Match Centre fixture");
  assert.equal(normalized.scoreCheckedAt, fixture.scoreCheckedAt);
  assert.equal(normalized.statusCheckedAt, fixture.statusCheckedAt);
  assert.deepEqual(fixture, original, "Original fixture and source observations remain immutable");
}

const fixture = finals[0];
const start = Date.parse(fixture.startTimeUtc);
for (const status of ["completed", "finished", "final", "live", "in-progress", "stumps", "suspended", "interrupted", "delayed", "rain-delay", "break", "cancelled", "canceled", "abandoned", "postponed", "withdrawn", "upcoming", "scheduled"]) {
  for (const offset of [-3600000, 1800000, 12 * 3600000]) {
    const input = {...fixture, status};
    const normalized = pipeline.normalizeEvent(input, new Date(start + offset));
    assert.equal(normalized.status, status, "The clock cannot rewrite supplied match phase: " + status);
    assert.equal(normalized.scoreCheckedAt, input.scoreCheckedAt);
  }
}
for (const extra of [{}, {dateOnly: true, timePrecision: "date-only", endDate: fixture.date}]) {
  const input = {...fixture, ...extra};
  delete input.status;
  assert(!["live", "in-progress", "completed", "finished", "final"].includes(pipeline.normalizeEvent(input, new Date(start + 1800000)).status), "Missing match observations cannot become live/final from dates alone");
}
const finished = {...fixture, firstConfirmedCompleteAt: new Date(start + 2 * 3600000).toISOString()};
assert(matchCentre.eligible(pipeline.normalizeEvent(finished, new Date(start + 2.5 * 3600000)), start + 2.5 * 3600000));
assert(!matchCentre.eligible(pipeline.normalizeEvent(finished, new Date(start + 3.5 * 3600000)), start + 3.5 * 3600000), "The existing one-hour confirmed-completion boundary remains");

const state = {
  preferences: {
    version: 25,
    onboardingComplete: true,
    preferenceGraph: {entityFollows: [{participantId: fixture.participantIds[0], followLevel: "follow"}]},
    showSpoilers: false,
  },
  event_user_state: {[pipeline.eventActionKey(fixture)]: {eventId: fixture.id, reminderChoice: "off", reminderSource: "manual"}},
};
const originalState = structuredClone(state);
function build(input, now, matchCentreOnly) {
  return pipeline.buildServerFeed({events: [input], userId: "local-status-regression", userState: state, now: new Date(now), matchCentreOnly, tennisProjection: {parents: [], contests: []}});
}
const feed = build(finished, start + 3.5 * 3600000, false);
assert.equal(feed.events.length, 1, "Ordinary eligible Feed retains the completed fixture");
assert.equal(feed.events[0].status, "completed");
assert.equal(build(finished, start + 2.5 * 3600000, true).events.length, 1, "Confirmed completion remains in Match Centre during its existing hour");
assert.equal(build(finished, start + 3.5 * 3600000, true).events.length, 0, "Real shared composition removes it after that hour");
assert.equal(build(fixture, start + 4 * 3600000, true).events.length, 0, "A final without a completion clock cannot be re-admitted as unresolved play");
assert.deepEqual(state, originalState, "Feed and Match Centre preserve original preferences and Remind OFF");

console.log("Server source status: all " + finals.length + " actual pilot finals remain final; controlled match phases and missing observations preserve source authority and original clocks.");
