'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const follow=require('../config/follow-first'),policy=require('../config/follow-feed-policy'),reminders=require('../config/fixture-reminder-policy');
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const taxonomy=require('../config/selector-taxonomy'),registry=require('../config/sport-domain-registry');
const source=JSON.parse(fs.readFileSync('data/events.json'));
const races=(Array.isArray(source)?source:source.events).filter(e=>e.key==='horse-racing');
const now=new Date('2026-10-13T00:00:00Z');
const on=follow.migratePreferences({selectedSelectorEntityIds:['sport:horse-racing'],followedSports:['horse-racing']});
assert(taxonomy.exposedSportNodes.some(e=>e.id==='sport:horse-racing'));
assert.equal(registry.selectorLibrary()['horse-racing'].domainId,'sport:horse-racing');
assert.equal(races.length,9,'Existing approved dated catalogue remains unchanged');
function check(event,prefs,expected,label){
 assert.equal(Boolean(follow.reasonForEvent(event,prefs)),expected,'browser policy: '+label);
 const result=buildServerFeed({events:[event],userId:'horse-follow-contract',userState:{preferences:prefs},now});
 assert.equal(result.events.some(e=>e.id===event.id),expected,'server policy: '+label);
}
for(const race of races){
 check(race,on,true,'explicit feature-race sport follow: '+race.name);
 check(race,{},false,'browsing is not consent: '+race.name);
 check(race,{selectedSelectorEntityIds:[],followedSports:[]},false,'later unfollow: '+race.name);
 check(race,{...on,preferenceGraph:{...on.preferenceGraph,competitionPreferences:[{competitionId:race.competitionId,enabled:false}]}},false,'competition exclusion: '+race.name);
 assert.equal(reminders.automatic({...race,startTimeUtc:'2026-10-17T06:00:00Z',time:'17:00',timingPrecision:'exact'},on,{},+now),false,'Even a future published race clock cannot turn a sport follow into athlete/team automatic consent');
 assert.equal(reminders.automatic(race,on,{},+now),false,'A sport follow cannot create an automatic reminder');
 assert.equal(reminders.intent(race,on,{[race.id]:{reminderChoice:'off'}},{},+now).enabled,false,'Explicit fixture reminder OFF stays OFF');
}
check({...races[0],horseFeature:false},on,false,'ordinary supporting race is outside the feature catalogue');
check({...races[0],id:'event:horse-racing:unapproved:2026',canonicalEventId:'event:horse-racing:unapproved:2026',horseFeature:true},on,false,'A flag cannot expand the approved feature list');
check({...races[0],date:null,dateOnly:true},on,false,'unpublished date cannot enter Feed');
const identity=require('../config/fixture-identity');
for(const f of JSON.parse(fs.readFileSync('data/code-inspector/horse-racing.json')).fixtures){
 const fixture=identity.fromSchedule(f,'horse-racing');assert.equal(policy.eligibleForFollow(fixture,{sportFollow:true}),true,'Existing compact Schedule identity retains feature admission without optional flags');
}
const pending=JSON.parse(fs.readFileSync('data/event-overviews.v1.json')).events.filter(e=>e.sportKey==='horse-racing'&&e.calendarPending);
assert.equal(pending.length,3);
for(const e of pending)assert(!e.date&&!e.startTimeUtc,'Pending editions retain unknown timing');
assert.deepEqual(follow.migratePreferences(on),on,'Explicit preference survives offline normalization/retries');
assert(!follow.migratePreferences({}).selectedSelectorEntityIds.includes('sport:horse-racing'),'No onboarding or existing-account automatic opt-in');
console.log('Horse Follow: actual nine-race browser/server parity, explicit consent/unfollow/exclusions, pending dates and no automatic reminders passed.');
