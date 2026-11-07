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
  refresh:sourceRefresh,
  standingsEntries,
  validatePublishedContext,
} = require("./refresh-premier-league-context.js");

const refresh=options=>sourceRefresh({...options,backupOptions:{directory:path.dirname(options.bundlePath),coordinator:async()=>{throw Error("Backup disabled in primary table rehearsal");}}});

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
for(const field of ['sharedRank','rankPending'])assert.equal(schema.$defs.standingsEntry.properties[field].type,'boolean','rank semantics are documented in the canonical schema');
assert.equal(schema.$defs.standingsEntry.properties.sortOrder.type,'integer');
assert.equal(snapshot.entries.length, EXPECTED_TEAM_COUNT);
assert.deepEqual(snapshot.entries.map(entry => entry.sortOrder ?? entry.rank).sort((a, b) => a - b), Array.from({ length: 20 }, (_, index) => index + 1), "official row order stays complete even when sporting places are shared");
assert.equal(new Set(snapshot.entries.map(entry => entry.participantId)).size, EXPECTED_TEAM_COUNT);
assert(snapshot.entries.every(entry => ["played", "won", "drawn", "lost", "pointsFor", "pointsAgainst", "pointsDifference", "ladderPoints"].every(field => Number.isFinite(entry[field]))), "every EPL row must map goals and points into canonical ladder fields");
assert(contextBundleSource.includes(COMPETITION_ID) && contextBundleSource.includes(snapshot.id), "the offline context bundle must contain the validated EPL competition and snapshot");

const rawPayload = {
  compSeason: { id: 841, competition: { id: 1 } },
  tables: [{ entries: snapshot.entries.map(entry => ({
    position: entry.sortOrder ?? entry.rank,
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
  ["unbalanced league wins/losses", rows => {
    for(const row of rows)row.overall={played:5,won:0,drawn:5,lost:0,goalsFor:0,goalsAgainst:0,goalsDifference:0,points:5};
    rows[0].overall.won++;rows[0].overall.drawn--;
  }],
  ["odd league draw appearances", rows => { rows.at(-1).overall.drawn++; rows.at(-1).overall.played++; }],
  ["unbalanced league goals", rows => { rows[0].overall.goalsFor++; rows[0].overall.goalsDifference++; }],
  ["beyond the 38-match season", rows => { const row=rows[0].overall; row.drawn+=39-row.played; row.played=39; }],
];
for (const [name, mutate] of mutations){
  const invalid = structuredClone(rawPayload);
  mutate(invalid.tables[0].entries);
  assert.throws(() => standingsEntries(invalid), /incomplete|inconsistent|contradicts/, name);
}
// C.7 shares the place while the official ordinal row order remains separate.
const equal = structuredClone(rawPayload);
for (const row of equal.tables[0].entries) for (const key of Object.keys(row.overall)) row.overall[key] = 0;
assert.deepEqual(standingsEntries(equal).map(row => row.participantId), snapshot.entries.map(row => row.participantId));
assert(standingsEntries(equal).every(row=>row.rank===1&&row.sharedRank===true&&!row.rankPending),'preseason equal records share first place without a final-order claim');
assert.deepEqual(standingsEntries(equal).map(row=>row.sortOrder),Array.from({length:20},(_,i)=>i+1));
const intermediate=structuredClone(equal);
for(const [i,row] of intermediate.tables[0].entries.entries()){const played=i<4?8:i<7?6:4;Object.assign(row.overall,{played,drawn:played,points:played});}
assert.deepEqual(standingsEntries(intermediate).map(row=>row.rank),[...Array(4).fill(1),...Array(3).fill(5),...Array(13).fill(8)],'three-way and separated ties skip occupied places');
const reversed=structuredClone(intermediate);reversed.tables[0].entries.reverse();
assert.deepEqual(standingsEntries(reversed),standingsEntries(intermediate),'source array reversal must not alter official display order or shared places');
const providerShared=structuredClone(intermediate);
providerShared.tables[0].entries.forEach((row,index)=>{row.position=standingsEntries(intermediate)[index].rank;});
assert.deepEqual(standingsEntries(providerShared),standingsEntries(intermediate),'already-shared provider places retain the same canonical meaning and published row order');
const invalidShared=structuredClone(providerShared);invalidShared.tables[0].entries.at(-1).position=19;
assert.throws(()=>standingsEntries(invalidShared),/inconsistent ordinal or shared-place/,'mixed/corrupt source positions fail closed');
equal.tables[0].entries.at(-1).overall.points = -3;
assert.equal(standingsEntries(equal).at(-1).ladderPoints, -3, "official points deductions are retained");
// A final table can still have equal primary statistics. C.17 depends on the
// affected sporting outcome and official adjudication, not a guessed head-to-head.
const finalEqual=structuredClone(equal);
for(const row of finalEqual.tables[0].entries){row.overall.drawn=38;row.overall.played=38;row.overall.points=38;}
assert.deepEqual(standingsEntries(finalEqual).map(row=>[row.participantId,row.sortOrder]),snapshot.entries.map(row=>[row.participantId,row.sortOrder??row.rank]),"final exact ties retain official row order");
assert(standingsEntries(finalEqual).every(row=>row.rank===1&&row.sharedRank===true&&row.rankPending===true),'unverified final adjudication stays pending instead of assigning a champion or relegation');
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
  try {
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
  const corrupted=structuredClone(bundle);
  const table=corrupted.ladderSnapshots.find(row=>row.competitionId===COMPETITION_ID);
  for(const row of table.entries)Object.assign(row,{played:5,won:0,drawn:5,lost:0,pointsFor:0,pointsAgainst:0,pointsDifference:0,ladderPoints:5});
  const row=table.entries[0];
  row.won++;row.drawn--;
  assert.throws(()=>validatePublishedContext(corrupted),/league-wide/,"persisted snapshots receive the same whole-table check");
  const checkedAt=new Date(snapshot.snapshotTimeUtc);
  const accepted=await refresh({bundlePath:temporaryBundle,directoryPath,fetcher:async()=>finalEqual,now:()=>checkedAt});
  const persisted=JSON.parse(fs.readFileSync(temporaryBundle,"utf8"));
  assert.deepEqual(persisted,accepted,"a coherent final observation persists through the real writer");
  assert.equal(validatePublishedContext(persisted).source.checkedAt,checkedAt.toISOString(),"only the actual supplied observation date is recorded");
  const presentation=require('../config/feed-card-presentation'),builder=require('./build-app-shell-runtime'),vm=require('node:vm'),inspectorBuilder=require('./build-code-inspector');
  for(const [name,payload] of [['preseason',rawPayload],['shared',intermediate],['final-pending',finalEqual]]){
    const response=name==='preseason'?structuredClone(equal):payload;
    if(name==='preseason')response.tables[0].entries.at(-1).overall.points=0;
    await refresh({bundlePath:temporaryBundle,directoryPath,fetcher:async()=>response,now:()=>checkedAt});
    const actual=JSON.parse(fs.readFileSync(temporaryBundle,'utf8')),table=validatePublishedContext(actual);
    const projection=inspectorBuilder.codeStandings({id:'sport:football'},actual).filter(row=>row.competitionId===COMPETITION_ID);
    assert.deepEqual(projection.map(row=>[row.participantId,row.rank,row.sharedRank,row.rankPending]),table.entries.map(row=>[row.participantId,row.rankPending?null:row.rank,row.sharedRank,row.rankPending]));
    assert(projection.every(row=>row.asOf===checkedAt.toISOString()&&row.sourceUrl===table.source.sourceUrl&&row.tableNote===table.metadata.tableNote),'projection retains original date, source and shared/final-order note');
    const editorial=require('./lib/editorial-preview-standings'),editorialIndex=editorial.buildStandingsIndex(temporaryDirectory);
    const event={id:'epl-test',competitionId:COMPETITION_ID,homeParticipantId:table.entries[0].participantId,awayParticipantId:table.entries[4].participantId};
    const override={selectedSentence:'{{homeRankOrdinal}} versus {{awayRankOrdinal}}',editorialPreview:{contextSignals:['current-ladder-position']}};
    if(name==='final-pending')assert.throws(()=>editorial.resolveStandingsAwareOverride(event,override,editorialIndex),/pending standings/,'unresolved final positions cannot become definite editorial');
    else assert.equal(editorial.resolveStandingsAwareOverride(event,override,editorialIndex).selectedSentence,name==='shared'?'joint 1st versus joint 5th':'joint 1st versus joint 1st');
    const context={};vm.runInNewContext(builder.standingsSource([table]),context);const expanded=JSON.parse(JSON.stringify(context.NOTHINGSPORTS_FEED_CARD_STANDINGS));
    for(const row of table.entries){const badge=presentation.ranking({competitionId:COMPETITION_ID,startTimeUtc:'2027-06-01T00:00:00Z'},row.participantId,expanded);assert.equal(badge?.label??null,row.rankPending?null:`JOINT ${presentation.ordinal(row.rank)}`);}
    const tampered=structuredClone(actual);tampered.ladderSnapshots.find(s=>s.competitionId===COMPETITION_ID).entries[0].sharedRank=false;
    assert.throws(()=>validatePublishedContext(tampered),/shared-place metadata/,'persisted shared-place meaning is validated, not just numeric arithmetic');
    if(process.env.EPL_RANK_REHEARSAL_PREFIX){
      const existing=require('../data/code-inspector/football.json');
      fs.writeFileSync(process.env.EPL_RANK_REHEARSAL_PREFIX+'-'+name+'.json',JSON.stringify({...existing,standings:[...projection,...existing.standings.filter(row=>row.competitionId!==COMPETITION_ID)],positionRehearsalSnapshot:table},null,2));
    }
  }
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force:true });
  }
}

validateFailurePreservation()
  .then(() => console.log(`Premier League context valid: ${EXPECTED_TEAM_COUNT} ranked clubs, offline bundle and failed-refresh preservation passed.`))
  .catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
