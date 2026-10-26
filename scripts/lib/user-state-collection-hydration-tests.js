'use strict';
// Actual app apply/merge/save/profile and directory completion; only directory
// transport and UI effects are disposable. No customer or service access.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {actualContext}=require('./user-state-optional-view-tests');
const follow=require('../../config/follow-first'),profile=require('../../config/profile-storage');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const men=require('../../data/follow-directory/tennis.v1.json'),women=require('../../data/follow-directory/tennis-women.v1.json');
const family='collection:tennis:all-time-greats',menOnly='collection:tennis:mens-top-10',identity=follow.participantFollowIdentityKey;
const menIds=new Set(men.collections.find(row=>row.id===family).memberIds.map(identity));
const womenId=women.collections.find(row=>row.id===family).memberIds.find(id=>!menIds.has(identity(id)));
assert(womenId,'public directory fixture must contain a woman absent from the men-only chunk');
const slice=(from,to)=>{const start=html.indexOf(from),end=html.indexOf(to,start);assert(start>=0&&end>start);return html.slice(start,end);};
async function run(helperFile,kind){
 const {c,values}=actualContext(helperFile),gates=new Map(),pending=[];
 let account=['guest','guest-to-owner'].includes(kind)?'':'A',generation=0;
 c.serverSyncClient.sessionSubject=()=>account;
 c.serverSyncClient.accountSnapshot=()=>({hasSession:Boolean(account),accountId:account,generation});
 c.serverPersistence.user=account?{id:account}:null;
 c.followDirectoryChunks=new Map();
 c.loadFollowDirectoryChunk=key=>{
  if(gates.has(key))return gates.get(key).promise;
  let release,reject;
  const promise=new Promise((resolve,fail)=>{release=resolve;reject=fail;}).then(()=>{
   const chunk=key==='tennis'?men:women;c.followDirectoryChunks.set(key,chunk);return chunk;
  });
  gates.set(key,{promise,release,reject});return promise;
 };
 vm.runInContext(slice('function profileHasFootballEntityFollow(','\nfunction reloadBundledCanonicalContextsScript(')+'\n'
  +slice('function followCollectionsById(','\nfunction syncDirectoryFollowButton('),c);
 c.userPreferences=c.mergePreferences({version:27,selectedSelectorEntityIds:[],pilotMeasurement:{enabled:false}});
 const prefs=collection=>c.mergePreferences({version:27,onboardingComplete:true,selectedSelectorEntityIds:[],followedSports:[],
  pilotMeasurement:{enabled:false},preferenceGraph:{entityFollows:[],domainPreferences:[],competitionPreferences:[]},
  followFirst:{collectionFollows:[collection],notifications:{enabled:false,userChoice:false}}});
 const apply=preferences=>assert.equal(c.applyServerState({preferences,profile:{},eventUserState:{},eventSpoilerState:{},ratings:{},archivedEvents:[]}),true);
 c.ensureFeedSourceReadiness=preferences=>{const task=c.ensureFollowCollectionDirectories(preferences);pending.push(task);return task;};
 apply(prefs(kind==='newer-selection'||kind==='in-place-selection'?menOnly:family));
 if(kind==='newer-selection'){
  apply(prefs(family));assert.equal(pending.length,2);
  const current=structuredClone(c.userPreferences),stored=JSON.stringify([...values]);
  gates.get('tennis').release();await pending[0];
  assert.deepEqual(structuredClone(c.userPreferences),current,'old load cannot freeze the new selection using a partial directory');
  assert.equal(JSON.stringify([...values]),stored,'old load cannot persist the partial collection');
  gates.get('tennis-women').release();await pending[1];
  assert.equal(follow.effectiveParticipantFollow(womenId,c.userPreferences,c.followCollectionsById()).followed,true);
  const durable=profile.loadActiveProfile(c.localStorage);
  assert(durable.entityFollows.some(row=>identity(row.participantId)===identity(womenId)&&row.followLevel==='follow'));
 }else{
  if(kind==='owner')account='B';
  if(kind==='ended-session')account='';
  if(kind==='guest-to-owner'){account='A';c.serverPersistence.user={id:account};}
  if(kind==='owner-generation')generation++;
  if(kind==='app-generation')c.serverStateSyncGeneration++;
  if(kind==='profile')c.activeProfileBundle={...c.activeProfileBundle,profile:{...c.activeProfileBundle.profile,id:'profile:other'}};
  if(kind==='in-place-selection')c.userPreferences.followFirst.collectionFollows=[family];
  if(kind==='remove-choice'){
   const state=c.currentServerStatePayload();c.serverStateBaseline={state,updatedAt:'2026-10-26T00:00:00Z',accountId:account,generation};
   const next=structuredClone(c.userPreferences);next.followFirst.collectionFollows=[];
   assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));
  }
  if(kind==='mute'){
   // Preserve a mute already present when this matching load starts; no late
   // write or artificial replacement of the captured preference object.
   c.userPreferences.preferenceGraph.entityFollows.push({participantId:womenId,followLevel:'mute'});
  }
  const before=structuredClone(c.userPreferences),stored=JSON.stringify([...values]),receipt=account?c.pendingPreferenceIntent(account):null;
  gates.get('tennis').release();
  if(kind==='directory-failure'){
   gates.get('tennis-women').reject(Error('Disposable directory unavailable'));
   await assert.rejects(pending[0],/Disposable directory unavailable/);
  }else{
   gates.get('tennis-women')?.release();await pending[0];
  }
  if(['owner','ended-session','guest-to-owner','owner-generation','app-generation','profile','in-place-selection','remove-choice','directory-failure'].includes(kind)){
   assert.deepEqual(structuredClone(c.userPreferences),before,kind+': stale/failed directory cannot change current choices');
   assert.equal(JSON.stringify([...values]),stored,kind+': no stale profile/storage write');
   if(account)assert.deepEqual(c.pendingPreferenceIntent(account),receipt,kind+': no receipt acknowledgement or rewrite');
  }else{
   assert.deepEqual(c.userPreferences.followFirst.collectionFollows,[],'matching complete directory retains the established snapshot migration');
   assert.equal(follow.effectiveParticipantFollow(womenId,c.userPreferences).followed,kind!=='mute');
   assert.equal(c.userPreferences.followFirst.notifications.enabled,false,'directory completion preserves explicit OFF');
   if(kind==='mute')assert.equal(c.userPreferences.preferenceGraph.entityFollows.find(row=>identity(row.participantId)===identity(womenId)).followLevel,'mute');
  }
 }
 return {helperFile,kind,passed:true};
}
module.exports=async function collectionHydrationTests(){
 const results=[];
 for(const helperFile of ['config/preference-intent-reconcile.js','assets/js/account-awareness-runtime.js']){
  for(const kind of ['complete','guest','mute','newer-selection','owner','ended-session','guest-to-owner','owner-generation','app-generation','profile','in-place-selection','remove-choice','directory-failure'])results.push(await run(helperFile,kind));
 }
 console.log('Collection hydration: '+results.length+' actual apply/save/profile/source/helper cases passed; complete matching snapshots, newer choices, OFF/mutes, owned removal receipts and lifetime/failure holds.');
 return results;
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
