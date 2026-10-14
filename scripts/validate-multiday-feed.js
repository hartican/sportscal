'use strict';
const assert=require('node:assert/strict'),timeline=require('../config/feed-timeline'),life=require('../config/card-lifecycle'),pipeline=require('../lib/server-feed-pipeline');
const sa=require('../lib/calendar-catalogue').catalogue().find(e=>e.id==='fixture:cricket:espn:1525659');
assert(sa&&sa.date==='2026-10-09'&&sa.endDate==='2026-10-13','Use the reported First SA Test and its genuine published window');
const snapshot=structuredClone(sa);
const timing=require('../config/card-timing');
const paused={...sa,status:'stumps',restartTimeUtc:'2026-10-10T08:00:00Z'};
assert.match(timing.presentation(paused,new Date('2026-10-10T07:00:00Z'),{fullRange:true}).day,/9 OCT.*13 OCT/,'A sourced later-day restart cannot shorten the original full Feed range');
assert.equal(paused.startTimeUtc,sa.startTimeUtc);assert.equal(paused.restartTimeUtc,'2026-10-10T08:00:00Z');
for(const date of ['2026-10-09','2026-10-10','2026-10-11','2026-10-12','2026-10-13','2026-10-14']){
 const now=new Date(date+'T08:00Z');
 for(const status of ['scheduled','live','stumps','completed']){
  const fixture={...sa,status,statusCheckedAt:now.toISOString()};
  const groups=timeline.groups([fixture],now),expected=date<'2026-10-13'?'future':date==='2026-10-13'?'today':'retainedPast';
  assert.equal(groups[expected].length,1,'One canonical Test stays on its final day for '+date+' / '+status);
  assert.equal(Object.values(groups).flat().length,1,'No daily duplicate fixtures');
  assert.equal(timeline.displayDate(fixture),'2026-10-13');
  assert.equal(fixture.date,'2026-10-09');assert.equal(fixture.startTimeUtc,sa.startTimeUtc);
 }
}
for(const range of [{endDate:'2026-10-08'},{endDate:'2026-10-09'},{endDate:'2026-02-30'},{endDate:'unknown'}])assert.equal(timeline.displayDate({...sa,...range}),sa.date,'Invalid/backwards/single-day windows use their original date');
const prefs={preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]}};
const completed={...sa,status:'completed',completedAt:'2026-10-13T11:24:01.207Z',actualEndTimeUtc:null,firstConfirmedCompleteAt:null};
for(const date of ['2026-10-14','2026-10-20','2026-10-21']){
 const now=new Date(date+'T08:00Z'),expected=date!=='2026-10-21';
 for(const fixture of [completed,pipeline.normalizeEvent(completed,now),{...completed,completedAt:null,endTimeUtc:'2026-10-09T10:30Z'}])assert.equal(life.withinFeedWindow(fixture,now),expected,'Verified end or published range, never inferred first-day duration, owns seven-day Feed expiry');
 const state={preferences:prefs,eventUserState:{}};const before=structuredClone(state);const response=pipeline.buildServerFeed({events:[completed],userId:'multiday-test',userState:state,now,tennisProjection:{parents:[],contests:[]}});
 assert.equal(response.events.some(e=>e.id===sa.id),expected);assert.equal(response.derivedCardCache.derivedCards.some(e=>e.canonicalEventId===sa.id),expected);assert.deepEqual(state,before,'Navigation/placement cannot write user choices');
}
for(const completedAt of ['2026-10-08T08:00Z','2026-10-13','bad','2026-11-01T08:00Z'])assert(life.withinFeedWindow({...completed,completedAt},new Date('2026-10-20T08:00Z')),'Invalid/future completion falls back to the published last day');
const neverPlayed={...sa,status:'scheduled'};assert.equal(timeline.confirmedLive(neverPlayed,new Date('2026-10-12T08:00Z')),false,'Final-day display creates no live observation');
assert.deepEqual(sa,snapshot,'No sporting facts are rewritten');
console.log('Multi-day Feed: reported Test, final-day-only grouping, invalid windows, seven-day completion retention and unchanged identities/user state pass.');

const now=new Date('2026-10-14T01:00Z'),scheduled={...sa,status:'scheduled',endDate:'2026-10-14',completedAt:null,actualEndTimeUtc:null};
const second=require('../lib/calendar-catalogue').catalogue().find(e=>e.id==='fixture:cricket:espn:1525660');
const single={...second,status:'scheduled',date:'2026-10-14',endDate:'2026-10-14',startTimeUtc:'2026-10-14T10:00Z'};
const page=pipeline.buildServerFeed({events:[single,scheduled],userId:'multiday-page',userState:{preferences:prefs},now,limit:1,tennisProjection:{parents:[],contests:[]}});
assert.equal(page.events[0].id,sa.id,'Final-day placement participates in real bounded server pagination before browser mounting');
assert.equal(page.events[0].date,sa.date,'Server presentation sorting does not change the opening date');
const state={preferences:prefs,eventUserState:{[pipeline.eventActionKey(sa)]:{eventId:sa.id,dismissed:true,reminderChoice:'off'}}};
const savedState=structuredClone(state);pipeline.buildServerFeed({events:[completed],userId:'multiday-dismiss',userState:state,now,tennisProjection:{parents:[],contests:[]}});assert.deepEqual(state,savedState,'Server display ordering cannot clear dismissal or OFF');assert.equal(pipeline.eventActionFor(sa,state.eventUserState).dismissed,true);
console.log('Final-day server pagination and dismissal/OFF preservation pass.');
