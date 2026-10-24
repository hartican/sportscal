'use strict';
// Release-only observation through the existing app reader; no new transport.
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const BUNDLE='/rest/v1/rpc/nothingsports_read_match_centre_fixture_bundle';
const HEALTH='/rest/v1/rpc/nothingsports_read_fixture_source_health';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function observation(value){
 assert(['fetch-start','headers','text-start','text-ready','parse-start','parse-ready','complete','timeout','caller-abort','error'].includes(value.phase),'Unknown transport phase');
 const result={phase:value.phase,elapsedMs:value.elapsedMs,status:value.status,bytes:value.bytes};
 for(const [name,allowed]of [['format',['json','empty','text']],['outcome',['success','http-error','timeout','caller-abort','body-error','transport-error']]])if(allowed.includes(value[name]))result[name]=value[name];
 return result;
}
function validateTransport(receipt,maxBytes){
 const phases=receipt.timings.map(x=>x.phase);
 for(const name of ['fetch-start','headers','text-start','text-ready','parse-start','parse-ready','complete'])assert(phases.includes(name),'Missing whole-body timing phase');
 assert(!phases.some(x=>['timeout','caller-abort','error'].includes(x)),'Failed transport');
 const text=receipt.timings.find(x=>x.phase==='text-ready'),parsed=receipt.timings.find(x=>x.phase==='parse-ready'),done=receipt.timings.find(x=>x.phase==='complete');
 assert(Number.isSafeInteger(text.bytes)&&text.bytes>0&&text.bytes<=maxBytes,'Missing or oversized complete body');
 assert.equal(parsed.format,'json');assert.equal(done.outcome,'success');assert.equal(done.status,200);
 return text.bytes;
}
function validateBundle(value){
 assert.equal(value?.schemaVersion,'current-fixture-bundle.v1');assert.equal(value.scope,'match-centre');assert.equal(value.complete,true);
 assert(Array.isArray(value.rows)&&value.rows.length<=5000,'Incomplete bundle');
 for(const row of value.rows)assert(typeof row?.source_id==='string'&&row.source_id&&row.fixture&&typeof row.fixture==='object'&&!Array.isArray(row.fixture),'Malformed fixture row');
 return {rows:value.rows.length,parsedValueSha256:sha(JSON.stringify(value))};
}
async function measure({storeFactory,request,environment,membershipIds,maxBytes=4194304,signal,onReceipt=()=>{},timer=()=>performance.now()}){
 const calls=[];let bundle,health;onReceipt({calls});
 const observed=async(url,options)=>{
  assert(!signal?.aborted,'Outer allocation cancelled');
  assert([BUNDLE,HEALTH].includes(url),'Unexpected request; no fallback or additional service call allowed');
  assert.equal(options.method,'POST');assert(calls.length<2,'Exactly one ordinary concurrent health/bundle read');
  if(url===BUNDLE)assert.deepEqual(options.body,{p_membership_ids:membershipIds});else assert.deepEqual(options.body,{});
  const receipt={kind:url===BUNDLE?'bundle':'health',timings:[]};calls.push(receipt);
  const value=await request(url,{...options,environment,signal:AbortSignal.any([signal,options.signal].filter(Boolean)),onTiming:event=>{assert(receipt.timings.length<32);receipt.timings.push(observation(event));}});
  receipt.bytes=validateTransport(receipt,maxBytes);
  if(url===BUNDLE){receipt.bundle=validateBundle(value);bundle=value;}else health=value;
  return value;
 };
 const store=storeFactory({request:observed}),began=timer();
 try{
  const value=await store.read({scope:'match-centre',preserveIds:membershipIds,interactive:true});
  assert(Array.isArray(health)&&Array.isArray(value),'Complete health and consumer arrays required');
  const healthIds=health.map(row=>row.source_id);assert(healthIds.every(id=>typeof id==='string'&&id)&&new Set(healthIds).size===healthIds.length,'Invalid health sources');
  assert.deepEqual(value.map(row=>row.source_id).sort(),healthIds.slice().sort(),'Consumer must project every health source');
  const expected=new Map();for(const row of bundle.rows){assert(healthIds.includes(row.source_id),'Health omitted a bundle source');if(!expected.has(row.source_id))expected.set(row.source_id,[]);expected.get(row.source_id).push(row.fixture);}
  const identities=rows=>rows.map(f=>JSON.stringify([f.id??null,f.eventId??null,f.canonicalEventId??null,f.sourceEventIds??null])).sort();
  for(const row of value){assert(Array.isArray(row.fixtures),'Missing consumer fixtures');assert.deepEqual(identities(row.fixtures),identities(expected.get(row.source_id)||[]),'Consumer lost or added fixture identities');}
  const consumerParsedValueSha256=sha(JSON.stringify(value));
  const elapsedMs=timer()-began;
  assert(Number.isFinite(elapsedMs)&&elapsedMs>=0&&elapsedMs<=4000,'Complete read lacks the required one-second headroom');
  assert.equal(calls.length,2);assert.deepEqual(calls.map(x=>x.kind).sort(),['bundle','health']);
  return {elapsedMs,headroomMs:5000-elapsedMs,calls,consumerSources:value.length,consumerParsedValueSha256,limitations:'Full HTTP text byte length and parsed-value hashes; no literal raw-wire hash, client dual-body equality, same-backend or cold-server claim.'};
 }catch(error){error.qualificationReceipt={elapsedMs:timer()-began,calls};throw error;}
}
async function readPair({read,expires,record=()=>{},now=Date.now}){
 const results=[];
 for(const label of ['first own app-adapter read at release preflight; prior SQL touched buffers','next ordinary read; backend reuse unknown']){
  assert(expires-now()>=6000,'Insufficient remaining admission for unchanged five-second read and cleanup reserve');
  const result=await read();record({label,...result});
  assert(now()<expires,'Read completed after allocation expiry');results.push(result);
 }
 assert(now()<expires,'Allocation expired before success');return results;
}

function validatePublication(environment,head){
 assert.equal(environment.GITHUB_ACTIONS,'true');
 assert.equal(environment.GITHUB_EVENT_NAME,'workflow_dispatch');
 assert.equal(environment.GITHUB_REF,'refs/heads/main');
 assert.equal(environment.GITHUB_REPOSITORY,'hartican/sportscal');
 assert.equal(environment.GITHUB_WORKFLOW,'Sportscal production');
 assert.equal(environment.GITHUB_JOB,'deploy');
 assert(/^[0-9]+$/.test(environment.GITHUB_RUN_ID||''));
 assert(/^[a-f0-9]{40}$/.test(head||''));
 assert.equal(environment.NS_NEAR_APP_RELEASE_SHA,head);
 assert.equal(environment.GITHUB_SHA,head);
 return head;
}
async function qualify({read,record=()=>{},now=Date.now,limitMs=60000,schedule=setTimeout,cancel=clearTimeout}){
 assert(Number.isSafeInteger(limitMs)&&limitMs>0&&limitMs<=60000);
 const controller=new AbortController(),expires=now()+limitMs;let timer;
 const deadline=new Promise((_,reject)=>{timer=schedule(()=>{controller.abort();reject(Object.assign(Error('qualification deadline'),{gateCode:'allocation_expired'}));},limitMs);});
 try{
  const results=await Promise.race([readPair({expires,now,read:()=>read(controller.signal),record}),deadline]);
  assert(now()<expires,'Allocation expired before success');return results;
 }finally{cancel(timer);controller.abort();}
}
function failureCode(error){
 if(error?.gateCode==='allocation_expired')return 'allocation_expired';
 const code=error?.payload?.code;
 if(['supabase_timeout','supabase_maintenance','supabase_not_configured','supabase_service_role_not_configured'].includes(code))return code;
 return error?.name==='AssertionError'?'qualification_rejected':'adapter_failure';
}
module.exports={measure,validateBundle,validateTransport,readPair,validatePublication,qualify,failureCode};
