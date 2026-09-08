'use strict';
const assert=require('node:assert/strict'),identity=require('../config/fixture-identity');
const fixtures=require('../data/code-inspector/nrl.json').fixtures.filter(e=>/final-\d$/.test(e.id)&&e.scheduleStatus==='confirmed');assert.equal(fixtures.length,4);
for(const fixture of fixtures){
 const stale={id:fixture.id,name:'Elimination Final 1 - 5th v 8th',date:'',time:null,venue:null,scheduleStatus:'provisional',participantIds:[],participantSlots:[{label:'5th'},{label:'8th'}]};
 const merged=identity.mergeOverlays([fixture],[stale])[0];assert.equal(merged.name,fixture.name,'stale live placeholder cannot replace named final');assert.equal(merged.date,fixture.date);assert.equal(merged.time,fixture.time);assert.deepEqual(merged.participantSlots,fixture.participantSlots);
 assert.equal(identity.mergeOverlays([fixture],[{id:fixture.id,status:'postponed',date:'2026-09-20'}])[0].status,'postponed','real schedule changes still apply');
 assert.equal(identity.mergeOverlays([fixture],[{id:fixture.id,status:'finished',result:{score:'24-10'}}])[0].status,'finished','live results still apply');
}
console.log('All four NRL week-one finals survive legacy provisional overlays; schedule changes and results remain live.');
