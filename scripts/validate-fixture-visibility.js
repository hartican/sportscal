#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const policy = require("../config/follow-feed-policy");
const followFirst = require("../config/follow-first");
const { buildServerFeed } = require("../lib/server-feed-pipeline");
const published = require("../data/events.json");
const lifecycle = require("../config/card-lifecycle");
const { catalogue } = require("../lib/calendar-catalogue");
const inspector = require("./build-code-inspector");
const identities = require("../config/card-identities");
const fixtureIdentity = require("../config/fixture-identity");
const manifest = require("../data/code-inspector/manifest.json");
const timeline = require("../config/feed-timeline");

const now = new Date("2026-09-07T00:00:00.000Z");
const monza = published.events.find(event => event.id === "evt_27");
assert(monza && /Italian GP Race/.test(monza.name), "the regression must exercise the reported Italian GP");
const preferences = {
  followedSports:["f1"],
  selectedSelectorEntityIds:["sport:f1"],
  preferenceGraph:{domainPreferences:[{sportDomainId:"sport:f1",enabled:true}]},
};

assert.equal(policy.followedFixtureDecision(monza, {followed:true,now}).include, true,
  "Follow F1 must include the Italian GP without requiring a populated driver list");
assert(followFirst.reasonForEvent(monza, preferences),
  "the browser follow path must recognise the Italian GP independently of stakes");
const response = buildServerFeed({events:[monza],userId:"visibility-test",userState:{preferences},now});
assert(response.events.some(event => event.id === monza.id), "the personalised Feed must return the Italian GP");
assert(response.derivedCardCache.derivedCards.some(card => card.canonicalEventId === monza.id),
  "the returned Italian GP must have a renderable card");

const damaged = {...monza, id:"monza-incomplete", eventId:"monza-incomplete", stakesScore:1,
  storyline:null, participantIds:[], participants:[], broadcaster:null, viewingOptions:[],
  startTimeUtc:null, endTimeUtc:null, time:null, timePrecision:"tbc", status:"postponed"};
assert(policy.followedFixtureDecision(damaged, {followed:true,now}).include,
  "incomplete or postponed championship fixtures must remain eligible");
assert(followFirst.reasonForEvent(damaged, preferences), "browser eligibility must not need exact timing or editorial");
const practice = {...monza, sessionType:"practice", name:"Italian GP FP1", stakesScore:5};
assert.equal(policy.eligibleForFollow(practice,{competitionFollow:true}),false,"sport-only F1 excludes practice even with old high-stakes metadata");
assert.equal(followFirst.reasonForEvent(practice,preferences),null,"browser practice policy must match the server");
assert.equal(policy.followedFixtureDecision({...monza,published:false},{followed:true}).include,false,"unpublished records are not fixtures");
assert.equal(buildServerFeed({events:[{...monza,status:"unpublished"}],userId:"visibility-test",userState:{preferences},now}).events.length,0,"normalisation must not turn unpublished records into public fixtures");
const incompleteFinal = {...damaged,id:"rugby-final",key:"rugby",sportId:"rugby",name:"Rugby Final",stage:"final"};
assert(followFirst.reasonForEvent(incompleteFinal,{followedSports:["rugby"]}),"missing time and imagery cannot hide an eligible final");
const malformedFeed = buildServerFeed({events:[null,damaged,{...monza,id:"malformed-broadcasts",eventId:"malformed-broadcasts",broadcastOptions:{bad:true},participantIds:{bad:true}}],userId:"visibility-test",userState:{preferences},now});
assert.equal(malformedFeed.events.length,2,"malformed optional collections must not abort the server Feed");
assert.equal(malformedFeed.events.find(event => event.id === damaged.id).status,"postponed","status remains explicit in the Feed");
const unknownDate = {...damaged,date:null,startDate:null,startTimeUtc:null};
assert(Object.values(timeline.groups([unknownDate],now)).flat().some(event => event.id === unknownDate.id),"unknown dates must remain visible instead of falling out of every timeline group");

const damagedCards = lifecycle.materialize([damaged, monza], {
  profileId:"profile:visibility-test", now,
  enrich:event => { if(event.id === damaged.id) throw new Error("optional editorial unavailable"); return {}; },
});
assert.deepEqual(new Set(damagedCards.derivedCards.map(card => card.canonicalEventId)), new Set([damaged.id,monza.id]),
  "one failed enrichment must neither erase its card nor abort the remaining fixtures");
assert(damagedCards.derivedCards.every(card => card.cardVariant && Number.isFinite(card.intensity)),
  "fallback enrichment must produce a valid minimal presentation");

const sardegna = catalogue().find(event => /sardegna/i.test(event.name || ""));
assert(sardegna, "Sardegna must be represented in the full candidate library");
assert.equal(sardegna.key, "wrc", "the parent Motorsport schedule must not reclassify Sardegna as F1");
assert.equal(followFirst.viewingLink(sardegna)?.providerId, "stan", "Sardegna must use WRC rights, not inherited F1 rights");
assert.equal(inspector.normalizeFixture(sardegna, "sport:motorsport").key, "wrc",
  "Schedule serialization must retain the fixture's own sport, not just its parent code");
assert.equal(inspector.normalizeFixture({...sardegna,published:false},"sport:wrc").published,false,"Schedule serialization must retain explicit withdrawals");
const legacySardegna = {...sardegna,key:"f1"};
assert.equal(followFirst.viewingLink(legacySardegna)?.providerId, "stan",
  "canonical WRC competition identity must outrank a stale parent-derived F1 key");
assert.notEqual(identities.markForEvent(legacySardegna)?.id, identities.eventMarks.f1.id,
  "canonical WRC fixtures must never show a Formula One logo");
const f1Code = fixtureIdentity.scheduleCode({id:"sport:f1",parentId:"sport:motorsport"}, manifest.codes);
assert.deepEqual(fixtureIdentity.followedScheduleCodes({followedSports:["f1"]},manifest.codes).map(code=>code.id),["sport:f1"],"cold F1 loading must not substitute another motorsport series");
for (const [parent,child] of [["afl","aflw"],["nrl","nrlw"]]){
  assert(fixtureIdentity.followedScheduleCodes({followedSports:[parent,child]},manifest.codes).some(code=>code.id === `sport:${child}`),"following a men's competition must not suppress its separately published women's schedule");
}
assert.equal(f1Code?.id, "sport:f1", "Follow F1 > Schedule must resolve a dedicated F1 championship");
const f1Schedule = require(`../${f1Code.chunkPath}`);
assert(f1Schedule.fixtures.some(fixture => fixture.id === monza.id), "F1 Schedule must include the Italian GP");
assert(f1Schedule.fixtures.every(fixture => fixtureIdentity.sportKey(fixture) === "f1"), "F1 Schedule must not contain rally fixtures");

console.log("Fixture visibility: Italian GP survives the Follow, server Feed and card boundaries.");
