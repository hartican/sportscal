'use strict';
const assert=require('node:assert/strict');
const {parse}=require('./refresh-f1-sessions');
const {f1Narrative}=require('./update-rolling-editorial-projections');
const relocation=require('../lib/f1-bahrain-relocation');
const context=require('../data/canonical/f1-context-2026.json');
const types=['Practice 1','Practice 2','Practice 3','Qualifying','Race'];
const html='<script type="application/ld+json">'+JSON.stringify({'@type':'SportsEvent',subEvent:types.map(type=>({name:type+' - Bahrain Grand Prix',startDate:'2026-10-04T07:00:00Z',endDate:'2026-10-04T09:00:00Z'}))})+'</script>';
const sessions=parse(html,'bahrain');
assert.equal(sessions.length,5);
for(const event of sessions){
 assert.equal(event.name,`Bahrain GP (Malaysia) · ${event.sessionType}`);
 assert.equal(event.id,`event:f1:2026:bahrain:${event.sessionType.toLowerCase().replaceAll(' ','-')}`);
 const card={...event,key:'f1'},narrative=f1Narrative(card,context,new Date());
 assert(narrative.safeSynopsis.includes(relocation.officialTitle));
 assert(narrative.safeSynopsis.includes('safety concerns over regional conflict'));
 assert(narrative.extraSources.some(s=>s.id==='source:f1:bahrain-safety-2026'));
 assert(narrative.facts.every(f=>f.statement.length<=320));
 assert.equal(require('../lib/f1-venues').enrich(card).name,event.name);
}
assert(!relocation.applies({key:'f1',id:'evt_f1_2026_bahrain_race',date:'2026-04-12'}));
assert.equal(relocation.title(relocation.title('Bahrain GP · Race')),'Bahrain GP (Malaysia) · Race');
console.log('Bahrain relocation: all five session names, stable IDs, sourced editorial and historical isolation passed.');
