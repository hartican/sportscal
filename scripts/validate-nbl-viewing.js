#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {viewingFor}=require('./refresh-nbl-schedule');
const {cardForEvent}=require('./sync-requested-sports-to-feed');
const follow=require('../config/follow-first');
const schedule=require('../data/canonical/nbl-2026-27.json');
const at='2026-09-27T17:30:00Z';
const base={primary_broadcaster:{label:'ESPN on Disney'}};
for(const label of ['9Now','9Go 9Now']){
 const options=viewingFor({...base,secondary_broadcaster:{label}},at);
 assert.deepEqual(options.map(o=>o.providerId),['nine','disney','kayo','foxtel']);
 const event={...schedule.events[0],viewingOptions:options};
 const card=cardForEvent(event,schedule,new Map(schedule.participants.map(p=>[p.id,p])));
 const resolved=follow.viewingOptions(card);
 assert.equal(resolved[0].providerId,'nine');assert.equal(resolved[0].paid,false);
 assert.equal(resolved[0].linkScope,'sport');assert.equal(resolved[0].replayVerified,false);
 assert.equal(resolved[1].webUrl,'https://www.disneyplus.com/en-au');
 assert.deepEqual(card.viewingOptions,options,'source options survive card projection');
}
assert.deepEqual(viewingFor(base,at).map(o=>o.providerId),['disney','kayo','foxtel']);
for(const label of [undefined,'Nine highlights','9Nowhere','Sky Sport NZ'])assert(!viewingFor({secondary_broadcaster:{label}},at).some(o=>o.providerId==='nine'),'no invented free entitlement');
assert.deepEqual(viewingFor({},at),[],'absent source labels are unknown');
const {patchKnown,nblProjectionSteps}=require('./quick-results');
const steps=nblProjectionSteps(['NBL 1']);
assert.equal(steps.find(s=>s[0]==='scripts/publish-feed.js')[1],'data/events.json','scoped refresh cannot replace unrelated current facts with older incoming records');
assert(steps.some(s=>s[0]==='scripts/validate-current-card-coverage.js'),'existing release integrity gate retained');
assert(!steps.some(s=>s[0]==='scripts/select-result-editorial.js'),'viewing-only patch must not regenerate unrelated editorial');
assert.deepEqual(nblProjectionSteps([]),[],'no source change avoids publication work');
const before={id:'nbl-test',status:'upcoming',viewingOptions:viewingFor(base,at)};
const added={...before,viewingOptions:viewingFor({...base,secondary_broadcaster:{label:'9Now'}},at)};
assert.equal(patchKnown([before],[added]).count,1,'broadcast-only changes survive quick refresh');
assert.equal(patchKnown([added],[{...added,viewingOptions:viewingFor({...base,secondary_broadcaster:{label:'9Now'}},'2026-09-28T17:30:00Z')}]).count,0,'observation-only changes cause no feed churn');
assert.equal(patchKnown([added],[before]).events[0].viewingOptions.some(o=>o.providerId==='nine'),false,'withdrawn free coverage is removed');
if(process.argv.includes('--published')){
 const expected=new Map(schedule.events.map(e=>[e.id,e.viewingOptions]));
 assert.equal(expected.size,165);
 for(const folder of ['code-inspector','follow-schedule']){
  const fixtures=require(`../data/${folder}/nbl.json`).fixtures;
  for(const f of fixtures){assert.deepEqual(f.viewingOptions,expected.get(f.id),`${folder}: preserve fixture evidence`);}
 }
 assert([...expected.values()].some(o=>o?.some(v=>v.providerId==='nine')));
 assert([...expected.values()].some(o=>!o?.some(v=>v.providerId==='nine')));
}
console.log('NBL viewing: fixture-specific free access, paid alternatives, missing labels and honest replay/destination scope passed.');
