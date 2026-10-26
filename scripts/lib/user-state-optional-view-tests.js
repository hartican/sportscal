'use strict';
// Real apply/normalizer/writer/payload/profile persistence. UI effects are inert.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const profile=require('../../config/profile-storage'),transport=require('../../config/server-sync'),patches=require('../../config/user-state-sync');
const follow=require('../../config/follow-first'),systems=require('../../config/preference-system');
const slice=(from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a);assert(a>=0&&b>a);return html.slice(a,b);};
function actualContext(helperFile){
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const c={structuredClone,console,PROFILE_STORAGE:profile,SERVER_SYNC:transport,USER_STATE_SYNC:patches,FOLLOW_FIRST:follow,PREFERENCE_SYSTEM:systems,
  DISCOVERY_CATALOGUE:require('../../config/discovery-catalogue'),FEED_CONTROLS:require('../../config/feed-controls'),RATING_SYSTEM:require('../../config/rating-system'),
  PRODUCT_EVENTS:null,PERSONALISED_FEED:null,BROADCASTER_LIBRARY:{},DEFAULT_FIRST_RUN_SELECTOR_IDS:[],DEFAULT_FIRST_RUN_SPORT_KEYS:[],LEGACY_SEEDED_DEFAULTS_VERSION:24,
  NOTHINGSPORTS_FANTASY_DEADLINES:require('../../config/fantasy-deadlines'),
  taxonomySelectionForSelectorIds:()=>null,normalizeSelectorEntityIds:x=>x,legacySelectorIdsForFollowedSports:()=>[],canonicalSportKeysForSelectorIds:()=>[],selectedPreferenceDomainIds:()=>[],
  normalizeThemePreference:x=>x,feedIntentForScope:()=> 'balanced',feedScopeForIntent:()=> 'for_you',uniqueArray:x=>[...new Set(x)],
  localStorage:storage,activeProfileBundle:profile.loadActiveProfile(storage),serverPersistence:{state:'signedIn',user:{id:'A'}},serverStateSyncGeneration:0,
  serverSyncClient:{sessionSubject:()=> 'A',accountSnapshot:()=>({hasSession:true,accountId:'A',generation:0})},
  eventActions:{},eventSpoilerState:{},archivedEventRefs:[],ratings:{},activeEvents:[],serverSyncApplying:false,serverStateBaseline:null,
  setTimeout:()=>0,clearTimeout(){},document:{readyState:'complete',getElementById:()=>null},
  setServerPersistence:patch=>Object.assign(c.serverPersistence,patch),showToast(){},clonePreferences:structuredClone,
  migrateEventActionRecords:structuredClone,normalizeServerArchiveReferences:()=>[],writeStorage:(key,value)=>storage.setItem(key,JSON.stringify(value)),
  STORAGE_KEYS:{preferences:'ns_preferences_v1',eventUserState:'ns_event_user_state_v1',eventSpoilerState:'ns_event_spoiler_state_v1',ratings:'ns_ratings_v1'},
  ensureFeedSourceReadiness:async()=>{},backfillWebPushReminders:async()=>{},fantasyPreferencesDiffer:()=>false,
 };
 for(const name of ['clearFantasyPlaceholderSpace','rebuildDerivedCardCache','renderAll','syncLegacyArchiveReferences','applyThemePreference','maybeInviteClassicReview','queueDirectoryFollowEffects','queueServerStateSync'])c[name]=()=>{};
 vm.createContext(c);
 vm.runInContext(slice('const DEFAULT_PREFERENCES = {','\nconst FEEDBACK_RECIPIENT =')+'\n'
  +slice('function mergePreferences(','\nfunction saveActivePreferenceGraph(')+'\n'
  +slice('function saveActiveProfileSections(','\nlet activeFilter =')+'\n'
  +slice('function savePreferences(','\nfunction applyThemePreference(')+'\n'
  +slice('function currentServerStatePayload(','\nfunction setServerStateBaseline(')+'\n'
  +slice('function applyServerState(state){','\nasync function hydrateUserMetaSeed(')+'\n'
  +slice('function preferenceIntentOwner(','\nfunction acknowledgePreferenceReceipt('),c);
 vm.runInContext(fs.readFileSync(path.join(root,helperFile),'utf8'),c);
 return {c,values,storage};
}
module.exports=async function optionalViewTests(){
 for(const helperFile of ['config/preference-intent-reconcile.js','assets/js/account-awareness-runtime.js']){
 const {c,values,storage}=actualContext(helperFile);
 c.userPreferences=c.mergePreferences({version:27,onboardingComplete:true,theme:'day',pilotMeasurement:{enabled:false}});
 const seed=c.currentServerStatePayload();seed.updatedAt='2026-10-24T00:00:00Z';
 c.serverStateBaseline={state:seed,updatedAt:seed.updatedAt,accountId:'A',generation:0};
 assert(!Object.hasOwn(c.userPreferences,'followBrowse'));assert(!Object.hasOwn(c.userPreferences,'feedCompact'));
 assert.equal(c.applyServerState(seed),true);
 for(const key of ['followBrowse','feedCompact']){
  assert(Object.hasOwn(c.userPreferences,key),'actual apply creates an own optional view key');assert.equal(c.userPreferences[key],undefined);
 }
 const next=structuredClone(c.userPreferences);next.preferenceGraph=systems.setEntityFollow(next.preferenceGraph,'team:football:australian-championship:11255','follow');
 assert.equal(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}),true);
 const receipt=c.pendingPreferenceIntent('A'),current=c.currentServerStatePayload(),durable=profile.loadActiveProfile(storage);
 for(const key of ['followBrowse','feedCompact']){
  assert(Object.hasOwn(current.preferences,key));assert.equal(current.preferences[key],undefined);
  assert(!Object.hasOwn(receipt.preferences,key));assert(!Object.hasOwn(durable.preferences,key));
 }
 const stored=JSON.stringify([...values]),life=c.serverSyncClient.accountSnapshot();
 console.log(JSON.stringify({phase:'optional-view-writer-evidence',helperFile,current:Object.fromEntries(['followBrowse','feedCompact'].map(key=>[key,{own:Object.hasOwn(current.preferences,key),type:typeof current.preferences[key]}])),receiptAbsent:!Object.hasOwn(receipt.preferences,'followBrowse')&&!Object.hasOwn(receipt.preferences,'feedCompact'),durableAbsent:!Object.hasOwn(durable.preferences,'followBrowse')&&!Object.hasOwn(durable.preferences,'feedCompact'),currentFollow:current.preferences.preferenceGraph.entityFollows[0].followLevel,recordedFollow:receipt.preferences.preferenceGraph.entityFollows[0].followLevel,durableFollow:durable.entityFollows[0].followLevel}));
 // Compatible base must accept the genuine writer's absent optional view state.
 assert.equal(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan(receipt,seed,life,current.preferences),null);
 assert.equal(JSON.stringify([...values]),stored,'planning changes no receipt/durable bytes');
 const remote=structuredClone(seed);remote.updatedAt='2026-10-24T00:01:00Z';
 remote.preferences.preferenceGraph=systems.setEntityFollow(remote.preferences.preferenceGraph,'team:football:epl:2','follow');
 const disjoint=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan(receipt,remote,life,current.preferences);
 assert(disjoint,'absent optional views permit the same bounded independent change plan');
 for(const id of ['team:football:australian-championship:11255','team:football:epl:2'])assert(disjoint.receipt.preferences.preferenceGraph.entityFollows.some(record=>record.participantId===id&&record.followLevel==='follow'));
 assert.equal(JSON.stringify([...values]),stored,'disjoint planning retains exact original receipt and durable choices');

 for(const [name,mutate] of [
  ['null-view',p=>{p.followBrowse=null;}],['null-compact',p=>{p.feedCompact=null;}],['unknown-view',p=>{p.followBrowse={futurePolicy:true};}],['invalid-compact',p=>{p.feedCompact='yes';}],
  ['ordinary-theme',p=>{p.theme='night';}],['ordinary-OFF',p=>{p.followFirst.notifications.enabled=!p.followFirst.notifications.enabled;}],
  ['ordinary-empty',p=>{p.preferenceGraph.entityFollows=[];}],['ordinary-unknown',p=>{p.futurePolicy=true;}]
 ]){
  const p=structuredClone(current.preferences);mutate(p);
  assert.throws(()=>c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan(receipt,seed,life,p),error=>error.code==='preference_base_changed',name);
  assert.equal(JSON.stringify([...values]),stored,name+': receipt/durable bytes remain exact');
 }
 console.log(JSON.stringify({helperFile,optionalViews:'actual apply/merge/save/payload/profile seam',ramOwnUndefined:true,durableAndReceiptAbsent:true,accepted:true,negativeHolds:8,persistenceUnchanged:true}));
 }
};
module.exports.actualContext=actualContext;
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
