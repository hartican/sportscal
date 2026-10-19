#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
// Two public read-only checks replace a metadata-only release success. No
// provider refresh, account access, score replay, retries or credential is used.
async function main({fetchImpl=globalThis.fetch,timer=()=>performance.now(),log=console.log,onSelected=()=>{}}={}){
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert(/^[a-f0-9]{40}$/.test(sha));
 const origin='https://nothingsport.vercel.app';
 const reads=[],phases=['catalogue','prepare','snapshot','merge','selection','scores','projection','total'];
 const read=async(query,kind)=>{const started=timer(),response=await fetchImpl(origin+'/api/match-centre?'+query+'&releaseSmoke='+sha,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,'Public Match Centre response');const body=await response.json(),elapsedMs=Math.max(0,timer()-started),serverMs={};
  for(const field of (response.headers.get('Server-Timing')||'').split(',')){const value=/^\s*([a-z]+);dur=(\d+(?:\.\d+)?)\s*$/.exec(field);if(value&&phases.includes(value[1])&&Number.isFinite(Number(value[2])))serverMs[value[1]]=Number(value[2]);}
  // A failed snapshot never reaches merge. Report the actual degraded
  // membership before checking healthy-path timing completeness.
  if(kind==='membership'&&body.membershipStale===true)throw Error('Shared fixture snapshot is degraded; current Match Centre membership is not release proof'+(Object.hasOwn(serverMs,'snapshot')?' (snapshot='+serverMs.snapshot+'ms)':''));
  for(const name of ['catalogue','selection','scores','projection','total',...(kind==='membership'?['prepare','snapshot','merge']:[])])assert(Object.hasOwn(serverMs,name),'Measured public response must retain the '+name+' origin timing');
  reads.push({kind,elapsedMs:Number(elapsedMs.toFixed(2)),serverMs});return body;};
 const listing=await read('membership=everything&limit=60','membership');
 assert.equal(listing.enabled,true,'Match Centre must be available');assert.equal(listing.membershipStale,false,'Degraded saved membership is not live release proof');assert(Array.isArray(listing.events)&&Array.isArray(listing.fixtures));
 const ids=listing.fixtures.map(f=>f.id);assert(ids.length<=60);assert.equal(new Set(ids).size,ids.length,'Membership identities are unique');
 let selectedCount=0,selectedFixtures=[];
 if(ids.length){
  const selected=await read('ids='+encodeURIComponent(ids.join(',')),'selected');assert.equal(selected.enabled,true);assert(Array.isArray(selected.fixtures));const byId=new Map(selected.fixtures.map(f=>[f.id,f]));
  for(const fixture of listing.fixtures){const current=byId.get(fixture.id);assert(current,'Displayed fixture remains available to score polling: '+fixture.id);assert.equal(current.sport,fixture.sport);assert.equal(current.homeParticipantId,fixture.homeParticipantId);assert.equal(current.awayParticipantId,fixture.awayParticipantId);
   if(/^fixture:cricket:CA:\d+$/.test(fixture.id)&&fixture.scorecardUrl&&fixture.scorecardOfficial){assert.equal(current.scorecardUrl,fixture.scorecardUrl,'Score polling preserves the canonical official scorecard: '+fixture.id);assert.equal(current.scorecardOfficial,true);}
  }
  selectedCount=byId.size;selectedFixtures=selected.fixtures;
 }
 await onSelected({sha,fixtures:selectedFixtures});
 log(JSON.stringify({schemaVersion:'match-centre-public-release.v1',sha,healthyMembership:true,displayed:ids.length,selected:selectedCount,emptyQuietWindowAccepted:ids.length===0,reads,limits:'Origin timings exclude platform startup, response encoding and network; elapsed includes the HTTP body. No cold-server or physical-device performance certification.'}));
}
// Private release artifact from the already-required anonymous selected read.
// Keep normal console receipts aggregate-only; never add a sporting request.
function selectedEvidence({sha,fixtures}){
 const fixture=fixtures.find(f=>f.id==='fixture:cricket:espn:1525660');
 return {schemaVersion:'second-test-selected-release.v1',sha,available:Boolean(fixture),...(fixture?{fixture:{id:fixture.id,status:fixture.status,stale:fixture.stale,scoreCheckedAt:fixture.scoreCheckedAt||null,statusCheckedAt:fixture.statusCheckedAt||null,statusFactObservedAt:fixture.statusFactObservedAt||null,innings:(fixture.score?.innings||[]).map(i=>({participantId:i.participantId,inningNumber:i.inningNumber,runs:i.runs,wickets:i.wickets,overs:i.overs}))}}:{})};
}
if(require.main===module)main({onSelected:data=>{
 if(!process.env.NS_DEPLOY_REPORT_DIR)return;
 const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.NS_DEPLOY_REPORT_DIR,{recursive:true});
 fs.writeFileSync(path.join(process.env.NS_DEPLOY_REPORT_DIR,'second-test-selected.json'),JSON.stringify(selectedEvidence(data),null,2)+'\n');
}}).catch(error=>{console.error('Public Match Centre release check failed: '+error.message);process.exitCode=1;});
module.exports=main;module.exports.selectedEvidence=selectedEvidence;
