#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sportContext = require("../config/sport-context");

const context = JSON.parse(fs.readFileSync("data/canonical/cycling-context-2026.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("schemas/sport-context.schema.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert.equal(context.schemaVersion, schema.properties.schemaVersion.const);
assert.equal(context.taxonomyVersion, "sports-taxonomy.v1");
assert.equal(context.season, 2026);
assert.equal(context.sources.length, 2);
assert(context.sources.every(source => source.sourceType === "official"));
assert(context.sources.every(source => source.sourceUrl.startsWith("https://www.letour.fr/")));

const participantsById = new Map(context.participants.map(participant => [participant.id, participant]));
assert.equal(participantsById.size, context.participants.length, "Tour rider ids must be unique");
assert.equal(context.participants.length, 14, "the final GC top ten and every additional surfaced jersey holder must be followable");
assert(context.participants.every(participant => participant.type === "competitor"), "Tour context must expose rider follows rather than generic teams");
assert(context.participants.every(participant => participant.sportDomainId === "sport:cycling:tdf"), "Tour riders must stay in their dedicated participant domain");

const competition = context.competitions.find(item => item.id === "competition:tour-de-france-stage-jerseys-2026");
assert(competition, "the Tour stage-jersey context competition must be present");
assert.equal(competition.preferenceDomainId, "special:tour-de-france");
assert.equal(competition.competitionType, "stageRace");
assert.equal(competition.standingsType, "stageJerseys");
assert.equal(competition.supportsLadder, false, "stage jersey changes must not be forced into a generic ladder");
assert.equal(context.ladderSnapshots.length, 0, "the calibrated Tour context must not invent a leaderboard snapshot");

assert.equal(context.jerseySnapshots.length, 21, "every Tour stage must carry a start/close jersey snapshot");
context.jerseySnapshots.forEach((snapshot, index) => {
  assert.equal(snapshot.stageNumber, index + 1, "jersey snapshots must remain in stage order");
  assert.equal(snapshot.eventId, `evt_${46 + index}`, "jersey snapshots must map to the published Tour cards");
  assert.equal(snapshot.source.sourceType, "official");
  assert(snapshot.source.sourceUrl.startsWith(`https://www.letour.fr/en/rankings/stage-${index + 1}`));
  assert.deepEqual(snapshot.unavailableClassifications, ["purple"], "purple must be explicitly withheld rather than mapped to another Tour classification");
  assert.equal(snapshot.start.purpleParticipantId, null);
  assert.equal(snapshot.close.purpleParticipantId, null);
  ["yellowParticipantId", "polkadotParticipantId"].forEach(key => {
    if (snapshot.start[key]) assert(participantsById.has(snapshot.start[key]), `${key} start holder must be followable`);
    if (snapshot.close[key]) assert(participantsById.has(snapshot.close[key]), `${key} close holder must be followable`);
  });
  if (index > 0){
    assert.equal(snapshot.start.yellowParticipantId, context.jerseySnapshots[index - 1].close.yellowParticipantId, "a stage must start with the prior stage's closing yellow holder");
    assert.equal(snapshot.start.polkadotParticipantId, context.jerseySnapshots[index - 1].close.polkadotParticipantId, "a stage must start with the prior stage's closing polkadot holder");
  }
});

const finalSnapshot = context.jerseySnapshots.at(-1);
assert.equal(finalSnapshot.close.yellowParticipantId, "competitor:cycling:tdf:tadej-pogacar");
assert.equal(finalSnapshot.close.polkadotParticipantId, "competitor:cycling:tdf:richard-carapaz");

const tourEvents = feed.events.filter(event => event.key === "tdf");
const contextualEvents = sportContext.applyContextToEvents(tourEvents, context);
assert.equal(contextualEvents.length, 21);
assert(contextualEvents.every(event => event.sportDomainId === "special:tour-de-france"));
assert(contextualEvents.every(event => event.participantIds?.length === 14), "every stage card must resolve the followable Tour rider field");
assert(contextualEvents.every(event => event.jerseySnapshot?.eventId === event.id), "every stage card must receive its matching jersey snapshot");

console.log("Cycling context valid: 14 rider follows, 21 official start/close yellow and polkadot snapshots, and no fabricated purple classification.");
