'use strict';
const assert=require('node:assert/strict');
let maintain=require('../lib/public-comment-alerts').maintain;
if(process.argv.includes('--reviewed-baseline')){const source=require('node:child_process').execFileSync('git',['show','95885e63bd93d22980ac7526633c638239c910df:lib/public-comment-alerts.js'],{encoding:'utf8'}),sandbox={exports:{}};Function('require','module','exports',source)(require('node:module').createRequire(require('node:path').resolve('lib/public-comment-alerts.js')),sandbox,sandbox.exports);maintain=sandbox.exports.maintain;}
const now=new Date('2026-10-24T01:00Z'),ids=['fixture:one','fixture:two'];
async function trial(receipt){
 const writes=[],reads=[];let refreshes=0;
 const request=async(path,options)=>{if(!options){reads.push(path);return ids.map(event_id=>({event_id}));}writes.push({path,...options});return{retired:true};};
 const api={refreshEventSnapshots:async requested=>{refreshes++;assert.deepEqual(requested,ids);if(receipt instanceof Error)throw receipt;return receipt;},eventFor:id=>({id,kind:'fixture',key:'cricket',date:'2026-10-01',name:'Last-good completed fixture',status:'completed',actualEndTimeUtc:'2026-10-01T08:00Z',completedAt:'2026-10-01T08:00Z'})};
 const result=await maintain({now,api,request});return{writes,reads,refreshes,result};
}
async function main(){
 for(const receipt of [{stale:true,checkedIds:ids},{stale:false,checkedIds:[]},undefined,Error('Selected read failed')]){const t=await trial(receipt);assert.equal(t.writes.length,0,'stale/omitted/unverified selected receipt must not retire last-good content or advance clocks');assert.equal(t.refreshes,1,'no source retry');assert.equal(t.result.retired,0);}
 const partial=await trial({stale:false,checkedIds:[ids[0]]});assert.equal(partial.writes.length,1);assert.equal(partial.writes[0].body.target_fixture,ids[0]);assert.equal(partial.writes[0].body.verified_fixture.retirementEligible,true,'healthy exact final uses the real shared retirement policy');
 const all=await trial({stale:false,checkedIds:ids});assert.equal(all.writes.length,2);assert.equal(all.result.retired,2);assert.equal(all.reads.length,1);
 console.log('Public comment retirement: healthy exact selected IDs alone authorize effects; stale, missing and failed reads preserve content/clocks without retry.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
