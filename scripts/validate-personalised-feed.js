#!/usr/bin/env node
const assert = require("node:assert/strict");
const feed = require("../config/personalised-feed.js");

const now = new Date("2026-08-19T00:00:00.000Z");
const past = { id: "past", date: "2026-08-17", time: "12:00" };
const queueFuture = { id: "queue-future", date: "2026-08-22", time: "21:00" };
const queuePast = { id: "queue-past", date: "2026-08-18", time: "12:00" };
const today = { id: "today", date: "2026-08-19", time: "20:00" };
const future = { id: "future", date: "2026-08-20", time: "12:00" };
const actions = {
  "queue-future": { mustWatch: true, mustWatchAddedAt: "2026-08-18T00:00:00.000Z" },
  "queue-past": { mustWatch: true, mustWatchAddedAt: "2026-08-18T00:00:00.000Z" },
};
const actionFor = event => actions[event.id] || {};

assert.equal(feed.normaliseFeedIntent("focused"), "focused");
assert.equal(feed.normaliseFeedIntent("unknown"), "balanced");
assert.equal(feed.normaliseMustWatchAction({ mustWatch: true }, queueFuture, now).mustWatchAddedAt, now.toISOString());
assert.equal(feed.isRetainedMustWatch(queuePast, actionFor(queuePast), now), true, "past Must Watch cards stay for three days");
assert.equal(feed.isRetainedMustWatch({ id: "expired", date: "2026-08-14", time: "12:00" }, { mustWatch: true }, now), false, "expired Must Watch cards leave the queue");
assert.deepEqual(feed.queueEvents([queueFuture, queuePast], actionFor, now).map(event => event.id), ["queue-past", "queue-future"], "Must Watch is chronological");
assert.deepEqual(feed.splitTimeline([past, queueFuture, queuePast, today, future], actionFor, now), {
  retainedPast: [past],
  mustWatch: [queuePast, queueFuture],
  today: [today],
  future: [future],
}, "feed order is past, Must Watch, Today, then future");

console.log("Personalised feed valid: persistent intent and chronological three-day Must Watch timeline.");
