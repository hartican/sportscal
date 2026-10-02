#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {validate,apply,refresh}=require('./refresh-grand-tour-calendars');
const {cardForEvent,mergeSailgpCard}=require('./sync-requested-sports-to-feed');
const doc=require('../feeds/provider-exports/cycling/grand-tours-calendar.v1.json'),follow=require('../config/follow-first'),catalogue=require('../config/discovery-catalogue'),policy=require('../config/follow-feed-policy'),art=require('../config/venue-artwork');
const clone=v=>JSON.parse(JSON.stringify(v)),schedule=apply({events:[],sources:{}},doc);
for(const mutate of [d=>d.editions.pop(),d=>d.editions[0].stages.pop(),d=>d.editions[0].stages[1].number=1,d=>d.editions[0].stages[1].date=d.editions[0].stages[0].date,d=>d.editions[0].stages[0].startCountryCode='?',d=>d.editions[0].restDays[0].date=d.editions[0].stages[0].date,d=>d.editions[4].stages.push(d.editions[0].stages[0]),d=>d.editions[0].sourceUrl='https://example.org']){const bad=clone(doc);mutate(bad);assert.throws(()=>validate(bad));}
assert.equal(schedule.events.length,66);assert.equal(schedule.events.filter(e=>e.season==='2026').length,63);assert.equal(schedule.events.filter(e=>e.season==='2027').length,3);
assert(schedule.events.every(e=>e.gender==='mens'&&e.time===null&&e.dateOnly&&!e.startTimeUtc&&e.participantIds.length===0));
for(const e of doc.editions.filter(e=>e.year===2026)){
 const dates=new Set([...e.stages,...e.restDays].map(s=>s.date));const first=new Date(e.stages[0].date+'T00:00:00Z'),last=e.stages.at(-1).date;
 for(let d=first;d.toISOString().slice(0,10)<=last;d.setUTCDate(d.getUTCDate()+1))assert(dates.has(d.toISOString().slice(0,10)),'every calendar date is a stage or published rest day');
}
assert.deepEqual(apply(schedule,doc),schedule,'review replay is stable');
const drift=clone(doc);drift.editions[0].stages[0].date='2026-07-03';assert.throws(()=>apply(schedule,drift),'date correction requires identity review');
for(const key of ['tdf','giro','vuelta']){
 const source=schedule.events.find(e=>e.sportKey===key&&(key!=='tdf'||e.season==='2027'));
 const event={...cardForEvent(source,schedule,new Map()),date:'2026-10-04'};
 const server=require('../lib/server-feed-pipeline').buildServerFeed;
 function admission(prefs,expected,label){assert.equal(Boolean(follow.reasonForEvent(event,prefs)),expected,'client '+key+' '+label);assert.equal(server({events:[event],userId:'tour-check',userState:{preferences:prefs},now:new Date('2026-10-03T00:00:00Z')}).events.some(e=>e.id===event.id),expected,'server '+key+' '+label);}
 admission({},false,'default off');admission({version:26,selectedSelectorEntityIds:['sport:cycling'],followedSports:['cycling',key]},false,'parent/derived keys cannot grant consent');
 admission({version:26,selectedSelectorEntityIds:['sport:'+key]},true,'explicit child');admission({preferenceGraph:{competitionPreferences:[{competitionId:event.competitionId,enabled:true}]}},true,'explicit competition');
 admission({version:26,selectedSelectorEntityIds:['sport:'+key],preferenceGraph:{competitionPreferences:[{competitionId:event.competitionId,enabled:false}]}},false,'exclusion wins');
 assert.deepEqual(follow.viewingOptions(event),[],'no inferred Australian broadcaster for calendar-only stages');
 const facts={...event,time:'12:34',date:'2026-07-05',score:'Existing result',storyline:{hookSpoilerOff:'Existing editorial'},sourceCheckedAt:'2026-07-01T00:00:00Z',participantIds:['athlete:retained']};
 const merged=mergeSailgpCard(event,facts);for(const k of ['id','time','date','score','storyline','sourceCheckedAt','participantIds'])assert.deepEqual(merged[k],facts[k]);
}
assert.deepEqual(catalogue.migratePreferences({version:25,selectedSelectorEntityIds:['sport:tdf']}).selectedSelectorEntityIds,['sport:cycling'],'old Tour alias retains its prior meaning');
assert(!require('../config/follow-summary').allFollowed({version:26,selectedSelectorEntityIds:['sport:cycling'],followedSports:['cycling','tdf','giro','vuelta']}).some(i=>['sport:tdf','sport:giro','sport:vuelta'].includes(i.id)));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-grand-tours-'));
try{refresh({root:temp,document:doc});const f=path.join(temp,'data/canonical/grand-tours-calendar.v1.json'),before=fs.readFileSync(f);assert.throws(()=>refresh({root:temp,document:{...doc,editions:[]}}));assert(before.equals(fs.readFileSync(f)));refresh({root:temp,document:doc});assert(before.equals(fs.readFileSync(f)));}finally{fs.rmSync(temp,{recursive:true,force:true});}
const manifest=require('../assets/identities/cycling/asset-manifest.json');
for(const a of manifest.assets){const bytes=fs.readFileSync(path.join(__dirname,'..',a.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);assert(a.sourceUrl&&a.author&&a.license&&a.modifications);if(a.path.endsWith('.svg')){const s=bytes.toString();assert(!/<image|data:image|<rect|<script|<foreignObject/.test(s));assert(s.includes('viewBox='));}}
for(const e of schedule.events){const card=cardForEvent(e,schedule,new Map()),resolved=art.resolve(card);assert(resolved);if(e.courseGeometryVerified){assert.equal(resolved.kind,'course');assert.equal(resolved.path,manifest.assets.find(a=>a.id===e.courseArtworkId)?.path);assert.equal(art.resolve({...card,roundNumber:99}).kind,'fallback','never borrow another stage configuration');}else assert.equal(resolved.kind,'fallback');}
for(const id of ['event:tdf:2026:stage-9','event:tdf:2026:stage-21','event:vuelta:2026:stage-3'])assert.equal(schedule.events.find(e=>e.id===id).courseGeometryVerified,false,'outdated source geometry withheld');
if(process.argv.includes('--published')){
 for(const file of ['../feeds/incoming/events.json','../data/events.json']){
  const rows=require(file).events.filter(e=>e.grandTourCalendar);assert.equal(rows.length,66);assert.equal(new Set(rows.map(e=>e.id)).size,66);
  assert.equal(rows.filter(e=>/^evt_(?:4[6-9]|[56][0-9]|66)$/.test(e.id)).length,21,'retained Tour action/chat/rating identities');
  assert(rows.filter(e=>e.season==='2027').every(e=>e.time===null&&e.dateOnly&&!e.startTimeUtc&&!e.participantIds?.length&&!e.jerseySnapshot));
  const old=rows.find(e=>e.id==='evt_46');assert.equal(old.date,'2026-07-05');assert.equal(old.time,'00:55');const contextual=require('../config/sport-context').applyContextToEvents([old],require('../data/canonical/cycling-context-2026.json'))[0];assert.equal(contextual.participantIds.length,14);assert(contextual.jerseySnapshot);
 }
 const parents=require('../data/event-overviews.v1.json').events.filter(e=>['tdf','giro','vuelta'].includes(e.key));assert.equal(parents.length,6);assert(parents.every(e=>e.isEditionOverview&&!e.courseGeometryVerified&&!e.courseArtworkId));
 assert.equal(parents.find(e=>e.key==='tdf'&&e.season==='2027').endDate,'2027-07-25');assert.equal(parents.find(e=>e.key==='giro'&&e.season==='2027').fixtureIds.length,0);assert.equal(parents.find(e=>e.key==='vuelta'&&e.season==='2027').fixtureIds.length,0);
 for(const slug of ['tour-de-france','giro-ditalia','vuelta-a-espana']){const chunk=require('../data/code-inspector/'+slug+'.json');assert.equal(chunk.coverageStatus,'partial');assert(chunk.fixtures.every(e=>e.grandTourCalendar));}
}
console.log('Grand Tours: 63 current stages, three published future stages, rest-day/order/cross-border/date-only boundaries, stable legacy facts, explicit Follow parity, exact route assignment, source corrections and failed-source preservation passed.');
