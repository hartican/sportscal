'use strict';
const assert=require('node:assert/strict');
let maintain=require('../lib/public-comment-alerts').maintain;
if(process.argv.includes('--reviewed-baseline')||process.argv.includes('--starvation-baseline')){const base=process.argv.includes('--starvation-baseline')?'cee38c7e8291d9a3cef428f78c462e275bb931d2':'95885e63bd93d22980ac7526633c638239c910df';const source=require('node:child_process').execFileSync('git',['show',base+':lib/public-comment-alerts.js'],{encoding:'utf8'}),sandbox={exports:{}};Function('require','module','exports',source)(require('node:module').createRequire(require('node:path').resolve('lib/public-comment-alerts.js')),sandbox,sandbox.exports);maintain=sandbox.exports.maintain;}
const now=new Date('2026-10-24T01:00Z'),ids=['fixture:one','fixture:two'];
async function trial(receipt){
 const writes=[],reads=[];let refreshes=0;
 const request=async(path,options)=>{if(!options){reads.push(path);return ids.map(event_id=>({event_id}));}writes.push({path,...options});return{retired:true};};
 const api={refreshEventSnapshots:async requested=>{refreshes++;assert.deepEqual(requested,ids);if(receipt instanceof Error)throw receipt;return receipt;},eventFor:id=>({id,kind:'fixture',key:'cricket',date:'2026-10-01',name:'Last-good completed fixture',status:'completed',actualEndTimeUtc:'2026-10-01T08:00Z',completedAt:'2026-10-01T08:00Z'})};
 const result=await maintain({now,api,request});return{writes,reads,refreshes,result};
}
async function fairness(){
 const fixture={name:'Unchanged last-good descriptor',sourceCheckedAt:'2026-10-01T00:00Z'},threads=['a','b','c','d','e'].map(letter=>({event_id:'fixture:'+letter,checked_at:'2026-10-01T00:00:00.000Z',closed:false,fixture:{...fixture}})),batches=[],retirements=[],attempts=[];
 const request=async(path,options)=>{const q=new URL(path,'https://synthetic.invalid').searchParams;if(!options){assert.equal(q.get('limit'),'2');return threads.filter(row=>!row.closed&&row.checked_at<q.get('checked_at').slice(3)).sort((a,b)=>a.checked_at.localeCompare(b.checked_at)||a.event_id.localeCompare(b.event_id)).slice(0,2).map(({event_id})=>({event_id}));}
  if(options.method==='PATCH'){assert.deepEqual(Object.keys(options.body),['checked_at'],'fairness writes scheduling receipt only, never source/fixture clocks');assert.equal(q.get('closed'),'eq.false');const selected=q.get('event_id').slice(4,-1).split(',');assert(selected.length<=2);for(const id of selected){const thread=threads.find(row=>row.event_id===id);if(thread&&!thread.closed)thread.checked_at=options.body.checked_at;}attempts.push(selected);return null;}
  assert(path.endsWith('nothingsports_retire_public_comments'));assert.equal(options.body.target_fixture,'fixture:c','permanently omitted fixtures cannot retire');assert.equal(options.body.verified_fixture.retirementEligible,true,'later final must qualify through the actual shared policy');retirements.push(options.body.target_fixture);threads.find(row=>row.event_id===options.body.target_fixture).closed=true;return{retired:true};
 };
 const api={refreshEventSnapshots:async selected=>{assert(selected.length<=2);batches.push(selected);return{stale:false,checkedIds:selected.filter(id=>id==='fixture:c')};},eventFor:id=>{assert.equal(id,'fixture:c','unverified static descriptor cannot authorize a new effect');return{id,kind:'fixture',key:'cricket',date:'2026-10-01',status:'completed',actualEndTimeUtc:'2026-10-01T08:00Z'};}};
 for(let pass=0;pass<5;pass++)await maintain({now:new Date(+now+pass*60000),api,request});
 assert(retirements.includes('fixture:c'),'permanently omitted oldest two must not starve a later verified final across passes');assert.deepEqual(batches[0],['fixture:a','fixture:b']);assert(batches[1].includes('fixture:c'));assert(batches.every(batch=>batch.length<=2));assert(attempts.length<=5);for(const row of threads.filter(row=>['fixture:a','fixture:b'].includes(row.event_id)))assert.deepEqual(row.fixture,fixture,'attempt rotation cannot redate unverified source observations');
}

async function main(){
 if(process.argv.includes('--starvation-only')){await fairness();console.log('Bounded retirement fairness passed.');return;}
 for(const receipt of [{stale:true,checkedIds:ids},{stale:false,checkedIds:[]},undefined,Error('Selected read failed')]){const t=await trial(receipt);assert.equal(t.writes.filter(write=>write.method==='POST').length,0,'stale/omitted/unverified selected receipt must not retire last-good content');assert.equal(t.writes.filter(write=>write.method==='PATCH').length,1,'one bounded attempt receipt rotates deferred work');assert.deepEqual(t.writes.find(write=>write.method==='PATCH').body,{checked_at:now.toISOString()},'only scheduling receipt changes, never fixture/source observations');assert.equal(t.refreshes,1,'no source retry');assert.equal(t.result.retired,0);}
 const partial=await trial({stale:false,checkedIds:[ids[0]]}),retirements=partial.writes.filter(write=>write.method==='POST');assert.equal(retirements.length,1);assert.equal(retirements[0].body.target_fixture,ids[0]);assert.equal(retirements[0].body.verified_fixture.retirementEligible,true,'healthy exact final uses the real shared retirement policy');
 const all=await trial({stale:false,checkedIds:ids});assert.equal(all.writes.filter(write=>write.method==='POST').length,2);assert.equal(all.result.retired,2);assert.equal(all.reads.length,1);
 await fairness();
 console.log('Public comment retirement: healthy exact selected IDs alone authorize effects; stale, missing and failed reads preserve content/source clocks, rotate bounded attempts fairly, and never retry sources.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
