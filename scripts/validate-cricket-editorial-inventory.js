'use strict';
const assert=require('node:assert/strict');
const maintenance=require('../config/editorial-maintenance'),store=require('../lib/editorial-maintenance');
const {buildSamples}=require('./preview-cricket-editorial-policy');
async function main(){
  const packet=buildSamples(),events=packet.cases.map(c=>c.event),now=new Date(packet.now),calls=[];
  // Synthetic controls in a local service double; no production votes or writes.
  const requestImpl=async(url,options={})=>{
    calls.push({url,body:options.body});
    if(url.endsWith('/nothingsports_editorial_signals'))return [{event_id:events[0].id,count:1,mean:5,five_count:1}];
    assert(url.startsWith('/rest/v1/nothingsports_editorial_maintenance?'));
    return [{event_id:events[1].id,revision:1,held:true,requested:true}];
  };
  const inventory=await store.inventory({now,requestImpl,sourceImpl:()=>({sourceRevision:'a'.repeat(64),events})});
  assert.equal(calls.length,2,'One existing aggregate batch and one existing control read.');
  assert.equal(calls[0].body.target_groups.length,2,'Ongoing fixture and preview share the existing batch; out-of-window ODI is excluded.');
  const live=inventory.cards.find(c=>c.event.id===events[0].id),preview=inventory.cards.find(c=>c.event.id===events[1].id);
  assert(live.selected&&live.schedule.due&&live.schedule.phase==='ongoing');
  assert.equal(live.schedule.cadenceDays,1);
  assert(preview.schedule.held&&!preview.schedule.due);
  assert.equal(maintenance.schedule(events[1],{},now).cadenceDays,5,'Preview cadence stays unchanged.');
  assert.equal(maintenance.schedule(events[0],{last_checked_at:packet.now},now).due,false,'Unchanged same-day check does not loop.');
  const copy=maintenance.copy(events[0]);assert(maintenance.completeCopy(copy));assert(maintenance.equalCopy(copy,packet.cases[0].entry));
  assert(!maintenance.equalCopy(copy,{...copy,validUntil:'2026-10-20T18:00:00.000Z'}),'Meaningful validity changes participate in publication comparison.');
  const display=require('./lib/editorial-display-copy');
  const legacy=event=>{const value=structuredClone(event);delete value.editorialNarrative;return value;};
  assert.deepEqual(display.selectCards({cards:[{...live,selected:false}]},[legacy(live.event)],()=>false,now),[],'Ongoing Cricket without real signals or a request cannot enter research through missing-copy repair.');
  const unheldPreview={...preview,state:{},schedule:maintenance.schedule(preview.event,{},now),selected:false};
  const repairs=display.selectCards({cards:[unheldPreview]},[legacy(preview.event)],()=>false,now);
  assert.equal(repairs.length,1,'Published incomplete pre-match Cricket retains the approved public-copy repair exception.');
  assert.equal(repairs[0].repairReason,'missing-required-display-copy');
  console.log('Cricket editorial inventory: existing qualification, daily active work, preview cadence, holds, batched reads and unchanged-check suppression passed with local controls only.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
