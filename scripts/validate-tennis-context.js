#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sportContext = require("../config/sport-context");
const { ALPHA3_TO_ALPHA2, buildContext } = require("./build-tennis-context.js");

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
assert(context.sources.some(source => /^https:\/\/(www\.atptour\.com|www\.protennislive\.com)\//.test(source.sourceUrl)));
assert(context.sources.some(source => /^https:\/\/(www\.|api\.)wtatennis\.com\//.test(source.sourceUrl)));
assert(context.sources.filter(source => /protennislive|api\.wtatennis/.test(source.sourceUrl)).every(source => source.sourceTrust === "verified"), "first-party ATP/WTA ranking sources must remain visibly verified in canonical context");

const participantsById = new Map(context.participants.map(participant => [participant.id, participant]));
assert.equal(participantsById.size, context.participants.length, "tennis athlete IDs must be unique");
for (const tour of ["atp", "wta"]){
  const tourParticipants = context.participants.filter(participant => participant.sportDomainId === `sport:tennis:${tour}`);
  const ranked = tourParticipants.filter(participant => Number.isInteger(participant.metadata.rankingSingles));
  assert.equal(ranked.filter(participant => participant.metadata.rankingSingles <= 50).length, 50, `${tour.toUpperCase()} participants must include the complete Top 50`);
  assert(ranked.some(participant => participant.metadata.isAustralian && participant.metadata.rankingSingles > 50), `${tour.toUpperCase()} participants must include current Australians outside the Top 50`);
  assert(ranked.every(participant => participant.metadata.rankingSingles <= 50 || participant.metadata.isAustralian), `${tour.toUpperCase()} ranking participants must stay within the published Top 50 plus Australian scope`);
}
assert(context.participants.every(participant => participant.type === "competitor"));
assert(context.participants.every(participant => participant.metadata.titleAliases?.length));
assert(context.participants.some(participant => participant.sportDomainId === "sport:tennis:atp" && participant.metadata.isAustralian && participant.metadata.rankingSingles > 50));
assert(context.participants.some(participant => participant.sportDomainId === "sport:tennis:wta" && participant.metadata.isAustralian && participant.metadata.rankingSingles > 50));
const rankingParticipants = context.participants.filter(participant => Number.isInteger(participant.metadata.rankingSingles));
assert(rankingParticipants.every(participant => participant.metadata.rankingSourceTrust), "ranking participants must retain source trust provenance");
assert(rankingParticipants.every(participant => ALPHA3_TO_ALPHA2[participant.metadata.representedCountryCode] === participant.countryCode), "every refreshed represented country must have an explicit ISO alpha-2 display mapping");

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
