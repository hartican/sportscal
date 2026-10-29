'use strict';
// Disposable constructed account/storage only. No real network, browser, phone or process fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const profiles=require('../config/profile-storage'),recovery=require('../config/local-preference-recovery'),sync=require('../config/user-state-sync');
const clone=x=>JSON.parse(JSON.stringify(x));
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
function part(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);}
let cases=0;
function fixture(){
 const {c,values,storage}=require('./lib/user-state-optional-view-tests').actualContext('config/preference-intent-reconcile.js');
 Object.assign(c,{localPreferenceRecoveryBusy:false,serverSyncSequence:Promise.resolve(),serverSyncTimer:null,accountIndicatorJourney:null,
   clearTimeout(){},clearAcknowledgedFixturePinCommands(){},setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_remote,current)=>current});
 vm.runInContext(part('function activeProfileSection(','\nfunction saveActiveProfileSections(')+part('function loadPreferences(){','\nfunction savePreferences(')+part('function queueServerStateSync(){','\nfunction invalidateServerStateSyncScope(')+part('function setServerStateBaseline(','\nfunction queueServerStateSync(')+part('function invalidateServerStateSyncScope(){','\nasync function reconcileCurrentServerState(')
  +part('async function reconcileCurrentServerState(','\nfunction normalizeServerArchiveReferences(')
  +part('function acknowledgePreferenceReceipt(','\nasync function bootstrapServerPersistence(')
  +part('async function useSavedAccountPreferences(){','\nlet preferenceResetUiLoad'),c);
 c.NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY=recovery;
 const profileId=c.activeProfileBundle.profile.id;
 let remote=c.mergePreferences({version:28,onboardingComplete:true,theme:'night',followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{schemaVersion:'preference-system.v1',profileId,domainPreferences:[{sportDomainId:'sport:football',enabled:false}],competitionPreferences:[],entityFollows:[]},followFirst:{followedMajorEventIds:[],excludedMajorEventIds:['event:synthetic'],eventFamilyDecisions:{schemaVersion:'event-family-decisions.v1',states:{synthetic:'excluded'}}}});
 for(let i=0;i<3;i++)remote=c.mergePreferences(remote);
 const original=clone(remote);assert(recovery.same(c.mergePreferences(remote),original),'remote fixture is a current normalizer fixed point');
 c.userPreferences=clone(remote);c.userPreferences.theme='day';
 const life=c.serverSyncClient.accountSnapshot();
 const state=c.SERVER_SYNC.buildUserState({profile:{usernameLabel:c.activeProfileBundle.profile.usernameLabel,timezone:c.activeProfileBundle.profile.timezone,onboardingCompleted:true},preferences:remote,eventUserState:{},eventSpoilerState:{},ratings:{},archivedEvents:[]});state.updatedAt='2026-10-29T01:00:00Z';
 const receipt={ownerId:'A',generation:life.generation,receiptId:'preference-edit:synthetic-held',baseUpdatedAt:'2026-10-28T01:00:00Z',basePreferences:{...clone(remote),eventsScope:'followed'},preferences:clone(c.userPreferences)};
 const bundle={...c.activeProfileBundle,preferences:clone(c.userPreferences),preferenceSync:{writer:'owned-preference-intent.v1',entries:[receipt]},ratings:{local:3},eventUserState:{local:{removed:true}},archivedEvents:[{canonicalEventId:'local-archive'}]};
 c.activeProfileBundle=profiles.saveBundle(storage,bundle);c.setServerStateBaseline(state);c.serverPersistence.state='error';c.serverPersistence.user={id:'A'};
 values.set('unrelated-sentinel','untouched');values.set('ns_fixture_pin_queue_v1','{"pending":{"enabled":false}}');values.set('ns_profile_v1:other','{"unrelated":true}');
 const counters={snapshot:0,read:0,save:0};let latest=clone(state),loadHook=null;
 c.serverSyncClient.loadRecoverySnapshot=async owner=>{assert.equal(owner.accountId,'A');counters.snapshot++;if(loadHook)await loadHook();return recovery.projectOwnRow({user_id:'A',schema_version:latest.schemaVersion,profile:latest.profile,preferences:latest.preferences,event_user_state:latest.eventUserState,event_spoiler_state:latest.eventSpoilerState,ratings:latest.ratings,archived_events:latest.archivedEvents,updated_at:latest.updatedAt},'A');};
 c.serverSyncClient.loadState=async()=>{counters.read++;return {user:{id:'A'},state:clone(latest)};};
 c.serverSyncClient.savePatch=async patch=>{assert.equal(patch.baseUpdatedAt,latest.updatedAt,'normal CAS is retained');counters.save++;latest=sync.applyPatch(latest,patch);latest.updatedAt='2026-10-29T01:01:00Z';return {user:{id:'A'},state:clone(latest)};};
 return {c,values,storage,receipt,counters,state,profileId,setHook:hook=>{loadHook=hook;},setLatest:value=>{latest=value;},latest:()=>latest};
}
async function run(){
 const f=fixture(),{c,values,receipt,counters}=f,key='ns_profile_v1:'+f.profileId;
 const before=JSON.parse(values.get(key)),originalUnrelated=new Map([...values].filter(([k])=>k!==key));
 await assert.rejects(c.syncCurrentServerState(),e=>e.code==='preference_base_changed','actual held path is red before recovery');assert.equal(counters.save,0);counters.read=0;cases++;
 const result=await c.useSavedAccountPreferences();assert.equal(result.recovered,true);assert.equal(counters.snapshot,1);assert.equal(counters.save,0);assert.equal(c.localPreferenceRecoveryBusy,false);cases++;
 const after=JSON.parse(values.get(key));assert.deepEqual(after.preferenceSync.entries,[]);assert.equal(c.pendingPreferenceIntent('A'),null);assert.equal(c.userPreferences.theme,'night');assert.equal(c.userPreferences.preferenceGraph.domainPreferences[0].enabled,false);assert.deepEqual(clone(c.userPreferences.followedSports),[]);assert.deepEqual(clone(c.userPreferences.followFirst.excludedMajorEventIds),clone(f.state.preferences.followFirst.excludedMajorEventIds));cases++;
 for(const field of Object.keys(before))if(!['preferences','preferenceSync','domainPreferences','competitionPreferences','entityFollows','viewingPreference','learningPreference'].includes(field))assert.deepEqual(after[field],before[field]);
 for(const [k,value]of originalUnrelated)assert.equal(values.get(k),value);cases++;
 await c.syncCurrentServerState();assert.equal(counters.save,0,'immediate real reconcile sends no PUT');assert.equal(counters.read,1);cases++;
 // Actual profile reopening + actual normalizer/payload keeps recovered preference decisions.
 const reopened=profiles.loadActiveProfile(f.storage);c.activeProfileBundle=reopened;c.userPreferences=c.loadPreferences();
 assert.equal(c.pendingPreferenceIntent('A'),null);assert(recovery.same(c.currentServerStatePayload().preferences,f.state.preferences));await c.syncCurrentServerState();assert.equal(counters.save,0);cases++;
 // Later real deliberate writer -> receipt -> actual planner -> normal guarded CAS -> matching ACK.
 assert.equal(c.savePreferences({...clone(c.userPreferences),theme:'day'},{deliberate:true}),true);assert(c.pendingPreferenceIntent('A'));await c.syncCurrentServerState();assert.equal(counters.save,1);assert.equal(c.pendingPreferenceIntent('A'),null);assert.equal(f.latest().preferences.theme,'day');cases++;
 // Preserve pending unrelated actions; recovery itself does not send them, later ordinary sync may.
 const pending=fixture();pending.c.eventActions={pending:{addedToFixtures:false,pinMutationId:'synthetic-remove'}};
 await pending.c.useSavedAccountPreferences();assert.equal(pending.counters.save,0);assert.equal(pending.c.eventActions.pending.addedToFixtures,false);assert(sync.hasChanges(sync.createPatch(pending.state,pending.c.currentServerStatePayload())));cases++;
 for(const [name,hook]of [
  ['account',f=>{f.c.serverPersistence.user={id:'B'};}],['session',f=>{f.c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'A',generation:1});}],
  ['sync generation',f=>{f.c.serverStateSyncGeneration++;}],['profile',f=>{f.c.activeProfileBundle={...f.c.activeProfileBundle,profile:{id:'other'}};}],
  ['RAM edit',f=>{f.c.userPreferences.theme='system';}],['persisted edit',f=>{const k='ns_profile_v1:'+f.profileId;const b=JSON.parse(f.values.get(k));b.preferences.theme='system';f.values.set(k,JSON.stringify(b));}],
  ['baseline edit',f=>{f.c.serverStateBaseline.updatedAt='2026-10-29T02:00:00Z';}],
 ]){
  const x=fixture();x.setHook(()=>hook(x));await assert.rejects(x.c.useSavedAccountPreferences(),undefined,name);assert.equal(x.counters.save,0);const b=JSON.parse(x.values.get('ns_profile_v1:'+x.profileId));assert.equal(b.preferenceSync.entries[0].receiptId,receipt.receiptId);assert.equal(x.c.localPreferenceRecoveryBusy,false);cases++;
 }
 for(const modify of [state=>({...state,updatedAt:'2026-10-28T01:00:00Z'}),state=>({...state,preferences:{...state.preferences,theme:'day'}}),state=>({...state,updatedAt:'2026-10-29T02:00:00Z',preferences:{unknownLegacy:false}})]){
  const x=fixture(),original=x.values.get('ns_profile_v1:'+x.profileId);x.setLatest(modify(clone(x.state)));await assert.rejects(x.c.useSavedAccountPreferences());assert.equal(x.values.get('ns_profile_v1:'+x.profileId),original);cases++;
 }
 // Remote-only changes in other roots must refuse, preserving both server evidence and local pending action.
 for(const changed of [state=>({...state,ratings:{remote:5}}),state=>({...state,eventUserState:{remote:{addedToFixtures:true}}}),state=>({...state,archivedEvents:[{canonicalEventId:'remote'}]})]){
  const x=fixture(),original=x.values.get('ns_profile_v1:'+x.profileId);x.c.eventActions={pending:{addedToFixtures:false,pinMutationId:'local-remove'}};
  const latest=changed(clone(x.state));latest.updatedAt='2026-10-29T02:00:00Z';x.setLatest(latest);
  await assert.rejects(x.c.useSavedAccountPreferences(),e=>e.code==='local_recovery_other_state_changed');
  assert.equal(x.values.get('ns_profile_v1:'+x.profileId),original);assert.equal(x.c.eventActions.pending.addedToFixtures,false);assert.deepEqual(x.latest(),latest);assert.equal(x.counters.save,0);cases++;
 }
 const delayed=fixture(),delayedRaw=delayed.values.get('ns_profile_v1:'+delayed.profileId);delete delayed.c.NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY;
 delayed.c.document.querySelector=()=>({content:'598'});delayed.c.loadDeferredScript=async()=>{delayed.c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'B',generation:1});delayed.c.serverPersistence.user={id:'B'};delayed.c.NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY=recovery;};
 await assert.rejects(delayed.c.useSavedAccountPreferences());assert.equal(delayed.counters.snapshot,0);assert.equal(delayed.values.get('ns_profile_v1:'+delayed.profileId),delayedRaw);cases++;
 // A running/queued old sync is invalidated and settled before the single recovery read.
 const settling=fixture(),oldScope=settling.c.serverStateSyncScope();let settle;
 settling.c.serverSyncSequence=new Promise(resolve=>{settle=resolve;});const recovering=settling.c.useSavedAccountPreferences();
 assert.equal(oldScope.current(),false);assert.equal(settling.c.queueServerStateSync(),false);assert.equal(settling.counters.snapshot,0);
 settle();await recovering;assert.equal(settling.counters.snapshot,1);cases++;
 const changedWhileSettling=fixture();let settled;changedWhileSettling.c.serverSyncSequence=new Promise(resolve=>{settled=resolve;});
 const rejected=changedWhileSettling.c.useSavedAccountPreferences();changedWhileSettling.c.userPreferences.theme='system';settled();await assert.rejects(rejected);assert.equal(changedWhileSettling.counters.snapshot,0);assert(changedWhileSettling.c.pendingPreferenceIntent('A'));cases++;
 // Transaction failure controls use actual profile commit and preserve unrelated receipt owners.
 const x=fixture(),xkey='ns_profile_v1:'+x.profileId,bundle=JSON.parse(x.values.get(xkey));bundle.preferenceSync.entries.push({...clone(receipt),ownerId:'B',receiptId:'preference-edit:other'});x.values.set(xkey,JSON.stringify(bundle));
 const sections=recovery.sections(x.state.preferences),original=x.values.get(xkey),args={ownerId:'A',expectedRaw:original,expectedReceipt:x.receipt,sections};
 let writes=0;const countStore={...x.storage,setItem(k,v){writes++;x.storage.setItem(k,v);}};
 const committed=profiles.recoverPreferences(countStore,bundle,args);assert.equal(writes,1);assert.deepEqual(committed.preferenceSync.entries.map(r=>r.ownerId),['B']);cases++;
 x.values.set(xkey,original);assert.throws(()=>profiles.recoverPreferences({...x.storage,setItem(){throw Error('synthetic quota');}},bundle,args));assert.equal(x.values.get(xkey),original);cases++;
 let reading=0;x.values.set(xkey,original);assert.throws(()=>profiles.recoverPreferences({...x.storage,getItem(k){if(++reading===2)throw Error('synthetic readback');return x.storage.getItem(k);}},bundle,args));assert.equal(x.values.get(xkey),original);cases++;
 x.values.set(xkey,original);let replaced=false;assert.throws(()=>profiles.recoverPreferences({...x.storage,setItem(k,v){x.storage.setItem(k,v);if(!replaced){replaced=true;const newer=JSON.parse(v);newer.preferences.theme='system';x.storage.setItem(k,JSON.stringify(newer));}}},bundle,args));assert.equal(JSON.parse(x.values.get(xkey)).preferences.theme,'system');cases++;
 x.values.set(xkey,original);let unreadable=false,uncertainWrites=0;
 const unavailable={...x.storage,getItem(k){if(unreadable)throw Error('synthetic unavailable');return x.storage.getItem(k);},setItem(k,v){uncertainWrites++;x.storage.setItem(k,v);unreadable=true;}};
 assert.throws(()=>profiles.recoverPreferences(unavailable,bundle,args),e=>e.code==='local_recovery_storage_uncertain');assert.equal(uncertainWrites,1,'unreadable ownership must not trigger blind rollback');cases++;
 const hold=fixture(),holdKey='ns_profile_v1:'+hold.profileId;let committedHold=false;hold.c.localStorage={...hold.storage,getItem(k){if(committedHold&&k===holdKey)throw Error('synthetic read unavailable');return hold.storage.getItem(k);},setItem(k,v){hold.storage.setItem(k,v);if(k===holdKey)committedHold=true;}};
 await assert.rejects(hold.c.useSavedAccountPreferences(),e=>e.code==='local_recovery_storage_uncertain');assert.equal(hold.c.localPreferenceRecoveryBusy,true);assert.equal(hold.c.activeProfileBundle.preferenceSync.entries[0].receiptId,hold.receipt.receiptId);assert.equal(hold.c.userPreferences.theme,'day');await hold.c.syncCurrentServerState();assert.equal(hold.counters.save,0);cases++;
 for(const bad of [{...args,expectedRaw:'stale'},{...args,expectedReceipt:{...receipt,receiptId:'other'}},{...args,sections:{preferences:{}}}]){x.values.set(xkey,original);assert.throws(()=>profiles.recoverPreferences(x.storage,bundle,bad));assert.equal(x.values.get(xkey),original);cases++;}
 await transportAndApi();
 console.log(JSON.stringify({kind:'local-preference-recovery-synthetic',passed:true,cases,customerOperation:false,phoneFixed:false,sourceOnly:true}));
}
async function transportAndApi(){
 const f=fixture(),row={user_id:'A',schema_version:'user-state.v2',profile:f.state.profile,preferences:f.state.preferences,event_user_state:{},event_spoiler_state:{},ratings:{},archived_events:[],updated_at:f.state.updatedAt},own=recovery.projectOwnRow(row,'A');
 class ServiceError extends Error{constructor(message,{status,payload}){super(message);this.status=status;this.payload=payload;}}
 let reads=0,rpcs=0,auth=true,currentRow=row;
 const service={SupabaseRequestError:ServiceError,bearerToken:()=> 'synthetic',authenticatedUser:async()=>{if(!auth)throw new ServiceError('Unauthorized',{status:401,payload:{code:'unauthorized'}});return{id:'A'};},loadUserState:async owner=>{assert.equal(owner,'A');reads++;return currentRow;},supabaseServiceRequest:async()=>{rpcs++;return null;},publicError:error=>({status:error.status||500,body:{code:error.payload?.code||'server_sync_failed'}})};
 const api={module:{exports:{}},URL,Buffer,require:name=>name==='../lib/supabase-server'?service:name==='../config/user-state-sync'?{}:name==='../lib/calendar-handler'?()=>{throw Error('Unexpected calendar');}:name==='../config/local-preference-recovery'?recovery:(()=>{throw Error('Unexpected module');})()};vm.runInNewContext(fs.readFileSync(__dirname+'/../api/user-state.js','utf8'),api);
 async function get(url='/api/user-state?recovery-snapshot=v1',body){const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.value=value;}};await api.module.exports({method:'GET',url,body},response);return response;}
 let response=await get();assert.equal(response.code,200);assert.equal(reads,1);assert.equal(rpcs,0);assert.equal(response.headers['Cache-Control'],'private, no-store, max-age=0');cases++;
 for(const [url,body]of [['/api/user-state?recovery-snapshot=v1&target=other'],['/api/user-state?recovery-snapshot=v1&recovery-snapshot=v1'],['/api/user-state?recovery-snapshot=v1',{userId:'other'}]]){const count=reads;assert.equal((await get(url,body)).code,400);assert.equal(reads,count);cases++;}
 auth=false;const before=reads;assert.equal((await get()).code,401);assert.equal(reads,before);auth=true;cases++;
 for(const bad of [null,{...row,user_id:'other'},{...row,preferences:null},{...row,updated_at:null}]){currentRow=bad;assert([404,409].includes((await get()).code));cases++;}
 assert.equal(rpcs,0);currentRow=row;assert.equal((await get('/api/user-state')).code,200);assert.equal(rpcs,1);cases++;
 let writes=0,clock=Date.now(),requests=[],mode='ok';const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem(k,v){writes++;m.set(k,v);},removeItem(k){writes++;m.delete(k);}};};
 const token='e30.'+Buffer.from(JSON.stringify({sub:'A'})).toString('base64url')+'.synthetic';
 const client=require('../config/server-sync').createClient({now:()=>clock,storage:memory(),persistentStorage:memory(),fetchImpl:async(url)=>{requests.push(url);if(url==='/api/auth')return new Response(JSON.stringify({session:{access_token:token,refresh_token:'synthetic',expires_in:3600}}));assert.equal(url,'/api/user-state?recovery-snapshot=v1');return new Response(JSON.stringify(mode==='ok'?own:{error:'expired'}),{status:mode==='ok'?200:401});}});
 await client.signIn('synthetic@example.invalid','synthetic',{persist:false});requests=[];const beforeWrites=writes;
 assert.deepEqual(await client.loadRecoverySnapshot({accountId:'A'}),own);assert.deepEqual(requests,['/api/user-state?recovery-snapshot=v1']);assert.equal(writes,beforeWrites);cases++;
 requests=[];mode='401';await assert.rejects(client.loadRecoverySnapshot({accountId:'A'}));assert.deepEqual(requests,['/api/user-state?recovery-snapshot=v1']);assert.equal(writes,beforeWrites);cases++;
 requests=[];await assert.rejects(client.loadRecoverySnapshot({accountId:'B'}));await assert.rejects(client.loadRecoverySnapshot());assert.deepEqual(requests,[]);cases++;
 clock+=3550000;await assert.rejects(client.loadRecoverySnapshot({accountId:'A'}));clock+=120000;await assert.rejects(client.loadRecoverySnapshot({accountId:'A'}));assert.deepEqual(requests,[]);assert.equal(writes,beforeWrites);cases+=2;
 // Actual deferred UI handler; confirmation is explicit and duplicate clicks do not reenter.
 const nodes=new Map(),node=key=>{if(!nodes.has(key))nodes.set(key,{hidden:true,disabled:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},focus(){}});return nodes.get(key);};
 const section={querySelector:node},ui={module:{exports:{}},Date,document:{createElement:()=>section}};vm.runInNewContext(fs.readFileSync(__dirname+'/../config/preference-reset-ui.js','utf8'),ui);
 let actions=0,finish;const pending=new Promise(resolve=>{finish=resolve;});ui.module.exports.mount({querySelector:()=>({appendChild(){}})},{captureScope:()=>({current:()=>true}),signedIn:()=>true,recovery:()=>null,setRecovery:x=>x,useSavedAccountPreferences:async()=>{actions++;await pending;},afterLocalRecovery(){}});
 assert.equal(actions,0);node('[data-local-recovery-open]').handlers.click();assert.equal(node('[data-local-recovery-warning]').hidden,false);
 const button=node('[data-local-recovery-confirm]'),event={currentTarget:button},first=button.handlers.click(event);await button.handlers.click(event);assert.equal(actions,1);finish();await first;assert.equal(button.disabled,false);assert(node('[data-local-recovery-status]').textContent.includes('loaded'));cases++;
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports=run;
