#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {validate,apply,refresh,LEGACY_ID}=require('./refresh-wsl-calendar');
const {cardForEvent,mergeSailgpCard}=require('./sync-requested-sports-to-feed');
const doc=require('../feeds/provider-exports/wsl/calendar-2026.v1.json'),follow=require('../config/follow-first'),catalogue=require('../config/discovery-catalogue'),policy=require('../config/follow-feed-policy');
const clone=v=>JSON.parse(JSON.stringify(v)),schedule=apply({events:[],sources:{}},doc);
for(const mutate of [d=>d.events.pop(),d=>d.events[1]=d.events[0],d=>d.events[0].date='2027-04-01',d=>d.events[0].endDate='2026-03-01',d=>d.futureAnnouncements[0].datesPublished=true,d=>d.sourceUrl='https://example.org']){const bad=clone(doc);mutate(bad);assert.throws(()=>validate(bad));}
assert.equal(schedule.events.length,12);assert.equal(schedule.events.filter(e=>e.gender==='mens').length,11);assert(schedule.events.every(e=>e.time===null&&e.dateOnly&&!e.startTimeUtc&&e.participantsConfirmed===false));
assert(!schedule.events.some(e=>/abu-dhabi|2027/.test(e.id)),'withdrawn stop and undated Raglan return are not fixtures');
assert.equal(schedule.events.find(e=>e.id.endsWith('portugal')).date,'2026-10-16');assert(schedule.events.some(e=>e.id.endsWith('philippines')));
assert.deepEqual(apply(schedule,doc),schedule,'reviewed rerun preserves observations');
const drift=clone(doc);drift.events[9].date='2026-10-17';assert.throws(()=>apply(schedule,drift),'source correction requires identity review');
const e=cardForEvent(schedule.events.find(e=>e.id.endsWith('portugal')),schedule,new Map());
assert(policy.sportingFixture(e));assert.equal(policy.explicitCompetitionRequired(e),true);
const now=new Date('2026-10-03T00:00:00Z'),server=require('../lib/server-feed-pipeline').buildServerFeed;
function admission(prefs,expected,label){assert.equal(Boolean(follow.reasonForEvent(e,prefs)),expected,'client '+label);assert.equal(server({events:[e],userId:'wsl-check',userState:{preferences:prefs},now}).events.some(f=>f.id===e.id),expected,'server '+label);}
admission({},false,'new choice begins unfollowed');
admission({version:21,selectedSelectorEntityIds:['sport:surf'],followedSports:['surf','wsl']},false,'parent cannot grant new choice');
admission({version:21,selectedSelectorEntityIds:['sport:wsl']},false,'legacy WSL alias remains Surfing');
admission({version:25,selectedSelectorEntityIds:['sport:wsl']},true,'explicit WSL selection');
admission({preferenceGraph:{competitionPreferences:[{competitionId:e.competitionId,enabled:true}]}},true,'explicit competition');
admission({version:25,selectedSelectorEntityIds:['sport:wsl'],preferenceGraph:{competitionPreferences:[{competitionId:e.competitionId,enabled:false}]}},false,'competition exclusion wins');
assert.deepEqual(catalogue.migratePreferences({version:21,selectedSelectorEntityIds:['sport:surf','sport:big-wave'],followedSports:['surf','wsl','big-wave']}).selectedSelectorEntityIds,['sport:surf','sport:big-wave']);
const legacyMute=catalogue.migratePreferences({version:21,selectedSelectorEntityIds:['sport:tennis'],preferenceGraph:{entityFollows:[{participantId:'athlete:one',followLevel:'mute'}]}});assert.equal(follow.migratePreferences(legacyMute).preferenceGraph.entityFollows[0].followLevel,'unfollow');
assert(!require('../config/follow-summary').allFollowed({version:25,selectedSelectorEntityIds:['sport:surf'],followedSports:['surf','wsl','big-wave']}).some(i=>i.id==='sport:wsl'),'All Followed does not claim derived WSL consent');
const p=catalogue.migratePreferences({version:25,selectedSelectorEntityIds:['sport:wsl']});assert.deepEqual(catalogue.migratePreferences(p),p);
assert.deepEqual(follow.viewingOptions(e),[],'no inferred Australian broadcaster');
const observed={...e,sourceCheckedAt:'2026-01-01T00:00:00Z',score:'Retained fact',storyline:{hookSpoilerOff:'Retained editorial'},unknownFact:12};const merged=mergeSailgpCard(e,observed);for(const k of ['id','sourceCheckedAt','score','storyline','unknownFact'])assert.deepEqual(merged[k],observed[k]);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-wsl-calendar-'));
try{refresh({root:temp,document:doc});const f=path.join(temp,'data/canonical/wsl-calendar.v1.json'),before=fs.readFileSync(f);assert.throws(()=>refresh({root:temp,document:{...doc,events:[]}}));assert(before.equals(fs.readFileSync(f)),'failed source cannot overwrite verified data');refresh({root:temp,document:doc});assert(before.equals(fs.readFileSync(f)),'unchanged replay');}finally{fs.rmSync(temp,{recursive:true,force:true});}
if(process.argv.includes('--published')){
 for(const file of ['../feeds/incoming/events.json','../data/events.json']){
  const rows=require(file).events.filter(e=>e.competitionId==='competition:wsl-championship-tour');assert.equal(rows.length,12);assert.equal(new Set(rows.map(e=>e.id)).size,12);
  const legacy=rows.find(e=>e.id===LEGACY_ID);assert(legacy&&legacy.cardKind==='event');assert.match(legacy.outcomeText,/George Pittar and Lakey Peterson/);assert(legacy.sourceRefs.some(r=>r.startsWith('calendar://')));
  assert(rows.filter(e=>e.id!==LEGACY_ID).every(e=>e.gender==='mens'&&e.time===null&&e.dateOnly&&!e.startTimeUtc&&!e.participantIds?.length));
  assert(rows.filter(e=>e.id!==LEGACY_ID&&e.status==='completed').every(e=>e.resultStatus==='pending'&&e.resultSourceUrl&&!e.score&&!e.outcomeText));
 }
 const parents=require('../lib/event-overviews').build(require('../data/events.json').events).filter(e=>e.sportKey==='wsl');assert.equal(parents.length,12);assert(parents.every(e=>e.fixtureIds.length===1&&e.venueCaption.includes('Break shape unverified')));
 const inspector=require('../data/code-inspector/wsl.json');assert.equal(inspector.coverageStatus,'partial');assert.equal(inspector.fixtures.length,12);assert(follow.reasonForEvent(inspector.fixtures.find(f=>f.id.endsWith('portugal')),{version:25,selectedSelectorEntityIds:['sport:wsl']}),'Schedule projection preserves explicit WSL admission');
}
const artwork=fs.readFileSync(path.join(__dirname,'../assets/identities/wsl/wave-white.svg'),'utf8');assert.equal((artwork.match(/<path /g)||[]).length,3);assert(!/<image|data:image|<rect/.test(artwork));
console.log('WSL: twelve official date-only windows, retained mixed identity/result, explicit new Follow consent, boundaries/corrections, no invented future dates/entries/results/maps, failed-source preservation and SVG paths passed.');
