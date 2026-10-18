'use strict';
// Published fixture context; all video metadata is synthetic. No network/DB.
const assert=require('node:assert/strict');
const selection=require('../lib/highlight-selection');
const event=require('../lib/calendar-catalogue').catalogue().find(e=>e.id==='fixture:rugby:wr:c0019bef-3a50-4ff8-9ca8-ec6cfe168a03');
assert(event,'published Perpignan–Vannes fixture');
assert.equal(event.competitionName,'Top 14 2027');
assert.equal(event.date,'2026-10-11');
const now=new Date('2026-10-18T12:30:00Z'),before=JSON.stringify(event);
const title=event.name+' | '+event.competitionName+' | 2026 Highlights';
const item=(heading=title,patch={})=>({id:'EDITION0001',snippet:{channelId:'unreviewed',title:heading,publishedAt:'2026-10-17T12:00:00Z',defaultAudioLanguage:'en',...(patch.snippet||{})},status:{privacyStatus:'public',uploadStatus:'processed'},contentDetails:{duration:'PT5M',...(patch.contentDetails||{})}});
const selected=(heading,fixture=event,patch={})=>selection.select([item(heading,patch)],fixture,now);
assert(selected(title),'a match highlights title repeating its sourced next-year competition edition must remain eligible');
assert(selected(event.name+' | Top 14 | 2026 Highlights'),'calendar-year title stays eligible');
for(const heading of [
  event.name+' | Top 14 2028 | 2026 Highlights',
  event.name+' | Top 14 2027 | Season 2027/28 Highlights',
  event.name+' | 2027 Highlights',
  event.name+' | Top 14 2027 | 2025 Highlights',
  event.name+' | Top 14 2027 | 2026 Highlights | 2026-10-03',
  'Women '+title,
  title.replace('Highlights','Full Match Highlights'),
  title.replace('RC Vannes','RC Toulon')
])assert.equal(selected(heading),null,'conflicting or unsuitable context rejected: '+heading);
assert.equal(selected(title,{...event,competitionName:'Pro D2 2027'}),null,'next-year label must match this actual source competition');
assert.equal(selected(title,{...event,seasonLabel:'2025/26'}),null,'explicit conflicting sourced season cannot be replaced by a label inference');
for(const field of ['season','seasonLabel']){
  for(const value of [2025,'2025','2028','2025/26 2026/27'])assert.equal(selected(title,{...event,[field]:value}),null,'conflicting explicit season remains authoritative: '+field+' '+value);
  for(const value of [2026,'2026',2027,'2027','2026/27'])assert(selected(title,{...event,[field]:value}),'compatible calendar/end-year season remains eligible: '+field+' '+value);
}
for(const patch of [
  {snippet:{publishedAt:new Date(+now-7*86400000-1).toISOString()}},
  {snippet:{publishedAt:new Date(+now+1).toISOString()}},
  {snippet:{defaultAudioLanguage:'fr'}},
  {contentDetails:{duration:'PT3H'}},
  {contentDetails:{regionRestriction:{blocked:['AU']}}}
])assert.equal(selected(title,event,patch),null,'recency/audio/duration/region safeguards remain');
assert.equal(JSON.stringify(event),before,'comparison cannot rewrite fixture dates or edition facts');
assert.equal(selection.POLICY,'all-sport-recent-highlights.v2','preserve existing valid cache bindings and quota policy');
console.log('Rugby sourced competition edition: valid next-year label accepted; conflicting seasons, opponents, gender, old/future uploads, broadcasts, audio and AU blocks rejected.');
