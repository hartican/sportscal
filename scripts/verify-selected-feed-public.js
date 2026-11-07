#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const TARGET='fixture:cricket:espn:1525660';
const URL='https://nothingsport.vercel.app/api/fixtures?ids=fixture%3Acricket%3Aespn%3A1525660';
const instant=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
function project(f){
 return {id:f.id,status:f.status,homeParticipantId:f.homeParticipantId,awayParticipantId:f.awayParticipantId,sourceStale:f.sourceStale===true,matchDay:f.matchDay??null,cricketPhaseConfirmed:f.cricketPhaseConfirmed===true,
  ...Object.fromEntries(['scoreCheckedAt','statusCheckedAt','scoreFactObservedAt','statusFactObservedAt'].map(k=>[k,f[k]||null])),
  innings:(f.innings||[]).map(i=>({participantId:i.participantId,inningNumber:i.inningNumber??null,runs:i.runs??i.runsScored,wickets:typeof i.wickets==='number'?i.wickets:i.wicketsCount??i.numberOfWicketsFallen,overs:i.overs??i.oversBowled}))};
}
// A single, explicitly allocated release-only read. Default releases do not
// activate it. Admission comes from the existing successful selected MC GET.
async function main({sha,allocatedSha='',selected,fetchImpl=globalThis.fetch,claim=()=>{},write=()=>{},clock=Date.now,timer=()=>performance.now()}={}){
 assert(/^[a-f0-9]{40}$/.test(sha||''),'Expected exact release SHA');
 const receipt={schemaVersion:'selected-feed-public-release.v1',sha,target:TARGET,outcome:'NOT_ALLOCATED',requests:0};
 if(!allocatedSha)return receipt;
 assert.equal(allocatedSha,sha,'Selected Feed allocation must match this exact release');
 assert(selected?.sha===sha,'Selected Match Centre evidence must belong to this release');
 if(!selected.available||selected.fixture?.id!==TARGET){receipt.outcome='NOT_EXERCISED';write(receipt);return receipt;}
 // Claim before transport. A duplicate invocation cannot silently retry.
 claim();receipt.requests=1;receipt.path='/api/fixtures';receipt.startedAt=new Date(clock()).toISOString();
 const started=timer(),controller=new AbortController();let stage='request',response,deadline;
 const bounded=new Promise((_,reject)=>{deadline=setTimeout(()=>{controller.abort();reject(Error('Selected Feed read exceeded its five-second deadline'));},5000);});
 try{
  const operation=(async()=>{response=await fetchImpl(URL,{method:'GET',cache:'no-store',signal:controller.signal});stage='http-status';assert.equal(response.status,200,'Selected Feed HTTP status must be 200');stage='body';return response.json();})();
  const body=await Promise.race([operation,bounded]);
  stage='freshness';assert.equal(body?.stale,false,'Selected Feed snapshot must be explicitly healthy');assert.equal(body.maxAgeSeconds,30,'Selected Feed retains its existing healthy cache budget');
  stage='schema';assert.equal(body.schemaVersion,'live-fixtures.v1');assert(Array.isArray(body.sources));
  const rows=body.sources.flatMap(s=>Array.isArray(s.fixtures)?s.fixtures:[]);assert.equal(rows.length,1,'Exactly the canonical selected fixture must be returned');
  assert.equal(rows[0].id,TARGET,'Selected Feed must preserve the public fixture identity');const f=project(rows[0]);
  stage='official-facts';assert.equal(f.sourceStale,false);assert.equal(f.homeParticipantId,'team:cricket:south-africa');assert.equal(f.awayParticipantId,'team:cricket:australia');
  assert.equal(f.cricketPhaseConfirmed,true,'A discovery status is not official phase evidence');assert(Number.isInteger(f.matchDay)&&f.matchDay>0,'Official match day must be supplied');
  assert(['live','playing','inprogress','in-progress','lunch','tea','stumps','rain-delay','delayed','suspended','completed','finished','final','abandoned','cancelled','canceled','postponed'].includes(f.status),'Official phase must be recognised');
  for(const k of ['scoreCheckedAt','statusCheckedAt','scoreFactObservedAt','statusFactObservedAt'])assert(instant(f[k]),'Original sporting observation clocks must be supplied');
  assert(f.innings.length>0&&f.innings.length<=4,'Official innings must be supplied');
  for(const i of f.innings){assert([f.homeParticipantId,f.awayParticipantId].includes(i.participantId));assert(Number.isInteger(i.runs)&&i.runs>=0);assert(Number.isInteger(i.wickets)&&i.wickets>=0&&i.wickets<=10);assert(/^(?:0|[1-9]\d*)\.[0-5]$/.test(String(i.overs)));}
  const prior=selected.membershipFixture,comparison={score:'NOT_COMPARABLE',status:'NOT_COMPARABLE'};stage='same-revision-comparison';
  if(prior?.scoreFactObservedAt&&prior.scoreFactObservedAt===f.scoreFactObservedAt){assert.deepEqual(f.innings,prior.innings,'Equal score observations must agree across views');comparison.score='MATCH';}
  if(prior?.statusFactObservedAt&&prior.statusFactObservedAt===f.statusFactObservedAt){assert.equal(f.status,prior.status);assert.equal(f.matchDay,prior.matchDay);assert.equal(f.cricketPhaseConfirmed,prior.cricketPhaseConfirmed);comparison.status='MATCH';}
  receipt.outcome='PASS';receipt.fixture=f;receipt.comparison=comparison;
 }catch(error){receipt.outcome='FAIL';receipt.stage=stage;throw Error('Selected Feed release check failed at '+stage);}
 finally{clearTimeout(deadline);receipt.finishedAt=new Date(clock()).toISOString();receipt.elapsedThroughBodyMs=Number(Math.max(0,timer()-started).toFixed(2));receipt.httpStatus=Number.isInteger(response?.status)?response.status:null;write(receipt);}
 return receipt;
}
if(require.main===module){
 const fs=require('node:fs'),path=require('node:path'),sha=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dir=process.env.NS_DEPLOY_REPORT_DIR;
 const allocatedSha=process.env.NS_SELECTED_FEED_PROOF_SHA||'';
 Promise.resolve().then(()=>main({sha,allocatedSha,selected:allocatedSha?JSON.parse(fs.readFileSync(path.join(dir,'second-test-selected.json'),'utf8')):undefined,
  claim:()=>fs.writeFileSync(path.join(dir,'selected-feed-attempt.json'),JSON.stringify({sha,target:TARGET,claimedAt:new Date().toISOString()})+'\n',{flag:'wx'}),
  write:receipt=>fs.writeFileSync(path.join(dir,'selected-feed-public.json'),JSON.stringify(receipt,null,2)+'\n')
 })).then(r=>console.log(JSON.stringify({schemaVersion:r.schemaVersion,sha:r.sha,outcome:r.outcome,requests:r.requests}))).catch(()=>{console.error('Selected Feed release verification failed; inspect its safe release receipt.');process.exitCode=1;});
}
module.exports={main,project,TARGET,URL};
