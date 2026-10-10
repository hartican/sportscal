#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  GENERIC_COPY,
  SUBSTANTIVE_DIMENSIONS,
  TIER_REQUIREMENTS,
  applyToFeedEvent,
  indexesFor,
  projectionForTarget,
  validateKnowledge,
} = require("./lib/editorial-narrative.js");
const competitionClassification = require("../config/competition-classification.js");

const DAY_MS = 24 * 60 * 60 * 1000;
// A researched preview can outlive the fixture. Reapplying it after a
// confirmed final must not overwrite the default spoiler-protected summary.
function validateCompletedProjectionCopy(){
  const lifecycle = require("../config/editorial-lifecycle");
  const { spoilerContractIssues } = require("./lib/storyline-card-rules");
  const source = { id:"source:test:editorial", name:"Reviewed editorial source", url:"https://example.test/review", sourceType:"official", checkedAt:"2026-10-09T09:00:00Z" };
  const indexes = indexesFor({ sources:[source], narrativeFacts:[], narrativeThreads:[] });
  const projection = {
    id:"projection:test:retained-preview", hook:"The Sprint follows qualifying.",
    synopsis:"A rider previously reached the podium here; Saturday offers another test.",
    sourceIds:[source.id], factIds:[], threadIds:[], researchedAt:source.checkedAt, generationMode:"researched",
  };
  const event = {
    id:"event:test:completed-editorial", eventId:"event:test:completed-editorial", name:"Reviewed Sprint",
    status:"completed", outcomeText:"Rider A won the Sprint.", score:"1. Rider A · 2. Rider B", recapText:"Rider A won after the final lap.",
    sourceName:"Fixture organiser", sourceUrl:"https://example.test/result", sourceType:"official", sourceCheckedAt:"2026-10-10T09:00:00Z",
    resultSourceCheckedAt:"2026-10-10T09:00:00Z", startTimeUtc:"2026-10-10T04:00:00Z",
    userActivity:{ dismissed:true, remind:false, results:false },
  };
  const snapshot = JSON.stringify(event), projected = applyToFeedEvent(event,projection,indexes);
  assert.deepEqual(spoilerContractIssues(projected,new Date("2026-10-10T21:17:00Z")),[],"retained pre-race research must not leak through completed root copy");
  assert.equal(projected.selectedSentence,projected.storyline.hookSpoilerOff);
  assert.equal(projected.fullSpiel,projected.storyline.synopsisSpoilerOff);
  assert.equal(projected.editorialNarrative.synopsis,projection.synopsis,"retain dated research separately");
  assert.equal(lifecycle.copy(projected,projected.editorialNarrative,true).hook,event.outcomeText,"revealing results keeps the sourced outcome");
  for (const field of Object.keys(event)) assert.deepEqual(projected[field],event[field],`${field} fixture fact or saved choice must survive projection`);
  assert.equal(JSON.stringify(event),snapshot,"projection must not mutate its input");
  assert.deepEqual(applyToFeedEvent(projected,projection,indexes),projected,"unchanged rerun must retain protected copy");
  const upcoming = applyToFeedEvent({ ...event,status:"upcoming" },projection,indexes);
  assert.equal(upcoming.selectedSentence,projection.hook,"unfinished fixtures retain their preview");
  assert.equal(upcoming.fullSpiel,projection.synopsis);
  const recap = { ...projection,hook:"The Sprint is complete. Reveal results for the outcome.",synopsis:"The key moments are protected here.",hookSpoilerOn:event.outcomeText,synopsisSpoilerOn:event.recapText };
  const recapped = applyToFeedEvent(event,recap,indexes);
  assert.deepEqual(spoilerContractIssues(recapped),[],"reviewed protected recaps remain valid");
  assert.equal(recapped.fullSpiel,recap.synopsis);
  const corrected = applyToFeedEvent({ ...recapped,outcomeText:"Rider B won the Sprint.",score:"1. Rider B · 2. Rider A",recapText:"Rider B won following the official correction." },recap,indexes);
  assert(corrected.editorialNarrative.resultResearchRequired,"a changed outcome must invalidate old recap research");
  assert.deepEqual(spoilerContractIssues(corrected),[]);
  assert.equal(corrected.fullSpiel,corrected.storyline.synopsisSpoilerOff);
  assert.equal(lifecycle.copy(corrected,corrected.editorialNarrative,true).hook,corrected.outcomeText);
}
validateCompletedProjectionCopy();
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
  records.forEach(record => [record.id, record.eventId, record.canonicalEventId].filter(Boolean).flatMap(id=>require("../config/fixture-identity").fixtureAliases(id)).forEach(id => index.set(id, record)));
  return index;
}
function activeFeedMarquee(events){
  return events.filter(event => !require("../config/coverage-pauses").womensT20(event) && event.status !== "completed" && event.schedulePrecision !== "week" && stakesFor(event) === 5 && Number.isFinite(eventTime(event)) && eventTime(event)<=reference.getTime()+30*DAY_MS);
}
function activeOrRecentMajor(records){
  return records.filter(record => record.kind !== "ticket_sale" && record.lifecycleStatus !== "retired" && record.stakesScore === 5);
}
function rollingEditorial(events){
  const earliest = reference.getTime() - 7 * DAY_MS;
  const latest = reference.getTime() + 30 * DAY_MS;
  return events.filter(event => {
    const unresolvedUnverified = event?.editorialPreview?.status === "research-required" && event?.sourceTrust !== "verified";
    return !require("../config/coverage-pauses").womensT20(event) && !unresolvedUnverified && stakesFor(event) >= 2 && eventTime(event) >= earliest && eventTime(event) <= latest;
  });
}
function assertProjected(record, projection, label){
  assert(projection, `${label} needs a persistent editorial projection`);
  assert.equal(record.editorialNarrative?.projectionId, projection.id, `${label} must publish its projection id`);
  assert.equal(record.editorialNarrative?.hook, projection.hook, `${label} must publish the researched hook`);
  assert.equal(record.editorialNarrative?.synopsis, projection.synopsis, `${label} must publish the researched L1/L2 synopsis`);
  for(const field of ['formCopy','closingCopy'])if(projection[field])assert.equal(record.editorialNarrative?.[field],projection[field],`${label} must publish the researched ${field}`);
  const requirement = TIER_REQUIREMENTS[projection.researchDepth || projection.stakes];
  const expectedTier = (projection.researchDepth || projection.stakes) === 5 ? "marquee" : (projection.researchDepth || projection.stakes) === 4 ? "featured" : "standard";
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
const steps=require("./update-cards").buildSteps({localOnly:true});
const applyStep=steps.findIndex(args=>args[0]==="scripts/apply-editorial-narratives.js");
const validationStep=steps.findIndex(args=>args[0]==="scripts/validate-editorial-narratives.js");
assert(steps.slice(applyStep+1,validationStep).some(args=>args[0]==="scripts/build-tennis-feed-parents.js"),"canonical owner must rebuild tournament projections before their editorial gate");
const parents=require("../data/tennis-feed-parents.v1.json").parents;
const sourceCatalogueById=byIdentity([...require("../lib/calendar-catalogue").catalogue(),...parents]);

knowledge.eventProjections.forEach(projection => {
  projection.targetIds.forEach(targetId => {
    if (projection.targetType === "feed-event") {
      const incomingEvent = incomingById.get(targetId);
      const publishedEvent = publishedById.get(targetId);
      if(!incomingEvent&&["major_event","tournament","tennis_parent","tournament_overview"].includes(publishedEvent?.kind)){
        assertProjected(publishedEvent,projection,`retained published overview ${targetId}`);
        return;
      }
      if(!incomingEvent&&parents.some(p=>p.id===targetId)){
        assertProjected(sourceCatalogueById.get(targetId),projection,`parent ${targetId}`);
        if(publishedEvent)assertProjected(publishedEvent,projection,`published parent ${targetId}`);
        return;
      }
      if(!incomingEvent&&!publishedEvent){
        const catalogueEvent=sourceCatalogueById.get(targetId);
        assert(catalogueEvent,`${targetId} editorial target must exist in Feed or the published source catalogue`);
        assertProjected(catalogueEvent,projection,`catalogue ${targetId}`);
        return;
      }
      assert(incomingEvent, `${targetId} editorial target must exist in the incoming feed`);
      assert(publishedEvent, `${targetId} editorial target must exist in the published feed`);
      assertProjected(incomingEvent, projection, `incoming ${targetId}`);
      assertProjected(publishedEvent, projection, `published ${targetId}`);
      for (const [label,event] of [["incoming",incomingEvent],["published",publishedEvent]]){
        if (event.status === "completed"){
          assert.equal(event.selectedSentence,event.storyline?.hookSpoilerOff,`${label} ${targetId} completed root hook must remain spoiler protected`);
          assert.equal(event.fullSpiel,event.storyline?.synopsisSpoilerOff,`${label} ${targetId} completed root synopsis must remain spoiler protected`);
          assert.deepEqual(require("./lib/storyline-card-rules").spoilerContractIssues(event),[],`${label} ${targetId} completed projection must preserve the spoiler contract`);
        } else {
          assert.equal(event.selectedSentence,projection.hook,`${label} ${targetId} compatibility hook must publish its researched preview`);
        }
      }
    } else {
      if (!competitionClassification.belongsInEvents(targetId)) return;
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
  if(projection)assertProjected(event, projection, `rolling stakes-${stakesFor(event)} feed ${event.eventId || event.id}`);
  else assert(!require("../config/enrichment-engine").editorialNarrativeReadyForCard(event.editorialNarrative),"unresearched copy stays hidden while the fixture remains valid");
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
assert(html.includes("appendFixtureCardInformation(mainDiv,ev,") && html.includes("parent.appendChild(whyItMatters)") && html.includes("buildInlineCrowdRating(ev,snapshot)"), "Feed retains editorial alongside the standard one-tap rating input");
assert.doesNotMatch(html, /labelText:"Independent context"/, "expanded cards must not repeat editorial in a second metadata box");
assert.doesNotMatch(html, /editorialNarrativeCopyForDisplay\(/, "selected and opened cards must not repeat a second synopsis block beneath Why it matters");
assert(html.includes('buildEventCard(event, {mode:"events"') || html.includes("eventParent:record"), "Events fixtures use the shared fixture renderer");
assert.match(html, /if \(completed\) return isSpoilerVisible\(record\)[^]*resultSignature[^]*spoilerOnSentence/, "completed cards must only show result consequences matching the current result, never stale preview consequences");
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
