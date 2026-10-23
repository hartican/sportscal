#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const diagnostic=require('../config/account-sync-diagnostic');
const file=path.join(__dirname,'lib/user-state-account-scope-tests.js');
const helper={module:{exports:{}},require:createRequire(file),__dirname:path.dirname(file),console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.assessment={sources,context};',helper,{filename:file});
const {sources,context}=helper.module.exports.assessment;
const sentinel='PRIVATE-email-handle-token-receipt-preferences-NEVER-COPY';
function mount(c){
 c.NOTHINGSPORTS_SYNC_DIAGNOSTIC=diagnostic;
 c.serverSyncClient.accountSnapshot=()=>({generation:c.qaGeneration||0,accountId:c.serverSyncClient.sessionSubject(),hasSession:true});
 c.document={querySelector:()=>({content:'587'}),getElementById:()=>null,createElement:()=>({addEventListener(type,fn){this[type]=fn;},remove(){this.removed=true;}})};
 c.navigator={clipboard:{writeText:async text=>{c.copied=text;}}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/account-indicator-app.js'),'utf8'),c);
}
const error=(code,status)=>Object.assign(new Error(sentinel),{code,status});
const scenarios=[
 ['read-503',c=>{c.serverSyncClient.loadState=async()=>{throw error('supabase_timeout',503);};},'read','service'],
 ['timeout',c=>{c.serverSyncClient.loadState=async()=>{throw error('request_timeout');};},'read','timeout'],
 ['body',c=>{c.serverSyncClient.loadState=async()=>{throw error('server_response_invalid');};},'read','response'],
 ['identity',c=>{const read=c.serverSyncClient.loadState;c.serverSyncClient.loadState=async o=>({...await read(o),user:{id:sentinel}});},'verify','identity'],
 ['save-503',c=>{c.serverSyncClient.savePatch=async()=>{throw error('server_sync_failed',503);};},'save','service'],
 ['size',c=>{c.serverSyncClient.savePatch=async()=>{throw error('user_state_too_large',413);};},'save','api'],
 ['conflict',c=>{c.serverSyncClient.savePatch=async()=>{throw error('user_state_conflict',409);};},'save','conflict'],
 ['hold',c=>{c.PROFILE_STORAGE=require('../config/profile-storage');c.pendingPreferenceIntent=()=>({ownerId:'A',basePreferences:{theme:'different'},preferences:{theme:'deliberate'}});},'verify','guarded_hold'],
 ['missing-state',c=>{c.serverSyncClient.savePatch=async()=>({user:{id:'A'},state:null});},'save-response','unknown'],
 ['ack',c=>{c.acknowledgePreferenceReceipt=()=>{throw error(sentinel);};},'acknowledge','unknown'],
 ['apply',c=>{c.applyServerState=()=>{throw Object.assign(error(sentinel),{name:'QuotaExceededError'});};},'apply','local_storage'],
 ['auth',c=>{c.serverSyncClient.loadState=async()=>{throw error('refresh_session_retryable',503);};},'read','auth'],
 ['unknown',c=>{c.serverSyncClient.loadState=async()=>{throw error(sentinel,500);};},'read','http'],
 ['success',()=>{},'complete','completed'],
 ['pending',c=>{c.pendingPreferenceIntent=()=>null;const apply=c.applyServerState;c.applyServerState=s=>{apply(s);c.pendingPreferenceIntent=()=>({ownerId:'A',id:sentinel});};},'complete','pending'],
];
async function run(){
 for(const [name,setup,stage,category]of scenarios){
  const outcomes=[];
  for(const active of [false,true]){
   const c=context(sources());if(active)mount(c);setup(c);let caught;
   try{await c.syncCurrentServerState();}catch(e){caught=e;}
   outcomes.push(JSON.stringify({device:c.currentDevice(),baseline:c.serverStateBaseline,persistence:c.serverPersistence,calls:c.calls,error:caught&&{message:caught.message,code:caught.code,name:caught.name},receipt:c.pendingPreferenceIntent('A')}));
   if(active){
    const controls={children:[],appendChild(button){this.children.push(button);}};
    c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);
    assert.equal(c.copied,undefined,'render never copies');assert.equal(controls.children.length,1,name+' copy action');
    await controls.children[0].click();const snapshot=JSON.parse(c.copied);
    assert.equal(snapshot.stage,stage,name);assert.equal(snapshot.category,category,name);assert(!c.copied.includes(sentinel),name+' private sentinel');
    assert.equal(snapshot.completed,name==='success');
    if(['apply','ack','missing-state'].includes(name))assert.equal(snapshot.saveResponseReceived,true);
    if(name==='hold'){assert.equal(caught.code,'preference_base_changed');assert.equal(c.calls.writes,0);assert.equal(snapshot.baseCompatible,false);}
    const before=c.copied;c.switchAccount();await controls.children[0].click();assert.equal(c.copied,before,'stale owner cannot copy');assert(controls.children[0].removed);
   }
  }
  assert.equal(outcomes[0],outcomes[1],name+' diagnostic must preserve exact saved state, baseline, receipt, calls and error');
 }
 // Compare actual atomic profile/receipt storage bytes, not only an observed
 // receipt object. Freeze local clock/UUID inputs in the disposable VM.
 for(const failure of [false,true]){
  const outcomes=[];
  for(const active of [false,true]){
   const c=context(sources());
   const values=new Map();c.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
   c.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-23T00:00:00Z']));}static now(){return 1792713600000;}};
   let ids=0;c.crypto={randomUUID:()=>String(++ids)};
   vm.runInContext(fs.readFileSync(path.join(__dirname,'../config/profile-storage.js'),'utf8'),c);
   c.PROFILE_STORAGE=c.NOTHINGSPORTS_PROFILE_STORAGE;
   c.serverSyncClient.accountSnapshot=()=>({generation:0,accountId:'A',hasSession:true});
   c.activeProfileBundle=c.PROFILE_STORAGE.loadActiveProfile(c.localStorage);
   c.activeProfileBundle=c.PROFILE_STORAGE.recordPreferenceIntent(c.localStorage,c.activeProfileBundle,{ownerId:'A',generation:0,
     baseUpdatedAt:c.serverStateBaseline.updatedAt,basePreferences:c.serverStateBaseline.state.preferences,preferences:c.currentDevice().preferences});
   const initial=JSON.stringify([...values]);
   if(active)mount(c);
   if(failure)c.serverSyncClient.savePatch=async()=>{throw error('server_sync_failed',503);};
   try{await c.syncCurrentServerState();}catch(e){assert(failure);assert.equal(e.code,'server_sync_failed');}
   assert.equal(Boolean(c.pendingPreferenceIntent('A')),failure,'actual receipt only ACKs a confirmed success');
   const saved=JSON.stringify([...values]);if(failure)assert.equal(saved,initial,'failed save retains exact persisted receipt bytes');
   outcomes.push(saved);
  }
  assert.equal(outcomes[0],outcomes[1],'actual persisted profile/receipt bytes identical with diagnostics active/inactive');
 }
 // A clipboard promise belongs to the originating attempt even if a new
 // account/attempt completes before the browser reports clipboard completion.
 for(const change of ['attempt','generation','owner']){
  const c=context(sources());mount(c);let toasts=0,release;
  c.showToast=()=>{toasts++;};await c.syncCurrentServerState();
  const controls={children:[],appendChild(b){this.children.push(b);}};
  c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);
  c.navigator.clipboard.writeText=()=>new Promise(resolve=>{release=resolve;});
  const copying=controls.children[0].click();
  if(change==='owner')c.switchAccount();
  else if(change==='generation')c.qaGeneration=1;
  else await c.syncCurrentServerState();
  release();await copying;assert.equal(toasts,0,change+' late clipboard completion cannot announce success');
 }
 // Real late responses cannot retain a diagnostic in a changed lifetime.
 for(const change of ['owner','generation','ended']){
  const c=context(sources());mount(c);const read=c.serverSyncClient.loadState;
  c.serverSyncClient.loadState=async options=>{const result=await read(options);
   if(change==='owner')c.switchAccount();else if(change==='generation')c.qaGeneration=1;else c.endSession();return result;};
  await c.syncCurrentServerState();
  const controls={children:[],appendChild(b){this.children.push(b);}};
  c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);assert.equal(controls.children.length,0,change+' invalidates diagnostic');
 }
 {
  const c=context(sources());mount(c);let samples=0;const pending=c.pendingPreferenceIntent;
  c.pendingPreferenceIntent=(...args)=>{samples++;return pending(...args);};
  await c.syncCurrentServerState();assert.equal(samples,4,'two original receipt reads plus two diagnostic samples');
 }
 let clock=100,current=true;
 const recorder=diagnostic.create({now:()=>clock});
 const start=()=>recorder.begin({current:()=>current,facts:()=>({pendingReceipt:false,baseCompatible:sentinel,ownerMatches:true,generationMatches:true}),versions:{shellVersion:sentinel,workerVersion:'587'}});
 const first=start();first.fail({code:sentinel,name:sentinel,status:999,message:sentinel});clock=200;
 assert.equal(recorder.snapshot().elapsedMs,0,'failure freezes elapsed time');assert.equal(recorder.snapshot().shellVersion,null);assert.equal(recorder.snapshot().baseCompatible,null);
 const second=start();first.step('save-response');assert.equal(recorder.snapshot().stage,'prepare','older attempt cannot overwrite newer');second.step(sentinel);assert.equal(recorder.snapshot().stage,'unknown');
 current=false;assert.equal(recorder.snapshot(),null);current=true;first.fail(error('request_timeout'));assert.equal(recorder.snapshot(),null,'cleared lifetime stays cleared');
 for(const code of ['missing_session','refresh_session_terminal','invalid_refresh_token','refresh_token_not_found','refresh_token_already_used','refresh_token_revoked'])assert.equal(diagnostic.classify({code}).category,'auth');
 assert.equal(diagnostic.classify({name:'SecurityError'}).category,'local_security');
 console.log('Sync diagnostic: 15 actual queue/reconcile equivalence scenarios, 2 persisted-receipt byte controls, 6 delayed clipboard/lifetime controls, bounded receipt sampling, copy privacy, owner fences, safe categories and bounded recorder passed. No service connections.');
}
module.exports=run;
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
