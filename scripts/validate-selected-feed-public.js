#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {main,project,TARGET,URL}=require('./verify-selected-feed-public');
const capture=require('./fixtures/cricket-score-address-20261020.json'),sha='a'.repeat(40);
const fixture={...capture.rows.find(r=>r.source_id==='cricket-ca-current').fixture,id:TARGET,sourceStale:false};
const selected={sha,available:true,fixture:{id:TARGET},membershipFixture:project(fixture)};
function harness({body,selectedEvidence=selected,allocatedSha=sha,status=200,transport,claim}={}){
 const calls=[],receipts=[];let claims=0;
 return {calls,receipts,get claims(){return claims;},run:()=>main({sha,allocatedSha,selected:selectedEvidence,claim:()=>{claims++;claim?.();},write:r=>receipts.push(structuredClone(r)),fetchImpl:async(url,options)=>{calls.push({url,options});if(transport)return transport(options);return {status,json:async()=>body||{schemaVersion:'live-fixtures.v1',stale:false,maxAgeSeconds:30,sources:[{fixtures:[structuredClone(fixture)]}]}};}})};
}
(async()=>{
 const inactive=harness({allocatedSha:''});assert.equal((await inactive.run()).outcome,'NOT_ALLOCATED');assert.equal(inactive.calls.length,0);
 const absent=harness({selectedEvidence:{sha,available:false}});assert.equal((await absent.run()).outcome,'NOT_EXERCISED');assert.equal(absent.calls.length,0);assert.equal(absent.claims,0);
 const wrong=harness({allocatedSha:'b'.repeat(40)});await assert.rejects(wrong.run,/allocation/);assert.equal(wrong.calls.length,0);
 const wrongEvidence=harness({selectedEvidence:{...selected,sha:'b'.repeat(40)}});await assert.rejects(wrongEvidence.run,/belong/);assert.equal(wrongEvidence.calls.length,0);
 const healthy=harness();const proof=await healthy.run();assert.equal(proof.outcome,'PASS');assert.deepEqual(proof.comparison,{score:'MATCH',status:'MATCH'});assert.equal(healthy.calls.length,1);assert.equal(healthy.claims,1);assert.equal(healthy.calls[0].url,URL);assert.equal(healthy.calls[0].options.method,'GET');assert(healthy.calls[0].options.signal instanceof AbortSignal);
 const zero={...fixture,innings:[{...fixture.innings[0],runs:0,wickets:0,overs:'0.0'}]};const zeroBody={schemaVersion:'live-fixtures.v1',stale:false,maxAgeSeconds:30,sources:[{fixtures:[zero]}]};
 assert.equal((await harness({body:zeroBody,selectedEvidence:{...selected,membershipFixture:project(zero)}}).run()).fixture.innings[0].runs,0);
 const changed={...zero,scoreFactObservedAt:'2026-10-20T02:00:00Z',statusFactObservedAt:'2026-10-20T02:00:00Z',matchDay:3,status:'live'};
 const different=harness({body:{...zeroBody,sources:[{fixtures:[changed]}]}});assert.deepEqual((await different.run()).comparison,{score:'NOT_COMPARABLE',status:'NOT_COMPARABLE'},'Natural source revisions are not invented equality or monotonicity');
 const failureBodies=[
  {...zeroBody,stale:true}, {...zeroBody,maxAgeSeconds:300}, {...zeroBody,schemaVersion:'invalid'}, {...zeroBody,sources:[]},
  ...[{id:'fixture:cricket:CA:39991'},{homeParticipantId:'wrong'},{awayParticipantId:'wrong'},{sourceStale:true},{cricketPhaseConfirmed:false},{matchDay:null},{status:'upcoming'},{innings:[]},
   {scoreCheckedAt:null},{scoreFactObservedAt:'no-zone'},{statusFactObservedAt:null},{statusCheckedAt:'invalid'},
   {innings:[{...fixture.innings[0],runs:-1}]},{innings:[{...fixture.innings[0],wickets:11}]},{innings:[{...fixture.innings[0],overs:'43.6'}]},
   {innings:[{...fixture.innings[0],participantId:'wrong'}]}].map(delta=>({...zeroBody,sources:[{fixtures:[{...fixture,...delta}]}]})),
  zeroBody // same original score revision with a different score must fail
 ];
 for(const body of failureBodies){const h=harness({body});await assert.rejects(h.run,/Selected Feed release check failed at/);assert.equal(h.calls.length,1);assert.equal(h.receipts[0].outcome,'FAIL');assert(!Object.hasOwn(h.receipts[0],'fixture'),'Failed response facts are not emitted');}
 const http=harness({status:504});await assert.rejects(http.run,/http-status/);assert.equal(http.receipts[0].httpStatus,504);
 const secret='PRIVATE-UNLISTED-ERROR';for(const transport of [async()=>{throw Error(secret);},async()=>({status:200,json:async()=>{throw Error(secret);}})]){const h=harness({transport});await assert.rejects(h.run,e=>!e.message.includes(secret));assert.equal(h.calls.length,1);assert(!JSON.stringify(h.receipts).includes(secret));}
 const raw={...fixture,privateField:secret,innings:[{...fixture.innings[0],privateField:secret}]};assert(!JSON.stringify(project(raw)).includes(secret));
 const duplicate=harness({claim:()=>{throw Error('Already claimed');}});await assert.rejects(duplicate.run,/Already claimed/);assert.equal(duplicate.calls.length,0);
 const deadline=harness({transport:async options=>({status:200,json:()=>new Promise(()=>{options.signal.addEventListener('abort',()=>{});})})});const began=performance.now();await assert.rejects(deadline.run,/body/);assert(performance.now()-began<6000);assert.equal(deadline.calls.length,1);assert(deadline.calls[0].options.signal.aborted);
 const workflow=fs.readFileSync(require('node:path').join(__dirname,'../.github/workflows/sportscal-production.yml'),'utf8');
 assert(workflow.includes('NS_SELECTED_FEED_PROOF_SHA: ${{ inputs.selected_feed_proof_sha }}'));
 assert(workflow.includes('test -z "$NS_SELECTED_FEED_PROOF_SHA" || test "$NS_SELECTED_FEED_PROOF_SHA" = "$RELEASE_SHA"'));
 assert(/verify-match-centre-public\.js[\s\S]*validate-security-headers\.js https:\/\/nothingsport\.vercel\.app[\s\S]*verify-selected-feed-public\.js \|\| feed_status=\$\?[\s\S]*verify-global-fixture-public\.js\n\s+exit "\$feed_status"/.test(workflow),'Feed failure cannot skip or weaken the existing security/global gates');
 console.log('Selected Feed release proof: exact one-use SHA admission, target absence, canonical official facts/zero/clocks, revision-aware comparisons, safe failures, no retry and five-second whole-read deadline passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
