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
// Exercise the actual initial Browse default with current selector identities.
const taxonomy=require('../config/selector-taxonomy');
const browse={BASE_SPORT_SELECTOR_ENTITIES:taxonomy.exposedSportNodes,selectorEntityById:id=>taxonomy.byId[id],FOLLOW_FIRST:require('../config/follow-first'),followRatingAffinity:{sports:[]},userPreferences:{}};
vm.createContext(browse);
for(const [from,to] of [['function orderSelectorEntities(entities){','\nfunction orderSelectorEntitiesForDisplay'],['function followBrowseState(){','\nfunction saveFollowBrowse'],['function rootSportKeys(entity){','\nconst followStandingsAvailability']])vm.runInContext(html.slice(html.indexOf(from),html.indexOf(to,html.indexOf(from))),browse);
for(const [selected,sportId,categoryId] of [[['sport:football'],'sport:football',''],[['sport:champions-league'],'sport:football','sport:champions-league'],[['sport:aflw'],'sport:aflw',''],[['sport:f1'],'sport:motorsport','sport:f1'],[[],'sport:tennis','']]){
 browse.userPreferences={selectedSelectorEntityIds:selected,showSpoilers:false};const before=JSON.stringify(browse.userPreferences),state=browse.followBrowseState();
 assert.equal(state.sportId,sportId,'An unused Browse view reflects the existing followed sport or Tennis browsing fallback');assert.equal(state.categoryId,categoryId,'An explicit child selection survives the initial Browse view');assert.equal(JSON.stringify(browse.userPreferences),before,'Reading a default cannot grant follows or change Results');
}
const saved={sportId:'sport:afl',categoryId:'sport:aflw',section:'teams-players',scheduleScope:{round:'Round 4'},page:2};browse.userPreferences={selectedSelectorEntityIds:['sport:football'],followBrowse:saved};assert.equal(browse.followBrowseState(),saved,'An existing complete Browse state wins over current followed-sport ranking');
console.log('Actual first Browse defaults preserve Football/child selection, saved state, empty fallback and sporting preferences.');
// Drive the actual UI merge with real graph/Follow migrations. Native profile
// sections are split from preferences by savePreferences; reloading must not
// allow an intermediate migration's empty graph to erase these sections.
const preferenceSystem=require('../config/preference-system');
let nativeGraph=preferenceSystem.createPreferenceGraph({profileId:'profile:reload-qa',domainIds:['sport:football'],broadcasterIds:['stan','kayo']});
nativeGraph=preferenceSystem.setEntityFollow(nativeGraph,'team:football:epl:1','follow');
nativeGraph=preferenceSystem.setEntityFollow(nativeGraph,'team:football:epl:2','mute');
nativeGraph=preferenceSystem.setEntityFollow(nativeGraph,'team:football:epl:3','unfollow');
nativeGraph.entityFollows.find(f=>f.participantId==='team:football:epl:2').followLevel='mute';
nativeGraph=preferenceSystem.upsertCompetitionPreference(nativeGraph,'competition:uefa-champions-league',{enabled:false});
const merge={DEFAULT_PREFERENCES:{version:26,selectedSelectorEntityIds:[],selectedBroadcasters:['stan','kayo'],pilotMeasurement:{},tennis:{},fifa:{}},activeProfileBundle:{profile:{id:nativeGraph.profileId},domainPreferences:nativeGraph.domainPreferences,competitionPreferences:nativeGraph.competitionPreferences,entityFollows:nativeGraph.entityFollows,viewingPreference:nativeGraph.viewing,learningPreference:nativeGraph.learning},FOLLOW_FIRST:require('../config/follow-first'),DISCOVERY_CATALOGUE:require('../config/discovery-catalogue'),PREFERENCE_SYSTEM:preferenceSystem,PRODUCT_EVENTS:null,PERSONALISED_FEED:null,FEED_CONTROLS:null,RATING_SYSTEM:null,LEGACY_SEEDED_DEFAULTS_VERSION:20,DEFAULT_FIRST_RUN_SELECTOR_IDS:[],BROADCASTER_LIBRARY:{stan:{},kayo:{}},uniqueArray:a=>[...new Set(a||[])],normalizeSelectorEntityIds:a=>a,legacySelectorIdsForFollowedSports:a=>a||[],selectedPreferenceDomainIds:p=>p.selectedSelectorEntityIds,normalizeThemePreference:t=>t||'system',canonicalSportKeysForSelectorIds:a=>a.map(id=>id.replace(/^sport:/,'')),taxonomySelectionForSelectorIds:a=>a,feedIntentForScope:()=> 'balanced',feedScopeForIntent:()=> 'for_you',globalThis:{NOTHINGSPORTS_FANTASY_DEADLINES:{migratePreferences:x=>x,normalizePreferences:x=>x}}};
vm.createContext(merge);vm.runInContext(html.slice(html.indexOf('function mergePreferences(saved){'),html.indexOf('\nfunction saveActivePreferenceGraph')),merge);
const graphChoices=g=>JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(g).filter(([key])=>key!=='updatedAt'))));
const scoped={version:26,selectedSelectorEntityIds:['sport:football'],showSpoilers:false,followFirst:{excludedMajorEventIds:['commonwealth-games'],notifications:{userChoice:false,autoRemindersEnabled:false,sportingRemindersEnabled:false}}};
const untouched=JSON.stringify(scoped),reloaded=merge.mergePreferences(scoped);
assert.deepEqual(graphChoices(reloaded.preferenceGraph),graphChoices(nativeGraph),'Native domain, competition, entity, viewing and learning sections survive the real migrations');assert.equal(JSON.stringify(scoped),untouched,'Hydrating native graph sections cannot mutate the caller');assert.equal(reloaded.followFirst.notifications.userChoice,false);assert.equal(reloaded.followFirst.notifications.autoRemindersEnabled,false);assert(reloaded.followFirst.excludedMajorEventIds.includes('commonwealth-games'));assert.equal(reloaded.showSpoilers,false);
const supplied={...scoped,preferenceGraph:{entityFollows:[]}};assert.equal(merge.mergePreferences(supplied).preferenceGraph.entityFollows.length,0,'An explicitly supplied empty graph wins over retained native follows');
const replacement={...scoped,preferenceGraph:{entityFollows:[{participantId:'team:football:epl:4',followLevel:'priority'}]}};assert.deepEqual(merge.mergePreferences(replacement).preferenceGraph.entityFollows.map(f=>f.participantId),['team:football:epl:4'],'An explicit incoming graph wins without unioning old follows');
merge.activeProfileBundle=null;assert.equal(merge.mergePreferences(scoped).preferenceGraph.entityFollows.length,0,'A new empty profile does not invent follows');
console.log('Actual preference merge retains native graph sections, dispositions and OFF/exclusions; explicit empty/replacement graphs retain precedence.');
let calls=0;const context={activeTab:'follow',followHomeView:'favourites',loadAthletes:()=>{calls++;}};vm.createContext(context);vm.runInContext(html.slice(start,end),context);context.renderCurrentSection();assert.equal(calls,1);
Object.assign(context,{followHomeView:'browse',activeInspectorCodeId:null,startupCoordinator:{isHydrating:()=>true},renderFollowView:()=>{calls++;},renderStartupFeedLoading:()=>{throw Error('Follow cannot render the Feed loading barrier');},scheduleIdentityImageRecovery(){},document:{getElementById:()=>({})}});
context.renderCurrentSection();assert.equal(calls,2,'Browse also renders before Feed readiness');
const renderAll=html.slice(html.indexOf('function renderAll('),html.indexOf('\nfunction firstNormalFeedCard('));
const gate=renderAll.indexOf("} else if (activeTab !== 'follow' && startupCoordinator.isHydrating()){");
assert(gate>=0,'Feed hydration cannot gate Follow');
const favourites=renderAll.indexOf("if ((activeTab === 'follow' && followHomeView === 'favourites' && !activeInspectorCodeId)){");
assert(favourites>=0&&favourites<gate,'favourites stay ahead of the startup barrier');
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
 const c={globalThis:{NOTHINGSPORTS_FIXTURE_IDENTITY:{followedScheduleCodes:()=>[{id:'sport:golf'}],retainedInActiveTimeline:()=>true,fromSchedule:f=>f}},liveFixtureRevision:'loaded',loadCodeInspectorManifest:async()=>({codes:[]}),followedScheduleLoads:new Map(),followedScheduleFixtures:new Map([['sport:golf',[old]]]),disposableStore:{hydrate:async()=>null,set:()=>{}},fetchJson:async()=>({schemaVersion:'code-inspector-chunk.v1',code:{id:'sport:golf'},fixtures:[next]}),buildFollowEligibilityContext:()=>({}),automaticEventFollowReason:e=>first.reasonForEvent(e,explicit),FOLLOW_FIRST:first,activeEvents:[old],eventMeetsDerivedRetention:()=>true,mergeFootballFixtureEvents:x=>x,normalizeEvents:()=>{},rebuildDerivedCardCache:()=>{},startupFunnelFinished:false,FEED_FIXTURE_RECONCILIATION:null,console};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function mergeCanonicalEventPages('),html.indexOf('\nfunction applyFeedEvents(')),c);vm.runInContext(html.slice(html.indexOf('async function loadFollowedScheduleFixtures('),html.indexOf('\nfunction applyLoadedFootballBundle(')),c);
 await c.loadFollowedScheduleFixtures(explicit);assert.deepEqual(c.activeEvents[0].excludedParticipantIds,old.participantIds);assert(!first.reasonForEvent(c.activeEvents[0],explicit),'updated withdrawal removes old Follow eligibility');
 const f1=require('./refresh-f1-standings'),retained=require('../data/canonical/f1-context-2026.json');assert.strictEqual(await f1.refresh(retained,{fetchImpl:async()=>{throw new TypeError('fetch failed')}}),retained);await assert.rejects(f1.refresh(retained,{fetchImpl:async()=>({ok:true,text:async()=>'<table></table>'})}),/Incomplete/);
 console.log('Previously admitted withdrawal reconciliation and bounded F1 source recovery passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
