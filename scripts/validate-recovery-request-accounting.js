'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const account=require('./lib/recovery-request-accounting');
const copy=value=>structuredClone(value);
const refresh=packet=>{packet.eventBytes=packet.events.reduce((sum,event)=>sum+Buffer.byteLength(JSON.stringify(event),'utf8'),0);return packet;};
async function run(makeFixture=require('./validate-local-preference-recovery').fixture,sourceRoot=path.resolve(__dirname,'..')){
 const bytes=fs.readFileSync(__dirname+'/fixtures/recovery-preconfirm-read.v1.json');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'7f8bace5e9a64ea3889a9f138bf456396ed8e480cf34b1f136b53923ec271621');
 const actual=JSON.parse(bytes),accepted=account(actual);let cases=1;
 assert.equal(accepted.global.stateLoads,2);assert.equal(accepted.global.recoveryRpcs,1);assert.equal(accepted.ordinary.requests,1);
 assert.equal(accepted.snapshot.stateLoads,1);assert.equal(accepted.snapshot.recoveryRpcs,0);assert.equal(accepted.snapshot.rowWrites,0);
 assert.throws(()=>assert.equal(actual.current.stateLoads-actual.baseline.stateLoads,1),error=>error.code==='ERR_ASSERTION');cases++;
 const baseline=actual.events.find(e=>e.type==='phase'&&e.phase==='recovery-baseline-before-explanation');
 const start=mode=>actual.events.find(e=>e.sequence>baseline.sequence&&e.type==='request-start'&&e.mode===mode);
 const normalId=start('normal').requestId,snapshotId=start('snapshot-v1').requestId;
 const zero=copy(actual);zero.events=zero.events.filter(e=>e.requestId!==normalId&&!(e.type==='browser-initiator'&&e.event==='fetch-entry'&&e.sequence>baseline.sequence&&e.mode==='normal'));
 zero.current.stateLoads--;zero.current.recoveryRpcs--;
 const done=zero.events.find(e=>e.type==='phase'&&e.phase==='recovery-done');done.metrics.stateLoads--;done.metrics.recoveryRpcs--;done.completedCalls--;
 zero.events.find(e=>e.requestId===snapshotId&&e.type==='request-result').callIndex--;
 const realmCounts=new Map();zero.events.forEach((e,index)=>{e.sequence=index+1;if(e.type==='browser-initiator'){const count=(realmCounts.get(e.browserTimeOrigin)||0)+1;e.browserSequence=count;realmCounts.set(e.browserTimeOrigin,count);}});
 const single=account(refresh(zero));assert.equal(single.ordinary.requests,0);assert.equal(single.global.stateLoads,1);assert.equal(single.global.recoveryRpcs,0);cases++;
 const event=(p,predicate)=>{const found=p.events.find(predicate);assert(found);return found;};
 const snapshot=(p,type)=>event(p,e=>e.requestId===snapshotId&&e.type===type);
 const normal=(p,type)=>event(p,e=>e.requestId===normalId&&e.type===type);
 const browser=(p,kind)=>event(p,e=>e.sequence>baseline.sequence&&e.type==='browser-initiator'&&(kind==='normal'?e.event==='fetch-entry'&&e.mode==='normal':kind==='snapshot'?e.event==='fetch-entry'&&e.mode==='snapshot-v1':e.event==='trusted-native-click'&&e.action===kind));
 const insert=(p,e)=>{p.events.splice(p.events.findIndex(x=>x.type==='phase'&&x.phase==='recovery-done'),0,e);p.events.forEach((x,i)=>{x.sequence=i+1;});};
 const preOpen=copy(actual);[browser(preOpen,'normal').browserSequence,browser(preOpen,'open').browserSequence]=[browser(preOpen,'open').browserSequence,browser(preOpen,'normal').browserSequence];
 assert.equal(account(refresh(preOpen)).ordinary.requests,1);cases++;
 const unwitnessed=copy(preOpen),prior=event(unwitnessed,e=>e.type==='browser-initiator'&&e.browserTimeOrigin===browser(unwitnessed,'normal').browserTimeOrigin&&e.browserSequence===browser(unwitnessed,'normal').browserSequence-1);
 prior.directoryTimerPending=prior.followTimerPending=prior.followRebuildPending=false;assert.throws(()=>account(refresh(unwitnessed)));cases++;
 // A fully accounted second ordinary request must still fail the hard one-owner bound.
 const double=copy(actual),secondBrowser=copy(browser(double,'normal')),secondGroup=double.events.filter(e=>e.requestId===normalId).map(copy);
 for(const e of double.events.filter(e=>e.type==='browser-initiator'&&e.browserSequence>secondBrowser.browserSequence))e.browserSequence++;
 secondBrowser.browserSequence++;
 for(const e of secondGroup){e.requestId='request-999';if(e.type==='request-result')e.callIndex++;}
 const beforeConfirmIndex=double.events.indexOf(browser(double,'confirm'));double.events.splice(beforeConfirmIndex,0,secondBrowser,...secondGroup);
 snapshot(double,'request-result').callIndex++;double.current.stateLoads++;double.current.recoveryRpcs++;
 const doubleDone=event(double,e=>e.type==='phase'&&e.phase==='recovery-done');doubleDone.metrics.stateLoads++;doubleDone.metrics.recoveryRpcs++;doubleDone.completedCalls++;
 double.events.forEach((e,i)=>{e.sequence=i+1;});assert.throws(()=>account(refresh(double)),undefined,'fully accounted second ordinary request remains forbidden');cases++;
 const classifierSource=fs.readFileSync(__dirname+'/lib/recovery-request-accounting.js','utf8');assert(classifierSource.includes('normalFetches.length<=1'));
 const mutantModule={exports:{}};new Function('require','module',classifierSource.replace('normalFetches.length<=1','normalFetches.length<=2'))(require,mutantModule);
 assert.doesNotThrow(()=>mutantModule.exports(double),'meaningful widened owner-bound mutation admits the forbidden fully accounted receipt');cases++;
 const faults=[
 ['incomplete',p=>{p.complete=false;}],['overflow',p=>{p.overflow=true;}],['dropped',p=>{p.dropped=1;}],['invalidobserver',p=>{p.recoveryObserverInvalid=true;}],
 ['missingconfirm',p=>{p.events=p.events.filter(e=>e!==browser(p,'confirm'));}],['untrustedconfirm',p=>{browser(p,'confirm').trusted=false;}],
 ['differentrealm',p=>{browser(p,'normal').browserTimeOrigin++;}],['postconfirmnormal',p=>{const n=browser(p,'normal'),c=browser(p,'confirm');[n.browserSequence,c.browserSequence]=[c.browserSequence,n.browserSequence];}],
 ['busyordinary',p=>{browser(p,'normal').busy=true;}],['unknownordinaryowner',p=>{browser(p,'normal').followRebuildPending=false;}],
 ['noowneratopen',p=>{const o=browser(p,'open');o.directoryTimerPending=o.followTimerPending=o.followRebuildPending=false;}],
 ['unlockedSnapshot',p=>{browser(p,'snapshot').busy=false;}],['snapshotBeforeConfirm',p=>{const s=browser(p,'snapshot'),c=browser(p,'confirm');[s.browserSequence,c.browserSequence]=[c.browserSequence,s.browserSequence];}],
 ['unknownmode',p=>{browser(p,'normal').mode='other-query';}],['browserPut',p=>{browser(p,'normal').method='PUT';}],['unsafeurl',p=>{browser(p,'normal').url+='?extra';}],
 ['duplicateBrowserSequence',p=>{browser(p,'normal').browserSequence=browser(p,'open').browserSequence;}],['missingbrowserentry',p=>{p.events=p.events.filter(e=>e!==browser(p,'normal'));}],
 ['extraNormalRequest',p=>{insert(p,{...normal(p,'request-start'),requestId:'request-999'});}],
 ['snapshotExtraSelect',p=>{insert(p,{...snapshot(p,'load-start')});}],['snapshotRpc',p=>{insert(p,{...snapshot(p,'load-start'),type:'rpc-start',rpc:'active-preference-reset'});}],
 ['snapshotWrite',p=>{insert(p,{...snapshot(p,'load-start'),type:'write-start',storageMethod:'PATCH'});}],
 ['snapshotWrongOwner',p=>{snapshot(p,'load-start').subjectMatchesOwner=false;}],['snapshotMissingRow',p=>{snapshot(p,'load-end').found=false;}],
 ['snapshotFailure',p=>{snapshot(p,'request-result').status=503;}],['snapshotUnknownQuery',p=>{snapshot(p,'request-start').url+='&x=1';}],
 ['snapshotMissingEnd',p=>{p.events=p.events.filter(e=>e!==snapshot(p,'request-end'));}],['snapshotError',p=>{snapshot(p,'request-result').type='request-error';}],
 ['legacyRpcMissing',p=>{p.events=p.events.filter(e=>e!==normal(p,'rpc-start'));}],['legacyRpcUnknown',p=>{normal(p,'rpc-start').rpc='unknown';}],
 ['legacyRpcExtra',p=>{insert(p,{...normal(p,'rpc-start')});}],['normalExtraSelect',p=>{insert(p,{...normal(p,'load-start')});}],
 ['normalWrite',p=>{insert(p,{...normal(p,'load-start'),type:'write-start'});}],['normalFailure',p=>{normal(p,'request-result').status=500;}],
 ['crossingRequest',p=>{normal(p,'request-start').sequence=baseline.sequence;}],['unknownEvent',p=>{p.events.push({sequence:p.events.length+1,atMs:1,type:'unknown'});}],
 ['globalUnderreported',p=>{p.current.stateLoads--;}],['globalExtraRpc',p=>{p.current.recoveryRpcs++;}],['globalWrite',p=>{p.current.rowWrites++;}],
 ['globalRefresh',p=>{p.current.refreshes++;}],['globalSignin',p=>{p.current.authSignIns++;}],['globalPut',p=>{p.current.writes++;}],
 ['extraSnapshotHttp',p=>{p.current.snapshots++;}],['phaseCounterMismatch',p=>{event(p,e=>e.phase==='recovery-done').metrics.stateLoads++;}],
 ['unknownCall',p=>{snapshot(p,'request-result').callIndex++;}],['raisedCap',p=>{p.limits.events=129;}],['oversizedPacket',p=>{p.padding='x'.repeat(131072);}],
 ];
 for(const [name,mutate]of faults){const bad=copy(actual);mutate(bad);refresh(bad);assert.throws(()=>account(bad),undefined,name);cases++;}
 // Same-realm sequence, rather than timer resolution or console arrival, establishes order.
 const tied=copy(actual);for(const e of tied.events.filter(e=>e.type==='browser-initiator'))e.browserAtMs=7;
 assert.equal(account(refresh(tied)).ordinary.requests,1);cases++;
 const owner=await scheduledPreconfirmation(makeFixture,sourceRoot);cases++;
 const beforeOpenOwner=await scheduledPreconfirmation(makeFixture,sourceRoot,true);cases++;
 console.log(JSON.stringify({kind:'recovery-request-accounting',passed:true,cases,faults:faults.length+1,observedGlobalRedRetained:true,oneOwnerBoundMutationDetected:true,scheduledOwner:owner,scheduledBeforeOpenOwner:beforeOpenOwner,nativeOrServicesExecuted:false}));
}
module.exports={run};
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});

async function scheduledPreconfirmation(makeFixture,sourceRoot,beforeOpen=false){
 const SOURCE=sourceRoot,ROOT=sourceRoot;
 const {scheduledFollowOwner}=require(SOURCE+'/scripts/validate-recovery-cold-loader');
 const ui=require(SOURCE+'/config/preference-reset-ui');
 const elementSource=fs.readFileSync(SOURCE+'/scripts/validate-local-recovery-ui-lifecycle.js','utf8');
 const Element=vm.runInNewContext(elementSource.slice(elementSource.indexOf('class Element{'),elementSource.indexOf('\nfunction fixture(){'))+';Element');
 const f=makeFixture(),c=f.c,scheduler=scheduledFollowOwner(f);
 const api=require(ROOT+'/scripts/lib/local-user-state-api')('A',{traceRequests:true});api.seed(f.state);
 // Existing held fixture stores an older receipt base; keep its accepted base coherent before a genuine later writer.
 c.setServerStateBaseline({...f.state,preferences:structuredClone(f.receipt.basePreferences),updatedAt:f.receipt.baseUpdatedAt});
 assert.deepEqual(structuredClone(c.serverStateBaseline.state.preferences),f.receipt.basePreferences);
 const derived={scheduleCalls:0,cacheClearCalls:0,feedCalls:0,uiApplied:0};
 for(const [name,key]of [['loadFollowedScheduleFixtures','scheduleCalls'],['clearCachedPersonalisedFeed','cacheClearCalls'],['refreshRemoteFeed','feedCalls']]){
  const original=c[name];c[name]=(...args)=>{derived[key]++;return original(...args);};
 }
 const requests=[];
 c.serverSyncClient.loadState=async()=>{
  f.counters.read++;requests.push({method:'GET',mode:'normal'});
  const result=await api.handle({url:'/api/user-state',method:'GET',headers:{},body:{}});assert.equal(result.status,200);
  return {user:result.body.user,state:c.SERVER_SYNC.stateFromDatabaseRow(result.body.state),preferenceRecovery:result.body.preferenceRecovery||null};
 };
 c.serverSyncClient.loadRecoverySnapshot=async()=>{
  f.counters.snapshot++;requests.push({method:'GET',mode:'snapshot-v1'});
  const result=await api.handle({url:'/api/user-state?recovery-snapshot=v1',method:'GET',headers:{},body:{}});assert.equal(result.status,200);return result.body;
 };
 const next=structuredClone(c.userPreferences);
 next.preferenceGraph=c.PREFERENCE_SYSTEM.setEntityFollow(next.preferenceGraph,'team:football:australian-championship:11255','follow');
 assert.equal(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}),true,'real writer must queue the real Directory owner');
 assert.notEqual(c.directoryFollowEffectsTimer,null);assert.equal(c.localPreferenceRecoveryBusy,false);
 c.settingsViewportAnchor={};c.settingsSection='account';c.document.getElementById=id=>id==='settingsModal'?{classList:{contains:className=>className==='show'}}:null;
 const previousDocument=globalThis.document;globalThis.document={createElement:()=>new Element()};
 try{
  const body=new Element();const section=ui.mount(body,{signedIn:()=>true,recovery:()=>null,setRecovery:value=>value,
   captureScope:()=>c.serverStateSyncScope(),captureLocalRecoveryScope:()=>c.captureLocalRecoveryUiScope(),
   useSavedAccountPreferences:scope=>c.useSavedAccountPreferences(scope),afterLocalRecovery(){derived.uiApplied++;}});
  const counts={...api.metrics},storedBefore=f.values.get('ns_profile_v1:'+f.profileId),serverBefore=structuredClone(api.state());
  api.trace.mark('original-global-baseline-before-explanation',{metrics:{...api.metrics}});
  if(beforeOpen){
   assert.equal(section.querySelector('[data-local-recovery-warning]').hidden,true);
   await scheduler.advance(350);await scheduler.advance(850);
   assert.equal(section.querySelector('[data-local-recovery-warning]').hidden,true,'scheduled read can finish before explanation opens');
  }
  section.querySelector('[data-local-recovery-open]').handlers.click();
  assert.equal(section.querySelector('[data-local-recovery-warning]').hidden,false,'actual component opens its explanation');
  assert.equal(c.localPreferenceRecoveryBusy,false,'explanation does not acquire the app recovery lock');
  assert.equal(f.counters.snapshot,0);assert.equal(derived.uiApplied,0);
  if(!beforeOpen){await scheduler.advance(350);await scheduler.advance(850);}
  assert.equal(f.counters.read,1,'natural actual writer/Directory/Follow owner must issue one normal read before confirmation');
  assert.equal(c.localPreferenceRecoveryBusy,false);assert.equal(f.counters.snapshot,0);assert.equal(f.counters.save,0);
  assert.equal(f.values.get('ns_profile_v1:'+f.profileId),storedBefore);assert.deepEqual(api.state(),serverBefore);
  assert.equal(section.querySelector('[data-local-recovery-warning]').hidden,false);
  const beforeConfirm={...api.metrics};api.trace.mark('source-ui-confirm-handler-next',{metrics:beforeConfirm});
  await section.querySelector('[data-local-recovery-confirm]').handlers.click();
  assert.equal(derived.uiApplied,1,'actual UI must finish its actual recovery action');assert.equal(c.localPreferenceRecoveryBusy,false);
  assert.equal(f.counters.snapshot,1);assert.equal(f.counters.save,0);assert.equal(c.pendingPreferenceIntent('A'),null);
  assert.deepEqual(structuredClone(c.userPreferences),serverBefore.preferences);assert.deepEqual(api.state(),serverBefore);
  const scoped={stateLoads:api.metrics.stateLoads-beforeConfirm.stateLoads,recoveryRpcs:api.metrics.recoveryRpcs-beforeConfirm.recoveryRpcs,rowWrites:api.metrics.rowWrites-beforeConfirm.rowWrites};
  assert.deepEqual(scoped,{stateLoads:1,recoveryRpcs:0,rowWrites:0},'actual scoped snapshot remains one SELECT/zero RPC/zero PUT');
  assert.deepEqual(requests,[{method:'GET',mode:'normal'},{method:'GET',mode:'snapshot-v1'}]);
  const trace=api.trace.snapshot();assert.equal(trace.complete,true);
  console.log(JSON.stringify({kind:'explanation-interval-contract-control',actualUiAndScheduledOwner:true,ordinaryReadBeforeExplanationOpen:beforeOpen,preConfirm:{busy:false,normalReads:1,metrics:beforeConfirm},snapshot:scoped,
   originalInterval:{stateLoads:api.metrics.stateLoads-counts.stateLoads,recoveryRpcs:api.metrics.recoveryRpcs-counts.recoveryRpcs,rowWrites:api.metrics.rowWrites-counts.rowWrites},
   requests,derived,stubUserStateRowUnchanged:true,globalOneReadContractExpectedRed:true,trace,
   limits:'Constructed source fixture, actual writer/scheduled owner/UI/recovery/API handler; auth/database I/O mocked, derived schedule/feed/cache effects inert, DOM is existing test double. Not native trusted clicks, full browser or current CI causality.'}));
  assert.throws(()=>assert.equal(api.metrics.stateLoads-counts.stateLoads,1,'ORIGINAL whole-pre-explanation global one-read contract'),error=>error.code==='ERR_ASSERTION','retain the original global-contract RED');
  return {ordinarySelects:beforeConfirm.stateLoads,ordinaryLegacyRpcs:beforeConfirm.recoveryRpcs,snapshot:scoped};
 }finally{globalThis.document=previousDocument;}
}
