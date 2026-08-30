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
function stakesFor(event){
  const stored = Number(event.storyline?.stakes || event.stakesScore || 0);
  if (stored) return stored;
  const expected = Number(event.expected || 0);
  return expected >= 10 ? 5 : expected >= 8 ? 4 : expected >= 6 ? 3 : expected >= 4 ? 2 : 1;
}
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
  assert.equal(record.editorialNarrative?.synopsis, projection.synopsis, `${label} must publish the researched L1/L2 synopsis`);
  const requirement = TIER_REQUIREMENTS[projection.stakes];
  const expectedTier = projection.stakes === 5 ? "marquee" : projection.stakes === 4 ? "featured" : "standard";
  const expectedSchema = projection.consequence ? "editorial-narrative.v3" : "editorial-narrative.v2";
  assert.equal(record.editorialNarrative?.schemaVersion, expectedSchema, `${label} must publish the compatible ${expectedSchema} projection writer`);
  if (projection.consequence) assert.deepEqual(record.editorialNarrative.consequence, projection.consequence, `${label} must publish its immutable sourced consequence snapshot`);
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
assert(eventSchema.$defs.editorialNarrative.properties.consequence, "the feed schema must publish optional editorial-consequence.v1 snapshots");
assert(eventSchema.$defs.editorialNarrative.properties.schemaVersion.enum.includes("editorial-narrative.v3"), "the feed schema must accept v3 while retaining v1/v2 readers");
assert(majorSchema.$defs.event.properties.editorialNarrative, "the major-event schema must publish the event editorial projection contract");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /state === "compact"[^]*buildEditorialL0Hook\(editorialNarrativeHookForDisplay\(ev\), editorialConsequenceForDisplay\(ev\)\)/, "researched feed cards must reveal their validated editorial hooks and dedicated consequence at L0");
assert.match(html, /editorialNarrativeCopyForDisplay\(ev, state\)[^]*selectedSentenceForDisplay\(ev\)/, "selected Feed cards must prefer validated editorial copy to structural fallback text");
assert.match(html, /editorialNarrativeCopyForDisplay\(record, state\)/, "selected and opened Major Events cards must render their validated editorial copy");
assert.match(html, /state === "compact"[^]*buildEditorialL0Hook\(editorialNarrativeHookForDisplay\(record\), editorialConsequenceForDisplay\(record\)\)/, "major-event cards must reveal only validated editorial hooks and consequences at L0");
assert.match(html, /completed && isSpoilerVisible\(record\)[^]*spoilerOnSentence[^]*previewSentence/, "completed spoiler-on cards must prefer sourced result consequences while spoiler-off retains preview copy");
assert.doesNotMatch(html, /buildEditorialL0Hook\((?:selectedSentenceForDisplay\(ev\)|record\.summary)/, "schedule and structural fallback copy must never be relabelled Why it matters");
assert.match(html, /editorial-l0-hook-label[^]*Why it matters/, "L0 hooks need a visible editorial label");
const completedProjection = knowledge.eventProjections.find(projection => projection.id === "projection:feed:dutch-gp-race-2026");
assert(completedProjection?.hookSpoilerOn && completedProjection.hookSpoilerOn !== completedProjection.hook, "retained completed cards need distinct spoiler-safe and result-aware hooks");
const warriors = incomingById.get("event-nrl-129992607");
assert.equal(warriors?.name, "Warriors v Knights", "the first consequence backfill must target Warriors v Knights");
assert.equal(warriors?.editorialNarrative?.schemaVersion, "editorial-narrative.v3", "Warriors v Knights must publish the first v3 consequence narrative");
assert.match(warriors.editorialNarrative.consequence.previewSentence, /^If Warriors win,/i, "Warriors v Knights must use a dedicated If-then consequence sentence");
assert.doesNotMatch(warriors.editorialNarrative.consequence.previewSentence, /if Knights win/i, "the preview consequence must stay led by the clearest verified side");
assert.equal(warriors.editorialNarrative.consequence.participants.length, 2, "structured pre-match needs must preserve both teams for result-aware copy");
assert.doesNotMatch(warriors.editorialNarrative.consequence.previewSentence, /Roosters/i, "the unverified Roosters path must not be published");
assert(Date.parse(warriors.editorialNarrative.consequence.capturedAt) <= eventTime(warriors), "the Warriors v Knights needs snapshot must be captured before kickoff");

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
