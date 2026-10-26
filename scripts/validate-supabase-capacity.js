'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const check=require('./capture-supabase-capacity');
const tests=[],test=(name,run)=>tests.push({name,run});
const stamp=Date.parse('2026-10-27T00:00:00Z');
const environment=stage=>({schemaVersion:'supabase-capacity-environment.v1',stage,project:'mkghopnkhcxtmfrcjdbc',observedAt:new Date(stamp).toISOString(),plan:stage==='before'?'free':'pro',compute:stage==='before'?null:'micro',deployment:{id:'dpl_controlled',sha:'a'.repeat(40),version:'595',state:'READY'},database:{codeFingerprint:'a'.repeat(32),factFingerprint:'b'.repeat(32)}});
function wire(kind){
 const base={generatedAt:new Date(stamp).toISOString()};
 if(kind==='membership')return{...base,enabled:true,membershipStale:false,events:[],fixtures:[]};
 if(kind==='selected')return{...base,enabled:true,fixtures:[{id:check.FIXTURE,homeParticipantId:'team:football:sydney-fc',awayParticipantId:'team:football:adelaide-united',stale:true}]};
 if(kind==='global')return{...base,schemaVersion:'athlete-participation-live.v1',stale:false,history:[],revision:'controlled',maxAgeSeconds:30};
 return{...base,fixtureSnapshotStale:false,events:[],sourceVersion:'controlled'};
}
const result=(kind,change={})=>({entry:{status:200,originMs:{snapshot:10,merge:1,scores:5,live:10},feedCache:'MISS'},body:{...wire(kind),...change},at:stamp,finishedAt:stamp+20});
test('default inert mode makes no request',async()=>{const old=global.fetch;global.fetch=()=>{throw Error('network');};try{await check.main([]);}finally{global.fetch=old;}});
test('degraded membership cannot pass healthy timing',()=>{const r=check.qualify('membership',result('membership',{membershipStale:true}));assert(r.failedChecks.includes('fresh_membership'));assert(!r.passed);});
test('saved participant or global history is failed',()=>{assert(!check.qualify('participant0',result('participant0',{fixtureSnapshotStale:true})).passed);assert(!check.qualify('global',result('global',{stale:true})).passed);});
test('real selected identity and original fact staleness remain separate',()=>{const r=check.qualify('selected',result('selected'));assert(r.passed&&r.sourceObservationStale);const d=result('selected');d.body.fixtures[0].awayParticipantId='team:controlled:other';assert(!check.qualify('selected',d).passed);});
test('existing timing headroom is not raised',()=>{for(const[kind,key,value]of[['membership','snapshot',4001],['selected','scores',2500],['participant0','live',4001]]){const r=result(kind);r.entry.originMs[key]=value;assert(!check.qualify(kind,r).passed);}});
test('HTTP504 and incomplete body remain failures',()=>{const r=result('global');r.entry.status=504;r.entry.failure='transport_or_body_failure';assert(!check.qualify('global',r).passed);});
test('private input fields are not copied to environment receipt',()=>{const e=environment('before');e.secret='PRIVATE';e.cpuSaturationObserved=undefined;const safe=check.environmentProjection(e,'before',stamp);assert(!JSON.stringify(safe).includes('PRIVATE'));assert.equal(safe.cpuSaturationObserved,null);assert.equal(safe.compute,null);assert.throws(()=>check.environmentProjection(e,'after',stamp));assert.throws(()=>check.environmentProjection(e,'before',stamp+600001));});
test('actual streamed body error records one request without retry',async()=>{let calls=0;const r=await check.request('https://nothingsport.app/api/fixtures',{}, {now:()=>stamp,fetchImpl:async()=>{calls++;return{status:200,headers:new Headers(),body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));c.error(Error('PRIVATE'));}})};}});assert.equal(calls,1);assert.equal(r.entry.failure,'transport_or_body_failure');assert(!JSON.stringify(r.entry).includes('PRIVATE'));});
test('oversized streamed reply cancels at fixed bound',async()=>{let cancelled=false;const r=await check.request('https://nothingsport.app/api/fixtures',{}, {fetchImpl:async()=>({status:200,headers:new Headers(),body:new ReadableStream({start(c){c.enqueue(new Uint8Array(4*1024*1024+1));},cancel(){cancelled=true;}})})});assert.equal(r.entry.failure,'body_limit');assert(cancelled);});
let baseline;
test('complete offline window exercises all30 calls and four rounds',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-capacity-'));let calls=0;const gaps=[];
 const fetchImpl=async(url,options)=>{calls++;assert.equal(options.redirect,'error');assert(!options.headers.Authorization);assert.equal(new URL(url).origin,'https://nothingsport.app');
  const u=new URL(url);let body;if(u.pathname==='/app-version.json')body={version:'595'};else if(check.STATIC.includes(u.pathname))body={static:u.pathname};else{
   const kind=u.pathname==='/api/fixtures'?'global':u.pathname==='/api/feed'?'participant0':u.searchParams.has('ids')?'selected':'membership';body=wire(kind);
   assert.equal(options.method,kind.startsWith('participant')?'POST':'GET');if(options.method==='POST')assert.deepEqual(Object.keys(JSON.parse(options.body)),['preferences','eventUserState']);
  }
  return new Response(JSON.stringify(body),{status:200,headers:{'server-timing':'snapshot;dur=10,merge;dur=1,scores;dur=5,live;dur=10','x-feed-cache':'MISS'}});
 };
 try{baseline=await check.capture({stage:'before',directory,environment:environment('before'),fetchImpl,sleep:async ms=>gaps.push(ms),now:()=>stamp});assert.equal(calls,30);assert.equal(baseline.rounds.length,4);assert.deepEqual(gaps,[40000,40000,40000]);assert(baseline.allChecksPassed);assert.equal(baseline.releaseAcceptance,false);
  await assert.rejects(check.capture({stage:'before',directory,environment:environment('before'),fetchImpl,now:()=>stamp}));assert.equal(calls,30,'Receipt refusal precedes network');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('comparison retains failures and refuses changed app/data/instrument',()=>{
 const a=structuredClone(baseline),b=structuredClone(baseline);b.stage='after';b.environment=environment('after');assert(check.compare(a,b).comparable);
 b.rounds[0].reads[0].passed=false;b.rounds[0].reads[0].elapsedMs=3000;let c=check.compare(a,b);assert.equal(c.after.membership.failed,1);assert.equal(c.after.membership.attempts,4);
 for(const change of [x=>x.instrumentSha256='other',x=>x.environment.database.factFingerprint='c'.repeat(32),x=>x.environment.deployment.sha='d'.repeat(40),x=>x.environment.compute=null,x=>x.metadata.before['/']='other',x=>x.rounds[0].reads[0].identitySha256='other']){const changed=structuredClone(b);change(changed);assert(!check.compare(a,changed).comparable);}
});
(async()=>{for(const t of tests){await t.run();console.log('PASS '+t.name);}console.log(tests.length+' capacity-check controls passed; no external service.');})().catch(e=>{console.error(e);process.exitCode=1;});
