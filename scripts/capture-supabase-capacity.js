#!/usr/bin/env node
'use strict';
// One explicitly invoked anonymous read window. No credentials or deployment.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ORIGIN='https://nothingsport.app',ROUNDS=4,GAP_MS=40000,MAX_MS=600000,MAX_BODY=4*1024*1024;
const STATIC=['/app-version.json','/','/service-worker.js','/assets/js/app-shell-runtime.js','/data/feed-meta.json'];
const PARTICIPANTS=['team:football:sydney-fc','competitor:tennis:atp:alex-de-minaur'];
const FIXTURE='event:football:a-league-men:401892151';
const PREFERENCES={preferences:{onboardingComplete:true,selectedSelectorEntityIds:['sport:football','sport:tennis']},eventUserState:{}};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const timings=header=>Object.fromEntries(String(header||'').split(',').flatMap(x=>{
 const m=/^\s*([a-z]{1,20});dur=(\d+(?:\.\d+)?)\s*$/.exec(x);return m&&Number.isFinite(+m[2])?[[m[1],+m[2]]]:[];
}));
function environmentProjection(e,stage,now){
 assert.equal(e.schemaVersion,'supabase-capacity-environment.v1');assert.equal(e.stage,stage);
 assert(Number.isFinite(Date.parse(e.observedAt))&&Math.abs(now-Date.parse(e.observedAt))<=600000,'Fresh environment receipt required');
 assert.equal(e.project,'mkghopnkhcxtmfrcjdbc');assert.equal(e.deployment.state,'READY');
 assert(/^dpl_[A-Za-z0-9]+$/.test(e.deployment.id));assert(/^[a-f0-9]{40}$/.test(e.deployment.sha));
 assert(/^\d{1,5}$/.test(e.deployment.version));assert(['free','pro'].includes(e.plan));
 assert(/^[a-f0-9]{32}$/.test(e.database.codeFingerprint));assert(/^[a-f0-9]{32}$/.test(e.database.factFingerprint));
 return {schemaVersion:e.schemaVersion,stage,project:e.project,observedAt:e.observedAt,plan:e.plan,
  compute:['nano','micro','small'].includes(e.compute)?e.compute:null,
  deployment:{id:e.deployment.id,sha:e.deployment.sha,version:e.deployment.version,state:'READY'},
  database:{codeFingerprint:e.database.codeFingerprint,factFingerprint:e.database.factFingerprint},
  cpuSaturationObserved:typeof e.cpuSaturationObserved==='boolean'?e.cpuSaturationObserved:null};
}
async function request(url,options,{fetchImpl=fetch,now=Date.now,timer=()=>performance.now(),signal}={}){
 const start=timer(),at=now(),entry={at:new Date(at).toISOString(),status:null,elapsedMs:null,bodyBytes:0,originMs:{}};
 let response;
 try{
  response=await fetchImpl(url,{...options,redirect:'error',cache:'no-store',headers:{'Cache-Control':'no-cache',...(options.headers||{})},signal:AbortSignal.any([AbortSignal.timeout(15000),...(signal?[signal]:[])])});
  entry.headersMs=timer()-start;entry.status=response.status;entry.originMs=timings(response.headers.get('server-timing'));
  entry.feedCache=['HIT','MISS'].includes(response.headers.get('x-feed-cache'))?response.headers.get('x-feed-cache'):null;
  entry.edgeCache=['HIT','MISS','STALE','BYPASS'].includes(response.headers.get('x-vercel-cache'))?response.headers.get('x-vercel-cache'):null;
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error('body_limit');}chunks.push(next.value);}}
  finally{reader.releaseLock();}
  const bytes=Buffer.concat(chunks);entry.bodyBytes=bytes.length;entry.bodySha256=hash(bytes);entry.elapsedMs=timer()-start;
  const text=bytes.toString('utf8');let body;try{body=JSON.parse(text);}catch{}
  return {entry,body,text,at,finishedAt:now()};
 }catch(error){entry.elapsedMs=timer()-start;entry.failure=['body_limit'].includes(error.message)?error.message:signal?.aborted?'window_expired':'transport_or_body_failure';return {entry,at,finishedAt:now()};}
}
function qualify(kind,result){
 const {entry,body,at,finishedAt}=result,checks=[];
 const check=(ok,code)=>{if(!ok)checks.push(code);};
 check(entry.status===200,'http_status');check(!entry.failure,'complete_body');check(body&&typeof body==='object','json_body');
 if(body&&entry.status===200){
  if(kind==='membership'){
   check(body.enabled===true,'enabled');check(body.membershipStale===false,'fresh_membership');
   check(Array.isArray(body.fixtures)&&Array.isArray(body.events),'membership_shape');
   const ids=(body.fixtures||[]).map(f=>f.id);check(ids.length<=60&&new Set(ids).size===ids.length,'membership_identity');
   check(Number.isFinite(entry.originMs.snapshot)&&entry.originMs.snapshot<=4000,'snapshot_headroom');check(Number.isFinite(entry.originMs.merge),'merge_timing');
   entry.identitySha256=hash(JSON.stringify(ids));entry.rows=ids.length;
  }else if(kind==='selected'){
   const fixture=body.fixtures?.find(f=>f.id===FIXTURE);check(body.enabled===true&&fixture,'selected_fixture_present');
   check(Number.isFinite(entry.originMs.scores)&&entry.originMs.scores<2500,'selected_headroom');
   if(fixture){check(fixture.homeParticipantId==='team:football:sydney-fc'&&fixture.awayParticipantId==='team:football:adelaide-united','selected_identity');entry.sourceObservationStale=typeof fixture.stale==='boolean'?fixture.stale:null;entry.identitySha256=hash(JSON.stringify([fixture.id,fixture.homeParticipantId,fixture.awayParticipantId]));}
  }else if(kind.startsWith('participant')){
   check(body.fixtureSnapshotStale===false,'fresh_participant_snapshot');check(Array.isArray(body.events)&&typeof body.sourceVersion==='string','participant_shape');
   check(Number.isFinite(entry.originMs.live)&&entry.originMs.live<=4000,'participant_headroom');check(entry.feedCache==='MISS','fresh_response_cache');
   const time=Date.parse(body.generatedAt);check(Number.isFinite(time)&&time>=at-5000&&time<=finishedAt+5000,'generation_time');
   entry.rows=body.events?.length;entry.revisionSha256=hash(JSON.stringify(body.sourceVersion??null));
   entry.identitySha256=hash(JSON.stringify((body.events||[]).map(e=>e.id??e.eventId??null)));
  }else if(kind==='global'){
   check(body.stale===false,'fresh_global_snapshot');check(body.schemaVersion==='athlete-participation-live.v1'&&Array.isArray(body.history),'global_shape');
   check(typeof body.revision==='string'&&body.revision.length>0&&body.maxAgeSeconds===30,'global_revision');
   const time=Date.parse(body.generatedAt);check(Number.isFinite(time)&&time>=at-5000&&time<=finishedAt+5000,'generation_time');
   entry.rows=body.history?.length;entry.revisionSha256=hash(JSON.stringify(body.revision??null));
   const failure=require('../lib/snapshot-failure-receipt').failure(body.snapshotReadFailure);if(failure)entry.snapshotReadFailure=failure;
  }
 }
 entry.failedChecks=checks;entry.passed=checks.length===0;return entry;
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
async function capture({stage,directory,environment,fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,timer=()=>performance.now()}){
 assert(['before','after'].includes(stage));assert(path.isAbsolute(directory));
 const env=environmentProjection(environment,stage,now());
 fs.mkdirSync(directory,{recursive:true,mode:0o700});const dir=fs.lstatSync(directory);assert(dir.isDirectory()&&!dir.isSymbolicLink()&&dir.uid===process.getuid()&&(dir.mode&0o022)===0,'Owned non-writable report directory required');const file=path.join(directory,'capacity-'+stage+'.json');
 const fd=fs.openSync(file,'wx',0o600),report={schemaVersion:'supabase-capacity-capture.v1',stage,environment:env,origin:ORIGIN,
  instrumentSha256:hash(Buffer.concat([fs.readFileSync(__filename),fs.readFileSync(require.resolve('../lib/snapshot-failure-receipt'))])),selectedFixture:FIXTURE,participantIds:PARTICIPANTS,requestBodySha256:hash(JSON.stringify(PREFERENCES)),
  roundCount:ROUNDS,gapMs:GAP_MS,startedAt:new Date(now()).toISOString(),requests:0,metadata:{},rounds:[],releaseAcceptance:false};
 const save=()=>{const b=JSON.stringify(report,null,2)+'\n';assert(Buffer.byteLength(b)<131072);fs.ftruncateSync(fd,0);fs.writeSync(fd,b,0,'utf8');};
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),MAX_MS),nonce=crypto.randomUUID();
 const read=async(route,options={})=>{assert(!controller.signal.aborted&&++report.requests<=30);return request(ORIGIN+route+(route.includes('?')?'&':'?')+'capacityCheck='+nonce,{method:'GET',...options},{fetchImpl,now,timer,signal:controller.signal});};
 const metadata=async()=>{
  const values={};for(const route of STATIC){const r=await read(route);assert.equal(r.entry.status,200,'Static identity read failed');assert(!r.entry.failure,'Static body incomplete');values[route]=r.entry.bodySha256;if(route==='/app-version.json')assert.equal(String(r.body?.version),env.deployment.version,'Served version changed');}return values;
 };
 try{
  save();report.metadata.before=await metadata();save();
  for(let round=0;round<ROUNDS;round++){
   if(round)await sleep(GAP_MS);assert(!controller.signal.aborted);
   const record={round:round+1,at:new Date(now()).toISOString(),reads:[]};report.rounds.push(record);
   const routes=[['membership','/api/match-centre?membership=everything&limit=60'],['selected','/api/match-centre?ids='+encodeURIComponent(FIXTURE)],
    ...PARTICIPANTS.map((id,i)=>['participant'+i,'/api/feed?scope=athletes&participantId='+encodeURIComponent(id)+'&limit=50&cursor=0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(PREFERENCES)}]),
    ['global','/api/fixtures?athlete='+encodeURIComponent(PARTICIPANTS[1])]];
   for(const[kind,route,options]of routes){const result=await read(route,options);record.reads.push({kind,...qualify(kind,result)});save();assert.notEqual(result.entry.status,429,'Rate limit stops diagnostic window without retry');}
  }
  report.metadata.after=await metadata();report.staticInputsUnchanged=same(report.metadata.before,report.metadata.after);
  report.allChecksPassed=report.staticInputsUnchanged&&report.rounds.length===ROUNDS&&report.rounds.every(r=>r.reads.length===5&&r.reads.every(x=>x.passed));
  report.state=report.allChecksPassed?'COMPLETE_PASS_DIAGNOSTIC_ONLY':'COMPLETE_WITH_FAILED_LOADING_CHECKS';
 }catch{report.state='INCOMPLETE_STOPPED_NO_RETRY';}
 finally{clearTimeout(timeout);controller.abort();report.finishedAt=new Date(now()).toISOString();save();fs.closeSync(fd);}
 return report;
}
function compare(before,after){
 assert(before.schemaVersion==='supabase-capacity-capture.v1'&&after.schemaVersion===before.schemaVersion);assert(before.stage==='before'&&after.stage==='after');
 const reasons=[];const requireSame=(a,b,label)=>{if(!same(a,b))reasons.push(label);};
 requireSame(before.instrumentSha256,after.instrumentSha256,'instrument_changed');requireSame(before.environment.deployment,after.environment.deployment,'deployment_changed');
 requireSame(before.metadata.before,after.metadata.before,'served_bytes_changed');requireSame(before.requestBodySha256,after.requestBodySha256,'request_changed');
 requireSame(before.selectedFixture,after.selectedFixture,'fixture_changed');requireSame(before.participantIds,after.participantIds,'participants_changed');
 requireSame(before.environment.database.codeFingerprint,after.environment.database.codeFingerprint,'database_code_changed');
 requireSame(before.environment.database.factFingerprint,after.environment.database.factFingerprint,'sporting_facts_changed');
 for(const kind of ['membership','selected','participant0','participant1','global']){
  const fingerprints=report=>report.rounds.flatMap(r=>r.reads).filter(x=>x.kind===kind).map(x=>[x.identitySha256??null,x.revisionSha256??null,x.rows??null]);
  requireSame(fingerprints(before),fingerprints(after),'observed_'+kind+'_changed');
 }
 if(!before.staticInputsUnchanged||!after.staticInputsUnchanged)reasons.push('static_inputs_changed_within_window');
 if(before.rounds.length!==ROUNDS||after.rounds.length!==ROUNDS||before.state==='INCOMPLETE_STOPPED_NO_RETRY'||after.state==='INCOMPLETE_STOPPED_NO_RETRY')reasons.push('incomplete_window');
 const summary=report=>Object.fromEntries(['membership','selected','participant0','participant1','global'].map(kind=>{
  const samples=report.rounds.flatMap(r=>r.reads).filter(x=>x.kind===kind),times=samples.map(x=>x.elapsedMs).filter(Number.isFinite).sort((a,b)=>a-b);
  return [kind,{attempts:samples.length,passed:samples.filter(x=>x.passed).length,failed:samples.filter(x=>!x.passed).length,medianMs:times.length?(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2:null,worstMs:times.at(-1)??null}];
 }));
 if(before.environment.plan!=='free'||after.environment.plan!=='pro'||after.environment.compute!=='micro')reasons.push('expected_capacity_change_unconfirmed');
 return {schemaVersion:'supabase-capacity-comparison.v1',comparable:reasons.length===0,confounders:reasons,before:summary(before),after:summary(after),
  capacityChangeConfirmed:before.environment.plan==='free'&&after.environment.plan==='pro'&&after.environment.compute==='micro',
  repeatedLoadingChecksPassed:after.allChecksPassed===true&&after.rounds.length===ROUNDS&&after.rounds.every(r=>r.reads.length===5&&r.reads.every(x=>x.passed===true)),releaseAcceptance:false,
  limits:'Four rounds are a bounded signal, not long-term reliability or a causal experiment. Failures remain in totals. Header/body timing is not isolated SQL time; no CPU saturation or physical-phone proof.'};
}
async function main(argv=process.argv.slice(2)){
 if(!argv.length){console.log('INERT: explicit before/after capture or saved-file comparison required.');return;}
 if(argv[0]==='--capture'&&argv.length===4){const report=await capture({stage:argv[1],directory:argv[2],environment:JSON.parse(fs.readFileSync(argv[3]))});console.log(JSON.stringify({state:report.state,requests:report.requests,releaseAcceptance:false}));if(!report.allChecksPassed)process.exitCode=1;return;}
 if(argv[0]==='--compare'&&argv.length===3){console.log(JSON.stringify(compare(...argv.slice(1).map(p=>JSON.parse(fs.readFileSync(p)))),null,2));return;}
 throw Error('Expected --capture before|after /absolute/output /absolute/environment.json or --compare before.json after.json');
}
if(require.main===module)main().catch(()=>{console.error('Capacity check refused; no retry or purchase.');process.exitCode=1;});
module.exports={main,capture,compare,qualify,request,environmentProjection,timings,FIXTURE,PARTICIPANTS,STATIC};
