'use strict';
const assert=require('node:assert/strict'),model=require('../config/athletes'),pipeline=require('../lib/server-feed-pipeline');
const now=Date.parse('2026-10-09T08:45:00Z'),from='2026-10-09',through='2027-10-09',id='competitor:golf:adam-scott';
const publishedParent=require('../lib/calendar-catalogue').catalogue().find(e=>e.tournamentId==='R2026527'&&e.cardType==='golf_tournament');assert(publishedParent,'Actual current tournament retained');const publishedBefore=JSON.stringify(publishedParent);
// Replay timing against a frozen observation of the actual retained fixture.
// Later daily refreshes must not become future evidence in this older clock.
const parent={...publishedParent,status:'in-progress',sourceCheckedAt:new Date(now-3600000).toISOString(),statusCheckedAt:new Date(now-3600000).toISOString()},before=JSON.stringify(parent);
assert(!/progress/.test(model.calendarTiming({...publishedParent,statusCheckedAt:new Date(now+1).toISOString()},now)),'The published fixture cannot claim a status observed after the replay clock');
assert.equal(model.next([parent],id,Date.parse('2026-10-12T00:00:00Z')),null,'A past date-only tournament cannot remain next; source status is not changed');
assert.equal(model.spansCurrentCalendarDay(parent,from,through),true,'Tournament stays in the outlook after its first day');
for(const status of ['completed','finished','final','cancelled','canceled','abandoned','withdrawn'])assert.equal(model.spansCurrentCalendarDay({...parent,status},from,through),false,'Terminal past-start calendar remains outside the outlook: '+status);
for(const change of [{endDate:'2026-10-08'},{endDate:null},{endDate:'2026-02-30'},{date:'2026-10-12'},{date:'2026-02-30'},{date:null}])assert.equal(model.spansCurrentCalendarDay({...parent,...change},from,through),false,'Invalid, future, expired or unbounded calendar cannot be made current');
assert.equal(model.spansCurrentCalendarDay({...parent,status:'scheduled'},from,through),true,'An overlapping calendar does not require or invent live play');
assert.equal(model.spansCurrentCalendarDay({...parent,date:'2026-09-30',endDate:from},from,through),true,'Inclusive final calendar day remains visible');
assert.equal(model.spansCurrentCalendarDay({...parent,date:'2026-10-09'},from,through),false,'Ordinary same-day inclusion stays with its existing filter');
assert.match(model.calendarTiming(parent,now),/^Last reported in progress · Tournament dates: 8–11 Oct 2026 · Next tee time not verified$/);
assert(!/Next tee/.test(model.calendarTiming({...parent,status:'completed'},now)),'A settled tournament cannot suggest an unverified next tee time');
const fresh={...parent,statusCheckedAt:new Date(now-60000).toISOString()};assert.match(model.calendarTiming(fresh,now),/^In progress ·/);
for(const change of [{statusCheckedAt:null},{statusCheckedAt:'bad'},{statusCheckedAt:new Date(now+1).toISOString()},{sourceUrl:'http://invalid.test'}])assert(!/progress/.test(model.calendarTiming({...fresh,...change},now)),'Missing or future status evidence cannot claim ongoing play');
assert.match(model.calendarTiming({...fresh,sourceStale:true},now),/^Last reported/);assert(!/progress/.test(model.calendarTiming({...fresh,status:'scheduled'},now)),'Elapsed calendar alone cannot claim play');
assert.equal(model.calendarTiming({...parent,endDate:'2026-02-30'},now),null);assert.equal(model.calendarTiming({...parent,cardType:'fixture'},now),null,'Exact match and other-sport timing paths retain their owner');assert.equal(model.timingState(parent,now),'unresolved','Calendar wording cannot create a reminder clock');assert.equal(require('../config/fixture-reminder-policy').timing(parent,now),null);
assert.equal(model.participantCalendar(parent,now),true);for(const change of [{participantsConfirmed:false},{sourceCheckedAt:null},{sourceCheckedAt:new Date(now+1).toISOString()},{sourceUrl:'http://invalid.test'}])assert.equal(model.participantCalendar({...parent,...change},now),false,'Only sourced confirmed participation can supply calendar context');
const run=(events,actions={})=>pipeline.buildServerFeed({events,userId:'calendar-qa',userState:{preferences:{version:26,showSpoilers:false,preferenceGraph:{entityFollows:[]},followFirst:{notifications:{enabled:false}}},event_user_state:actions},now:new Date(now),athletesOnly:true,participantId:id,participants:parent.participants,tennisProjection:{parents:[],contests:[]}});
const future={...parent,id:'qa:golf:future',status:'scheduled',date:'2027-10-09',endDate:'2027-10-09'},outside={...future,id:'qa:golf:outside',date:'2027-10-10',endDate:'2027-10-10'};
assert.deepEqual(run([parent,future,outside]).events.map(e=>e.id),[parent.id,future.id],'Actual server profile preserves active tournament and twelve-month boundary');assert.equal(run([parent],{[parent.id]:{dismissed:true}}).events.length,0,'Dismissal stays authoritative');assert.equal(run([parent],{[parent.id]:{archived:true}}).events.length,0,'Archive stays authoritative');assert.equal(JSON.stringify(parent),before,'Original facts, identities and dates remain exact');
assert.equal(JSON.stringify(publishedParent),publishedBefore,'The clock replay never mutates published source facts');
console.log('Current multi-day profile/server outlook, honest Golf dates/status, terminal/invalid exclusions, privacy and reminder boundaries passed.');
