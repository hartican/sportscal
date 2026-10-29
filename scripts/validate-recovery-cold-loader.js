'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const recovery=require('../config/local-preference-recovery');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
function slice(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function coldFixture(fixture){
 const f=fixture(),gate=deferred();let loads=0;delete f.c.NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY;
 f.c.document.querySelector=()=>({content:'599'});
 f.c.loadDeferredScript=()=>{loads++;return gate.promise;};
 return {...f,gate,get loads(){return loads;},release(){f.c.NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY=recovery;gate.resolve();}};
}
function scheduledFollowOwner(f){
 let time=0,nextId=0;const tasks=new Map();
 const schedule=(callback,delay=0)=>{const id=++nextId;tasks.set(id,{at:time+delay,callback});return id;};
 const clear=id=>tasks.delete(id);
 Object.assign(f.c,{feedViewGeneration:0,followFeedRefreshPending:false,followFeedRefreshGeneration:0,followFeedRefreshInFlight:null,followFeedRefreshTimer:null,directoryFollowEffectsTimer:null,
  scrollMomentumActive:false,remoteFeedRefreshInFlight:null,
  loadFollowedScheduleFixtures:async()=>{},clearCachedPersonalisedFeed:async()=>{},refreshRemoteFeed:async()=>({source:'server'}),
  setTimeout:schedule,clearTimeout:clear,window:{setTimeout:schedule,clearTimeout:clear,requestIdleCallback:callback=>schedule(callback,0)}});
 vm.runInContext(slice('async function requestFeedRebuildAfterFollowChange(){','\nfunction warmNextFeedPageDuringIdle('),f.c);
 return {async advance(target){
  while(true){const item=[...tasks].filter(([,job])=>job.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;
   const [id,job]=item;tasks.delete(id);time=job.at;await job.callback();
  }time=target;
 }};
}
async function run(fixture=require('./validate-local-preference-recovery').fixture){
 let cases=0;
 const f=coldFixture(fixture),scheduler=scheduledFollowOwner(f),key='ns_profile_v1:'+f.profileId,original=f.values.get(key);
 f.c.queueDirectoryFollowEffects(); // Actual baseline's existing delayed owner is queued BEFORE confirmation.
 const operation=f.c.useSavedAccountPreferences({current:()=>true});let originalFailure;
 try{
  assert.equal(f.loads,1);await scheduler.advance(350);await scheduler.advance(850);
  const observation={kind:'cold-helper-actual-owner',helperStillHeld:true,normalReads:f.counters.read,saveCalls:f.counters.save,busy:f.c.localPreferenceRecoveryBusy,
    rawReceiptUnchanged:f.values.get(key)===original,snapshotCalls:f.counters.snapshot};
  console.log(JSON.stringify(observation));
  assert.equal(f.counters.read,0,'actual scheduled Directory/Follow normal sync cannot start after confirmation while helper is cold');
  assert.equal(f.c.localPreferenceRecoveryBusy,true);assert.equal(f.values.get(key),original);assert.equal(f.counters.snapshot,0);cases++;
 }catch(error){originalFailure=error;}
 finally{f.release();await operation;}
 if(originalFailure)throw originalFailure;
 assert.equal(f.counters.snapshot,1);assert.equal(f.counters.save,0);assert.equal(f.c.localPreferenceRecoveryBusy,false);cases++;
 // Every cold-load exit releases the lock without rewriting the receipt or newer choices.
 for(const [name,mutate]of [
  ['account',x=>{x.c.serverPersistence.user={id:'B'};}],
  ['session',x=>{x.c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'A',generation:1});}],
  ['profile',x=>{x.c.activeProfileBundle={...x.c.activeProfileBundle,profile:{id:'other'}};}],
  ['generation',x=>{x.c.serverStateSyncGeneration++;}],
  ['RAM',x=>{x.c.userPreferences.theme='system';}],
  ['raw',x=>{const k='ns_profile_v1:'+x.profileId;x.values.set(k,x.values.get(k)+' ');}],
  ['baseline',x=>{x.c.serverStateBaseline.updatedAt='2026-10-29T02:00:00Z';}],
  ['modal',x=>{x.open=false;}],
 ]){
  const x=coldFixture(fixture);x.open=true;const key='ns_profile_v1:'+x.profileId;
  const pending=x.c.useSavedAccountPreferences({current:()=>x.open});
  mutate(x);const raw=x.values.get(key),ram=JSON.stringify(x.c.userPreferences);x.release();
  await assert.rejects(pending,undefined,name);assert.equal(x.c.localPreferenceRecoveryBusy,false,name);
  assert.equal(x.values.get(key),raw,name);assert.equal(JSON.stringify(x.c.userPreferences),ram,name);
  assert.equal(x.counters.snapshot,0,name);assert.equal(x.counters.save,0,name);cases++;
 }
 const failed=coldFixture(fixture),failedRaw=failed.values.get('ns_profile_v1:'+failed.profileId);
 const failure=failed.c.useSavedAccountPreferences();failed.gate.reject(new Error('synthetic loader failure'));
 await assert.rejects(failure,/synthetic loader failure/);assert.equal(failed.c.localPreferenceRecoveryBusy,false);
 assert.equal(failed.values.get('ns_profile_v1:'+failed.profileId),failedRaw);assert.equal(failed.counters.snapshot,0);cases++;
 const invalidator=fixture();invalidator.c.NOTHINGSPORTS_EPIC_UI={reset(){throw new Error('synthetic invalidation failure');}};
 await assert.rejects(invalidator.c.useSavedAccountPreferences(),/synthetic invalidation failure/);
 assert.equal(invalidator.c.localPreferenceRecoveryBusy,false);assert.equal(invalidator.counters.snapshot,0);cases++;
 const duplicate=coldFixture(fixture),first=duplicate.c.useSavedAccountPreferences();
 await assert.rejects(duplicate.c.useSavedAccountPreferences(),/already running/);
 assert.equal(duplicate.c.localPreferenceRecoveryBusy,true);assert.equal(duplicate.loads,1);
 assert.equal(duplicate.c.queueServerStateSync(),false);await duplicate.c.syncCurrentServerState();assert.equal(duplicate.counters.read,0);
 duplicate.release();await first;assert.equal(duplicate.counters.snapshot,1);assert.equal(duplicate.c.localPreferenceRecoveryBusy,false);cases++;
 // Recovery waits for issued work to finish; it does not cancel or hide that work.
 const issued=coldFixture(fixture),settled=deferred();let issuedDone=false;
 issued.c.serverSyncSequence=settled.promise.then(()=>{issuedDone=true;});
 const waiting=issued.c.useSavedAccountPreferences();issued.release();
 await Promise.resolve();await Promise.resolve();assert.equal(issued.counters.snapshot,0);assert.equal(issuedDone,false);
 settled.resolve();await waiting;assert.equal(issuedDone,true);assert.equal(issued.counters.snapshot,1);cases++;
 // Actual issued normal read must settle before loader-failure cleanup restores a usable button.
 for(const switched of [false,true]){
  const x=coldFixture(fixture),read=deferred();let readStarted=false,recoveryEnded=false;
  x.c.serverSyncClient.loadState=async()=>{readStarted=true;x.counters.read++;await read.promise;return {user:{id:'A'},state:x.state};};
  const normal=x.c.syncCurrentServerState();await Promise.resolve();await Promise.resolve();
  assert.equal(readStarted,true);assert.equal(x.c.serverPersistence.state,'syncing');
  const raw=x.values.get('ns_profile_v1:'+x.profileId),ram=JSON.stringify(x.c.userPreferences);
  const recover=x.c.useSavedAccountPreferences();const rejected=assert.rejects(recover,/synthetic loader failure/).then(()=>{recoveryEnded=true;});
  if(switched){x.c.serverPersistence.user={id:'B'};x.c.serverPersistence.state='syncing';}
  x.gate.reject(new Error('synthetic loader failure'));await Promise.resolve();await Promise.resolve();
  assert.equal(recoveryEnded,false,'failure cleanup waits for already-issued transport');
  read.resolve();await normal;await rejected;
  assert.equal(x.c.serverPersistence.state,switched?'syncing':'error','only the captured account gets failure cleanup');
  assert.equal(x.c.localPreferenceRecoveryBusy,false);assert.equal(x.values.get('ns_profile_v1:'+x.profileId),raw);
  assert.equal(JSON.stringify(x.c.userPreferences),ram);assert.equal(x.counters.snapshot,0);assert.equal(x.counters.save,0);cases++;
 }
 console.log(JSON.stringify({kind:'recovery-cold-loader',passed:true,cases,customerOperation:false,nativeExecuted:false}));
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={run,coldFixture,scheduledFollowOwner,deferred};
