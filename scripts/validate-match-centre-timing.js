'use strict';
const assert=require('node:assert/strict');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const now=Date.parse('2026-10-16T15:05:16Z'),stamp=new Date(now).toISOString();
const fixture={id:'fixture:nrl:diagnostic-only',key:'nrl',status:'live',startTimeUtc:new Date(now-1800000).toISOString(),statusCheckedAt:stamp,scoreCheckedAt:stamp,fixtureObservationSchema:'fixture-observations.v1',homeParticipantId:'team:nrl:diagnostic-home',awayParticipantId:'team:nrl:diagnostic-away',homeScore:0,awayScore:7};
const secret='PRIVATE_QUERY_PAYLOAD_OR_CREDENTIAL_MUST_NOT_APPEAR';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function run(){
 const previous=process.env.VERCEL,warn=console.warn,logs=[];process.env.VERCEL='1';console.warn=(...args)=>logs.push(args);
 try{
  const original=JSON.stringify(fixture);let elapsed=0,snapshots=0,scores=0;
  const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>now,timer:()=>elapsed,published:()=>{elapsed+=40;return [];},snapshotRead:async()=>{snapshots++;elapsed+=2500;return {readAt:now,stale:false,sources:[{fixtures:[fixture]}]};},request:async()=>{scores++;return [];}});
  let res=response();await handler({method:'GET',url:'/api/match-centre?membership=everything&limit=60&ignored='+secret},res);
  assert.equal(res.code,200);assert.equal(res.body.fixtures.length,1);assert.deepEqual(res.body.fixtures[0].score,{home:0,away:7});assert.equal(res.body.fixtures[0].scoreCheckedAt,stamp);assert.equal(res.body.membershipStale,false);assert.equal(snapshots,1);assert.equal(scores,0,'Timing must not add a read or bypass fresh observation reuse');
  assert.match(res.headers['Server-Timing']||'',/snapshot;dur=2500\.00/,'The actual public handler must expose the slow phase');
  assert.equal(logs.length,1,'One slow origin response produces one bounded diagnostic');
  const entry=JSON.parse(logs[0][1]);assert.equal(entry.event,'match_centre_timing');assert.equal(entry.mode,'listing');assert.equal(entry.fixtures,1);assert.equal(entry.readDegraded,false);assert.equal(entry.membershipStale,false);assert.equal(entry.timingsMs.catalogue,40);assert.equal(entry.timingsMs.snapshot,2500);assert.equal(entry.timingsMs.total,2540);
  assert.deepEqual(Object.keys(entry).sort(),['event','mode','fixtures','membershipStale','readDegraded','timingsMs'].sort(),'Diagnostic fields are a closed aggregate-only list');
  assert(!JSON.stringify(logs).includes(secret)&&!JSON.stringify(logs).includes(fixture.id)&&!JSON.stringify(logs).includes(stamp),'No query, fixture identity, sporting timestamp or payload may reach logs');
  assert.equal(JSON.stringify(fixture),original,'Measurement never edits source facts or dates');
  for(const duration of [0,1999]){
   logs.length=0;elapsed=0;const fast=createMatchCentreHandler({enabled:()=>true,clock:()=>now,timer:()=>elapsed,published:()=>[],snapshotRead:async()=>{elapsed+=duration;return {readAt:now,stale:false,sources:[]};},request:async()=>{throw Error('Unexpected score read');}});res=response();await fast({url:'/api/match-centre?membership=everything'},res);assert.equal(logs.length,0,'Healthy origin responses under the two-second diagnostic threshold stay quiet');assert.equal(res.body.membershipStale,false);assert.equal(res.body.fixtures.length,0);
  }
  logs.length=0;elapsed=0;const degraded=createMatchCentreHandler({enabled:()=>true,clock:()=>now,timer:()=>elapsed,published:()=>[],snapshotRead:async()=>{elapsed+=3000;throw Error(secret);},request:async()=>{throw Error('Unexpected score read');}});res=response();await degraded({url:'/api/match-centre?membership=everything'},res);assert.equal(res.body.membershipStale,true);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(logs.length,1);assert.equal(JSON.parse(logs[0][1]).readDegraded,true);assert(!JSON.stringify(logs).includes(secret));
  logs.length=0;elapsed=0;let selectedReads=0;const selected=createMatchCentreHandler({enabled:()=>true,clock:()=>now,timer:()=>elapsed,published:()=>[fixture],snapshotRead:async()=>{throw Error('Selected reads cannot load membership');},request:async(_path,options)=>{selectedReads++;assert.equal(options.timeoutMs,3000);elapsed+=2100;return [{fixture,checked_at:stamp}];}});res=response();await selected({url:'/api/match-centre?ids='+fixture.id},res);assert.equal(selectedReads,1);assert.equal(logs.length,1);assert.equal(JSON.parse(logs[0][1]).mode,'selected');assert.equal(JSON.parse(logs[0][1]).timingsMs.scores,2100);assert.deepEqual(res.body.fixtures[0].score,{home:0,away:7});
  console.warn=()=>{throw Error('Logger unavailable');};res=response();await degraded({url:'/api/match-centre?membership=everything'},res);assert.equal(res.code,200);assert.equal(res.body.membershipStale,true,'Logging failure cannot hide the original degraded response');
  logs.length=0;console.warn=(...args)=>logs.push(args);delete process.env.VERCEL;res=response();await degraded({url:'/api/match-centre?membership=everything'},res);assert.equal(logs.length,0,'Local callers do not emit hosting diagnostics');
  res=response();await handler({method:'POST',url:'/api/match-centre'},res);assert.equal(res.code,405);assert.equal(res.headers['Server-Timing'],undefined,'Rejected calls do not initialise measured work');
  const verify=require('./verify-match-centre-public'),allTimings='catalogue;dur=40.00, prepare;dur=5.00, snapshot;dur=2500.00, merge;dur=2.00, selection;dur=3.00, scores;dur=0.00, projection;dur=1.00, total;dur=2551.00';
  for(const empty of [true,false]){
   let requests=0,measured=0,receipt;const transport=async(url,options)=>{requests++;assert(options.signal);assert(url.startsWith('https://nothingsport.vercel.app/api/match-centre?'));const selected=url.includes('?ids=');assert.equal(selected,requests===2);measured+=2551;return {status:200,headers:new Map([['Server-Timing',(selected?allTimings.split(', ').filter(field=>!/^(prepare|snapshot|merge);/.test(field)).join(', '):allTimings)+', secret;desc="'+secret+'"']]),json:async()=>({enabled:true,membershipStale:false,events:[],fixtures:empty?[]:[{id:fixture.id,sport:'nrl',homeParticipantId:fixture.homeParticipantId,awayParticipantId:fixture.awayParticipantId}]})};};
   await verify({fetchImpl:transport,timer:()=>measured,log:value=>{receipt=JSON.parse(value);}});assert.equal(requests,empty?1:2,'The normal release uses exactly its existing membership/selected request budget');assert.equal(receipt.reads.length,requests);assert(receipt.reads.every(read=>read.elapsedMs===2551&&(read.kind==='membership'?read.serverMs.snapshot===2500:!Object.hasOwn(read.serverMs,'snapshot'))));assert.equal(receipt.emptyQuietWindowAccepted,empty);assert.equal(receipt.displayed,empty?0:1);assert(!JSON.stringify(receipt).includes(secret)&&!JSON.stringify(receipt).includes(fixture.id),'Only constant phase names and numbers enter the release receipt');
  }
  let invalidReads=0;await assert.rejects(verify({fetchImpl:async()=>{invalidReads++;return {status:200,headers:new Map(),json:async()=>({enabled:true,membershipStale:false,events:[],fixtures:[]})};},timer:()=>0,log:()=>{}}),/origin timing/);assert.equal(invalidReads,1,'Missing origin evidence fails once without a retry');
  for(const missing of ['prepare','snapshot','merge']){
   let calls=0;const header=allTimings.split(', ').filter(field=>!field.startsWith(missing+';')).join(', ');
   await assert.rejects(verify({fetchImpl:async()=>{calls++;return {status:200,headers:new Map([['Server-Timing',header]]),json:async()=>({enabled:true,membershipStale:false,events:[],fixtures:[]})};},timer:()=>0,log:()=>{}}),new RegExp(missing+' origin timing'));
   assert.equal(calls,1,'An individually missing membership phase fails once without retry');
  }
  console.log('Match Centre timings passed: actual handler phases, quiet healthy reads, aggregate-only slow/degraded logging, no extra reads, original facts and failure behaviour.');
 }finally{console.warn=warn;if(previous===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous;}
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=run;
