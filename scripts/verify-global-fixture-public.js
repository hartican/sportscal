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
 const started=timer(),startedAt=clock();let response,text;
 try{response=await fetchImpl(url.href,{method:'GET',headers:{'Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(15000)});}
 catch{throw Error('Public global fixture request did not complete');}
 try{text=await response.text();}
 catch{throw Error('Public global fixture body did not complete (HTTP '+response.status+')');}
 const elapsedMs=Math.max(0,timer()-started),finishedAt=clock();
 assert.equal(response.status,200,'Public global fixture response HTTP status');
 let body;try{body=JSON.parse(text);}catch{throw Error('Public global fixture response was not valid JSON');}
 // A saved fallback can have a valid history/schema. Diagnose degradation first.
 if(body?.stale===true)throw Error('Global fixture snapshot is degraded; saved membership is not live release proof');
 assert.equal(body?.stale,false,'Global fixture snapshot must explicitly be healthy');
 assert.equal(body.schemaVersion,'athlete-participation-live.v1','Expected public participation projection');
 assert(Array.isArray(body.history),'Public participation history must be an array');
 assert.equal(typeof body.revision,'string','Global fixture revision must be present');
 assert(body.revision.length>0,'Global fixture revision cannot be empty');
 assert.equal(body.maxAgeSeconds,30,'Healthy global snapshot retains its existing cache budget');
 const generated=Date.parse(body.generatedAt);
 assert(Number.isFinite(generated),'Global fixture response needs a valid generation time');
 // This is response-generation freshness, not a new sporting observation clock.
 assert(generated>=startedAt-5000&&generated<=finishedAt+5000,'Global fixture response generation must belong to this request');
 const result={schemaVersion:'global-fixture-public-release.v1',sha,healthyGlobalSnapshot:true,history:body.history.length,
  elapsedThroughBodyMs:Number(elapsedMs.toFixed(2)),generatedAt:body.generatedAt,
  limits:'One public global read via existing participation projection; no account or provider lookup. Elapsed includes catalogue/merge/network, not isolated SQL time. Snapshot cache remains30s; repeated fresh rounds and physical-device proof are separate.'};
 log(JSON.stringify(result));return result;
}
if(require.main===module)main().catch(error=>{console.error('Public global fixture release check failed: '+error.message);process.exitCode=1;});
module.exports={main,PARTICIPANT};
