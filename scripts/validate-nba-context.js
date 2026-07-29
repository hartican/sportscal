#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sportContext = require("../config/sport-context");

const context = JSON.parse(fs.readFileSync("data/canonical/nba-context-2026.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("schemas/sport-context.schema.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert.equal(context.schemaVersion, schema.properties.schemaVersion.const);
assert.equal(context.taxonomyVersion, "sports-taxonomy.v1");
assert.equal(context.season, 2026);
assert.equal(context.sources.length, 3);
assert(context.sources.every(source => source.sourceType === "official"));
assert(context.sources.every(source => source.sourceUrl.startsWith("https://www.nba.com/")));

const participantsById = new Map(context.participants.map(participant => [participant.id, participant]));
const teams = context.participants.filter(participant => participant.type === "team");
const competitors = context.participants.filter(participant => participant.type === "competitor");
assert.equal(participantsById.size, context.participants.length, "NBA participant ids must be unique");
assert.equal(teams.length, 30, "all 30 NBA teams must be followable");
assert.equal(competitors.length, 15, "the official 2025–26 All-NBA selections must be followable");
assert(context.participants.every(participant => participant.sportDomainId === "sport:basketball:nba"));
assert(competitors.every(participant => [1, 2, 3].includes(participant.metadata.allNbaTeam)));
assert.deepEqual(
  competitors.reduce((counts, participant) => {
    counts[participant.metadata.allNbaTeam - 1] += 1;
    return counts;
  }, [0, 0, 0]),
  [5, 5, 5],
  "each official All-NBA team must contain five competitors"
);
competitors.forEach(competitor => {
  assert.equal(participantsById.get(competitor.metadata.teamParticipantId)?.type, "team", `${competitor.id} must resolve to an NBA team`);
});

const eastCompetitionId = "competition:nba-eastern-conference-2025-26";
const westCompetitionId = "competition:nba-western-conference-2025-26";
assert(context.competitions.every(competition => competition.standingsType === "conferenceStandings"));
assert(context.competitions.every(competition => competition.defaultStandingsVisibility === "summary"));
const east = context.ladderSnapshots.find(snapshot => snapshot.competitionId === eastCompetitionId);
const west = context.ladderSnapshots.find(snapshot => snapshot.competitionId === westCompetitionId);
assert(east && west, "both NBA conference standings must be present");
assert.equal(east.entries.length, 15);
assert.equal(west.entries.length, 15);
[east, west].forEach(snapshot => {
  assert.deepEqual(snapshot.entries.map(entry => entry.rank), Array.from({ length: 15 }, (_, index) => index + 1));
  snapshot.entries.forEach(entry => {
    assert.equal(participantsById.get(entry.participantId)?.type, "team");
    assert.equal(entry.played, 82);
    assert.equal(entry.won + entry.lost, entry.played);
    assert.equal(entry.winPercentage, Number((entry.won / entry.played).toFixed(3)));
    assert(entry.gamesBehind >= 0);
  });
});
assert.equal(east.entries[0].participantId, "team:nba:detroit-pistons");
assert.equal(east.entries[0].won, 60);
assert.equal(west.entries[0].participantId, "team:nba:oklahoma-city-thunder");
assert.equal(west.entries[0].won, 64);
assert.equal(west.entries[1].participantId, "team:nba:san-antonio-spurs");
assert.equal(west.entries[1].gamesBehind, 2);

const expectedFinalsParticipants = [
  "team:nba:new-york-knicks",
  "team:nba:san-antonio-spurs",
  "competitor:nba:jalen-brunson",
  "competitor:nba:victor-wembanyama",
];
const nbaEvents = feed.events.filter(event => event.key === "nba");
const contextualEvents = sportContext.applyContextToEvents(nbaEvents, context);
assert.equal(contextualEvents.length, 7, "the published NBA Finals card run must remain intact");
assert(contextualEvents.every(event => event.sportDomainId === "sport:nba"));
assert(contextualEvents.every(event => (
  JSON.stringify(event.participantIds) === JSON.stringify(expectedFinalsParticipants)
)), "NBA Finals cards must resolve only the two Finals teams and their surfaced All-NBA leaders");

const unrelated = sportContext.applyEventContext({
  id: "nba-draft-watch",
  key: "nba",
  name: "NBA Draft watch",
}, context);
assert(!unrelated.participantIds?.length, "non-Finals NBA cards must not inherit Finals follow context");

console.log("NBA context valid: 30 team follows, 15 All-NBA competitor follows, two conference tables, and precise Finals-card resolution.");
