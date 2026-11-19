'use strict';
// Synthetic data ONLY. No device, real storage, server or restore operation.
const assert=require('node:assert/strict');
const clone=value=>JSON.parse(JSON.stringify(value));
const binding={accountId:'synthetic-account',profileId:'profile:synthetic',generation:4,shellVersion:'598',workerVersion:'598'};
function sample(){
 const preferences={version:26,onboardingComplete:true,theme:'system',followedSports:[],selectedSelectorEntityIds:[],
  preferenceGraph:{schemaVersion:'preference-system.v1',profileId:binding.profileId,domainPreferences:[{sportDomainId:'sport:football',enabled:false}],entityFollows:[],competitionPreferences:[]},
  followFirst:{followedMajorEventIds:[],excludedMajorEventIds:['synthetic-event'],notifications:{enabled:false},eventFamilyDecisions:{schemaVersion:'event-family-decisions.v1',states:{synthetic:'excluded'}}},
  tennis:{enthusiasm:'froth',gender:'both',eventType:'both',round:'all'},fifa:{enthusiasm:'froth',stage:'quarterfinal',contenders:'all'}};
 const base=clone(preferences);base.preferenceGraph.domainPreferences[0].enabled=true;
 const pending={ownerId:binding.accountId,generation:4,receiptId:'preference-edit:synthetic',baseUpdatedAt:'2026-10-29T00:00:00Z',basePreferences:base,preferences:clone(preferences)};
 const actions={removed:{addedToFixtures:false,pinMutationId:'synthetic-remove'},added:{addedToFixtures:true,pinMutationId:'synthetic-add'}};
 const queue={removed:{mutationId:'synthetic-remove',enabled:false,queuedAt:'2026-10-29T00:00:00Z'},added:{mutationId:'synthetic-add',enabled:true,queuedAt:'2026-10-29T00:00:00Z'}};
 const bundle={schemaVersion:6,profile:{id:binding.profileId,usernameLabel:'Synthetic'},preferences:clone(preferences),domainPreferences:[],competitionPreferences:[],entityFollows:[],viewingPreference:null,learningPreference:null,ratings:{synthetic:1},eventUserState:clone(actions),eventSpoilerState:{synthetic:{revealed:false}},archivedEvents:[{canonicalEventId:'synthetic-archive'}],preferenceSync:{writer:'owned-preference-intent.v1',entries:[clone(pending)]}};
 const ram={binding:clone(binding),preferences,activeProfileBundle:clone(bundle),pendingReceipt:pending,
  acceptedBaseline:{state:{preferences:base},updatedAt:pending.baseUpdatedAt,accountId:binding.accountId,generation:4},
  startupBaseline:{preferences:clone(base)},eventUserState:actions,eventSpoilerState:{synthetic:{revealed:false}},ratings:{synthetic:1},archivedEvents:[{canonicalEventId:'synthetic-archive'}],fixturePinQueue:queue};
 const storage=[{key:'ns_install_v1',text:JSON.stringify({activeProfileId:binding.profileId,installId:'synthetic-install',schemaVersion:1})},{key:'ns_active_profile_id_v1',text:JSON.stringify(binding.profileId)},
  {key:'ns_profile_v1:'+binding.profileId,text:' \n'+JSON.stringify(bundle)+'\n '},{key:'ns_fixture_pin_queue_v1',text:JSON.stringify({persistedOnly:{enabled:false,mutationId:'synthetic-old'}})}];
 return {ram,storage};
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
function run(){
 let globalReads=0,reads=0,outputs=0;
 const previous={};for(const name of ['window','localStorage','document']){previous[name]=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{configurable:true,get(){globalReads++;throw Error('No live surface');}});}
 const saved={log:console.log,warn:console.warn,error:console.error};for(const key of Object.keys(saved))console[key]=()=>{outputs++;};
 let cases=0;
 try{
  const {collectSnapshot}=require('./lib/inert-local-snapshot/collector'),{validateSnapshot}=require('./lib/inert-local-snapshot/validator');
  assert.equal(globalReads,0,'import must be inert');
  function collect(reference,expected=binding){
   const before=JSON.stringify(reference);freeze(reference);
   const result=collectSnapshot({readRam:()=>{reads++;return reference.ram;},readStorage:key=>{reads++;const entry=reference.storage.find(x=>x.key===key);assert(entry,'only declared storage may be read');return entry.text;}},expected);
   assert.equal(JSON.stringify(reference),before,'collector never mutates adapters');return result;
  }
  function blocked(name,mutate,code){const reference=sample();mutate(reference);const before=JSON.stringify(reference);let failure;try{collect(reference);}catch(error){failure=error;}assert(failure,name);assert.equal(failure.code,code,name);assert.equal(JSON.stringify(reference),before,name);assert(!String(failure).includes('SYNTHETIC_PRIVATE_SENTINEL'),name);cases++;}
  const reference=sample(),result=collect(reference),envelope=JSON.parse(result.text);
  assert.equal(reads,5,'one explicit RAM read and four allowlisted reads');assert.equal(envelope.storage[2].text,reference.storage[2].text,'raw persisted bytes retained');
  assert.equal(envelope.ram.preferences.preferenceGraph.domainPreferences[0].enabled,false);assert.deepEqual(envelope.ram.preferences.followedSports,[]);
  assert.deepEqual(envelope.ram.preferences.followFirst.excludedMajorEventIds,['synthetic-event']);assert.equal(envelope.ram.eventUserState.removed.addedToFixtures,false);
  assert.equal(envelope.ram.fixturePinQueue.removed.enabled,false);assert.equal(envelope.ram.fixturePinQueue.added.enabled,true);
  assert.notDeepEqual(JSON.parse(envelope.storage[3].text),envelope.ram.fixturePinQueue,'RAM/persisted pin evidence remains distinct');
  assert.equal(envelope.ram.pendingReceipt.basePreferences.preferenceGraph.domainPreferences[0].enabled,true,'original receipt base not replaced by current choice');
  assert.equal(result.validation.restoreSafe,false);assert.equal(result.validation.receiptReplayAllowed,false);assert.equal(result.validation.freshServerBackedUp,false);cases++;
  const restoredToDisposableJson=JSON.parse(JSON.stringify(envelope));assert.deepEqual(restoredToDisposableJson,envelope,'JSON envelope roundtrip only, no import/write');
  assert.equal(validateSnapshot(JSON.stringify(restoredToDisposableJson),binding,reference).losslessAgainstProvidedReference,true);cases++;
  const nested=sample();nested.ram.eventUserState.added.userLabel='Synthetic retained note';assert.equal(JSON.parse(collect(nested).text).ram.eventUserState.added.userLabel,'Synthetic retained note');cases++;
  blocked('unknown preference root',r=>{r.ram.preferences.syntheticUnknown={choice:false};},'UNCLASSIFIED_PREFERENCE');
  blocked('unknown follow choice',r=>{r.ram.preferences.followFirst.syntheticUnknown=false;},'UNCLASSIFIED_PREFERENCE');
  blocked('RAM owner mismatch',r=>{r.ram.binding.accountId='other';},'OWNER_OR_GENERATION_MISMATCH');
  blocked('RAM generation mismatch',r=>{r.ram.binding.generation++;},'OWNER_OR_GENERATION_MISMATCH');
  blocked('receipt owner mismatch',r=>{r.ram.pendingReceipt.ownerId='other';},'OWNER_OR_GENERATION_MISMATCH');
  blocked('accepted owner mismatch',r=>{r.ram.acceptedBaseline.accountId='other';},'OWNER_OR_GENERATION_MISMATCH');
  blocked('extra RAM field',r=>{r.ram.unrelated='blocked';},'INVALID_SHAPE');
  blocked('missing pin record',r=>{r.storage.pop();},'SNAPSHOT_REJECTED');
  blocked('invalid profile JSON',r=>{r.storage[2].text='not JSON';},'INVALID_JSON');
  blocked('wrong active profile',r=>{r.storage[1].text='"profile:other"';},'PROFILE_POINTER_MISMATCH');
  blocked('undefined cannot serialize losslessly',r=>{r.ram.ratings.synthetic=undefined;},'NON_JSON_DATA');
  blocked('negative zero cannot roundtrip exactly',r=>{r.ram.ratings.synthetic=-0;},'NON_JSON_DATA');
  blocked('nonfinite number',r=>{r.ram.ratings.synthetic=Infinity;},'NON_JSON_DATA');
  blocked('non-JSON object',r=>{r.ram.ratings.synthetic=new Date(0);},'NON_JSON_DATA');
  blocked('sparse array with expando',r=>{r.ram.ratings.synthetic=Object.assign(Array(1),{extra:'synthetic'});},'NON_JSON_DATA');
  blocked('dense array with expando',r=>{r.ram.ratings.synthetic=Object.assign([1],{extra:'synthetic'});},'NON_JSON_DATA');
  for(const key of ['privateKey','private_key','signingKey','serviceRoleKey','passwordHash','currentSession','authState']){
   blocked('credential in RAM profile',r=>{r.ram.activeProfileBundle.profile[key]='SYNTHETIC_PRIVATE_SENTINEL';},'SENSITIVE_CONTENT');
   blocked('credential in stored profile',r=>{const b=JSON.parse(r.storage[2].text);b.profile[key]='SYNTHETIC_PRIVATE_SENTINEL';r.storage[2].text=JSON.stringify(b);},'SENSITIVE_CONTENT');
  }
  for(const key of ['access_token','refreshToken','password','authorization','cookie','calendarToken'])blocked('sensitive key',r=>{r.ram.preferences[key]='SYNTHETIC_PRIVATE_SENTINEL';},'SENSITIVE_CONTENT');
  for(const value of ['Bearer SYNTHETIC_PRIVATE_SENTINEL','eyJhbGciOiJub25lIn0.eyJ1c2VyIjoic3ludGhldGljIn0.signature','https://example.invalid/calendar/SYNTHETIC_PRIVATE_SENTINEL','https://user:SYNTHETIC_PRIVATE_SENTINEL@example.invalid/','https://example.invalid/share?signature=SYNTHETIC_PRIVATE_SENTINEL'])blocked('sensitive value',r=>{r.ram.eventUserState.added.userLabel=value;},'SENSITIVE_CONTENT');
  blocked('secret in persisted raw profile',r=>{const b=JSON.parse(r.storage[2].text);b.profile.accessToken='SYNTHETIC_PRIVATE_SENTINEL';r.storage[2].text=JSON.stringify(b);},'SENSITIVE_CONTENT');
  const changed=JSON.parse(result.text);changed.ram.ratings.synthetic=2;let mismatch;try{validateSnapshot(JSON.stringify(changed),binding,reference);}catch(error){mismatch=error.code;}assert.equal(mismatch,'ROUNDTRIP_MISMATCH');cases++;
  let safeError;try{collectSnapshot({readRam(){throw Error('SYNTHETIC_PRIVATE_SENTINEL');},readStorage(){}},binding);}catch(error){safeError=error;}assert.equal(safeError.code,'SNAPSHOT_REJECTED');assert(!String(safeError).includes('SYNTHETIC_PRIVATE_SENTINEL'));cases++;
  const accessor=sample();let getterCalls=0;Object.defineProperty(accessor.ram.preferences,'synthetic',{enumerable:true,get(){getterCalls++;throw Error('SYNTHETIC_PRIVATE_SENTINEL');}});let accessorError;try{collectSnapshot({readRam:()=>accessor.ram,readStorage(){throw Error('must not read');}},binding);}catch(error){accessorError=error.code;}assert.equal(accessorError,'NON_JSON_DATA');assert.equal(getterCalls,0);cases++;
  const customArray=sample();let toJsonCalls=0;const array=[1];Object.setPrototypeOf(array,{toJSON(){toJsonCalls++;return ['SYNTHETIC_PRIVATE_SENTINEL'];}});customArray.ram.ratings.synthetic=array;
  let prototypeError;try{collectSnapshot({readRam:()=>customArray.ram,readStorage(){throw Error('must not read');}},binding);}catch(error){prototypeError=error.code;}
  assert.equal(prototypeError,'NON_JSON_DATA');assert.equal(toJsonCalls,0,'custom array serialization must never execute');cases++;
  assert.equal(globalReads,0);assert.equal(outputs,0,'collector and validator never log backup payloads');
 }finally{
  for(const key of Object.keys(saved))console[key]=saved[key];
  for(const [name,descriptor]of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
 }
 console.log(JSON.stringify({kind:'inert-local-snapshot-synthetic-controls',passed:true,cases,liveSurfaceReads:globalReads,backupLogCalls:outputs,restoreImplemented:false,customerDataCaptured:false}));
}
if(require.main===module)try{run();}catch(error){console.error(error.code||'SYNTHETIC_CONTROL_FAILED');process.exitCode=1;}
module.exports=run;
