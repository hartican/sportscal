'use strict';
const assert=require('node:assert/strict');
const {fixtures}=require('../lib/competition-fixtures');
const expected=[
 {id:'major-match:nrl-finals-2026:preliminary-final-2',name:'Dolphins v Roosters',date:'2026-09-25',time:'19:50',start:'2026-09-25T09:50:00.000Z',venue:'Suncorp Stadium',teams:['team:nrl:9538','team:nrl:331']},
 {id:'major-match:nrl-finals-2026:preliminary-final-1',name:'Panthers v Knights',date:'2026-09-27',time:'16:00',start:'2026-09-27T06:00:00.000Z',venue:'Accor Stadium',teams:['team:nrl:329','team:nrl:325']}
];
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
const programme=fixtures();
// A regular-season-only provider must not leave current finals as hidden
// week placeholders. Stop the refresh for reviewed official schedule updates.
function unresolvedDueFinals(events, today){return events.filter(e=>e.key==='nrl'&&e.schedulePrecision==='week'&&e.weekAnchorDate&&e.weekAnchorDate<=today&&!e.startTimeUtc);}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
assert.deepEqual(unresolvedDueFinals(programme,today),[], 'NRL finals week has arrived: resolve teams and schedule from official announcements');
assert.equal(unresolvedDueFinals([{key:'nrl',schedulePrecision:'week',weekAnchorDate:'2026-09-21'}],'2026-09-22').length,1);
assert.equal(unresolvedDueFinals([{key:'nrl',schedulePrecision:'week',weekAnchorDate:'2026-09-28'}],'2026-09-22').length,0);
for(const item of expected){const e=programme.find(e=>e.id===item.id);assert(e);assert.equal(e.name,item.name);assert.equal(e.startTimeUtc,item.start);assert.deepEqual(e.participantIds,item.teams);assert.equal(e.schedulePrecision,'exact');}
if(process.argv.includes('--published'))for(const file of ['../feeds/incoming/events.json','../data/events.json','../data/follow-schedule/nrl.json']){
 const doc=require(file),list=doc.events||doc.fixtures;
 for(const item of expected){const matches=list.filter(e=>aliases(e).includes(item.id));assert.equal(matches.length,1,`${file}: one canonical ${item.name}`);const e=matches[0];assert.equal(e.name,item.name);assert.equal(e.date,item.date);assert.equal(e.time,item.time);assert.equal(e.startTimeUtc,item.start);assert.equal(e.venue,item.venue);assert.deepEqual(e.participantIds,item.teams);assert(!/winner of|teams.*pending|seeding still/i.test(JSON.stringify(e.editorialNarrative||{})),`${file}: resolved fixture has current editorial`);}
}
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const preferences={selectedSelectorEntityIds:['sport:nrl-premiership'],followedSports:['nrl'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:nrl-premiership',enabled:true}]}};
const feed=buildServerFeed({events:programme,userId:'nrl-prelims-regression',userState:{preferences},now:new Date('2026-09-22T08:30:00Z')});
for(const item of expected)assert(feed.events.some(e=>aliases(e).includes(item.id)),`${item.name} must reach an NRL follower's Feed`);
console.log('NRL preliminary finals: confirmed teams/times/venues, stable bracket IDs, no duplicates and followed Feed admission passed.');
