'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),acorn=require('acorn');
const identity=require('../config/fixture-identity'),timeline=require('../config/feed-timeline'),timing=require('../config/card-timing'),actions=require('../config/event-action-identity'),pipeline=require('../lib/server-feed-pipeline'),sports=require('../config/all-sports-view');
const retained=require('./fixtures/cricket-third-test-retained-20261026.json'),ca=retained.fixture,published=require('../lib/calendar-catalogue').catalogue().find(e=>e.id==='fixture:cricket:espn:1525661'),now=new Date('2026-10-26T07:00:00Z');
const before=JSON.stringify([ca,published]),merged=identity.mergeOverlays([published],[ca]);assert.equal(merged.length,1,'Actual source reconciliation retains one canonical Test, without a new durable alias');
const event=merged[0];assert.equal(event.id,published.id);assert(event.sourceEventIds.includes(ca.id));assert(event.sourceEventIds.includes('evt_89'));assert.equal(event.date,'2026-10-27');assert.equal(event.startTimeUtc,'2026-10-27T08:30:00.000Z');assert.equal(event.endDate,'2026-10-31');assert.equal(event.endTimeUtc,ca.endTimeUtc);assert.equal(event.sourceCheckedAt,ca.sourceCheckedAt);
const state={preferences:{showSpoilers:false,feedControls:{spoilers:'strict'},followedSports:['cricket'],preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]}},eventUserState:{}},saved=JSON.stringify(state);
const feed=pipeline.buildServerFeed({events:merged,userId:'retained-source-test',userState:state,now});assert.equal(feed.events.length,1);assert.equal(timeline.displayDate(feed.events[0],now),'2026-10-31','Approved final-day Feed placement stays intact');
const all=sports.select(merged,sports.windowFor('48',+now),+now);assert.equal(all.length,1);assert.equal(all[0].day,'2026-10-27','All Sports still places this same Test at its original start');
for(const id of [ca.id,published.id,'evt_89']){const action={dismissed:true,reminderChoice:'off',saved:true,lastActionAt:'2026-10-25T00:00:00Z'};assert.equal(actions.resolveAction(event,{[id]:action}).action,action,'Existing source aliases retain saved fixture actions');}
const source=fs.readFileSync('config/venue-panel-ui.js','utf8'),start=source.indexOf('function buildFixtureTimingBadge('),end=acorn.parseExpressionAt(source,start,{ecmaVersion:'latest'}).end;
function badge(fixture,tab='feed'){
 const context={NOTHINGSPORTS_CARD_TIMING:timing,NOTHINGSPORTS_FEED_TIMELINE:timeline,activeTab:tab,nowAEST:()=>now,openFixtureFromTimingCapsule(){},document:{createElement:()=>({children:[],dataset:{},classList:{toggle(){}},append(...items){this.children.push(...items);},setAttribute(){}})}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);return context.buildFixtureTimingBadge(fixture);
}
for(const fixture of [event,feed.events[0]]){
 const element=badge(fixture),day=element.children.find(n=>n.className==='fixture-timing-day');assert.match(day.textContent,/27 OCT.*31 OCT/,'The actual upcoming Feed badge must show its full source date range');assert.equal(day.hidden,false);assert.match(element.title,/27 OCT.*31 OCT/);
 const presentation=timing.badgePresentation(fixture,now,{fullRange:true,compactCricket:true});assert.match(presentation.day,/27 OCT.*31 OCT/,'The shared constructor/live-patch presentation agrees');
 const ordinary=timing.badgePresentation(fixture,now,{compactCricket:true});assert.match(ordinary.day,/27 OCT.*31 OCT/,'All Sports expanded timing also identifies the same multi-day fixture');
}
// The existing source-proven in-play compact phase contract remains unchanged.
require('./validate-cricket-compact-summary');
assert.equal(JSON.stringify([ca,published]),before,'Display repair cannot rewrite any source fact or clock');assert.equal(JSON.stringify(state),saved,'Display repair cannot change preferences or saved actions');
console.log('Upcoming Cricket range: retained CA/canonical union is one Test, Feed31/AllSports27 placement, actual badge27–31, saved aliases/source clocks and existing in-play compact phase passed.');
module.exports={event:feed.events[0],now};
