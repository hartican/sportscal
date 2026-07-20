#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCanonicalBundle, createCanonicalSportsIndex } = require("./lib/canonical-sports");

const inputPath = path.resolve(process.argv[2] || "data/canonical/afl-nrl-2026.json");
const bundle = loadCanonicalBundle(inputPath);
const index = createCanonicalSportsIndex(bundle);

assert.equal(bundle.taxonomyVersion, "sports-taxonomy.v1", "canonical taxonomy must be versioned");
assert.equal(bundle.season, 2026, "Phase 1 canonical bundle must target the 2026 season");
assert.equal(new Set(bundle.sportDomains.map(item => item.id)).size, bundle.sportDomains.length, "sport domain ids must be unique");
assert.equal(new Set(bundle.competitionFamilies.map(item => item.id)).size, bundle.competitionFamilies.length, "competition family ids must be unique");
assert.equal(new Set(bundle.competitions.map(item => item.id)).size, bundle.competitions.length, "competition ids must be unique");
assert.equal(new Set(bundle.participants.map(item => item.id)).size, bundle.participants.length, "participant ids must be unique");
assert.equal(new Set(bundle.events.map(item => item.id)).size, bundle.events.length, "canonical event ids must be unique");

const domainIds = new Set(bundle.sportDomains.map(item => item.id));
const familyIds = new Set(bundle.competitionFamilies.map(item => item.id));
const competitionIds = new Set(bundle.competitions.map(item => item.id));
const participantIds = new Set(bundle.participants.map(item => item.id));
bundle.competitionFamilies.forEach(item => assert(domainIds.has(item.sportDomainId), `unknown domain on ${item.id}`));
bundle.competitions.forEach(item => {
  assert(domainIds.has(item.sportDomainId), `unknown domain on ${item.id}`);
  assert(familyIds.has(item.competitionFamilyId), `unknown family on ${item.id}`);
});
bundle.events.forEach(event => {
  assert(domainIds.has(event.sportDomainId), `unknown event domain on ${event.id}`);
  assert(competitionIds.has(event.competitionId), `unknown event competition on ${event.id}`);
  assert(participantIds.has(event.homeParticipantId), `unknown home participant on ${event.id}`);
  assert(participantIds.has(event.awayParticipantId), `unknown away participant on ${event.id}`);
  assert.match(event.displayName, /^.+ v .+$/, `fixture naming must use v on ${event.id}`);
  assert(!/\bvs\.?\b|\bversus\b/i.test(event.displayName), `fixture naming must not mix separators on ${event.id}`);
  assert.equal(event.participantIds.length, 2, `event must have two participant references: ${event.id}`);
  assert.equal(event.startTimeUtc === null, event.scheduleStatus !== "confirmed", `unconfirmed start must be null on ${event.id}`);
  assert(!Object.prototype.hasOwnProperty.call(event, "storyline"), `canonical event must not contain narrative state: ${event.id}`);
  assert(!Object.prototype.hasOwnProperty.call(event, "cardVariant"), `canonical event must not contain derived card state: ${event.id}`);
  assert(!Object.prototype.hasOwnProperty.call(event, "archived"), `canonical event must not contain archive state: ${event.id}`);
});

const aflCompetitionId = "competition:afl-premiership-2026";
const nrlCompetitionId = "competition:nrl-premiership-2026";
const aflFixtures = index.getFixtures({ competitionId: aflCompetitionId });
const nrlFixtures = index.getFixtures({ competitionId: nrlCompetitionId });
assert.equal(aflFixtures.length, 207, "all 207 AFL home-and-away fixtures must ingest");
assert.equal(nrlFixtures.length, 204, "all 204 NRL premiership fixtures must ingest");
assert.equal(bundle.participants.filter(item => item.sportDomainId === "sport:afl").length, 18, "all 18 AFL teams must ingest");
assert.equal(bundle.participants.filter(item => item.sportDomainId === "sport:nrl").length, 17, "all 17 NRL teams must ingest");
assert.equal(aflFixtures.filter(event => event.scheduleStatus === "tbc").length, 18, "AFL floating Rounds 23-24 must remain time-TBC");
assert(aflFixtures.filter(event => event.scheduleStatus === "tbc").every(event => event.startTimeUtc === null), "AFL floating-round placeholders must not become fake start times");

const aflLadder = index.getLatestLadder(aflCompetitionId);
const nrlLadder = index.getLatestLadder(nrlCompetitionId);
assert(aflLadder, "AFL ladder must be queryable by competition");
assert(nrlLadder, "NRL ladder must be queryable by competition");
assert.equal(aflLadder.entries.length, 18, "AFL ladder must include every team");
assert.equal(nrlLadder.entries.length, 17, "NRL ladder must include every team");
assert.deepEqual(aflLadder.entries.map(entry => entry.rank), Array.from({ length: 18 }, (_, index) => index + 1), "AFL ladder ranks must be contiguous");
assert.deepEqual(nrlLadder.entries.map(entry => entry.rank), Array.from({ length: 17 }, (_, index) => index + 1), "NRL ladder ranks must be contiguous");
assert.equal(index.participantsById.get(nrlLadder.entries[0].participantId).displayName, "Panthers", "NRL Round 20 ladder leader must match the official source");
assert.equal(nrlLadder.entries[0].ladderPoints, 32, "NRL ladder calculation must include scheduled bye points");

console.log(`Canonical sports valid: ${aflFixtures.length} AFL fixtures, ${nrlFixtures.length} NRL fixtures.`);
console.log(`Queryable ladders: AFL ${aflLadder.entries.length} teams; NRL ${nrlLadder.entries.length} teams.`);
