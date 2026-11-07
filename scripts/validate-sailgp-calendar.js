#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {validate,eventsFor,apply,refresh}=require('./refresh-sailgp-calendar');
const {cardForEvent,mergeSailgpCard}=require('./sync-requested-sports-to-feed');
const docs=[2026,2027].map(y=>require(`../feeds/provider-exports/sailgp/calendar-${y}.v1.json`));
const now=new Date('2026-10-03T00:00:00Z'),clone=v=>JSON.parse(JSON.stringify(v));
const old=require('../data/canonical/fiba-women-sailgp-motogp-2026.json');
for(const mutate of [d=>d.races.pop(),d=>d.collectionId='mixed-year',d=>d.races[1]=d.races[0],d=>d.races[0].startDateTime='2025-01-17T13:00+08:00',d=>d.races[0].raceDays[0].startDateTime='2026-12-01T13:00+08:00']){const bad=clone(docs[0]);mutate(bad);assert.throws(()=>validate(bad));}
const current=eventsFor(docs[0],now),future=eventsFor(docs[1],now);
assert.equal(current.length,26);assert.equal(new Set(current.map(e=>e.weekendId)).size,13);
assert.equal(future.length,20);assert(future.every(e=>e.timeTbc&&!e.startTimeUtc&&!e.participantIds.length&&e.participantsConfirmed===false));
assert(!future.some(e=>/grand-final|rio|dubai/.test(e.weekendId)),'outside horizon and unconfirmed finale are not expanded');
assert.equal(current.find(e=>e.id==='event:sailgp:2026:new-york-day-1').timeTbc,true,'missing historical clock is not inferred from an envelope');
const next=apply(old,docs,now);assert.deepEqual(next.events.filter(e=>e.sportKey!=='sailgp'),old.events.filter(e=>e.sportKey!=='sailgp'));
for(const e of old.events.filter(e=>e.sportKey==='sailgp')){const n=next.events.find(n=>n.id===e.id);for(const k of ['id','date','time','timeTbc','startTimeUtc','endTimeUtc','timingProvenance','sourceId','sourceCheckedAt','hook','context','participantIds',...(e.result?['result']:[])])assert.deepEqual(n[k],e[k],'retained '+e.id+' '+k);}
assert.deepEqual(apply(next,docs,now),next,'identical reviewed rerun does not renew observations');
const drift=clone(docs);drift[0].races.find(r=>r.locationName==='Dubai').startDateTime='2026-11-20T13:00+04:00';assert.throws(()=>apply(old,drift,now));
const fresh=cardForEvent(future[0],next,new Map(next.participants.map(p=>[p.id,p])));assert.equal(fresh.participantsConfirmed,false);assert(!fresh.participantIds?.length);
assert.deepEqual(require('../config/follow-first').viewingOptions(fresh),[],'2026 broadcast provenance cannot establish 2027 rights');
const observed={...fresh,score:'Real retained result',status:'completed',sourceCheckedAt:'2026-01-01T00:00:00Z',storyline:{hookSpoilerOff:'Retained research'},resultSourceCheckedAt:'2026-01-02T00:00:00Z',unknownProviderFact:123};
const merged=mergeSailgpCard(fresh,observed);for(const k of ['score','status','sourceCheckedAt','storyline','resultSourceCheckedAt','unknownProviderFact','id'])assert.deepEqual(merged[k],observed[k]);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-sailgp-calendar-'));
try{const file=path.join(temp,'data/canonical/fiba-women-sailgp-motogp-2026.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(old));const before=fs.readFileSync(file);assert.throws(()=>refresh({root:temp,now,documents:[{...docs[0],races:[]}]}));assert(before.equals(fs.readFileSync(file)),'bad source fails before any canonical write');refresh({root:temp,now,documents:docs});const once=fs.readFileSync(file);refresh({root:temp,now,documents:docs});assert(once.equals(fs.readFileSync(file)));}finally{fs.rmSync(temp,{recursive:true,force:true});}
if(process.argv.includes('--published')){
 for(const file of ['../feeds/incoming/events.json','../data/events.json']){const cards=require(file).events.filter(e=>e.key==='sailgp');assert.equal(cards.length,old.sailgpCalendarCoverage.raceDayCount);assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);assert(cards.every(c=>c.venueCountryCode&&c.venueCaption.includes('Course unverified')));assert(cards.filter(c=>c.season==='2027').every(c=>c.participantsConfirmed===false&&!c.participantIds?.length&&c.timeTbc&&!c.startTimeUtc));}
 const parents=require('../lib/event-overviews').build(require('../data/events.json').events).filter(e=>e.sportKey==='sailgp');assert.equal(parents.length,new Set(old.events.filter(e=>e.sportKey==='sailgp').map(e=>e.weekendId)).size);assert(parents.every(e=>e.fixtureIds.length===2));
}
// Use the existing pending-result provenance contract, as MotoGP does. Calendar
// evidence establishes completion and the unavailable-result notice, no winner.
const completed=current.filter(e=>e.status==='completed').map(e=>cardForEvent(e,next,new Map()));
assert(completed.every(e=>e.resultStatus==='pending'&&e.resultSourceUrl&&e.resultSourceCheckedAt&&!e.score&&!e.outcomeText));
assert(completed.every(e=>e.storyline.hookSpoilerOn==='Result coverage is unavailable for this session.'));
const checkDir=fs.mkdtempSync(path.join(os.tmpdir(),'ns-sailgp-results-'));
try{const input=path.join(checkDir,'events.json');fs.writeFileSync(input,JSON.stringify({events:completed}));const run=()=>require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'verify-result-completeness.js'),input],{encoding:'utf8'});assert.equal(run().status,0,'calendar-only completed days have explicit unavailable-result provenance');delete completed[0].resultSourceUrl;fs.writeFileSync(input,JSON.stringify({events:completed}));assert.equal(run().status,1,'missing provenance still fails the unchanged release gate');}finally{fs.rmSync(checkDir,{recursive:true,force:true});}
console.log('SailGP: 13 current events / 26 days, 10 future weekends / 20 days, edition/TBC/horizon, stable identities/facts, no future roster inference, fail-before-write and unchanged replay passed.');
