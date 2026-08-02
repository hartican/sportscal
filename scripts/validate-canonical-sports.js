#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCanonicalBundle, createCanonicalSportsIndex } = require("./lib/canonical-sports");
const { buildNrlLadder } = require("./refresh-canonical-sports");

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
assert(aflFixtures.length >= 207, "the full AFL home-and-away fixture plus any published finals must ingest");
assert(nrlFixtures.length >= 204, "the full NRL premiership fixture plus any published finals must ingest");
assert(bundle.participants.filter(item => item.sportDomainId === "sport:afl").length >= 18, "all 18 AFL ladder teams plus any additional published participants must ingest");
assert(bundle.participants.filter(item => item.sportDomainId === "sport:nrl").length >= 17, "all 17 NRL ladder teams plus any additional published participants must ingest");
assert(aflFixtures.filter(event => event.scheduleStatus === "tbc").every(event => event.startTimeUtc === null), "AFL floating-round placeholders must not become fake start times");

const aflLadder = index.getLatestLadder(aflCompetitionId);
const nrlLadder = index.getLatestLadder(nrlCompetitionId);
assert(aflLadder, "AFL ladder must be queryable by competition");
assert(nrlLadder, "NRL ladder must be queryable by competition");
assert.equal(aflLadder.entries.length, 18, "AFL ladder must include every team");
assert.equal(nrlLadder.entries.length, 17, "NRL ladder must include every team");
assert.deepEqual(aflLadder.entries.map(entry => entry.rank), Array.from({ length: 18 }, (_, index) => index + 1), "AFL ladder ranks must be contiguous");
assert.deepEqual(nrlLadder.entries.map(entry => entry.rank), Array.from({ length: 17 }, (_, index) => index + 1), "NRL ladder ranks must be contiguous");
assert.equal(nrlLadder.entries[0].ladderPoints, Math.max(...nrlLadder.entries.map(entry => entry.ladderPoints)), "NRL ladder leader must have the highest calculated competition points");
assert(nrlLadder.entries.every(entry => Number.isInteger(entry.byes) && entry.byes >= 0), "NRL ladder calculation must retain non-negative scheduled bye counts");

const nrlRounds = new Map();
nrlFixtures.forEach(event => {
  const matches = nrlRounds.get(event.roundNumber) || [];
  matches.push(event);
  nrlRounds.set(event.roundNumber, matches);
});
const latestCompletedNrlRound = Math.max(0, ...Array.from(nrlRounds.entries())
  .filter(([, matches]) => matches.length > 0 && matches.every(event => event.status === "completed"))
  .map(([roundNumber]) => roundNumber));
const expectedNrlPlayed = nrlFixtures.filter(event =>
  event.roundNumber <= latestCompletedNrlRound && event.status === "completed"
).length;
const actualNrlPlayed = nrlLadder.entries.reduce((total, entry) => total + entry.played, 0) / 2;
assert.equal(actualNrlPlayed, expectedNrlPlayed, "NRL ladder must include every match through the latest fully completed round");
assert.equal(nrlLadder.metadata.completedMatches, expectedNrlPlayed, "NRL ladder metadata must report the represented completed-match boundary");

const regressionParticipants = ["a", "b", "c", "d", "e"].map(id => ({
  id: `team:nrl:${id}`,
  sportDomainId: "sport:nrl",
}));
const regressionEvent = (roundNumber, home, away, status, scoreline) => ({
  roundNumber,
  homeParticipantId: `team:nrl:${home}`,
  awayParticipantId: `team:nrl:${away}`,
  status,
  ...(scoreline ? { result: { scorelineText: `${home} v ${away} — ${scoreline}` } } : {}),
});
const partialRoundLadder = buildNrlLadder([
  regressionEvent(1, "a", "b", "completed", "10-4"),
  regressionEvent(1, "c", "d", "completed", "8-6"),
  regressionEvent(2, "a", "c", "completed", "12-10"),
  regressionEvent(2, "b", "d", "live"),
], regressionParticipants, "2026-08-02T08:00:00.000Z");
const partialRoundRows = new Map(partialRoundLadder.entries.map(entry => [entry.participantId, entry]));
assert.equal(partialRoundRows.get("team:nrl:a").played, 1, "a partial current NRL round must not create a hybrid published ladder");
assert.equal(partialRoundRows.get("team:nrl:b").byes, 0, "a team with a live current-round match must not receive bye points");
assert.equal(partialRoundRows.get("team:nrl:e").byes, 1, "current-round bye points must wait until the round is fully completed");
assert.equal(partialRoundLadder.metadata.roundStatus, "in-progress", "a partial NRL round must be marked as ongoing");
assert.equal(partialRoundLadder.metadata.activeRound, 2, "a partial NRL round must retain the active-round warning context");
assert.equal(partialRoundLadder.metadata.pendingCompletedMatches, 1, "completed matches beyond the published boundary must be disclosed");
assert.match(partialRoundLadder.roundLabel, /completed Round 1/, "a partial NRL round must state its conservative completed-round boundary");

console.log(`Canonical sports valid: ${aflFixtures.length} AFL fixtures, ${nrlFixtures.length} NRL fixtures.`);
console.log(`Queryable ladders: AFL ${aflLadder.entries.length} teams; NRL ${nrlLadder.entries.length} teams.`);
