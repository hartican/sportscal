#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const classification = require("../config/competition-classification.js");
const taxonomy = require("../config/canonical-sports-taxonomy.js");
const hierarchy = require("../config/sport-hierarchy.js");
const selectorTaxonomy = require("../config/selector-taxonomy.js");
const followFirst = require("../config/follow-first.js");
const discovery = require("../config/discovery-catalogue.js");
const majorEvents = require("../config/major-events.js");

const events = JSON.parse(fs.readFileSync("data/major-events.v1.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const ucl = JSON.parse(fs.readFileSync("data/canonical/uefa-champions-league-2026-27.json", "utf8"));
const finals = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-finals-2026.json", "utf8"));
const inspectorManifest = JSON.parse(fs.readFileSync("data/code-inspector/manifest.json", "utf8"));
const uclInspector = JSON.parse(fs.readFileSync("data/code-inspector/champions-league.json", "utf8"));
const aflInspector = JSON.parse(fs.readFileSync("data/code-inspector/afl.json", "utf8"));
const nrlInspector = JSON.parse(fs.readFileSync("data/code-inspector/nrl.json", "utf8"));
const footballFollows = JSON.parse(fs.readFileSync("data/follow-directory/football.v1.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");

const legacyEventIds = [
  "major-event:afl-finals-series-2026",
  "major-event:nrl-finals-series-2026",
  "major-event:uefa-champions-league-2026-27:qualification",
  "major-event:uefa-champions-league-2026-27:league-phase",
  "major-event:uefa-champions-league-2026-27:knockout",
];
assert(legacyEventIds.every(id => !events.events.some(event => event.id === id)), "Code-classified records must be absent from Events storage");
assert(events.events.every(event => classification.belongsInEvents(event)), "Events storage must fail closed around explicit surface classification");
assert.equal(classification.classificationFor("major-event:uefa-champions-league-2026-27:knockout").surface, "code");
assert.equal(classification.classificationFor("major-event:afl-finals-series-2026").canonicalCodeId, "sport:afl");
assert.equal(classification.classificationFor("major-event:nrl-finals-series-2026").canonicalCodeId, "sport:nrl");
assert.equal(classification.classificationFor({ id:"event:test:festival", surfaceClassification:"event", startDate:"2026-01-01", endDate:"2026-02-01" }).surface, "event", "duration alone must not demote a genuine Event");
assert.equal(classification.classificationFor({ id:"competition:test:season", surfaceClassification:"code", canonicalCodeId:"competition:test:season", startDate:"2026-01-01", endDate:"2026-01-07" }).surface, "code", "duration alone must not promote a recurring Code into Events");

const uclCompetition = taxonomy.competitions.find(competition => competition.id === "competition:uefa-champions-league");
assert.equal(uclCompetition?.surfaceClassification, "code");
assert.equal(uclCompetition?.parentDisciplineId, "discipline:football:club");
assert.equal(hierarchy.canonicalNodeId("competition:uefa-champions-league:2026-27"), "competition:uefa-champions-league");
assert.equal(selectorTaxonomy.sportNodes.find(node => node.id === "sport:champions-league")?.parentId, "sport:football");
assert.equal(ucl.id, "competition:uefa-champions-league");
assert.deepEqual(ucl.phases.map(phase => phase.phaseIdentity), ["qualification", "league", "knockout"]);
assert.equal(ucl.phases.flatMap(phase => phase.fixtures).length, 13);
assert(ucl.standingsSource?.url && Array.isArray(ucl.standings), "the Code must retain an official table contract even before rows exist");

assert(inspectorManifest.codes.some(code => code.id === ucl.id && code.parentSportId === "sport:football"));
assert.equal(uclInspector.fixtures.length, 13);
assert(uclInspector.fixtures.every(fixture => fixture.codeId === ucl.id));
assert(uclInspector.fixtures.slice(0, 7).every(fixture => fixture.participantSlots.length === 2 && fixture.participantSlots.every(slot => slot.participantId)), "published UCL fixtures must retain followable club identities");
const uclClubIds = new Set(ucl.participants.map(team => team.id));
assert([...uclClubIds].every(id => footballFollows.records.some(record => record.id === id)), "every published UCL club must be selectable in Follow");

const aflFinalIds = new Set(finals.phases.find(phase => phase.codeId === "sport:afl").fixtures.map(fixture => fixture.id));
const nrlFinalIds = new Set(finals.phases.find(phase => phase.codeId === "sport:nrl").fixtures.map(fixture => fixture.id));
assert([...aflFinalIds].every(id => aflInspector.fixtures.some(fixture => fixture.id === id)), "AFL finals must remain under the AFL Code");
assert([...nrlFinalIds].every(id => nrlInspector.fixtures.some(fixture => fixture.id === id)), "NRL finals must remain under the NRL Code");
assert(feed.events.some(event => event.key === "afl" && /final/i.test(`${event.roundLabel || ""} ${event.name || ""}`)), "AFL finals must remain normal Feed cards");
assert(feed.events.some(event => event.key === "nrl" && /final/i.test(event.name || "")), "NRL finals must remain normal Feed cards");
assert.deepEqual(majorEvents.markerReplacementFixtureIds(), [], "Event parents must not suppress normal finals cards");

const legacyPreferences = {
  version:16,
  selectedSelectorEntityIds:["sport:football", "special:uefa-champions-league"],
  followedSports:["football"],
  savedFixtureIds:["fixture:legacy:one"],
  reminders:[{ fixtureId:"fixture:legacy:one" }],
  dismissals:["fixture:legacy:two"],
  eventUserState:{ "fixture:legacy:one":{ addedToFixtures:true } },
  followFirst:{
    followedMajorEventIds:["afl-finals", "nrl-finals", "uefa-champions-league", "state-of-origin"],
    startupMeta:{ sports:["football"], majorEvents:["uefa-champions-league"] },
  },
};
const migrated = discovery.migratePreferences(followFirst.migratePreferences(legacyPreferences));
const migratedAgain = discovery.migratePreferences(followFirst.migratePreferences(migrated));
assert.deepEqual(migratedAgain, migrated, "legacy event-follow migration must be idempotent");
assert.deepEqual(new Set(migrated.selectedSelectorEntityIds), new Set(["sport:afl", "sport:nrl", "sport:football", "sport:champions-league"]));
assert.deepEqual(migrated.followFirst.followedMajorEventIds, ["state-of-origin"]);
for (const key of ["savedFixtureIds", "reminders", "dismissals", "eventUserState"]){
  assert.deepEqual(migrated[key], legacyPreferences[key], `${key} must survive Code migration unchanged`);
}

for (const legacyId of legacyEventIds){
  const target = classification.legacyNavigationTarget(legacyId);
  assert(target?.codeId, `${legacyId} must retain a Code redirect target`);
}
assert.match(html, /legacyEventRedirect:eventsRoute\.id/);
assert.match(html, /COMPETITION_CLASSIFICATION\?\.legacyNavigationTarget\?\.\(eventId\)/);
assert.match(html, /history\.replaceState\(\{ codeInspector: codeTarget\.codeId/);

const invalidEvents = { ...events, events:[...events.events, { ...ucl.phases[0], id:"major-event:uefa-champions-league-legacy", eventFamilyId:"uefa-champions-league", kind:"tournament", stakesScore:5, sources:ucl.sources, dateStatus:"confirmed", startDate:"2026-07-07", endDate:"2026-08-26", editionId:"ucl", phaseId:"qualification", subEvents:[] }] };
assert.match(majorEvents.validateDocument(invalidEvents, { reference:new Date("2026-09-04T12:00:00.000Z") }).join("\n"), /forbidden in Events/);

console.log("Competition classification valid: Champions League is a Football Code; AFL/NRL finals stay in their Codes; legacy state and routes migrate without duplicates.");
