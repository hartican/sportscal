'use strict';
// Real reconcile/receipt/API code; disposable auth/database I/O only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const file=path.join(__dirname,'user-state-account-scope-tests.js');
const helper={module:{exports:{}},require:createRequire(file),__dirname,console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.seedProbe={sources,context};',helper,{filename:file});
const {sources,context}=helper.module.exports.seedProbe;
const profile=require('../../config/profile-storage'),follow=require('../../config/follow-first'),transport=require('../../config/server-sync'),patches=require('../../config/user-state-sync');
const localApi=require('./local-user-state-api'),clone=value=>JSON.parse(JSON.stringify(value));
module.exports=async function seedMarkerTests(){
 const results=[];
 for(const kind of ['unfollow','restart-unfollow','restart-older-marker','empty','OFF','theme-conflict','notification-conflict','seed-choice-conflict','unknown-conflict','unknown-followFirst-conflict','cas-choice-conflict','late-owner','late-generation']){
  const api=localApi('A');
  const preferences=follow.migratePreferences({version:27,theme:'day',showSpoilers:false,followedSports:[],selectedSelectorEntityIds:[],
   followFirst:{...(kind==='restart-older-marker'?{appliedSeedHash:'ff_older'}:{}),startupMeta:{sports:[]},notifications:{enabled:kind==='OFF',userChoice:kind==='OFF'}},
   preferenceGraph:{entityFollows:[{participantId:'team:football:australian-championship:11255',followLevel:'follow'}]}});
  api.seed({preferences,profile:{},eventUserState:{},eventSpoilerState:{},archivedEvents:[],ratings:{}});
  const base=api.state(),desired=clone(base);
  if(kind==='empty')desired.preferences.preferenceGraph.entityFollows=[];
  else if(kind==='OFF'){desired.preferences.followFirst.notifications.enabled=false;desired.preferences.followFirst.notifications.userChoice=false;}
  else desired.preferences.preferenceGraph.entityFollows[0].followLevel='unfollow';
  // B's ordinary metadata hydration, not an invented raw server rewrite.
  const hydrated=follow.applyMetaSeed(base.preferences,base.preferences.followFirst.startupMeta);
  assert(hydrated.changed);
  const bPatch=patches.createPatch(base,{...base,preferences:hydrated.preferences},{baseUpdatedAt:base.updatedAt});
  assert.deepEqual(bPatch.changes.map(change=>change.path.join('.')),['preferences.followFirst.appliedSeedHash'],'actual hydration changes only its automatic marker');
  const b=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:bPatch}});assert.equal(b.status,200);
  if(kind==='theme-conflict')api.mutate(state=>{state.preferences.theme='night';});
  if(kind==='notification-conflict')api.mutate(state=>{state.preferences.followFirst.notifications.enabled=true;state.preferences.followFirst.notifications.userChoice=true;});
  if(kind==='seed-choice-conflict'){
   const prior=api.state(),next=follow.applyMetaSeed(prior.preferences,{sports:['football']}).preferences;
   const result=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:patches.createPatch(prior,{...prior,preferences:next},{baseUpdatedAt:prior.updatedAt})}});
   assert.equal(result.status,200);assert.equal(api.state().preferences.followFirst.appliedSeedHash,next.followFirst.appliedSeedHash,'genuine metadata update can apply its valid new marker');
  }
  if(kind==='unknown-conflict')api.mutate(state=>{state.preferences.futureUserPolicy=true;});
  if(kind==='unknown-followFirst-conflict')api.mutate(state=>{state.preferences.followFirst.futureUserPolicy=true;});
  let raceState;
  if(kind==='cas-choice-conflict')api.raceOnce(()=>{api.mutate(state=>{state.preferences.theme='night';});raceState=clone(api.state());});
  const remoteBefore=clone(api.state()),c=context(sources(),{A:desired,B:base});
  c.PROFILE_STORAGE=profile;
  const values=new Map();c.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  c.activeProfileBundle=profile.loadActiveProfile(c.localStorage);
  c.activeProfileBundle=profile.recordPreferenceIntent(c.localStorage,c.activeProfileBundle,{ownerId:'A',generation:0,
   baseUpdatedAt:base.updatedAt,basePreferences:base.preferences,preferences:desired.preferences});
  const acceptedBase=kind.startsWith('restart-')?remoteBefore:base;
  c.serverStateBaseline={state:clone(acceptedBase),updatedAt:acceptedBase.updatedAt,accountId:'A',generation:0};
  c.serverSyncClient.accountSnapshot=()=>({accountId:'A',generation:0,hasSession:true});
  c.serverSyncClient.loadState=async()=>{c.calls.reads++;const result=await api.handle({method:'GET',url:'/api/user-state',headers:{}});assert.equal(result.status,200);
   if(kind==='late-owner')c.switchAccount();
   if(kind==='late-generation')c.invalidateServerStateSyncScope();
   return {user:result.body.user,state:transport.stateFromDatabaseRow(result.body.state)};};
  c.serverSyncClient.savePatch=async patch=>{c.calls.writes++;const result=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch}});
   if(result.status!==200)throw Object.assign(new Error('Disposable conditional write'),{status:result.status,code:result.body.code});
   return {user:result.body.user,state:transport.stateFromDatabaseRow(result.body.state)};};
  const storedBefore=JSON.stringify([...values]);let caught;
  try{await c.syncCurrentServerState();}catch(error){caught=error;}
  const conflict=kind.endsWith('-conflict');
  if(kind.startsWith('late-')){
   assert.equal(caught,undefined);assert.equal(c.calls.writes,0);assert.equal(c.calls.applies,0);
   assert.equal(JSON.stringify([...values]),storedBefore,'stale account/generation cannot acknowledge the owned receipt');
   assert.deepEqual(api.state(),remoteBefore);
  }else if(conflict){
   assert.equal(caught?.code,'preference_base_changed',kind);assert.equal(c.calls.writes,kind==='cas-choice-conflict'?1:0);
   assert.equal(c.calls.reads,kind==='cas-choice-conflict'?2:1,'no extra read outside the existing conditional retry');
   assert.equal(JSON.stringify([...values]),storedBefore,'real changed preferences retain exact pending receipt bytes');
   assert.deepEqual(api.state(),raceState||remoteBefore,'hold never alters newer remote decisions');
  }else{
   assert.equal(caught,undefined,kind+': automatic metadata marker must not block owned pending choices');
   assert.equal(c.calls.reads,1);assert.equal(c.calls.writes,1,'existing one-read/one-save path unchanged');
   assert.equal(c.pendingPreferenceIntent('A'),null,'only the original acknowledged receipt clears');
   assert.equal(api.state().preferences.followFirst.appliedSeedHash,remoteBefore.preferences.followFirst.appliedSeedHash,'local intent cannot overwrite remote hydration marker');
   assert.equal(api.state().preferences.followFirst.notifications.enabled,false,'OFF stays OFF');
   assert.equal(api.state().preferences.showSpoilers,false);
   if(kind==='empty')assert.deepEqual(api.state().preferences.preferenceGraph.entityFollows,[]);
   else if(kind==='unfollow'||kind.startsWith('restart-'))assert.equal(api.state().preferences.preferenceGraph.entityFollows[0].followLevel,'unfollow');
   assert.equal(c.serverPersistence.state,'signedIn');
  }
  results.push({kind,passed:true,reads:c.calls.reads,writes:c.calls.writes});
 }
 const hash='ff_11111111',other='ff_22222222';
 for(const [kind,before,after,expected,noOp] of [
  ['missing-followFirst',null,{startupMeta:{seedHash:hash},appliedSeedHash:hash},hash],
  ['absent-marker',{startupMeta:{seedHash:hash}},{startupMeta:{seedHash:hash},appliedSeedHash:null},null],
  ['legacy-no-seed',{appliedSeedHash:'legacy-old'},{appliedSeedHash:'legacy-new'},'legacy-new'],
  ['unknown-seed-shape',{startupMeta:{seedHash:'future-format'},appliedSeedHash:'old'},{startupMeta:{seedHash:'future-format'},appliedSeedHash:'new'},'new'],
  ['changed-metadata',{startupMeta:{seedHash:hash},appliedSeedHash:hash},{startupMeta:{seedHash:other},appliedSeedHash:null},null],
  ['valid-new-marker',{startupMeta:{seedHash:hash},appliedSeedHash:null},{startupMeta:{seedHash:hash},appliedSeedHash:hash},hash],
  ['marker-no-op',{startupMeta:{seedHash:hash},appliedSeedHash:hash},{startupMeta:{seedHash:hash},appliedSeedHash:null},hash,true],
  ['unknown-field-retained',{startupMeta:{seedHash:hash},appliedSeedHash:hash,futureChoice:'before'},{startupMeta:{seedHash:hash},appliedSeedHash:null,futureChoice:'after'},hash],
 ]){
  const api=localApi('A');api.seed({preferences:before?{followFirst:before}:{}});
  const initial=api.state(),next={...clone(initial),preferences:{...initial.preferences,followFirst:after}};
  const result=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:patches.createPatch(initial,next,{baseUpdatedAt:initial.updatedAt})}});
  assert.equal(result.status,200,kind);assert.equal(api.state().preferences.followFirst.appliedSeedHash,expected,kind);
  if(noOp)assert.equal(api.state().updatedAt,initial.updatedAt,'marker-only stale patch preserves the original no-op timestamp');
  if(kind==='unknown-field-retained')assert.equal(api.state().preferences.followFirst.futureChoice,'after');
  results.push({kind,passed:true});
 }
 console.log('Seed-marker sync: actual metadata hydration/API, pending unfollow/empty/OFF ACK and six genuine-choice/unknown/CAS holds and two owner/generation controls, plus eight API marker-shape/no-op controls passed.');
 return results;
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
