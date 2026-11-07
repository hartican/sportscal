'use strict';
const assert=require('node:assert/strict'),lifecycle=require('../config/card-lifecycle'),pipeline=require('../lib/server-feed-pipeline'),epic=require('../config/epic-classics');
const cricket=require('../data/code-inspector/cricket.json').fixtures,test=cricket.find(f=>f.id==='fixture:cricket:espn:1528712');assert(test);
const endDay=lifecycle.sydneyEndOfDay(test.endDate),expiry=new Date(+endDay+7*86400000+1);
for(const input of [test,pipeline.normalizeEvent(test,new Date('2026-12-20T00:00Z'))])assert.equal(+lifecycle.expiresAtForEvent(input),+expiry,'raw and server paths retain the full published Test window through day seven');
for(const key of ['watchLater','saved','archived','addedToFixtures'])assert.equal(lifecycle.lifecycleState(test,{action:{[key]:true},now:new Date('2027-03-01T00:00Z')}).state,'expired','ordinary saved cards have the same retirement boundary');
assert.equal(lifecycle.lifecycleState(test,{now:new Date(+expiry-1)}).state,'active');assert.equal(lifecycle.lifecycleState(test,{now:expiry}).state,'expired');
for(const status of ['live','postponed','stumps','suspended']){const event={...test,status,statusCheckedAt:'2027-03-01T00:55:00Z',statusSourceUrl:'https://official.example/status'};assert.equal(lifecycle.lifecycleState(event,{now:new Date('2027-03-01T01:00Z')}).state,'active');if(['postponed','suspended'].includes(status))assert.equal(lifecycle.expiresAtForEvent(event),null,'postponed fixtures have no deletion deadline');else assert(+lifecycle.expiresAtForEvent(event,new Date('2027-03-01T01:00Z'))>Date.parse('2027-03-01T01:00Z'),'confirmed play extends the cache through its bounded receipt');}
const complete={...test,status:'completed',actualEndTimeUtc:'2026-12-19T05:00:00Z'};
assert.equal(epic.finalDay(complete,new Date('2026-12-20T00:00Z')),'2026-12-19');
for(const actualEndTimeUtc of ['2026-12-16T05:00:00Z','2026-12-19','invalid'])assert.equal(epic.finalDay({...complete,actualEndTimeUtc},new Date('2026-12-20T00:00Z')),test.endDate,'invalid and date-only observations cannot prove an early finish');
assert.equal(lifecycle.expiresAtForEvent({date:'2026-04-03',endDate:'2026-04-06'}).toISOString(),'2026-04-13T14:00:00.000Z');
assert.equal(lifecycle.expiresAtForEvent({date:'2026-10-02',endDate:'2026-10-05'}).toISOString(),'2026-10-12T13:00:00.000Z');
assert.equal(lifecycle.lifecycleState({}, {now:new Date('2027-01-01T00:00Z')}).state,'active');assert.equal(lifecycle.expiresAtForEvent({}),null);
assert.equal(epic.retired({date:'2026-10-01',endDate:'invalid'},new Date('2027-01-01')),false,'unknown final dates cannot justify deletion');
const fourth=cricket.find(f=>f.id==='evt_91'),userState={preferences:{version:25,onboardingComplete:true,showSpoilers:false,preferenceGraph:{entityFollows:[{participantId:fourth.participantIds[0],followLevel:'follow'}]}},event_user_state:{}};
const saved=structuredClone(userState),feed=pipeline.buildServerFeed({events:[fourth],userId:'local-multiday-regression',userState,now:new Date('2027-01-14T01:00Z'),tennisProjection:{parents:[],contests:[]}});
assert.equal(feed.events.length,1);assert.equal(feed.derivedCardCache.derivedCards.length,1);assert.deepEqual(userState,saved);
const calendarNow=new Date('2026-12-20T00:00:00Z');
for(const field of ['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt']){
 const event={...test,status:'completed',actualEndTimeUtc:undefined,[field]:'2026-12-19T05:00:00Z'};
 assert.equal(epic.finalDay(event,calendarNow),'2026-12-19',field+' accepted final day survives the shared retirement rule');
 assert.equal(lifecycle.expiresAtForEvent(event,calendarNow).toISOString(),'2026-12-26T13:00:00.000Z',field+' uses seven Sydney calendar days');
 assert.equal(lifecycle.withinFeedWindow(event,new Date('2026-12-26T12:59:59Z')),true);
 assert.equal(lifecycle.withinFeedWindow(event,new Date('2026-12-26T13:00:00Z')),false);
 for(const value of ['2026-12-16T05:00:00Z','2026-12-19','2026-12-19T05:00:00','invalid','2026-12-22T05:00:00Z'])assert.equal(epic.finalDay({...event,[field]:value},calendarNow),test.endDate,'invalid, unzoned, before-start and future completion evidence cannot shorten the original range');
 const normalized=pipeline.normalizeEvent(event,calendarNow);assert.equal(epic.finalDay(normalized,calendarNow),'2026-12-19','the actual server normalization preserves accepted '+field);
}
const catalogue=require('../lib/calendar-catalogue').catalogue(),original=structuredClone(catalogue),exactWindows=catalogue.filter(e=>e.startTimeUtc&&e.endDate>(e.date||e.startDate));assert(exactWindows.length);
for(const field of ['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt']){
 const event={status:'completed',date:'2026-02-25',endDate:'2026-03-01',[field]:'2026-02-30T02:03:04Z'};
 assert.equal(epic.finalDay(event,new Date('2026-03-10T00:00Z')),'2026-03-01','a nonexistent calendar date cannot shift retirement');
 assert.equal(epic.retired(event,new Date('2026-03-09T00:00Z')),true,'invalid finish evidence cannot keep an old ordinary card visible');
}
assert.equal(epic.finalDay({status:'completed',date:'2026-02-25',endDate:'2026-03-01',actualEndTimeUtc:'2026-02-30T02:03:04Z',completedAt:'2026-02-27T02:03:04Z'},new Date('2026-03-10T00:00Z')),'2026-02-27','a valid later field remains usable when the first field is invalid');
assert.equal(epic.finalDay({status:'completed',date:'2024-02-25',actualEndTimeUtc:'2024-02-29T02:03:04Z'},new Date('2024-03-10T00:00Z')),'2024-02-29','a genuine leap-day finish remains valid');
for(const event of exactWindows)for(const copyEvents of [true,false]){
 const normalized=pipeline.normalizeEvent(event,new Date('2026-10-14T04:00Z'),{copyEvents});
 assert.equal(normalized.status,event.status);assert.equal(normalized.sourceCheckedAt,event.sourceCheckedAt);
 if(!epic.completed(event)&&!epic.confirmedOngoing(event,new Date('2026-10-14T04:00Z'))&&!/^(postponed|suspended)$/.test(event.status||''))assert(+lifecycle.expiresAtForEvent(normalized)>=+lifecycle.sydneyEndOfDay(event.endDate)+7*86400000,'an unconfirmed finish retains the whole original multi-day window: '+event.id);
}
assert.deepEqual(catalogue,original,'shared real fixture facts are not mutated');
assert.deepEqual(userState,saved,'saved choices and hidden results remain unchanged');
console.log('Multi-day retention: raw/server windows, day seven boundary, DST, early verified finish, protected and unknown dates passed.');
