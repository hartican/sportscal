'use strict';
// Explicit publisher qualification only; runtime policies/consumers stay unchanged.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const near=require('./near-app-adapter-qualification');
const ORIGIN='https://mkghopnkhcxtmfrcjdbc.supabase.co';
const HEALTH='/rest/v1/rpc/nothingsports_read_fixture_source_health';
const BUNDLE='/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle';
const READ_MS=6000,ALLOCATION_MS=30000,MAX_BYTES=16*1024*1024;
const ownedFailures=new WeakMap();
const application=()=>({fixtures:require('../../lib/live-fixtures'),groups:require('../../lib/fixture-source-groups')});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const phases=['fetch-start','headers','text-start','text-ready','parse-start','parse-ready','complete','timeout','caller-abort','error'];
function observe(event){
 const {phase,elapsedMs,status,bytes,format,outcome}=event||{};
 assert(phases.includes(phase),'Invalid transport observation');
 const result={phase,elapsedMs:finite(elapsedMs)?elapsedMs:null,status:Number.isInteger(status)&&status>=100&&status<=599?status:null,bytes:Number.isSafeInteger(bytes)&&bytes>=0?bytes:null};
 if(['json','empty','text'].includes(format))result.format=format;
 if(['success','http-error','timeout','caller-abort','body-error','transport-error'].includes(outcome))result.outcome=outcome;
 return result;
}
function transportBytes(call){
 const required=['fetch-start','headers','text-start','text-ready','parse-start','parse-ready','complete'];
 let previous=-1;
 for(const phase of required){const indexes=call.timings.flatMap((e,i)=>e.phase===phase?[i]:[]);assert.equal(indexes.length,1,'Incomplete transport phases');assert(indexes[0]>previous,'Transport phases out of order');previous=indexes[0];}
 assert(call.timings.every(e=>finite(e.elapsedMs)&&e.elapsedMs<READ_MS),'Invalid/late transport timing');
 return near.validateTransport(call,MAX_BYTES);
}
function identities(fixtures){return sha(JSON.stringify(fixtures.map(f=>[f.id??null,f.eventId??null,f.canonicalEventId??null,f.sourceEventIds??null])));}
function closure(manifest,snapshot,rows,contentHash){
 assert(Array.isArray(manifest)&&Array.isArray(snapshot.sources),'Missing manifest or projection');
 const ids=manifest.map(source=>source?.source_id);
 assert(ids.every(id=>typeof id==='string'&&id)&&new Set(ids).size===ids.length,'Invalid manifest source membership');
 assert.deepEqual(snapshot.sources.map(source=>source?.source_id),ids,'Projection lost or reordered manifest sources');
 const expected=new Map(ids.map(id=>[id,[]]));
 for(const row of rows){assert(expected.has(row.source_id),'Manifest omitted a wire source');expected.get(row.source_id).push(row.fixture);}
 let count=0;
 for(const source of snapshot.sources){
  const fixtures=expected.get(source.source_id);assert(Array.isArray(source.fixtures),'Missing source fixtures');
  assert.equal(source.fixtures.length,fixtures.length,'Source-edge count mismatch');
  assert.equal(identities(source.fixtures),identities(fixtures),'Source-edge identities/order mismatch');
  assert.equal(source.scoreRevision,contentHash(fixtures),'Source projection hash mismatch');count+=source.fixtures.length;
 }
 assert.equal(count,rows.length,'Projection omitted source edges');return{manifestSources:ids.length,projectedSources:snapshot.sources.length,projectedEdges:count};
}
async function measure({request,environment,signal,onReceipt=()=>{},timer=()=>performance.now(),now=Date.now,allocationCheck=()=>{}}){
 assert.equal(typeof request,'function','Existing service transport required');
 const {fixtures:{createSnapshotStore,readLiveSnapshots,contentHash},groups}=application();
 const calls=[],receipt={calls};let manifest,wire,rows,settled=false,invalidTiming=false;
 const began=timer(),check=()=>{allocationCheck();assert(!signal?.aborted,'Qualification cancelled');assert(finite(timer()-began)&&timer()-began<READ_MS,'Global app read exceeded6000ms');};
 const observed=async(route,options={})=>{
  check();assert([HEALTH,BUNDLE].includes(route)&&calls.length<2,'Unexpected/repeated service request');
  const kind=route===HEALTH?'health':'bundle';assert(!calls.some(call=>call.kind===kind),'Repeated service resource');
  assert.equal(options.method,kind==='health'?'POST':'GET');
  if(kind==='health'){assert.deepEqual(options.body,{});assert.equal(options.headers,undefined);}else{assert.equal(options.body,undefined);assert.deepEqual(options.headers,groups.HEADERS);}
  assert(finite(options.timeoutMs)&&options.timeoutMs>0&&options.timeoutMs<=READ_MS);assert(options.signal,'Actual SDK cancellation signal required');
  const call={kind,timings:[]};calls.push(call);
  const originalTiming=options.onTiming;
  const value=await request(route,{...options,environment,signal:AbortSignal.any([signal,options.signal].filter(Boolean)),onTiming:event=>{
   if(!settled&&!signal?.aborted){try{assert(call.timings.length<32);call.timings.push(observe(event));}catch{invalidTiming=true;}}
   originalTiming?.(event); // The actual grouped store requires its own byte receipts.
  }});
  check();assert(!invalidTiming,'Malformed/excess transport timing');call.bytes=transportBytes(call);
  if(kind==='health')manifest=value;
  else{
   assert(Array.isArray(value)&&value.length===1&&value[0]?.bundle?.schemaVersion===groups.SCHEMA,'Required grouped global wire absent');
   wire=value[0].bundle;rows=groups.decode(wire).rows;check();
   call.groups=wire.groupCount;call.edges=wire.edgeCount;call.parsedValueSha256=sha(JSON.stringify(value));check();
  }
  return value;
 };
 try{
  onReceipt(receipt);check();
  const store=createSnapshotStore({request:observed,transport:groups.CANDIDATE,timer});
  const snapshot=await readLiveSnapshots({store,scope:'global',ids:[],maxAgeMs:0,now:now(),timer});check();
  assert.equal(snapshot.stale,false,'Stale/last-good is not fresh qualification');
  assert(!snapshot.readFailure&&wire&&rows,'Missing complete owned wire');
  assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.kind).sort(),['bundle','health']);
  assert(calls.every(c=>Number.isSafeInteger(c.bytes))&&calls.reduce((n,c)=>n+c.bytes,0)<=MAX_BYTES,'Combined transport exceeds16MiB');
  const counts=closure(manifest,snapshot,rows,contentHash);check();
  const consumerParsedValueSha256=sha(JSON.stringify(snapshot.sources));check();
  assert(/^[0-9a-f]{64}$/.test(snapshot.revision),'Invalid actual snapshot revision');
  const evidence={calls,...counts,groups:wire.groupCount,edges:wire.edgeCount,consumerParsedValueSha256,snapshotRevision:snapshot.revision};
  const evidenceSha256=sha(JSON.stringify(evidence));check();
  const elapsedMs=timer()-began;assert(finite(elapsedMs)&&elapsedMs<READ_MS,'Late global app read');
  return{...evidence,evidenceSha256,elapsedMs,readLimitMs:READ_MS,limitations:'Actual complete text lengths and parsed-value hashes; no literal raw-wire hash, same backend, cold server, UI/phone or full release acceptance.'};
 }catch(error){
  receipt.elapsedMs=Math.max(0,timer()-began);
  if(error&&typeof error==='object')ownedFailures.set(error,receipt);
  throw error;
 }finally{settled=true;}
}
function expired(){return Object.assign(Error('Qualification allocation expired'),{gateCode:'allocation_expired'});}
async function qualify({prepare,record=()=>{},complete=()=>{},request,environment,timer=()=>performance.now(),now=Date.now,limitMs=ALLOCATION_MS,schedule=setTimeout,cancel=clearTimeout,onReceipt}){
 assert(Number.isSafeInteger(limitMs)&&limitMs>0&&limitMs<=ALLOCATION_MS);
 const began=timer(),controller=new AbortController();let handle,active=true;
 const check=()=>{if(!active||controller.signal.aborted||timer()-began>=limitMs)throw expired();};
 const deadline=new Promise((_,reject)=>{handle=schedule(()=>{controller.abort(expired());reject(expired());},limitMs);});
 const work=(async()=>{
  const config=prepare?await prepare(controller.signal):{request,environment};check();
  application();check(); // Cold module setup belongs to the whole allocation.
  const results=[];
  for(const label of ['first forced-fresh global app-adapter read; prior SQL touched buffers','second forced-fresh global app-adapter read; backend reuse unknown']){
   check();assert(limitMs-(timer()-began)>=READ_MS,'Insufficient remaining allocation for unchanged global read');
   const result=await measure({...config,signal:controller.signal,timer,now,onReceipt,allocationCheck:check});check();
   await record({label,...result});check();results.push(result);
  }
  await complete(results,{allocationLimitMs:limitMs,elapsedBeforeReceiptMs:timer()-began});check();return results;
 })();
 try{const results=await Promise.race([work,deadline]);check();return results;}
 finally{active=false;cancel(handle);controller.abort();}
}
module.exports={ORIGIN,READ_MS,ALLOCATION_MS,MAX_BYTES,measure,qualify,closure,observe,sha,validatePublication:near.validatePublication,failureCode:near.failureCode,receiptFor:error=>error&&typeof error==='object'?ownedFailures.get(error):undefined};
