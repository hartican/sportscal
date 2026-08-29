#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  GENERIC_COPY,
  SUBSTANTIVE_DIMENSIONS,
  TIER_REQUIREMENTS,
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
  return events.filter(event => event.status !== "completed" && stakesFor(event) === 5);
}
function activeOrRecentMajor(records){
  return records.filter(record => record.kind !== "ticket_sale" && record.lifecycleStatus !== "retired" && record.stakesScore === 5);
}
function rollingEditorial(events){
  const earliest = reference.getTime() - 7 * DAY_MS;
  const latest = reference.getTime() + 30 * DAY_MS;
  return events.filter(event => stakesFor(event) >= 2 && eventTime(event) >= earliest && eventTime(event) <= latest);
}
function assertProjected(record, projection, label){
  assert(projection, `${label} needs a persistent editorial projection`);
  assert.equal(record.editorialNarrative?.projectionId, projection.id, `${label} must publish its projection id`);
  assert.equal(record.editorialNarrative?.hook, projection.hook, `${label} must publish the researched hook`);
  const requirement = TIER_REQUIREMENTS[projection.stakes];
  const expectedTier = projection.stakes === 5 ? "marquee" : projection.stakes === 4 ? "featured" : "standard";
  assert.equal(record.editorialNarrative?.schemaVersion, "editorial-narrative.v2", `${label} must publish the v2 projection writer`);
  assert.equal(record.editorialNarrative?.researchTier, expectedTier, `${label} must publish the correct research depth`);
  assert(record.editorialNarrative.factIds.length >= requirement.facts, `${label} needs at least ${requirement.facts} facts`);
  assert(record.editorialNarrative.sourceIds.length >= requirement.sources, `${label} needs at least ${requirement.sources} sources`);
  assert(record.editorialNarrative.dimensions.length >= requirement.dimensions, `${label} needs at least ${requirement.dimensions} narrative dimensions`);
  assert(record.editorialNarrative.dimensions.some(dimension => SUBSTANTIVE_DIMENSIONS.has(dimension)), `${label} needs a substantive path, form, matchup, history or consequence dimension`);
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
      expectedSourceUrls.forEach(url => assert(publishedSourceUrls.has(url), `${targetId} must retain editorial source ${url} in its audit data`));
    }
  });
});

activeFeedMarquee(incoming.events).forEach(event => {
  const projection = projectionForTarget(knowledge, "feed-event", event);
  assertProjected(event, projection, `active feed marquee ${event.eventId || event.id}`);
});
rollingEditorial(incoming.events).forEach(event => {
  const projection = projectionForTarget(knowledge, "feed-event", event);
  assertProjected(event, projection, `rolling stakes-${stakesFor(event)} feed ${event.eventId || event.id}`);
});
activeOrRecentMajor(majorEvents.events).forEach(record => {
  const projection = projectionForTarget(knowledge, "major-event", record);
  assertProjected(record, projection, `active/recent major event ${record.id}`);
});

const eventSchema = readJson("schemas/event-feed.schema.json");
const majorSchema = readJson("schemas/major-events.schema.json");
assert(eventSchema.$defs.editorialNarrative, "the feed schema must publish the event editorial projection contract");
assert(eventSchema.$defs.editorialNarrative.properties.sentiment, "the feed schema must publish optional privacy-safe Sentiment");
assert(majorSchema.$defs.event.properties.editorialNarrative, "the major-event schema must publish the event editorial projection contract");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /state === "compact" && enrichment\.stakesScore >= 2[^]*buildEditorialL0Hook\(editorialNarrativeHookForDisplay\(ev\)\)/, "stakes 2+ feed cards must reveal only validated editorial hooks at L0");
assert.match(html, /state === "compact"[^]*buildEditorialL0Hook\(editorialNarrativeHookForDisplay\(record\)\)/, "major-event cards must reveal only validated editorial hooks at L0");
assert.doesNotMatch(html, /buildEditorialL0Hook\((?:selectedSentenceForDisplay\(ev\)|record\.summary)/, "schedule and structural fallback copy must never be relabelled Why it matters");
assert.match(html, /editorial-l0-hook-label[^]*Why it matters/, "L0 hooks need a visible editorial label");
const completedProjection = knowledge.eventProjections.find(projection => projection.id === "projection:feed:dutch-gp-race-2026");
assert(completedProjection?.hookSpoilerOn && completedProjection.hookSpoilerOn !== completedProjection.hook, "retained completed cards need distinct spoiler-safe and result-aware hooks");

const unsupportedNames = /X Games Melbourne|Davos.*Telemark/i;
assert(!incoming.events.some(event => unsupportedNames.test(event.name || "")), "unsupported X Games Melbourne and Davos Telemark cards must stay retired");
const correctedStarts = new Map([
  ["rugby-argentina-australia-mendoza-2026-09-06", "2026-09-05T21:00:00.000Z"],
  ["evt_27", "2026-09-06T13:00:00.000Z"],
  ["evt_30", "2026-09-25T12:00:00.000Z"],
  ["evt_31", "2026-09-26T11:00:00.000Z"],
]);
correctedStarts.forEach((expected, id) => {
  assert.equal(incomingById.get(id)?.startTimeUtc, expected, `${id} must retain its verified UTC start`);
});
const shahdag = incomingById.get("evt_104");
assert.equal(shahdag?.date, "2027-03-05", "Shahdag must begin on 5 March 2027");
assert.equal(shahdag?.dateOnly, true, "Shahdag must stay date-only until the daily schedule is published");
assert.equal(shahdag?.timeTbc, true, "Shahdag time must remain TBC");
assert.equal(shahdag?.startTimeUtc, null, "Shahdag must not publish an invented start time");
const nationsChampionship = majorById.get("major-event:nations-championship-finals-2026");
assert.equal(nationsChampionship?.startDate, "2026-11-27", "Nations Championship Finals must begin 27 November");
assert.equal(nationsChampionship?.endDate, "2026-11-29", "Nations Championship Finals must end 29 November");
const australianGrandPrix = majorById.get("major-event:australian-grand-prix-2027");
assert.equal(australianGrandPrix?.dateStatus, "tbc", "2027 Australian Grand Prix date must remain TBC");
assert.equal(australianGrandPrix?.startDate, null, "2027 Australian Grand Prix must not publish an unverified start date");
assert.equal(australianGrandPrix?.endDate, null, "2027 Australian Grand Prix must not publish an unverified end date");

console.log(`Editorial narratives valid: ${knowledge.narrativeThreads.length} persistent threads, ${knowledge.narrativeFacts.length} sourced facts and ${knowledge.eventProjections.length} event projections; ${rollingEditorial(incoming.events).length} rolling stakes-2+ cards, ${activeFeedMarquee(incoming.events).length} surfaced Feed marquees and ${activeOrRecentMajor(majorEvents.events).length} Major Events are covered at L0.`);
