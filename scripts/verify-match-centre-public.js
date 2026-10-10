#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
// Two public read-only checks replace a metadata-only release success. No
// provider refresh, account access, score replay, retries or credential is used.
async function main(){
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert(/^[a-f0-9]{40}$/.test(sha));
 const origin='https://nothingsport.vercel.app';
 const read=async query=>{const response=await fetch(origin+'/api/match-centre?'+query+'&releaseSmoke='+sha,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,'Public Match Centre response');return response.json();};
 const listing=await read('membership=everything&limit=60');
 assert.equal(listing.enabled,true,'Match Centre must be available');assert.equal(listing.membershipStale,false,'Degraded saved membership is not live release proof');assert(Array.isArray(listing.events)&&Array.isArray(listing.fixtures));
 const ids=listing.fixtures.map(f=>f.id);assert(ids.length<=60);assert.equal(new Set(ids).size,ids.length,'Membership identities are unique');
 let selectedCount=0;
 if(ids.length){
  const selected=await read('ids='+encodeURIComponent(ids.join(',')));assert.equal(selected.enabled,true);assert(Array.isArray(selected.fixtures));const byId=new Map(selected.fixtures.map(f=>[f.id,f]));
  for(const fixture of listing.fixtures){const current=byId.get(fixture.id);assert(current,'Displayed fixture remains available to score polling: '+fixture.id);assert.equal(current.sport,fixture.sport);assert.equal(current.homeParticipantId,fixture.homeParticipantId);assert.equal(current.awayParticipantId,fixture.awayParticipantId);
   if(/^fixture:cricket:CA:\d+$/.test(fixture.id)&&fixture.scorecardUrl&&fixture.scorecardOfficial){assert.equal(current.scorecardUrl,fixture.scorecardUrl,'Score polling preserves the canonical official scorecard: '+fixture.id);assert.equal(current.scorecardOfficial,true);}
  }
  selectedCount=byId.size;
 }
 console.log(JSON.stringify({schemaVersion:'match-centre-public-release.v1',sha,healthyMembership:true,displayed:ids.length,selected:selectedCount,emptyQuietWindowAccepted:ids.length===0,limits:'No cold-server or physical-device performance certification.'}));
}
main().catch(error=>{console.error('Public Match Centre release check failed: '+error.message);process.exitCode=1;});
