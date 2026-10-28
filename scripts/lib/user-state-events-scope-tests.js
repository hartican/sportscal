'use strict';
// Actual Events writer/manual queue/API regression; all accounts, rows, DOM and catalogue I/O are disposable.
// This does not identify the private field on the phone and does not alter runtime policy.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const {actualContext}=require('./user-state-optional-view-tests');
const profile=require('../../config/profile-storage'),transport=require('../../config/server-sync'),patches=require('../../config/user-state-sync');
const systems=require('../../config/preference-system'),localApi=require('./local-user-state-api');
const clone=value=>JSON.parse(JSON.stringify(value));
const slice=(from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a);assert(a>=0&&b>a,from);return html.slice(a,b);};
function node(tag){
 return {tag,children:[],dataset:{},isConnected:true,textContent:'',attributes:{},
  append(...items){this.children.push(...items);},appendChild(item){this.append(item);},
  replaceChildren(...items){this.children=[...items];},setAttribute(key,value){this.attributes[key]=value;},
  addEventListener(type,fn){this[type]=fn;},querySelector(){return null;},querySelectorAll(){return [];}};
}
function find(container,label){
 if(container.tag==='button'&&container.textContent===label)return container;
 for(const child of container.children||[]){const found=find(child,label);if(found)return found;}
}
async function runCase(kind){
 const {c,values,storage}=actualContext('assets/js/account-awareness-runtime.js'),api=localApi('A');
 const calls={reads:0,writes:0,catalogueFakeReads:0,renderEffects:0};
 let account='A',generation=0,newReceipt=null;
 const stale=kind.startsWith('owner-')||kind.startsWith('generation-');
 const alterLifetime=()=>{if(kind.startsWith('owner-')){account='B';c.serverPersistence.user={id:'B'};}else{generation++;c.invalidateServerStateSyncScope();}};
 c.serverSyncClient.sessionSubject=()=>account;
 c.serverSyncClient.accountSnapshot=()=>({accountId:account,generation,hasSession:true});
 Object.assign(c,{accountIndicatorJourney:null,serverSyncTimer:null,serverSyncSequence:Promise.resolve(),
  setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_server,current)=>current,clearAcknowledgedFixturePinCommands(){},
  serverErrorEndsSession:error=>error.code==='invalid_refresh_token',
  FOLLOW_FEED_POLICY:require('../../config/follow-feed-policy'),
  document:{readyState:'complete',getElementById:()=>null,createElement:node,querySelector:selector=>selector==='[data-mc-style]'?{}:{content:'596'},querySelectorAll:()=>[]},
  navigator:{clipboard:{writeText:async value=>{c.copied=value;}}},
  NOTHINGSPORTS_APP_UPDATE:{snapshot:()=>({workerVersion:'596'})},
  followCollectionsById:()=>({}),nowAEST:()=>new Date('2026-10-27T00:00:00Z'),formatDateKey:()=> '2026-10-27',
  pendingMajorEventFocusId:null,tennisFeedParentDocument:null,activeTab:'events',
  buildSurfaceCategoryChooser:()=>({selected:'all',select:node('select')}),
  renderEventsView:()=>{calls.renderEffects++;},
  requestFeedRebuildAfterFollowChange:async()=>{},
  fetch:async url=>{assert.equal(url,'data/event-overviews.v1.json');calls.catalogueFakeReads++;return {ok:true,json:async()=>({events:[]})};},
 });
 // Product generation/cache binding belongs to DEPLOY. Existing gate cases still
 // exercise the unchanged generated asset; these new cases qualify exact source
 // over the existing real Account UI/recorder and queue, never call a fake planner.
 for(const file of ['config/account-sync-diagnostic.js','config/preference-intent-reconcile.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 vm.runInContext(slice('function invalidateServerStateSyncScope(','\nasync function reconcileCurrentServerState(')
  +slice('async function reconcileCurrentServerState(','\nfunction syncCurrentServerState(')
  +slice('function syncCurrentServerState(','\nfunction normalizeServerArchiveReferences(')
  +slice('function applyServerStatePreservingChanges(','\nfunction queueServerStateSync(')
  +slice('async function hydrateUserMetaSeed(','\nfunction sydneyPartsFromIso(')
  +slice('function setServerStateBaseline(','\nfunction applyServerStatePreservingChanges(')
  +slice('function toggleMajorEventFollow(','\nfunction majorEventVisibilityPreferences(')
  +slice('function buildEventEditionToggle(','\nfunction buildEuropeanDetail('),c);
 c.eventEditionFollowed=event=>c.FOLLOW_FEED_POLICY.editionDecision(event,c.userPreferences)==='followed';
 const graph=systems.createPreferenceGraph({profileId:'disposable-A',domainIds:['sport:football']});
 graph.domainPreferences=[systems.expandTemplate('disposable-A','sport:football','template:like')];
 const baseScope=kind==='actual-events-followed'?'all':kind==='base-invalid'?null:['legacy-unchanged','already-applied-legacy'].includes(kind)?'legacy':'followed';
 c.userPreferences=c.mergePreferences({version:27,onboardingComplete:true,theme:'day',eventsScope:baseScope,feedCompact:false,
  pilotMeasurement:{enabled:false},followFirst:{notifications:{enabled:false,userChoice:false}},preferenceGraph:graph});
 if(kind==='R2-family'){
  const start=clone(c.userPreferences);start.followFirst.followedMajorEventIds=[];start.followFirst.excludedMajorEventIds=['commonwealth-games'];
  start.followFirst.eventFamilyDecisions={schemaVersion:'event-family-decisions.v1',states:{'commonwealth-games':'excluded'}};
  c.userPreferences=c.mergePreferences(start);assert.equal(c.userPreferences.followFirst.eventFamilyDecisions.states['commonwealth-games'],'excluded');
 }
 const seed=c.currentServerStatePayload();
 // Only this control has a constructed old-row parent absence. Actual normalization
 // then supplies its named defaults; its extra family differences are reported separately.
 if(kind==='constructed-parent-absence')delete seed.preferences.followFirst;
 if(kind==='base-absent'||kind==='intent-missing')delete seed.preferences.eventsScope;
 api.seed(seed);const base=api.state();c.setServerStateBaseline(base);assert.equal(c.applyServerState(base),true);
 assert.equal(c.pendingPreferenceIntent('A'),null);
 vm.runInContext(fs.readFileSync(path.join(root,'config/event-overviews-ui.js'),'utf8'),c);
 const container=node('main');await c.NOTHINGSPORTS_EVENT_OVERVIEWS_UI.render(container);
 const changed=!['actual-events-followed','actual-events-unchanged','constructed-opaque-root','constructed-parent-absence','legacy-unchanged','already-applied-legacy','R2-family'].includes(kind);
 const label=changed?'All events':'Followed events',button=find(container,label);assert(button,'actual Events button '+label);
 const skipsScope=['legacy-unchanged','already-applied-legacy','intent-missing'].includes(kind);
 if(!skipsScope)button.onclick();
 assert.equal(calls.renderEffects,skipsScope?0:1);assert.equal(calls.catalogueFakeReads,1);
 assert.equal(c.userPreferences.eventsScope,['legacy-unchanged','already-applied-legacy'].includes(kind)?'legacy':kind==='intent-missing'?undefined:changed?'all':'followed');
 assert.equal(c.pendingPreferenceIntent('A'),null,'actual view-only writer does not invent a receipt');
 const event={id:'major-event:australian-open-2027',key:'tennis',majorEventId:'major-event:australian-open-2027',date:'2027-01-17'};
 if(kind==='R2-family'){c.toggleMajorEventFollow('commonwealth-games');assert.equal(c.userPreferences.followFirst.eventFamilyDecisions.states['commonwealth-games'],'followed');}
 else if(kind!=='scope-only')c.buildEventEditionToggle(event).onclick({stopPropagation(){}});
 const next=clone(c.userPreferences);next.preferenceGraph=systems.quickAddDomain(next.preferenceGraph,'sport:football','template:casual');
 if(kind==='constructed-opaque-root')next.futureScopePolicy={decision:'keep'};
 if(kind==='intent-invalid')next.eventsScope={invalid:true};
 if(kind==='retained-domain-OFF')next.preferenceGraph.domainPreferences[0].enabled=false;
 if(kind==='domain-empty')next.preferenceGraph.domainPreferences=[];
 assert.equal(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}),true);
 const receipt=clone(c.pendingPreferenceIntent('A'));assert(receipt);assert.equal(Object.keys(receipt).length,6);
 assert.deepEqual(receipt.preferences.eventsScope,c.userPreferences.eventsScope);
 assert(profile.preferenceBaseMatches(receipt,base.preferences),'actual writer retains the accepted base');
 if(kind!=='constructed-parent-absence')assert.equal(receipt.preferences.followFirst.notifications.enabled,false,'OFF remains recorded');
 // Construct the fresh remote agreement in the in-memory actual API. These are
 // fixture choices, not evidence of any private account's history or intent.
 const remote=clone(base);
 if(kind!=='base-compatible-known'){
  remote.preferences.followFirst=clone(receipt.preferences.followFirst);
  if(Object.hasOwn(receipt.preferences,'eventsScope'))remote.preferences.eventsScope=receipt.preferences.eventsScope;
  else delete remote.preferences.eventsScope;
  remote.preferences.feedCompact=true;
 }
 if(kind.startsWith('already-applied-'))remote.preferences=clone(c.currentServerStatePayload().preferences);
 if(kind==='constructed-opaque-root')remote.preferences.futureScopePolicy=clone(receipt.preferences.futureScopePolicy);
 if(kind==='remote-invalid')remote.preferences.eventsScope=false;
 if(kind==='remote-missing')delete remote.preferences.eventsScope;
 if(kind==='scope-divergent')remote.preferences.eventsScope='followed';
 if(kind==='intent-missing')remote.preferences.eventsScope='all';
 if(kind==='domain-conflict')remote.preferences.preferenceGraph.domainPreferences[0]=systems.expandTemplate('remote-A','sport:football','template:froth');
 const setup=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:patches.createPatch(base,remote,{baseUpdatedAt:base.updatedAt})}});
 assert.equal(setup.status,200);assert.deepEqual(api.state().preferences.eventsScope,remote.preferences.eventsScope);
 assert.equal(Object.hasOwn(api.state().preferences,'eventsScope'),Object.hasOwn(remote.preferences,'eventsScope'));
 assert.deepEqual(api.state().preferences.followFirst,remote.preferences.followFirst);
 // Durable receipt reload, not a new bootstrap accepting the latest row: the
 // observed phone says its pending base still equals the accepted app baseline.
 c.activeProfileBundle=profile.loadActiveProfile(storage);assert.deepEqual(clone(c.pendingPreferenceIntent('A')),receipt);
 if(kind.startsWith('already-applied-'))c.setServerStateBaseline(api.state());
 if(kind==='current-edit'){
  const ordinary=clone(c.userPreferences);ordinary.eventsScope='followed';
  assert(c.savePreferences(ordinary,{deferFollowEffects:true}));assert.deepEqual(clone(c.pendingPreferenceIntent('A')),receipt);
 }
 c.serverSyncClient.loadState=async()=>{calls.reads++;const result=await api.handle({method:'GET',url:'/api/user-state',headers:{}});if(stale&&kind.endsWith('read'))alterLifetime();return {user:result.body.user,state:transport.stateFromDatabaseRow(result.body.state)};};
 c.serverSyncClient.savePatch=async patch=>{
  assert.deepEqual(clone(c.pendingPreferenceIntent('A')),newReceipt||receipt,'no pre-ACK receipt rewrite');
  calls.writes++;assert.equal(patch.baseUpdatedAt,api.state().updatedAt);
  if(kind.startsWith('R2-')||kind==='base-compatible-known'){
   const paths=patch.changes.filter(change=>change.path[0]==='preferences').map(change=>change.path.join('.')).sort();
   assert(paths.length<=12&&paths.every(value=>value.length<=160),'bounded disposable path observation');
   const controls=node('aside');c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);
   assert(controls.children[0]);await controls.children[0].click();
   const observed=JSON.parse(c.copied);
   console.log(JSON.stringify({kind:kind==='base-compatible-known'?'ordinary-known-choice-path-observation':kind==='R2-family'?'r2-family-path-observation':kind==='R2-scope'?'r2-scope-path-observation':'r2-domain-path-observation',phase:kind==='base-compatible-known'?'ordinary-base-compatible-save':calls.writes===1?'first-planned-save':'second-explicit-retry',preferencePaths:paths,stage:observed.stage,guard:observed.preferenceGuard}));
   if(kind==='R2-scope'){
    const scope=value=>{const present=Boolean(value&&Object.hasOwn(value,'eventsScope'));return {present,enum:!present?'absent':['all','followed'].includes(value.eventsScope)?value.eventsScope:'invalid'};};
    console.log(JSON.stringify({kind:'r2-scope-owned-observation',phase:calls.writes===1?'first-planned-save':'second-explicit-retry',preferencePaths:paths,guard:observed.preferenceGuard,
     R1:{base:scope(receipt.basePreferences),intent:scope(receipt.preferences)},R2:newReceipt?{base:scope(newReceipt.basePreferences),intent:scope(newReceipt.preferences)}:null,
     accepted:scope(c.serverStateBaseline.state.preferences),remote:scope(api.state().preferences),current:scope(c.currentServerStatePayload().preferences)}));
   }
   if(kind==='R2-family'){
    const family=value=>{const map=value?.followFirst?.eventFamilyDecisions?.states,present=Boolean(map&&Object.hasOwn(map,'commonwealth-games'));return {present,enum:!present?'absent':['followed','excluded'].includes(map['commonwealth-games'])?map['commonwealth-games']:'invalid'};};
    console.log(JSON.stringify({kind:'r2-family-owned-observation',phase:calls.writes===1?'first-planned-save':'second-explicit-retry',preferencePaths:paths,guard:observed.preferenceGuard,
     R1:{base:family(receipt.basePreferences),intent:family(receipt.preferences)},R2:newReceipt?{base:family(newReceipt.basePreferences),intent:family(newReceipt.preferences)}:null,
     accepted:family(c.serverStateBaseline.state.preferences),remote:family(api.state().preferences),current:family(c.currentServerStatePayload().preferences)}));
   }
   if(kind==='R2-domain'&&calls.writes===2){
    assert.equal(observed.preferenceGuard.reason,'compatible_base');
    assert(profile.preferenceBaseMatches(newReceipt,api.state().preferences),'R2 retry uses its exact accepted preference base');
    assert.deepEqual(paths,['preferences.feedCompact','preferences.preferenceGraph.domainPreferences'],'later ordinary retry carries exactly the real R2 template and retained compact view');
    assert.equal(patch.changes.find(change=>change.path.join('.')==='preferences.feedCompact').value,false);
   }
   if(kind==='base-compatible-known'){
    assert.equal(observed.preferenceGuard.reason,'compatible_base');
    assert(profile.preferenceBaseMatches(receipt,api.state().preferences));
    const required=['preferences.eventsScope','preferences.followFirst.eventEditionDecisions.states.'+c.FOLLOW_FEED_POLICY.editionKey(event),'preferences.preferenceGraph.domainPreferences'];
    const allowed=[...required,'preferences.preferenceGraph.updatedAt'];
    assert(required.every(path=>paths.includes(path))&&paths.every(path=>allowed.includes(path)),'ordinary exact-base fixture writes only its declared known choices and optional existing graph timestamp');
    assert.equal(patch.changes.find(change=>change.path.join('.')==='preferences.eventsScope').value,'all');
    for(const change of patch.changes)if(change.path.join('.')==='preferences.preferenceGraph.updatedAt')assert.equal(change.value,receipt.preferences.preferenceGraph.updatedAt);
   }
  }
  const ordinaryR2=kind==='R2-domain'&&calls.writes===2;
  try{assert(kind==='base-compatible-known'||patch.changes.filter(change=>change.path[0]==='preferences').every(change=>
   change.path[1]==='preferenceGraph'&&change.path[2]==='domainPreferences'
   ||ordinaryR2&&change.path.length===2&&change.path[1]==='feedCompact'),
  'scoped saves are domain-only; the proven later compatible-base R2 path adds only compact view, never scope/event/opaque data');}
  catch(error){if(kind==='R2-scope'||kind==='R2-family')console.log(JSON.stringify({kind:kind==='R2-family'?'r2-family-nested-error':'r2-scope-nested-error',code:error.code,name:error.name,operator:error.operator}));throw error;}
  const result=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch}});
  if(result.status!==200)throw Object.assign(Error('Disposable API refusal'),{status:result.status,code:result.body.code});
  if(!newReceipt&&kind.startsWith('R2-')){
   if(kind==='R2-family')c.toggleMajorEventFollow('commonwealth-games');
   else{
    const second=clone(c.userPreferences);
    if(kind==='R2-domain')second.preferenceGraph=systems.quickAddDomain(second.preferenceGraph,'sport:football','template:froth');else second.eventsScope='followed';
    assert(c.savePreferences(second,{deliberate:true,deferFollowEffects:true}));
   }
   newReceipt=clone(c.pendingPreferenceIntent('A'));assert.notEqual(newReceipt.receiptId,receipt.receiptId);
   if(kind==='R2-family')for(const key of ['followedMajorEventIds','excludedMajorEventIds','eventFamilyDecisions','eventEditionDecisions'])assert.deepEqual(newReceipt.preferences.followFirst[key],receipt.basePreferences.followFirst[key],'actual second family toggle returns to the exact canonical original decisions');
   if(kind==='R2-domain'){
    assert.equal(receipt.preferences.preferenceGraph.domainPreferences[0].templateId,'template:casual');
    assert.equal(newReceipt.preferences.preferenceGraph.domainPreferences[0].templateId,'template:froth','the persisted second writer makes a real template change before the old ACK');
    assert.equal(c.userPreferences.preferenceGraph.domainPreferences[0].templateId,'template:froth');
   }
  }
  const state=transport.stateFromDatabaseRow(result.body.state);
  if(kind==='ACK-scope'||kind==='ACK-both')state.preferences.eventsScope='followed';
  if(kind==='ACK-missing-scope')delete state.preferences.eventsScope;
  if(kind==='ACK-event'||kind==='ACK-both')state.preferences.followFirst.eventEditionDecisions.states[c.FOLLOW_FEED_POLICY.editionKey(event)]='excluded';
  if(stale&&kind.endsWith('ACK'))alterLifetime();
  return {user:result.body.user,state};
 };
 if(kind==='cas-disjoint'||kind==='cas-scope-drift')api.raceOnce(()=>api.mutate(state=>{
  if(kind==='cas-scope-drift')state.preferences.eventsScope='followed';
  else state.preferences.preferenceGraph.entityFollows.push({participantId:'team:football:epl:2',followLevel:'follow'});
 }));
 const beforeStored=JSON.stringify([...values]),beforeCurrent=clone(c.currentServerStatePayload()),beforeBaseline=clone(c.serverStateBaseline),beforeRemote=api.state();
 let caught;try{await c.syncCurrentServerState({notify:true});}catch(error){caught=error;}
 if(stale){
  assert.equal(caught,undefined);assert.equal(calls.reads,1);assert.equal(calls.writes,kind.endsWith('ACK')?1:0);
  assert.deepEqual(clone(c.pendingPreferenceIntent('A')),receipt);assert.equal(JSON.stringify([...values]),beforeStored);
  assert.deepEqual(clone(c.currentServerStatePayload()),beforeCurrent);assert.deepEqual(clone(c.serverStateBaseline),beforeBaseline);
  const controls=node('aside');c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);assert.equal(controls.children.length,0,'old lifetime diagnostic is unavailable');
  const result={kind,passed:true,loads:calls.reads,saves:calls.writes,staleReceiptRetained:true};console.log(JSON.stringify(result));return result;
 }
 if(kind.startsWith('R2-')){
  assert.equal(caught,undefined);if(kind==='R2-scope'||kind==='R2-family')assert.deepEqual(clone(c.pendingPreferenceIntent('A')),newReceipt);
  assert.equal(c.pendingPreferenceIntent('A').receiptId,newReceipt.receiptId,'R1 ACK cannot clear R2');
  if(kind==='R2-domain'){
   assert.equal(c.userPreferences.preferenceGraph.domainPreferences[0].templateId,'template:froth');
   assert.equal(c.pendingPreferenceIntent('A').basePreferences.preferenceGraph.domainPreferences[0].templateId,'template:casual');
   assert.equal(c.pendingPreferenceIntent('A').preferences.preferenceGraph.domainPreferences[0].templateId,'template:froth');
   assert.equal(c.serverStateBaseline.state.preferences.preferenceGraph.domainPreferences[0].templateId,'template:casual');
   assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].templateId,'template:casual');
   assert.equal(c.pendingPreferenceIntent('A').baseUpdatedAt,api.state().updatedAt);
   newReceipt=clone(c.pendingPreferenceIntent('A'));await c.syncCurrentServerState({notify:true});assert.equal(c.pendingPreferenceIntent('A'),null);
   assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].templateId,'template:froth');
   assert.equal(c.userPreferences.preferenceGraph.domainPreferences[0].templateId,'template:froth');
  }else{
   assert.equal(c.userPreferences.eventsScope,'followed');
   if(kind==='R2-family')assert.equal(c.userPreferences.followFirst.eventFamilyDecisions.states['commonwealth-games'],'excluded');
   const retained={stored:JSON.stringify([...values]),current:clone(c.currentServerStatePayload()),baseline:clone(c.serverStateBaseline),remote:api.state()};
   let retry;try{await c.syncCurrentServerState();}catch(error){retry=error;}
   assert.equal(retry?.code,'preference_base_changed');assert.equal(calls.writes,1);assert.deepEqual(clone(c.pendingPreferenceIntent('A')),newReceipt);
   assert.equal(JSON.stringify([...values]),retained.stored);assert.deepEqual(clone(c.currentServerStatePayload()),retained.current);
   assert.deepEqual(clone(c.serverStateBaseline),retained.baseline);assert.deepEqual(api.state(),retained.remote,'no second R2 API save');
  }
 }
 const controls=node('aside');c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);
 assert(controls.children[0],'actual Copy sync diagnostic control');await controls.children[0].click();
 const diagnostic=JSON.parse(c.copied),held=['base-invalid','intent-invalid','intent-missing','remote-invalid','remote-missing','scope-divergent','current-edit','constructed-opaque-root','constructed-parent-absence','domain-conflict','cas-scope-drift','ACK-scope','ACK-missing-scope','ACK-event','ACK-both'].includes(kind);
 assert.equal(calls.reads,kind.startsWith('cas-')||kind.startsWith('R2-')?2:1);assert.equal(diagnostic.shellVersion,'596');assert.equal(diagnostic.workerVersion,'596');
 if(held){
  assert.equal(caught?.code,'preference_base_changed');assert.equal(calls.writes,kind==='cas-scope-drift'||kind.startsWith('ACK-')?1:0);
  assert.equal(diagnostic.stage,kind.startsWith('ACK-')?'acknowledge':'verify');assert.equal(diagnostic.completed,false);assert.equal(diagnostic.saveResponseReceived,kind.startsWith('ACK-'));
  assert.equal(diagnostic.pendingReceipt,true);assert.equal(diagnostic.baseCompatible,false);
  assert.equal(diagnostic.ownerMatches,true);assert.equal(diagnostic.generationMatches,true);
  const site=kind==='current-edit'?'owned_current':kind==='domain-conflict'?'record_merge':kind.startsWith('ACK-')?'ack_semantic':'plan_scope';
  assert.equal(diagnostic.preferenceGuard.site,site);assert.equal(diagnostic.preferenceGuard.verifyPass,kind==='cas-scope-drift'?'after_conflict':'initial');
  if(site==='plan_scope')assert.equal(diagnostic.preferenceGuard.reason,'outside_supported_scope_changed');
  assert.deepEqual(clone(c.pendingPreferenceIntent('A')),receipt);
  assert.equal(JSON.stringify([...values]),beforeStored);assert.deepEqual(clone(c.currentServerStatePayload()),beforeCurrent);
  assert.deepEqual(clone(c.serverStateBaseline),beforeBaseline);
  if(kind!=='cas-scope-drift'&&!kind.startsWith('ACK-'))assert.deepEqual(api.state(),beforeRemote);
  if(kind==='constructed-opaque-root')assert.deepEqual(diagnostic.preferenceDifferences,{baseToRemote:['localView','eventDecisions','unknown'],localEdits:['domains','eventDecisions','unknown'],localToRemote:['localView','domains'],receiptBaseMatchesAccepted:true});
  if(kind==='constructed-parent-absence')assert(diagnostic.preferenceDifferences.baseToRemote.includes('unknown'));
 }else if(kind==='R2-scope'||kind==='R2-family'){
  assert.equal(diagnostic.pendingReceipt,true);assert.equal(diagnostic.completed,false);assert.equal(calls.writes,1);
  assert.equal(diagnostic.code,'preference_base_changed');assert.equal(diagnostic.preferenceGuard.site,'plan_scope');
  assert.equal(diagnostic.preferenceGuard.reason,'outside_supported_scope_changed');assert.equal(diagnostic.preferenceGuard.side,'remote');
  assert.equal(diagnostic.stateLoadCallsStarted,1);assert.equal(diagnostic.stateSaveCallsStarted,0,'full verify/queue refuses rather than falling through');
 }else{
  assert.equal(caught,undefined);assert.equal(calls.writes,kind.startsWith('already-applied-')?0:kind==='cas-disjoint'||kind==='R2-domain'?2:1);assert.equal(diagnostic.completed,true);
  assert.equal(diagnostic.pendingReceipt,false);assert.equal(c.pendingPreferenceIntent('A'),null);
  assert.deepEqual(api.state().preferences.eventsScope,kind==='base-compatible-known'?receipt.preferences.eventsScope:remote.preferences.eventsScope);
  if(kind==='domain-empty')assert.deepEqual(api.state().preferences.preferenceGraph.domainPreferences,[]);
  else assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].templateId,kind==='R2-domain'?'template:froth':'template:casual');
  if(kind==='retained-domain-OFF')assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].enabled,false);
  if(kind==='cas-disjoint')assert(api.state().preferences.preferenceGraph.entityFollows.some(row=>row.participantId==='team:football:epl:2'));
  assert.deepEqual(api.state().preferences.followFirst,kind==='base-compatible-known'?receipt.preferences.followFirst:beforeRemote.preferences.followFirst);
  assert.equal(c.userPreferences.feedCompact,false,'existing local-view owner retains this device view');
  if(kind==='actual-events-all')assert.deepEqual(diagnostic.preferenceDifferences,{baseToRemote:['localView','eventDecisions'],localEdits:['localView','domains','eventDecisions'],localToRemote:['localView','domains'],receiptBaseMatchesAccepted:true},'fixed code-owned map classifies Events scope without exposing a private key or value');
  if(kind==='base-compatible-known')assert.equal(diagnostic.preferenceGuard.reason,'compatible_base');
  if(kind.startsWith('already-applied-')){assert.equal(diagnostic.preferenceGuard.reason,'compatible_intent');assert.equal(diagnostic.stateSaveCallsStarted,0);}
 }
 const result={kind,passed:true,sourceQualified:true,generatedCandidateQualified:false,
  caughtCode:caught?.code||null,diagnostic,loads:calls.reads,saves:calls.writes,
  actualScopeButton:skipsScope?null:label,actualCatalogueFakeReads:calls.catalogueFakeReads,persistedReceiptReload:true,
  realBootstrapAfterRemote:false,heldBytesUnchanged:held?true:null,privatePhoneKeyIdentified:false};
 console.log(JSON.stringify(result));return result;
}
function knownRootObservations(){
 const {c,values}=actualContext('assets/js/account-awareness-runtime.js');
 for(const file of ['config/account-sync-diagnostic.js','config/preference-intent-reconcile.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 const base=c.mergePreferences({version:27,onboardingComplete:true,theme:'day'}),results=[];
 for(const [label,key,family,choices] of [
  ['catalogue-version','discoveryCatalogueVersion','format',['fixture-catalogue.v2',{futureShape:'opaque-observation-sentinel'}]],
  ['selector-migration','aflFamilyMigration','selection',[{status:'pending'},['opaque-observation-sentinel']]],
 ])for(const [index,value]of choices.entries()){
  const intent=clone(base);intent[key]=clone(value);
  const receipt={receiptId:'preference-edit:observation',ownerId:'A',generation:0,baseUpdatedAt:'2026-10-27T00:00:00Z',basePreferences:base,preferences:intent};
  const remote={updatedAt:'2026-10-27T00:01:00Z',preferences:clone(intent)};
  const before=JSON.stringify({receipt,remote,storage:[...values]});
  const differences=c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.preferenceDifferences(receipt,remote.preferences,(a,b)=>profile.preferenceBaseMatches({basePreferences:a},b),base);
  assert.deepEqual(clone(differences),{baseToRemote:[family],localEdits:[family],localToRemote:[],receiptBaseMatchesAccepted:true});
  assert(!JSON.stringify(differences).includes(key));assert(!JSON.stringify(differences).includes('opaque-observation-sentinel'));
  const facts=[];
  assert.equal(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.plan(receipt,remote,profile,c.FOLLOW_FIRST,patches,fact=>facts.push(fact)),null,'a named diagnostic family never authorizes an extra plan field');
  assert.equal(facts.at(-1).site,'plan_scope');assert.equal(facts.at(-1).reason,'outside_supported_scope_changed');
  assert.equal(JSON.stringify({receipt,remote,storage:[...values]}),before);
  results.push({kind:label+'-'+index,classifiedFamily:family,planStillHeld:true,passed:true});
 }
 console.log(JSON.stringify({kind:'known-root-observations',cases:results.length,rawKeysOrValuesCopied:false,plannerExemptionsAdded:false}));return results;
}
module.exports=async function eventsScopeTests(){
 new vm.Script(fs.readFileSync(path.join(root,'scripts/validate-account-sync-recovery-browser.js'),'utf8'),{filename:'mounted-recovery-source-only'});
 const results=[];
 for(const kind of ['actual-events-all','actual-events-followed','actual-events-unchanged','scope-only','base-compatible-known','already-applied-known','already-applied-legacy','base-absent','base-invalid','intent-invalid','intent-missing','remote-invalid','remote-missing','scope-divergent','legacy-unchanged','current-edit','constructed-opaque-root','constructed-parent-absence','domain-conflict','retained-domain-OFF','domain-empty','cas-disjoint','cas-scope-drift','ACK-scope','ACK-missing-scope','ACK-event','ACK-both','R2-domain','R2-scope','R2-family','owner-read','generation-read','owner-ACK','generation-ACK'])results.push(await runCase(kind));
 console.log('Events scope: '+results.length+' actual source writer/manual queue/API cases passed; generated Account asset remains ROOT-owned and needs rebuilding.');
 return [...results,...knownRootObservations()];
};
