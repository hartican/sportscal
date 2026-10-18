#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {main,PARTICIPANT}=require('./verify-global-fixture-public');
const stamp=Date.parse('2026-10-18T00:00:00Z'),sha='a'.repeat(40);
const healthy={schemaVersion:'athlete-participation-live.v1',stale:false,revision:'current',generatedAt:new Date(stamp).toISOString(),maxAgeSeconds:30,history:[]};
async function probe({body=healthy,status=200,textFailure,fetchFailure,raw,clock=()=>stamp}={}){
 let requests=0,reads=0,logs=0;
 const task=main({sha,clock,timer:()=>100,log:value=>{logs++;assert(!value.includes(PARTICIPANT),'Receipts need no participant identity');},fetchImpl:async(value,options)=>{
  requests++;const url=new URL(value);assert.equal(url.pathname,'/api/fixtures');assert.equal(url.searchParams.get('athlete'),PARTICIPANT);
  assert(!url.searchParams.has('ids')&&!url.searchParams.has('mode')&&!url.searchParams.has('revision'),'Use global read without media/cache-validator paths');
  assert.match(url.searchParams.get('releaseSmoke'),new RegExp('^'+sha+'-'));assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');
  assert.deepEqual(options.headers,{'Cache-Control':'no-cache'});assert(options.signal instanceof AbortSignal);assert.equal(options.body,undefined);
  if(fetchFailure)throw Error('PRIVATE_TRANSPORT');
  return {status,text:async()=>{reads++;if(textFailure)throw Error('PRIVATE_BODY');return raw===undefined?JSON.stringify(body):raw;}};
 }});
 return {task,counts:()=>({requests,reads,logs})};
}
(async()=>{
 const okay=await probe();const receipt=await okay.task;assert.equal(receipt.healthyGlobalSnapshot,true);assert.equal(receipt.history,0);assert.deepEqual(okay.counts(),{requests:1,reads:1,logs:1});
 const cases=[
  [{body:{stale:true}},/Global fixture snapshot is degraded/],
  [{body:{...healthy,stale:undefined}},/explicitly be healthy/],
  [{status:503,raw:'<html>PRIVATE_ERROR<\/html>'},/HTTP status/],
  [{raw:'PRIVATE_NOT_JSON'},/not valid JSON/],
  [{textFailure:true},/body did not complete \(HTTP 200\)/],
  [{fetchFailure:true},/request did not complete/],
  [{body:{...healthy,schemaVersion:'wrong'}},/participation projection/],
  [{body:{...healthy,history:null}},/history must be an array/],
  [{body:{...healthy,revision:''}},/cannot be empty/],
  [{body:{...healthy,maxAgeSeconds:300}},/cache budget/],
  [{body:{...healthy,generatedAt:'unknown'}},/valid generation time/],
  [{body:{...healthy,generatedAt:new Date(stamp-60000).toISOString()}},/belong to this request/],
  [{body:{...healthy,generatedAt:new Date(stamp+60000).toISOString()}},/belong to this request/],
 ];
 for(const [options,message] of cases){const test=await probe(options);await assert.rejects(test.task,error=>message.test(error.message)&&!error.message.includes('PRIVATE_'));assert.equal(test.counts().requests,1,'Failure never retries');assert.equal(test.counts().logs,0);}
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
