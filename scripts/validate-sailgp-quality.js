'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),timing=require('../lib/reviewed-session-timing');
const {applySelectedTimings}=require('./apply-current-card-evidence');
const evidence=JSON.parse(fs.readFileSync(path.join(root,'data/canonical/current-card-evidence-2026.json'),'utf8'));
const rows=timing.validate(evidence.timingOverrides);
assert.equal(rows.length,2,'This module is the two reviewed Geneva days; no future clock inference');
const clone=value=>JSON.parse(JSON.stringify(value));
for(const mutate of [r=>r.time='23:00',r=>r.endTimeUtc=r.startTimeUtc,r=>r.startTimeUtc='September 19, 2026',r=>r.timingProvenance.checkedAt='2099-01-01T00:00:00Z',r=>r.timingProvenance.sourceUrl='https://example.com/private',r=>r.score='invented result']){
  const bad=clone(rows);mutate(bad[0]);assert.throws(()=>timing.validate(bad));
}
assert.throws(()=>timing.validate([rows[0],rows[0]]));
const observed={id:rows[0].id,date:rows[0].date,time:'23:00',startTimeUtc:'2026-09-19T13:00:00.000Z',endTimeUtc:'2026-09-19T16:00:00.000Z',endTimeBasis:'scheduled-live-window',score:0,resultSourceCheckedAt:'2026-09-21T20:24:10.712468Z',sourceCheckedAt:'2026-09-14T00:00:00Z',participantIds:['team:a'],savedState:{rated:5,hidden:true}};
const patched=timing.apply([observed],[rows[0]],{required:true})[0];
for(const key of Object.keys(observed).filter(k=>!timing.fields.includes(k)))assert.deepEqual(patched[key],observed[key],key+' survives clock repair');
assert.equal(patched.time,'23:30');assert.strictEqual(timing.apply([patched],[rows[0]])[0],patched,'identical rerun retains the object and observation');
const newer={...patched,startTimeUtc:'2026-09-19T14:00:00Z',timingProvenance:{...patched.timingProvenance,checkedAt:'2026-10-02T16:07:23.274Z'}};
assert.strictEqual(timing.apply([newer],[rows[0]])[0],newer,'a later real schedule observation beats static reviewed evidence');
assert.throws(()=>timing.apply([{...patched,time:'23:00'}],[rows[0]]),'same observation cannot carry conflicting clocks');
assert.throws(()=>timing.apply([{...observed,date:'2026-09-20'}],[rows[0]]));
const targets=['data/canonical/fiba-women-sailgp-motogp-2026.json','feeds/incoming/events.json','data/events.json','data/follow-sources/coverage.v1.json'];
// A later ordinary canonical refresh must retain the separate clocks too.
const schedule=JSON.parse(fs.readFileSync(path.join(root,targets[0])));
const participants=new Map(schedule.participants.map(p=>[p.id,p]));
for(const row of rows){
  const event=schedule.events.find(e=>e.id===row.canonicalId);
  const card=require('./sync-requested-sports-to-feed').cardForEvent(event,schedule,participants);
  for(const key of timing.fields)assert.deepEqual(card[key],row[key],'canonical refresh retains '+key);
  const beforeEvent={...event};for(const key of timing.fields)delete beforeEvent[key];
  const beforeCard=require('./sync-requested-sports-to-feed').cardForEvent(beforeEvent,schedule,participants);
  for(const key of Object.keys(beforeCard).filter(key=>!timing.fields.includes(key)))assert.deepEqual(card[key],beforeCard[key],'timing propagation preserves '+key);
  assert.equal(card.id,row.id);assert.notEqual(card.sourceCheckedAt,row.timingProvenance.checkedAt,'a clock review cannot renew canonical source facts');
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-sailgp-timing-'));
try{
  for(const file of [...targets,'data/canonical/current-card-evidence-2026.json']){const dest=path.join(temp,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
  const before=new Map(targets.map(file=>[file,JSON.parse(fs.readFileSync(path.join(temp,file),'utf8'))]));
  applySelectedTimings({root:temp});
  for(const file of targets){const after=JSON.parse(fs.readFileSync(path.join(temp,file),'utf8')),prior=before.get(file);assert.deepEqual(Object.keys(after),Object.keys(prior));assert.equal(after.events.length,prior.events.length);
    for(let i=0;i<prior.events.length;i++){const old=prior.events[i],next=after.events[i];const reviewed=rows.some(r=>[old.id,old.eventId,old.canonicalEventId].includes(r.id)||old.id===r.canonicalId);if(!reviewed)assert.deepEqual(next,old,file+': unrelated fixture');else for(const key of Object.keys(old).filter(k=>!timing.fields.includes(k)))assert.deepEqual(next[key],old[key],file+': '+key);}
  }
  const once=new Map(targets.map(file=>[file,fs.readFileSync(path.join(temp,file))]));applySelectedTimings({root:temp});for(const [file,b]of once)assert(b.equals(fs.readFileSync(path.join(temp,file))),'stable bytes '+file);
  const missing=path.join(temp,'data/events.json'),d=JSON.parse(fs.readFileSync(missing));d.events=d.events.filter(e=>e.id!==rows[0].id);fs.writeFileSync(missing,JSON.stringify(d,null,2)+'\n');const unchanged=new Map(targets.map(file=>[file,fs.readFileSync(path.join(temp,file))]));assert.throws(()=>applySelectedTimings({root:temp}),/Missing\/duplicate/);for(const [file,b]of unchanged)assert(b.equals(fs.readFileSync(path.join(temp,file))),'failed preparation writes no document');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
if(process.argv.includes('--published')){
  for(const file of ['feeds/incoming/events.json','data/events.json','data/code-inspector/sailgp.json','data/follow-schedule/sailgp.json']){
    const doc=JSON.parse(fs.readFileSync(path.join(root,file))),events=doc.events||doc.fixtures;
    for(const row of rows){const e=events.find(e=>[e.id,e.eventId,e.canonicalEventId].includes(row.id)||e.id===row.canonicalId);assert(e,file+': missing Geneva day');assert.equal(e.startTimeUtc,row.startTimeUtc);assert.equal(e.endTimeUtc,row.endTimeUtc);assert.equal(e.timingProvenance.checkedAt,row.timingProvenance.checkedAt);assert.equal(e.resultSourceCheckedAt,'2026-09-21T20:24:10.712468Z','timing check does not refresh results');}
    const future=events.filter(e=>e.key==='sailgp'&&/(?:dubai|abu[-_]dhabi)/.test(e.id));assert.equal(future.length,4);assert(future.every(e=>!e.startTimeUtc&&e.timeTbc!==false&&e.timePrecision==='tbc'),'no future clock from event envelopes');
  }
  const code=JSON.parse(fs.readFileSync(path.join(root,'data/code-inspector/sailgp.json')));assert.equal(code.coverageStatus,'partial');assert.equal(code.fixtures.length,7);assert.equal(code.standings.length,0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'data/code-inspector/manifest.json'))).codes.find(c=>c.id==='competition:sailgp').coverageStatus,'partial');
}
console.log('SailGP reviewed clocks: validation, identity/facts/freshness retention, later-primary protection, real persistence, stable reruns, fail-before-write and partial published window passed.');
