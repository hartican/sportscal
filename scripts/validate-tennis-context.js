#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sportContext = require("../config/sport-context");
const { buildContext } = require("./build-tennis-context.js");

const context = JSON.parse(fs.readFileSync("data/canonical/tennis-context-2026.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("schemas/sport-context.schema.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert.equal(context.schemaVersion, schema.properties.schemaVersion.const);
assert.equal(context.taxonomyVersion, "sports-taxonomy.v1");
assert.equal(context.season, 2026);
const generatedContext = buildContext();
assert.equal(generatedContext.participants.length, context.participants.length, "the generated ATP/WTA context must retain the same athlete universe");
assert.deepEqual(
  generatedContext.participants.map(participant => participant.id),
  context.participants.map(participant => participant.id),
  "the checked-in context and generator must retain the same ATP/WTA participant identities"
);
assert(context.sources.some(source => source.sourceUrl.startsWith("https://www.atptour.com/")));
assert(context.sources.some(source => source.sourceUrl.startsWith("https://www.wtatennis.com/")));

const participantsById = new Map(context.participants.map(participant => [participant.id, participant]));
assert.equal(participantsById.size, context.participants.length, "tennis athlete IDs must be unique");
assert(context.participants.filter(participant => participant.sportDomainId === "sport:tennis:atp").length >= 125);
assert(context.participants.filter(participant => participant.sportDomainId === "sport:tennis:wta").length >= 100);
assert(context.participants.every(participant => participant.type === "competitor"));
assert(context.participants.every(participant => participant.metadata.titleAliases?.length));
assert(context.participants.some(participant => participant.sportDomainId === "sport:tennis:atp" && participant.metadata.isAustralian && participant.metadata.rankingSingles > 50));
assert(context.participants.some(participant => participant.sportDomainId === "sport:tennis:wta" && participant.metadata.isAustralian && participant.metadata.rankingSingles > 50));

for (const tour of ["atp", "wta"]) {
  const competition = context.competitions.find(item => item.id === `competition:${tour}-singles-2026`);
  assert(competition, `${tour.toUpperCase()} singles ranking competition must be present`);
  assert.equal(competition.preferenceDomainId, "sport:tennis");
  assert.equal(competition.standingsType, "singlesRanking");
  const snapshot = context.ladderSnapshots.find(item => item.competitionId === competition.id);
  assert(snapshot);
  assert.equal(snapshot.entries.filter(entry => entry.rank <= 50).length, 50);
  assert(snapshot.entries.every(entry => participantsById.has(entry.participantId)));
  assert(snapshot.entries.filter(entry => entry.rank <= 50).every(entry => Number.isFinite(entry.points)), `${tour} Top 50 standings must retain ranking points`);
}

const wimbledonEvents = feed.events.filter(event => event.key === "wimbledon");
const contextualEvents = sportContext.applyContextToEvents(wimbledonEvents, context);
const mensEvents = contextualEvents.filter(event => /\bMen(?:'|’)s\b/i.test(event.name));
const womensEvents = contextualEvents.filter(event => /\bWomen(?:'|’)s\b/i.test(event.name));
assert.equal(mensEvents.length, 16);
assert.equal(womensEvents.length, 16);
assert(mensEvents.every(event => event.sportDomainId === "special:wimbledon"));
assert(womensEvents.every(event => event.sportDomainId === "special:wimbledon"));
assert(mensEvents.every(event => event.participantIds?.length === 2), "published men's Wimbledon cards must resolve exact ATP participants");
assert(womensEvents.every(event => event.participantIds?.length === 2), "published women's Wimbledon cards must resolve exact WTA participants");

const mensFinal = contextualEvents.find(event => event.id === "wimbledon-final-sinner-zverev-2026");
assert.deepEqual(mensFinal?.participantIds, ["competitor:tennis:atp:jannik-sinner", "competitor:tennis:atp:alexander-zverev"]);
const womensFinal = contextualEvents.find(event => event.id === "wimbledon-final-noskova-muchova-2026");
assert.deepEqual(
  [...(womensFinal?.participantIds || [])].sort(),
  ["competitor:tennis:wta:linda-noskova", "competitor:tennis:wta:karolina-muchova"].sort()
);

console.log(`Tennis context valid: ${context.participants.length} ATP/WTA catalogue and published-event athletes, equal Top 50 ranking contracts, Australian depth, and exact men's/women's Wimbledon resolution.`);
