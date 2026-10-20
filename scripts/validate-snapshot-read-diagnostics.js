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
 await validateGlobalTiming();
 await validateDefaultGlobalEnablement();
 await validateLoggerRejections();
 await require('./validate-supabase-response-deadline')({offline:process.argv.includes('--offline')});
})().catch(e=>{console.error(e);process.exitCode=1});


async function validateGlobalTiming(){
 const {supabaseRequest}=require('../lib/supabase-server');
 const source=[{source_id:'PRIVATE_SOURCE',revision:1,checked_at:'2026-10-18T00:00:00Z'}];
 const globalBundle={schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[{source_id:'PRIVATE_SOURCE',fixture_id:'PRIVATE_FIXTURE',fixture:{...fixture,id:'PRIVATE_FIXTURE'}}]};
 const warnings=[],old=console.warn;let time=0,fail=false,calls=0;
 const request=async(path,options)=>{calls++;time+=1;return supabaseRequest(path,{...options,environment:{SUPABASE_URL:'https://private.invalid',SUPABASE_PUBLISHABLE_KEY:'PRIVATE_KEY'},fetchImpl:async()=>{
  if(fail&&!path.endsWith('source_health'))throw Error('PRIVATE_NETWORK_MESSAGE');
  return {ok:true,status:200,text:async()=>JSON.stringify(path.endsWith('source_health')?source:[{bundle:globalBundle}])};
 }});};
 console.warn=(...args)=>warnings.push(JSON.parse(args[1]));
 try{
  const store=createSnapshotStore({request,timer:()=>time,diagnostics:true});
  await store.read();assert.equal(warnings.length,0,'Fast opt-in global success stays quiet');
  const slow=createSnapshotStore({request:async(...args)=>{const value=await request(...args);time+=2100;return value;},timer:()=>time,diagnostics:true});
  const output=await slow.read();assert.equal(output[0].fixtures.length,1);assert.equal(warnings.length,1);const entry=warnings.pop();assert.equal(entry.event,'fixture_snapshot_read_slow');assert.equal(entry.scope,'global');assert.equal(entry.phase,'complete');assert.equal(entry.deadlineMs,3000);assert(entry.timings.validationMs>=0&&entry.timings.projectionMs>=0);
  assert.deepEqual(Object.keys(entry.timings.legs).sort(),['fixture-bundle','source-health']);for(const leg of Object.values(entry.timings.legs)){assert.equal(leg.outcome,'success');assert(leg.transport.some(e=>e.phase==='text-ready'));}
  assert(!JSON.stringify(entry).includes('PRIVATE_'));
  fail=true;await assert.rejects(store.read());assert.equal(warnings.length,1);assert.equal(warnings[0].phase,'fixture-bundle');assert(warnings[0].timings.legs['fixture-bundle'].transport.some(e=>e.phase==='error'));assert.equal(warnings[0].timings.projectionMs,null,'Unentered projection stays unknown');
  assert(!JSON.stringify(warnings).includes('PRIVATE_'));
  fail=false;warnings.length=0;
  const near=createSnapshotStore({request:async(path,o)=>{assert.equal(o.onTiming,undefined,'Opt-in remains global-only');return path.endsWith('source_health')?source:{...globalBundle,scope:'match-centre'};},diagnostics:true});await near.read({scope:'match-centre'});assert.equal(warnings.length,0);
  const normal=createSnapshotStore({request:async(path,o)=>{assert.equal(o.onTiming,undefined);return path.endsWith('source_health')?source:[{bundle:globalBundle}];}});await normal.read();
  console.warn=()=>{throw Error('PRIVATE_LOGGER');};await slow.read();
  assert.equal(calls,8,'Only the original two RPCs per exercised global read');
  console.warn=(...args)=>warnings.push(JSON.parse(args[1]));warnings.length=0;
  for(const scope of ['selected','participants','interactive-near']){
   const untouched=createSnapshotStore({diagnostics:true,request:async(path,o)=>{
    assert.equal(o.onTiming,undefined,'Selected/profile reads must not opt into global timing');
    assert.equal(o.timeoutMs,scope==='selected'?3000:5000,'Trusted5s and selected3s split remains');
    if(path.endsWith('source_health'))return source;
    if(scope==='interactive-near')return {...globalBundle,scope:'match-centre'};
    return scope==='selected'?globalBundle.rows:{...globalBundle,scope:'participants',sportKeys:['tennis'],knownSportKeys:['tennis'],participantIds:['athlete:controlled'],requiredIds:[]};
   },timer:()=>0});
   await untouched.read(scope==='interactive-near'?{scope:'match-centre',interactive:true}:scope==='selected'?{ids:['controlled']}:{scope:'participants',sportKeys:['tennis'],knownSportKeys:['tennis'],participantIds:['athlete:controlled'],interactive:true});
  }
  let releaseHealth;
  const pending=createSnapshotStore({diagnostics:true,request:async(path)=>path.endsWith('source_health')?new Promise(resolve=>{releaseHealth=resolve;}):Promise.reject(remoteError())});
  await assert.rejects(pending.read());const partial=warnings.pop();assert.equal(partial.timings.legs['source-health'].outcome,null,'Unfinished sibling outcome stays unknown');assert.equal(partial.timings.legs['source-health'].elapsedMs,null);assert.deepEqual(partial.timings.legs['source-health'].transport,[]);releaseHealth(source);
  const invalid=createSnapshotStore({diagnostics:true,request:async path=>path.endsWith('source_health')?source:[{bundle:{...globalBundle,complete:false}}]});await assert.rejects(invalid.read());const bad=warnings.pop();assert.equal(bad.phase,'validation');assert(bad.timings.validationMs>=0);assert.equal(bad.timings.projectionMs,null);
  for(const status of [400,404]){
   warnings.length=0;let jsonCalls=0;const missing=Object.assign(Error('PRIVATE_LEGACY'),{status,payload:{details:'PRIVATE_BODY'}});
   const required=createSnapshotStore({diagnostics:true,request:async(path,o)=>{jsonCalls++;assert.equal(o.timeoutMs,3000);assert.equal(o.method,path.endsWith('source_health')?'POST':'GET');assert.equal(typeof o.onTiming,'function');if(path.endsWith('source_health'))return source;assert(path.endsWith('nothingsports_current_global_fixture_bundle?select=bundle'),'No legacy table request');o.onTiming({phase:'error',elapsedMs:1,status,bytes:null,token:'PRIVATE_TOKEN'});throw missing;}});
   await assert.rejects(required.read(),e=>e===missing);assert.equal(jsonCalls,2,'Missing required JSON RPC cannot fall back to legacy');assert.equal(warnings.length,1);assert.equal(warnings[0].phase,'fixture-bundle');assert.equal(warnings[0].status,status);assert.equal(warnings[0].timings.legs['fixture-bundle'].outcome,'error');assert.equal(warnings[0].timings.legs['legacy-read'],undefined);assert(!JSON.stringify(warnings).includes('PRIVATE_'));
  }
  console.log('Global timing: separate parallel legs, required JSON RPC fail-closed, safe aggregates, validation/projection, fast quiet, opt-in-only, unchanged scopes and logger isolation passed.');
 }finally{console.warn=old;}
}

async function validateDefaultGlobalEnablement(){
 const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'];
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 const oldFetch=globalThis.fetch,oldWarn=console.warn,entries=[];let calls=0;
 try{
  Object.assign(process.env,{SUPABASE_URL:'https://default-diagnostic.invalid',SUPABASE_PUBLISHABLE_KEY:'PRIVATE_DEFAULT_KEY',SUPABASE_SECRET_KEY:'PRIVATE_DEFAULT_KEY',SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_DEFAULT_KEY'});
  globalThis.fetch=async url=>{
   calls++;
   const healthy=String(url).endsWith('nothingsports_read_fixture_source_health');
   return {ok:healthy,status:healthy?200:504,text:async()=>JSON.stringify(healthy?health:{code:'supabase_timeout',message:'PRIVATE_DEFAULT_FAILURE'})};
  };
  console.warn=(_label,value)=>entries.push(JSON.parse(value));
  const cases=[{}, {ids:['diagnostic:default-selected']}, {scope:'match-centre',interactive:true}, {scope:'participants',sportKeys:['tennis'],knownSportKeys:['tennis'],participantIds:['athlete:default-controlled'],interactive:true}];
  for(const [index,options]of cases.entries()){
   entries.length=0;const before=calls;
   // A previous last-good cache may turn the same failure into a stale return.
   // Either outcome must retain the same measured source failure.
   await readLiveSnapshots({...options,maxAgeMs:0,now:Date.now()}).catch(()=>null);
   assert.equal(calls-before,2,'Default diagnostics adds no HTTP request');
   assert.equal(entries.length,1);assert.equal(entries[0].phase,'fixture-bundle');
   assert.equal(Boolean(entries[0].timings),index===0,'Trusted default opts in only to global null-ID reads');
   if(index===0){assert(entries[0].timings.legs['fixture-bundle'].transport.some(e=>e.phase==='headers'));assert(entries[0].timings.legs['fixture-bundle'].transport.some(e=>e.outcome==='http-error'));}
   assert(!JSON.stringify(entries).includes('PRIVATE_'),'Default global diagnostic remains content-free');
  }
  console.log('Default global timing enabled: exact existing pair, private/selected/interactive scopes unchanged, safe failure metadata.');
 }finally{
  globalThis.fetch=oldFetch;console.warn=oldWarn;
  for(const name of names)previous[name]===undefined?delete process.env[name]:process.env[name]=previous[name];
 }
}

async function validateLoggerRejections(){
 const {SupabaseRequestError}=require('../lib/supabase-server');
 const failure=new SupabaseRequestError('PRIVATE_LOG_FAILURE',{status:504,payload:{code:'supabase_timeout',message:'PRIVATE_PAYLOAD'}});
 const warnings=[],unhandled=[],old=console.warn;let time=0,calls=0,fail=false;
 const onUnhandled=reason=>unhandled.push(reason);
 process.on('unhandledRejection',onUnhandled);
 console.warn=(label,json)=>{warnings.push([label,JSON.parse(json)]);return Promise.reject(Error('PRIVATE_LOGGER_REJECTION'));};
 const store=createSnapshotStore({diagnostics:true,timer:()=>time,request:async path=>{
  calls++;time+=1100;
  if(path.endsWith('source_health'))return [{source_id:'PRIVATE_SOURCE',revision:1}];
  if(fail)throw failure;
  return [{bundle:{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[{source_id:'PRIVATE_SOURCE',fixture:{...fixture,id:'PRIVATE_FIXTURE'}}]}}];
 }});
 try{
  const result=await store.read();assert.equal(result[0].fixtures[0].id,'PRIVATE_FIXTURE','Rejected slow logger cannot replace successful facts');
  fail=true;await assert.rejects(store.read(),error=>error===failure,'Rejected failure logger cannot replace the original typed error');
  await new Promise(setImmediate);await new Promise(setImmediate);
  assert.equal(warnings.length,2);assert.equal(warnings[0][1].event,'fixture_snapshot_read_slow');assert.equal(warnings[1][1].event,'fixture_snapshot_read_failed');
  assert.equal(calls,4,'Logger rejection adds no fetch or retry');assert(!JSON.stringify(warnings).includes('PRIVATE_'),'Safe warnings contain no private fixture/source/error/logger text');
  assert.equal(unhandled.length,0,'Rejected reader loggers must not produce unhandled rejection');
 }finally{console.warn=old;process.removeListener('unhandledRejection',onUnhandled);}
 console.log('Reader logger rejections: actual slow success and typed global failure unchanged, no unhandled rejection/private text, original4mocked calls passed.');
}
