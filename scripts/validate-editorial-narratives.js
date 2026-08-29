#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  GENERIC_COPY,
  projectionForTarget,
  validateKnowledge,
} = require("./lib/editorial-narrative.js");

const DAY_MS = 24 * 60 * 60 * 1000;
const reference = new Date(process.env.NS_EDITORIAL_REFERENCE || Date.now());
assert(!Number.isNaN(reference.getTime()), "NS_EDITORIAL_REFERENCE must be a valid date when supplied");

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function eventTime(event){
  const direct = new Date(event.startTimeUtc || "").getTime();
  if (Number.isFinite(direct)) return direct;
  return new Date(`${event.date || ""}T${event.time || "00:00"}:00+10:00`).getTime();
}
function stakesFor(event){ return Number(event.storyline?.stakes || event.stakesScore || 0); }
function byIdentity(records){
  const index = new Map();
  records.forEach(record => [record.id, record.eventId, record.canonicalEventId].filter(Boolean).forEach(id => index.set(id, record)));
  return index;
}
function activeFeedMarquee(events){
  const earliest = reference.getTime() - 6 * 60 * 60 * 1000;
  const latest = reference.getTime() + 45 * DAY_MS;
  return events.filter(event => event.status !== "completed" && stakesFor(event) === 5 && eventTime(event) >= earliest && eventTime(event) <= latest);
}
function activeOrRecentMajor(records){
  const earliest = reference.getTime() - 7 * DAY_MS;
  const latest = reference.getTime() + 45 * DAY_MS;
  return records.filter(record => {
    if (record.kind === "ticket_sale" || record.lifecycleStatus === "retired" || record.stakesScore !== 5) return false;
    const start = new Date(`${record.startDate || ""}T00:00:00Z`).getTime();
    const end = new Date(`${record.endDate || record.startDate || ""}T23:59:59Z`).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end >= earliest && start <= latest;
  });
}
function assertProjected(record, projection, label){
  assert(projection, `${label} needs a persistent editorial projection`);
  assert.equal(record.editorialNarrative?.projectionId, projection.id, `${label} must publish its projection id`);
  assert.equal(record.editorialNarrative?.hook, projection.hook, `${label} must publish the researched hook`);
  assert.equal(record.editorialNarrative?.researchTier, "marquee", `${label} must publish marquee research depth`);
  assert(record.editorialNarrative.factIds.length >= 4, `${label} needs at least four facts`);
  assert(record.editorialNarrative.sourceIds.length >= 3, `${label} needs at least three sources`);
  assert(record.editorialNarrative.dimensions.length >= 3, `${label} needs at least three narrative dimensions`);
  assert(!GENERIC_COPY.test(record.editorialNarrative.hook), `${label} must not publish generic fixture filler`);
}

const knowledge = readJson("data/editorial-knowledge.v1.json");
assert.deepEqual(validateKnowledge(knowledge), [], "persistent editorial knowledge must pass provenance, depth and originality gates");
const incoming = readJson("feeds/incoming/events.json");
const published = readJson("data/events.json");
const majorEvents = readJson("data/major-events.v1.json");
const incomingById = byIdentity(incoming.events);
const publishedById = byIdentity(published.events);
const majorById = byIdentity(majorEvents.events);

knowledge.eventProjections.forEach(projection => {
  projection.targetIds.forEach(targetId => {
    if (projection.targetType === "feed-event") {
      const incomingEvent = incomingById.get(targetId);
      const publishedEvent = publishedById.get(targetId);
      assert(incomingEvent, `${targetId} editorial target must exist in the incoming feed`);
      assert(publishedEvent, `${targetId} editorial target must exist in the published feed`);
      assertProjected(incomingEvent, projection, `incoming ${targetId}`);
      assertProjected(publishedEvent, projection, `published ${targetId}`);
      assert.equal(incomingEvent.selectedSentence, projection.hook, `${targetId} compatibility hook must be updated before publication`);
      assert.equal(publishedEvent.selectedSentence, projection.hook, `${targetId} compatibility hook must survive publication`);
    } else {
      const record = majorById.get(targetId);
      assert(record, `${targetId} editorial target must exist in Events`);
      assertProjected(record, projection, targetId);
      const publishedSourceUrls = new Set(record.sources.map(source => source.url));
      const expectedSourceUrls = knowledge.sources.filter(source => projection.sourceIds.includes(source.id)).map(source => source.url);
      expectedSourceUrls.forEach(url => assert(publishedSourceUrls.has(url), `${targetId} must expose editorial source ${url}`));
    }
  });
});

activeFeedMarquee(incoming.events).forEach(event => {
  const projection = projectionForTarget(knowledge, "feed-event", event);
  assertProjected(event, projection, `active feed marquee ${event.eventId || event.id}`);
});
activeOrRecentMajor(majorEvents.events).forEach(record => {
  const projection = projectionForTarget(knowledge, "major-event", record);
  assertProjected(record, projection, `active/recent major event ${record.id}`);
});

const eventSchema = readJson("schemas/event-feed.schema.json");
const majorSchema = readJson("schemas/major-events.schema.json");
assert(eventSchema.$defs.editorialNarrative, "the feed schema must publish the event editorial projection contract");
assert(majorSchema.$defs.event.properties.editorialNarrative, "the major-event schema must publish the event editorial projection contract");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /state === "compact" && enrichment\.stakesScore >= 3[^]*buildEditorialL0Hook\(selectedSentenceForDisplay\(ev\)\)/, "stakes 3+ feed cards must reveal their hook at L0");
assert.match(html, /state === "compact"[^]*buildEditorialL0Hook\(record\.editorialNarrative\?\.hook \|\| record\.summary\)/, "major-event cards must reveal the researched hook at L0");
assert.match(html, /editorial-l0-hook-label[^]*Why it matters/, "L0 hooks need a visible editorial label");

console.log(`Editorial narratives valid: ${knowledge.narrativeThreads.length} persistent threads, ${knowledge.narrativeFacts.length} sourced facts and ${knowledge.eventProjections.length} event projections; ${activeFeedMarquee(incoming.events).length} active feed marquees and ${activeOrRecentMajor(majorEvents.events).length} active/recent major events are covered at L0.`);
