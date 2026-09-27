'use strict';
const assert=require('node:assert/strict'),identity=require('../config/fixture-identity');
const reviewed=require('../data/canonical/nrl-finals-published-2026.json').events;
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
const fixtures=require('../data/code-inspector/nrl.json').fixtures.filter(e=>reviewed.some(r=>aliases(e).includes(r.id))&&e.scheduleStatus==='confirmed');
for(const event of reviewed)assert(fixtures.some(f=>aliases(f).includes(event.id)),'every reviewed final must be confirmed in Schedule');
for(const fixture of fixtures){
 const stale={id:fixture.id,name:'Elimination Final 1 - 5th v 8th',date:'',time:null,venue:null,scheduleStatus:'provisional',participantIds:[],participantSlots:[{label:'5th'},{label:'8th'}]};
 const merged=identity.mergeOverlays([fixture],[stale])[0];assert.equal(merged.name,fixture.name,'stale live placeholder cannot replace named final');assert.equal(merged.date,fixture.date);assert.equal(merged.time,fixture.time);assert.deepEqual(merged.participantSlots,fixture.participantSlots);
 const scheduled={...fixture,status:'upcoming'};
 assert.equal(identity.mergeOverlays([scheduled],[{id:fixture.id,status:'postponed',date:'2026-09-20',statusCheckedAt:'2030-01-01T00:00:00Z'}])[0].status,'postponed','new explicit schedule changes still apply to upcoming fixtures');
 if(fixture.status==='completed')assert.equal(identity.mergeOverlays([fixture],[{id:fixture.id,status:'postponed'}])[0].status,'completed','an unverified overlay cannot reopen a completed result');
 assert.equal(identity.mergeOverlays([fixture],[{id:fixture.id,status:'finished',result:{score:'24-10'}}])[0].status,'finished','live results still apply');
}
console.log(`${fixtures.length} confirmed NRL finals survive legacy provisional overlays; schedule changes and results remain live.`);
