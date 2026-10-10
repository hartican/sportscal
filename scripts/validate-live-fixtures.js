#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {refreshDueSources,refreshInterval,contentHash,overlaySnapshots,createSnapshotStore}=require("../lib/live-fixtures");
const now=new Date("2026-09-08T00:00:00Z");
const event={id:"match",key:"rugby",name:"Test",startTimeUtc:"2026-09-08T00:10:00Z",status:"scheduled"};
assert.equal(refreshInterval([event],now),120000);
assert.equal(refreshInterval([{...event,status:"live"}],now),120000);
assert.equal(refreshInterval([{...event,startTimeUtc:"2026-10-01T00:00:00Z"}],now),30*60000);
assert.equal(contentHash([event]),contentHash([{...event,sourceCheckedAt:now.toISOString()}]),"checking unchanged facts must not create a new revision");
// Captured EPL fixture: producer review timestamps change on every successful check.
const eplReviewFixture=require("./fixtures/live-fixture-epl-review.json");
const recheckedEpl={...eplReviewFixture,lastReviewedAt:now.toISOString(),sourceCheckedAt:now.toISOString(),canonicalSourceCheckedAt:now.toISOString()};
assert.equal(contentHash([eplReviewFixture]),contentHash([recheckedEpl]),"EPL observation timestamps alone must not create a fact revision");
// Actual production revisions 7362/7363 changed only observation clocks.
const resultClocks=require('./fixtures/epl-result-observation-clocks.json').rows.map(row=>row.fixture);
assert.equal(contentHash([resultClocks[0]]),contentHash([resultClocks[1]]),'rechecking the captured EPL final must not revise sporting facts');
for(const change of [
  {outcomeText:'Corrected final outcome'}, {resultPublishedAt:'2026-10-02T18:00:00Z'},
  {resultSourceUrl:'https://www.premierleague.com/en/match/correction'},
  {startTimeUtc:'2026-08-21T20:00:00.000Z'}, {status:'abandoned'},
  {participantIds:['team:football:epl:1','team:football:epl:6']},
  {viewingOptions:[{providerId:'stan',webUrl:'https://www.stan.com.au/sport'}]},
])assert.notEqual(contentHash([resultClocks[0]]),contentHash([{...resultClocks[1],...change}]),'captured final facts remain detectable: '+Object.keys(change)[0]);
for(const change of [
  {startTimeUtc:"2026-08-21T20:00:00.000Z"},
  {endTimeUtc:"2026-08-21T22:00:00.000Z"},
  {participantIds:["team:football:epl:2","team:football:epl:5"]},
  {homeScore:4}, {status:"postponed"},
  {broadcastOptions:[{providerId:"stan",webUrl:"https://www.stan.com.au/sport"}]},
])assert.notEqual(contentHash([eplReviewFixture]),contentHash([{...recheckedEpl,...change}]),"real fixture changes remain detectable: "+Object.keys(change)[0]);
assert.notEqual(contentHash([event,eplReviewFixture]),contentHash([eplReviewFixture,event]),"this repair must not change array-order semantics");
assert.equal(overlaySnapshots([event],[{fixtures:[{...event,status:"postponed",time:null,startTimeUtc:null}]}])[0].status,"postponed");
async function main(){
  // Exercise the real publish adapter, including the optional compact-score path.
  const priorScoreWrites=process.env.MATCH_CENTRE_SCORE_WRITES;
  try{
    for(const compact of [false,true]){
      process.env.MATCH_CENTRE_SCORE_WRITES=String(compact);
      const calls=[];
      const adapter=createSnapshotStore({request:async(path,options)=>{calls.push({path,body:options.body});return 1;}});
      for(const fixture of [eplReviewFixture,recheckedEpl,{...recheckedEpl,homeScore:4}]){
        await adapter.publish("live-premier-league","test-token",{fixtures:[fixture],hash:contentHash([fixture]),intervalMs:1800000});
      }
      assert.equal(calls[0].body.p_hash,calls[1].body.p_hash,"rechecks reach persistence with the same fact hash");
      if(compact){
        assert.equal(calls[1].body.p_hash,calls[2].body.p_hash,"score-only changes use the compact score channel");
        assert.equal(calls[2].body.p_scores[0].homeScore,4,"real scores still reach compact persistence");
      }else assert.notEqual(calls[1].body.p_hash,calls[2].body.p_hash,"real scores still revise ordinary snapshots");
      assert.equal(calls[1].body.p_fixtures[0].lastReviewedAt,recheckedEpl.lastReviewedAt,"hashing does not strip observation data from the payload");
      calls.length=0;
      for(const fixture of resultClocks)await adapter.publish('live-premier-league','test-token',{fixtures:[fixture],hash:contentHash([fixture]),intervalMs:1800000});
      assert.equal(calls[0].body.p_hash,calls[1].body.p_hash,'actual captured final reaches normal/compact persistence with the same hash');
      assert.equal(calls[1].body.p_fixtures[0].resultSourceCheckedAt,resultClocks[1].resultSourceCheckedAt,'original result observation remains in the persistence payload');
    }
  }finally{
    if(priorScoreWrites===undefined)delete process.env.MATCH_CENTRE_SCORE_WRITES;
    else process.env.MATCH_CENTRE_SCORE_WRITES=priorScoreWrites;
  }
  // The store is the external database boundary. Real SQL lease/RLS tests run separately.
  const rows=new Map([["rugby",{fixtures:[event,{...event,id:"retained"}],revision:1,nextDueAt:0}]]);
  const store={
    async claim(id,token){const row=rows.get(id);if(row.token||row.nextDueAt>+now)return null;row.token=token;return {...row};},
    async publish(id,token,value){const row=rows.get(id);assert.equal(row.token,token);Object.assign(row,value,{token:null,revision:row.revision+1});},
    async fail(id,token,value){const row=rows.get(id);assert.equal(row.token,token);Object.assign(row,value,{token:null});},
  };
  let release;const pending=new Promise(resolve=>{release=resolve;});
  const source={id:"rugby",fetch:async()=>{await pending;return [{...event,status:"live",homeScore:7}];}};
  const first=refreshDueSources({sources:[source],store,now});
  const second=await refreshDueSources({sources:[source],store,now});
  assert.deepEqual(second.refreshed,[],"an in-flight source is coalesced");
  release();await first;
  assert.equal(rows.get("rugby").fixtures.length,2,"partial successful responses retain omitted fixtures");
  assert.equal(rows.get("rugby").fixtures[0].homeScore,7,"scores are published without an editorial rebuild");
  rows.get("rugby").nextDueAt=0;
  const failed=await refreshDueSources({sources:[{id:"rugby",fetch:async()=>{throw new Error("upstream unavailable");}}],store,now});
  assert.equal(failed.failed.length,1);
  assert.equal(rows.get("rugby").fixtures[0].homeScore,7,"a failed refresh keeps the last good score");
  rows.get("rugby").nextDueAt=0;
  await refreshDueSources({sources:[{id:"rugby",fetch:async()=>({invalid:true})}],store,now});
  assert.equal(rows.get("rugby").fixtures.length,2,"malformed responses cannot clear the snapshot");
  rows.get('rugby').nextDueAt=0;
  const mixed=await refreshDueSources({sources:[{id:'rugby',fetch:async()=>[null,{...event,id:'new-fixture',status:'live'}]}],store,now});
  assert.deepEqual(mixed.refreshed,['rugby'],'one invalid record must not suppress another new followed fixture');
  assert(rows.get('rugby').fixtures.some(row=>row.id==='new-fixture'));
  for(const [failures,retryMs,expected] of [[0,undefined,300000],[1,undefined,600000],[2,undefined,1200000],[1911,undefined,1800000],[20,3600000,3600000]]){
    let retry;
    const failedStore={claim:async()=>({fixtures:[event],failure_count:failures}),fail:async(id,token,value)=>{retry=value;}};
    await refreshDueSources({sources:[{id:'repeated-failure',retryMs,fetch:async()=>{throw new Error('empty source');}}],store:failedStore,now});
    assert.equal(retry.retryMs,expected,"repeated source failure backoff must be bounded");
  }
  const nearDue=Date.now()+150,observedNow=new Date(),nearCalls=[];
  const nearStore={dueIds:async()=>[{source_id:'near-due',next_due_at:new Date(nearDue).toISOString()}],claim:async(id)=>{assert(Date.now()>=nearDue,'A near-due source cannot claim before its database deadline');nearCalls.push('claim');return {fixtures:[event]};},publish:async()=>nearCalls.push('publish'),fail:async()=>assert.fail('Healthy near-due source cannot enter backoff')};
  const nearResult=await refreshDueSources({sources:[{id:'near-due',fetch:async({now})=>{assert.equal(now,observedNow,'Waiting cannot manufacture a newer sporting observation clock');nearCalls.push('fetch');return [event];}}],store:nearStore,now:observedNow});assert.deepEqual(nearResult.refreshed,['near-due']);assert.deepEqual(nearCalls,['claim','fetch','publish'],'The same tick performs one fenced source check without a retry');
  let earlyClaims=0;const laterStore={dueIds:async()=>[{source_id:'later-due',next_due_at:new Date(Date.now()+6000).toISOString()}],claim:async()=>{earlyClaims++;}};
  const laterResult=await refreshDueSources({sources:[{id:'later-due'}],store:laterStore,now:new Date()});assert.deepEqual(laterResult.skipped,['later-due']);assert.equal(earlyClaims,0,'Outside the bounded lookahead no source call is added');
  const exhausted=await refreshDueSources({sources:[{id:'near-due',fetch:async()=>assert.fail('Deadline cannot be increased to wait for a source')}],store:{...nearStore,dueIds:async()=>[{source_id:'near-due',next_due_at:new Date(Date.now()+300).toISOString()}]},now:new Date(),maxRuntimeMs:500});assert.deepEqual(exhausted.skipped,['near-due']);
  await require('./validate-live-source-cadence')();
  console.log("Live fixtures: due cadence, bounded near-due wait, fenced source minimum, coalescing, revisions and last-good preservation passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
