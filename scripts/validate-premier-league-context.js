#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const taxonomy = require("../config/canonical-sports-taxonomy.js");
const {
  COMPETITION_ID,
  EXPECTED_TEAM_COUNT,
  refresh,
  standingsEntries,
  validatePublishedContext,
} = require("./refresh-premier-league-context.js");

const ROOT = path.resolve(__dirname, "..");
const bundlePath = path.join(ROOT, "data/canonical/afl-nrl-2026.json");
const directoryPath = path.join(ROOT, "data/canonical/football-directory.v1.json");
const contextBundleSource = fs.readFileSync(path.join(ROOT, "data/canonical/contexts.js"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas/sport-context.schema.json"), "utf8"));
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
const snapshot = validatePublishedContext(bundle);
const competition = taxonomy.competitions.find(item => item.id === COMPETITION_ID);

assert.equal(competition?.standingsType, "leagueTable", "EPL must use the reusable league-table adapter");
assert.equal(taxonomy.sportDomains.find(item => item.id === "sport:football")?.supportsLadders, true, "Football must publish table support");
assert(schema.$defs.competition.properties.standingsType.enum.includes("leagueTable"), "the public context schema must permit leagueTable standings");
assert(schema.$defs.competitionFamily.properties.familyType.enum.includes("league"), "the public context schema must permit league competition families");
assert.equal(snapshot.entries.length, EXPECTED_TEAM_COUNT);
assert.deepEqual(snapshot.entries.map(entry => entry.rank).sort((a, b) => a - b), Array.from({ length: 20 }, (_, index) => index + 1));
assert.equal(new Set(snapshot.entries.map(entry => entry.participantId)).size, EXPECTED_TEAM_COUNT);
assert(snapshot.entries.every(entry => ["played", "won", "drawn", "lost", "pointsFor", "pointsAgainst", "pointsDifference", "ladderPoints"].every(field => Number.isFinite(entry[field]))), "every EPL row must map goals and points into canonical ladder fields");
assert(contextBundleSource.includes(COMPETITION_ID) && contextBundleSource.includes(snapshot.id), "the offline context bundle must contain the validated EPL competition and snapshot");

const rawPayload = {
  compSeason: { id: 841, competition: { id: 1 } },
  tables: [{ entries: snapshot.entries.map(entry => ({
    position: entry.rank,
    team: { club: { id: Number(entry.participantId.split(":").at(-1)) } },
    overall: {
      played: entry.played,
      won: entry.won,
      drawn: entry.drawn,
      lost: entry.lost,
      goalsFor: entry.pointsFor,
      goalsAgainst: entry.pointsAgainst,
      goalsDifference: entry.pointsDifference,
      points: entry.ladderPoints,
    },
  })) }],
};
assert.equal(standingsEntries(rawPayload).length, EXPECTED_TEAM_COUNT, "the current official response shape must map all 20 clubs");
const truncatedPayload = structuredClone(rawPayload);
truncatedPayload.tables[0].entries.pop();
assert.throws(() => standingsEntries(truncatedPayload), /expected 20 unique clubs/, "partial official responses must fail closed");

const mutations = [
  ["null statistic", rows => { rows[0].overall.won = null; }],
  ["blank statistic", rows => { rows[0].overall.won = ""; }],
  ["boolean statistic", rows => { rows[0].overall.won = false; }],
  ["fractional statistic", rows => { rows[0].overall.won = 0.5; }],
  ["negative match count", rows => { rows[0].overall.played = -1; }],
  ["contradictory result count", rows => { rows[0].overall.played += 1; }],
  ["contradictory goal difference", rows => { rows[0].overall.goalsDifference += 1; }],
  ["contradictory rank", rows => { rows.at(-1).overall.points = rows[0].overall.points + 1; }],
];
for (const [name, mutate] of mutations){
  const invalid = structuredClone(rawPayload);
  mutate(invalid.tables[0].entries);
  assert.throws(() => standingsEntries(invalid), /incomplete|inconsistent|contradicts/, name);
}
// Equal primary statistics remain in official display order, never alphabetical or
// invented head-to-head order. This also exercises genuine preseason zeroes.
const equal = structuredClone(rawPayload);
for (const row of equal.tables[0].entries) for (const key of Object.keys(row.overall)) row.overall[key] = 0;
assert.deepEqual(standingsEntries(equal).map(row => row.participantId), snapshot.entries.map(row => row.participantId));
equal.tables[0].entries.at(-1).overall.points = -3;
assert.equal(standingsEntries(equal).at(-1).ladderPoints, -3, "official points deductions are retained");
for (const field of ["goalsDifference", "goalsFor"]){
  const invalid = structuredClone(equal);
  const last = invalid.tables[0].entries.at(-1).overall;
  last.points = 0;
  last.goalsFor = 2;
  last.goalsAgainst = field === "goalsDifference" ? 0 : 2;
  last.goalsDifference = last.goalsFor - last.goalsAgainst;
  assert.throws(() => standingsEntries(invalid), /rank contradicts/, `${field} breaks equal points`);
}
const invalidPublished = structuredClone(bundle);
invalidPublished.ladderSnapshots.find(row => row.competitionId === COMPETITION_ID).entries[0].played += 1;
assert.throws(() => validatePublishedContext(invalidPublished), /inconsistent/, "offline snapshots receive the same arithmetic checks");

async function validateFailurePreservation(){
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nothingsport-epl-"));
  const temporaryBundle = path.join(temporaryDirectory, "context.json");
  fs.copyFileSync(bundlePath, temporaryBundle);
  const before = fs.readFileSync(temporaryBundle, "utf8");
  await assert.rejects(
    refresh({
      bundlePath: temporaryBundle,
      directoryPath,
      fetcher: async () => { throw new Error("synthetic upstream failure"); },
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    }),
    /synthetic upstream failure/,
  );
  assert.equal(fs.readFileSync(temporaryBundle, "utf8"), before, "network failure preserves last good bytes");
  for (const [, mutate] of mutations){
    const invalid = structuredClone(rawPayload);
    mutate(invalid.tables[0].entries);
    await assert.rejects(refresh({ bundlePath: temporaryBundle, directoryPath, fetcher: async () => invalid }), /incomplete|inconsistent|contradicts/);
    assert.equal(fs.readFileSync(temporaryBundle, "utf8"), before, "malformed source data must preserve last good bytes");
  }
  fs.rmSync(temporaryDirectory, { recursive: true });

}

validateFailurePreservation()
  .then(() => console.log(`Premier League context valid: ${EXPECTED_TEAM_COUNT} ranked clubs, offline bundle and failed-refresh preservation passed.`))
  .catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
