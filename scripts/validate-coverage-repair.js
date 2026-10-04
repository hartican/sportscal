'use strict';
const assert=require('node:assert/strict'),identity=require('../config/fixture-identity'),follow=require('../config/follow-first'),actions=require('../config/event-action-identity'),policy=require('../config/follow-feed-policy');
const source=require('../data/follow-sources/coverage.v1.json').events;
const pair=['fixture:cricket:espn:1525658','fixture:cricket:CA:40593'];
for(const records of [pair,pair.slice().reverse()]){
 const merged=identity.mergeOverlays([],records.map(id=>require('./fixtures/cricket-warmup-provider-records.json').find(e=>e.id===id)));assert.equal(merged.length,1);const f=merged[0];assert.equal(f.id,pair[0]);assert.equal(f.endDate,'2026-10-04');assert.equal(f.numberOfDays,2);assert.equal(f.format,'Warm-up');assert.match(f.venue,/NWC/);assert(f.participantIds.includes('team:cricket:espn-1075499'));assert(!f.participantIds.includes('team:cricket:south-africa'));
 for(const id of pair)assert.equal(actions.resolveAction(f,{[id]:{reminderRequested:true}}).action.reminderRequested,true);
 const sides=require('../config/card-identities').matchupSidesForEvent(f);assert.equal(sides.length,2);assert(sides.find(s=>/Invitation/.test(s.label)).mark==null,'unknown opponent artwork stays neutral');
}
for(const [alias,id,time,end] of [['evt_87','fixture:cricket:espn:1525659','2026-10-09T07:30:00.000Z','2026-10-13'],['evt_88','fixture:cricket:espn:1525660','2026-10-18T08:00:00.000Z','2026-10-22'],['evt_89','fixture:cricket:espn:1525661','2026-10-27T08:30:00.000Z','2026-10-31']]){
 const event=identity.normalizeCore(source.find(e=>e.id===id));assert(event);assert.equal(event.startTimeUtc,time);assert.equal(event.endDate,end);assert.equal(identity.mergeOverlays([event],[{...event,id:alias,eventId:alias}]).length,1);assert(identity.fixtureAliases(id).includes(alias));assert(identity.fixtureAliases(id).includes(id.replace(/:/g,'-')));assert.equal(actions.resolveAction(event,{[alias]:{reminderRequested:true}}).action.reminderRequested,true);
}
const bledisloe=identity.normalizeCore(source.find(e=>e.id==='rugby-new-zealand-australia-2026-10-10'||e.id==='fixture:rugby:wr:ac4f516c-300d-4f4b-85ea-514f0be5ddf6'));
assert.equal(bledisloe.id,'rugby-new-zealand-australia-2026-10-10');assert.equal(bledisloe.startTimeUtc,'2026-10-10T06:10:00.000Z');assert.equal(bledisloe.time,'17:10');assert.match(bledisloe.venue,/Eden Park/);const publishedBledisloe=require('../data/events.json').events.find(e=>e.id===bledisloe.id);assert(publishedBledisloe.editorialNarrative?.sourceIds.length>=3,'current researched copy retains source-backed depth');assert.equal(publishedBledisloe.editorialNarrative.generationMode,'researched');assert(require('../config/editorial-locks').activeFor(bledisloe)===null,'removed historical preview lock cannot be silently reinstated');
const force=identity.normalizeCore(source.find(e=>e.id==='fixture:rugby:wr:e492d961-1f1e-4c37-b9d7-e9fd811459be'));assert(follow.reasonForEvent(force,{followedSports:['rugby']}));assert.equal(force.time,'16:30');
const brumbies=identity.normalizeCore(source.find(e=>e.id==='fixture:rugby:wr:fc92129f-3f2c-477c-8836-b1753c85ebfc'));assert.equal(brumbies.time,'14:35');assert(follow.reasonForEvent(brumbies,{preferenceGraph:{entityFollows:[{participantId:'team:rugby:brumbies',followLevel:'follow'}]}}));
const golf=require('../lib/golf-fixtures').fixtures(require('../data/canonical/pga-tour-schedule.json'));
for(const name of ['Compliance Solutions Championship','Bank of Utah Championship','BMW Australian PGA Championship'])assert(golf.some(e=>e.name===name),name);
assert.equal(golf.find(e=>/Compliance/.test(e.name)).competitionId,'competition:korn-ferry-tour');
for(const slug of ['roosters','broncos']){const mark=require('../config/card-identities').participantMarks['team:nrlw:'+slug];assert(mark?.url.includes('nrlw-'));assert(mark.id.includes(':nrlw:'));}
const dovi=require('../data/canonical/follow-directory-supplement.v1.json').sports.motogp.records.find(p=>p.id==='competitor:motogp:andrea-dovizioso');assert(dovi.profileOnly);assert.match(dovi.position,/test|advisor/i);
assert.equal(policy.isFinalsOrKnockout({key:'golf',stage:'Final round',isFinals:true}),false);assert.equal(policy.isFinalsOrKnockout({key:'tennis',competitionName:'ATP Finals',round:'Round Robin'}),false);
assert.equal(identity.normalizeCore({id:'event-afl-source',canonicalEventId:'event:afl:source'}).canonicalEventId,'event:afl:source','unrelated canonical action IDs survive');
console.log('Reported coverage, identity aliases, sourced dates, imagery and profile-only contracts passed.');

// Execute the browser's actual rating getter/setter against legacy saved aliases.
const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync('index.html','utf8');
const getter=html.slice(html.indexOf('function getActual('),html.indexOf('function actualStarValue('));
const setter=html.slice(html.indexOf('function setEventRating('),html.indexOf('function archiveEvent('));
for(const [legacy,canonical] of [['evt_87','fixture:cricket:espn:1525659'],['evt_88','fixture:cricket:espn:1525660'],['evt_89','fixture:cricket:espn:1525661'],['fixture:cricket:CA:40593','fixture:cricket:espn:1525658']]){
 const context={ratings:{[legacy]:5},NOTHINGSPORTS_FIXTURE_IDENTITY:identity,saveRatings(){},markSpoilerRevealed(){}};vm.createContext(context);vm.runInContext(getter+setter,context);assert.equal(context.getActual(canonical),5);assert.equal(context.setEventRating({id:canonical},5,{revealSpoilers:false}),true);assert.equal(context.getActual(canonical),null);assert.equal(Object.keys(context.ratings).length,0);context.ratings[legacy]=5;context.setEventRating({id:canonical},4,{revealSpoilers:false});assert.equal(context.getActual(canonical),4);assert.equal(context.ratings[legacy],undefined);
}
console.log('Legacy saved ratings remain readable, editable and removable through reviewed aliases.');
