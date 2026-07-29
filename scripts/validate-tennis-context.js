#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sportContext = require("../config/sport-context");

const context = JSON.parse(fs.readFileSync("data/canonical/tennis-context-2026.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("schemas/sport-context.schema.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert.equal(context.schemaVersion, schema.properties.schemaVersion.const);
assert.equal(context.taxonomyVersion, "sports-taxonomy.v1");
assert.equal(context.season, 2026);
assert(context.sources.length >= 2);
assert(context.sources.every(source => source.sourceType === "official"));
assert(context.sources.some(source => source.sourceUrl.startsWith("https://www.atptour.com/")));
assert(context.sources.some(source => source.sourceUrl.startsWith("https://www.wimbledon.com/")));

const participantsById = new Map(context.participants.map(participant => [participant.id, participant]));
assert.equal(participantsById.size, context.participants.length, "tennis competitor ids must be unique");
assert.equal(context.participants.length, 18, "every competitor named on published men's cards plus the official top three must be followable");
assert(context.participants.every(participant => participant.type === "competitor"), "tennis context must not invent team follows");
assert(context.participants.every(participant => participant.sportDomainId === "sport:tennis:atp"), "ATP competitors must stay in a dedicated participant domain");
assert(context.participants.every(participant => participant.metadata.titleAliases?.length), "every competitor needs an explicit event-title alias");

const competition = context.competitions.find(item => item.id === "competition:atp-singles-2026");
assert(competition, "ATP singles ranking competition must be present");
assert.equal(competition.preferenceDomainId, "special:wimbledon");
assert.equal(competition.standingsType, "singlesRanking");
assert.equal(competition.defaultStandingsVisibility, "summary");

const snapshot = context.ladderSnapshots.find(item => item.competitionId === competition.id);
assert(snapshot, "an official ATP ranking snapshot must be present");
assert.equal(snapshot.entries.length, 18);
assert.equal(snapshot.entries[0].participantId, "competitor:tennis:atp:jannik-sinner");
assert.equal(snapshot.entries[0].rank, 1);
assert.equal(snapshot.entries[0].points, 13450);
assert.equal(snapshot.entries[5].participantId, "competitor:tennis:atp:alex-de-minaur");
assert.equal(snapshot.entries[5].rank, 6);
assert(snapshot.entries.every(entry => participantsById.has(entry.participantId)), "every ranking entry must reference a followable competitor");
assert.deepEqual(
  snapshot.entries.map(entry => entry.rank),
  snapshot.entries.map(entry => entry.rank).slice().sort((first, second) => first - second),
  "the calibrated ranking subset must retain official rank order"
);

const wimbledonEvents = feed.events.filter(event => event.key === "wimbledon");
const contextualEvents = sportContext.applyContextToEvents(wimbledonEvents, context);
const mensEvents = contextualEvents.filter(event => /\bMen(?:'|’)s\b/i.test(event.name));
const womensEvents = contextualEvents.filter(event => /\bWomen(?:'|’)s\b/i.test(event.name));
assert.equal(mensEvents.length, 16, "published Wimbledon men's cards must remain intact");
assert.equal(womensEvents.length, 16, "published Wimbledon women's cards must remain intact");
assert(mensEvents.every(event => event.sportDomainId === "special:wimbledon"));
assert(mensEvents.every(event => event.participantIds?.length === 2), "each men's card must resolve only its two named competitors");
assert(womensEvents.every(event => !event.participantIds?.length), "women's cards must not inherit ATP follow context");

const final = contextualEvents.find(event => event.id === "wimbledon-final-sinner-zverev-2026");
assert.deepEqual(final?.participantIds, [
  "competitor:tennis:atp:jannik-sinner",
  "competitor:tennis:atp:alexander-zverev",
]);
const deMinaur = contextualEvents.find(event => event.id === "evt_1");
assert.deepEqual(deMinaur?.participantIds, [
  "competitor:tennis:atp:alex-de-minaur",
  "competitor:tennis:atp:zachary-svajda",
]);

console.log("Tennis context valid: 18 ATP competitor follows, official ranking context, exact men's-card resolution, and no WTA leakage.");
