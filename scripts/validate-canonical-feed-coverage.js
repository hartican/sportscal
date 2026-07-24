#!/usr/bin/env node

const assert = require("assert/strict");
const { readJson } = require("./lib/feed-utils");

const canonicalPath = process.argv[2] || "data/canonical/afl-nrl-2026.json";
const feedPath = process.argv[3] || "data/events.json";
const canonical = readJson(canonicalPath);
const feed = readJson(feedPath);
const basisTime = Date.parse(feed.publishedAt);
const liveWindowMs = 3 * 60 * 60 * 1000;
const eligible = canonical.events.filter(event =>
  ["sport:afl", "sport:nrl"].includes(event.sportDomainId)
  && event.status === "scheduled"
  && event.startTimeUtc
  && Date.parse(event.startTimeUtc) + liveWindowMs >= basisTime
);
const eligibleIds = new Set(eligible.map(event => event.id));
const publishedCards = feed.events.filter(event => eligibleIds.has(event.canonicalEventId));
const publishedIds = new Set(publishedCards.map(event => event.canonicalEventId));
const missing = eligible.filter(event => !publishedIds.has(event.id));
const duplicates = publishedCards.filter((event, index, items) =>
  items.findIndex(item => item.canonicalEventId === event.canonicalEventId) !== index
);

assert.equal(missing.length, 0, `missing confirmed canonical fixtures: ${missing.map(event => event.id).join(", ")}`);
assert.equal(duplicates.length, 0, `duplicate canonical fixture cards: ${duplicates.map(event => event.canonicalEventId).join(", ")}`);
assert(publishedCards.every(event => event.status === "upcoming"), "canonical scheduled fixture cards must remain upcoming");
assert(
  publishedCards.every(event => event.canonicalSourceType === "official" && /^https:\/\//.test(event.canonicalSourceUrl || "")),
  "canonical fixture cards must retain official schedule provenance"
);
assert(publishedCards.every(event => !/\s(?:vs\.?|versus)\s/i.test(event.name)), "canonical fixture cards must use v");
const staleRoutineCards = feed.events.filter(event =>
  event.narrativeType === "regular-season-fixture"
  && eligibleIds.has(event.canonicalEventId) === false
  && canonical.events.some(fixture => fixture.id === event.canonicalEventId && fixture.status === "scheduled")
);
assert.equal(staleRoutineCards.length, 0, `stale routine cards must be removed: ${staleRoutineCards.map(event => event.id).join(", ")}`);

const counts = publishedCards.reduce((result, event) => {
  result[event.key] = (result[event.key] || 0) + 1;
  return result;
}, {});
const tbcCount = canonical.events.filter(event =>
  ["sport:afl", "sport:nrl"].includes(event.sportDomainId)
  && event.status === "scheduled"
  && !event.startTimeUtc
).length;

console.log(`Canonical feed coverage valid: AFL ${counts.afl || 0}; NRL ${counts.nrl || 0}; ${publishedCards.length} confirmed scheduled cards.`);
console.log(`${tbcCount} official fixtures remain excluded until their start times are confirmed.`);
