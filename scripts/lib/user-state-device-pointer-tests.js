'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=require('node:path').resolve(__dirname,'../..');
const html=fs.readFileSync(root+'/index.html','utf8');
function part(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);}
const clone=structuredClone,id='team:football:australian-championship:11255';
async function run(remoteProfileDifferent,fault=null,advanceRemote=false,options={}){
const f=require(root+'/scripts/lib/user-state-optional-view-tests').actualContext('config/preference-intent-reconcile.js'),{c}=f;
Object.assign(c,{serverSyncSequence:Promise.resolve(),serverSyncTimer:null,accountIndicatorJourney:null,startupFunnelFinished:false,followSharedHandle:async()=>{},clearAcknowledgedFixturePinCommands(){},setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_remote,current)=>current});
vm.runInContext(part('function activeProfileSection(','\nfunction saveActiveProfileSections(')+part('function loadPreferences(){','\nfunction savePreferences(')+part('function queueServerStateSync(){','\nfunction invalidateServerStateSyncScope(')+part('function setServerStateBaseline(','\nfunction queueServerStateSync(')+part('function invalidateServerStateSyncScope(){','\nasync function reconcileCurrentServerState(')+part('async function reconcileCurrentServerState(','\nfunction normalizeServerArchiveReferences(')+part('function acknowledgePreferenceReceipt(','\nasync function bootstrapServerPersistence('),c);
let preferences=c.mergePreferences({version:28,onboardingComplete:true,theme:'night',followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{schemaVersion:'preference-system.v1',domainPreferences:[{sportDomainId:'sport:football',enabled:false}],competitionPreferences:[{competitionId:'competition:australian-championship',enabled:false}],entityFollows:[]}});
preferences.preferenceGraph=c.PREFERENCE_SYSTEM.setEntityFollow(preferences.preferenceGraph,id,'follow');
for(let i=0;i<3;i++)preferences=c.mergePreferences(preferences);
c.userPreferences=clone(preferences);
const state=c.SERVER_SYNC.buildUserState({profile:{usernameLabel:c.activeProfileBundle.profile.usernameLabel,timezone:c.activeProfileBundle.profile.timezone,onboardingCompleted:true},preferences,eventUserState:{},eventSpoilerState:{},ratings:{},archivedEvents:[]});
const api=require(root+'/scripts/lib/local-user-state-api')('A');api.seed(state);c.applyServerState(api.state());c.setServerStateBaseline(api.state());
assert(!c.pendingPreferenceIntent('A'));
if(advanceRemote)api.mutate(()=>{});
if(remoteProfileDifferent)api.mutate(s=>{const g=s.preferences.preferenceGraph;const groups=options.groups||['graph','entityFollows','domainPreferences','competitionPreferences','viewing'];for(const group of groups){if(group==='graph')g.profileId='profile:device-B';else if(Array.isArray(g[group]))g[group].forEach(x=>x.profileId='profile:device-B');else g[group].profileId='profile:device-B';}});
if(fault==='theme')api.mutate(s=>s.preferences.theme='day');
if(fault==='unknown')api.mutate(s=>s.preferences.unknownChoice={enabled:true});
if(fault==='same-record-conflict')api.mutate(s=>s.preferences.preferenceGraph.entityFollows.find(x=>x.participantId===id).followLevel='priority');
const remoteBefore=api.state(),acceptedBefore=c.serverStateBaseline.updatedAt;
const request=async(method,patch)=>{const r=await api.handle({method,url:'/api/user-state',headers:{},...(patch?{body:{patch}}:{})});if(r.status!==200)throw Object.assign(Error('Disposable API refusal'),{status:r.status,code:r.body.code});return {user:r.body.user,state:c.SERVER_SYNC.stateFromDatabaseRow(r.body.state)};};
c.serverSyncClient.loadState=async()=>request('GET');c.serverSyncClient.savePatch=async patch=>{const response=await request('PUT',patch);if(options.inFlight&&!c.injected){c.injected=true;const newer=clone(c.userPreferences);newer.preferenceGraph=c.PREFERENCE_SYSTEM.setEntityFollow(newer.preferenceGraph,id,'priority');assert(c.savePreferences(newer,{deliberate:true}));c.newerReceipt=clone(c.pendingPreferenceIntent('A'));}return response;};
const scheduler=require(root+'/scripts/validate-recovery-cold-loader').scheduledFollowOwner(f);
const next=clone(c.userPreferences);next.preferenceGraph=c.PREFERENCE_SYSTEM.setEntityFollow(next.preferenceGraph,id,'unfollow');
// Same default writer as hosted helper: both its ordinary timer and actual Follow owner run.
assert.equal(c.savePreferences(next,{deliberate:true}),true);assert(c.pendingPreferenceIntent('A'));
if(options.persisted){const receipt=clone(c.pendingPreferenceIntent('A'));c.activeProfileBundle=c.PROFILE_STORAGE.loadActiveProfile(f.storage);c.userPreferences=c.loadPreferences();assert.deepEqual(c.pendingPreferenceIntent('A'),receipt);}
if(options.race)api.raceOnce(()=>api.mutate(s=>{if(options.race==='conflict')s.preferences.preferenceGraph.entityFollows.find(x=>x.participantId===id).followLevel='priority';else s.preferences.preferenceGraph.entityFollows.push({participantId:'team:football:epl:2',profileId:'profile:device-B',followLevel:'follow'});}));
const rawBefore=f.values.get('ns_profile_v1:'+c.activeProfileBundle.profile.id);
await scheduler.advance(500);await c.serverSyncSequence.catch(error=>{if(!fault&&options.race!=='conflict')throw error;});
if(options.race==='conflict'){assert.equal(api.calls.filter(x=>x.method==='PUT').length,1);assert.equal(api.calls.find(x=>x.method==='PUT').status,409);assert.equal(api.metrics.rowWrites,0);assert(c.pendingPreferenceIntent('A'));assert.equal(c.userPreferences.preferenceGraph.entityFollows.find(x=>x.participantId===id).followLevel,'unfollow');assert.equal(api.state().preferences.preferenceGraph.entityFollows.find(x=>x.participantId===id).followLevel,'priority');await assert.rejects(c.syncCurrentServerState(),e=>e.code==='preference_base_changed');assert.equal(api.calls.filter(x=>x.method==='PUT').length,1);return;}
if(fault){
assert.equal(api.calls.filter(x=>x.method==='PUT').length,0);assert(c.pendingPreferenceIntent('A'));assert.equal(c.serverPersistence.state,'error');
assert.equal(f.values.get('ns_profile_v1:'+c.activeProfileBundle.profile.id),rawBefore);
await assert.rejects(c.syncCurrentServerState(),error=>error.code==='preference_base_changed');
assert.equal(api.calls.filter(x=>x.method==='PUT').length,0);
assert.deepEqual(api.state(),remoteBefore);assert.equal(c.userPreferences.preferenceGraph.entityFollows.find(x=>x.participantId===id).followLevel,'unfollow');
console.log(JSON.stringify({kind:'real-choice-hold',fault,puts:0,receiptAndLocalRetained:true,remoteUnchanged:true}));return;
}
const automatic=api.calls.filter(x=>x.method==='PUT'&&x.status===200);assert.equal(automatic.length,1);const successfulIndex=api.calls.indexOf(automatic[0]);assert.equal(automatic[0].patchBaseUpdatedAt,api.calls.slice(0,successfulIndex).findLast(x=>x.method==='GET').responseUpdatedAt);if(options.race==='disjoint'){assert.equal(api.calls.filter(x=>x.status===409).length,1);assert(api.state().preferences.preferenceGraph.entityFollows.some(x=>x.participantId==='team:football:epl:2'&&x.followLevel==='follow'));}
if(options.inFlight){assert(c.pendingPreferenceIntent('A'));assert.equal(c.pendingPreferenceIntent('A').receiptId,c.newerReceipt.receiptId);assert.equal(c.userPreferences.preferenceGraph.entityFollows.find(x=>x.participantId===id).followLevel,'priority');assert.equal(c.serverPersistence.state,'error');await c.syncCurrentServerState();assert.equal(c.pendingPreferenceIntent('A'),null);assert.equal(api.state().preferences.preferenceGraph.entityFollows.find(x=>x.participantId===id).followLevel,'priority');const count=api.calls.filter(x=>x.method==='PUT').length;await c.syncCurrentServerState();assert.equal(api.calls.filter(x=>x.method==='PUT').length,count);return;}
assert.equal(c.pendingPreferenceIntent('A'),null);assert.equal(c.serverPersistence.state,'signedIn');
const postAck=api.state(),localBeforeManual=c.currentServerStatePayload();
const target=s=>s.preferences.preferenceGraph.entityFollows.find(x=>x.participantId===id)?.followLevel;
assert.equal(target(postAck),'unfollow');assert.equal(target(localBeforeManual),'unfollow');
// Existing hosted helper's explicit Sync now calls the actual normal reconciliation.
const attemptsBeforeManual=api.calls.filter(x=>x.method==='PUT').length;
await c.syncCurrentServerState();
const final=api.state(),writes=api.calls.filter(x=>x.method==='PUT'&&x.status===200);
assert.equal(target(final),'unfollow');assert.equal(final.preferences.theme,'night');assert.equal(final.preferences.preferenceGraph.domainPreferences[0].enabled,false);
assert.equal(c.pendingPreferenceIntent('A'),null);assert.equal(c.serverPersistence.state,'signedIn');
const evidence={remoteProfileDifferent,timestampOnlyControl:advanceRemote,acceptedBefore,remoteBefore:remoteBefore.updatedAt,naturalConditionalPuts:automatic.length,manualControllerExtraPuts:writes.length-automatic.length,postAckDelta:c.USER_STATE_SYNC.createPatch(postAck,localBeforeManual).changes.map(x=>x.path.join('.')),writes,ackTimestampChanged:final.updatedAt!==postAck.updatedAt,target:target(final),guardsRetained:true,limitations:['Constructed profile-ID fixture','API handler and normalizers are real; auth/database I/O and derived UI leaves are doubles','Manual controller call, no native click/auth/network/browser execution','Not proof of the exact first live assertion, Feed removal, or original iPhone symptom']};

assert.equal(api.calls.filter(x=>x.method==='PUT').length,attemptsBeforeManual,'Manual confirmation cannot add even a rejected PUT');
assert.equal(writes.length,1,'Native confirmation after default owner ACK cannot add another PUT');
assert.equal(final.updatedAt,postAck.updatedAt,'Confirmation retains the actual acknowledged timestamp');

if(remoteProfileDifferent)assert.deepEqual(c.serverStateBaseline.state.preferences,postAck.preferences,'Accepted baseline remains the raw response');
return evidence;
}
function projectionCases(){
 const transport=require(root+'/config/server-sync'),follow=require(root+'/config/follow-first');
 const options={profileId:'local-A',participantIdentity:follow.participantFollowIdentityKey};
 const base={preferenceGraph:{profileId:'remote-B',viewing:{profileId:'remote-B',enabled:false},learning:{profileId:'remote-B',unknown:7},
  entityFollows:[{profileId:'remote-B',participantId:'team:one',followLevel:'follow',unknown:{enabled:false}}],
  domainPreferences:[{profileId:'remote-B',sportDomainId:'sport:football',enabled:false}],competitionPreferences:[{profileId:'remote-B',competitionId:'competition:one',enabled:false}]}};
 const incoming=clone(base);for(const value of [incoming.preferenceGraph,incoming.preferenceGraph.viewing,incoming.preferenceGraph.learning,...incoming.preferenceGraph.entityFollows,...incoming.preferenceGraph.domainPreferences,...incoming.preferenceGraph.competitionPreferences])value.profileId='local-A';
 const before=clone(base),local=clone(incoming);assert.deepEqual(transport.settingsForServer(base,incoming,options),base);assert.deepEqual(base,before);assert.deepEqual(incoming,local);
 for(const [name,key]of [['entityFollows','participantId'],['domainPreferences','sportDomainId'],['competitionPreferences','competitionId']]){
  for(const duplicateSide of ['base','incoming']){const b=clone(base),l=clone(incoming);(duplicateSide==='base'?b:l).preferenceGraph[name].push(clone((duplicateSide==='base'?b:l).preferenceGraph[name][0]));assert.equal(transport.settingsForServer(b,l,options).preferenceGraph[name][0].profileId,'local-A','ambiguous list never projects record pointers');}
  const missing=clone(base);delete missing.preferenceGraph[name];assert.deepEqual(transport.settingsForServer(missing,incoming,options).preferenceGraph[name],incoming.preferenceGraph[name]);
  const fresh=clone(incoming);fresh.preferenceGraph[name].push({...clone(fresh.preferenceGraph[name][0]),[key]:'new:identity',enabled:false});assert.deepEqual(transport.settingsForServer(base,fresh,options).preferenceGraph[name][1],fresh.preferenceGraph[name][1]);
  const malformed=clone(incoming);malformed.preferenceGraph[name][0][key]=null;assert.deepEqual(transport.settingsForServer(base,malformed,options).preferenceGraph[name],malformed.preferenceGraph[name]);
 }
 const aliasBase=clone(base),aliasLocal=clone(incoming);aliasBase.preferenceGraph.entityFollows[0].participantId='athlete:tennis:123';aliasLocal.preferenceGraph.entityFollows[0].participantId='competitor:tennis:atp:123';
 const aliased=transport.settingsForServer(aliasBase,aliasLocal,options);assert.equal(aliased.preferenceGraph.entityFollows[0].profileId,'remote-B');assert.equal(aliased.preferenceGraph.entityFollows[0].participantId,'competitor:tennis:atp:123');
 aliasLocal.preferenceGraph.entityFollows.push({...aliasLocal.preferenceGraph.entityFollows[0],participantId:'athlete:tennis:123'});assert.deepEqual(transport.settingsForServer(aliasBase,aliasLocal,options).preferenceGraph.entityFollows,aliasLocal.preferenceGraph.entityFollows,'canonical collision never projects');
 for(const mutate of [x=>x.preferenceGraph.entityFollows[0].followLevel='unfollow',x=>x.preferenceGraph.domainPreferences[0].enabled=true,x=>x.preferenceGraph.competitionPreferences=[],x=>x.preferenceGraph.viewing.enabled=true,x=>x.preferenceGraph.learning.unknown=9,x=>x.unknownChoice={enabled:false}]){
  const changed=clone(incoming);mutate(changed);assert(require(root+'/config/profile-storage').preferenceBaseMatches({basePreferences:changed},transport.settingsForServer(base,changed,options)),'every meaningful/unknown field survives projection');
 }
 for(const pointer of [undefined,null,17,'']){const b=clone(base);b.preferenceGraph.profileId=pointer;assert.equal(transport.settingsForServer(b,incoming,options).preferenceGraph.profileId,'local-A');}
 const intentional=clone(incoming);intentional.preferenceGraph.profileId='custom-pointer';assert.equal(transport.settingsForServer(base,intentional,options).preferenceGraph.profileId,'custom-pointer');
 assert.deepEqual(transport.settingsForServer(base,incoming,{...options,profileId:null}),transport.mergeSettings(base,incoming));
 assert.deepEqual(transport.settingsForServer(null,incoming,options),incoming);
}
function ownershipCases(){
 for(const fence of ['owner','generation','profile','signed-out','subject','ui-owner']){
  const {c}=require(root+'/scripts/lib/user-state-optional-view-tests').actualContext('config/preference-intent-reconcile.js');
  vm.runInContext(part('function setServerStateBaseline(','\nfunction emptyServerStatePayload('),c);
  c.userPreferences=c.mergePreferences({version:28});const state=c.currentServerStatePayload();state.preferences.preferenceGraph.profileId='remote-B';c.setServerStateBaseline(state);
  const raw=clone(c.serverStateBaseline),id=c.activeProfileBundle.profile.id;
  assert.equal(c.currentServerStatePayload().preferences.preferenceGraph.profileId,'remote-B');
  if(fence==='owner')c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'B',generation:0});
  if(fence==='generation')c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'A',generation:1});
  if(fence==='profile')c.activeProfileBundle.profile.id='new-profile';
  if(fence==='signed-out')c.serverSyncClient.accountSnapshot=()=>({hasSession:false,accountId:'A',generation:0});
  if(fence==='subject')c.serverSyncClient.sessionSubject=()=> 'B';
  if(fence==='ui-owner')c.serverPersistence.user={id:'B'};
  assert.equal(c.currentServerStatePayload().preferences.preferenceGraph.profileId,id,'stale lifetime cannot project pointers');assert.deepEqual(clone(c.serverStateBaseline),raw);
 }
}
module.exports=async function devicePointerTests(){
 projectionCases();ownershipCases();await run(false);await run(false,null,true);await run(true);await run(true,null,false,{persisted:true});await run(true,null,false,{inFlight:true});await run(true,null,false,{race:'disjoint'});await run(true,null,false,{race:'conflict'});
 for(const group of ['graph','entityFollows','domainPreferences','competitionPreferences','viewing'])await run(true,null,false,{groups:[group]});
 for(const fault of ['theme','unknown','same-record-conflict'])await run(true,fault);
 console.log('Device pointers: real default owner/rebase/ACK/manual path, persisted/in-flight receipts, pointer shapes/aliases and lifetime fences passed.');
};
if(require.main===module)module.exports().catch(e=>{console.error(e);process.exitCode=1;});
