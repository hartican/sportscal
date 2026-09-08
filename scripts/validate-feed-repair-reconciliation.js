#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const identity=require('../config/fixture-identity'),follow=require('../config/follow-first');
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const events=require('../data/events.json').events,programme=require('../lib/competition-fixtures').fixtures();
const reference=new Date('2026-09-08T12:00:00Z');
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
const prefs={selectedSelectorEntityIds:['sport:afl-premiership','sport:nrl-premiership','sport:tennis']};
const finals=programme.filter(e=>['afl','nrl'].includes(e.key)&&identity.retainedInActiveTimeline(e,reference));
const result=buildServerFeed({events:programme,userId:'reconciliation',userState:{preferences:prefs},now:reference,limit:1000});
for(const fixture of finals){
 assert(follow.reasonForEvent(fixture,prefs),'browser '+fixture.id);
 assert(result.events.some(e=>aliases(e).includes(fixture.id)),'server '+fixture.id);
 assert.equal(events.filter(e=>aliases(e).includes(fixture.id)).length,1,'published once '+fixture.id);
 const inspector=require(`../data/code-inspector/${fixture.key}.json`).fixtures;
 assert.equal(inspector.filter(e=>aliases(e).includes(fixture.id)).length,1,'hydration once '+fixture.id);
 const bare={...fixture,participants:[],participantIds:[],storyline:null,editorialNarrative:null,viewingOptions:[],broadcaster:null,expected:null};
 assert(buildServerFeed({events:[bare],userId:'bare',userState:{preferences:prefs},now:reference}).events.length,'optional enrichment '+fixture.id);
}
const pageEvents=fs.readdirSync('data/feed').filter(f=>/^page-.*json$/.test(f)).flatMap(f=>JSON.parse(fs.readFileSync('data/feed/'+f)).events);
for(const entry of require('../data/canonical/nrl-finals-published-2026.json').events){const e=events.find(e=>aliases(e).includes(entry.id));assert.equal(e.startTimeUtc,entry.startTimeUtc);assert.deepEqual(e.participantIds,entry.participantIds);assert(pageEvents.some(e=>aliases(e).includes(entry.id)));}
const upcomingTennis=programme.filter(e=>e.key==='tennis'&&['mens-singles','womens-singles'].includes(e.matchType)&&new Date(e.startTimeUtc||e.sessionStartTimeUtc)>=reference&&follow.reasonForEvent(e,{preferenceGraph:{entityFollows:[{participantId:e.participantIds[0],followLevel:'follow'}]}}));
assert(upcomingTennis.length>=4);
for(const e of upcomingTennis){assert.equal(follow.stageLabel(e),'QF');assert.equal(e.editorialNarrative?.generationMode,'researched');assert(e.editorialNarrative.sourceIds.length>=3);}
for(const id of ['evt_26','evt_27']){
 const e=events.find(e=>e.id===id);assert.equal(e.fixtureResults.rows.length,22);assert(e.fixtureResults.rows.every(row=>row.length===e.fixtureResults.columns.length));
 assert(e.participantIds.includes('competitor:f1:yuki-tsunoda'));assert(!e.participantIds.includes('competitor:f1:isack-hadjar'));
 assert.equal(e.participantsConfirmed,true);assert.deepEqual(require('../config/sport-context').applyEventContext(e,require('../data/canonical/f1-context-2026.json')).participantIds,e.participantIds);
}
for(const session of require('../data/canonical/f1-published-sessions-2026.json').sessions){const e=events.find(e=>e.id===session.id);assert.equal(e.startTimeUtc,session.startTimeUtc);assert.equal(e.date,session.date);assert.equal(e.time,session.time);}
const standings=require('../data/code-inspector/f1.json').standings;assert.equal(standings.filter(e=>e.competitionId.includes('drivers')).length,23);assert.equal(standings.filter(e=>e.competitionId.includes('constructors')).length,11);
const browserSource=fs.readFileSync('index.html','utf8'),vm=require('node:vm');
const inline=browserSource.slice(browserSource.indexOf('function fxAliases('),browserSource.indexOf('const COMPETITION_CLASSIFICATION'));
const context=vm.createContext({});vm.runInContext(inline+';globalThis.reconcile=FEED_FIXTURE_RECONCILIATION;',context);
const gf=events.find(e=>e.id==='evt_84');assert.equal(context.reconcile.reconcileFixtures([gf],[{id:'major-match:nrl-finals-2026:grand-final'}]).length,1,'actual first-render browser alias deduplication');
console.log(`Reconciled ${finals.length} retained AFL/NRL finals, ${upcomingTennis.length} researched upcoming tennis fixtures, full F1 results and championship standings.`);
