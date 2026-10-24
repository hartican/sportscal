'use strict';
// Real persisted receipt/bootstrap/queue/API; only auth and database I/O are disposable.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),file=path.join(__dirname,'user-state-account-scope-tests.js');
const helper={module:{exports:{}},require:createRequire(file),__dirname,console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.receiptProbe={sources,context};',helper,{filename:file});
const {sources,context}=helper.module.exports.receiptProbe,profile=require('../../config/profile-storage'),sync=require('../../config/user-state-sync'),transport=require('../../config/server-sync'),follow=require('../../config/follow-first');
const localApi=require('./local-user-state-api'),systems=require('../../config/preference-system'),clone=value=>JSON.parse(JSON.stringify(value));
const entity='team:football:australian-championship:11255',other='team:football:epl:2';
const entities=state=>state.preferences.preferenceGraph.entityFollows,domains=state=>state.preferences.preferenceGraph.domainPreferences;
const cases=[
 'restart-disjoint','same-record-independent-field','whole-empty-held','domain-empty-held','remove-record','remote-removal','already-applied',
 'domain-OFF','scoped-empty','remote-empty','entity-overlap','domain-overlap','deletion-versus-edit','local-edit-versus-deletion',
 'unknown-root','unknown-graph','unknown-record','unknown-local-view','malformed-local-view','malformed-record','duplicate-entity','duplicate-alias','duplicate-domain','missing-array','non-array',
 'notification-conflict','local-OFF-outside','invalid-identity','invalid-remote-clock','unknown-base','invalid-base-clock','cas-disjoint','cas-overlap','new-receipt-during-ACK','new-receipt-same-field','new-receipt-unknown','normalization-unacknowledged',
 'late-owner-read','late-generation-read','late-owner-ACK','late-generation-ACK','helper-unavailable',
];
module.exports=async function receiptBaseTests(){
 const results=[];
 for(const kind of cases){
  const api=localApi('A');
  const graph=systems.createPreferenceGraph({profileId:'local-A',domainIds:['sport:football']});
  graph.entityFollows=[{participantId:entity,followLevel:'follow'}];
  graph.domainPreferences=[systems.expandTemplate('local-A','sport:football','template:like',{scopedCompetitionIds:['competition:football:epl']})];
  const preferences=follow.migratePreferences({version:27,theme:'day',showSpoilers:false,feedCompact:false,followBrowse:{sportId:'sport:football',section:'teams-players',page:0},followedSports:[],selectedSelectorEntityIds:[],
   followFirst:{startupMeta:{sports:[]},notifications:{enabled:false,userChoice:false}},
   preferenceGraph:graph});
  api.seed({preferences,profile:{},eventUserState:{},eventSpoilerState:{},archivedEvents:[],ratings:{}});
  const base=api.state(),desired=clone(base),remote=clone(base);
  desired.preferences.followBrowse={sportId:'sport:cricket',section:'schedule',scheduleScope:{codeId:'sport:cricket',tournamentId:'',competitionId:'test',label:'Test'}};
  desired.preferences.feedCompact=true;
  desired.preferences.preferenceGraph=systems.setEntityFollow(desired.preferences.preferenceGraph,entity,'unfollow');
  desired.preferences.preferenceGraph=systems.quickAddDomain(desired.preferences.preferenceGraph,'sport:football','template:casual');
  remote.preferences.followBrowse={sportId:'sport:tennis',categoryId:'',section:'teams-players'};
  entities(remote).push({participantId:other,followLevel:'follow'});
  domains(remote).push(systems.expandTemplate('local-B','sport:cricket','template:froth'));
  let held=false,late=false;
  if(kind==='same-record-independent-field')domains(remote)[0].reminderDefault='off';
  if(kind==='whole-empty-held'){desired.preferences.preferenceGraph.entityFollows=[];held=true;}
  if(kind==='domain-empty-held'){desired.preferences.preferenceGraph.domainPreferences=[];held=true;}
  if(kind==='remove-record')desired.preferences.preferenceGraph.entityFollows=[];
  if(kind==='remove-record')remote.preferences.preferenceGraph.entityFollows=[entities(remote)[0]];
  if(kind==='remote-removal'){
   entities(desired).push({participantId:'team:football:epl:3',followLevel:'follow'});
   entities(desired)[0].followLevel='follow';remote.preferences.preferenceGraph.entityFollows=[entities(remote)[1]];
  }
  if(kind==='already-applied'){
   entities(remote)[0].followLevel='unfollow';remote.preferences.preferenceGraph.domainPreferences[0]=clone(domains(desired)[0]);
  }
  if(kind==='domain-OFF')domains(desired)[0].enabled=false;
  if(kind==='scoped-empty')domains(desired)[0].scopedCompetitionIds=[];
  if(kind==='remote-empty'){
   remote.preferences.preferenceGraph.entityFollows=[];desired.preferences.preferenceGraph.entityFollows=[];
  }
  if(kind==='entity-overlap'){entities(remote)[0].followLevel='priority';held=true;}
  if(kind==='domain-overlap'){domains(remote)[0].templateId='template:froth';held=true;}
  if(kind==='deletion-versus-edit'){desired.preferences.preferenceGraph.entityFollows=[];entities(remote)[0].followLevel='priority';held=true;}
  if(kind==='local-edit-versus-deletion'){remote.preferences.preferenceGraph.entityFollows=[];held=true;}
  if(kind==='unknown-root'){remote.preferences.futurePolicy=true;held=true;}
  if(kind==='unknown-graph'){remote.preferences.preferenceGraph.futurePolicy=true;held=true;}
  if(kind==='unknown-record'){domains(remote)[0].futurePolicy=true;held=true;}
  if(kind==='unknown-local-view'){remote.preferences.followBrowse.futurePolicy=true;held=true;}
  if(kind==='malformed-local-view'){remote.preferences.feedCompact='yes';held=true;}
  if(kind==='malformed-record'){domains(remote)[0].enabled='yes';held=true;}
  if(kind==='duplicate-entity'){entities(remote).push(clone(entities(remote)[0]));held=true;}
  if(kind==='duplicate-alias'){
   entities(remote).push({participantId:'athlete:tennis:123',followLevel:'follow'},{participantId:'competitor:tennis:atp:123',followLevel:'priority'});held=true;
  }
  if(kind==='duplicate-domain'){domains(remote).push(clone(domains(remote)[0]));held=true;}
  if(kind==='missing-array'){delete desired.preferences.preferenceGraph.domainPreferences;held=true;}
  if(kind==='non-array'){remote.preferences.preferenceGraph.entityFollows={};held=true;}
  if(kind==='notification-conflict'){remote.preferences.followFirst.notifications.enabled=true;held=true;}
  if(kind==='local-OFF-outside'){desired.preferences.followFirst.notifications.sportingRemindersEnabled=false;held=true;}
  if(kind==='invalid-identity'){domains(remote)[0].sportDomainId='sport:rally';held=true;}
  if(['invalid-remote-clock','unknown-base','invalid-base-clock','helper-unavailable'].includes(kind))held=true;
  if(kind.startsWith('late-'))late=true;
  if(kind==='cas-overlap')held=true;
  // The real API rejects malformed comparison lists at ingress. Inject these
  // negative legacy-read shapes only after an ordinary, valid remote write.
  const malformed=['duplicate-entity','duplicate-alias','duplicate-domain','non-array'].includes(kind);
  const putRemote=malformed?{...remote,preferences:{...remote.preferences,preferenceGraph:clone(base.preferences.preferenceGraph)}}:remote;
  const b=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:sync.createPatch(base,putRemote,{baseUpdatedAt:base.updatedAt})}});assert.equal(b.status,200,kind);
  if(malformed&&kind!=='non-array')api.mutate(state=>{state.preferences.preferenceGraph=clone(remote.preferences.preferenceGraph);});
  const c=context(sources(),{A:desired,B:base});c.PROFILE_STORAGE=profile;c.SERVER_SYNC=transport;
  const values=new Map();c.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  c.activeProfileBundle=profile.loadActiveProfile(c.localStorage);
  c.activeProfileBundle=profile.recordPreferenceIntent(c.localStorage,c.activeProfileBundle,{ownerId:'A',generation:0,baseUpdatedAt:kind==='unknown-base'?null:kind==='invalid-base-clock'?'unknown':base.updatedAt,basePreferences:base.preferences,preferences:desired.preferences});
  const original=c.pendingPreferenceIntent('A');let stored=JSON.stringify([...values]);
  c.serverStateBaseline={state:clone(base),updatedAt:base.updatedAt,accountId:'A',generation:0};
  let authGeneration=0,intercept=false,newReceipt;
  c.serverSyncClient.accountSnapshot=()=>({accountId:c.serverSyncClient.sessionSubject(),generation:authGeneration,hasSession:true});
  c.serverSyncClient.loadState=async()=>{
   c.calls.reads++;const r=await api.handle({method:'GET',url:'/api/user-state',headers:{}});assert.equal(r.status,200);
   if(intercept&&kind==='late-owner-read')c.switchAccount();
   if(intercept&&kind==='late-generation-read')c.invalidateServerStateSyncScope();
   const state=transport.stateFromDatabaseRow(r.body.state);
   if(intercept&&kind==='invalid-remote-clock')state.updatedAt='unknown';
   if(kind==='non-array')state.preferences.preferenceGraph.entityFollows={};
   return{user:r.body.user,state};
  };
  c.serverSyncClient.savePatch=async patch=>{
   assert.deepEqual(c.pendingPreferenceIntent('A'),newReceipt||original,'no pre-ACK rewrite of original base, ID or intent: '+kind);
   c.calls.writes++;const r=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch}});
   if(r.status!==200)throw Object.assign(new Error('Disposable conflict'),{status:r.status,code:r.body.code});
   if(kind.startsWith('new-receipt-')&&!newReceipt){
    const next=clone(desired.preferences);if(kind==='new-receipt-same-field')next.preferenceGraph.entityFollows[0].followLevel='priority';if(kind==='new-receipt-unknown')next.futurePolicy=true;next.preferenceGraph.entityFollows.push({participantId:'team:football:epl:4',followLevel:'priority'});
    next.preferenceGraph.domainPreferences[0].enabled=false;
    c.activeProfileBundle=profile.recordPreferenceIntent(c.localStorage,c.activeProfileBundle,{ownerId:'A',generation:0,baseUpdatedAt:base.updatedAt,basePreferences:base.preferences,preferences:next});
    newReceipt=c.pendingPreferenceIntent('A');assert.notEqual(newReceipt.receiptId,original.receiptId);
    c.applyServerState({...c.currentDevice(),preferences:next});
   }
   if(kind==='late-owner-ACK')c.switchAccount();
   if(kind==='late-generation-ACK'){authGeneration++;c.invalidateServerStateSyncScope();}
   const result=transport.stateFromDatabaseRow(r.body.state);
   if(kind==='normalization-unacknowledged')result.preferences.preferenceGraph.entityFollows[0].followLevel='priority';
   return{user:r.body.user,state:result};
  };
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=html.indexOf('function setServerStateBaseline('),end=html.indexOf('function applyServerStatePreservingChanges(',start);
  vm.runInContext(html.slice(start,end),c);
  await c.bootstrapServerPersistence({checkStatus:false});
  assert.equal(c.serverPersistence.state,'error','bootstrap holds original receipt before deferred helper: '+kind);
  if(!malformed){
   assert.equal(profile.preferenceBaseMatches(c.pendingPreferenceIntent('A'),c.serverStateBaseline.state.preferences),false,kind);
   assert.equal(c.serverStateBaseline.updatedAt,api.state().updatedAt,'bootstrap accepts remote baseline: '+kind);
  }
  assert.equal(JSON.stringify([...values]),stored,'bootstrap retains exact persisted intent');
  // A fresh profile read models persisted restart before the explicit retry.
  c.activeProfileBundle=profile.loadActiveProfile(c.localStorage);assert.deepEqual(c.pendingPreferenceIntent('A'),original);stored=JSON.stringify([...values]);
  c.FOLLOW_FIRST=follow;
  c.document={querySelector:()=>({content:JSON.parse(fs.readFileSync(path.join(root,'app-version.json'),'utf8')).version}),getElementById:()=>null,
   createElement:()=>({addEventListener(type,fn){this[type]=fn;}})};
  c.navigator={clipboard:{writeText:async value=>{c.copied=value;}}};
  if(kind!=='helper-unavailable')vm.runInContext(fs.readFileSync(path.join(root,'assets/js/account-awareness-runtime.js'),'utf8'),c);
  if(kind==='cas-disjoint'||kind==='cas-overlap')api.raceOnce(()=>api.mutate(state=>{
   if(kind==='cas-overlap')entities(state)[0].followLevel='priority';
   else{entities(state).push({participantId:'team:football:epl:5',followLevel:'priority'});domains(state)[0].reminderDefault='off';}
  }));
  const remoteBefore=api.state();intercept=true;c.calls.reads=0;c.calls.writes=0;let caught;
  try{await c.syncCurrentServerState({notify:true});}catch(error){caught=error;}
  if(held){
   if(malformed)assert(caught,'malformed input fails visibly: '+kind);else assert.equal(caught?.code,'preference_base_changed',kind);assert.equal(c.calls.writes,kind==='cas-overlap'?1:0,kind);
   assert.equal(JSON.stringify([...values]),stored,'hold preserves receipt bytes: '+kind);
   if(kind!=='cas-overlap')assert.deepEqual(api.state(),remoteBefore,'held state untouched: '+kind);
  }else if(late){
   assert.equal(caught,undefined,kind);assert.equal(JSON.stringify([...values]),stored,'late lifetime cannot ACK receipt: '+kind);
   assert.equal(c.calls.writes,kind.endsWith('-ACK')?1:0,kind);
  }else{
   assert.equal(caught,undefined,'independent owned choices reconcile: '+kind);
   assert.equal(c.calls.reads,kind==='cas-disjoint'?2:1,'only existing reads/retry: '+kind);
   assert.equal(c.calls.writes,kind==='already-applied'?0:kind==='cas-disjoint'?2:1,kind);
   const saved=api.state();
   assert.equal(saved.preferences.followFirst.notifications.enabled,false,kind);assert.equal(saved.preferences.showSpoilers,false);
   assert.deepEqual(saved.preferences.followBrowse,remoteBefore.preferences.followBrowse,'server retains remote view: '+kind);
   assert.equal(saved.preferences.feedCompact,false,'local view never overwrites remote view: '+kind);
   if(!['remove-record','remote-removal','remote-empty'].includes(kind))assert.equal(entities(saved).find(row=>row.participantId===entity)?.followLevel,'unfollow',kind);
   if(!['remove-record','remote-empty'].includes(kind))assert(entities(saved).some(row=>row.participantId===other),'independent remote entity survives: '+kind);
   assert(domains(saved).some(row=>row.sportDomainId==='sport:cricket'),'independent remote domain survives: '+kind);
   assert.equal(domains(saved)[0].templateId,'template:casual',kind);
   if(kind==='same-record-independent-field'||kind==='cas-disjoint')assert.equal(domains(saved)[0].reminderDefault,'off','untouched remote record field survives');
   if(kind!=='new-receipt-unknown')assert(domains(c.currentDevice()).some(row=>row.sportDomainId==='sport:cricket'),'remote domain also renders locally: '+kind);
   if(kind==='domain-OFF')assert.equal(domains(saved)[0].enabled,false);
   if(kind==='scoped-empty')assert.deepEqual(domains(saved)[0].scopedCompetitionIds,[]);
   if(kind==='remote-removal')assert(!entities(saved).some(row=>row.participantId===entity),'remote removal not revived');
   if(kind==='normalization-unacknowledged'){
    assert.deepEqual(c.pendingPreferenceIntent('A'),original,'unmatched response never acknowledges witness');assert.equal(c.serverPersistence.state,'error');
   }else if(kind==='new-receipt-unknown'){
    assert.deepEqual(c.pendingPreferenceIntent('A'),newReceipt,'uncertain R2 keeps exact original receipt');
    assert.equal(c.serverPersistence.state,'error');
    const beforeRetry=JSON.stringify([...values]);await assert.rejects(c.syncCurrentServerState(),error=>error.code==='preference_base_changed');
    assert.equal(JSON.stringify([...values]),beforeRetry);assert.equal(c.calls.writes,1,'unknown continuation never uploads R2');
   }else if(newReceipt){
    const pending=c.pendingPreferenceIntent('A');assert.equal(pending.receiptId,newReceipt.receiptId,'older ACK never clears R2');
    assert.deepEqual(pending.basePreferences,saved.preferences,'only owned ACK advances R2 baseline');
    assert.equal(pending.preferences.preferenceGraph.domainPreferences[0].enabled,false);assert.equal(c.serverPersistence.state,'error');
    newReceipt=pending;await c.syncCurrentServerState();assert.equal(c.pendingPreferenceIntent('A'),null,'R2 can reconcile on existing explicit retry');
    assert(entities(api.state()).some(row=>row.participantId==='team:football:epl:4'&&row.followLevel==='priority'));
    assert(entities(api.state()).some(row=>row.participantId===other));
    if(kind==='new-receipt-same-field')assert.equal(entities(api.state()).find(row=>row.participantId===entity).followLevel,'priority','sequential newer same-field decision survives its older ACK');
    assert.equal(domains(api.state())[0].enabled,false);assert(domains(api.state()).some(row=>row.sportDomainId==='sport:cricket'));
   }else{assert.equal(c.pendingPreferenceIntent('A'),null,'exact owned ACK clears R1: '+kind);assert.equal(c.serverPersistence.state,'signedIn');}
  }
  if(kind==='restart-disjoint'){
   const controls={children:[],appendChild(button){this.children.push(button);}};
   c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.appendRetry(controls);await controls.children[0].click();
   const diagnostic=JSON.parse(c.copied),families=['localView','entities','domains'];
   for(const key of ['baseToRemote','localEdits','localToRemote'])assert.deepEqual(diagnostic.preferenceDifferences[key],families);
   assert.equal(diagnostic.preferenceDifferences.receiptBaseMatchesAccepted,false);
   assert.equal(diagnostic.completed,true);assert.equal(diagnostic.saveResponseReceived,true);assert.equal(diagnostic.pendingReceipt,false);
   console.log(JSON.stringify({case:kind,phoneFamilyPatternReproduced:true,completed:diagnostic.completed,pendingReceipt:diagnostic.pendingReceipt,writes:c.calls.writes}));
  }
  results.push({kind,passed:true,reads:c.calls.reads,writes:c.calls.writes});
 }
 console.log('Receipt-base reconciliation: '+results.length+' compiled-helper bootstrap/persisted-restart/manual queue/API cases passed; independent changes, removals/OFF/empty, CAS, R2 and normalization/lifetime/conflict holds.');
 return results;
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
