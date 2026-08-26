#!/usr/bin/env node
const assert = require("node:assert/strict");
const feed = require("../config/personalised-feed.js");

const now = new Date("2026-08-19T00:00:00.000Z");
const pastEarly = { id: "past-early", startTimeUtc: "2026-08-17T02:00:00.000Z" };
const pastLate = { id: "past-late", startTimeUtc: "2026-08-18T02:00:00.000Z" };
const todayEarly = { id: "today-early", startTimeUtc: "2026-08-19T01:00:00.000Z" };
const todayLate = { id: "today-late", startTimeUtc: "2026-08-19T08:00:00.000Z" };
const future = { id: "future", startTimeUtc: "2026-08-20T02:00:00.000Z" };
const sameTimeA = { id: "same-a", startTimeUtc: "2026-08-21T02:00:00.000Z" };
const sameTimeB = { id: "same-b", startTimeUtc: "2026-08-21T02:00:00.000Z" };
const actions = {
  "today-late": { mustWatch: true, mustWatchAddedAt: "2026-08-18T00:00:00.000Z" },
  "past-late": { mustWatch: true, mustWatchAddedAt: "2026-08-18T00:00:00.000Z" },
};
const actionFor = event => actions[event.id] || {};

assert.equal(feed.normaliseFeedIntent("focused"), "focused");
assert.equal(feed.normaliseFeedIntent("unknown"), "balanced");
assert.equal(feed.eventStart({ date: "2026-08-19", time: "20:00" }).toISOString(), "2026-08-19T10:00:00.000Z", "legacy wall-clock starts must resolve in Australia/Sydney");
assert.deepEqual(
  feed.sortChronological([sameTimeB, future, sameTimeA]).map(event => event.id),
  ["future", "same-a", "same-b"],
  "canonical IDs must deterministically break equal start-time ties"
);
assert.deepEqual(feed.splitTimeline([
  todayLate,
  sameTimeB,
  pastLate,
  future,
  pastEarly,
  sameTimeA,
  todayEarly,
], actionFor, now), {
  retainedPast: [pastEarly, pastLate],
  today: [todayEarly, todayLate],
  future: [future, sameTimeA, sameTimeB],
}, "manual picks and recommendation state must never split or reorder the canonical timeline");
assert.equal(feed.eventStart({ id: "tbc", date: "2026-08-19", timeTbc: true }), null, "timeless TBC fixtures must not receive a false start");
assert.equal(feed.eventStart({ id: "timeless", date: "2026-08-19" }), null, "a date without an explicit date-only contract must stay out of Fixtures");
assert(feed.eventStart({ id: "tournament", date: "2026-08-19", dateOnly: true }), "genuine date-only tournaments must receive a deterministic Sydney start-of-day");
assert.deepEqual(
  feed.timelineBoundaryPresentation({ retainedPast: [todayLate], today: [], future: [future] }, now),
  { todayCopy: "Nothing else today", nextDateBadge: "Tomorrow" },
  "an empty remainder of today must not put an unexplained Today divider above tomorrow's earlier clock time"
);
assert.deepEqual(
  feed.timelineBoundaryPresentation({ retainedPast: [pastLate], today: [todayLate], future: [future] }, now),
  { todayCopy: "Today", nextDateBadge: "Tomorrow" },
  "today must remain the boundary label when an upcoming card still exists today"
);

console.log("Personalised feed valid: one canonical ascending timeline with stable ties and no Must Watch queue.");
