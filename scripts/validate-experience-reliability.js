'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../config/follow-feed-policy'),golf=require('../lib/golf-participation'),presentation=require('../config/feed-card-presentation');
const example={id:'golf-test',key:'golf',competitionId:'competition:lpga-tour',name:'Tournament',participantsConfirmed:true,participants:[{id:'competitor:golf:minjee-lee',countryCode:'AU'}],participantIds:['competitor:golf:minjee-lee']};
assert(policy.eligibleForFollow(example,{participantFollow:true}));assert(policy.eligibleForFollow(example,{competitionFollow:true,australiansOnly:true}));assert(!policy.eligibleForFollow(example,{competitionFollow:true}));assert(!policy.eligibleForFollow(example,{participantFollow:true,muted:true}));assert(!policy.eligibleForFollow({...example,participantsConfirmed:false},{competitionFollow:true,australiansOnly:true}));
assert.equal(golf.localInstant('2026-09-25','10:11 AM','America/Chicago'),'2026-09-25T15:11:00.000Z');
assert.equal(golf.localInstant('2026-01-25','10:11 AM','America/Chicago'),'2026-01-25T16:11:00.000Z');
assert.equal(golf.localInstant('2026-09-25','TBC','America/Chicago'),null);
for(const event of require('../data/events.json').events.filter(e=>e.key==='f1'&&e.venueCountryCode)){const path=presentation.circuitAsset(event);assert(path&&fs.existsSync(path),`verified circuit outline: ${event.venue}`);}
assert(!presentation.circuitAsset({key:'f1',venue:'Unknown circuit'}));
// Drive the real routing branch while its deferred scripts are unavailable.
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('function renderCurrentSection(){'),end=html.indexOf('\nfunction renderTabCounts()',start);
let calls=0;const context={activeTab:'match-centre',loadMatchCentre:()=>{calls++;}};vm.createContext(context);vm.runInContext(html.slice(start,end),context);context.renderCurrentSection();assert.equal(calls,1);
assert(html.indexOf("if (activeTab === 'match-centre'){",html.indexOf('function renderAll('))<html.indexOf('} else if (startupCoordinator.isHydrating())',html.indexOf('function renderAll(')));
console.log('Participation admission, timezone conversion, published F1 outlines and route ownership passed.');
const first=require('../config/follow-first'),{buildServerFeed}=require('../lib/server-feed-pipeline');
const preferences={selectedSelectorEntityIds:['sport:golf'],followFirst:{australiansOnlySportIds:['sport:golf']}};
const explicit={preferenceGraph:{entityFollows:[{participantId:'competitor:golf:minjee-lee',followLevel:'follow'}]}};
const future={...example,date:'2026-09-26',endDate:'2026-09-29',dateOnly:true,timePrecision:'date-only'};
for(const p of [preferences,explicit]){
 assert(first.reasonForEvent(future,p));assert(!first.reasonForEvent({...future,participantsConfirmed:false},p));
 assert(!first.reasonForEvent({...future,excludedParticipantIds:future.participantIds},p));
 const r=buildServerFeed({events:[future],userId:'golf-qa',userState:{preferences:p},now:new Date('2026-09-25T00:00:00Z')});assert(r.events.some(e=>e.id===future.id),'server and browser agree');
}
const raw=require('./fixtures/golf/lpga-walmart-2026.json');
const page=objects=>`<script>self.__next_f.push(${JSON.stringify([1,objects.map((o,i)=>`${i}:${JSON.stringify(o)}`).join('\n')])})</script>`;
const entriesOnly=golf.parseLpga(page([raw.tournament,raw.field]),raw);
assert.equal(entriesOnly.entries.length,143);assert.equal(entriesOnly.appearances.length,0);assert(entriesOnly.participantsConfirmed);
assert(!entriesOnly.participantIds.includes('competitor:golf:minjee-lee'),'do not invent a Minjee entry');
const played=golf.parseLpga(page([raw.tournament,raw.draw]),{...raw,entriesHtml:page([raw.tournament,raw.field])});assert.equal(played.appearances.length,48);assert(played.appearances.every(a=>a.startTimeUtc&&a.participantIds.length===3));
const prior=golf.mergeObservation({...played,participantsConfirmed:false,entries:[],appearances:[]},played);assert.deepEqual(prior.appearances,played.appearances,'temporary source failure retains observed times');
const withdrawal=structuredClone(raw.field);withdrawal.entries[0].rows[0][2].text='Withdrawn';const wd=golf.parseLpga(page([raw.tournament,withdrawal]),raw);assert(wd.excludedParticipantIds.length===1);
const pga=require('./fixtures/golf/pga-championship-2026.json');const pgaHtml=`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{dehydratedState:{queries:pga.queries}}}})}</script>`;
const pgaEvent=golf.parsePga(pgaHtml,{base:{id:'pga-test',tournamentId:'R2026033'},sourceUrl:pga.sourceUrl});assert(pgaEvent.participantIds.includes('competitor:golf:min-woo-lee'));assert(pgaEvent.appearances.some(a=>a.participantIds.includes('competitor:golf:min-woo-lee')&&a.startTimeUtc));assert.throws(()=>golf.parsePga(pgaHtml,{base:{tournamentId:'R2027033'}}),/edition mismatch/);
console.log('Source-backed entries, exact pairings, missing fields, withdrawal, stable identities and server parity passed.');

const {contentHash}=require('../lib/live-fixtures');
assert.equal(contentHash([{id:'a',status:'live',score:'1-0',statusCheckedAt:'old',scoreCheckedAt:'old',entries:[{participationCheckedAt:'old'}]}]),contentHash([{id:'a',status:'live',score:'1-0',statusCheckedAt:'new',scoreCheckedAt:'new',entries:[{participationCheckedAt:'new'}]}]),'checking unchanged facts must not create full history revisions');
assert.notEqual(contentHash([{id:'a',score:'1-0'}]),contentHash([{id:'a',score:'2-0'}]),'real score changes still revise facts');

const retainedWithdrawal=golf.mergeObservation({...wd,participantsConfirmed:false,excludedParticipantIds:[]},wd);assert.deepEqual(retainedWithdrawal.excludedParticipantIds,wd.excludedParticipantIds,'source failure must not resurrect withdrawn participants');
assert(html.includes("code.id === 'sport:golf' && retainedIds.has(String(fixture.id)) && fixture.participantsConfirmed === true"),'withdrawals update previously admitted cards before eligibility is recomputed');
(async()=>{
 const old={...future,id:'withdrawal-test'},next={...old,excludedParticipantIds:old.participantIds};
 const c={globalThis:{NOTHINGSPORTS_FIXTURE_IDENTITY:{followedScheduleCodes:()=>[{id:'sport:golf'}],retainedInActiveTimeline:()=>true,fromSchedule:f=>f}},liveFixtureRevision:'loaded',loadCodeInspectorManifest:async()=>({codes:[]}),followedScheduleLoads:new Map(),followedScheduleFixtures:new Map([['sport:golf',[old]]]),disposableStore:{hydrate:async()=>null,set:()=>{}},fetchJson:async()=>({schemaVersion:'code-inspector-chunk.v1',code:{id:'sport:golf'},fixtures:[next]}),buildFollowEligibilityContext:()=>({}),FOLLOW_FIRST:first,activeEvents:[old],eventMeetsDerivedRetention:()=>true,mergeFootballFixtureEvents:x=>x,normalizeEvents:()=>{},rebuildDerivedCardCache:()=>{},startupFunnelFinished:false,FEED_FIXTURE_RECONCILIATION:null,console};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function mergeCanonicalEventPages('),html.indexOf('\nfunction applyFeedEvents(')),c);vm.runInContext(html.slice(html.indexOf('async function loadFollowedScheduleFixtures('),html.indexOf('\nfunction applyLoadedFootballBundle(')),c);
 await c.loadFollowedScheduleFixtures(explicit);assert.deepEqual(c.activeEvents[0].excludedParticipantIds,old.participantIds);assert(!first.reasonForEvent(c.activeEvents[0],explicit),'updated withdrawal removes old Follow eligibility');
 const f1=require('./refresh-f1-standings'),retained=require('../data/canonical/f1-context-2026.json');assert.strictEqual(await f1.refresh(retained,{fetchImpl:async()=>{throw new TypeError('fetch failed')}}),retained);await assert.rejects(f1.refresh(retained,{fetchImpl:async()=>({ok:true,text:async()=>'<table></table>'})}),/Incomplete/);
 console.log('Previously admitted withdrawal reconciliation and bounded F1 source recovery passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
