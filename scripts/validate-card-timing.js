#!/usr/bin/env node
'use strict';
require('./validate-card-time-format-reuse');
const assert=require('node:assert/strict');
const {presentation:p}=require('../config/card-timing');
const {dateOnlyLabel}=require('../config/card-timing');
require('./validate-publisher-planning-times');
require('./validate-played-starts');
require('./validate-useful-starts');
require('./validate-cricket-compact-summary');
assert.equal(dateOnlyLabel({eventType:'match',dateOnly:true}),'Time TBD','A dated single match cannot claim multiple session times');
assert.equal(dateOnlyLabel({cardType:'golf_tournament',dateOnly:true}),'Session times vary');
assert.equal(dateOnlyLabel({eventType:'match',status:'completed'}),'Completed');
assert.equal(dateOnlyLabel({timingProvenance:{precision:'venue-calendar'}}),'Time TBD');
const now='2026-09-21T14:30:00Z'; // Tuesday 00:30 Sydney
const fixture={date:'2026-09-25',startTimeUtc:'2026-09-24T16:30:00Z'};
assert.equal(p(fixture,now).label,'FRI 2:30 AM');
assert.equal(p({...fixture,startTimeUtc:'2026-09-21T16:30:00Z'},now).label,'TODAY 2:30 AM');
assert.equal(p({...fixture,startTimeUtc:'2026-09-27T16:30:00Z'},now).label,'MON 2:30 AM');
assert.equal(p({...fixture,startTimeUtc:'2026-09-28T16:30:00Z'},now).label,'TUE 29 SEP · 2:30 AM');
assert.match(p({...fixture,startTimeUtc:'2027-01-01T15:30:00Z'},now).label,/2027/);
assert.equal(p({...fixture,startTimeUtc:'2026-10-03T15:30:00Z'},'2026-10-03T14:30:00Z').label,'TODAY 1:30 AM');
assert.equal(p({...fixture,startTimeUtc:'2026-10-03T16:30:00Z'},'2026-10-03T14:30:00Z').label,'TODAY 3:30 AM');
assert.equal(p({...fixture,startTimeUtc:'2026-10-09T15:30:00Z'},'2026-10-03T14:30:00Z').label,'SAT 2:30 AM','DST must not shift calendar-day boundary');
for(const [status,label] of [['live','LIVE'],['completed','FINISHED'],['final','FINISHED'],['postponed','POSTPONED'],['canceled','CANCELLED'],['abandoned','ABANDONED'],['suspended','PLAY SUSPENDED']]){
 const value=p({...fixture,status},now);assert.equal(value.label,label);assert.match(value.fullSchedule,/FRI 25 SEP/);assert.match(value.ariaLabel,/Sydney time/);
}
assert.equal(p({...fixture,status:'live',scheduleStatus:'postponed'},now).label,'POSTPONED');
assert.equal(p({...fixture,status:'completed',scheduleStatus:'cancelled'},now).label,'CANCELLED');
assert.notEqual(p(fixture,'2026-10-01T00:00:00Z').label,'FINISHED','elapsed time is not completion evidence');
assert.notEqual(p(fixture,'2026-09-24T17:00:00Z').label,'LIVE','elapsed time alone is not live evidence');
assert.equal(p({...fixture,timeTbc:true},now).label,'FRI TIME TBD');
assert.equal(p({...fixture,timePrecision:'follows'},now).label,'FRI FOLLOWS PRIOR MATCH');
assert.equal(p({...fixture,timePrecision:'estimated',estimatedStartTimeUtc:'2026-09-24T17:30:00Z'},now).label,'FRI APPROX. 3:30 AM');
assert.equal(p({...fixture,dateOnly:true},now).label,'FRI TIME TBD');
assert.equal(p({...fixture,dateOnly:true,endDate:'2026-09-28'},now).label,'FRI 25 SEP – MON 28 SEP · TIME TBD');
assert.equal(p({date:'2026-09-25'},now).label,'FRI TIME TBD');
assert.equal(p({},now).label,'DATE UNAVAILABLE · TIME TBD');
assert.equal(p({...fixture,broadcasts:[{startTimeUtc:'2026-09-24T15:30:00Z'}]},now).label,'FRI 2:30 AM');
assert.equal(p({...fixture,timePrecision:'unconfirmed'},now).label,'FRI TIME TBD');
const notBefore={...fixture,timePrecision:'not-before'};
assert.equal(p(notBefore,now).label,'FRI NOT BEFORE 2:30 AM');
assert.match(p(notBefore,now).ariaLabel,/NOT BEFORE 2:30 AM.*Sydney time/);
assert.equal(p({...notBefore,date:'2026-10-04',startTimeUtc:'2026-10-03T16:30:00Z'},'2026-10-03T14:30:00Z').label,'NOT BEFORE 3:30 AM','not-before uses the real Sydney DST offset');
for(const uncertain of [{timeTbc:true},{startTimeTbc:true},{dateOnly:true},{startTimeUtc:'invalid'},{startTimeUtc:null}]){
  const value=p({...notBefore,...uncertain},now);assert(!value.time.includes('NOT BEFORE'),'uncertain instant cannot manufacture a qualified clock');assert.equal(value.time,'TIME TBD');
}
assert.equal(p({...notBefore,status:'postponed'},now).label,'POSTPONED');
assert.equal(p({...notBefore,status:'completed'},now).label,'FINISHED');
assert.notEqual(p(notBefore,'2026-10-01T00:00:00Z').label,'FINISHED','not-before does not create a completion status');
assert.equal(p({...fixture,featuredSubjects:[{id:'driver:one'},{id:'driver:two'}]},now).label,p(fixture,now).label);
console.log('Card timing: calendar boundaries, DST, source status, uncertainty and sporting-start semantics passed.');
require('./validate-compact-fixture-status')();
require('./validate-card-context')();
require('./validate-minimised-cards');

assert.equal(dateOnlyLabel({displayTime:"Time TBC"}),"Time TBD","Old cached timing labels render using TBD");

// Display qualifications do not rewrite the sporting or planned-start facts.
function validateMatchCentreQualifications(){
const assert=require('node:assert/strict'),badge=require('../config/card-timing').badgePresentation,repairNow='2026-10-19T18:35:00Z';
const observedLive={id:'controlled:status-qualification',key:'cricket',date:'2026-10-18',startTimeUtc:'2026-10-18T08:00:00Z',status:'live',statusCheckedAt:'2026-10-19T18:34:00Z'};
for(const stale of [{stale:true},{sourceStale:true}]){
 const event={...observedLive,...stale},before=JSON.stringify(event),value=badge(event,repairNow);
 assert.equal(value.badgeStatus,'LAST REPORTED LIVE');assert.equal(value.badgeFreshness,'Awaiting update');assert.equal(JSON.stringify(event),before);
}
assert.equal(badge(observedLive,repairNow).badgeStatus,'LIVE','Fresh explicit live observations remain live');
assert.equal(badge({...observedLive,status:'suspended',statusText:'Lightning',stale:true},repairNow).status,'PLAY SUSPENDED · LIGHTNING','Staleness does not erase a confirmed interruption');
const terminalFixture=require('../data/code-inspector/football.json').fixtures.find(e=>e.id==='event:football:a-league-men:401892162');
assert(terminalFixture,'Retained A-League terminal regression identity exists');
const terminalBefore=JSON.stringify(terminalFixture),terminalBadge=badge(terminalFixture,repairNow);
assert.equal(terminalBadge.status,'FINISHED');assert.equal(terminalBadge.badgeClock,'','A finished capsule does not advertise a scheduled start');
assert.match(terminalBadge.fullSchedule,/SCHEDULED 8:00 PM/,'Historical planned kickoff stays available with its qualification');
assert.equal(JSON.stringify(terminalFixture),terminalBefore);
console.log('Match Centre qualifications: fresh/stale live, retained interruption and finished badge with original planned support passed.');
}
validateMatchCentreQualifications();
require('./validate-cricket-timing-corrections');
require('./validate-cricket-schedule-day');
