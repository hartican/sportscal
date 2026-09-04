#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sportContext = require("../config/sport-context");

const context = JSON.parse(fs.readFileSync("data/canonical/f1-context-2026.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("schemas/sport-context.schema.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert.equal(context.schemaVersion, schema.properties.schemaVersion.const);
assert.equal(context.taxonomyVersion, "sports-taxonomy.v1");
assert.equal(context.season, 2026);
assert.equal(context.sources.length, 3);
assert(context.sources.every(source => source.sourceType === "official"));
assert(context.sources.every(source => source.sourceUrl.startsWith("https://www.formula1.com/")));

const participantsById = new Map(context.participants.map(participant => [participant.id, participant]));
const competitionsById = new Map(context.competitions.map(competition => [competition.id, competition]));
assert.equal(participantsById.size, context.participants.length, "F1 participant ids must be unique");
assert.equal(competitionsById.size, context.competitions.length, "F1 competition ids must be unique");
assert.equal(context.participants.filter(participant => participant.type === "team").length, 11, "all 11 F1 teams must be followable");
assert.equal(context.participants.filter(participant => participant.type === "competitor").length, 22, "all 22 F1 drivers must be followable");
assert(context.competitions.every(competition => competition.defaultStandingsVisibility === "summary"), "F1 standings must default to top 3 plus followed entities");

const drivers = context.ladderSnapshots.find(snapshot => snapshot.competitionId === "competition:f1-drivers-2026");
const constructors = context.ladderSnapshots.find(snapshot => snapshot.competitionId === "competition:f1-constructors-2026");
assert(drivers && constructors, "driver and constructor standings must both be present");
assert.equal(drivers.entries.length, 22);
assert.equal(constructors.entries.length, 11);
assert.deepEqual(drivers.entries.map(entry => entry.rank), Array.from({ length: 22 }, (_, index) => index + 1));
assert.deepEqual(constructors.entries.map(entry => entry.rank), Array.from({ length: 11 }, (_, index) => index + 1));
assert.equal(drivers.entries[0].participantId, "competitor:f1:kimi-antonelli");
assert.equal(drivers.entries[0].points, 242);
assert.ok(context.participants.filter(participant => participant.type === "competitor").every(driver => driver.headshotUrl && Number(driver.competitionNumber) > 0 && driver.profileRef), "current F1 drivers require official portraits, racing numbers and profile references");
assert.equal(constructors.entries[0].participantId, "team:f1:mercedes");
assert.equal(constructors.entries[0].points, 379);

drivers.entries.forEach(entry => {
  const participant = participantsById.get(entry.participantId);
  assert.equal(participant?.type, "competitor", `driver standing must reference a competitor: ${entry.participantId}`);
  assert.equal(participant?.metadata.teamParticipantId, entry.teamParticipantId, `driver/team mapping must agree: ${entry.participantId}`);
  assert.equal(participantsById.get(entry.teamParticipantId)?.type, "team", `driver standing must reference a team: ${entry.participantId}`);
});
constructors.entries.forEach(entry => {
  assert.equal(participantsById.get(entry.participantId)?.type, "team", `constructor standing must reference a team: ${entry.participantId}`);
});

const f1Events = feed.events.filter(event => event.key === "f1");
const contextualEvents = sportContext.applyContextToEvents(f1Events, context);
const sessionEvents = contextualEvents.filter(event => /\b(?:Qualifying|Race)\b/i.test(event.name));
const watchEvents = contextualEvents.filter(event => /watch/i.test(event.name));
assert(sessionEvents.length >= 20, "the published feed must expose the full F1 session run");
assert(sessionEvents.every(event => event.sportDomainId === "sport:f1"), "F1 session cards must retain the F1 preference domain");
assert(sessionEvents.every(event => event.participantIds.length === 33), "every F1 session card must resolve the active 11-team, 22-driver field");
assert(watchEvents.every(event => !Array.isArray(event.participantIds) || event.participantIds.length === 0), "ticket/date watch cards must not inherit sporting follow context");

console.log("F1 context valid: 22 drivers, 11 teams, two official championship tables, and session-card follow resolution.");
