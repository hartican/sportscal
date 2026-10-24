'use strict';
// Exact source branches; disposable fixtures; no browser, service or database I/O.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),cache=new Map(),clone=structuredClone;
const read=(file,old=false)=>{old=old||process.env.GUARD_DIAGNOSTIC_BASELINE==='91862967';const key=old+file;if(!cache.has(key))cache.set(key,old?execFileSync('git',['show','91862967:'+file],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}):fs.readFileSync(path.join(root,file),'utf8'));return cache.get(key);};
const systems=require('../../config/preference-system'),follow=require('../../config/follow-first'),patches=require('../../config/user-state-sync');
const entity='team:football:australian-championship:11255',other='team:football:epl:2';
const sentinel='PRIVATE-identity-field-value-email-token-MUST-NOT-COPY';
function fixture(){
 const base={theme:'day',followBrowse:{sportId:'sport:football',section:'teams-players',page:0},feedCompact:false,preferenceGraph:systems.createPreferenceGraph({profileId:'disposable'})};
 base.preferenceGraph.updatedAt='2026-10-24T00:00:00Z';base.preferenceGraph.entityFollows=[{participantId:entity,followLevel:'follow'}];base.preferenceGraph.domainPreferences=[systems.expandTemplate('disposable','sport:football','template:like')];
 const intent=clone(base),remote=clone(base);intent.followBrowse.sportId='sport:cricket';intent.feedCompact=true;intent.preferenceGraph.entityFollows[0].followLevel='unfollow';intent.preferenceGraph.domainPreferences[0]=systems.expandTemplate('disposable','sport:football','template:casual');
 remote.followBrowse.sportId='sport:tennis';remote.preferenceGraph.entityFollows.push({participantId:other,followLevel:'follow'});
 return {receipt:{ownerId:'A',generation:0,receiptId:'preference-edit:disposable',baseUpdatedAt:'2026-10-24T00:00:00Z',basePreferences:base,preferences:intent},state:{updatedAt:'2026-10-24T01:00:00Z',preferences:remote},current:clone(intent),life:{accountId:'A',generation:0}};
}
function mount(old=false,compiled=false){
 let ids=0;const FixedDate=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-24T00:00:00Z']));}static now(){return 1792800000000;}};
 const c={Date:FixedDate,structuredClone,console,USER_STATE_SYNC:patches,FOLLOW_FIRST:follow,preferenceIntentOwner:()=>({accountId:'A',generation:0}),crypto:{randomUUID:()=> 'disposable-'+(++ids)}};vm.createContext(c);
 vm.runInContext(read('config/profile-storage.js',old),c);c.PROFILE_STORAGE=c.NOTHINGSPORTS_PROFILE_STORAGE;
 if(compiled)vm.runInContext(read('assets/js/account-awareness-runtime.js',old),c);
 else{vm.runInContext(read('config/account-sync-diagnostic.js',old),c);vm.runInContext(read('config/preference-intent-reconcile.js',old),c);}
 const html=read('index.html',old),a=html.indexOf('function verifyPreferenceIntentBase('),b=html.indexOf('\nasync function bootstrapServerPersistence(',a);vm.runInContext(html.slice(a,b),c);
 return c;
}
const rec=(f,side='remote',family='entities')=>f[side==='base'?'receipt':'state'][side==='base'?'basePreferences':'preferences'].preferenceGraph[family==='entities'?'entityFollows':'domainPreferences'];
const cases=[
 ['receipt_shape_invalid',f=>{f.receipt.extra=true;}],['receipt_id_invalid',f=>{f.receipt.receiptId='bad';}],['receipt_owner_invalid',f=>{f.receipt.ownerId='';}],['receipt_generation_invalid',f=>{f.receipt.generation=-1;}],
 ['base_time_unavailable',f=>{f.receipt.baseUpdatedAt=null;}],['base_time_invalid',f=>{f.receipt.baseUpdatedAt='bad';}],['remote_time_unavailable',f=>{f.state.updatedAt=null;}],['remote_time_invalid',f=>{f.state.updatedAt='bad';}],
 ['preferences_shape_invalid',f=>{f.receipt.basePreferences=[];}],['graph_shape_invalid',f=>{f.receipt.basePreferences.preferenceGraph=null;}],
 ['view_shape_invalid',f=>{f.state.preferences.followBrowse=null;}],['view_unknown_field',f=>{f.state.preferences.followBrowse[sentinel]=true;}],['view_field_invalid',f=>{f.state.preferences.feedCompact=sentinel;}],
 ['outside_supported_scope_changed',f=>{f.receipt.preferences.theme='night';}],['outside_supported_scope_changed',f=>{f.state.preferences.theme='night';}],
 ['list_shape_invalid',f=>{f.state.preferences.preferenceGraph.domainPreferences={};}],['record_shape_invalid',f=>{rec(f).push(null);}],['record_identity_invalid',f=>{rec(f)[0].participantId='';}],
 ['record_unknown_field',f=>{rec(f)[0][sentinel]=sentinel;}],['record_field_invalid',f=>{rec(f)[0].followLevel=sentinel;}],['entity_level_invalid',f=>{delete rec(f)[0].followLevel;}],
 ['domain_identity_invalid',f=>{rec(f,'remote','domains')[0].sportDomainId='sport:rally';}],['identity_collision',f=>{rec(f).push(clone(rec(f)[0]));}],
 ['identity_unavailable',f=>{f.followIdentity=()=>'';}],['identity_exception',f=>{f.followIdentity=()=>{throw Error(sentinel);};}],
 ['concurrent_empty_reset',f=>{f.receipt.preferences.preferenceGraph.entityFollows=[];}],
 ['concurrent_add',f=>{f.receipt.basePreferences.preferenceGraph.entityFollows=[];rec(f)[0].followLevel='priority';}],
 ['delete_vs_edit',f=>{f.receipt.preferences.preferenceGraph.entityFollows=[];f.state.preferences.preferenceGraph.entityFollows=[{participantId:entity,followLevel:'priority'}];}],
 ['edit_vs_delete',f=>{f.state.preferences.preferenceGraph.entityFollows=[];}],['concurrent_field_change',f=>{rec(f)[0].followLevel='priority';}],
];
module.exports=async function guardTests(){
 let passed=0;
 for(const compiled of [false,true]){
  for(const [reason,mutate] of cases){
   const f=fixture();mutate(f);const outcomes=[];
   for(const old of [true,false]){
    const c=mount(old,compiled),events=[],before=JSON.stringify(f);let result,error;
    try{result=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.plan(f.receipt,f.state,c.PROFILE_STORAGE,f.followIdentity?{participantFollowIdentityKey:f.followIdentity}:c.FOLLOW_FIRST,c.USER_STATE_SYNC,value=>events.push(value));}catch(e){error=e;}
    assert.equal(JSON.stringify(f),before,'observer cannot mutate input');
    outcomes.push(JSON.stringify({result,error:error&&{message:error.message,code:error.code,name:error.name}}));
    if(!old){assert.equal(events[0]?.reason,reason,compiled+': '+reason);assert(!JSON.stringify(events).includes(sentinel));}
   }
   assert.equal(outcomes[0],outcomes[1],'source/planner behavior equivalence: '+reason);passed++;
  }
  // Actual verify wrapper: five previously identical phone-shaped holds now distinguishable.
  const reasons=[];
  for(const kind of ['conflict','unknown','view','clock','current']){
   const f=fixture();f.state.preferences.preferenceGraph.entityFollows[0].followLevel='priority';
   f.state.preferences.preferenceGraph.domainPreferences[0]=systems.expandTemplate('disposable','sport:football','template:froth');
   if(kind==='unknown')rec(f)[0][sentinel]=sentinel;
   if(kind==='view')f.state.preferences.followBrowse.page=sentinel;
   if(kind==='clock')f.receipt.baseUpdatedAt=null;
   if(kind==='current')f.current.theme='night';
   const c=mount(false,compiled),d=c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.create(),job=d.begin({current:()=>true,facts:()=>({pendingReceipt:true})});
   job.step('read');job.step('verify');let caught;
   try{c.verifyPreferenceIntentBase(f.receipt,f.state,f.life,f.current,job.guard);}catch(error){caught=error;}
   assert.equal(caught?.code,'preference_base_changed');job.fail(caught);const snapshot=d.snapshot();
   assert.equal(snapshot.stateLoadCallsStarted,1);assert.equal(snapshot.stateSaveCallsStarted,0);assert(snapshot.preferenceGuard);if(kind==='current')assert.deepEqual([...snapshot.preferenceGuard.currentToReceipt],['appearance']);
   assert(!JSON.stringify(snapshot).includes(sentinel));reasons.push(snapshot.preferenceGuard.reason);passed++;
  }
  assert.equal(new Set(reasons).size,5,'five original diagnostic collisions are distinct');
 }
 // Owned current and shortcut seams are checked through the actual wrapper.
 for(const [reason,mutate] of [
  ['current_shape_invalid',f=>{f.current=[];}],['view_field_invalid',f=>{f.current.feedCompact=sentinel;}],
  ['current_differs_from_receipt',f=>{f.current.theme='night';}],
  ['compatible_base',f=>{f.state.preferences=clone(f.receipt.basePreferences);}],
  ['compatible_intent',f=>{f.state.preferences=clone(f.receipt.preferences);}],
  ['owner_scope_rejected',(f,c)=>{c.preferenceIntentOwner=()=>({accountId:'B',generation:0});}],
  ['generation_scope_rejected',(f,c)=>{c.preferenceIntentOwner=()=>({accountId:'A',generation:1});}],
  ['comparison_exception',f=>{rec(f).push(clone(rec(f)[0]));}]
 ]){
  const outcomes=[];
  for(const old of [true,false]){
   const c=mount(old),f=fixture(),events=[];mutate(f,c);let result,error;
   try{result=c.verifyPreferenceIntentBase(f.receipt,f.state,f.life,f.current,event=>events.push(event));}catch(e){error=e;}
   outcomes.push(JSON.stringify({result,error:error&&{message:error.message,code:error.code,name:error.name}}));
   if(!old){assert(events.some(event=>event.reason===reason),reason);assert(!JSON.stringify(events).includes(sentinel));}
  }
  assert.equal(outcomes[0],outcomes[1],reason+' wrapper equivalence');passed++;
 }
 // Real atomic profile/receipt ACK seams: identical bytes and errors to published591.
 for(const kind of ['missing','witness','semantics','original-changed','new-generation','patch-missing','clock','new-base','continuation','storage-error']){
  const outcomes=[];
  for(const old of [true,false]){
   const c=mount(old),p=c.PROFILE_STORAGE,f=fixture(),values=new Map(),events=[];
   const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
   let bundle=p.loadActiveProfile(storage);
   bundle=p.recordPreferenceIntent(storage,bundle,{...f.receipt,sections:{}});
   let receipt=p.readPreferenceIntent(storage,bundle,'A'),preferences=clone(receipt.preferences),ack={generation:0,updatedAt:'2026-10-24T02:00:00Z',observe:event=>events.push(c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.guardFact(event))},patchApi=patches;
   const changeStored=mutate=>{const key=[...values.keys()].find(key=>key.startsWith('ns_profile_v1:'));const parsed=JSON.parse(values.get(key));mutate(parsed);values.set(key,JSON.stringify(parsed));};
   if(kind==='missing')changeStored(value=>{value.preferenceSync.entries=[];});
   if(kind==='witness')receipt={...receipt,originalReceipt:{...receipt,ownerId:'B'}};
   if(kind==='semantics')preferences=clone(receipt.basePreferences);
   if(kind==='original-changed')receipt={...receipt,originalReceipt:{...receipt,preferences:{...receipt.preferences,theme:'night'}}};
   if(['new-generation','patch-missing','clock','new-base','continuation'].includes(kind)){
    bundle=p.recordPreferenceIntent(storage,bundle,{ownerId:'A',generation:0,baseUpdatedAt:receipt.baseUpdatedAt,basePreferences:receipt.basePreferences,preferences:{...receipt.preferences,theme:'night'}});
    if(kind==='new-generation')ack.generation=1;
    if(kind==='patch-missing')patchApi=null;
    if(kind==='clock')ack.updatedAt=null;
    if(kind==='new-base')changeStored(value=>{value.preferenceSync.entries[0].basePreferences.theme='different';});
    if(kind==='continuation')receipt={...receipt,originalReceipt:clone(receipt),continue:()=>undefined};
   }
   if(kind==='storage-error')storage.getItem=()=>{throw Error(sentinel);};
   let result,error;try{result=p.acknowledgePreferenceIntent(storage,bundle,receipt,preferences,patchApi,ack);}catch(e){error=e;}
   outcomes.push(JSON.stringify({result,error:error&&{message:error.message,name:error.name},values:[...values]}));
   if(!old){const expected={missing:'ack_current_receipt_unavailable',witness:'ack_original_witness_invalid',semantics:'ack_semantics_mismatch','original-changed':'ack_original_receipt_changed','new-generation':'ack_newer_generation_rejected','patch-missing':'ack_patch_unavailable',clock:'ack_time_invalid','new-base':'ack_newer_base_incompatible',continuation:'continuation_refused','storage-error':'unexpected_exception'};
    assert.equal(events[0]?.reason,expected[kind],kind);assert(!JSON.stringify(events).includes(sentinel));}
  }
  assert.equal(outcomes[0],outcomes[1],kind+' exact durable bytes/return/error equivalence');passed++;
 }
 // Actual serialized reconcile owner: counters label SDK call entries, including a409 re-read.
 const accountFile=path.join(__dirname,'user-state-account-scope-tests.js');
 const host={module:{exports:{}},require:createRequire(accountFile),__dirname,console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
 vm.runInNewContext(read('scripts/lib/user-state-account-scope-tests.js')+'\nmodule.exports.guardProbe={sources,context};',host,{filename:accountFile});
 const sourceParts=html=>{
  const pick=(from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a);assert(a>=0&&b>a);return html.slice(a,b);};
  return {scope:pick('function invalidateServerStateSyncScope(','\nasync function reconcileCurrentServerState('),reconcile:pick('async function reconcileCurrentServerState(','\nfunction syncCurrentServerState('),queue:pick('function syncCurrentServerState(','\nfunction normalizeServerArchiveReferences('),preserve:pick('function applyServerStatePreservingChanges(','\nfunction queueServerStateSync('),bootstrap:pick('async function hydrateUserMetaSeed(','\nfunction sydneyPartsFromIso('),logout:pick('      const signedOutUserId = serverPersistence.user?.id || serverSyncClient?.sessionSubject?.();','\n    });\n    appendPublicProfileAccountSettings')};
 };
 for(const kind of ['current','post409','ack','duplicate','success']){
  const outcomes=[];
  for(const old of [true,false]){
   const f=fixture();if(kind==='current')f.current.theme='night';
   const state=preferences=>({preferences:clone(preferences),profile:{},eventUserState:{},eventSpoilerState:{},archivedEvents:[],ratings:{}});
   const q=host.module.exports.guardProbe.context(sourceParts(read('index.html',old)),{A:state(f.current),B:state(f.receipt.basePreferences)});
   const values=new Map();q.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
   q.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-24T00:00:00Z']));}static now(){return 1792800000000;}};let ids=0;q.crypto={randomUUID:()=>String(++ids)};
   vm.runInContext(read('config/profile-storage.js',old),q);q.PROFILE_STORAGE=q.NOTHINGSPORTS_PROFILE_STORAGE;q.SERVER_SYNC=require('../../config/server-sync');q.FOLLOW_FIRST=follow;
   q.activeProfileBundle=q.PROFILE_STORAGE.loadActiveProfile(q.localStorage);
   q.activeProfileBundle=q.PROFILE_STORAGE.recordPreferenceIntent(q.localStorage,q.activeProfileBundle,f.receipt);
   q.serverStateBaseline={state:state(f.receipt.basePreferences),updatedAt:f.receipt.baseUpdatedAt,accountId:'A',generation:0};
   q.serverSyncClient.accountSnapshot=()=>({accountId:'A',generation:0,hasSession:true});
   q.document={querySelector:()=>({content:'591'}),getElementById:()=>null,createElement:()=>({addEventListener(name,fn){this[name]=fn;}})};q.navigator={clipboard:{writeText:async value=>{q.copied=value;}}};
   vm.runInContext(read('assets/js/account-awareness-runtime.js',old),q);
   if(kind==='duplicate')f.state.preferences.preferenceGraph.entityFollows.push(clone(f.state.preferences.preferenceGraph.entityFollows[0]));
   q.serverSyncClient.loadState=async()=>{q.calls.reads++;const response={...state(f.state.preferences),updatedAt:f.state.updatedAt};if(kind==='post409'&&q.calls.reads===2)response.preferences.theme='night';return{user:{id:'A'},state:response};};
   q.serverSyncClient.savePatch=async patch=>{q.calls.writes++;if(kind==='post409')throw Object.assign(Error('Disposable409'),{status:409,code:'user_state_conflict'});let result=patches.applyPatch({...state(f.state.preferences),updatedAt:f.state.updatedAt},patch);if(kind==='ack')result.preferences.preferenceGraph.entityFollows[0].followLevel='priority';result.updatedAt='2026-10-24T02:00:00Z';return{user:{id:'A'},state:result};};
   const before=JSON.stringify([...values]);let caught;try{await q.syncCurrentServerState();}catch(error){caught=error;}
   const controls={children:[],appendChild(button){this.children.push(button);}};q.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);await controls.children[0].click();
   const snapshot=JSON.parse(q.copied);outcomes.push(JSON.stringify({device:q.currentDevice(),baseline:q.serverStateBaseline,calls:q.calls,stored:[...values],error:caught&&{code:caught.code,message:caught.message,name:caught.name}}));
   if(kind!=='success')assert.equal(JSON.stringify([...values]),before,'failed operation retains exact receipt bytes');
   if(!old){
    assert.equal(snapshot.stateLoadCallsStarted,q.calls.reads);assert.equal(snapshot.stateSaveCallsStarted,q.calls.writes);
    const expected={current:'current_differs_from_receipt',post409:'outside_supported_scope_changed',ack:'ack_semantics_mismatch',duplicate:'comparison_exception'};
    if(kind!=='success')assert.equal(snapshot.preferenceGuard.reason,expected[kind],kind);
    if(kind==='current')assert.deepEqual(snapshot.preferenceGuard.currentToReceipt,['appearance']);
    if(kind==='post409'){assert.equal(snapshot.preferenceGuard.verifyPass,'after_conflict');assert.equal(snapshot.stateSaveCallsStarted,1);assert.equal(snapshot.saveResponseReceived,false);}
    if(kind==='duplicate')assert.equal(snapshot.code,'unclassified');
    assert(!q.copied.includes(sentinel));
   }
  }
  assert.equal(outcomes[0],outcomes[1],kind+' actual serialized owner/persisted receipt/calls/error equivalence');passed++;
 }
 // Actual witness R2 continuation and in-flight preserve retain exact prior semantics.
 for(const kind of ['continuation-refused','preserve-refused']){
  const outcomes=[];
  for(const old of [true,false]){
   const c=mount(old),f=fixture(),events=[];
   const plan=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.plan(f.receipt,f.state,c.PROFILE_STORAGE,follow,patches,event=>events.push(event));
   const pending={...clone(f.receipt),receiptId:'preference-edit:newer',preferences:clone(f.receipt.preferences)};
   pending.preferences.preferenceGraph.entityFollows.push({participantId:'team:football:epl:4',followLevel:'priority'});
   if(kind==='continuation-refused')pending.preferences.futurePolicy=true;
   events.length=0;
   const continued=plan.receipt.continue(pending,{preferences:clone(plan.receipt.preferences),updatedAt:f.state.updatedAt});
   let result;
   if(kind==='preserve-refused'){
    assert(continued);const current=clone(pending.preferences);current.preferenceGraph.entityFollows[0][sentinel]=sentinel;
    result=plan.preserve(f.state,current);assert.equal(result,f.state);
   }
   outcomes.push(JSON.stringify({continued,result}));
   if(!old){assert(events.some(event=>event.site===(kind==='continuation-refused'?'ack_continuation':'inflight_preserve')),kind);assert(!JSON.stringify(events).includes(sentinel));}
  }
  assert.equal(outcomes[0],outcomes[1],kind+' exact witness/preserve behavior');passed++;
 }
 const producer=mount().NOTHINGSPORTS_SYNC_DIAGNOSTIC;
 for(const value of [{site:-1,reason:0,decision:'held'},{site:0,reason:999,decision:'held'},{site:sentinel,reason:0,decision:'held'}])assert.equal(producer.guardFact(value),null);
 // Invalid/malicious producer values must not become recorder state, including keys/prototypes.
 const c=mount(),d=c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.create();let current=true;
 const job=d.begin({current:()=>current,facts:()=>({})});job.step('read');
 for(const value of [null,{site:sentinel,decision:'held',reason:'current_shape_invalid'},JSON.parse('{"__proto__":{"site":"owned_current"}}'),{site:'owned_current',decision:sentinel,reason:'current_shape_invalid'}])job.guard(value);
 assert.equal(d.snapshot().preferenceGuard,null);
 job.guard({site:'owned_current',reason:'current_differs_from_receipt',decision:'held',side:'current',family:sentinel,receiptOwnerMatches:sentinel,receiptGenerationMatches:false,currentToReceipt:['entities',sentinel],extra:sentinel});
 let safe=d.snapshot();assert.equal(safe.preferenceGuard.family,null);assert.deepEqual([...safe.preferenceGuard.currentToReceipt],['entities','unknown']);assert.equal(safe.preferenceGuard.receiptOwnerMatches,null);assert.equal(safe.preferenceGuard.receiptGenerationMatches,false);assert(!JSON.stringify(safe).includes(sentinel));
 job.guard({site:'unexpected',reason:'unexpected_exception',decision:'exception'});assert.equal(d.snapshot().preferenceGuard.reason,'current_differs_from_receipt','first real refusal retained');
 job.step('read');job.step('verify');job.guard({site:'verify_fallback',reason:'base_or_intent_incompatible',decision:'held'});
 assert.equal(d.snapshot().preferenceGuard.verifyPass,'after_conflict');for(let i=0;i<10;i++){job.step('read');job.step('save');}
 assert.equal(d.snapshot().stateLoadCallsStarted,3);assert.equal(d.snapshot().stateSaveCallsStarted,3);
 current=false;job.guard({site:'unexpected',reason:'unexpected_exception',decision:'exception'});assert.equal(d.snapshot(),null);
 // Observation failure cannot change actual return/error in planner or fallback.
 const f=fixture(),events=[];assert(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.plan(f.receipt,f.state,c.PROFILE_STORAGE,follow,patches,()=>{throw Error(sentinel);}));
 const missing=mount();vm.runInContext('globalThis.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE=undefined',missing);f.state.preferences.preferenceGraph.entityFollows[0].followLevel='priority';
 assert.throws(()=>missing.verifyPreferenceIntentBase(f.receipt,f.state,f.life,f.current,event=>{events.push(event);throw Error(sentinel);}),error=>error.code==='preference_base_changed');
 assert.equal(c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.guardFact(events[0]).reason,'helper_unavailable');
 console.log('Guard observation: '+passed+' actual source/generated branch and five-collision controls; baseline equivalence, privacy, scope, bounded call counts and nonthrowing fallback passed.');
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
