'use strict';
const assert=require('node:assert/strict'),follow=require('../config/follow-first');
const programme=require('../lib/competition-fixtures').fixtures();
const alias=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
function check(events,label){
 const matches=events.filter(e=>alias(e).includes('evt_84')||alias(e).includes('major-match:nrl-finals-2026:grand-final'));
 assert.equal(matches.length,1,`${label}: one Grand Final with saved-action identity`);
 const e=matches[0];assert.equal(e.name,'Roosters v Knights');assert.equal(e.startTimeUtc,'2026-10-04T08:30:00.000Z');assert.equal(e.time,'19:30');assert.equal(e.venue,'Accor Stadium');
 assert.deepEqual(e.participantIds,['team:nrl:331','team:nrl:325']);
 const providers=follow.viewingOptions(e);assert.deepEqual(providers.map(p=>p.providerId),['nine-tv','nine']);assert(providers.every(p=>p.sourceUrl?.includes('nineforbrands')&&!p.paid));
 assert(!/winner of PF|routes remain open|qualifying winners|Penrith hosts/i.test(JSON.stringify(e.editorialNarrative||{})),`${label}: no stale bracket editorial`);
 return e;
}
check(programme,'resolver');
if(process.argv.includes('--published'))for(const file of ['feeds/incoming/events.json','data/events.json','data/follow-schedule/nrl.json']){const d=require('../'+file);check(d.events||d.fixtures,file);}
const start=new Date('2026-10-04T08:30:00Z');
for(const [zone,time] of [['Australia/Sydney','19:30'],['Australia/Brisbane','18:30']])assert.equal(new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(start),time);
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const preferences={selectedSelectorEntityIds:['sport:nrl-premiership'],followedSports:['nrl'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:nrl-premiership',enabled:true}]}};
const feed=buildServerFeed({events:programme,userId:'grand-final-qa',userState:{preferences},now:new Date('2026-09-27T14:00:00Z')});assert(feed.events.some(e=>alias(e).includes('evt_84')),'Grand Final reaches existing NRL follower');
console.log('NRL Grand Final: canonical identity, confirmed clubs, DST-correct kickoff, sourced Nine-only live viewing and followed Feed admission passed.');
