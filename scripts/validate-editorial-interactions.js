#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const followFirst = require("../config/follow-first.js");

const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const majorEvents = JSON.parse(fs.readFileSync("data/major-events.v1.json", "utf8"));
const knowledge = JSON.parse(fs.readFileSync("data/editorial-knowledge.v1.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const projections = new Map(knowledge.eventProjections.map(projection => [projection.id, projection]));

const projectedRecords = [...feed.events, ...majorEvents.events].filter(record => record.editorialNarrative);
assert(projectedRecords.length > 0, "the regression must exercise published editorial cards");
projectedRecords.forEach(record => {
  const projection = projections.get(record.editorialNarrative.projectionId);
  if(!projection){
    const historical=!(feed.events||[]).some(e=>e.id===record.id)&&record.lifecycleStatus==='retired';
    const fixtureOrOverview=record.editorialNarrative.generationMode==='verified-parent-child-projection'||require('../config/follow-feed-policy').aggregateEvent(record)||record.narrativeType==='tennis-tournament-overview';
    assert(historical||fixtureOrOverview,`${record.id} must reference a known editorial projection`);
    assert(record.editorialNarrative.sourceIds.length,'retained source projections keep provenance');return;
  }
  assert.equal(record.editorialNarrative.synopsis, projection.synopsis, `${record.id} must carry the researched synopsis into selected and opened card states`);
});
assert.match(html, /function buildEventWhyItMatters\(ev\)[\s\S]*editorialNarrativeHookForDisplay\(ev\)[\s\S]*editorialConsequenceForDisplay\(ev\)/, "the single Why it matters component must resolve validated editorial projection copy");
assert.doesNotMatch(html, /function crowdEditorialSupplement\(/, "all crowd phases must remain outside sourced Why it matters copy");
assert.doesNotMatch(html, /supplementalCopy:crowdEditorialSupplement/, "crowd results must stay out of sourced Why it matters copy");
assert.doesNotMatch(html, /buildIndependentContext\(/, "Feed and Events cards must not repeat a separate Independent context box");
const mergeContext={followedScheduleFixtures:new Map([['test',[{id:'older-provider',name:'Team A v Team B',editorialNarrative:{hook:'Older'}}]]]),footballFixtureEventsByBundle:new Map(),liveFixtureEvents:[],eventMeetsDerivedRetention:()=>true,mainFeedFixtureSemanticKey:e=>e.name,uniqueArray:values=>[...new Set(values.filter(Boolean))],NOTHINGSPORTS_FIXTURE_IDENTITY:require('../config/fixture-identity')};
require('node:vm').createContext(mergeContext);
require('node:vm').runInContext(html.slice(html.indexOf('function mergeFootballFixtureEvents('),html.indexOf('function liveScheduleFixtures(')),mergeContext);
const mergedEditorial=mergeContext.mergeFootballFixtureEvents([{id:'canonical-provider',name:'Team A v Team B',editorialNarrative:{hook:'Researched canonical'}}]);
assert.equal(mergedEditorial.length,1);assert.equal(mergedEditorial[0].editorialNarrative.hook,'Researched canonical','Later canonical research supersedes lazy fixture metadata');
assert(mergedEditorial[0].sourceEventIds.includes('older-provider'),'Provider aliases survive editorial merging');

assert.equal(typeof followFirst.toggleFeedback, "function", "follow-first feedback must expose a repeat-tap toggle");
const basePreferences = followFirst.migratePreferences({});
const feedbackInput = {
  eventId:"event:toggle-like",
  direction:"positive",
  targetType:"event",
  targetId:"event:toggle-like",
  occurredAt:"2026-08-30T08:00:00.000Z",
};
const liked = followFirst.toggleFeedback(basePreferences, feedbackInput);
assert.equal(liked.followFirst.feedback.entries.at(-1)?.direction, "positive", "the first thumbs-up tap must like the event");
const unliked = followFirst.toggleFeedback(liked, { ...feedbackInput, occurredAt:"2026-08-30T08:01:00.000Z" });
assert(!unliked.followFirst.feedback.entries.some(entry => entry.eventId === feedbackInput.eventId), "the second thumbs-up tap must remove the event like");
assert.doesNotMatch(html, /publishPositiveNothingscoreLike/, "private suggestion learning must not weight public peer ratings");

console.log(`Editorial interaction valid: ${projectedRecords.length} projected cards retain L1/L2 narrative and repeat thumbs-up removes the like.`);
