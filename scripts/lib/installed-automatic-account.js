'use strict';
// INERT TEST PREPARATION. Copy only after ROOT review/allocation. No launch here.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const need=(value,code)=>assert(value,'installed-auto:'+code);
const recoveryBytes=require('./installed-recovery-proof');
const CASES=['first-open-clean','first-open-dirty','already-open-clean','already-open-dirty','foreground-return-with-focus','reconnect-before-helper','reconnect-after-helper','late-bootstrap','409-disjoint','unknown-hold'];
function installOwnedStorageSafety(){
 if(globalThis.qaOwnedStorageSafety)throw Error('ONE_STORAGE_SAFETY_INSTALL');
 const proto=Storage.prototype,storage=localStorage,setDescriptor=Object.getOwnPropertyDescriptor(proto,'setItem'),getDescriptor=Object.getOwnPropertyDescriptor(proto,'getItem');
 const nativeSet=setDescriptor.value,nativeGet=getDescriptor.value;
 const owner=serverPersistence.user?.id,profile=activeProfileBundle?.profile?.id,key=PROFILE_STORAGE.KEYS.profilePrefix+profile;
 if(!owner||!profile||serverSyncClient.sessionSubject()!==owner)throw Error('OWNED_STORAGE_REQUIRED');
 let mode=null,r1=null,r2=null,originalRaw=null,ram=null,baseline=null,ack=null,candidate=null,verifyPending=false,restored=false,invalid=false;
 const sessionGeneration=serverSyncClient.accountSnapshot().generation;let ownRequest=null,ownReply=null,clearProof=null;
 const currentSafetyScope=()=>serverSyncClient.accountSnapshot().accountId===owner&&serverSyncClient.accountSnapshot().generation===sessionGeneration&&serverSyncClient.sessionSubject()===owner&&serverPersistence.user?.id===owner&&activeProfileBundle.profile.id===profile;
 const counts={ackRejected:0,recoveryWrite:0,verifyRejected:0,rollbackRejected:0,r2Retained:0,r2Cleared:0,ownedSet:0};
 const parse=value=>JSON.parse(value),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const receipt=body=>body?.preferenceSync?.entries?.find(e=>e.ownerId===owner)||null;
 const report=(stage,proof={})=>{try{return qaInstalledObservation.safety({stage,...counts,...proof});}catch{invalid=true;}};
 function capture(kind){
  if(mode||!['r2','ack-failure','uncertainty'].includes(kind))throw Error('ONE_STORAGE_SAFETY_MODE');
  const current=pendingPreferenceIntent(owner);if(!current)throw Error('REAL_RECEIPT_REQUIRED');
  mode=kind;r1=structuredClone(current);originalRaw=nativeGet.call(storage,key);ram=JSON.stringify(userPreferences);baseline=JSON.stringify(serverStateBaseline);
 }
 function ownedSet(item,value){
  if(this!==storage||item!==key||!mode)return nativeSet.apply(this,arguments);
  counts.ownedSet=Math.min(17,counts.ownedSet+1);if(counts.ownedSet>16){invalid=true;return nativeSet.apply(this,arguments);}
  if(mode==='uncertainty'&&candidate!==null&&value===originalRaw){
   if(counts.rollbackRejected){invalid=true;return nativeSet.apply(this,arguments);}counts.rollbackRejected++;
   try{qaRecoveryByteProof.storage('rollback');}catch{invalid=true;}report('rollback-write-rejected');throw new DOMException('Disposable owned rollback fault','QuotaExceededError');
  }
  let before,next;try{before=receipt(parse(nativeGet.call(storage,key)));next=receipt(parse(value));}catch{invalid=true;return nativeSet.apply(this,arguments);}
  const removingR1=before?.receiptId===r1.receiptId&&!next;
  if(mode==='ack-failure'&&removingR1){
   if(counts.ackRejected){invalid=true;return nativeSet.apply(this,arguments);}counts.ackRejected++;
   report('ack-write-rejected');throw new DOMException('Disposable owned ACK fault','QuotaExceededError');
  }
  if(mode==='uncertainty'&&removingR1){
   if(counts.recoveryWrite){invalid=true;return nativeSet.apply(this,arguments);}counts.recoveryWrite++;
   const result=nativeSet.apply(this,arguments);candidate=value;verifyPending=true;try{qaRecoveryByteProof.storage('commit');}catch{invalid=true;}report('native-recovery-write');return result;
  }
  const result=nativeSet.apply(this,arguments);
  try{if(mode==='r2'&&r2&&before?.receiptId===r2.receiptId&&next?.receiptId===r2.receiptId&&next.baseUpdatedAt===ack.updatedAt&&same(next.basePreferences,ack.preferences)&&!(before.baseUpdatedAt===ack.updatedAt&&same(before.basePreferences,ack.preferences))){
   if(!PROFILE_STORAGE.preferenceIntentMatches(r2,next.preferences,USER_STATE_SYNC)||next.preferences.theme!==r2.preferences.theme)invalid=true;
   if(++counts.r2Retained!==1)invalid=true;report('r1-ack-retains-r2');
  }}catch{invalid=true;}
  if(mode==='r2'&&r2&&before?.receiptId===r2.receiptId&&!next){
   if(counts.r2Retained!==1||++counts.r2Cleared!==1)invalid=true;
   let scopeMatches=false,clockMatches=false,durableChoiceMatches=false;
   try{
    scopeMatches=currentSafetyScope()&&serverStateSyncGeneration===ownRequest?.sync&&before.generation===r2.generation;
    clockMatches=ownReply?.valid===true&&before.baseUpdatedAt===ownRequest.base&&before.baseUpdatedAt===ack.updatedAt
      &&serverStateBaseline?.updatedAt===ownRequest.base&&Date.parse(ownReply.clock)>Date.parse(before.baseUpdatedAt);
    durableChoiceMatches=parse(value).profile?.id===profile&&parse(value).preferences?.theme===r2.preferences.theme
      &&userPreferences.theme===r2.preferences.theme&&PROFILE_STORAGE.preferenceIntentMatches(r2,before.preferences,USER_STATE_SYNC);
   }catch{}
   const bound=scopeMatches&&clockMatches&&durableChoiceMatches&&ownReply?.event?.doc===ownRequest?.doc;
   if(!bound)invalid=true;
   const event=report('r2-ack-clears-r2',{operation:ownReply?.operation||null,ownReplyComplete:!!ownReply?.valid,scopeMatches,clockMatches,durableChoiceMatches});
   clearProof={valid:bound&&event?.doc===ownReply.event.doc&&event.seq>ownReply.event.seq,operation:ownReply?.operation||null,replySeq:ownReply?.event?.seq||null,clearSeq:event?.seq||null};
   if(!clearProof.valid)invalid=true;
  }
  return result;
 }
 function ownedGet(item){
  if(this===storage&&item===key&&mode==='uncertainty'&&verifyPending){
   verifyPending=false;if(++counts.verifyRejected!==1)throw Error('ONE_VERIFICATION_FAULT');
   try{qaRecoveryByteProof.storage('verify');}catch{invalid=true;}report('verification-read-rejected');throw new DOMException('Disposable owned verification fault','InvalidStateError');
  }
  return nativeGet.apply(this,arguments);
 }
 Object.defineProperty(proto,'setItem',{...setDescriptor,value:ownedSet});
 try{Object.defineProperty(proto,'getItem',{...getDescriptor,value:ownedGet});}
 catch(error){Object.defineProperty(proto,'setItem',setDescriptor);throw error;}
 globalThis.qaOwnedStorageSafety={
  capture,
  armR2(accepted){
   if(mode!=='r2'||r2)throw Error('R2_ARM_ORDER');
   r2=structuredClone(pendingPreferenceIntent(owner));
   if(!r2||r2.receiptId===r1.receiptId||r2.preferences.theme===r1.preferences.theme)throw Error('REAL_NEWER_RECEIPT_REQUIRED');
   ack=structuredClone(accepted);
  },
  invalidateObservation(){invalid=true;},
  captureSave(start,rawBody){
   if(mode!=='r2'||!r2)return false;
   try{
    if(ownRequest)throw Error('ONE_R2_REQUEST_WITNESS');
    const live=pendingPreferenceIntent(owner),body=JSON.parse(rawBody),life=serverSyncClient.accountSnapshot();
    if(!currentSafetyScope()||live?.receiptId!==r2.receiptId||live.generation!==r2.generation
     ||body.patch?.baseUpdatedAt!==live.baseUpdatedAt||live.baseUpdatedAt!==ack.updatedAt
     ||!Number.isFinite(Date.parse(live.baseUpdatedAt)))throw Error('OWNED_R2_CONDITIONAL_REQUIRED');
    const projected=USER_STATE_SYNC.applyPatch({preferences:structuredClone(live.basePreferences)},body.patch).preferences;
    if(projected.theme!==r2.preferences.theme||!PROFILE_STORAGE.preferenceIntentMatches(r2,projected,USER_STATE_SYNC))throw Error('R2_REQUEST_CHOICE_REQUIRED');
    ownRequest={id:start.id,doc:start.doc,seq:start.seq,receiptId:live.receiptId,base:live.baseUpdatedAt,session:life.generation,sync:serverStateSyncGeneration};
    return true;
   }catch{invalid=true;return false;}
  },
  observeOwnReply(id,status,operation,payload){
   try{
    if(!ownRequest||id!==ownRequest.id||ownReply)throw Error('R2_REPLY_REQUEST_JOIN');
    const row=payload?.state,clock=row?.updated_at,scope=currentSafetyScope()&&serverStateSyncGeneration===ownRequest.sync;
    const clockMatches=typeof clock==='string'&&Number.isFinite(Date.parse(clock))&&Date.parse(clock)>Date.parse(ownRequest.base);
    const choiceMatches=!!row?.preferences&&row.preferences.theme===r2.preferences.theme&&PROFILE_STORAGE.preferenceIntentMatches(r2,row.preferences,USER_STATE_SYNC);
    const valid=status===200&&Number.isSafeInteger(operation)&&operation>0&&payload?.user?.id===owner&&scope&&clockMatches&&choiceMatches;
    const event=qaInstalledObservation.ownReply({id,operation,status,bodyComplete:true,conditional:true,scopeMatches:scope,clockMatches,choiceMatches});
    if(!valid||event.doc!==ownRequest.doc||event.seq<=ownRequest.seq)invalid=true;
    ownReply={operation,clock,event,valid};
   }catch{invalid=true;}
  },
  replyMatchesServer({operation,clock}){return ownReply?.valid===true&&clearProof?.valid===true&&ownReply.operation===operation&&clearProof.operation===operation&&ownReply.clock===clock;},
  matchesRemote(preferences){const intent=r2||r1;return !!intent&&preferences.theme===intent.preferences.theme&&PROFILE_STORAGE.preferenceIntentMatches(intent,preferences,USER_STATE_SYNC);},
  facts(){
   const raw=nativeGet.call(storage,key),entry=receipt(parse(raw));
   return{...counts,mode,restored,invalid,r2OwnAckBound:clearProof?.valid===true,r2ClearOperation:clearProof?.operation||null,r2ReplySequence:clearProof?.replySeq||null,r2ClearSequence:clearProof?.clearSeq||null,r2Created:!!r2,r2Pending:!!r2&&entry?.receiptId===r2.receiptId,
    r2CurrentChoice:!!r2&&userPreferences.theme===r2.preferences.theme&&parse(raw).preferences.theme===r2.preferences.theme,
    originalDurable:raw===originalRaw,originalRam:JSON.stringify(userPreferences)===ram,baselineUnchanged:JSON.stringify(serverStateBaseline)===baseline,
    ownerCurrent:serverSyncClient.accountSnapshot().accountId===owner&&serverSyncClient.accountSnapshot().generation===sessionGeneration&&serverSyncClient.sessionSubject()===owner&&activeProfileBundle.profile.id===profile,
    originalBundleReceipt:activeProfileBundle.preferenceSync?.entries?.some(e=>e.ownerId===owner&&e.receiptId===r1?.receiptId)===true,
    candidateDurable:candidate!==null&&raw===candidate,blocked:localPreferenceRecoveryBlocked(),state:serverPersistence.state};
  },
  restore(){
   let error;
   try{if(Object.getOwnPropertyDescriptor(proto,'setItem').value!==ownedSet)throw Error('SET_WRAPPER_REPLACED');Object.defineProperty(proto,'setItem',setDescriptor);}catch(e){error=e;}
   try{if(Object.getOwnPropertyDescriptor(proto,'getItem').value!==ownedGet)throw Error('GET_WRAPPER_REPLACED');Object.defineProperty(proto,'getItem',getDescriptor);}catch(e){error ||= e;}
   if(error)throw error;restored=true;
  },
 };
}

function ownedStateTarget(raw,method){
 if(raw==='/api/user-state'&&['GET','PUT'].includes(method))return {url:raw,mode:'normal'};
 if(raw==='/api/user-state?recovery-snapshot=v1'&&method==='GET')return {url:raw,mode:'snapshot-v1'};
 throw Error('OWNED_STATE_QUERY_REFUSED');
}

function acceptedWitness(row){
 need(typeof row?.updated_at==='string'&&Number.isFinite(Date.parse(row.updated_at))&&row.preferences&&typeof row.preferences==='object'&&!Array.isArray(row.preferences),'REAL_RAW_ACK_WITNESS');
 return {updatedAt:row.updated_at,preferences:structuredClone(row.preferences)};
}

function assertSafetyUi(kind,events,start,version){
 const expected=kind==='ended-lifetime'?['signout']:kind==='uncertainty'?['recovery-open','recovery-confirm']:[];
 const selected=events.filter(e=>e.type==='safety-ui'&&e.doc===start.doc&&e.seq>start.seq);
 need(selected.length===expected.length,'EXACT_NATIVE_SAFETY_UI_COUNT');
 need(selected.every((e,i)=>e.action===expected[i]&&e.trusted===true&&e.documentVersion===String(version)),'TRUSTED_CURRENT_SAFETY_UI');
 return true;
}

function assertSafetyFacts(kind,facts,puts){
 need(facts.restored===true&&!facts.invalid,'STORAGE_WRAPPERS_RESTORED_AND_VALID');
 if(kind==='r2'){
  need(facts.r2Created&&facts.r2Retained===1&&facts.r2CurrentChoice,'R1_ACK_RETAINS_REAL_R2');
  need(puts.length===(facts.r2Cleared===1?2:1)&&puts.every(p=>p.status===200&&p.patchBaseUpdatedAt),'R2_EXACT_CONDITIONAL_ACK_COUNTS');
  need(facts.r2Cleared===1||facts.r2Pending,'R2_NOT_LOST');
  need(facts.r2Cleared!==1||facts.remoteMatches===true,'R2_REAL_REMOTE_CHOICE_ACK');
  need(facts.r2Cleared!==1||(facts.r2OwnAckBound===true&&facts.r2AckClockMatchesServer===true),'R2_OWN_COMPLETED_ACK_BEFORE_CLEAR');
 }else if(kind==='ack-failure'){
  need(facts.ackRejected===1&&facts.originalDurable&&facts.originalRam&&facts.baselineUnchanged&&facts.ownerCurrent&&facts.remoteMatches&&facts.state==='error','ACK_WITHHELD_ON_NATIVE_WRITE_FAILURE');
  need(puts.length===1&&puts[0].status===200&&puts[0].patchBaseUpdatedAt,'ONE_REAL_SAVE_NOT_LOCAL_ACK');
 }else if(kind==='uncertainty'){
  need(facts.recoveryWrite===1&&facts.verifyRejected===1&&facts.rollbackRejected===1,'GENUINE_RECOVERY_FAULT_SEQUENCE');
  need(facts.originalRam&&facts.originalBundleReceipt&&facts.candidateDurable&&facts.blocked&&facts.state==='error','ACTUAL_SCOPED_UNCERTAINTY_HOLD');
  need(puts.length===0,'UNCERTAIN_STORAGE_ZERO_PUT');
 }
}

function assertR2Causal({facts,events,attempts,handlers,wires}){
 const clears=events.filter(e=>e.type==='safety-storage'&&e.stage==='r2-ack-clears-r2');
 if(facts.r2Cleared===0){need(facts.r2Pending&&clears.length===0,'PENDING_R2_HAS_NO_CLEAR');return true;}
 need(facts.r2Cleared===1&&facts.r2OwnAckBound===true&&facts.r2AckClockMatchesServer===true&&clears.length===1,'OWN_R2_ACK_BOUND_REQUIRED');
 const clear=clears[0],op=facts.r2ClearOperation;
 need(clear.operation===op&&clear.ownReplyComplete&&clear.scopeMatches&&clear.clockMatches&&clear.durableChoiceMatches,'EXACT_R2_CLEAR_PROOF');
 const replies=events.filter(e=>e.type==='r2-reply'&&e.operation===op);
 need(replies.length===1,'ONE_COMPLETED_OWN_R2_REPLY');const reply=replies[0];
 const starts=attempts.filter(a=>a.id===reply.id&&a.method==='PUT');need(starts.length===1,'R2_REQUEST_ATTEMPT_JOIN');const start=starts[0];
 need(start.doc===reply.doc&&reply.doc===clear.doc&&start.seq<reply.seq&&reply.seq<clear.seq
  &&facts.r2ReplySequence===reply.seq&&facts.r2ClearSequence===clear.seq,'R2_SAME_DOCUMENT_CAUSAL_ORDER');
 need(reply.status===200&&reply.bodyComplete&&reply.conditional&&reply.scopeMatches&&reply.clockMatches&&reply.choiceMatches
  &&start.terminal?.kind==='response'&&start.terminal.operation===op&&start.terminal.status===200,'R2_BODY_AND_RESPONSE_COMPLETED');
 need(joinedOutcome(start,handlers,wires)===op&&handlers.find(h=>h.operation===op).patchBaseUpdatedAt,'R2_COMPLETED_CONDITIONAL_OPERATION');
 return true;
}

const SAFETY_PLANS={
 'already-open-clean':{kind:'ended-lifetime',api:6,puts:0,ms:25000},
 'already-open-dirty':{kind:'r2',api:6,puts:2,ms:15000},
 'first-open-dirty':{kind:'ack-failure',api:4,puts:1,ms:20000},
 'unknown-hold':{kind:'uncertainty',api:5,puts:0,ms:25000},
};
async function runSafetyPhase({page,context,state,version,plan,aggregate,pending,start}){
 const began=Date.now(),startCalls=state.stateCalls.length,initialApi=state.requests;
 let stopped=false,timer,originalError,facts,result,rejectStop;
 const stopSignal=new Promise((_,reject)=>rejectStop=reject);stopSignal.catch(()=>{});
 if(plan.kind==='uncertainty'){need(state.recoveryDeadline===undefined,'ONE_ORIGINAL_RECOVERY_DEADLINE');state.recoveryDeadline=began+plan.ms;}
 state.safetyActive={plan,api:0,began};state.phase='safety-'+plan.kind;
 const check=()=>{need(!stopped&&Date.now()-began<=plan.ms&&aggregate.ms+Date.now()-began<=100000,'SAFETY_WALL_BUDGET');};
 const step=async fn=>{check();const value=await Promise.race([fn(Math.max(1,Math.min(15000,plan.ms-(Date.now()-began),100000-aggregate.ms-(Date.now()-began)))),stopSignal]);check();return value;};
 const snapshot=()=>page.evaluate(()=>qaOwnedStorageSafety.facts());
 const restore=async()=>{
  let bound;const operation=page.evaluate(()=>{if(globalThis.qaOwnedStorageSafety&&!qaOwnedStorageSafety.facts().restored)qaOwnedStorageSafety.restore();});operation.catch(()=>{});
  try{await Promise.race([operation,new Promise((_,reject)=>{bound=setTimeout(()=>reject(Error('SAFETY_RESTORE_UNAVAILABLE')),Math.max(1,Math.min(2000,100000-aggregate.ms-(Date.now()-began))));})]);}finally{clearTimeout(bound);}
 };
 const edit=kind=>page.evaluate(kind=>{
  const order=['system','day','night'],p=clonePreferences(userPreferences);p.theme=order[(order.indexOf(p.theme)+1)%3];
  if(!savePreferences(p,{deliberate:true}))throw Error('SAFETY_ACTUAL_WRITER_REJECTED');
  if(kind)qaOwnedStorageSafety.capture(kind);
 },kind);
 const openAccount=async()=>{if(await step(()=>page.locator('#settingsModal').isVisible()))await step(timeout=>page.locator('#closeSettingsBtn').click({timeout}));await step(timeout=>page.locator('#accountIndicator .account-awareness-control').click({timeout}));};
 const quiet=async until=>{const left=Math.max(0,until-Date.now());if(left)await step(()=>page.waitForTimeout(left));};
 const work=(async()=>{
  if(plan.kind==='ended-lifetime'){
   await openAccount();
   const before=await step(()=>page.evaluate(()=>({life:serverSyncClient.accountSnapshot(),sync:serverStateSyncGeneration,preferences:JSON.stringify(userPreferences),raw:localStorage.getItem(PROFILE_STORAGE.KEYS.profilePrefix+activeProfileBundle.profile.id)})));
   state.safetyRead={seen:false};
   // Real offline/online resets the existing owner throttle; no flags/events are forged.
   await step(()=>context.setOffline(true));await step(()=>context.setOffline(false));
   await step(timeout=>page.waitForFunction(()=>serverPersistence.state==='syncing',null,{timeout}));
   need(state.safetyRead.seen,'REAL_RECONNECT_READ_REQUIRED');
   const witness=await step(()=>actualFocus(context,page,state,version,false));
   await step(timeout=>page.locator('#signOutAccountBtn').click({timeout}));
   await step(timeout=>page.waitForFunction(()=>serverPersistence.state==='signedOut'&&!serverSyncClient.accountSnapshot().hasSession,null,{timeout}));
   await quiet(state.safetyRead.at+15000);
   const after=await step(()=>page.evaluate(()=>({life:serverSyncClient.accountSnapshot(),sync:serverStateSyncGeneration,state:serverPersistence.state,preferences:JSON.stringify(userPreferences),raw:localStorage.getItem(PROFILE_STORAGE.KEYS.profilePrefix+activeProfileBundle.profile.id)})));
   need(after.state==='signedOut'&&!after.life.hasSession&&after.life.generation>before.life.generation&&after.sync>before.sync&&after.raw===before.raw&&after.preferences===before.preferences,'NATIVE_ENDED_LIFETIME_PRESERVES_CHOICES');
   need(state.stateCalls.slice(startCalls).length===1&&state.stateCalls.at(-1).method==='GET'&&state.stateCalls.at(-1).status===503,'NO_OLD_LIFETIME_FOLLOWUP');
   assertFocusAction({action:witness,witnesses:state.lifecycle,attempts:[],handlers:[],wires:[],requireRead:false});
   return {kind:plan.kind,witness:true,jointLifetimeOnly:true};
  }
  await step(()=>page.evaluate(installOwnedStorageSafety));
  if(plan.kind==='r2'||plan.kind==='ack-failure'){
   let seen;state.safetyGate={kind:plan.kind,seen:false,released:false,arrived:new Promise(resolve=>seen=resolve),notify:()=>seen()};
   await step(()=>edit(plan.kind==='r2'?'r2':null));
   await step(timeout=>page.waitForFunction(()=>!!pendingPreferenceIntent(serverPersistence.user?.id),null,{timeout}));
   // The server holds the actual accepted handler response at most2s.
   await step(()=>state.safetyGate.arrived);
   if(plan.kind==='r2')await step(()=>page.evaluate(accepted=>{
    const order=['system','day','night'],p=clonePreferences(userPreferences);p.theme=order[(order.indexOf(p.theme)+1)%3];
    if(!savePreferences(p,{deliberate:true}))throw Error('REAL_R2_WRITER_REJECTED');qaOwnedStorageSafety.armR2(accepted);
   },state.safetyGate.accepted));
   else await step(()=>page.evaluate(()=>qaOwnedStorageSafety.capture('ack-failure')));
   need(!state.safetyGate.expired,'REAL_RESPONSE_HOLD_WINDOW');state.safetyGate.release();
   await step(timeout=>page.waitForFunction(kind=>kind==='r2'?qaOwnedStorageSafety.facts().r2Retained===1:qaOwnedStorageSafety.facts().ackRejected===1,plan.kind,{timeout}));
   if(plan.kind==='ack-failure'){
    await step(timeout=>page.waitForFunction(()=>serverPersistence.state==='error',null,{timeout}));
    await quiet(began+15000);
   }
   return {kind:plan.kind};
  }
  // Keep the original unknown-field checkpoint. This separate owned-row change
  // provides known saved preferences; it never edits app baseline/receipt/hold.
  const localTheme=await step(()=>page.evaluate(()=>pendingPreferenceIntent(serverPersistence.user.id)?.preferences.theme));
  state.api.mutate(row=>{delete row.preferences.qaUnknownDecision;row.preferences.theme=['system','day','night'].find(value=>value!==localTheme&&value!==row.preferences.theme);});
  const saved=state.api.state();
  const normalized=await step(()=>page.evaluate(p=>mergePreferences(clonePreferences(p)),saved.preferences));let fixedPoint=true;
  try{assert.deepEqual(normalized,saved.preferences);}catch{fixedPoint=false;}
  need(fixedPoint,'RECOVERY_NORMALIZER_SEAM_REQUIRED');
  await openAccount();await step(timeout=>page.locator('[data-local-recovery-open]').click({timeout}));
  await step(timeout=>page.locator('[data-local-recovery-confirm]').waitFor({state:'visible',timeout}));
  await step(()=>page.evaluate(()=>qaOwnedStorageSafety.capture('uncertainty')));
  const metrics={...state.api.metrics},calls=state.stateCalls.length;
  await step(timeout=>page.locator('[data-local-recovery-confirm]').click({timeout}));
  await step(timeout=>page.waitForFunction(()=>localPreferenceRecoveryBlocked()&&!localPreferenceRecoveryBusy,null,{timeout}));
  need(state.api.metrics.stateLoads-metrics.stateLoads===1&&state.api.metrics.recoveryRpcs===metrics.recoveryRpcs&&state.api.metrics.rowWrites===metrics.rowWrites,'ACTUAL_SNAPSHOT_ONE_ROW_NO_RPC_WRITE');
  need(state.stateCalls.slice(calls).length===1&&state.stateCalls.at(-1).mode==='snapshot-v1'&&state.stateCalls.at(-1).status===200,'EXACT_REAL_RECOVERY_SNAPSHOT');
  await step(()=>page.evaluate(()=>qaOwnedStorageSafety.restore()));
  const witness=await step(()=>actualFocus(context,page,state,version,false));await quiet(began+15000);
  need(state.stateCalls.length===calls+1&&JSON.stringify(state.api.state())===JSON.stringify(saved),'UNCERTAINTY_REFUSES_AUTOMATIC_WORK');
  assertFocusAction({action:witness,witnesses:state.lifecycle,attempts:[],handlers:[],wires:[],requireRead:false});
  const naturalProof=await step(()=>state.recoveryObservation.finish(page));await step(()=>boundary(page,state));
  recoveryBytes.assertRecoveryProof({...naturalProof,events:[...state.safetyEvents,...state.lifecycle],attempts:[...state.attempts.values()],handlers:state.stateCalls,operations:state.wire,version:String(version),contract:state.recoveryContract});state.recoveryByteProof=naturalProof;
  return {kind:plan.kind,snapshotAccounting:true};
 })();
 pending.add(work);work.catch(()=>{}).finally(()=>pending.delete(work));
 try{
  result=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{stopped=true;const error=Error('SAFETY_AGGREGATE_STOP');rejectStop(error);reject(error);},Math.max(1,Math.min(plan.ms,100000-aggregate.ms)));})]);
  await step(()=>restore());
  assertSafetyUi(plan.kind,state.safetyEvents,start,version);
  const puts=state.stateCalls.slice(startCalls).filter(c=>c.method==='PUT');
  if(plan.kind!=='ended-lifetime'){facts=await step(()=>snapshot());if(plan.kind==='r2'&&facts.r2Cleared===1){const own=state.stateCalls.find(call=>call.operation===facts.r2ClearOperation&&call.method==='PUT'&&call.status===200);facts.r2AckClockMatchesServer=!!own&&await step(()=>page.evaluate(meta=>qaOwnedStorageSafety.replyMatchesServer(meta),{operation:own.operation,clock:own.responseUpdatedAt}));}if(plan.kind!=='uncertainty')facts.remoteMatches=await step(()=>page.evaluate(preferences=>qaOwnedStorageSafety.matchesRemote(preferences),state.api.state().preferences));assertSafetyFacts(plan.kind,facts,puts);}
  need(state.requests-initialApi<=plan.api&&puts.length<=plan.puts,'INCREMENTAL_SAFETY_BUDGET');
  result={...result,facts,api:state.requests-initialApi,expectedStatuses:puts.map(p=>p.status)};
 }catch(error){originalError=error;stopped=true;rejectStop(error);throw error;}
 finally{
  clearTimeout(timer);state.safetyGate?.release?.();
  try{await restore();}
  catch(error){state.failed=true;if(!originalError)throw error;try{originalError.safetyCleanupFailed=true;}catch{}}
  aggregate.ms+=Date.now()-began;
 }
 need(aggregate.ms<=100000,'INCREMENTAL_SAFETY_BUDGET');aggregate.phases++;return {...result,wallMs:Date.now()-began};
}

// These test-only functions are also extracted by the parse-only mutant checker.
function inWindow(attempt,start,end){
 return attempt.seq>(start.cursors[attempt.doc]||0)&&(!end||attempt.seq<=(end.cursors[attempt.doc]||0));
}
function joinedOutcome(attempt,handlers,wires){
 const operation=attempt.terminal?.operation;
 need(Number.isSafeInteger(operation)&&operation>0,'EXACT_ATTEMPT_OPERATION');
 const h=handlers.filter(x=>x.operation===operation&&x.method===attempt.method),w=wires.filter(x=>x.operation===operation&&x.method===attempt.method&&x.path==='/api/user-state');
 need(h.length===1&&w.length===1,'EXACT_HANDLER_WIRE_JOIN');
 if(attempt.mode==='snapshot-v1')need(h[0].mode==='snapshot-v1'&&w[0].mode==='snapshot-v1','EXACT_SNAPSHOT_OPERATION_JOIN');
 need(w[0].complete===true&&w[0].status===h[0].status&&h[0].status===attempt.terminal.status,'COMPLETE_MATCHING_OUTCOME');
 return operation;
}
function assertAttemptLedger({attempts,handlers,wires,windows,setupIntervals,partitionStart}){
 const ids=new Set(),operations=new Set();
 for(const a of attempts){
  need(typeof a.id==='string'&&a.id===a.doc+':'+a.seq&&!ids.has(a.id),'UNIQUE_DOCUMENT_ATTEMPT');ids.add(a.id);
  need(a.terminal&&['response','failed','cancelled'].includes(a.terminal.kind),'NO_INCOMPLETE_ATTEMPT');
  if(a.terminal.kind==='response'){
   const op=joinedOutcome(a,handlers,wires);need(!operations.has(op),'ONE_ATTEMPT_PER_OPERATION');operations.add(op);
  }else{
   // Only starts proven offline within the explicit setup interval may fail.
   // They stay in evidence. No settling/draining or successful-only filtering.
   need(a.online===false&&a.terminal.operation===null&&setupIntervals.some(s=>inWindow(a,s.start,s.end)),'UNEXPECTED_FAILED_OR_CANCELLED_ATTEMPT');
  }
 }
 need(handlers.every(h=>operations.has(h.operation)),'NO_UNJOINED_HANDLER_OPERATION');
 need(wires.filter(w=>w.path==='/api/user-state').every(w=>operations.has(w.operation)),'NO_UNJOINED_WIRE_OPERATION');
 const classifications=[];
 need(partitionStart&&partitionStart.cursors,'POST_FORWARD_PARTITION_START');
 for(const a of attempts.filter(a=>a.method==='PUT'&&inWindow(a,partitionStart,null))){
  const scopes=[...windows.map((window,index)=>({kind:'measured',index,window})),...setupIntervals.map((window,index)=>({kind:'offline-setup',index,window}))].filter(scope=>inWindow(a,scope.window.start,scope.window.end));
  need(scopes.length===1,scopes.length?'DOUBLE_CLASSIFIED_POST_FORWARD_PUT':'UNCOVERED_POST_FORWARD_PUT');
  classifications.push({attempt:a.id,kind:scopes[0].kind,index:scopes[0].index});
 }
 for(const setup of setupIntervals){
  need(setup.maxPutAttempts===1&&setup.end,'EXPLICIT_BOUNDED_OFFLINE_SETUP');
  const puts=attempts.filter(a=>a.method==='PUT'&&inWindow(a,setup.start,setup.end));
  need(puts.length<=setup.maxPutAttempts,'OFFLINE_SETUP_PUT_BOUND');
  need(puts.every(a=>a.online===false&&['failed','cancelled'].includes(a.terminal?.kind)&&a.terminal.operation===null),'OFFLINE_SETUP_EXPECTED_FAILURE_ONLY');
 }
 for(const window of windows){
  const selected=attempts.filter(a=>a.method==='PUT'&&inWindow(a,window.start,window.end));
  need(selected.length===window.expectedStatuses.length,'ALL_FORWARD_PUT_ATTEMPTS');
  need(selected.every(a=>a.terminal.kind==='response'),'NO_FAILED_MEASURED_PUT');
  selected.sort((a,b)=>a.terminal.operation-b.terminal.operation);
  need(selected.every((a,i)=>a.terminal.status===window.expectedStatuses[i]),'EXACT_MEASURED_PUT_OUTCOMES');
 }
 return {verified:true,classifications};
}
function assertFocusAction({action,witnesses,attempts,handlers,wires,requireRead}){
 need(action&&action.start.doc===action.end.doc&&action.start.seq<action.end.seq,'FOCUS_ACTION_DOCUMENT_FENCE');
 need(action.start.version===action.version&&action.end.version===action.version,'FOCUS_ACTION_VERSION_FENCE');
 need(!requireRead||action.start.idle===true,'IDLE_FOCUS_PREREQUISITE');
 const events=witnesses.filter(e=>e.doc===action.start.doc&&e.seq>action.start.seq&&e.seq<=action.end.seq);
 const focuses=events.filter(e=>e.event==='focus'&&e.trusted===true&&e.helperMounted===true&&e.documentVersion===action.version);
 need(focuses.length===1,'EXACT_NEW_MOUNTED_FOCUS');
 if(requireRead){
  need(action.readEnd&&action.readEnd.doc===action.start.doc&&action.readEnd.seq>=action.end.seq,'FOCUS_READ_END_FENCE');
  const reads=attempts.filter(a=>a.doc===action.start.doc&&a.seq>focuses[0].seq&&a.method==='GET').sort((a,b)=>a.seq-b.seq),read=reads[0];
  need(read&&read.seq<=action.readEnd.seq&&read.terminal?.kind==='response'&&read.terminal.status===200,'NEW_FOCUS_FOLLOWING_READ');
  need(action.readEnd.idle===true,'FOREGROUND_TERMINAL_SYNC');
  joinedOutcome(read,handlers,wires);
  // Foreground return is coalesced product behavior, not listener causality.
  const coalesced=witnesses.filter(e=>e.doc===action.start.doc&&e.seq>action.start.seq&&e.seq<=action.readEnd.seq&&['focus','online','pageshow','visible'].includes(e.event)).map(e=>({event:e.event,seq:e.seq,trusted:e.trusted===true}));
  return {protocol:'foreground-return-with-focus',focusSequence:focuses[0].seq,readOperation:read.terminal.operation,terminalSync:true,coalescedLifecycle:coalesced};
 }
 return true;
}
function observe(state,event,pageIdentity){
 need(typeof event.doc==='string'&&Number.isSafeInteger(event.seq)&&event.seq>0,'DOCUMENT_EVENT_FENCE');
 if(pageIdentity!==undefined){need(Number.isSafeInteger(pageIdentity)&&pageIdentity>0,'ACTUAL_PAGE_ID_REQUIRED');const prior=state.documentPages.get(event.doc);need(prior===undefined||prior===pageIdentity,'DOCUMENT_PAGE_IDENTITY_CONFLICT');state.documentPages.set(event.doc,pageIdentity);}
 state.documents.set(event.doc,Math.max(state.documents.get(event.doc)||0,event.seq));
 if(event.type==='document')return;
 if(event.type==='safety-storage'||event.type==='safety-ui'||event.type==='r2-reply'){
  const previous=state.safetyEvents.find(e=>e.doc===event.doc&&e.seq===event.seq);
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  if(previous){need(JSON.stringify(canonical(previous))===JSON.stringify(canonical(event)),'SAFETY_REPLAY_CONSISTENCY');return;}
  need(state.safetyEvents.length<16,'SAFETY_STORAGE_EVENT_CAP');state.safetyEvents.push(event);return;
 }
 if(event.type==='manual'){state.manualHits++;return;}
 if(event.type==='lifecycle'){
  const previous=state.lifecycle.find(e=>e.doc===event.doc&&e.seq===event.seq);
  if(previous){need(JSON.stringify(previous)===JSON.stringify(event),'LIFECYCLE_CONSISTENCY');return;}
  need(state.lifecycle.length<64,'LIFECYCLE_CAP');state.lifecycle.push(event);return;
 }
 if(event.type==='attempt'){
  const previous=state.attempts.get(event.id);
  if(previous){need(JSON.stringify(previous.start)===JSON.stringify(event),'ATTEMPT_START_CONSISTENCY');return;}
  need(state.attempts.size<32,'STATE_OBSERVER_CAP');
  if(event.method==='PUT'){need(state.puts.length<32,'PUT_OBSERVER_CAP');state.puts.push(event.id);}
  state.attempts.set(event.id,{...event,start:event,terminal:null});return;
 }
 if(event.type==='terminal'){
  const a=state.attempts.get(event.id);need(a&&a.doc===event.doc&&event.seq>a.seq,'TERMINAL_START_JOIN');
  if(a.terminal)need(JSON.stringify(a.terminal)===JSON.stringify(event),'ONE_TERMINAL_PER_ATTEMPT');else a.terminal=event;return;
 }
 need(false,'OBSERVATION_OVERFLOW_OR_UNKNOWN');
}
async function boundary(page,state){
 const snapshot=await page.evaluate(()=>qaInstalledObservation.snapshot());
 // Snapshot closes console-delivery lag for the live document, without waiting
 // for any sync, fetch, bookkeeping save or lifecycle action to finish.
 need(state.pages.has(page),'PAGE_SNAPSHOT_IDENTITY_REQUIRED');for(const event of snapshot.events)observe(state,event,state.pages.get(page));
 state.documents.set(snapshot.doc,snapshot.seq);
 return {...snapshot,events:undefined,cursors:Object.fromEntries(state.documents)};
}
async function actualFocus(context,page,state,version,requireIdle){
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
 const start=await boundary(page,state);need(!requireIdle||start.idle,'IDLE_FOCUS_PREREQUISITE');need(start.version===String(version),'FOCUS_CANDIDATE_DOCUMENT');
 await page.bringToFront();
 await page.waitForFunction(cursor=>qaInstalledObservation.snapshot().events.some(e=>e.doc===cursor.doc&&e.seq>cursor.seq&&e.type==='lifecycle'&&e.event==='focus'&&e.trusted&&e.helperMounted),start,{timeout:3000});
 const end=await boundary(page,state);await other.close();
 return {start,end,version:String(version)};
}
function browserObservation({token,refresh}){
 // Only the exact inert auxiliary document skips initialization. App errors remain strict.
 if(location.href==='about:blank')return;
 if(!localStorage.getItem('qa-installed-session-seeded')){localStorage.setItem('ns_auth_persistence_v1','persistent');localStorage.setItem('ns_auth_persistent_session_v1',JSON.stringify({accessToken:token,refreshToken:refresh,expiresAt:Date.now()+3600000}));localStorage.setItem('qa-installed-session-seeded','1');}
 const doc=crypto.randomUUID(),events=[];let sequence=0,attempts=0,lifecycle=0,overflow=false;
 const version=()=>document.querySelector('meta[name=app-shell-version]')?.content||null;
 function emit(value){const e={...value,doc,seq:++sequence};events.push(e);console.info('[qa-installed-auto]'+JSON.stringify(e));return e;}
 function fail(){if(!overflow){overflow=true;emit({type:'overflow'});}}
 emit({type:'document'});
 globalThis.qaInstalledObservation={recoveryLoad(event,alias){witness(event,'recovery-'+alias+'-'+event.type);return {doc,seq:sequence};},safety(facts){return emit({type:'safety-storage',...facts});},ownReply(facts){return emit({type:'r2-reply',...facts});},snapshot(){let idle=false;try{idle=serverPersistence.state==='signedIn'&&!globalThis.NOTHINGSPORTS_ACCOUNT_BOOTSTRAP&&!pendingPreferenceIntent(serverPersistence.user?.id);}catch{}return{doc,seq:sequence,version:version(),idle,events:events.slice()};}};
 globalThis.qaFocusWitnesses=0;
 function witness(event,type){if(++lifecycle>64){fail();return;}let mounted=false;try{mounted=!!accountIndicatorController;}catch{}if(type==='focus')qaFocusWitnesses++;emit({type:'lifecycle',event:type,trusted:event.isTrusted,helperMounted:mounted,documentVersion:version()});}
 for(const type of ['focus','pageshow','online','offline'])addEventListener(type,event=>witness(event,type),true);
 document.addEventListener('visibilitychange',event=>witness(event,document.hidden?'hidden':'visible'),true);
 globalThis.qaManualSyncInteractions=0;document.addEventListener('click',event=>{const action=event.target.closest?.('#signOutAccountBtn')?'signout':event.target.closest?.('[data-local-recovery-open]')?'recovery-open':event.target.closest?.('[data-local-recovery-confirm]')?'recovery-confirm':null;if(action)emit({type:'safety-ui',action,trusted:event.isTrusted===true,documentVersion:version()});if(event.target.closest?.('#syncAccountNowBtn')){qaManualSyncInteractions++;emit({type:'manual'});}},true);
 const fetchOriginal=globalThis.fetch;
 globalThis.fetch=function(input,options){
  const method=String(options?.method||input?.method||'GET').toUpperCase(),url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
  let start=null;if(url.origin===location.origin&&url.pathname==='/api/user-state'&&['GET','PUT'].includes(method)){
   if(++attempts>32)fail();else start=emit({type:'attempt',id:doc+':'+(sequence+1),method,path:url.pathname,mode:url.search==='?recovery-snapshot=v1'?'snapshot-v1':url.search?'other-query':'normal',online:navigator.onLine,documentVersion:version(),workerVersion:globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot?.().workerVersion||null});
  }
  let ownR2=false;if(start&&method==='PUT'&&globalThis.qaOwnedStorageSafety){try{ownR2=qaOwnedStorageSafety.captureSave(start,options?.body);}catch{qaOwnedStorageSafety.invalidateObservation();}}
  const terminal=(kind,status,operation)=>{if(start)emit({type:'terminal',id:start.id,kind,status,operation});};
  let promise;try{promise=fetchOriginal.apply(this,arguments);}catch(error){terminal(error?.name==='AbortError'?'cancelled':'failed',null,null);throw error;}
  if(!start)return promise;
  return promise.then(response=>{
   const raw=response.headers.get('x-qa-installed-operation'),operation=/^[1-9]\d*$/.test(raw||'')?Number(raw):null;terminal('response',response.status,operation);
   if(ownR2){
    const descriptor=Object.getOwnPropertyDescriptor(response,'json'),originalJson=response.json;let observedJson;
    const restore=()=>{try{if(Object.getOwnPropertyDescriptor(response,'json')?.value!==observedJson)throw Error('JSON_OBSERVER_REPLACED');if(descriptor)Object.defineProperty(response,'json',descriptor);else delete response.json;}catch{qaOwnedStorageSafety.invalidateObservation();}};
    try{
     if(typeof originalJson!=='function')throw Error('ACTUAL_JSON_CONSUMER_REQUIRED');
     observedJson=function(...args){
      if(this!==response)return originalJson.apply(this,args);
      let body;try{body=originalJson.apply(this,args);}catch(error){restore();throw error;}
      return body.then(payload=>{
       // Observe the SDK's actual completed JSON read. Same payload/response,
       // no second body read, clone, new request, status or body replacement.
       try{qaOwnedStorageSafety.observeOwnReply(start.id,response.status,operation,payload);}catch{qaOwnedStorageSafety.invalidateObservation();}
       restore();return payload;
      },error=>{restore();throw error;});
     };Object.defineProperty(response,'json',{configurable:true,writable:true,value:observedJson});
    }catch{qaOwnedStorageSafety.invalidateObservation();}
   }
   return response;
  },error=>{terminal(error?.name==='AbortError'?'cancelled':'failed',null,null);throw error;});
 };
}
async function cachedPins({version,paths}){
 const reg=await navigator.serviceWorker.getRegistration();if(reg?.active?.state!=='activated'||!navigator.serviceWorker.controller)throw Error('ACTIVATION_REQUIRED');
 const key='nothingsport-shell-v'+version;if(!(await caches.keys()).includes(key))throw Error('EXISTING_CACHE_REQUIRED');
 const cache=await caches.open(key),result={};
 for(const file of paths){const keys=await cache.keys(),matches=keys.filter(k=>new URL(k.url).pathname==='/'+file);if(matches.length!==1)throw Error('EXACT_CACHE_KEY_REQUIRED');const response=await cache.match(matches[0]);result[file]=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 return {hashes:result,active:reg.active.state,controlled:navigator.serviceWorker.controller.scriptURL===new URL('/service-worker.js',location.href).href};
}
async function cleanupCase({context,networkCutoff,pending,state,serve,originalError}){
 const failures=[];let cleanupError,drain={complete:false,remaining:pending.size},detached=!state.recoveryObservation;
 function record(stage,error){failures.push(stage);if(cleanupError||originalError)recoveryBytes.secondary(stage);cleanupError ||= error;}
 async function attempt(stage,operation){try{await operation();}catch(error){record(stage,error);}}
 await attempt('network-cutoff',()=>networkCutoff(false));
 await attempt('context-close',async()=>{if(context){await context.close();state.contextClosed=true;}});
 try{
  await attempt('pending-observations',()=>{
   const deadline=state.recoveryObservation?state.recoveryDeadline:undefined;
   if(state.recoveryObservation&&!Number.isFinite(deadline))throw Error('installed-auto:ORIGINAL_RECOVERY_DEADLINE_REQUIRED');
   return recoveryBytes.drainOwned(pending,{deadline,report:drain});
  });
 }finally{
  await attempt('recovery-observer-detach',()=>{
   let first;
   try{const status=state.recoveryObservation?.status();if(status?.failed)console.info('Installed recovery proof '+JSON.stringify(status));}
   catch(error){first=error;}
   finally{try{state.recoveryObservation?.detach();detached=true;}catch(error){if(first)recoveryBytes.secondary('detach-after-report');else first=error;}}
   if(first)throw first;
  });
 }
 await attempt('serve-candidate',()=>serve('candidate'));
 const withinPhaseDeadline=state.recoveryObservation?Number.isFinite(state.recoveryDeadline)&&Date.now()<=state.recoveryDeadline:null;
 if(withinPhaseDeadline===false){state.failed=true;record('cleanup-phase-deadline',Error('installed-auto:RECOVERY_CLEANUP_DEADLINE'));}
 state.cleanup={contextClosed:!!state.contextClosed,failures,pendingComplete:drain.complete,pendingRemaining:pending.size,recoveryDetached:detached,withinPhaseDeadline};
 if(!drain.complete||pending.size||!detached){state.failed=true;cleanupError ||= Error('installed-auto:INCOMPLETE_OWNED_CLEANUP');}
 if(cleanupError){
  if(originalError){try{Object.defineProperty(originalError,'installedAutomaticCleanup',{value:state.cleanup});}catch{recoveryBytes.secondary('cleanup-metadata');}try{console.info('Installed automatic cleanup '+JSON.stringify(state.cleanup));}catch{recoveryBytes.secondary('cleanup-report');}}
  else throw cleanupError;
 }
}

exports.create=function create({root}){
 let active=null,apiRequests=0;const safetyTotals={ms:0,api:0,puts:0,phases:0};const evidence=[],pending=new Set();
 function memory(){if(process.platform==='darwin')need(os.freemem()>=4.5*1024**3,'MAC_4_5_GIB_PREREQUISITE');}
 function route(req,res){
  if(!active||!req.url.startsWith('/api/')||req.headers['x-qa-installed-account']!==active.capability)return false;
  const state=active;const work=(async()=>{
   need(++apiRequests<=128,'FAMILY_API_CAP');need(++state.requests<=24,'CASE_API_CAP');if(state.safetyActive){need(++state.safetyActive.api<=state.safetyActive.plan.api&&++safetyTotals.api<=21,'INCREMENTAL_SAFETY_API_CAP');}const operation=state.requests;state.operations.set(operation,{phase:state.phase,path:new URL(req.url,'http://fixture.invalid').pathname,method:req.method});res.setHeader('X-QA-Installed-Operation',String(operation));
   let chunks=[],bytes=0;for await(const chunk of req){bytes+=chunk.length;need(bytes<=65536,'BODY_CAP');chunks.push(chunk);}const body=bytes?JSON.parse(Buffer.concat(chunks).toString()):{};
   const u=new URL(req.url,'http://fixture.invalid');let status=200,result;
   if(state.safetyRead&&!state.safetyRead.seen&&u.pathname==='/api/user-state'&&req.method==='GET'&&!u.search){
    state.safetyRead.seen=true;state.safetyRead.at=Date.now();await new Promise(resolve=>setTimeout(resolve,7000));
    state.stateCalls.push({method:'GET',status:503,phase:state.phase,operation,mode:'normal'});res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:'Disposable issued read failed'}));return;
   }
   if(state.name==='late-bootstrap'&&state.longArmed){
    if(u.pathname==='/api/user-state'&&req.method==='GET'){state.forwardReads++;if(state.forwardReads===1){state.firstReadAt=Date.now();state.firstReadSeen();await new Promise(r=>setTimeout(r,7000));}else if(state.forwardReads===2){state.stateCalls.push({method:'GET',status:503,phase:state.phase,operation});res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:'Disposable transport failure'}));return;}}
    if(u.pathname==='/api/user-meta'&&!state.metaDelayed){state.metaDelayed=true;await new Promise(r=>setTimeout(r,12000));}
   }
   if(u.pathname==='/api/auth')result=req.method==='GET'?{configured:true}:body.action==='logout'?{ok:true}:{session:{access_token:state.token,refresh_token:state.refresh,expires_in:3600}};
   else if(u.pathname==='/api/user-state'){
    need(req.headers.authorization==='Bearer '+state.token,'OWNED_BEARER');
    const target=ownedStateTarget(req.url,req.method);state.operations.get(operation).mode=target.mode;
    const response=await state.api.handle({method:req.method,url:target.url,headers:req.headers,body});status=response.status;result=response.body;
    state.stateCalls.push({...state.api.calls.at(-1),phase:state.phase,operation,mode:target.mode});
    const gate=state.safetyGate;if(gate&&!gate.seen&&req.method==='PUT'&&status===200){
     gate.seen=true;gate.accepted=acceptedWitness(result.state);let release,timer;const held=new Promise(resolve=>release=resolve);
     gate.release=()=>{if(!gate.released){gate.released=true;clearTimeout(timer);release();}};timer=setTimeout(()=>{gate.expired=true;gate.release();},2000);gate.notify();await held;
    }
   }else if(u.pathname==='/api/user-meta')result={meta:{sports:[]}};
   else if(u.pathname==='/api/feed')result=require(path.join(root,'lib/server-feed-pipeline')).buildServerFeed({events:[],userId:state.owner,userState:state.api.state(),now:new Date()});
   else if(u.pathname==='/api/nothingscore'&&u.searchParams.has('viewer'))result={viewer:{signedIn:true,profile:null}};
   else{status=503;result={error:'Disposable optional service unavailable'};}
   res.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store'});res.end(JSON.stringify(result));
  })().catch(()=>{state.failed=true;if(!res.headersSent)res.writeHead(500);res.end('{}');});
  pending.add(work);work.finally(()=>pending.delete(work));return true;
 }
 async function stable(page,state){
  await page.waitForFunction(()=>typeof serverPersistence!=='undefined'&&serverPersistence.state==='signedIn'&&!pendingPreferenceIntent(serverPersistence.user?.id)&&!globalThis.NOTHINGSPORTS_ACCOUNT_BOOTSTRAP,null,{timeout:15000});
  const identity=await page.evaluate(()=>({owner:serverPersistence.user?.id,subject:serverSyncClient.sessionSubject(),generation:serverSyncClient.accountSnapshot().generation,profile:activeProfileBundle.profile.id,pending:!!pendingPreferenceIntent(serverPersistence.user?.id)}));
  need(identity.owner===state.owner&&identity.subject===state.owner&&!identity.pending,'SAME_ACCOUNT_ACK');return identity;
 }
 async function pins(page,version,expectedFile){
  await page.waitForFunction(v=>document.querySelector('meta[name="app-shell-version"]')?.content===v&&NOTHINGSPORTS_APP_UPDATE.snapshot().workerVersion===v,String(version),{timeout:45000});
  const paths=['index.html','assets/js/app-shell-runtime.js','assets/js/account-awareness-runtime.js'];
  const expected=Object.fromEntries(paths.map(f=>[f,hash(expectedFile(f))]));
  const actual=await page.evaluate(cachedPins,{version:String(version),paths});need(actual.controlled&&actual.active==='activated','ACTIVE_WORKER');need(JSON.stringify(actual.hashes)===JSON.stringify(expected),'EXACT_CACHED_BYTES');return actual;
 }
 async function editOffline(context,page,networkCutoff,state,startCursor=null){
  const start=startCursor||await boundary(page,state);networkCutoff(true);await context.setOffline(true);
  state.intent=await page.evaluate(()=>{const p=clonePreferences(userPreferences);p.theme=p.theme==='day'?'night':'day';if(!savePreferences(p,{deliberate:true}))throw Error('QA_WRITER_REJECTED');return {theme:p.theme};});
  await page.waitForFunction(()=>!!pendingPreferenceIntent(serverPersistence.user?.id),null,{timeout:8000});
  const saved=await page.evaluate(()=>{const r=pendingPreferenceIntent(serverPersistence.user?.id);return {present:!!r,durable:JSON.stringify(PROFILE_STORAGE.readPreferenceIntent(localStorage,activeProfileBundle,serverPersistence.user.id))===JSON.stringify(r)};});need(saved.present&&saved.durable,'REAL_PERSISTED_INTENT');const end=await boundary(page,state);state.setupIntervals.push({name:'offline-edit',start,end,maxPutAttempts:1});return end;
 }
 async function run({browser,origin,installedNetwork,baselineSha,baselineVersion,candidateVersion,expectedSha,actualSha,baselineFile,candidateFile,serve,networkCutoff}){
  need(/^[a-f0-9]{40}$/.test(baselineSha||''),'ROOT_BASELINE_REQUIRED');need(/^[a-f0-9]{40}$/.test(expectedSha||'')&&actualSha===expectedSha,'ROOT_EXACT_HEAD_REQUIRED');need(Number(candidateVersion)>Number(baselineVersion),'REAL_FORWARD_VERSION_REQUIRED');need(/requestTimeoutMs\s*=\s*15000/.test(fs.readFileSync(path.join(root,'config/server-sync.js'),'utf8'))&&/SERVER_SYNC\.createClient\(\)/.test(fs.readFileSync(path.join(root,'index.html'),'utf8')),'ACTUAL_DEFAULT_DEADLINE_BINDING');
  const recoveryContract=recoveryBytes.sourceContract(candidateFile);
  for(const name of CASES){
   memory();serve('baseline');const owner='qa-'+crypto.randomUUID(),capability=crypto.randomUUID(),token='e30.'+Buffer.from(JSON.stringify({sub:owner})).toString('base64url')+'.disposable';
   const state=active={name,safetyEvents:[],documentPages:new Map(),pages:new WeakMap(),pageCount:0,lifecycle:[],documents:new Map(),attempts:new Map(),setupIntervals:[],windows:[],operations:new Map(),wire:[],forwardReads:0,puts:[],manualHits:0,owner,capability,token,refresh:'qa-'+crypto.randomUUID(),api:require(path.join(root,'scripts/lib/local-user-state-api'))(owner,{traceRequests:name==='unknown-hold'}),stateCalls:[],requests:0,phase:'baseline',failed:false};
   let context,closed=false,originalError;const errors=[];state.firstReadRequest=new Promise(resolve=>state.firstReadSeen=resolve);try{
    context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'allow',extraHTTPHeaders:{'X-QA-Installed-Account':capability}});await installedNetwork.attachContext(context);context.on('response',response=>{if(!new URL(response.url()).pathname.match(/^\/api\/(user-state|user-meta)$/))return;const observation=(async()=>{const op=Number(await response.headerValue('x-qa-installed-operation'));need(Number.isSafeInteger(op)&&state.operations.has(op),'EXACT_HTTP_OPERATION_JOIN');const complete=await response.finished(),timing=response.request().timing();state.wire.push({...state.operations.get(op),operation:op,status:response.status(),complete:!complete,durationMs:timing.responseEnd});if(response.status()===200)need(!complete&&timing.responseEnd>=0&&timing.responseEnd<15000,'SUCCESSFUL_WIRE_OPERATION_WITHIN_ACTUAL_DEADLINE');})().catch(()=>{state.failed=true;});pending.add(observation);observation.finally(()=>pending.delete(observation));});context.on('page',p=>{state.pages.set(p,++state.pageCount);p.on('pageerror',()=>errors.push('pageerror'));p.on('console',m=>{const text=m.text();if(text.startsWith('[qa-installed-auto]')){try{need(state.pages.has(p),'PAGE_CONSOLE_IDENTITY_REQUIRED');observe(state,JSON.parse(text.slice('[qa-installed-auto]'.length)),state.pages.get(p));}catch{state.failed=true;}}});});
    await context.addInitScript(browserObservation,{token,refresh:state.refresh});
    if(name==='unknown-hold'){state.recoveryContract=recoveryContract;await context.addInitScript(recoveryBytes.installBrowserProof,{contract:recoveryContract,version:String(candidateVersion)});state.recoveryObservation=recoveryBytes.observeNaturalResources({context,state,pending,origin,version:String(candidateVersion),contract:recoveryContract});}
    let page=await context.newPage();page.on('pageerror',()=>errors.push('pageerror'));await page.goto(origin+'/?qa-installed-auto=1',{waitUntil:'domcontentloaded'});await pins(page,baselineVersion,baselineFile);const before=await stable(page,state);need(before.profile,'LOCAL_PROFILE');
    let dirty=name.endsWith('-dirty')||name==='unknown-hold';if(dirty)await editOffline(context,page,networkCutoff,state);
    if(name==='unknown-hold')state.api.mutate(row=>row.preferences.qaUnknownDecision={enabled:false});
    let handlerBoundary=state.stateCalls.length,forwardBoundary=await boundary(page,state);state.partitionStart=forwardBoundary;state.phase='forward';if(!name.startsWith('already-open')){await page.close();page=await context.newPage();page.on('pageerror',()=>errors.push('pageerror'));}
    serve('candidate');networkCutoff(false);await context.setOffline(false);
    if(name.startsWith('already-open'))await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});else await page.goto(origin+'/?qa-installed-auto=1',{waitUntil:name==='reconnect-before-helper'?'commit':'domcontentloaded'});
    if(name==='reconnect-before-helper'){const cold=await page.evaluate(()=>typeof accountIndicatorController==='undefined'||!accountIndicatorController);need(cold,'COLD_HELPER_WINDOW_PREREQUISITE_NOT_SIMULATED');state.coldDocument=await boundary(page,state);networkCutoff(true);await context.setOffline(true);networkCutoff(false);await context.setOffline(false);state.coldBeforeReconnectObserved=true;}
    const actualPins=await pins(page,candidateVersion,candidateFile);await page.waitForFunction(()=>typeof accountIndicatorController!=='undefined'&&!!accountIndicatorController,null,{timeout:15000});
    const executed=await page.evaluate(()=>[...loadDeferredScript.requests.keys()].filter(u=>new URL(u,location.href).pathname==='/assets/js/account-awareness-runtime.js'));need(executed.length===1,'ONE_ACTUAL_DEFERRED_HELPER');const descriptor=candidateFile('service-worker.js').toString();need(descriptor.includes('/'+new URL(executed[0],origin).pathname.slice(1)+new URL(executed[0],origin).search),'EXECUTED_HELPER_REQUIRED_CACHE_BINDING');
    if(name==='late-bootstrap'){
      // Stage after the real forward worker/cache is active. Do not mistake an
      // interrupted old document's request for the target metadata chain.
      await stable(page,state);const setupStart=await boundary(page,state);state.windows.push({name:'initial-forward',start:forwardBoundary,end:setupStart,expectedStatuses:[]});forwardBoundary=await editOffline(context,page,networkCutoff,state,setupStart);dirty=true;handlerBoundary=state.stateCalls.length;state.longArmed=true;state.phase='late-bootstrap';
      await page.close();page=await context.newPage();page.on('pageerror',()=>errors.push('pageerror'));networkCutoff(false);await context.setOffline(false);await page.goto(origin+'/?qa-installed-auto=1',{waitUntil:'domcontentloaded'});
      let bound;try{await Promise.race([state.firstReadRequest,new Promise((_,reject)=>bound=setTimeout(()=>reject(Error('FIRST_READ_BOUND')),15000))]);}finally{clearTimeout(bound);}
      await page.waitForFunction(()=>typeof accountIndicatorController!=='undefined'&&!!accountIndicatorController,null,{timeout:3000});state.focusAction=await actualFocus(context,page,state,candidateVersion,false);need(Date.now()-state.firstReadAt<3500,'EARLY_REAL_FOCUS_WITNESS_PREREQUISITE');
    }
    if(name==='unknown-hold'){
     await page.waitForFunction(()=>serverPersistence.state==='error'&&!!pendingPreferenceIntent(serverPersistence.user?.id),null,{timeout:15000});need(state.stateCalls.slice(handlerBoundary).every(x=>x.method!=='PUT'),'UNKNOWN_CONFLICT_NO_PUT');need(state.api.state().preferences.qaUnknownDecision.enabled===false,'UNKNOWN_RETAINED');
    }else{
     if(name==='late-bootstrap')await page.waitForFunction(()=>serverPersistence.state==='signedIn'&&!pendingPreferenceIntent(serverPersistence.user?.id)&&!globalThis.NOTHINGSPORTS_ACCOUNT_BOOTSTRAP&&!globalThis.NOTHINGSPORTS_ACCOUNT_BOOTSTRAP,null,{timeout:45000});
     const after=await stable(page,state);need(after.profile===before.profile,'SAME_LOCAL_PROFILE');
     const forwardPuts=state.stateCalls.slice(handlerBoundary).filter(x=>x.method==='PUT');need(forwardPuts.length===(dirty?1:0),'ALL_FORWARD_PUT_ATTEMPTS');if(dirty){need(state.api.state().preferences.theme===state.intent.theme,'EXACT_INTENT_SAVED');need(forwardPuts[0].status===200&&!!forwardPuts[0].patchBaseUpdatedAt,'CONDITIONAL_ACK');}
     if(name==='foreground-return-with-focus'){
      await page.waitForTimeout(15000);const reads=state.stateCalls.length;const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/user-state'&&r.request().method()==='GET',{timeout:15000});state.focusAction=await actualFocus(context,page,state,candidateVersion,true);await response;
      await page.waitForFunction(()=>serverPersistence.state==='signedIn');need(state.stateCalls.length>reads,'ACTUAL_FOCUS_EVENT_PREREQUISITE');need(state.stateCalls.slice(reads).every(x=>x.method!=='PUT'),'FOCUS_CLEAN_NO_PUT');state.focusAction.readEnd=await boundary(page,state);
     }
     if(name==='reconnect-after-helper'){
      need(await page.evaluate(()=>!!accountIndicatorController),'MOUNTED_HELPER_PREREQUISITE');networkCutoff(true);await context.setOffline(true);const reads=state.stateCalls.length,response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/user-state'&&r.request().method()==='GET',{timeout:15000});networkCutoff(false);await context.setOffline(false);await response;await page.waitForFunction(()=>serverPersistence.state==='signedIn');need(state.stateCalls.length>reads,'OBSERVED_ONLINE_READ_REQUIRED');
     }
     if(name==='409-disjoint'){
      state.api.raceOnce(()=>state.api.mutate(row=>row.eventSpoilerState={qaOther:false}));const start=state.stateCalls.length;
      await page.evaluate(()=>{const p=clonePreferences(userPreferences);p.theme=p.theme==='day'?'night':'day';if(!savePreferences(p,{deliberate:true}))throw Error('QA_WRITER_REJECTED');});await stable(page,state);
      const attempts=state.stateCalls.slice(start).filter(x=>x.method==='PUT');need(attempts.length===2&&attempts[0].status===409&&attempts[1].status===200,'REAL_409_RETRY');need(state.api.state().eventSpoilerState.qaOther===false,'REMOTE_STATE_RETAINED');
     }
    }
    if(name==='late-bootstrap'){const reads=state.stateCalls.slice(handlerBoundary).filter(x=>x.method==='GET');need(reads.length===3&&reads[0].status===200&&reads[1].status===503&&reads[2].status===200,'FULL_BOOTSTRAP_FAILURE_THEN_ONE_FOLLOWUP');}
if(name==='reconnect-before-helper')need(state.lifecycle.some(e=>e.event==='online'&&e.trusted&&!e.helperMounted&&e.doc===state.coldDocument.doc&&e.seq>state.coldDocument.seq),'REAL_COLD_ONLINE_WITNESS_REQUIRED');
    const positiveEnd=await boundary(page,state);
    state.windows.push({name:'original-forward-positive',start:forwardBoundary,end:positiveEnd,expectedStatuses:name==='409-disjoint'?[409,200]:dirty?[200]:[]});
    forwardBoundary=positiveEnd;let tailStatuses=[];
    if(SAFETY_PLANS[name]){need(state.requests+SAFETY_PLANS[name].api<=24&&apiRequests+SAFETY_PLANS[name].api<=128,'SAFETY_HEADROOM_REQUIRED');state.safetyStart=positiveEnd;state.safetyResult=await runSafetyPhase({page,context,state,version:candidateVersion,plan:SAFETY_PLANS[name],aggregate:safetyTotals,pending,start:positiveEnd});tailStatuses=state.safetyResult.expectedStatuses||[];}
    await pins(page,candidateVersion,candidateFile);await boundary(page,state);await Promise.all([...pending]);need(state.manualHits===0,'NO_MANUAL_ACROSS_DOCUMENTS');need(await page.evaluate(()=>qaManualSyncInteractions===0),'NO_MANUAL_SYNC_INTERACTION');need(!state.failed&&errors.length===0,'STRICT_ERRORS');installedNetwork.assertIsolated();
    evidence.push({case:name,baselineSha,sourceSha:actualSha,coldBeforeReconnectObserved:!!state.coldBeforeReconnectObserved,baselineVersion,candidateVersion,activeAndCachesVerified:true,lifecycle:state.lifecycle,pins:actualPins.hashes,requests:state.requests,stateCalls:state.stateCalls.map(x=>({method:x.method,status:x.status,phase:x.phase,conditional:!!x.patchBaseUpdatedAt})),wireOperations:state.wire,browserAttempts:[...state.attempts.values()],setupIntervals:state.setupIntervals,focusAction:state.focusAction||null,manualSyncCalls:0,manualSyncInteractions:state.manualHits,limits:'Real installed loopback fixture with controlled Auth/database; not hosted/customer/OS-suspended/phone proof'});
    state.windows.push({name:'safety-or-clean-tail-through-close',start:forwardBoundary,end:null,expectedStatuses:tailStatuses});
   }catch(error){originalError=error;throw error;}
   finally{try{await cleanupCase({context,networkCutoff,pending,state,serve,originalError});closed=state.contextClosed;}finally{active=null;}}
   need(closed&&!state.failed,'NATURAL_CONTEXT_CLEANUP_AND_NO_LATE_FAILURE');
   const attempts=[...state.attempts.values()],partition=assertAttemptLedger({attempts,handlers:state.stateCalls,wires:state.wire,windows:state.windows,setupIntervals:state.setupIntervals,partitionStart:state.partitionStart});
   if(state.safetyResult?.kind==='r2')assertR2Causal({facts:state.safetyResult.facts,events:state.safetyEvents,attempts,handlers:state.stateCalls,wires:state.wire});
   if(state.safetyStart){const puts=attempts.filter(a=>a.method==='PUT'&&inWindow(a,state.safetyStart,null));need(puts.length<=SAFETY_PLANS[name].puts,'SAFETY_ALL_PUT_START_CAP');safetyTotals.puts+=puts.length;need(safetyTotals.puts<=3,'SAFETY_FAMILY_PUT_CAP');}
   if(name==='foreground-return-with-focus'||name==='late-bootstrap')state.foregroundProtocol=assertFocusAction({action:state.focusAction,witnesses:state.lifecycle,attempts,handlers:state.stateCalls,wires:state.wire,requireRead:name==='foreground-return-with-focus'});
   Object.assign(evidence.at(-1),{contextClosed:true,cleanup:state.cleanup,browserAttempts:attempts,wireOperations:state.wire,attemptLedgerVerified:true,putClassifications:partition.classifications,attemptWindows:state.windows,foregroundProtocol:state.foregroundProtocol||null,safety:state.safetyResult||null,safetyStorageEvents:state.safetyEvents,recoveryBytes:state.recoveryByteProof||null});
  }
  need(safetyTotals.phases===4&&safetyTotals.api<=21&&safetyTotals.puts<=3&&safetyTotals.ms<=100000,'FOUR_DECLARED_SAFETY_PHASES');
  const result={logicalPhases:14,contexts:10,safetyTotals,format:'installed-automatic-account.v4',execution:'ROOT-allocated future run only',cases:evidence,apiRequests,limits:{familyApi:128,caseApi:24,bodyBytes:65536},remainingGates:['cold-helper natural ingress must be captured without pause/clock tricks','late chain must retain one native focus witness and individually deadline-valid wire completions','installed uncertainty and owner/session-change negatives beyond retained existing suites','physical iPhone/OS-suspended acceptance']};need(Buffer.byteLength(JSON.stringify(result))<=131072,'EVIDENCE_BYTES_CAP');return result;
 }
 return {route,run,memory,cases:CASES};
};
