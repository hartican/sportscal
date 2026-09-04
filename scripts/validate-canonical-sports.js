#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCanonicalBundle, createCanonicalSportsIndex } = require("./lib/canonical-sports");
const {
  buildNrlLadder,
  applyOfficialNrlResultCorrections,
  parseEspnNrlResults,
  reconcileNrlResults,
  selectFreshestLadderSnapshot,
} = require("./refresh-canonical-sports");

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
const aflwCompetitionId = "competition:aflw-2026";
const nrlCompetitionId = "competition:nrl-premiership-2026";
const aflFixtures = index.getFixtures({ competitionId: aflCompetitionId });
const aflwFixtures = index.getFixtures({ competitionId: aflwCompetitionId });
const nrlFixtures = index.getFixtures({ competitionId: nrlCompetitionId });
assert(aflFixtures.length >= 207, "the full AFL home-and-away fixture plus any published finals must ingest");
assert.equal(aflwFixtures.length, 108, "all currently published 12 rounds and 108 AFLW fixtures must ingest");
assert(nrlFixtures.length >= 204, "the full NRL premiership fixture plus any published finals must ingest");
assert(bundle.participants.filter(item => item.sportDomainId === "sport:afl").length >= 18, "all 18 AFL ladder teams plus any additional published participants must ingest");
assert(bundle.participants.filter(item => item.sportDomainId === "sport:nrl").length >= 17, "all 17 NRL ladder teams plus any additional published participants must ingest");
assert(aflFixtures.filter(event => event.scheduleStatus === "tbc").every(event => event.startTimeUtc === null), "AFL floating-round placeholders must not become fake start times");

const aflLadder = index.getLatestLadder(aflCompetitionId);
const aflwLadder = index.getLatestLadder(aflwCompetitionId);
const nrlLadder = index.getLatestLadder(nrlCompetitionId);
assert(aflLadder, "AFL ladder must be queryable by competition");
assert(aflwLadder, "AFLW ladder must be queryable by competition");
assert(nrlLadder, "NRL ladder must be queryable by competition");
assert.equal(aflLadder.entries.length, 18, "AFL ladder must include every team");
assert.equal(aflwLadder.entries.length, 18, "AFLW ladder must include every team");
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
const latestNrlResultRound = Math.max(0, ...Array.from(nrlRounds.entries())
  .filter(([, matches]) => matches.some(event => event.status === "completed"))
  .map(([roundNumber]) => roundNumber));
const expectedNrlPlayed = nrlFixtures.filter(event =>
  event.roundNumber <= latestNrlResultRound && event.status === "completed"
).length;
const actualNrlPlayed = nrlLadder.entries.reduce((total, entry) => total + entry.played, 0) / 2;
assert.equal(actualNrlPlayed, expectedNrlPlayed, "NRL ladder must include every confirmed result through the latest round with a completed match");
assert.equal(nrlLadder.metadata.completedMatches, expectedNrlPlayed, "NRL ladder metadata must report every represented completed match");
assert.equal(nrlLadder.metadata.pendingCompletedMatches, 0, "NRL ladder must never leave a confirmed result outside the published table");
assert(
  ["matched", "independent-source-lagging"].includes(nrlLadder.metadata.independentValidation?.status),
  "the published NRL ladder must record a successful independent aggregate check or an explicit independent-source delay"
);
if (nrlLadder.metadata.independentValidation?.localCompletedMatches === nrlLadder.metadata.independentValidation?.independentCompletedMatches){
  assert.equal(nrlLadder.metadata.independentValidation.status, "matched", "equal completed-match boundaries must produce an exact independent standings match");
}

const correctedStormTigers = nrlFixtures.find(event => event.sourceId === "129991007");
assert(correctedStormTigers, "the Round 10 Storm v Wests Tigers fixture must exist");
assert.match(correctedStormTigers.result?.scorelineText || "", /44-16$/, "the direct official NRL correction must override the stale 44-18 provider score");
assert.equal(correctedStormTigers.result?.source?.provider, "NRL", "a corrected provider score must retain direct official NRL provenance");

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
assert.equal(partialRoundRows.get("team:nrl:a").played, 2, "a confirmed current-round NRL result must enter the ladder immediately");
assert.equal(partialRoundRows.get("team:nrl:b").byes, 0, "a team with a live current-round match must not receive bye points");
assert.equal(partialRoundRows.get("team:nrl:e").byes, 2, "a genuine current-round bye must be derived from the full fixture once the round has a result");
assert.equal(partialRoundLadder.metadata.roundStatus, "in-progress", "a partial NRL round must be marked as ongoing");
assert.equal(partialRoundLadder.metadata.activeRound, 2, "a partial NRL round must retain the active-round warning context");
assert.equal(partialRoundLadder.metadata.completedMatches, 3, "a partial NRL round must report every result represented in the table");
assert.equal(partialRoundLadder.metadata.pendingCompletedMatches, 0, "a partial NRL round must not hold completed matches outside the table");
assert.equal(partialRoundLadder.metadata.ongoingRoundCompletedMatches, 1, "current-round result coverage must be explicit");
assert.match(partialRoundLadder.roundLabel, /completed matches in Round 2/, "a partial NRL round must state its live completed-match boundary");

const supplementalPayload = {
  events: [{
    id: "603417",
    date: "2026-08-02T06:05:00Z",
    status: { type: { state: "post", completed: true } },
    competitions: [{ competitors: [
      { homeAway: "home", score: "13", team: { displayName: "Wests Tigers" } },
      { homeAway: "away", score: "16", team: { displayName: "Eels" } },
    ] }],
  }],
};
const correctedMatches = applyOfficialNrlResultCorrections([{
  matchId: 129991007,
  roundNumber: 10,
  matchStatus: "complete",
  utcStartTime: "2026-05-10T04:00:00Z",
  homeSquadNickname: "Storm",
  awaySquadNickname: "Wests Tigers",
  homeSquadScore: 44,
  awaySquadScore: 18,
}], "2026-08-02T08:00:00.000Z");
assert.equal(correctedMatches.matches[0].homeSquadScore, 44);
assert.equal(correctedMatches.matches[0].awaySquadScore, 16);
assert.equal(correctedMatches.matches[0].resultSource.provider, "NRL");
assert.deepEqual(correctedMatches.correctedMatchIds, [129991007]);
const supplementalResults = parseEspnNrlResults(supplementalPayload, "2026-08-02T08:00:00.000Z");
assert.equal(supplementalResults.length, 1, "only final supplemental scorecards may be considered");
const laggingOfficialMatch = {
  matchId: 129992208,
  roundNumber: 22,
  matchStatus: "scheduled",
  utcStartTime: "2026-08-02T06:05:00Z",
  homeSquadNickname: "Wests Tigers",
  awaySquadNickname: "Eels",
  homeSquadScore: 0,
  awaySquadScore: 0,
};
const reconciled = reconcileNrlResults([laggingOfficialMatch], supplementalResults, "2026-08-02T08:00:00.000Z");
assert.equal(reconciled.matches[0].matchStatus, "complete", "an unambiguous independent final must safely promote a lagging official-provider status");
assert.equal(reconciled.matches[0].homeSquadScore, 13);
assert.equal(reconciled.matches[0].awaySquadScore, 16);
assert.equal(reconciled.promotedMatchIds[0], 129992208);
assert.equal(reconciled.matches[0].resultSource.provider, "ESPN");
assert.throws(
  () => reconcileNrlResults([
    { ...laggingOfficialMatch, matchStatus: "complete", homeSquadScore: 12, awaySquadScore: 16 },
  ], supplementalResults, "2026-08-02T08:00:00.000Z"),
  /conflicts with official-provider score/,
  "conflicting final scores must fail closed instead of silently changing the table"
);

const newerStoredAflLadder = {
  id: "ladder:afl-premiership-2026:round-20",
  competitionId: aflCompetitionId,
  snapshotTimeUtc: "2026-08-02T07:57:59.000Z",
  entries: [{ participantId: "newer" }],
};
const staleFetchedAflLadder = {
  ...newerStoredAflLadder,
  snapshotTimeUtc: "2026-08-02T06:35:02.000Z",
  entries: [{ participantId: "stale" }],
};
assert.strictEqual(
  selectFreshestLadderSnapshot(staleFetchedAflLadder, newerStoredAflLadder),
  newerStoredAflLadder,
  "an older snapshot for the same ladder round must never replace newer stored standings"
);
assert.strictEqual(
  selectFreshestLadderSnapshot(
    { ...staleFetchedAflLadder, id: "ladder:afl-premiership-2026:round-21" },
    newerStoredAflLadder
  ).id,
  "ladder:afl-premiership-2026:round-21",
  "a genuinely newer completed round must be accepted even when the provider timestamp is unusual"
);

console.log(`Canonical sports valid: ${aflFixtures.length} AFL fixtures, ${aflwFixtures.length} AFLW fixtures, ${nrlFixtures.length} NRL fixtures.`);
console.log(`Queryable ladders: AFL ${aflLadder.entries.length} teams; AFLW ${aflwLadder.entries.length} teams; NRL ${nrlLadder.entries.length} teams.`);
