#!/usr/bin/env node
"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const follow=require('../config/follow-first');
const policy=require('../config/follow-feed-policy');
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const now=new Date('2026-09-08T00:00:00Z');
const fixture=(extra={})=>({id:'decision-fixture',eventId:'decision-fixture',key:'tennis',date:'2026-09-09',time:'19:00',name:'One v Two',participantIds:['athlete:one','athlete:two'],...extra});
function check(event,prefs,expected,label){
 assert.equal(Boolean(follow.reasonForEvent(event,prefs)),expected,'client: '+label);
 assert.equal(buildServerFeed({events:[event],userId:'decisions',userState:{preferences:prefs},now}).events.some(e=>e.id===event.id),expected,'server: '+label);
}
const tennis={followedSports:['tennis']};
check(fixture({round:'Round 1',marqueeClassification:{isMarquee:true,sourceUrls:['https://example.org']}}),tennis,false,'early marquee needs a player');
check(fixture({round:'Round 1',participantCountryCodes:['AUS']}),{...tennis,followFirst:{australiansOnlySportIds:['sport:tennis']}},false,'Australian tennis does not bypass player follows');
for(const round of ['Quarterfinal','QF','Semi-final','SF','Final'])check(fixture({round}),tennis,true,round);
for(const round of ['Quarterfinal','Semi-final'])check(fixture({round,eventType:'doubles'}),tennis,false,'doubles '+round);
check(fixture({round:'Final',eventType:'doubles'}),tennis,true,'doubles final');
check(fixture({round:'Round 1'}),{preferenceGraph:{entityFollows:[{participantId:'athlete:one',followLevel:'follow'}]}},true,'one followed player is sufficient');
check(fixture({round:'Final'}),{},false,'no follows');
for(const key of ['aflw','nrlw']){
 const parent=key.slice(0,-1),e=fixture({key,round:'Grand Final'});
 check(e,{selectedSelectorEntityIds:['sport:'+parent],followedSports:[parent,key]},false,'inherited '+key);
 check(e,{selectedSelectorEntityIds:['sport:'+key]},true,'explicit '+key);
}
const women=fixture({key:'cricket',gender:'women',competitionId:'competition:cricket-women-test',competitionScope:'international'});
check(women,{followedSports:['cricket']},false,'women cricket parent');
check(women,{preferenceGraph:{competitionPreferences:[{competitionId:women.competitionId,enabled:true}]}},true,'explicit women competition');
check(women,{preferenceGraph:{entityFollows:[{participantId:'athlete:one',followLevel:'follow'}]}},true,'explicit women player');
check(fixture({key:'nrl',round:'Final'}),{followedSports:['nrl']},true,'NRL final');
check(fixture({key:'afl',round:'Final'}),{followedSports:['afl']},true,'AFL final');
check(fixture({round:'Final'}),{...tennis,preferenceGraph:{entityFollows:[{participantId:'athlete:one',followLevel:'mute'}]}},false,'mute');
check(fixture({round:'Final',competitionId:'competition:test'}),{...tennis,preferenceGraph:{competitionPreferences:[{competitionId:'competition:test',enabled:false}],entityFollows:[{participantId:'athlete:one',followLevel:'follow'}]}},false,'competition exclusion wins');
const pages=fs.readdirSync('data/feed').filter(f=>/^page-.*json$/.test(f));
const summary=pages.flatMap(f=>JSON.parse(fs.readFileSync('data/feed/'+f)).events||[]).find(e=>e.id==='evt_81');
assert(summary,'published finals-week regression fixture');
assert.equal(policy.eligibleForFollow(summary,{competitionFollow:true}),false,'NRL Finals Week 1 summary');
check({...summary,date:'2026-09-09'},{followedSports:['nrl']},false,'NRL summary end to end');
const p=follow.migratePreferences({selectedSelectorEntityIds:['sport:afl'],followedSports:['afl','aflw']});
assert.deepEqual(follow.migratePreferences(p),p,'migration idempotent');
console.log('Follow decision contract passed.');
const catalogue=require('../config/discovery-catalogue');
assert.deepEqual(catalogue.migratePreferences({version:19,followedSports:['afl','aflw']}).selectedSelectorEntityIds,[],'unknown legacy provenance cannot opt into sports');
assert.deepEqual(catalogue.migratePreferences({version:19,selectedSelectorEntityIds:[],followedSports:['afl']}).selectedSelectorEntityIds,[],'explicit empty selection overrides derived fields');
assert.deepEqual(catalogue.migratePreferences({version:19,selectedSelectorEntityIds:['sport:aflw'],followedSports:['afl','aflw']}).selectedSelectorEntityIds,['sport:aflw'],'demonstrably explicit women follow survives migration');
const timeline=require('../config/fixture-identity');
for(const [date,expected] of [['2026-09-01',true],['2026-08-31',false],['2027-09-08',true],['2027-09-09',false]]){
 const event=fixture({date,round:'Final'});
 assert.equal(timeline.retainedInActiveTimeline(event,now),expected,'browser boundary '+date);
 assert.equal(buildServerFeed({events:[event],userId:'boundary',userState:{preferences:tennis},now}).events.length>0,expected,'server boundary '+date);
}
assert(timeline.retainedInActiveTimeline(fixture({date:'2026-08-20',endDate:'2026-09-10'}),now),'ongoing multi-day fixture');
assert(timeline.retainedInActiveTimeline(fixture({date:'2026-09-28'}),new Date('2026-10-04T14:00:00Z')),'seven local days across daylight saving');
