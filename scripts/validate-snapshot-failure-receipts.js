'use strict';
const assert=require('node:assert/strict');
const {createSnapshotStore,readLiveSnapshots,snapshotReadFailure}=require('../lib/live-fixtures');
const {createLiveFixtureHandler}=require('../lib/live-fixture-handler');
const receipts=require('../lib/snapshot-failure-receipt');
const verifier=require('./verify-global-fixture-public');
const sha='a'.repeat(40),secret='PRIVATE_SQL_ACCOUNT_TOKEN';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.body=value;return this;},end(){}});
async function main(){
 let clock=0,calls=0;
 const store=createSnapshotStore({diagnostics:true,timer:()=>clock,request:async(path,options)=>{
  calls++;assert.equal(options.timeoutMs,3000,'Existing global deadline is unchanged');
  options.onTiming?.({phase:'fetch-start',elapsedMs:0,password:secret});
  if(path.endsWith('nothingsports_read_fixture_source_health'))return [];
  assert(path.endsWith('nothingsports_read_current_fixture_bundle_json_rows'));
  options.onTiming?.({phase:'headers',elapsedMs:10,status:200});
  options.onTiming?.({phase:'text-start',elapsedMs:11,status:200});clock=3000;
  options.onTiming?.({phase:'timeout',elapsedMs:3000,status:200});
  throw Object.assign(Error(secret),{status:504,payload:{code:'supabase_timeout',message:secret}});
 }});
 const handler=createLiveFixtureHandler({environment:{},publishedFixtures:()=>[],read:()=>readLiveSnapshots({store})});
 const result=response();await handler({method:'GET',url:'/api/fixtures?athlete='+verifier.PARTICIPANT,headers:{}},result);
 assert.equal(calls,2,'The two original parallel resources are the entire read budget');
 assert.equal(result.code,200);assert.equal(result.body.stale,true);assert.equal(result.body.maxAgeSeconds,300);
 const failure=result.body.snapshotReadFailure,detail=failure?.diagnostic;
 assert.equal(failure.code,'supabase_timeout');assert.equal(failure.status,504);
 assert.equal(detail?.schemaVersion,receipts.SCHEMA);assert.equal(detail.phase,'fixture-bundle');assert.equal(detail.deadlineMs,3000);
 assert.deepEqual(detail.timings.legs['fixture-bundle'].transport.map(x=>x.phase),['fetch-start','headers','text-start','timeout']);
 assert(!JSON.stringify(result.body).includes(secret),'The real handler cannot publish dependency messages or callback extras');
 const captured=[];let reads=0;
 await assert.rejects(verifier.main({sha,log:line=>captured.push(JSON.parse(line)),fetchImpl:async()=>{reads++;return {status:200,headers:{get:()=>null},text:async()=>JSON.stringify(result.body)};}}),/Global fixture snapshot is degraded/);
 assert.equal(reads,1);assert.equal(captured.length,1);assert.equal(captured[0].snapshotReadFailure.diagnostic.readId,detail.readId);
 assert.equal(captured[0].stage,'freshness');assert(!JSON.stringify(captured).includes(secret),'Verifier retains the bounded same-read failure, never the response body');
 const before=JSON.stringify(detail);
 const dirty={...failure,message:secret,sql:secret,diagnostic:{...detail,query:secret,timings:{...detail.timings,legs:{...detail.timings.legs,password:secret}}}};
 assert.equal(JSON.stringify(receipts.failure(dirty)),JSON.stringify(failure));assert.equal(JSON.stringify(detail),before);
 for(const patch of [{readId:secret},{startedAt:'2026-02-30T00:00:00.000Z'},{phase:secret},{deadlineMs:15000},{elapsedMs:Infinity},{scope:'participants'},{timings:{...detail.timings,validationMs:undefined}}]){
  assert.equal(receipts.diagnostic({...detail,...patch}),null,'Invalid metadata is omitted without weakening the failure');
 }
 assert(!snapshotReadFailure({status:504,payload:{code:'supabase_timeout'},diagnostic:detail}).diagnostic,'An external error cannot forge the private owned diagnostic');
 assert.deepEqual(receipts.failure({code:secret,status:secret,diagnostic:{message:secret}}),{code:'current_input_unavailable',status:null});
 const tooMany={...detail,timings:{...detail.timings,legs:{'fixture-bundle':{...detail.timings.legs['fixture-bundle'],transport:Array(13).fill(detail.timings.legs['fixture-bundle'].transport[0])}}}};
 assert.equal(receipts.diagnostic(tooMany),null,'Transport history is bounded');
 assert(Buffer.byteLength(JSON.stringify(detail))<=8192);
 // The first failing parallel leg is explicit; incomplete other-leg timing is
 // retained as incomplete rather than waiting or inventing a successful end.
 const healthStore=createSnapshotStore({diagnostics:true,request:async(path,options)=>{
  assert.equal(options.timeoutMs,3000);
  if(path.endsWith('nothingsports_read_fixture_source_health'))throw Object.assign(Error(secret),{status:404,payload:{code:'PGRST202'}});
  return [{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[]}];
 }});
 let healthError;try{await healthStore.read();}catch(error){healthError=error;}
 assert(healthError);assert.equal(snapshotReadFailure(healthError).diagnostic.phase,'source-health');
 for(const phase of ['validation','projection']){
  const brokenStore=createSnapshotStore({diagnostics:true,request:async path=>path.endsWith('nothingsports_read_fixture_source_health')?(phase==='projection'?{}:[]):phase==='validation'?[{complete:false}]:[{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[]}]});
  let broken;try{await brokenStore.read();}catch(error){broken=error;}
  assert(broken);assert.equal(snapshotReadFailure(broken).diagnostic.phase,phase,'Post-read stages must not be mislabeled as transport');
 }
 const frozenError=Object.freeze(Object.assign(Error(secret),{status:504,payload:{code:'supabase_timeout'}}));
 const frozenStore=createSnapshotStore({diagnostics:true,request:async()=>{throw frozenError;}});
 await assert.rejects(frozenStore.read(),error=>error===frozenError,'Metadata attachment cannot replace the original error');
 // Exercise actual last-good persistence after all earlier failed uncached reads.
 const fact={id:'fixture:controlled:retained',key:'football',date:'2026-10-18',sourceCheckedAt:'2026-10-18T00:00:00Z'},facts=JSON.stringify(fact);
 const goodStore=createSnapshotStore({diagnostics:true,request:async path=>path.endsWith('nothingsports_read_fixture_source_health')?[{source_id:'controlled',revision:1,checked_at:fact.sourceCheckedAt}]:[{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[{source_id:'controlled',fixture:fact}]}]});
 const good=await readLiveSnapshots({store:goodStore,now:Date.now()-60000});assert.equal(good.stale,false);
 clock=0;const retained=await readLiveSnapshots({store,now:Date.now()});assert.equal(retained.stale,true);
 assert.deepEqual(retained.sources,good.sources);assert.equal(JSON.stringify(fact),facts);assert.equal(retained.readFailure.diagnostic.phase,'fixture-bundle');
 const selected=createLiveFixtureHandler({environment:{},publishedFixtures:()=>[],read:async()=>retained});
 const chosen=response();await selected({method:'GET',url:'/api/fixtures?ids=fixture:controlled:retained',headers:{}},chosen);
 assert.equal(chosen.body.stale,true);assert(!Object.hasOwn(chosen.body,'snapshotReadFailure'),'This additive global diagnostic does not alter selected readers');
 console.log('Snapshot failure receipts: actual two-leg store/last-good/handler/verifier, original deadlines, first-failing phase, safe bounded metadata, frozen errors, no retry and unchanged facts/selected scope passed.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
