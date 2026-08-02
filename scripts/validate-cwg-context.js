#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sportContext = require("../config/sport-context");

const context = JSON.parse(fs.readFileSync("data/canonical/cwg-context-2026.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("schemas/sport-context.schema.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert.equal(context.schemaVersion, schema.properties.schemaVersion.const);
assert.equal(context.taxonomyVersion, "sports-taxonomy.v1");
assert.equal(context.season, 2026);
assert(schema.$defs.competition.properties.competitionType.enum.includes("multiSportEvent"));
assert(schema.$defs.competition.properties.standingsType.enum.includes("medalTable"));
["gold", "silver", "bronze", "total"].forEach(field => {
  assert(schema.$defs.standingsEntry.properties[field], `sport context schema must define ${field}`);
});
assert(context.sources.length >= 6, "CWG context must retain its official medal and competitor sources");
assert(context.sources.every(source => (
  source.provider === "Glasgow 2026"
  && source.sourceType === "official"
  && source.sourceUrl.startsWith("https://www.glasgow2026.com/")
)), "CWG context may use only official Glasgow 2026 sources");

const domain = context.sportDomains.find(item => item.id === "sport:multi-sport");
assert(domain?.supportsLadders, "multi-sport games must support calibrated standings");
assert(domain?.supportsCompetitors, "multi-sport games must support competitor follows");
assert.equal(domain?.supportsTeams, false, "CWG nations must not become generic team-follow controls");

const competition = context.competitions.find(item => item.id === "competition:glasgow-2026-medal-table");
assert(competition, "Glasgow 2026 medal table competition must exist");
assert.equal(competition.preferenceDomainId, "special:commonwealth-games");
assert.equal(competition.competitionType, "multiSportEvent");
assert.equal(competition.standingsType, "medalTable");
assert.equal(competition.defaultStandingsVisibility, "summary");

const participantsById = new Map(context.participants.map(participant => [participant.id, participant]));
assert.equal(participantsById.size, context.participants.length, "CWG participant ids must be unique");
const nations = context.participants.filter(participant => participant.sportDomainId === "sport:multi-sport:cwg:nations");
const competitors = context.participants.filter(participant => participant.sportDomainId === "sport:multi-sport:cwg:competitors");
assert.equal(nations.length, 24, "the current medal snapshot must resolve all 24 medal-winning nations and territories");
assert(nations.every(participant => participant.type === "team"));
assert.equal(competitors.length, 15, "CWG detail settings must expose the calibrated 15-competitor follow set");
assert(competitors.every(participant => participant.type === "competitor" && participant.metadata.active));
assert.deepEqual(
  Array.from(new Set(competitors.map(participant => participant.metadata.discipline))).sort(),
  ["Artistic Gymnastics", "Athletics", "Netball", "Para Swimming", "Para Track Cycling", "Swimming", "Track Cycling"].sort(),
  "competitor follows must cover the supported CWG card disciplines"
);

assert.equal(context.ladderSnapshots.length, 1, "CWG context must expose one authoritative medal snapshot");
const medalTable = context.ladderSnapshots[0];
assert.equal(medalTable.competitionId, competition.id);
assert.equal(medalTable.entries.length, nations.length);
assert.equal(medalTable.source.sourceUrl, "https://www.glasgow2026.com/medals");
medalTable.entries.forEach((entry, index) => {
  assert.equal(participantsById.get(entry.participantId)?.sportDomainId, "sport:multi-sport:cwg:nations");
  assert.equal(entry.total, entry.gold + entry.silver + entry.bronze, `${entry.participantId} medal total must reconcile`);
  if (index){
    assert(entry.rank >= medalTable.entries[index - 1].rank, "medal ranks must be non-decreasing and preserve official ties");
  }
});
assert.deepEqual(
  medalTable.entries.slice(0, 3).map(entry => [entry.participantId, entry.rank, entry.gold, entry.silver, entry.bronze, entry.total]),
  [
    ["team:cwg:australia", 1, 35, 18, 27, 80],
    ["team:cwg:canada", 2, 13, 10, 12, 35],
    ["team:cwg:england", 3, 10, 19, 15, 44],
  ],
  "the official Day 6 top three must remain intact"
);

assert.equal(context.eventParticipantScopes.length, 5, "CWG participant resolution must stay discipline-calibrated");
const scopedCompetitorIds = [];
context.eventParticipantScopes.forEach(scope => {
  assert.equal(scope.sportKey, "cwg");
  assert.equal(scope.preferenceDomainId, "special:commonwealth-games");
  assert.equal(scope.participantSportDomainId, "sport:multi-sport:cwg:competitors");
  assert.equal(scope.resolutionMode, "explicit");
  scope.participantIds.forEach(participantId => {
    assert.equal(participantsById.get(participantId)?.type, "competitor", `${participantId} must resolve to a competitor`);
    scopedCompetitorIds.push(participantId);
  });
});
assert.equal(new Set(scopedCompetitorIds).size, 15, "every surfaced competitor must belong to exactly one card discipline");
assert.equal(scopedCompetitorIds.length, 15, "competitors must not leak across discipline scopes");

const cwgEvents = feed.events.filter(event => event.key === "cwg");
const contextualEvents = sportContext.applyContextToEvents(cwgEvents, context);
assert.equal(contextualEvents.length, 34, "the repaired Glasgow 2026 card set must retain one card per resolved netball finals matchup");
const expectedScopeSizes = new Map([
  ["Swimming", 6],
  ["Athletics", 5],
  ["Artistic Gymnastics", 1],
  ["Track Cycling", 2],
  ["Netball", 1],
]);
contextualEvents.forEach(event => {
  const matchedDiscipline = Array.from(expectedScopeSizes.keys()).find(prefix => event.name.startsWith(prefix));
  if (!matchedDiscipline){
    assert(!event.participantIds?.length, `${event.id} must not inherit unrelated competitor context`);
    return;
  }
  assert.equal(event.sportDomainId, "special:commonwealth-games");
  assert.equal(event.participantIds.length, expectedScopeSizes.get(matchedDiscipline), `${event.id} must receive only its discipline's competitor field`);
  assert(event.participantIds.every(participantId => participantsById.get(participantId)?.type === "competitor"));
});
const boxingFinal = contextualEvents.find(event => event.id === "cwg-glasgow-2026-boxing-finals-one");
assert(boxingFinal && !boxingFinal.participantIds?.length, "boxing cards must remain free of unsupported competitor follows");

console.log("CWG context valid: 15 competitor follows, five precise discipline scopes, and one official 24-team medal table.");
