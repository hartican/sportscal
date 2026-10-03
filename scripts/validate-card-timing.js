#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {presentation:p}=require('../config/card-timing');
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
for(const [status,label] of [['live','LIVE'],['completed','FINISHED'],['final','FINISHED'],['postponed','POSTPONED'],['canceled','CANCELLED'],['abandoned','ABANDONED'],['suspended','SUSPENDED']]){
 const value=p({...fixture,status},now);assert.equal(value.label,label);assert.match(value.fullSchedule,/FRI 25 SEP/);assert.match(value.ariaLabel,/Sydney time/);
}
assert.equal(p({...fixture,status:'live',scheduleStatus:'postponed'},now).label,'POSTPONED');
assert.equal(p({...fixture,status:'completed',scheduleStatus:'cancelled'},now).label,'CANCELLED');
assert.notEqual(p(fixture,'2026-10-01T00:00:00Z').label,'FINISHED','elapsed time is not completion evidence');
assert.notEqual(p(fixture,'2026-09-24T17:00:00Z').label,'LIVE','elapsed time alone is not live evidence');
assert.equal(p({...fixture,timeTbc:true},now).label,'FRI TIME TBC');
assert.equal(p({...fixture,timePrecision:'follows'},now).label,'FRI FOLLOWS PRIOR MATCH');
assert.equal(p({...fixture,timePrecision:'estimated',estimatedStartTimeUtc:'2026-09-24T17:30:00Z'},now).label,'FRI APPROX. 3:30 AM');
assert.equal(p({...fixture,dateOnly:true},now).label,'FRI TIME TBC');
assert.equal(p({...fixture,dateOnly:true,endDate:'2026-09-28'},now).label,'FRI 25 SEP – MON 28 SEP · TIME TBC');
assert.equal(p({date:'2026-09-25'},now).label,'FRI TIME TBC');
assert.equal(p({},now).label,'DATE TBC · TIME TBC');
assert.equal(p({...fixture,broadcasts:[{startTimeUtc:'2026-09-24T15:30:00Z'}]},now).label,'FRI 2:30 AM');
assert.equal(p({...fixture,timePrecision:'unconfirmed'},now).label,'FRI TIME TBC');
const notBefore={...fixture,timePrecision:'not-before'};
assert.equal(p(notBefore,now).label,'FRI NOT BEFORE 2:30 AM');
assert.match(p(notBefore,now).ariaLabel,/NOT BEFORE 2:30 AM.*Sydney time/);
assert.equal(p({...notBefore,date:'2026-10-04',startTimeUtc:'2026-10-03T16:30:00Z'},'2026-10-03T14:30:00Z').label,'TODAY NOT BEFORE 3:30 AM','not-before uses the real Sydney DST offset');
for(const uncertain of [{timeTbc:true},{startTimeTbc:true},{dateOnly:true},{startTimeUtc:'invalid'},{startTimeUtc:null}]){
  const value=p({...notBefore,...uncertain},now);assert(!value.time.includes('NOT BEFORE'),'uncertain instant cannot manufacture a qualified clock');assert.equal(value.time,'TIME TBC');
}
assert.equal(p({...notBefore,status:'postponed'},now).label,'POSTPONED');
assert.equal(p({...notBefore,status:'completed'},now).label,'FINISHED');
assert.notEqual(p(notBefore,'2026-10-01T00:00:00Z').label,'FINISHED','not-before does not create a completion status');
assert.equal(p({...fixture,featuredSubjects:[{id:'driver:one'},{id:'driver:two'}]},now).label,p(fixture,now).label);
console.log('Card timing: calendar boundaries, DST, source status, uncertainty and sporting-start semantics passed.');
