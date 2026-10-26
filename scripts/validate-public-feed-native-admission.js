'use strict';
// Source/DOM checks of native test admission. No browser, HTTP server, database,
// provider or application clock substitution. Ancillary catalogue/layout and
// platform boundaries are controlled; Follow, retention and rebuild are real.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),acorn=require('acorn'),{JSDOM}=require('jsdom');
const pipeline=require('../lib/server-feed-pipeline'),sdk=require('../config/server-sync');
function extract(source,name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);return source.slice(start,acorn.parseExpressionAt(source,start,{ecmaVersion:'latest'}).end);}
async function run(fixture){
 const html=fs.readFileSync('index.html','utf8'),venue=fs.readFileSync('config/venue-panel-ui.js','utf8');
 const model=fixture.scenario(),event=model.event,reference=new Date(event.statusCheckedAt),dom=new JSDOM('<!doctype html><body><main id="listView"></main></body>'),element=()=>dom.window.document.createElement('div'),frames=[],observed=[],removed=[];let notify;
 const preferences=fixture.initialPreferences(model);model.initialPreferences=preferences;
 const context={Date,Map,Set,console,document:dom.window.document,innerHeight:844,userPreferences:preferences,eventActions:{},archivedEventRefs:[],
  canonicalSportsData:null,canonicalPreferenceParticipants:[],footballDirectoryData:null,cardIdentityCache:null,footballFollowIndex:null,leagueDirectoryState:{},directoryFollowIndexCache:null,followDirectoryChunks:new Map(),followEligibilityContextCache:null,
  activeEvents:[],liveFixtureEvents:[],majorEventsDocument:null,tennisFeedParentDocument:null,tennisFeedParentLoading:false,tennisFeedParentError:null,activeTab:'feed',activeFilter:'all',activeView:'list',feedViewFilters:{sport:'all',minimum:0},calendarChoice:{active:false},pendingNotificationEventId:'',todayMoreReveal:false,
  deferredCardImages:new Set(),PERSONALISED_FEED:null,nowAEST:()=>reference,startupCoordinator:{isHydrating:()=>false},
  DISCOVERY_CATALOGUE:require('../config/discovery-catalogue'),discoverySessionInitialized:false,discoverySessionIncludedSportIds:[],NOTHINGSPORTS_FEED_VIEW_FILTER:require('../config/feed-view-filter'),nothingscoreSnapshotFor:()=>null,actualStarValue:()=>null,FEED_CONTROLS:require('../config/feed-controls'),
  FOLLOW_FIRST:require('../config/follow-first'),FOLLOW_FEED_POLICY:require('../config/follow-feed-policy'),TEAM_FOLLOW_CATALOGUE:require('../config/team-follow-catalogue'),CARD_IDENTITIES:require('../config/card-identities'),
  EVENT_ACTION_IDENTITY:require('../config/event-action-identity'),NOTHINGSPORTS_REMINDER_POLICY:require('../config/fixture-reminder-policy'),NOTHINGSPORTS_FIXTURE_IDENTITY:require('../config/fixture-identity'),CARD_LIFECYCLE:require('../config/card-lifecycle'),NOTHINGSPORTS_EPIC:require('../config/epic-classics'),NOTHINGSPORTS_CALENDAR:require('../config/calendar-export'),NOTHINGSPORTS_CRICKET_COVERAGE:require('../config/cricket-coverage'),NOTHINGSPORTS_TENNIS_FEED:require('../config/tennis-feed'),NOTHINGSPORTS_FEED_TIMELINE:require('../config/feed-timeline'),footballDirectoryApi:require('../config/football-directory'),FEED_FIXTURE_RECONCILIATION:require('../config/feed-fixture-reconciliation'),
  // Empty unrelated catalogue and controlled layout/observation boundaries.
  majorEventFeedCandidates:()=>[],automaticallyFollowedMajorEventFixtures:()=>[],selectedMajorEventFixtures:()=>[],
  setTunePromptOpen(){},suppressSessionRatingPrompt(){},closeSettings(){},serverPersistence:{user:{id:model.owner,isAnonymous:false}},cardStateForEvent:()=> 'compact',spoilerSafeDisplayTitle:e=>e.name,buildEventCard:element,
  requestAnimationFrame:fn=>frames.push(fn),IntersectionObserver:class{constructor(callback){notify=callback;}observe(slot){observed.push(slot);}unobserve(slot){removed.push(slot);}disconnect(){}},
  fmtDateHeading:key=>String(key),renderFeedViewActions(){},buildFocusedDiscoveryBanner:()=>null,ensureSessionRatingPrompt(){},orderSurfacedEvents:events=>events,groupEventsByDate:events=>Object.groupBy(events,e=>e.date),buildFeedNowMarker:element,appendFocusedArchiveRecovery(){},observeFeedPageSentinel(){},scheduleInitialCalendarJump(){},
  SPORT_META:{nrl:{label:'Rugby League'}},VENUE_REGISTRY:null,SOURCE_TRUST:require('../config/source-trust'),
 };
 vm.createContext(context);
 for(const name of ['eventActionKey','defaultEventAction','storedEventAction','getEventAction','followCollectionsById','cardIdentityParticipants','directoryFollowIndex','buildFollowEligibilityContext','cachedParticipantFollow','followedParticipantLabel','automaticEventFollowReason','followFeedPolicySource','eventFollowReason','getPreferenceMatchedEvents','getFilteredEvents','tennisFeedInterested','tennisFeedParentCandidates','ensureDiscoverySessionInclusion','discoveryEventIncludedForSession','matchesFeedViewFilters','focusedArchivedEvents','sortedChrono','eventDateTime','formatDateKey','mainFeedFixtureSemanticKey','mergeMainFeedSpecialEvents','renderListView','sydneyPartsFromIso','coerceEventRecord','coerceEventList'])vm.runInContext(extract(html,name),context,{filename:'index.html:'+name});
 for(const name of ['eventParticipantFollowLevels','eventMeetsDerivedRetention','eventIsAutoArchived'])vm.runInContext(extract(venue,name),context,{filename:'config/venue-panel-ui.js:'+name});
 vm.runInContext(html.slice(html.indexOf('const feedCardSlots = new Map();'),html.indexOf('\nfunction appendFeedPageToCurrentList(')),context,{filename:'index.html:actual-slot-owner'});
 const ui=fs.readFileSync('config/public-comments-ui.js','utf8');vm.runInContext(ui.slice(ui.indexOf('  const admitted=()=>'),ui.indexOf('\n  if(!admitted())')),context);context.identity=context.NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(event.id);
 const snapshot=()=>JSON.stringify({preferences:context.userPreferences,actions:context.eventActions}),before=snapshot();
 try{
  // Existing SDK reads the actual pipeline response through its existing Feed
  // route. Auth remains the native matrix's original controlled boundary.
  const token='e30.'+Buffer.from(JSON.stringify({sub:model.owner})).toString('base64url')+'.synthetic',values=new Map([[sdk.SESSION_STORAGE_KEY,JSON.stringify({accessToken:token,refreshToken:'synthetic-only',expiresAt:Date.now()+3600000})]]),paths=[];
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const client=sdk.createClient({storage,persistentStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetchImpl:async (pathname,options={})=>{
   const url=new URL(pathname,'http://127.0.0.1:12345');paths.push(url.pathname);let response;
   await fixture.api({request:()=>({method:()=>options.method||'GET',postDataJSON:()=>options.body?JSON.parse(options.body):null,headers:()=>Object.fromEntries(new Headers(options.headers))}),fulfill:async value=>{response=value;}},model,url);
   return new Response(JSON.stringify(response.json),{status:response.status||200,headers:{'content-type':'application/json'}});
  }});
  const payload=await client.loadFeed({cursor:0,limit:20});
  assert.deepEqual(paths,['/api/feed']);assert.deepEqual(model.apiWrites,[]);assert.equal(payload.schemaVersion,'server-feed.v3');assert.equal(payload.derivedCardCache.buildOrigin,'server');
  context.payload=payload;context.activeEvents=vm.runInContext('coerceEventList(payload)',context);
  assert.equal(context.activeEvents.length,1,'Actual client event coercion retains the pipeline fixture');
  assert.equal(context.eventFollowReason(context.activeEvents[0]).type,'team');assert.equal(context.getFilteredEvents().length,1);
  const state=pipeline.normalizeUserFollowState(fixture.initialUserState(model));assert.equal(state.preferences.followFirst.notifications.enabled,false);assert.equal(state.preferences.followFirst.notifications.userChoice,false);
  assert.equal(state.preferences.followedSports.length,0);assert.equal(state.preferences.selectedSelectorEntityIds.length,0);assert.equal(state.preferences.preferenceGraph.entityFollows.length,1);
  assert.equal(pipeline.shouldEnrichEvent(context.activeEvents[0],state.preferences,{},new Set(),reference),true);
  context.renderListView();const firstSlot=vm.runInContext('[...feedCardSlots.keys()][0]',context);assert(firstSlot.isConnected);assert.equal(vm.runInContext('feedCardSlots.size',context),1);assert(vm.runInContext('Boolean(admitted())',context));
  vm.runInContext('('+fixture.installFixtureHost.toString()+')',context)({event,registered:true,owner:model.owner,anonymous:false,cold:false});assert.equal(context.__publicFeedSlot,firstSlot);assert.equal(snapshot(),before);
  // Real reset + filter + slot rebuild, without a repair/pin/reinsert helper.
  context.renderListView();const secondSlot=vm.runInContext('[...feedCardSlots.keys()][0]',context);assert.notEqual(firstSlot,secondSlot);assert.equal(firstSlot.isConnected,false);assert(secondSlot.isConnected);assert.equal(vm.runInContext('feedCardSlots.size',context),1);assert(vm.runInContext('Boolean(admitted())',context));assert.equal(snapshot(),before);
  while(frames.length)frames.shift()();notify([{target:secondSlot,isIntersecting:false}]);assert(vm.runInContext('Boolean(admitted())',context));
  // Exact empty/unfollowed intent stays empty. It cannot borrow a previous
  // positive test's profile, a hidden slot, a notification target or a pin.
  const empty=fixture.initialPreferences({...model,registered:false});context.userPreferences=empty;context.followEligibilityContextCache=null;const emptyBefore=snapshot();
  assert.equal(context.eventFollowReason(event),null);assert.equal(context.getFilteredEvents().length,0);assert.equal(pipeline.buildServerFeed({events:[event],userId:model.owner,userState:{preferences:empty,event_user_state:{}},now:reference}).events.length,0);context.renderListView();assert.equal(vm.runInContext('feedCardSlots.size',context),0);assert.equal(vm.runInContext('Boolean(admitted())',context),false);assert.equal(snapshot(),emptyBefore);
  assert.throws(()=>vm.runInContext('('+fixture.installFixtureHost.toString()+')',context)({event,registered:true,owner:model.owner,anonymous:false,cold:false}),/did not arrive through the ordinary Feed read/);assert.equal(vm.runInContext('feedCardSlots.size',context),0,'Host setup cannot repair missing admission');assert.equal(snapshot(),emptyBefore);
  for(const anonymous of [false,true]){const negative=fixture.initialPreferences({...model,registered:anonymous,anonymous});assert.equal(negative.preferenceGraph.entityFollows.length,0);assert.equal(negative.followedSports.length,0);assert.equal(negative.selectedSelectorEntityIds.length,0);assert.equal(negative.followFirst.notifications.enabled,false);assert.equal(negative.followFirst.notifications.userChoice,false);}
  context.userPreferences=preferences;context.followEligibilityContextCache=null;context.renderListView();
  context.identity='fixture:unknown';assert.equal(vm.runInContext('Boolean(admitted())',context),false);context.identity=context.NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(event.id);
  context.eventActions[context.EVENT_ACTION_IDENTITY.stableKey(event)]={dismissed:true};assert.equal(vm.runInContext('Boolean(admitted())',context),false);context.eventActions={};
  const slot=vm.runInContext('[...feedCardSlots.keys()][0]',context);slot.remove();notify([{target:slot,isIntersecting:false}]);assert.equal(vm.runInContext('Boolean(admitted())',context),false);assert(removed.includes(slot),'Actual detached cleanup remains enabled');
  const expired={...event,status:'completed',date:'2026-10-01',startTimeUtc:'2026-10-01T01:00:00.000Z',actualEndTimeUtc:'2026-10-01T03:00:00.000Z',statusCheckedAt:'2026-10-01T03:01:00.000Z',scoreCheckedAt:'2026-10-01T03:01:00.000Z'};
  for(const instant of ['2026-10-26T12:59:59.999Z','2026-10-26T13:00:00.001Z']){assert.equal(context.eventMeetsDerivedRetention(event,new Date(instant)),true);assert.equal(context.eventMeetsDerivedRetention(expired,new Date(instant)),false);}
  assert.equal(preferences.followFirst.notifications.enabled,false);assert.equal(preferences.followFirst.notifications.userChoice,false);assert.equal(model.points,25);assert.deepEqual(model.apiWrites,[]);
 }finally{dom.window.close();}
}
module.exports={run};
