'use strict';
// Real persisted receipt/bootstrap/queue/API; only auth and database I/O are disposable.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),file=path.join(__dirname,'user-state-account-scope-tests.js');
const helper={module:{exports:{}},require:createRequire(file),__dirname,console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.receiptProbe={sources,context};',helper,{filename:file});
const {sources,context}=helper.module.exports.receiptProbe,profile=require('../../config/profile-storage'),sync=require('../../config/user-state-sync'),transport=require('../../config/server-sync'),follow=require('../../config/follow-first');
const localApi=require('./local-user-state-api'),systems=require('../../config/preference-system'),clone=value=>JSON.parse(JSON.stringify(value));
const cricket=require('../../config/cricket-coverage'),cricketId='team:cricket:australia',bblId='team:cricket:sydney-sixers';
const cricketCases=['cricket-add','cricket-remove-format','cricket-last-OFF','cricket-BBL-alias','cricket-retain-base','cricket-retain-remote','cricket-remove-field','cricket-retain-remote-absence','cricket-writer-order','cricket-conflict','cricket-empty-conflict','cricket-order-conflict','cricket-invalid-enum','cricket-invalid-type','cricket-invalid-duplicate','cricket-invalid-null','cricket-invalid-base','cricket-invalid-remote','cricket-unknown-field','cricket-cas-disjoint','cricket-cas-conflict','new-receipt-cricket','normalization-cricket-unacknowledged'];
const eventAgreementCases=['event-agreed-domain','event-agreed-exclusion','event-agreed-edition','event-empty-inconsistent','event-agreed-domain-OFF',
 'event-divergent','event-extra-roundtrip','event-extra-wrapper','event-future-version','event-edition-extra','event-malformed-map','event-duplicate-list','event-base-default','event-absent-versus-empty','event-empty-versus-absent','event-order-conflict',
 'event-current-edit','event-cas-disjoint','event-cas-event-drift','event-r2-domain','event-r2-event','event-owner-read','event-generation-read','event-owner-ACK','event-generation-ACK','event-invalid-base','event-save-failure','event-ACK-mismatch'];
function formatChoice(preferences,selected,enabled=true,id=cricketId){return cricket.setFormatFollow(preferences,id,selected,enabled);}
function cricketRow(state,id=cricketId){return entities(state).find(row=>row.participantId===id);}
const choice=record=>{const result=clone(record);delete result.profileId;return result;};
const entity='team:football:australian-championship:11255',other='team:football:epl:2';
const entities=state=>state.preferences.preferenceGraph.entityFollows,domains=state=>state.preferences.preferenceGraph.domainPreferences;
const cases=[
 'restart-disjoint','same-record-independent-field','whole-empty-held','domain-empty-held','remove-record','remote-removal','already-applied',
 'domain-OFF','scoped-empty','remote-empty','entity-overlap','domain-overlap','deletion-versus-edit','local-edit-versus-deletion',
 'unknown-root','unknown-graph','unknown-record','unknown-local-view','malformed-local-view','malformed-record','duplicate-entity','duplicate-alias','duplicate-domain','missing-array','non-array',
 'notification-conflict','local-OFF-outside','invalid-identity','invalid-remote-clock','unknown-base','invalid-base-clock','cas-disjoint','cas-overlap','new-receipt-during-ACK','new-receipt-same-field','new-receipt-unknown','ordinary-settings-theme','ordinary-settings-OFF','ordinary-standings-empty','ordinary-settings-unknown','ordinary-settings-view','ordinary-bookkeeping','new-receipt-late-settings','new-receipt-late-bookkeeping','normalization-unacknowledged','normalization-strict-unacknowledged','normalization-domain-unacknowledged','normalization-empty-unacknowledged','normalization-R2-unacknowledged','normalization-acknowledged',
 'late-owner-read','late-generation-read','late-owner-ACK','late-generation-ACK','helper-unavailable',...cricketCases,...eventAgreementCases,
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
async function eventAgreementCase(kind){
 const api=localApi('A'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const graph=systems.createPreferenceGraph({profileId:'local-A',domainIds:['sport:football']});
 graph.domainPreferences=[systems.expandTemplate('local-A','sport:football','template:like')];
 const preferences=follow.migratePreferences({version:27,onboardingComplete:true,theme:'day',showSpoilers:false,
  followFirst:{startupMeta:{sports:[]},notifications:{enabled:false,userChoice:false}},preferenceGraph:graph});
 if(['event-agreed-exclusion','event-empty-inconsistent'].includes(kind)){
  preferences.followFirst.followedMajorEventIds=['commonwealth-games'];
  preferences.followFirst.eventFamilyDecisions.states={'commonwealth-games':'followed'};
 }
 if(kind==='event-base-default')delete preferences.followFirst.eventEditionDecisions;
 api.seed({preferences,profile:{},eventUserState:{},eventSpoilerState:{},archivedEvents:[],ratings:{}});
 const base=api.state(),c=context(sources(),{A:base,B:base}),values=new Map();
 Object.assign(c,{PROFILE_STORAGE:profile,SERVER_SYNC:transport,FOLLOW_FIRST:follow,
  localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
  clonePreferences:clone,queueServerStateSync(){},queueDirectoryFollowEffects(){},requestFeedRebuildAfterFollowChange:async()=>{}});
 c.activeProfileBundle=profile.loadActiveProfile(c.localStorage);
 let generation=0,newReceipt,sent=[];
 c.serverSyncClient.accountSnapshot=()=>({accountId:c.serverSyncClient.sessionSubject(),generation,hasSession:true});
 c.serverStateBaseline={state:clone(base),updatedAt:base.updatedAt,accountId:'A',generation:0};
 if(kind==='event-invalid-base')c.serverStateBaseline.updatedAt='unknown';
 installPersistedApply(c,html,base);c.applyServerState(base);
 const slice=(from,to)=>{const start=html.indexOf(from),end=html.indexOf(to,start);assert(start>=0&&end>start);return html.slice(start,end);};
 vm.runInContext(slice('function saveActiveProfileSections(','\nlet activeFilter =')+'\n'
  +slice('function savePreferences(','\nfunction applyThemePreference(')+'\n'
  +slice('function toggleMajorEventFollow(','\nfunction majorEventVisibilityPreferences(')+'\n'
  +slice('function buildEventEditionToggle(','\nfunction buildEuropeanDetail('),c);
 // The actual deliberate event writer persists its receipt; the next actual
 // preferences save adds an independent domain edit to the same known base.
 if(kind==='event-agreed-edition'){
  c.FOLLOW_FEED_POLICY=require('../../config/follow-feed-policy');c.eventEditionFollowed=()=>false;c.activeTab='events';
  c.document={createElement:()=>({dataset:{},setAttribute(){}}),querySelectorAll:()=>[]};
  const button=c.buildEventEditionToggle({id:'major-event:australian-open-2027',key:'tennis',majorEventId:'major-event:australian-open-2027',date:'2027-01-17'});button.onclick({stopPropagation(){}});
 }else c.toggleMajorEventFollow('commonwealth-games');
 const next=clone(c.userPreferences);next.preferenceGraph=systems.quickAddDomain(next.preferenceGraph,'sport:football','template:casual');
 if(kind==='event-agreed-domain-OFF')next.preferenceGraph.domainPreferences[0].enabled=false;
 if(kind==='event-empty-inconsistent'){
  next.followFirst.followedMajorEventIds=[];next.followFirst.excludedMajorEventIds=[];
  next.followFirst.eventFamilyDecisions={schemaVersion:'event-family-decisions.v1',states:{}};
 }
 if(kind==='event-extra-roundtrip')next.followFirst.futureEventDecisions={schemaVersion:'future-events.v1',states:{future:'followed'}};
 if(kind==='event-extra-wrapper')next.followFirst.eventFamilyDecisions.futureChoice=true;
 if(kind==='event-future-version')next.followFirst.eventFamilyDecisions.schemaVersion='event-family-decisions.v2';
 if(kind==='event-edition-extra')next.followFirst.eventEditionDecisions.futureChoice=true;
 if(kind==='event-malformed-map')next.followFirst.eventFamilyDecisions.states=[];
 if(kind==='event-duplicate-list')next.followFirst.followedMajorEventIds=['commonwealth-games','commonwealth-games'];
 if(kind==='event-order-conflict'){
  next.followFirst.followedMajorEventIds=['commonwealth-games','olympics'];
  next.followFirst.eventFamilyDecisions.states={'commonwealth-games':'followed',olympics:'followed'};
 }
 if(kind==='event-absent-versus-empty')next.followFirst.eventEditionDecisions=undefined;
 assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));
 const original=c.pendingPreferenceIntent('A'),current=clone(c.currentDevice());
 if(kind==='event-absent-versus-empty')assert(!Object.hasOwn(current.preferences.followFirst,'eventEditionDecisions'),'negative fixture must really persist absence, not merge the old empty object');
 assert(original&&profile.preferenceBaseMatches(original,base.preferences));
 const remote=clone(base);remote.preferences.followFirst=clone(current.preferences.followFirst);
 const excluded=state=>{
  state.followFirst.followedMajorEventIds=[];state.followFirst.excludedMajorEventIds=['commonwealth-games'];
  state.followFirst.eventFamilyDecisions={schemaVersion:'event-family-decisions.v1',states:{'commonwealth-games':'excluded'}};
 };
 if(kind==='event-divergent')excluded(remote.preferences);
 if(kind==='event-absent-versus-empty')remote.preferences.followFirst.eventEditionDecisions={schemaVersion:'event-edition-decisions.v1',states:{}};
 if(kind==='event-empty-versus-absent')delete remote.preferences.followFirst.eventEditionDecisions;
 if(kind==='event-order-conflict')remote.preferences.followFirst.followedMajorEventIds.reverse();
 const written=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:sync.createPatch(base,remote,{baseUpdatedAt:base.updatedAt})}});assert.equal(written.status,200);
 // Model exact already-stored empty/legacy-invalid values. The legacy partial
 // Follow-array translator may otherwise replace them before this read seam.
 if(['event-empty-inconsistent','event-extra-wrapper','event-future-version','event-malformed-map','event-duplicate-list','event-edition-extra'].includes(kind)){
  api.mutate(state=>{state.preferences.followFirst=clone(current.preferences.followFirst);});
  assert.deepEqual(api.state().preferences.followFirst,current.preferences.followFirst);
 }
 c.activeProfileBundle=profile.loadActiveProfile(c.localStorage);assert.deepEqual(c.pendingPreferenceIntent('A'),original,'persisted profile read retains actual writer receipt');
 if(kind==='event-current-edit'){
  const ordinary=clone(c.userPreferences);excluded(ordinary);assert(c.savePreferences(ordinary,{deferFollowEffects:true}));
  assert.deepEqual(c.pendingPreferenceIntent('A'),original,'ordinary current edit does not replace the recorded intent');
 }
 c.serverSyncClient.loadState=async()=>{
  c.calls.reads++;const r=await api.handle({method:'GET',url:'/api/user-state',headers:{}});
  if(kind==='event-owner-read')c.switchAccount();
  if(kind==='event-generation-read'){generation++;c.invalidateServerStateSyncScope();}
  return{user:r.body.user,state:transport.stateFromDatabaseRow(r.body.state)};
 };
 c.serverSyncClient.savePatch=async patch=>{
  assert.deepEqual(c.pendingPreferenceIntent('A'),newReceipt||original,'no pre-ACK receipt rewrite');sent.push(clone(patch));c.calls.writes++;
  assert.equal(patch.baseUpdatedAt,api.state().updatedAt,'domain save uses the fresh conditional server version');
  assert(patch.changes.filter(change=>change.path[0]==='preferences').every(change=>change.path[1]==='preferenceGraph'&&change.path[2]==='domainPreferences'),'every preference write is domain-only');
  if(kind==='event-save-failure')throw Object.assign(Error('Disposable unavailable save'),{code:'server_sync_failed'});
  const r=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch}});if(r.status!==200)throw Object.assign(Error('Disposable conflict'),{status:r.status,code:r.body.code});
  if(!newReceipt&&kind==='event-r2-domain'){
   const changed=clone(c.userPreferences);changed.preferenceGraph.domainPreferences[0].enabled=false;
   assert(c.savePreferences(changed,{deliberate:true,deferFollowEffects:true}));newReceipt=c.pendingPreferenceIntent('A');
  }else if(!newReceipt&&kind==='event-r2-event'){c.toggleMajorEventFollow('commonwealth-games');newReceipt=c.pendingPreferenceIntent('A');}
  if(kind==='event-owner-ACK')c.switchAccount();
  if(kind==='event-generation-ACK'){generation++;c.invalidateServerStateSyncScope();}
  const state=transport.stateFromDatabaseRow(r.body.state);if(kind==='event-ACK-mismatch')excluded(state.preferences);
  return{user:r.body.user,state};
 };
 c.document={querySelector:()=>({content:JSON.parse(fs.readFileSync(path.join(root,'app-version.json'),'utf8')).version}),getElementById:()=>null,createElement:()=>({addEventListener(type,fn){this[type]=fn;}})};
 c.navigator={clipboard:{writeText:async value=>{c.copied=value;}}};
 vm.runInContext(fs.readFileSync(path.join(root,'assets/js/account-awareness-runtime.js'),'utf8'),c);
 if(kind==='event-cas-disjoint'||kind==='event-cas-event-drift')api.raceOnce(()=>api.mutate(state=>{
  if(kind==='event-cas-event-drift')excluded(state.preferences);
  else state.preferences.preferenceGraph.entityFollows.push({participantId:other,followLevel:'follow'});
 }));
 const beforeStored=JSON.stringify([...values]),beforeRemote=api.state(),beforeCurrent=clone(c.currentDevice()),beforeBaseline=clone(c.serverStateBaseline);let caught;
 let eventWitnessChecks=0;
 c.PROFILE_STORAGE={...c.PROFILE_STORAGE,preferenceIntentMatches(receipt,...args){
  if(receipt?.originalReceipt){assert.equal(typeof receipt.acceptsAcknowledgement,'function','actual constructed event witness retains its RAM-only ACK proof');eventWitnessChecks++;}
  return profile.preferenceIntentMatches(receipt,...args);
 }};
 try{await c.syncCurrentServerState({notify:true});}catch(error){caught=error;}
 if(['event-owner-read','event-generation-read','event-owner-ACK','event-generation-ACK'].includes(kind)){
  assert.equal(c.calls.reads,1);assert.equal(c.calls.writes,kind.endsWith('ACK')?1:0);
  assert.deepEqual(c.pendingPreferenceIntent('A'),original,'stale owner/generation cannot acknowledge');
  assert.equal(JSON.stringify([...values]),beforeStored,'stale lifetime cannot rewrite persisted choices');
  console.log(JSON.stringify({case:kind,passed:true,reads:c.calls.reads,writes:c.calls.writes,staleReceiptRetained:true}));
  return{kind,passed:true,reads:c.calls.reads,writes:c.calls.writes};
 }
 const controls={children:[],appendChild(button){this.children.push(button);}};c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);await controls.children[0].click();const diagnostic=JSON.parse(c.copied);
 console.log(JSON.stringify({case:kind,diagnostic,reads:c.calls.reads,writes:c.calls.writes}));
 const held=['event-empty-inconsistent','event-divergent','event-extra-roundtrip','event-extra-wrapper','event-future-version','event-edition-extra','event-malformed-map','event-duplicate-list','event-base-default','event-absent-versus-empty','event-empty-versus-absent','event-order-conflict','event-current-edit','event-cas-event-drift','event-invalid-base','event-save-failure','event-ACK-mismatch'].includes(kind);
 if(kind==='event-agreed-domain'&&caught){
  assert.equal(caught.code,'preference_base_changed');assert.equal(diagnostic.preferenceGuard.site,'plan_scope');assert.equal(diagnostic.preferenceGuard.reason,'outside_supported_scope_changed');assert.equal(diagnostic.preferenceGuard.side,'intent');
  assert.deepEqual(diagnostic.preferenceDifferences,{baseToRemote:['eventDecisions'],localEdits:['domains','eventDecisions'],localToRemote:['domains'],receiptBaseMatchesAccepted:true});
  assert.equal(JSON.stringify([...values]),beforeStored);assert.deepEqual(api.state(),beforeRemote);assert.equal(c.calls.writes,0);
 }
 if(held){
  assert(caught,'unsupported or conflicting event choices must retain the guard: '+kind);
  assert.equal(c.pendingPreferenceIntent('A').receiptId,original.receiptId);assert.deepEqual(c.pendingPreferenceIntent('A'),original);
  assert.equal(JSON.stringify([...values]),beforeStored,'held actual preferences/receipt remain durable');
  assert.deepEqual(clone(c.currentDevice()),beforeCurrent);assert.deepEqual(clone(c.serverStateBaseline),beforeBaseline);
  assert.equal(diagnostic.completed,false);assert.equal(diagnostic.pendingReceipt,true);
  assert.equal(c.calls.writes,['event-cas-event-drift','event-save-failure','event-ACK-mismatch'].includes(kind)?1:0);
  if(kind==='event-current-edit')assert.equal(diagnostic.preferenceGuard.reason,'current_differs_from_receipt');
  if(kind==='event-cas-event-drift'){assert.equal(c.calls.reads,2);assert.equal(api.calls.filter(call=>call.status===409).length,1);assert.equal(api.state().preferences.followFirst.eventFamilyDecisions.states['commonwealth-games'],'excluded');}
  else if(kind==='event-ACK-mismatch'){assert.equal(diagnostic.saveResponseReceived,true);assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].templateId,'template:casual');}
  else assert.deepEqual(api.state(),beforeRemote,'held save cannot change remote preferences');
  if(kind==='event-extra-roundtrip')assert.deepEqual(follow.migratePreferences(current.preferences).followFirst.futureEventDecisions,current.preferences.followFirst.futureEventDecisions,'unknown extra really survives the canonical migration');
  if(kind==='event-empty-inconsistent')assert.notDeepEqual(follow.migratePreferences(current.preferences).followFirst,current.preferences.followFirst,'empty lists cannot hide a contradictory retained decision state');
  return{kind,passed:true,reads:c.calls.reads,writes:c.calls.writes};
 }
 assert.equal(caught,undefined,'Already-agreed event choices must not block the remaining independent domain save');
 if(kind==='event-r2-domain'||kind==='event-r2-event'){
  assert(newReceipt&&newReceipt.receiptId!==original.receiptId);assert.equal(c.pendingPreferenceIntent('A').receiptId,newReceipt.receiptId,'old ACK cannot clear R2');
  assert.equal(diagnostic.completed,false);assert.equal(diagnostic.pendingReceipt,true);
  if(kind==='event-r2-event'){
   assert.deepEqual(c.pendingPreferenceIntent('A'),newReceipt,'unsupported newer event edit cannot be rebased by old ACK');
   assert.equal(c.currentDevice().preferences.followFirst.eventFamilyDecisions.states['commonwealth-games'],'excluded');
   const pendingBytes=JSON.stringify([...values]);await assert.rejects(c.syncCurrentServerState(),error=>error.code==='preference_base_changed');assert.equal(c.calls.writes,1);assert.equal(JSON.stringify([...values]),pendingBytes);
  }else{
   assert.equal(c.currentDevice().preferences.preferenceGraph.domainPreferences[0].enabled,false);newReceipt=c.pendingPreferenceIntent('A');
   await c.syncCurrentServerState();assert.equal(c.pendingPreferenceIntent('A'),null);assert.equal(c.calls.writes,2);assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].enabled,false);
  }
 }else{
  assert.equal(c.calls.reads,kind==='event-cas-disjoint'?2:1);assert.equal(c.calls.writes,kind==='event-cas-disjoint'?2:1);
  assert.equal(diagnostic.completed,true);assert.equal(diagnostic.pendingReceipt,false);assert.equal(diagnostic.saveResponseReceived,true);
 }
 assert(sent.every(patch=>!patch.changes.some(change=>change.path[0]==='preferences'&&change.path[1]==='followFirst')),'no event-choice rewrite in any planned patch');
 assert(eventWitnessChecks>0,'actual helper ACK flow must evaluate the accommodated event witness');
 for(const [,body] of values){const data=JSON.parse(body);if(data?.preferenceSync)for(const receipt of data.preferenceSync.entries)assert.equal(Object.keys(receipt).length,6,'ACK proof never enters persisted receipts');}
 assert.equal(JSON.stringify(api.state().preferences.followFirst),JSON.stringify(beforeRemote.preferences.followFirst),'already-agreed remote event bytes remain exact');
 assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].templateId,'template:casual');assert.equal(api.state().preferences.followFirst.notifications.enabled,false);assert.equal(api.state().preferences.showSpoilers,false);
 if(kind==='event-agreed-domain-OFF')assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].enabled,false);
 if(['event-agreed-exclusion','event-agreed-edition'].includes(kind))assert.deepEqual(api.state().preferences.followFirst.followedMajorEventIds,[],'explicit empty Follow list cannot revive');
 if(kind==='event-agreed-edition')assert.deepEqual(api.state().preferences.followFirst.excludedMajorEventIds,[]);
 if(kind==='event-cas-disjoint'){assert(api.state().preferences.preferenceGraph.entityFollows.some(row=>row.participantId===other));assert.equal(api.calls.filter(call=>call.status===409).length,1);}
 if(kind!=='event-r2-event')assert.equal(c.pendingPreferenceIntent('A'),null,'only matching owned ACK clears the actual persisted receipt');
 return{kind,passed:true,reads:c.calls.reads,writes:c.calls.writes};
}
module.exports=async function receiptBaseTests(){
 const results=[];
 const selected=process.env.RECEIPT_BASE_CASE?cases.filter(kind=>kind===process.env.RECEIPT_BASE_CASE):cases;
 assert(selected.length,'known receipt-base case');
 for(const kind of selected){
  if(eventAgreementCases.includes(kind)){results.push(await eventAgreementCase(kind));continue;}
  const api=localApi('A');
  const graph=systems.createPreferenceGraph({profileId:'local-A',domainIds:['sport:football']});
  graph.entityFollows=[{participantId:entity,followLevel:'follow'}];
  graph.domainPreferences=[systems.expandTemplate('local-A','sport:football','template:like',{scopedCompetitionIds:['competition:football:epl']})];
  let preferences=follow.migratePreferences({version:27,onboardingComplete:true,standings:{selectedSportKeys:['football']},theme:'day',showSpoilers:false,feedCompact:false,followBrowse:{sportId:'sport:football',section:'teams-players',page:0},followedSports:[],selectedSelectorEntityIds:[],
   followFirst:{startupMeta:{sports:[]},notifications:{enabled:kind==='ordinary-settings-OFF',userChoice:kind==='ordinary-settings-OFF'}},
   preferenceGraph:graph});
  if(cricketCases.includes(kind)&&!['cricket-add','cricket-BBL-alias','cricket-retain-remote','new-receipt-cricket'].includes(kind))preferences=formatChoice(preferences,'Tests');
  if(['cricket-remove-format','cricket-writer-order','cricket-order-conflict'].includes(kind))preferences=formatChoice(preferences,'ODIs');
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
  if(cricketCases.includes(kind)){
   if(['cricket-add','new-receipt-cricket'].includes(kind))desired.preferences=formatChoice(desired.preferences,'Tests');
   if(kind==='cricket-BBL-alias')desired.preferences=formatChoice(desired.preferences,'BBL',true,'team:cricket:espn-509673');
   if(['cricket-remove-format','cricket-last-OFF','cricket-empty-conflict'].includes(kind))desired.preferences=formatChoice(desired.preferences,'Tests',false);
   if(kind==='cricket-retain-remote')remote.preferences=formatChoice(remote.preferences,'T20Is');
   // The ordinary whole-team writer removes a scoped field: absence means all
   // formats, whereas an explicit empty array still means no formats.
   if(kind==='cricket-remove-field')desired.preferences.preferenceGraph=systems.setEntityFollow(desired.preferences.preferenceGraph,cricketId,'follow');
   if(kind==='cricket-retain-remote-absence')remote.preferences.preferenceGraph=systems.setEntityFollow(remote.preferences.preferenceGraph,cricketId,'priority');
   if(['cricket-writer-order','cricket-order-conflict'].includes(kind))desired.preferences=formatChoice(formatChoice(desired.preferences,'Tests',false),'Tests');
   if(['cricket-conflict','cricket-cas-disjoint','cricket-cas-conflict','normalization-cricket-unacknowledged'].includes(kind))desired.preferences=formatChoice(desired.preferences,'ODIs');
   if(kind==='cricket-conflict'||kind==='cricket-empty-conflict')remote.preferences=formatChoice(remote.preferences,'T20Is');
   if(kind==='cricket-order-conflict')remote.preferences=formatChoice(remote.preferences,'T20Is');
   if(kind==='cricket-invalid-enum')cricketRow(desired).cricketFormats=['Test'];
   if(kind==='cricket-invalid-type')cricketRow(desired).cricketFormats='Tests';
   if(kind==='cricket-invalid-duplicate')cricketRow(desired).cricketFormats=['Tests','Tests'];
   if(kind==='cricket-invalid-null')cricketRow(desired).cricketFormats=null;
   if(kind==='cricket-invalid-base')cricketRow(base).cricketFormats=['Tests','Tests'];
   if(kind==='cricket-invalid-remote')cricketRow(remote).cricketFormats=['unknown-format'];
   if(kind==='cricket-unknown-field')cricketRow(desired).futureEntitySetting=true;
   held=/conflict|invalid|unknown/.test(kind);
  }
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
  c.activeProfileBundle=profile.recordPreferenceIntent(c.localStorage,c.activeProfileBundle,{ownerId:'A',generation:kind==='cricket-add'?7:0,baseUpdatedAt:kind==='unknown-base'?null:kind==='invalid-base-clock'?'unknown':base.updatedAt,basePreferences:base.preferences,preferences:desired.preferences});
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
    let next=clone(desired.preferences);if(kind==='new-receipt-cricket')next=formatChoice(next,'ODIs');if(kind==='new-receipt-same-field')next.preferenceGraph.entityFollows[0].followLevel='priority';if(kind==='new-receipt-unknown')next.futurePolicy=true;next.preferenceGraph.entityFollows.push({participantId:'team:football:epl:4',followLevel:'priority'});
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
    if(kind==='normalization-cricket-unacknowledged')cricketRow(result).cricketFormats=['Tests','T20Is'];
    else if(kind==='normalization-domain-unacknowledged')result.preferences.preferenceGraph.domainPreferences[0].enabled=true;
    else if(kind==='normalization-empty-unacknowledged')result.preferences.preferenceGraph.entityFollows=[{participantId:entity,followLevel:'priority'}];
    else result.preferences.preferenceGraph.entityFollows[0].followLevel='priority';
   }
   return{user:r.body.user,state:result};
  };
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=html.indexOf('function setServerStateBaseline('),end=html.indexOf('function applyServerStatePreservingChanges(',start);
  vm.runInContext(html.slice(start,end),c);
  const persistedApply=kind.startsWith('normalization-')||kind.startsWith('ordinary-')||kind.startsWith('new-receipt-late-')||cricketCases.includes(kind);
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
  if(kind==='cricket-cas-disjoint'||kind==='cricket-cas-conflict')api.raceOnce(()=>api.mutate(state=>{
   if(kind==='cricket-cas-conflict')state.preferences=formatChoice(state.preferences,'T20Is');
   else entities(state).push({participantId:'team:football:epl:5',followLevel:'priority'});
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
  if(cricketCases.includes(kind)){
   const controls={children:[],appendChild(button){this.children.push(button);}};
   c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);await controls.children[0].click();
   const diagnostic=JSON.parse(c.copied);
   console.log(JSON.stringify({case:kind,code:caught?.code||null,guard:diagnostic.preferenceGuard,reads:c.calls.reads,writes:c.calls.writes,completed:diagnostic.completed}));
   if(kind==='cricket-add'){
    assert.equal(diagnostic.generationMatches,true,'live job generation remains current');
    assert.equal(diagnostic.preferenceGuard.receiptGenerationMatches,false,'older receipt generation is an observation, not a second refusal');
    for(const key of ['baseToRemote','localEdits','localToRemote'])assert.deepEqual(diagnostic.preferenceDifferences[key],['localView','entities','domains'],'same reported preference families');
    if(caught){assert.equal(diagnostic.preferenceGuard.site,'record_validation');assert.equal(diagnostic.preferenceGuard.reason,'record_unknown_field');assert.equal(diagnostic.preferenceGuard.side,'intent');assert.equal(diagnostic.preferenceGuard.family,'entities');}
   }
   if(kind.startsWith('cricket-invalid-'))assert.equal(diagnostic.preferenceGuard.reason,'record_field_invalid');
   if(kind==='cricket-invalid-base')assert.equal(diagnostic.preferenceGuard.side,'base');
   if(kind==='cricket-invalid-remote')assert.equal(diagnostic.preferenceGuard.side,'remote');
   if(kind==='cricket-unknown-field')assert.equal(diagnostic.preferenceGuard.reason,'record_unknown_field');
  }
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
   if(kind==='normalization-cricket-unacknowledged')assert.deepEqual(cricketRow(c.currentDevice()).cricketFormats,['Tests','ODIs'],'only matching format ACK accepted');
   if(kind==='normalization-domain-unacknowledged'||kind==='normalization-R2-unacknowledged')assert.equal(domains(c.currentDevice())[0].enabled,false);
   if(kind==='normalization-empty-unacknowledged')assert.deepEqual(entities(c.currentDevice()),[]);
  }else if(held){
   if(malformed)assert(caught,'malformed input fails visibly: '+kind);else assert.equal(caught?.code,'preference_base_changed',kind);assert.equal(c.calls.writes,['cas-overlap','cricket-cas-conflict'].includes(kind)?1:0,kind);
   assert.equal(JSON.stringify([...values]),stored,'hold preserves receipt bytes: '+kind);
   if(cricketCases.includes(kind)){
    assert.deepEqual(clone(c.currentDevice()),currentBefore,'guard preserves current format choices');
    assert.deepEqual(clone(c.serverStateBaseline),baselineBefore,'guard cannot accept a new baseline');
    assert.equal(c.calls.reads,kind==='cricket-cas-conflict'?2:1);
   }
   if(!['cas-overlap','cricket-cas-conflict'].includes(kind))assert.deepEqual(api.state(),remoteBefore,'held state untouched: '+kind);
  }else if(late){
   assert.equal(caught,undefined,kind);assert.equal(JSON.stringify([...values]),stored,'late lifetime cannot ACK receipt: '+kind);
   assert.equal(c.calls.writes,kind.endsWith('-ACK')?1:0,kind);
  }else{
   assert.equal(caught,undefined,'independent owned choices reconcile: '+kind);
   assert.equal(c.calls.reads,['cas-disjoint','cricket-cas-disjoint'].includes(kind)?2:1,'only existing reads/retry: '+kind);
   assert.equal(c.calls.writes,kind==='already-applied'?0:['cas-disjoint','cricket-cas-disjoint'].includes(kind)?2:1,kind);
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
   if(cricketCases.includes(kind)){
    const row=cricketRow(saved,kind==='cricket-BBL-alias'?bblId:cricketId);
    const expected=kind==='cricket-retain-remote'?cricketRow(remoteBefore):kind==='cricket-retain-remote-absence'?cricketRow(remoteBefore):cricketRow(desired,kind==='cricket-BBL-alias'?bblId:cricketId);
    assert.deepEqual(choice(row),choice(expected),'real API preserves exact format order, presence, empty and Follow level: '+kind);
    if(kind!=='new-receipt-cricket')assert.deepEqual(choice(cricketRow(c.currentDevice(),kind==='cricket-BBL-alias'?bblId:cricketId)),choice(expected),'accepted format choices also applied locally');
    if(kind==='cricket-last-OFF'){assert.equal(row.followLevel,'unfollow');assert.deepEqual(row.cricketFormats,[]);}
    if(kind==='cricket-remove-field'||kind==='cricket-retain-remote-absence')assert(!Object.hasOwn(row,'cricketFormats'));
    if(kind==='cricket-writer-order')assert.deepEqual(row.cricketFormats,['ODIs','Tests']);
    if(kind==='cricket-cas-disjoint')assert.equal(api.calls.filter(call=>call.status===409).length,1,'real conditional conflict before recalculated existing retry');
   }
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
    if(kind==='new-receipt-cricket')assert.deepEqual(cricketRow(api.state()).cricketFormats,['Tests','ODIs'],'R2 format edit survives older ACK and explicit retry');
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
