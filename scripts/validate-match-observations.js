'use strict';
const assert=require('node:assert/strict');
const {overlaySnapshots}=require('../lib/live-fixtures');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const base={id:'fixture:cricket:espn:1525655',key:'cricket',format:'Test',status:'scheduled',startTimeUtc:'2026-09-24T08:00:00Z',homeParticipantId:'team:cricket:south-africa',awayParticipantId:'team:cricket:australia'};
const scoreTime='2026-09-24T11:42:00Z',scheduleTime='2026-09-24T11:44:00Z';
const live={...base,status:'live',innings:[{team:'South Africa Men',runs:235,wickets:5,overs:'44.1'}]};
const snapshots=[{checked_at:scoreTime,fixtures:[live]},{checked_at:scheduleTime,fixtures:[{...base,innings:[]}]}];
const merged=overlaySnapshots([base],snapshots)[0];
const contract=require('../config/match-centre');
const abandonedSample=require('./fixtures/source-coverage/cricket-australia-abandoned.json');
const [abandoned]=require('../lib/source-coverage').parseCricketFixtures([abandonedSample.fixture],abandonedSample);
const observed=contract.compact(abandoned);
const previousFinal={...observed,status:'completed',statusCheckedAt:'2026-09-30T03:36:03.593Z',scoreCheckedAt:'2026-09-30T03:36:03.593Z'};
assert.equal(contract.observation(previousFinal,observed).status,'abandoned');
assert.equal(contract.observation(observed,{...observed,status:'live',statusCheckedAt:'2026-10-02T02:00:00Z'}).status,'abandoned');
assert.equal(contract.eligible(abandoned,Date.parse('2026-09-28T05:00:00Z')),false,'abandoned matches never enter Match Centre');
const oldProviderFinal={...abandoned,status:'completed',sourceCheckedAt:'2026-10-01T07:42:00.600Z'};
assert.equal(overlaySnapshots([abandoned],[{checked_at:'2026-10-02T01:48:04.105848Z',fixtures:[oldProviderFinal]}])[0].status,'abandoned','a later source poll cannot freshen older settled facts into an adjudication');
assert.equal(overlaySnapshots([abandoned],[{checked_at:'2026-10-02T03:00:00Z',fixtures:[{...oldProviderFinal,sourceCheckedAt:'2026-10-02T02:00:00Z',scoreDisplay:'India won by 5 runs'}]}])[0].status,'completed','genuinely newer timestamped final corrections still pass');
assert.equal(merged.status,'live','schedule-only update must not regress confirmed live status');
assert.equal(merged.innings[0].runs,235);assert.equal(merged.scoreCheckedAt,scoreTime);assert.equal(merged.statusCheckedAt,scoreTime);
assert.deepEqual(overlaySnapshots([base],[...snapshots].reverse()),overlaySnapshots([base],snapshots));
for(const status of ['stumps','suspended','completed','cancelled','postponed']){
 const e=overlaySnapshots([base],[...snapshots,{checked_at:'2026-09-24T11:46:00Z',fixtures:[{...base,status}]}])[0];
 assert.equal(e.status,status);assert.equal(e.innings[0].runs,235);assert.equal(e.scoreCheckedAt,scoreTime);
 assert.equal(e.statusCheckedAt,'2026-09-24T11:46:00Z');
}
const marker='fixture-observations.v1';
const markedUnknown={...live,fixtureObservationSchema:marker,sourceCheckedAt:scheduleTime,scoreCheckedAt:null,statusCheckedAt:null};
const unknownCompact=contract.compact(markedUnknown,{checkedAt:scheduleTime});assert.equal(unknownCompact.scoreCheckedAt,null);assert.equal(unknownCompact.checkedAt,null);assert.equal(unknownCompact.stale,true);
const staleScore={...markedUnknown,statusCheckedAt:scheduleTime};
const scorePresentation=require('../config/feed-live-scores').presentation(staleScore,{resultsOn:true,now:Date.parse(scheduleTime)});assert.equal(scorePresentation.status,'Last available score');assert.equal(scorePresentation.checkedAt,null);assert.equal(scorePresentation.stale,true);
const protectedLive={...live,scoreCheckedAt:scoreTime,statusCheckedAt:scoreTime};
const unknownMerge=overlaySnapshots([protectedLive],[{checked_at:scheduleTime,fixtures:[{...markedUnknown,innings:[{team:'South Africa Men',runs:999}]}]}])[0];assert.equal(unknownMerge.innings[0].runs,235);assert.equal(unknownMerge.scoreCheckedAt,scoreTime);
(async()=>{let output;
 const abandonmentHandler=createMatchCentreHandler({enabled:()=>true,published:()=>[abandoned],request:async()=>[{checked_at:'2026-10-02T01:48:04.105848Z',fixture:oldProviderFinal}]});
 await abandonmentHandler({url:'/api/match-centre?ids='+abandoned.id},{setHeader(){},status(){return this;},json(d){output=d.fixtures[0];}});
 assert.equal(output.status,'abandoned');assert.equal(output.statusCheckedAt,abandonedSample.checkedAt);assert.equal(output.scoreCheckedAt,abandonedSample.checkedAt);
 const h=createMatchCentreHandler({enabled:()=>true,published:()=>[base],request:async()=>snapshots.map(s=>({checked_at:s.checked_at,fixture:s.fixtures[0]}))});
 await h({url:'/api/match-centre?ids='+base.id},{setHeader(){},status(){return this;},json(d){output=d.fixtures[0];}});
 assert.equal(output.status,'live');assert.equal(output.checkedAt,scoreTime);assert.equal(output.scoreCheckedAt,scoreTime);assert.equal(output.statusCheckedAt,scoreTime);
 const final={...base,status:'completed',format:'ODI',scoreDisplay:'South Africa won by 67 runs',innings:[{team:'South Africa Men',runs:297,wickets:8,overs:'50.0'},{team:'Australia Men',runs:230,wickets:10,overs:'41.2'}],sourceCheckedAt:'2026-09-27T06:40:38Z'};
 const staleAlias={...live,id:'fixture:cricket:ca:stale-alias',livePlayObservedAt:'2026-09-27T08:12:04Z'};
 const completedHandler=createMatchCentreHandler({enabled:()=>true,published:()=>[final],request:async()=>[{checked_at:'2026-09-27T08:12:04Z',fixture:staleAlias}]});
 await completedHandler({url:'/api/match-centre?ids='+base.id},{setHeader(){},status(){return this;},json(d){output=d.fixtures[0];}});
 assert.equal(output.status,'completed','later alias snapshots must not reopen a confirmed result');assert.equal(output.livePlayObservedAt,null);assert.equal(output.completedAt,null);assert.deepEqual(output.score.innings.map(i=>i.runs),[297,230]);
 console.log('Match observations: score/status provenance, schedule regression, interruptions, cancellation and unordered sources passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

{
const fs=require("node:fs");
const {applyCompletedCanonicalResult,resultObservationFields,applyRetainedResultObservations}=require("./sync-canonical-fixtures-to-feed");
// Fixed real pre-repair inputs: later releases must not make the provenance
// regression disappear merely by replacing the current published fixture.
const cp = require("node:child_process"), path = require("node:path"), os = require("node:os");
const provenanceBase = "5ed85a14c9439210642daf094d868d00642bd9a0";
const historical = file => JSON.parse(cp.execFileSync("git", ["show", `${provenanceBase}:${file}`], { maxBuffer:32*1024*1024 }));
const finalId = "event-afl-cd_m20260142901", finalCanonicalId = "event:afl:cd_m20260142901";
const finalBefore = historical("data/events.json").events.find(event => event.id === finalId);
const finalBundle = historical("data/canonical/afl-nrl-2026.json");
const finalFixture = finalBundle.events.find(event => event.id === finalCanonicalId);
const finalParticipants = new Map(finalBundle.participants.map(participant => [participant.id, participant]));
assert(Date.parse(finalBefore.scoreCheckedAt) < Date.parse(finalBefore.startTimeUtc), "Actual pre-match score clock is required for this regression");
const finalAfter = applyCompletedCanonicalResult(finalBefore, finalFixture, finalParticipants);
assert.equal(finalAfter.scoreCheckedAt, finalFixture.source.checkedAt, "The result uses the supplied post-match observation, not the earlier schedule check");
assert.equal(finalAfter.statusCheckedAt, finalFixture.source.checkedAt);
assert.equal(finalAfter.resultSourceUrl, "https://www.afl.com.au/afl/matches/9028");
for(const key of ["id","eventId","canonicalEventId","participantIds","date","time","startTimeUtc","homeScore","awayScore","sourceUrl","sourceCheckedAt","viewingOptions","editorialPreview","editorialNarrative","lastReviewedAt"])
  assert.deepEqual(finalAfter[key], finalBefore[key], `${key}: an observation repair cannot change fixture facts, schedule/viewing dates or reviewed copy`);
const laterFinal = {...finalFixture, source:{...finalFixture.source, checkedAt:"2026-10-04T00:00:00.000Z"}};
assert.deepEqual(resultObservationFields(finalAfter, laterFinal), {}, "An unchanged final retains its original valid result observation");
const knownFinal = {...finalBefore, scoreCheckedAt:"2026-10-01T17:36:14.023Z", statusCheckedAt:"2026-10-01T17:36:14.023Z"};
assert.deepEqual(resultObservationFields(knownFinal, finalFixture), {}, "Explicit valid fact dates survive an older general schedule date");
for(const checkedAt of ["invalid", "2026-02-30T00:00:00.000Z", "2099-01-01T00:00:00.000Z", "2026-09-22T01:40:00.000Z"])
  assert.deepEqual(resultObservationFields(finalBefore, {...finalFixture, source:{...finalFixture.source, checkedAt}}), {}, "Invalid, future or pre-match observations cannot repair a final clock");
assert.deepEqual(resultObservationFields(finalBefore, {...finalFixture, source:{...finalFixture.source, sourceUrl:"https://user:secret@example.test/result"}}), {}, "Embedded credentials cannot enter result provenance");
assert.deepEqual(resultObservationFields({...finalBefore,awayScore:0}, finalFixture), {}, "A different score cannot inherit this result's source date");
const parseRefreshOptions=require('./update-cards').parseOptions;
for(const argv of [['--result-observations'],['--reviewed-fixtures','--result-observations'],['--reviewed-fixtures','--result-observations','--ids=x','--restore-published=x']])
  assert.throws(()=>parseRefreshOptions(argv), /No source steps ran/, "An invalid scoped repair cannot fall through to full source refresh");
const supplemental = {...finalFixture, result:{...finalFixture.result, source:{provider:"Independent result source",sourceUrl:"https://example.test/result",checkedAt:"2026-09-27T00:00:00.000Z"}}};
assert.equal(resultObservationFields(finalBefore, supplemental).scoreCheckedAt, supplemental.result.source.checkedAt, "Result-specific evidence owns its observation independently of the schedule");
const changedFinal = {...laterFinal, result:{...laterFinal.result, scorelineText:"Fremantle v Brisbane Lions — 0-96"}};
const correctedFinal = applyCompletedCanonicalResult(finalAfter, changedFinal, finalParticipants);
assert.equal(correctedFinal.homeScore, 0, "A real zero score correction survives");
assert.equal(correctedFinal.scoreCheckedAt, laterFinal.source.checkedAt, "Changed facts carry their actual new observation");

const provenanceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ns-final-observations-"));
try {
  const files = ["feeds/incoming/events.json", "data/events.json"];
  fs.mkdirSync(path.join(provenanceRoot, "data/canonical"), {recursive:true});
  fs.writeFileSync(path.join(provenanceRoot, "data/canonical/afl-nrl-2026.json"), JSON.stringify(finalBundle));
  for(const file of files){
    fs.mkdirSync(path.dirname(path.join(provenanceRoot, file)), {recursive:true});
    const doc = historical(file), fixture = doc.events.find(event => event.id === finalId);
    fs.writeFileSync(path.join(provenanceRoot, file), JSON.stringify({...doc,events:[fixture,{id:"unrelated",sourceCheckedAt:"2026-09-01T00:00:00Z"}]}, null, 2) + "\n");
  }
  const bytes = () => files.map(file => fs.readFileSync(path.join(provenanceRoot, file), "utf8"));
  const before = bytes();
  assert.deepEqual(applyRetainedResultObservations([finalId], {root:provenanceRoot}), {selected:1,changed:2});
  const repaired = bytes();
  for(const [index, raw] of repaired.entries()){
    const old = JSON.parse(before[index]), current = JSON.parse(raw);
    assert.deepEqual(current.events[1], old.events[1]);
    for(const key of Object.keys(old.events[0]).filter(key => !["scoreCheckedAt","statusCheckedAt","resultSourceUrl","resultSourceCheckedAt"].includes(key)))
      assert.deepEqual(current.events[0][key], old.events[0][key], `${key}: scoped persistence preserves every other field`);
    assert.equal(current.events[0].scoreCheckedAt, finalFixture.source.checkedAt);
    assert.deepEqual({...current,events:old.events}, old, "Feed publication metadata is not a result observation");
  }
  assert.deepEqual(applyRetainedResultObservations([finalId], {root:provenanceRoot}), {selected:1,changed:0});
  assert.deepEqual(bytes(), repaired, "Identical reruns preserve both surface bytes");
  const inconsistent = JSON.parse(repaired[1]);inconsistent.events[0].awayScore=0;
  fs.writeFileSync(path.join(provenanceRoot, files[1]), JSON.stringify(inconsistent));
  const failed = bytes();
  assert.throws(() => applyRetainedResultObservations([finalId], {root:provenanceRoot}), /away score disagrees/);
  assert.deepEqual(bytes(), failed, "Failure on the second surface cannot partly write the first");
} finally {fs.rmSync(provenanceRoot, {recursive:true,force:true});}

console.log("Reference final observations: real pre-match clock repair, original schedule/editorial dates, unchanged rechecks, invalid sources, zero correction, two-surface persistence and failure preflight passed.");
}
