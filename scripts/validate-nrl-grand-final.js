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
 if(process.argv.includes('--published')){assert.match(e.editorialNarrative.hook,/wooden spooners/);assert.match(e.editorialNarrative.closingCopy,/Smith/);assert.match(e.editorialNarrative.closingCopy,/Cherry-Evans/);assert.match(e.editorialNarrative.formCopy,/36–20/);assert.match(e.editorialNarrative.formCopy,/22–14/);assert(!/Sydney time|Queensland|9Now/.test(e.editorialNarrative.formCopy),'Form is sporting performance only');assert(e.editorialNarrative.dimensions.includes('form'));assert.match(e.editorialNarrative.synopsis,/7:30pm Sydney time/,'existing useful context retained');}
 return e;
}
check(programme,'resolver');
const identity=require('../config/fixture-identity'),timing=require('../config/card-timing');
const confirmed=programme.find(e=>alias(e).includes('evt_84'));
const retained={...confirmed,startTimeUtc:null,time:null,timeTbc:true,startTimeTbc:true,dateOnly:true,timePrecision:'date-only'};
const observation={...confirmed};for(const field of ['timeTbc','startTimeTbc','dateOnly'])delete observation[field];
const reconciled=identity.mergeOverlays([retained],[observation])[0];
for(const update of [{...observation,timeTbc:true},{...observation,dateOnly:true},{...observation,timePrecision:'unknown',timeTbc:true}])assert.equal(timing.presentation(identity.mergeOverlays([retained],[update])[0],new Date('2026-10-01T00:00:00Z')).time,'TIME TBC','explicit uncertainty remains conservative');
assert.equal(timing.presentation(reconciled,new Date('2026-10-01T00:00:00Z')).time,'7:30 PM','confirmed kickoff replaces retained TBC flags in the real overlay path');
assert.equal(reconciled.id,confirmed.id,'timing repair keeps saved-action identity');

if(process.argv.includes('--published'))for(const file of ['feeds/incoming/events.json','data/events.json','data/follow-schedule/nrl.json']){const d=require('../'+file);check(d.events||d.fixtures,file);}
// Reproduce the public API's contradictory observation: the provider updated
// the exact start but retained the old date-only metadata in its saved snapshot.
const liveObservation={...confirmed,dateOnly:true,schedulePrecision:'date-only',timeTbc:false,startTimeTbc:false};
const liveMerged=identity.mergeOverlays([confirmed],[liveObservation])[0];
assert.equal(timing.presentation(liveMerged,'2026-10-01T00:00:00Z').time,'7:30 PM','a live API observation cannot restore stale date-only metadata over confirmed exact timing');
assert.equal(identity.normalizeCore(liveObservation).dateOnly,false,'normalise contradictory persisted observations even without a prior card');
for(const update of [{...liveObservation,timeTbc:true},{...liveObservation,startTimeTbc:true},{...liveObservation,timePrecision:'date-only'},{...liveObservation,scheduleStatus:'provisional'},{...liveObservation,startTimeUtc:null}])assert.equal(timing.presentation(identity.normalizeCore(update),'2026-10-01T00:00:00Z').time,'TIME TBC','new uncertainty, provisional dates and absent sporting times remain conservative');

const start=new Date('2026-10-04T08:30:00Z');
for(const [zone,time] of [['Australia/Sydney','19:30'],['Australia/Brisbane','18:30']])assert.equal(new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(start),time);
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const preferences={selectedSelectorEntityIds:['sport:nrl-premiership'],followedSports:['nrl'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:nrl-premiership',enabled:true}]}};
const feed=buildServerFeed({events:programme,userId:'grand-final-qa',userState:{preferences},now:new Date('2026-09-27T14:00:00Z')});assert(feed.events.some(e=>alias(e).includes('evt_84')),'Grand Final reaches existing NRL follower');
console.log('NRL Grand Final: canonical identity, confirmed clubs, DST-correct kickoff, sourced Nine-only live viewing and followed Feed admission passed.');
