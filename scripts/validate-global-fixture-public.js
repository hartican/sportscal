#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {main,PARTICIPANT}=require('./verify-global-fixture-public');
const stamp=Date.parse('2026-10-18T00:00:00Z'),sha='a'.repeat(40);
const healthy={schemaVersion:'athlete-participation-live.v1',stale:false,revision:'current',generatedAt:new Date(stamp).toISOString(),maxAgeSeconds:30,history:[]};
async function probe({body=healthy,status=200,textFailure,fetchFailure,raw,clock=()=>stamp,timer=()=>100,headers}={}){
 let requests=0,reads=0,logs=0;const entries=[];
 const task=main({sha,clock,timer,log:value=>{logs++;entries.push(JSON.parse(value));assert(!value.includes(PARTICIPANT),'Receipts need no participant identity');},fetchImpl:async(value,options)=>{
  requests++;const url=new URL(value);assert.equal(url.pathname,'/api/fixtures');assert.equal(url.searchParams.get('athlete'),PARTICIPANT);
  assert(!url.searchParams.has('ids')&&!url.searchParams.has('mode')&&!url.searchParams.has('revision'),'Use global read without media/cache-validator paths');
  assert.match(url.searchParams.get('releaseSmoke'),new RegExp('^'+sha+'-'));assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');
  assert.deepEqual(options.headers,{'Cache-Control':'no-cache'});assert(options.signal instanceof AbortSignal);assert.equal(options.body,undefined);
  if(fetchFailure)throw Error('PRIVATE_TRANSPORT');
  return {status,headers,text:async()=>{reads++;if(textFailure)throw Error('PRIVATE_BODY');return raw===undefined?JSON.stringify(body):raw;}};
 }});
 return {task,entries,counts:()=>({requests,reads,logs})};
}
(async()=>{
 const okay=await probe();const receipt=await okay.task;assert.equal(receipt.healthyGlobalSnapshot,true);assert.equal(receipt.history,0);assert.deepEqual(okay.counts(),{requests:1,reads:1,logs:1});
 const degraded=await probe({body:{stale:true}});await assert.rejects(degraded.task,/Global fixture snapshot is degraded/);
 assert.deepEqual(degraded.entries,[{schemaVersion:'global-fixture-public-failure.v1',sha,path:'/api/fixtures',stage:'freshness',startedAt:new Date(stamp).toISOString(),finishedAt:new Date(stamp).toISOString(),elapsedMs:0,httpStatus:200,stale:true,platformRequestId:null}]);
 assert.deepEqual(degraded.counts(),{requests:1,reads:1,logs:1});
 // Failed calls preserve independently specified stage/status and one body read.
 for(const [options,stage,httpStatus,stale,reads] of [
  [{fetchFailure:true},'request',null,null,0],
  [{textFailure:true},'body',200,null,1],
  [{status:503,raw:'PRIVATE_HTTP_BODY'},'http-status',503,null,1],
  [{raw:'PRIVATE_INVALID_JSON'},'json-parse',200,null,1],
  [{body:{stale:true,history:['PRIVATE_FIXTURE']}},'freshness',200,true,1],
  [{body:{...healthy,schemaVersion:'PRIVATE_SCHEMA'}},'schema',200,false,1],
  [{body:{...healthy,generatedAt:'PRIVATE_DATE'}},'generation-time',200,false,1],
 ]){
  const t=await probe(options);await assert.rejects(t.task);const r=t.entries[0];
  assert.equal(r.stage,stage);assert.equal(r.httpStatus,httpStatus);assert.equal(r.stale,stale);
  assert.deepEqual(t.counts(),{requests:1,reads,logs:1});assert(!JSON.stringify(r).includes('PRIVATE_'));
 }
 const edgeId='syd1::bf9j8-1792414584372-ef91d1d44a1f';let ticks=0,dates=0;const headerReads=[];
 const timed=await probe({body:{stale:true},timer:()=>[100,4200,4201][ticks++],clock:()=>[stamp,stamp+4100,stamp+4101][dates++],headers:{get:name=>{headerReads.push(name);return edgeId;}}});
 await assert.rejects(timed.task,/degraded/);assert.deepEqual(headerReads,['x-vercel-id']);
 assert.equal(timed.entries[0].elapsedMs,4101);assert.equal(timed.entries[0].startedAt,'2026-10-18T00:00:00.000Z');assert.equal(timed.entries[0].finishedAt,'2026-10-18T00:00:04.101Z');assert.equal(timed.entries[0].platformRequestId,edgeId);
 for(const header of ['Bearer PRIVATE_TOKEN','PRIVATE_SECRET','syd1::PRIVATE_SECRET','x'.repeat(201),edgeId+'\nPRIVATE_SECRET']){
  const t=await probe({body:{stale:true},headers:{get:()=>header}});await assert.rejects(t.task);assert.equal(t.entries[0].platformRequestId,null);assert(!JSON.stringify(t.entries).includes('PRIVATE_'));
 }
 const badHeaders=await probe({body:{stale:true},headers:{get:()=>{throw Error('PRIVATE_HEADER');}}});await assert.rejects(badHeaders.task,/degraded/);assert.equal(badHeaders.entries[0].platformRequestId,null);
 // A reporting failure cannot turn the gate green or replace its original error.
 let brokenLogCalls=0;
 await assert.rejects(main({sha,log:()=>{brokenLogCalls++;throw Error('PRIVATE_LOG');},fetchImpl:async()=>({status:200,text:async()=>'{"stale":true}'})}),/Global fixture snapshot is degraded/);assert.equal(brokenLogCalls,1);
 // Execute the real CLI entry with local fetch doubles: receipt + nonzero exit,
 // original safe error and no second application request.
 const {spawnSync}=require('node:child_process'),entry=require.resolve('./verify-global-fixture-public');
 for(const mode of ['degraded','parse','transport']){
  const cli=spawnSync(process.execPath,['-e',`let calls=0;globalThis.fetch=async()=>{if(++calls!==1)throw Error('REPEATED_REQUEST');if(${JSON.stringify(mode)}==='transport')throw Error('PRIVATE_TRANSPORT');return {status:200,text:async()=>${JSON.stringify(mode)}==='parse'?'PRIVATE_INVALID_JSON':'{"stale":true,"private":"PRIVATE_BODY"}'};};process.argv=[process.execPath,${JSON.stringify(entry)}];require('node:module').runMain();`],{encoding:'utf8',cwd:process.cwd()});
  assert.equal(cli.status,1);assert.equal(cli.signal,null);const lines=cli.stdout.trim().split('\n');assert.equal(lines.length,1);const r=JSON.parse(lines[0]);
  assert.equal(r.schemaVersion,'global-fixture-public-failure.v1');assert.equal(r.stage,{degraded:'freshness',parse:'json-parse',transport:'request'}[mode]);assert.equal(r.path,'/api/fixtures');assert.match(r.sha,/^[a-f0-9]{40}$/);
  assert(cli.stderr.includes('Public global fixture release check failed:'));assert(!JSON.stringify([cli.stdout,cli.stderr]).includes('PRIVATE_'));
 }
 const cases=[
  [{body:{stale:true}},/Global fixture snapshot is degraded/],
  [{body:{...healthy,stale:undefined}},/explicitly be healthy/],
  [{body:{...healthy,stale:'PRIVATE_STALE'}},/explicitly be healthy/],
  [{status:503,raw:'<html>PRIVATE_ERROR<\/html>'},/HTTP status/],
  [{raw:'PRIVATE_NOT_JSON'},/not valid JSON/],
  [{textFailure:true},/body did not complete \(HTTP 200\)/],
  [{fetchFailure:true},/request did not complete/],
  [{body:{...healthy,schemaVersion:'PRIVATE_SCHEMA'}},/participation projection/],
  [{body:{...healthy,history:null}},/history must be an array/],
  [{body:{...healthy,revision:''}},/cannot be empty/],
  [{body:{...healthy,maxAgeSeconds:300}},/cache budget/],
  [{body:{...healthy,maxAgeSeconds:'PRIVATE_CACHE'}},/cache budget/],
  [{body:{...healthy,generatedAt:'unknown'}},/valid generation time/],
  [{body:{...healthy,generatedAt:new Date(stamp-60000).toISOString()}},/belong to this request/],
  [{body:{...healthy,generatedAt:new Date(stamp+60000).toISOString()}},/belong to this request/],
 ];
 for(const [options,message] of cases){const test=await probe(options);await assert.rejects(test.task,error=>message.test(error.message)&&!error.message.includes('PRIVATE_'));assert.equal(test.counts().requests,1,'Failure never retries');assert.equal(test.counts().logs,1);assert(!JSON.stringify(test.entries).includes('PRIVATE_'),'Failure receipts redact response and error contents');}
 // Date.parse permits comments; successful receipts must emit only a normalised
 // instant, never the provider-controlled date string or revision/history.
 let safeLog='';
 const permissiveDate='18 Oct 2026 00:00:00 GMT (PRIVATE_DATE)';
 assert.equal(Date.parse(permissiveDate),stamp);
 await main({sha,clock:()=>stamp,timer:()=>100,log:value=>{safeLog=value;},fetchImpl:async()=>({status:200,text:async()=>JSON.stringify({...healthy,generatedAt:permissiveDate,revision:'PRIVATE_REVISION',history:[{note:'PRIVATE_HISTORY'}]})})});
 assert(!safeLog.includes('PRIVATE_'),'Healthy aggregate receipts cannot echo response-controlled strings');
 // Exercise the existing actual route: athlete history still reads ids:[] and
 // propagates global degradation. No new public route or test-only app flag.
 const {createLiveFixtureHandler}=require('../lib/live-fixture-handler');
 for(const stale of [false,true]){
  let reads=0;const handler=createLiveFixtureHandler({environment:{},publishedFixtures:()=>[],read:async options=>{reads++;assert.deepEqual(options,{ids:[]});return {sources:[],revision:'test',readAt:Date.now(),stale};},refresh:()=>{throw Error('Unexpected refresh');}});
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:'GET',url:'/api/fixtures?athlete='+encodeURIComponent(PARTICIPANT),headers:{}},response);
  assert.equal(response.code,200);assert.equal(response.body.stale,stale);assert.equal(reads,1);
  let fetches=0;const task=main({sha,clock:Date.now,log:()=>{},fetchImpl:async()=>{fetches++;return {status:response.code,text:async()=>JSON.stringify(response.body)};}});
  if(stale)await assert.rejects(task,/Global fixture snapshot is degraded/);else assert.equal((await task).healthyGlobalSnapshot,true);
  assert.equal(fetches,1);
 }
 const workflow=fs.readFileSync('.github/workflows/sportscal-production.yml','utf8');
 assert.equal(workflow.split('node scripts/validate-global-fixture-public.js').length-1,1,'One offline gate invocation');
 assert.equal(workflow.split('node scripts/verify-global-fixture-public.js').length-1,1,'One live global probe');
 assert(workflow.indexOf('node scripts/validate-global-fixture-public.js')<workflow.indexOf('Verify shared fixture publication input'));
 assert(workflow.indexOf('node scripts/verify-global-fixture-public.js')>workflow.indexOf('node scripts/validate-security-headers.js https://nothingsport.vercel.app'),'Complete security before the added global gate');
 console.log('Global public release probe: exact unselected route, real handler binding, quiet success, honest stale/error/freshness, one request/body and workflow wiring passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
