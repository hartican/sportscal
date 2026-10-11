#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures');
const fixture=require('./fixtures/live-fixture-epl-review.json');
const secret='PRIVATE_ACCOUNT_TOKEN_MUST_NOT_APPEAR';
const bundle={schemaVersion:'current-fixture-bundle.v1',scope:'match-centre',complete:true,rows:[{source_id:'live-premier-league',fixture}]};
const health=[{source_id:'live-premier-league',revision:42,checked_at:fixture.sourceCheckedAt}];
const remoteError=()=>Object.assign(Error(secret),{status:504,payload:{code:'supabase_timeout',message:secret,details:secret,token:secret}});
const warnings=[],warn=console.warn;
console.warn=(...args)=>warnings.push(args);
(async()=>{
 try{
  for(const phase of ['source-health','fixture-bundle']){
   warnings.length=0;const failure=remoteError(),calls=[];
   const store=createSnapshotStore({request:async(path,options)=>{calls.push({path,options});assert.equal(options.timeoutMs,3000);assert.equal(options.method,'POST');if(path.endsWith('nothingsports_read_fixture_source_health')){if(phase==='source-health')throw failure;return health;}if(phase==='fixture-bundle')throw failure;return bundle;}});
   await assert.rejects(store.read({scope:'match-centre',preserveIds:[fixture.id]}),e=>e===failure,'the original failure must reach the existing fallback');
   assert.equal(calls.length,2,'diagnosis adds no request or retry');
   assert.equal(warnings.length,1,'one failed shared read needs one diagnostic');
   const entry=JSON.parse(warnings[0][1]);assert.equal(entry.event,'fixture_snapshot_read_failed');assert.equal(entry.scope,'match-centre');assert.equal(entry.phase,phase);assert.equal(entry.status,504);assert.equal(entry.code,'supabase_timeout');assert.equal(entry.deadlineMs,3000);assert(Number.isFinite(entry.elapsedMs)&&entry.elapsedMs>=0);
   assert(!JSON.stringify(warnings).includes(secret),'messages, payloads, credentials and user fields must never be logged');assert.deepEqual(Object.keys(entry).sort(),['event','scope','phase','status','code','deadlineMs','elapsedMs'].sort(),'diagnostic fields are a closed list');
  }
  warnings.length=0;
  const invalid=createSnapshotStore({request:async path=>path.endsWith('nothingsports_read_fixture_source_health')?health:{...bundle,complete:false}});
  await assert.rejects(invalid.read({scope:'match-centre'}),/Incomplete current fixture bundle/);
  assert.equal(warnings.length,1);assert.equal(JSON.parse(warnings[0][1]).phase,'validation');assert.equal(JSON.parse(warnings[0][1]).status,null);
  warnings.length=0;let recoveredCalls=0;
  const healthy=createSnapshotStore({request:async path=>{recoveredCalls++;return path.endsWith('nothingsports_read_fixture_source_health')?health:bundle;}});
  const published=await healthy.read({scope:'match-centre'});assert.equal(recoveredCalls,2);assert.equal(warnings.length,0,'healthy reads stay quiet');assert.deepEqual(published[0].fixtures,[fixture],'diagnostics cannot alter source facts or original clocks');
  warnings.length=0;let legacyCalls=0;
  const legacyFailure=Object.assign(Error(secret),{status:502,payload:{code:secret}});
  const legacy=createSnapshotStore({request:async path=>{legacyCalls++;if(path.includes('/rpc/'))throw Object.assign(Error(secret),{status:404});throw legacyFailure;}});
  await assert.rejects(legacy.read({scope:'match-centre'}),e=>e===legacyFailure);assert.equal(legacyCalls,3,'existing compatibility fallback remains bounded');assert.equal(warnings.length,1);const last=JSON.parse(warnings[0][1]);assert.equal(last.phase,'legacy-read');assert.equal(last.code,null);assert(!JSON.stringify(warnings).includes(secret));
  warnings.length=0;let fail=false;
  const cached=createSnapshotStore({request:async path=>{if(fail)throw remoteError();return path.endsWith('nothingsports_read_fixture_source_health')?health:bundle;}});
  const options={store:cached,scope:'match-centre',preserveIds:['diagnostic:cached-read-control'],maxAgeMs:0};
  const fresh=await readLiveSnapshots({...options,now:10000});fail=true;const stale=await readLiveSnapshots({...options,now:40001});assert.equal(stale.stale,true,'a failed read still marks the last-good snapshot stale');assert.equal(stale.readAt,fresh.readAt,'failure must not renew the saved read date');assert.deepEqual(stale.sources,fresh.sources);assert.equal(warnings.length,1);
  console.warn=()=>{throw Error('logger unavailable');};await assert.rejects(cached.read({scope:'match-centre'}),e=>e.status===504,'logging cannot replace or hide the original read failure');
  console.warn=warn;console.log('Snapshot read diagnosis passed: safe phase/status/timing, no retries, original errors and last-good facts preserved.');
 }finally{console.warn=warn;}
 await require('./validate-supabase-response-deadline')();
})().catch(e=>{console.error(e);process.exitCode=1});
