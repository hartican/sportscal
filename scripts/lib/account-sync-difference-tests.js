'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),file=path.join(__dirname,'user-state-account-scope-tests.js');
const helper={module:{exports:{}},require:createRequire(file),__dirname,console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.diffProbe={sources,context};',helper,{filename:file});
const {sources,context}=helper.module.exports.diffProbe,profile=require('../../config/profile-storage'),follow=require('../../config/follow-first');
const clone=value=>JSON.parse(JSON.stringify(value)),read=file=>process.env.DIAGNOSTIC_BASELINE?execFileSync('git',['show',process.env.DIAGNOSTIC_BASELINE+':'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');
function mount(c){
 vm.runInContext(read('config/account-sync-diagnostic.js'),c);
 c.document={querySelector:()=>({content:'589'}),getElementById:()=>null,createElement:()=>({addEventListener(type,fn){this[type]=fn;},remove(){this.removed=true;}})};
 c.navigator={clipboard:{writeText:async text=>{c.copied=text;}}};
 vm.runInContext(read('assets/js/account-indicator-app.js'),c);
}
module.exports=async function differenceTests(){
 const summaries=[];
 for(const kind of ['activity','appearance']){
  const outcomes=[];
  for(const active of [false,true]){
   const c=context(sources()),base=follow.migratePreferences({version:27,theme:'day',followedSports:[],selectedSelectorEntityIds:[],followFirst:{startupMeta:{sports:[]},notifications:{enabled:false,userChoice:false}},preferenceGraph:{entityFollows:[{participantId:'team:football:australian-championship:11255',followLevel:'follow'}]}}),desired=clone(base);
   desired.preferenceGraph.entityFollows[0].followLevel='unfollow';
   const remote=kind==='activity'?follow.recordCodeInteraction(base,{codeId:'sport:football',type:'open',occurredAt:'2026-10-24T00:00:00Z'}):{...clone(base),theme:'night'};
   const values=new Map();c.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
   c.PROFILE_STORAGE=profile;c.activeProfileBundle=profile.loadActiveProfile(c.localStorage);
   c.activeProfileBundle=profile.recordPreferenceIntent(c.localStorage,c.activeProfileBundle,{ownerId:'A',generation:0,baseUpdatedAt:'2026-10-24T00:00:00Z',basePreferences:base,preferences:desired});
   c.serverStateBaseline={state:{preferences:clone(base)},accountId:'A',generation:0};
   c.serverSyncClient.accountSnapshot=()=>({accountId:'A',generation:0,hasSession:true});
   c.serverSyncClient.loadState=async()=>{c.calls.reads++;return{user:{id:'A'},state:{preferences:remote,updatedAt:'2026-10-24T01:00:00Z'}};};
   const before=JSON.stringify([...values]);if(active)mount(c);let caught;
   try{await c.syncCurrentServerState();}catch(error){caught=error;}
   assert.equal(caught?.code,'preference_base_changed');assert.equal(c.calls.reads,1);assert.equal(c.calls.writes,0);
   assert.equal(JSON.stringify([...values]),before,'comparison cannot rewrite receipt');
   outcomes.push(JSON.stringify({calls:c.calls,state:c.serverPersistence,device:c.currentDevice(),error:{message:caught.message,code:caught.code}}));
   if(active){
    const controls={children:[],appendChild(button){this.children.push(button);}};c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);
    assert.equal(c.copied,undefined);await controls.children[0].click();const diagnostic=JSON.parse(c.copied);
    assert.equal(diagnostic.format,'sync-diagnostic.v1','existing v1 fields remain unchanged');
    assert.equal(diagnostic.stage,'verify');assert.equal(diagnostic.category,'guarded_hold');
    assert(diagnostic.preferenceDifferences,'v1 cannot distinguish these actual guarded holds');
    assert.deepEqual(diagnostic.preferenceDifferences.baseToRemote,[kind]);
    assert.deepEqual(diagnostic.preferenceDifferences.localEdits,['entities']);
    assert.equal(diagnostic.preferenceDifferences.receiptBaseMatchesAccepted,true);
    assert.equal(diagnostic.completed,false);summaries.push(diagnostic.preferenceDifferences);
   }
  }
  assert.equal(outcomes[0],outcomes[1],'diagnostics leave actual branch/error/calls/saved state identical');
 }
 // The diagnostic must observe the same R1 receipt as the actual verifier,
 // even if a newer R2 is recorded while the read is outstanding.
 for(const mismatch of [false,true]){
  const c=context(sources());c.PROFILE_STORAGE=profile;
  const r1={ownerId:'A',basePreferences:{theme:'day'},preferences:{theme:'day',showSpoilers:false}},r2={...r1,preferences:{theme:'system'}};
  c.pendingPreferenceIntent=()=>r1;
  c.serverSyncClient.accountSnapshot=()=>({accountId:'A',generation:0,hasSession:true});
  c.serverSyncClient.loadState=async()=>{c.calls.reads++;c.pendingPreferenceIntent=()=>r2;return {user:{id:mismatch?'B':'A'},state:{preferences:{theme:'night'}}};};
  mount(c);let caught;try{await c.syncCurrentServerState();}catch(error){caught=error;}
  assert.equal(caught.code,mismatch?'user_state_identity_mismatch':'preference_base_changed');assert.equal(c.calls.writes,0);
  const controls={children:[],appendChild(button){this.children.push(button);}};c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);await controls.children[0].click();
  const copy=JSON.parse(c.copied);
  if(mismatch)assert.equal(copy.preferenceDifferences,null,'wrong-owner payload preferences are never classified');
  else assert.deepEqual(copy.preferenceDifferences.localEdits,['feed'],'comparison uses R1 from the actual verify hook, not the current R2');
 }
 const diagnostic=require('../../config/account-sync-diagnostic'),compare=(a,b)=>profile.preferenceBaseMatches({basePreferences:a},b),sentinel='PRIVATE_SENTINEL_name_email_token_receipt_values';
 const before={preferenceGraph:{profileId:'one'},followFirst:{appliedSeedHash:'before',refinement:{distinctOpenCount:1}}};
 const after={preferenceGraph:{profileId:'two'},followFirst:{appliedSeedHash:'after',refinement:{distinctOpenCount:2}}};
 assert.deepEqual(diagnostic.preferenceDifferences({basePreferences:before,preferences:before},after,compare).baseToRemote,[],'known ignored fields remain ignored');
 const raw=JSON.parse('{"'+sentinel+'":{"__proto__":{"'+sentinel+'":true}},"followFirst":{"'+sentinel+'":"'+sentinel+'"}}');
 const rawBefore=JSON.stringify(raw),safe=diagnostic.preferenceDifferences({basePreferences:{},preferences:{}},raw,compare);
 assert.deepEqual(safe.baseToRemote,['unknown']);assert(!JSON.stringify(safe).includes(sentinel));assert.equal(JSON.stringify(raw),rawBefore);assert.equal({}.polluted,undefined);
 for(const pair of [[{}, {followFirst:{}}],[{followFirst:{}},{}],[{preferenceGraph:null},{preferenceGraph:{}}]]){
  const diff=diagnostic.preferenceDifferences({basePreferences:pair[0],preferences:pair[0]},pair[1],compare);assert(diff.baseToRemote.includes('unknown'),'unmapped shapes get fixed unknown bucket');
 }
 const recorder=diagnostic.create(),handle=recorder.begin({current:()=>true,facts:()=>({preferenceDifferences:{baseToRemote:[sentinel],localEdits:['entities'],localToRemote:[sentinel],receiptBaseMatchesAccepted:sentinel}})});
 handle.step('verify');const copy=JSON.stringify(recorder.snapshot());assert(!copy.includes(sentinel));assert.deepEqual(recorder.snapshot().preferenceDifferences.baseToRemote,['unknown']);
 assert.equal(recorder.snapshot().preferenceDifferences.receiptBaseMatchesAccepted,null);
 console.log('Difference diagnostic: actual automatic-affinity/genuine-theme guard discrimination, state/receipt/error/call equivalence, fixed unknown buckets and privacy passed.');
 return summaries;
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
