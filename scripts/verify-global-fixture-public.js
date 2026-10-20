#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const PARTICIPANT='competitor:tennis:atp:alex-de-minaur';
// Participation uses the existing unselected global snapshot before returning a
// small public history. No account, refresh, highlight lookup or credential.
async function main({fetchImpl=globalThis.fetch,timer=()=>performance.now(),clock=Date.now,log=console.log,
 sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}={}){
 assert(/^[a-f0-9]{40}$/.test(sha),'Expected exact release SHA');
 const url=new URL('https://nothingsport.vercel.app/api/fixtures');
 url.searchParams.set('athlete',PARTICIPANT);
 url.searchParams.set('releaseSmoke',sha+'-'+crypto.randomUUID());
 const started=timer(),startedAt=clock();let response,text,body,stage='request';
 try{
 try{response=await fetchImpl(url.href,{method:'GET',headers:{'Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(15000)});}
 catch{throw Error('Public global fixture request did not complete');}
 stage='body';
 try{text=await response.text();}
 catch{throw Error('Public global fixture body did not complete (HTTP '+(Number.isInteger(response.status)?response.status:'invalid')+')');}
 const elapsedMs=Math.max(0,timer()-started),finishedAt=clock();
 stage='http-status';
 assert(response.status===200,'Public global fixture response HTTP status must be 200');
 stage='json-parse';
 try{body=JSON.parse(text);}catch{throw Error('Public global fixture response was not valid JSON');}
 stage='freshness';
 // A saved fallback can have a valid history/schema. Diagnose degradation first.
 if(body?.stale===true)throw Error('Global fixture snapshot is degraded; saved membership is not live release proof');
 // Boolean assertions keep response-controlled values out of CLI diagnostics.
 assert(body?.stale===false,'Global fixture snapshot must explicitly be healthy');
 stage='schema';
 assert(body.schemaVersion==='athlete-participation-live.v1','Expected public participation projection');
 assert(Array.isArray(body.history),'Public participation history must be an array');
 assert(typeof body.revision==='string','Global fixture revision must be present');
 assert(body.revision.length>0,'Global fixture revision cannot be empty');
 assert(body.maxAgeSeconds===30,'Healthy global snapshot retains its existing cache budget');
 stage='generation-time';
 const generated=typeof body.generatedAt==='string'?Date.parse(body.generatedAt):NaN;
 assert(Number.isFinite(generated),'Global fixture response needs a valid generation time');
 // This is response-generation freshness, not a new sporting observation clock.
 assert(generated>=startedAt-5000&&generated<=finishedAt+5000,'Global fixture response generation must belong to this request');
 const result={schemaVersion:'global-fixture-public-release.v1',sha,healthyGlobalSnapshot:true,history:body.history.length,
  elapsedThroughBodyMs:Number(elapsedMs.toFixed(2)),generatedAt:new Date(generated).toISOString(),
  limits:'One public global read via existing participation projection; no account or provider lookup. Elapsed includes catalogue/merge/network, not isolated SQL time. Snapshot cache remains30s; repeated fresh rounds and physical-device proof are separate.'};
 stage='receipt';log(JSON.stringify(result));return result;
 }catch(error){
  // Only fixed stages and allowlisted metadata from this same request. Never
  // emit the query, response content, arbitrary headers or exception text.
  let platformRequestId=null;
  try{const id=response?.headers?.get('x-vercel-id');
   if(typeof id==='string'&&id.length<=200&&/^(?:[a-z]{3}[1-9][0-9]?::){1,3}[a-z0-9]{5,32}-[0-9]{10,16}-[a-f0-9]{8,64}$/.test(id))platformRequestId=id;
  }catch{}
  try{
   const instant=value=>Number.isFinite(value)&&Math.abs(value)<=8640000000000000?new Date(value).toISOString():null;
   const duration=timer()-started;
   const readFailure=body?.stale===true?require('../lib/snapshot-failure-receipt').failure(body.snapshotReadFailure):null;
   log(JSON.stringify({schemaVersion:'global-fixture-public-failure.v1',sha,path:url.pathname,stage,
    startedAt:instant(startedAt),finishedAt:instant(clock()),elapsedMs:Number.isFinite(duration)?Number(Math.max(0,duration).toFixed(2)):null,
    httpStatus:Number.isInteger(response?.status)&&response.status>=100&&response.status<=599?response.status:null,
    stale:typeof body?.stale==='boolean'?body.stale:null,platformRequestId,
    ...(readFailure?{snapshotReadFailure:readFailure}:{})}));
  }catch{} // Reporting must not replace the original gate failure.
  throw error;
 }
}
if(require.main===module)main().catch(error=>{console.error('Public global fixture release check failed: '+error.message);process.exitCode=1;});
module.exports={main,PARTICIPANT};
