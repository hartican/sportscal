#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
const schedule = readJson("data/canonical/fiba-women-sailgp-motogp-2026.json");
const taxonomy = require("../config/canonical-sports-taxonomy");
const selector = require("../config/selector-taxonomy");
const followFirst = require("../config/follow-first");
const countryFlags = require("../config/country-flags");

const EXPECTED = Object.freeze({
  nrlw:{ participantCount:12, eventCount:7, codeId:"sport:nrlw", competitionId:"competition:nrlw-premiership-2026" },
  "fiba-women":{ participantCount:16, eventCount:17, codeId:"competition:fiba-womens-world-cup", competitionId:"competition:fiba-womens-world-cup" },
  sailgp:{ participantCount:13, eventCount:7, codeId:"competition:sailgp", competitionId:"competition:sailgp" },
  motogp:{ participantCount:22, eventCount:9, codeId:"competition:motogp", competitionId:"competition:motogp" },
});

assert.equal(schedule.schemaVersion, "requested-sports-schedule.v1");
assert(!Number.isNaN(Date.parse(schedule.generatedAt)), "requested-sports schedule needs a valid generated timestamp");
assert.equal(new Set(schedule.participants.map(participant => participant.id)).size, schedule.participants.length, "requested participant IDs must be unique");
assert.equal(new Set(schedule.events.map(event => event.id)).size, schedule.events.length, "requested event IDs must be unique");

for (const [sportKey, expected] of Object.entries(EXPECTED)){
  const participants = schedule.participants.filter(participant => participant.sportKey === sportKey);
  const events = schedule.events.filter(event => event.sportKey === sportKey);
  assert.equal(participants.length, expected.participantCount, `${sportKey}: participant directory is incomplete`);
  assert.equal(events.length, expected.eventCount, `${sportKey}: schedule coverage is incomplete`);
  assert(events.every(event => event.codeId === expected.codeId && event.competitionId === expected.competitionId), `${sportKey}: every event must retain its exact competition code`);
  assert(events.every(event => /^2026-\d{2}-\d{2}$/.test(event.date)), `${sportKey}: every event needs a Sydney schedule date`);
  assert(events.every(event => event.timeTbc ? !event.startTimeUtc : !Number.isNaN(Date.parse(event.startTimeUtc))), `${sportKey}: only confirmed events may carry a UTC start`);
  assert(events.every(event => schedule.sources[event.sourceId]?.type === "official"), `${sportKey}: schedule cards must be source-backed by the rights-holder or governing body`);
  assert(participants.every(participant => participant.sourceIds?.every(sourceId => schedule.sources[sourceId]?.type === "official")), `${sportKey}: Follow records must be official-source backed`);
}

assert(schedule.participants.some(participant => participant.id === "team:basketball:opals"), "FIBA Women must make the Opals followable");
assert.equal(countryFlags.countryName("PR"), "Puerto Rico", "FIBA Women must not render Puerto Rico as a blank country filter");
assert.equal(countryFlags.assetPath("PRI"), "assets/flags/4x3/pr.svg", "Puerto Rico needs its bundled country flag");
assert(schedule.participants.filter(participant => participant.sportKey === "motogp").every(participant => Number(participant.competitionNumber) > 0), "MotoGP riders need 2026 racing numbers");
const chinaCzechia = schedule.events.find(event => event.id === "event:fiba-women:2026:group-china-czechia");
const valenciaDayTwo = schedule.events.find(event => event.id === "event:sailgp:2026:valencia-day-2");
assert.equal(chinaCzechia?.result?.score, "China 74-70 Czechia", "the elapsed China-Czechia fixture must retain its official result");
assert.equal(schedule.sources[chinaCzechia?.result?.sourceId]?.type, "official", "the China-Czechia result must use an official FIBA source");
assert.equal(valenciaDayTwo?.result?.status, "pending", "elapsed SailGP racing must fail closed while the official result page has no publishable outcome");
assert.equal(schedule.sources[valenciaDayTwo?.result?.sourceId]?.type, "official", "the pending SailGP result state must retain official provenance");
for (const competitionId of Object.values(EXPECTED).map(expected => expected.competitionId)){
  assert(taxonomy.competitions.some(competition => competition.id === competitionId), `${competitionId}: canonical competition is missing`);
}
for (const selectorId of ["sport:nrlw", "sport:motogp", "sport:sailgp", "sport:fiba-women"]){
  assert(selector.byId[selectorId]?.selectable === true, `${selectorId}: Follow selector is missing`);
}
assert.deepEqual(selector.byId["sport:nrl"].childIds, ["sport:nrl-premiership", "sport:nrlw"], "NRL and NRLW must stay separate child competitions");
assert.deepEqual(selector.byId["sport:motorsport"].childIds, ["sport:f1", "sport:motogp", "sport:wrc"], "MotoGP must be a distinct Motorsport child beside WRC");

for (const [sportKey, expected] of Object.entries(EXPECTED)){
  const directory = readJson(`data/follow-directory/${sportKey}.v1.json`);
  assert.equal(directory.records.length, expected.participantCount, `${sportKey}: generated Follow chunk is incomplete`);
}

for (const feedPath of ["feeds/incoming/events.json", "data/events.json"]){
  const feed = readJson(feedPath);
  for (const [sportKey, expected] of Object.entries(EXPECTED)){
    const expectedIds = new Set(schedule.events.filter(event => event.sportKey === sportKey).map(event => event.id));
    const cards = feed.events.filter(event => expectedIds.has(event.canonicalEventId));
    assert.equal(cards.length, expected.eventCount, `${feedPath}: ${sportKey} schedule was not published in full`);
    assert(cards.every(card => card.key === sportKey && followFirst.viewingOptions(card).length > 0), `${feedPath}: ${sportKey} cards need exact AU viewing options`);
    if (["motogp", "sailgp"].includes(sportKey)){
      assert(cards.every(card => card.participantDisplayMode === "field" && card.participantIds.length === expected.participantCount), `${feedPath}: ${sportKey} field follows must bind to every event without a fake matchup`);
    }
  }
}

const inspector = readJson("data/code-inspector/manifest.json");
for (const [sportKey, expected] of Object.entries(EXPECTED)){
  const code = inspector.codes.find(item => item.id === expected.codeId);
  assert(code, `${expected.codeId}: Code Inspector entry is missing`);
  assert.equal(code.fixtureCount, expected.eventCount, `${expected.codeId}: Code Inspector schedule is incomplete`);
  assert.equal(code.coverageStatus, "complete", `${expected.codeId}: Code Inspector coverage must be explicit`);
  const chunk = readJson(code.chunkPath);
  assert.equal(chunk.fixtures.length, expected.eventCount, `${expected.codeId}: lazy schedule chunk is incomplete`);
  if (["motogp", "sailgp"].includes(sportKey)) assert(chunk.fixtures.every(fixture => fixture.participantSlots.length === 0), `${expected.codeId}: field events must not render as two-sided fixtures`);
  if (sportKey === "nrlw"){
    const grandFinal = chunk.fixtures.find(fixture => fixture.id === "event:nrlw:2026:grand-final");
    assert(grandFinal?.timeTbc === true && grandFinal.time === null && grandFinal.timePrecision === "tbc", "NRLW Grand Final must retain its unpublished start time instead of rendering midnight");
  }
}

console.log("Requested sports valid: NRLW, FIBA Women, SailGP and MotoGP taxonomy, Follow, schedules, AU viewing and Code Inspector coverage passed.");
