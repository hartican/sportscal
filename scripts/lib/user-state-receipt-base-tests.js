'use strict';
// Real persisted receipt/bootstrap/queue/API; only auth and database I/O are disposable.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),file=path.join(__dirname,'user-state-account-scope-tests.js');
const helper={module:{exports:{}},require:createRequire(file),__dirname,console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.receiptProbe={sources,context};',helper,{filename:file});
const {sources,context}=helper.module.exports.receiptProbe,profile=require('../../config/profile-storage'),sync=require('../../config/user-state-sync'),transport=require('../../config/server-sync'),follow=require('../../config/follow-first');
const localApi=require('./local-user-state-api'),systems=require('../../config/preference-system'),clone=value=>JSON.parse(JSON.stringify(value));
const entity='team:football:australian-championship:11255',other='team:football:epl:2';
const entities=state=>state.preferences.preferenceGraph.entityFollows,domains=state=>state.preferences.preferenceGraph.domainPreferences;
const cases=[
 'restart-disjoint','same-record-independent-field','whole-empty-held','domain-empty-held','remove-record','remote-removal','already-applied',
 'domain-OFF','scoped-empty','remote-empty','entity-overlap','domain-overlap','deletion-versus-edit','local-edit-versus-deletion',
 'unknown-root','unknown-graph','unknown-record','unknown-local-view','malformed-local-view','malformed-record','duplicate-entity','duplicate-alias','duplicate-domain','missing-array','non-array',
 'notification-conflict','local-OFF-outside','invalid-identity','invalid-remote-clock','unknown-base','invalid-base-clock','cas-disjoint','cas-overlap','new-receipt-during-ACK','new-receipt-same-field','new-receipt-unknown','ordinary-settings-theme','ordinary-settings-OFF','ordinary-standings-empty','ordinary-settings-unknown','ordinary-settings-view','ordinary-bookkeeping','new-receipt-late-settings','new-receipt-late-bookkeeping','normalization-unacknowledged','normalization-strict-unacknowledged','normalization-domain-unacknowledged','normalization-empty-unacknowledged','normalization-R2-unacknowledged','normalization-acknowledged',
 'late-owner-read','late-generation-read','late-owner-ACK','late-generation-ACK','helper-unavailable',
];
// Exercise the real apply function and real profile/storage writes for ACK
// acceptance controls. Rendering, optional Feed callbacks and UI normalization
// are inert; these pre-normalized preferences keep the persistence seam exact.
function installPersistedApply(c,html,desired){
 const device=c.currentDevice;
 c.userPreferences=clone(desired.preferences);
 c.currentDevice=c.currentServerStatePayload=()=>({...device(),preferences:clone(c.userPreferences)});
 c.setTimeout=()=>0;c.serverSyncApplying=false;c.activeEvents=[];
 c.NOTHINGSPORTS_FANTASY_DEADLINES={hydratePreferences:(incoming,local)=>incoming??local};
 for(const key of ['clearFantasyPlaceholderSpace','rebuildDerivedCardCache','renderAll','syncLegacyArchiveReferences','applyThemePreference','maybeInviteClassicReview'])c[key]=()=>{};
 c.ensureFeedSourceReadiness=c.backfillWebPushReminders=async()=>{};
 c.mergePreferences=clone;c.migrateEventActionRecords=clone;c.normalizeServerArchiveReferences=items=>clone(items||[]);
 c.document={getElementById:()=>null};
 c.STORAGE_KEYS={preferences:'ns_preferences_v1',eventUserState:'ns_event_user_state_v1',eventSpoilerState:'ns_event_spoiler_state_v1',ratings:'ns_ratings_v1'};
 c.writeStorage=(key,value)=>c.localStorage.setItem(key,JSON.stringify(value));
 const start=html.indexOf('function applyServerState(state){'),end=html.indexOf('async function hydrateUserMetaSeed(',start);
 assert(start>=0&&end>start);vm.runInContext(html.slice(start,end),c);
 const apply=c.applyServerState;c.applyServerState=state=>{try{return apply(state);}catch(error){c.qaApplyError=String(error);throw error;}};
}
module.exports=async function receiptBaseTests(){
 const results=[];
 for(const kind of cases){
  const api=localApi('A');
  const graph=systems.createPreferenceGraph({profileId:'local-A',domainIds:['sport:football']});
  graph.entityFollows=[{participantId:entity,followLevel:'follow'}];
  graph.domainPreferences=[systems.expandTemplate('local-A','sport:football','template:like',{scopedCompetitionIds:['competition:football:epl']})];
  const preferences=follow.migratePreferences({version:27,onboardingComplete:true,standings:{selectedSportKeys:['football']},theme:'day',showSpoilers:false,feedCompact:false,followBrowse:{sportId:'sport:football',section:'teams-players',page:0},followedSports:[],selectedSelectorEntityIds:[],
   followFirst:{startupMeta:{sports:[]},notifications:{enabled:kind==='ordinary-settings-OFF',userChoice:kind==='ordinary-settings-OFF'}},
   preferenceGraph:graph});
  api.seed({preferences,profile:{},eventUserState:{},eventSpoilerState:{},archivedEvents:[],ratings:{}});
  const base=api.state(),desired=clone(base),remote=clone(base);
  desired.preferences.followBrowse={sportId:'sport:cricket',section:'schedule',scheduleScope:{codeId:'sport:cricket',tournamentId:'',competitionId:'test',label:'Test'}};
  desired.preferences.feedCompact=true;
  desired.preferences.preferenceGraph=systems.setEntityFollow(desired.preferences.preferenceGraph,entity,'unfollow');
  desired.preferences.preferenceGraph=systems.quickAddDomain(desired.preferences.preferenceGraph,'sport:football','template:casual');
  remote.preferences.followBrowse={sportId:'sport:tennis',categoryId:'',section:'teams-players'};
  entities(remote).push({participantId:other,followLevel:'follow'});
  domains(remote).push(systems.expandTemplate('local-B','sport:cricket','template:froth'));
  let held=false,late=false;
  if(kind==='same-record-independent-field')domains(remote)[0].reminderDefault='off';
  if(kind==='whole-empty-held'){desired.preferences.preferenceGraph.entityFollows=[];held=true;}
  if(kind==='domain-empty-held'){desired.preferences.preferenceGraph.domainPreferences=[];held=true;}
  if(kind==='remove-record')desired.preferences.preferenceGraph.entityFollows=[];
  if(kind==='remove-record')remote.preferences.preferenceGraph.entityFollows=[entities(remote)[0]];
  if(kind==='remote-removal'){
   entities(desired).push({participantId:'team:football:epl:3',followLevel:'follow'});
   entities(desired)[0].followLevel='follow';remote.preferences.preferenceGraph.entityFollows=[entities(remote)[1]];
  }
  if(kind==='already-applied'){
   entities(remote)[0].followLevel='unfollow';remote.preferences.preferenceGraph.domainPreferences[0]=clone(domains(desired)[0]);
  }
  if(kind==='domain-OFF'||kind==='normalization-domain-unacknowledged')domains(desired)[0].enabled=false;
  if(kind==='normalization-empty-unacknowledged')desired.preferences.preferenceGraph.entityFollows=[];
  if(kind==='scoped-empty')domains(desired)[0].scopedCompetitionIds=[];
  if(kind==='remote-empty'){
   remote.preferences.preferenceGraph.entityFollows=[];desired.preferences.preferenceGraph.entityFollows=[];
  }
  if(kind==='entity-overlap'){entities(remote)[0].followLevel='priority';held=true;}
  if(kind==='domain-overlap'){domains(remote)[0].templateId='template:froth';held=true;}
  if(kind==='deletion-versus-edit'){desired.preferences.preferenceGraph.entityFollows=[];entities(remote)[0].followLevel='priority';held=true;}
  if(kind==='local-edit-versus-deletion'){remote.preferences.preferenceGraph.entityFollows=[];held=true;}
  if(kind==='unknown-root'){remote.preferences.futurePolicy=true;held=true;}
  if(kind==='unknown-graph'){remote.preferences.preferenceGraph.futurePolicy=true;held=true;}
  if(kind==='unknown-record'){domains(remote)[0].futurePolicy=true;held=true;}
  if(kind==='unknown-local-view'){remote.preferences.followBrowse.futurePolicy=true;held=true;}
  if(kind==='malformed-local-view'){remote.preferences.feedCompact='yes';held=true;}
  if(kind==='malformed-record'){domains(remote)[0].enabled='yes';held=true;}
  if(kind==='duplicate-entity'){entities(remote).push(clone(entities(remote)[0]));held=true;}
  if(kind==='duplicate-alias'){
   entities(remote).push({participantId:'athlete:tennis:123',followLevel:'follow'},{participantId:'competitor:tennis:atp:123',followLevel:'priority'});held=true;
  }
  if(kind==='duplicate-domain'){domains(remote).push(clone(domains(remote)[0]));held=true;}
  if(kind==='missing-array'){delete desired.preferences.preferenceGraph.domainPreferences;held=true;}
  if(kind==='non-array'){remote.preferences.preferenceGraph.entityFollows={};held=true;}
  if(kind==='notification-conflict'){remote.preferences.followFirst.notifications.enabled=true;held=true;}
  if(kind==='local-OFF-outside'){desired.preferences.followFirst.notifications.sportingRemindersEnabled=false;held=true;}
  if(kind==='invalid-identity'){domains(remote)[0].sportDomainId='sport:rally';held=true;}
  if(['invalid-remote-clock','unknown-base','invalid-base-clock','helper-unavailable'].includes(kind))held=true;
  if(kind.startsWith('late-'))late=true;
  if(kind==='cas-overlap')held=true;
  // The real API rejects malformed comparison lists at ingress. Inject these
  // negative legacy-read shapes only after an ordinary, valid remote write.
  const malformed=['duplicate-entity','duplicate-alias','duplicate-domain','non-array'].includes(kind);
  const putRemote=malformed?{...remote,preferences:{...remote.preferences,preferenceGraph:clone(base.preferences.preferenceGraph)}}:remote;
  const b=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:sync.createPatch(base,putRemote,{baseUpdatedAt:base.updatedAt})}});assert.equal(b.status,200,kind);
  if(malformed&&kind!=='non-array')api.mutate(state=>{state.preferences.preferenceGraph=clone(remote.preferences.preferenceGraph);});
  const c=context(sources(),{A:desired,B:base});c.PROFILE_STORAGE=profile;c.SERVER_SYNC=transport;
  const values=new Map();c.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  c.activeProfileBundle=profile.loadActiveProfile(c.localStorage);
  c.activeProfileBundle=profile.recordPreferenceIntent(c.localStorage,c.activeProfileBundle,{ownerId:'A',generation:0,baseUpdatedAt:kind==='unknown-base'?null:kind==='invalid-base-clock'?'unknown':base.updatedAt,basePreferences:base.preferences,preferences:desired.preferences});
  const original=c.pendingPreferenceIntent('A');let stored=JSON.stringify([...values]);
  c.serverStateBaseline={state:clone(base),updatedAt:base.updatedAt,accountId:'A',generation:0};
  const mismatchingAck=kind.startsWith('normalization-')&&kind.endsWith('-unacknowledged');
  let authGeneration=0,intercept=false,newReceipt,responseSnapshot;
  c.serverSyncClient.accountSnapshot=()=>({accountId:c.serverSyncClient.sessionSubject(),generation:authGeneration,hasSession:true});
  c.serverSyncClient.loadState=async()=>{
   c.calls.reads++;const r=await api.handle({method:'GET',url:'/api/user-state',headers:{}});assert.equal(r.status,200);
   if(intercept&&kind==='late-owner-read')c.switchAccount();
   if(intercept&&kind==='late-generation-read')c.invalidateServerStateSyncScope();
   const state=transport.stateFromDatabaseRow(r.body.state);
   if(intercept&&kind==='invalid-remote-clock')state.updatedAt='unknown';
   if(kind==='non-array')state.preferences.preferenceGraph.entityFollows={};
   return{user:r.body.user,state};
  };
  c.serverSyncClient.savePatch=async patch=>{
   const exactTimestampAdvance=['normalization-strict-unacknowledged','normalization-empty-unacknowledged'].includes(kind);
   const expectedBeforeSave=exactTimestampAdvance?{...original,baseUpdatedAt:api.state().updatedAt}:newReceipt||original;
   assert.deepEqual(c.pendingPreferenceIntent('A'),expectedBeforeSave,'no pre-ACK choice/base rewrite beyond existing exact timestamp advancement: '+kind);
   c.calls.writes++;const r=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch}});
   if(r.status!==200)throw Object.assign(new Error('Disposable conflict'),{status:r.status,code:r.body.code});
   if((kind.startsWith('new-receipt-')||kind==='normalization-R2-unacknowledged')&&!newReceipt){
    const next=clone(desired.preferences);if(kind==='new-receipt-same-field')next.preferenceGraph.entityFollows[0].followLevel='priority';if(kind==='new-receipt-unknown')next.futurePolicy=true;next.preferenceGraph.entityFollows.push({participantId:'team:football:epl:4',followLevel:'priority'});
    next.preferenceGraph.domainPreferences[0].enabled=false;
    c.activeProfileBundle=profile.recordPreferenceIntent(c.localStorage,c.activeProfileBundle,{ownerId:'A',generation:0,baseUpdatedAt:base.updatedAt,basePreferences:base.preferences,preferences:next});
    newReceipt=c.pendingPreferenceIntent('A');assert.notEqual(newReceipt.receiptId,original.receiptId);
    c.applyServerState({...c.currentDevice(),preferences:next});
    if(kind==='new-receipt-late-settings'){
     c.settingsDraftBaseline=clone(c.userPreferences);c.draftPreferences=clone(c.userPreferences);c.draftPreferences.theme='night';c.saveSettingsPreferences();
     assert.equal(c.pendingPreferenceIntent('A').receiptId,newReceipt.receiptId,'late ordinary Settings write cannot invent R3');
    }else if(kind==='new-receipt-late-bookkeeping'){
     const current=clone(c.userPreferences);current.preferenceGraph.profileId='changed-local';
     for(const name of ['entityFollows','domainPreferences'])for(const record of current.preferenceGraph[name])record.profileId='changed-local';
     c.savePreferences(current);assert.equal(c.pendingPreferenceIntent('A').receiptId,newReceipt.receiptId,'local pointers cannot invent R3');
    }
   }
   if(kind==='late-owner-ACK')c.switchAccount();
   if(kind==='late-generation-ACK'){authGeneration++;c.invalidateServerStateSyncScope();}
   const result=transport.stateFromDatabaseRow(r.body.state);
   responseSnapshot={device:clone(c.currentDevice()),receipt:c.pendingPreferenceIntent('A'),stored:JSON.stringify([...values])};
   if(mismatchingAck&&c.calls.writes===1){
    if(kind==='normalization-domain-unacknowledged')result.preferences.preferenceGraph.domainPreferences[0].enabled=true;
    else if(kind==='normalization-empty-unacknowledged')result.preferences.preferenceGraph.entityFollows=[{participantId:entity,followLevel:'priority'}];
    else result.preferences.preferenceGraph.entityFollows[0].followLevel='priority';
   }
   return{user:r.body.user,state:result};
  };
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=html.indexOf('function setServerStateBaseline('),end=html.indexOf('function applyServerStatePreservingChanges(',start);
  vm.runInContext(html.slice(start,end),c);
  const persistedApply=kind.startsWith('normalization-')||kind.startsWith('ordinary-')||kind.startsWith('new-receipt-late-');
  if(persistedApply)installPersistedApply(c,html,desired);
  await c.bootstrapServerPersistence({checkStatus:false});
  assert.equal(c.serverPersistence.state,'error','bootstrap holds original receipt before deferred helper: '+kind);
  if(!malformed){
   assert.equal(profile.preferenceBaseMatches(c.pendingPreferenceIntent('A'),c.serverStateBaseline.state.preferences),false,kind);
   assert.equal(c.serverStateBaseline.updatedAt,api.state().updatedAt,'bootstrap accepts remote baseline: '+kind);
  }
  if(persistedApply){assert(c.localStorage.getItem('ns_preferences_v1'),'real bootstrap apply writes persisted preferences: '+c.qaApplyError);assert.deepEqual(c.pendingPreferenceIntent('A'),original,'real apply retains receipt');}
  else assert.equal(JSON.stringify([...values]),stored,'bootstrap retains exact persisted intent');
  // A fresh profile read models persisted restart before the explicit retry.
  c.activeProfileBundle=profile.loadActiveProfile(c.localStorage);assert.deepEqual(c.pendingPreferenceIntent('A'),original);stored=JSON.stringify([...values]);
  c.FOLLOW_FIRST=follow;
  c.document={querySelector:()=>({content:JSON.parse(fs.readFileSync(path.join(root,'app-version.json'),'utf8')).version}),getElementById:()=>null,
   createElement:()=>({addEventListener(type,fn){this[type]=fn;}})};
  c.navigator={clipboard:{writeText:async value=>{c.copied=value;}}};
  if(kind!=='helper-unavailable')vm.runInContext(fs.readFileSync(path.join(root,'assets/js/account-awareness-runtime.js'),'utf8'),c);
  if(kind==='cas-disjoint'||kind==='cas-overlap')api.raceOnce(()=>api.mutate(state=>{
   if(kind==='cas-overlap')entities(state)[0].followLevel='priority';
   else{entities(state).push({participantId:'team:football:epl:5',followLevel:'priority'});domains(state)[0].reminderDefault='off';}
  }));
  if(kind.startsWith('ordinary-')||kind.startsWith('new-receipt-late-')){
   const slice=(from,to)=>{const start=html.indexOf(from),end=html.indexOf(to,start);assert(start>=0&&end>start);return html.slice(start,end);};
   vm.runInContext(slice('function saveActiveProfileSections(','\nlet activeFilter =')+'\n'
    +slice('function savePreferences(','\nfunction applyThemePreference(')+'\n'
    +slice('function saveSettingsPreferences(','\nfunction advanceOnboardingOrSave(')+'\n'
    +slice('function selectedStandingsSportKeys(','\nfunction setAllStandingsSportKeys('),c);
   Object.assign(c,{settingsViewportAnchor:null,settingsFirstRun:false,settingsDraftBaseline:clone(c.userPreferences),draftPreferences:clone(c.userPreferences),
    clonePreferences:clone,syncDraftSelectorSports(){},recordSavedPreferenceChanges(){},closeSettings(){},queueServerStateSync(){},
    syncNotificationInstallationPreferences:async()=>{},requestFeedRebuildAfterFollowChange:async()=>{},queueDirectoryFollowEffects(){},SELECTOR_TAXONOMY:{version:'test-only'},standingsFilterSportKeys:()=>['football','cricket']});
   c.STORAGE_KEYS.selectorReleaseAcknowledgement='ns_selector_ack_test';
   if(kind.startsWith('new-receipt-late-')){}
   else if(kind==='ordinary-standings-empty')c.saveStandingsSportKeys([]);
   else if(kind==='ordinary-bookkeeping'){
    const next=clone(c.userPreferences);next.preferenceGraph.updatedAt='2026-10-24T01:00:00Z';next.followFirst.refinement.distinctOpenCount++;
    c.savePreferences(next);
   }else{
    if(kind==='ordinary-settings-theme')c.draftPreferences.theme='night';
    if(kind==='ordinary-settings-OFF'){c.draftPreferences.followFirst.notifications.enabled=false;c.draftPreferences.followFirst.notifications.userChoice=false;}
    if(kind==='ordinary-settings-unknown')c.draftPreferences.futurePreference=true;
    if(kind==='ordinary-settings-view'){c.draftPreferences.followBrowse.sportId='sport:golf';c.draftPreferences.feedCompact=false;}
    c.saveSettingsPreferences();
   }
   assert.deepEqual(c.pendingPreferenceIntent('A'),original,'ordinary real writer does not invent or rewrite R1');
   stored=JSON.stringify([...values]);
  }
  if(['normalization-strict-unacknowledged','normalization-empty-unacknowledged'].includes(kind))api.mutate(state=>{state.preferences=clone(base.preferences);});
  const currentBefore=clone(c.currentDevice()),baselineBefore=clone(c.serverStateBaseline);
  const remoteBefore=api.state();intercept=true;c.calls.reads=0;c.calls.writes=0;let caught;
  try{await c.syncCurrentServerState({notify:true});}catch(error){caught=error;}
  const ordinaryHeld=kind.startsWith('ordinary-')&&!['ordinary-settings-view','ordinary-bookkeeping'].includes(kind);
  if(ordinaryHeld){
   if(kind==='ordinary-settings-theme')assert.equal(c.currentDevice().preferences.theme,'night','actual Settings theme saved before Sync now must not be discarded');
   if(kind==='ordinary-settings-OFF')assert.equal(c.currentDevice().preferences.followFirst.notifications.enabled,false,'actual Settings OFF must not be discarded');
   assert.deepEqual(clone(c.currentDevice()),currentBefore,'unaccounted current choices remain exact: '+kind);
   assert.equal(JSON.stringify([...values]),stored,'primary persisted choices and original receipt remain exact');
   assert.equal(caught?.code,'preference_base_changed',kind);assert.equal(c.calls.writes,0,'no upload of a partial receipt-only plan');
   assert.deepEqual(clone(c.serverStateBaseline),baselineBefore);assert.deepEqual(api.state(),remoteBefore);
   const persisted=profile.loadActiveProfile(c.localStorage);
   for(const key of ['theme','standings','followFirst','futurePreference'])assert.deepEqual(persisted.preferences[key],currentBefore.preferences[key],kind+': primary profile keeps '+key);
  }else if(mismatchingAck){
   const expected=responseSnapshot;
   const durable=JSON.parse(c.localStorage.getItem(profile.KEYS.profilePrefix+c.activeProfileBundle.profile.id));
   const currentRetained=JSON.stringify(c.currentDevice().preferences)===JSON.stringify(expected.device.preferences);
   const persistedRetained=JSON.stringify(durable.entityFollows)===JSON.stringify(expected.device.preferences.preferenceGraph.entityFollows)
    &&JSON.stringify(durable.domainPreferences)===JSON.stringify(expected.device.preferences.preferenceGraph.domainPreferences);
   console.log(JSON.stringify({case:kind,currentRequestedRetained:currentRetained,persistedRequestedRetained:persistedRetained,receiptRetained:Boolean(c.pendingPreferenceIntent('A'))}));
   assert.equal(currentRetained,true,'mismatching success retains all current requested choices');
   assert.equal(persistedRetained,true,'mismatching success retains primary persisted unfollow/OFF/empty choices');
   assert.equal(caught?.code,'preference_base_changed','semantically mismatching success is held before apply');
   assert.equal(c.calls.reads,1);assert.equal(c.calls.writes,1);
   assert.deepEqual(clone(c.currentDevice()),expected.device,'all pending current choices stay exact');
   assert.equal(JSON.stringify([...values]),expected.stored,'all local persisted choices and receipt stay exact');
   assert.deepEqual(c.pendingPreferenceIntent('A'),expected.receipt);assert.deepEqual(clone(c.serverStateBaseline),baselineBefore);
   assert.equal(c.serverPersistence.state,'error');
   if(kind==='normalization-empty-unacknowledged')assert.deepEqual(entities(api.state()),[]);
   else assert.equal(entities(api.state()).find(row=>row.participantId===entity).followLevel,'unfollow','valid actual API save retained; only its disposable response was mutated');
   // A deliberate retry may accept the genuine API state; the refusal adds no retry/read.
   await c.syncCurrentServerState();assert.equal(c.pendingPreferenceIntent('A'),null,'valid owned retry can finish after mismatching response hold');
   assert.equal(c.serverPersistence.state,'signedIn');
   if(kind==='normalization-domain-unacknowledged'||kind==='normalization-R2-unacknowledged')assert.equal(domains(c.currentDevice())[0].enabled,false);
   if(kind==='normalization-empty-unacknowledged')assert.deepEqual(entities(c.currentDevice()),[]);
  }else if(held){
   if(malformed)assert(caught,'malformed input fails visibly: '+kind);else assert.equal(caught?.code,'preference_base_changed',kind);assert.equal(c.calls.writes,kind==='cas-overlap'?1:0,kind);
   assert.equal(JSON.stringify([...values]),stored,'hold preserves receipt bytes: '+kind);
   if(kind!=='cas-overlap')assert.deepEqual(api.state(),remoteBefore,'held state untouched: '+kind);
  }else if(late){
   assert.equal(caught,undefined,kind);assert.equal(JSON.stringify([...values]),stored,'late lifetime cannot ACK receipt: '+kind);
   assert.equal(c.calls.writes,kind.endsWith('-ACK')?1:0,kind);
  }else{
   assert.equal(caught,undefined,'independent owned choices reconcile: '+kind);
   assert.equal(c.calls.reads,kind==='cas-disjoint'?2:1,'only existing reads/retry: '+kind);
   assert.equal(c.calls.writes,kind==='already-applied'?0:kind==='cas-disjoint'?2:1,kind);
   const saved=api.state();
   assert.equal(saved.preferences.followFirst.notifications.enabled,false,kind);assert.equal(saved.preferences.showSpoilers,false);
   assert.deepEqual(saved.preferences.followBrowse,remoteBefore.preferences.followBrowse,'server retains remote view: '+kind);
   assert.equal(saved.preferences.feedCompact,false,'local view never overwrites remote view: '+kind);
   if(!['remove-record','remote-removal','remote-empty'].includes(kind))assert.equal(entities(saved).find(row=>row.participantId===entity)?.followLevel,'unfollow',kind);
   if(!['remove-record','remote-empty'].includes(kind))assert(entities(saved).some(row=>row.participantId===other),'independent remote entity survives: '+kind);
   assert(domains(saved).some(row=>row.sportDomainId==='sport:cricket'),'independent remote domain survives: '+kind);
   assert.equal(domains(saved)[0].templateId,'template:casual',kind);
   if(kind==='same-record-independent-field'||kind==='cas-disjoint')assert.equal(domains(saved)[0].reminderDefault,'off','untouched remote record field survives');
   if(kind!=='new-receipt-unknown')assert(domains(c.currentDevice()).some(row=>row.sportDomainId==='sport:cricket'),'remote domain also renders locally: '+kind);
   if(persistedApply){
    const durable=JSON.parse(c.localStorage.getItem(profile.KEYS.profilePrefix+c.activeProfileBundle.profile.id));
    assert(durable.entityFollows.some(row=>row.participantId===other&&row.followLevel==='follow'),'valid independent remote entity remains durable');
    assert(durable.domainPreferences.some(row=>row.sportDomainId==='sport:cricket'),'valid independent remote domain remains durable');
    if(kind==='ordinary-settings-view'){
     assert.equal(c.currentDevice().preferences.followBrowse.sportId,'sport:golf');assert.equal(c.currentDevice().preferences.feedCompact,false);
     assert.equal(durable.preferences.followBrowse.sportId,'sport:golf');assert.equal(durable.preferences.feedCompact,false);
    }
   }
   if(kind==='domain-OFF')assert.equal(domains(saved)[0].enabled,false);
   if(kind==='scoped-empty')assert.deepEqual(domains(saved)[0].scopedCompetitionIds,[]);
   if(kind==='remote-removal')assert(!entities(saved).some(row=>row.participantId===entity),'remote removal not revived');
   if(kind==='new-receipt-unknown'){
    assert.deepEqual(c.pendingPreferenceIntent('A'),newReceipt,'uncertain R2 keeps exact original receipt');
    assert.equal(c.serverPersistence.state,'error');
    const beforeRetry=JSON.stringify([...values]);await assert.rejects(c.syncCurrentServerState(),error=>error.code==='preference_base_changed');
    assert.equal(JSON.stringify([...values]),beforeRetry);assert.equal(c.calls.writes,1,'unknown continuation never uploads R2');
   }else if(kind==='new-receipt-late-settings'){
    assert.equal(c.currentDevice().preferences.theme,'night','R2 continuation must retain a later actual Settings write');
    const persisted=JSON.parse(c.localStorage.getItem(profile.KEYS.profilePrefix+c.activeProfileBundle.profile.id));
    assert.equal(persisted.preferences.theme,'night','late Settings choice remains durable after R1 ACK/R2 continuation');
    const pending=c.pendingPreferenceIntent('A');assert.equal(pending.receiptId,newReceipt.receiptId);
    assert.deepEqual(pending.basePreferences,saved.preferences,'only confirmed R1 ACK advances R2 base');
    assert.equal(pending.preferences.theme,'day','ordinary late theme does not invent new receipt intent');
    assert.equal(pending.preferences.preferenceGraph.domainPreferences[0].enabled,false);
    assert(persisted.entityFollows.some(row=>row.participantId===other&&row.followLevel==='follow'));
    assert(persisted.domainPreferences.some(row=>row.sportDomainId==='sport:cricket'));
    assert.deepEqual(persisted.preferenceSync.entries.find(entry=>entry.ownerId==='A'),pending,'persisted R2 retains exact known receipt');
    const beforeRetry=JSON.stringify([...values]);await assert.rejects(c.syncCurrentServerState(),error=>error.code==='preference_base_changed');
    assert.equal(c.calls.writes,1,'next explicit Sync now holds unaccounted late choice before uploading R2');assert.equal(JSON.stringify([...values]),beforeRetry);
   }else if(newReceipt){
    const pending=c.pendingPreferenceIntent('A');assert.equal(pending.receiptId,newReceipt.receiptId,'older ACK never clears R2');
    assert.deepEqual(pending.basePreferences,saved.preferences,'only owned ACK advances R2 baseline');
    assert.equal(pending.preferences.preferenceGraph.domainPreferences[0].enabled,false);assert.equal(c.serverPersistence.state,'error');
    newReceipt=pending;await c.syncCurrentServerState();assert.equal(c.pendingPreferenceIntent('A'),null,'R2 can reconcile on existing explicit retry');
    assert(entities(api.state()).some(row=>row.participantId==='team:football:epl:4'&&row.followLevel==='priority'));
    assert(entities(api.state()).some(row=>row.participantId===other));
    if(kind==='new-receipt-same-field')assert.equal(entities(api.state()).find(row=>row.participantId===entity).followLevel,'priority','sequential newer same-field decision survives its older ACK');
    assert.equal(domains(api.state())[0].enabled,false);assert(domains(api.state()).some(row=>row.sportDomainId==='sport:cricket'));
   }else{assert.equal(c.pendingPreferenceIntent('A'),null,'exact owned ACK clears R1: '+kind);assert.equal(c.serverPersistence.state,'signedIn');}
  }
  if(kind==='restart-disjoint'){
   const controls={children:[],appendChild(button){this.children.push(button);}};
   c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);await controls.children[0].click();
   const diagnostic=JSON.parse(c.copied),families=['localView','entities','domains'];
   for(const key of ['baseToRemote','localEdits','localToRemote'])assert.deepEqual(diagnostic.preferenceDifferences[key],families);
   assert.equal(diagnostic.preferenceDifferences.receiptBaseMatchesAccepted,false);
   assert.equal(diagnostic.completed,true);assert.equal(diagnostic.saveResponseReceived,true);assert.equal(diagnostic.pendingReceipt,false);
   console.log(JSON.stringify({case:kind,phoneFamilyPatternReproduced:true,completed:diagnostic.completed,pendingReceipt:diagnostic.pendingReceipt,writes:c.calls.writes}));
  }
  results.push({kind,passed:true,reads:c.calls.reads,writes:c.calls.writes});
 }
 console.log('Receipt-base reconciliation: '+results.length+' compiled-helper bootstrap/persisted-restart/manual queue/API cases passed; independent changes, removals/OFF/empty, CAS, R2 and normalization/lifetime/conflict holds.');
 return results;
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
