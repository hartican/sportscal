'use strict';
// Composed-source proof for approved PR41 writers against this Account helper.
// Exact upstream Cricket producer is a pinned fixture; product coverage is not
// changed here. UI selection and auth/DB transport are disposable, not the
// merge/writers/receipt/serial queue/API/normalizers/CAS/ACK implementations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {createRequire}=require('node:module'),{actualContext}=require('./user-state-optional-view-tests');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const file=path.join(__dirname,'user-state-account-scope-tests.js');
const probe={module:{exports:{}},require:createRequire(file),__dirname,console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.compatibilityProbe={sources};',probe,{filename:file});
const {sources}=probe.module.exports.compatibilityProbe;
const localApi=require('./local-user-state-api'),transport=require('../../config/server-sync'),patches=require('../../config/user-state-sync'),systems=require('../../config/preference-system');
const upstream=fs.readFileSync(path.join(__dirname,'../fixtures/pr41-cricket-coverage-35384b98.js'),'utf8');
assert.equal(crypto.createHash('sha256').update(upstream).digest('hex'),'d7f6ddbc170ade4bb220b2c95d58c2eb24b2ea44b739b9bd56dc45e037865620','fixture is exact config/cricket-coverage.js from approved PR41/35384b98');
const producer={module:{exports:{}}};vm.runInNewContext(upstream,producer);
const future=producer.module.exports,cricketFile=require.resolve('../../config/cricket-coverage');
const stateId='team:cricket:new-south-wales',football='team:football:australian-championship:11255';
const clone=value=>JSON.parse(JSON.stringify(value));
const slice=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end);};
const kinds=['gender-all','gender-men','gender-women','gender-open','memory','empty-memory','absent-view','shield','oneday','both','writer-order','state-alias','remove-format','remove-field','last-OFF','view-after-receipt',
 'gender-invalid','gender-null','memory-array','memory-null','memory-invalid','memory-future-sport','memory-wrapper','unknown-view','taxonomy-unavailable',
 'format-invalid','format-duplicate','format-null','unknown-record','empty-conflict','current-edit','cas-disjoint','cas-conflict','R2-format','ACK-mismatch','owner-read','generation-read','owner-ACK','generation-ACK'];
async function run(helperFile,kind){
 const {c,values}=actualContext(helperFile),api=localApi('A');let account='A',generation=0,reads=0,writes=0,newer;
 c.NOTHINGSPORTS_CRICKET_COVERAGE=future;c.NOTHINGSPORTS_SELECTOR_TAXONOMY=require('../../config/selector-taxonomy');
 c.serverSyncClient.sessionSubject=()=>account;
 c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:account,generation});
 c.serverSyncSequence=Promise.resolve();c.serverSyncTimer=null;c.startupSessionStateBaseline=null;
 c.serverAuthoritativeFixturePins=(_state,current)=>current;c.clearAcknowledgedFixturePinCommands=()=>{};
 c.recordPreferenceChange=c.renderTabCounts=c.updateDirectoryFilters=c.setPreferenceRecovery=()=>{};
 c.followDirectoryKey=()=> 'cricket';let selected=kind==='oneday'?'One Day Cup':'Shield';
 c.directoryFilters=()=>({cricketFormat:selected});
 const src=sources();
 vm.runInContext([src.scope,src.preserve,src.reconcile,src.queue,
  slice('function acknowledgePreferenceReceipt(','\nasync function bootstrapServerPersistence('),
  slice('function setServerStateBaseline(','\nfunction emptyServerStatePayload('),
  slice('function emptyServerStatePayload(','\nfunction applyServerStatePreservingChanges('),
  slice('function followBrowseState(','\nfunction followSelectedEntity('),
  slice('function setDirectoryEntityFollow(','\n\n\n\n\n\n\n\n\n\n\nconst followDirectoryBatchLimits')].join('\n'),c);
 c.userPreferences=c.mergePreferences({version:27,onboardingComplete:true,selectedSelectorEntityIds:[],followedSports:[],pilotMeasurement:{enabled:false},
  followFirst:{notifications:{enabled:false,userChoice:false}},followBrowse:{sportId:'sport:cricket',section:'teams-players',page:0},preferenceGraph:systems.createPreferenceGraph({profileId:c.activeProfileBundle.profile.id})});
 api.seed({preferences:c.userPreferences,profile:{},eventUserState:{},eventSpoilerState:{},ratings:{},archivedEvents:[]});
 const base=api.state();c.applyServerState(base);c.setServerStateBaseline(base);
 const browse={gender:'women',genderBySport:{'sport:cricket':'women','sport:tennis':'men'}};
 if(kind.startsWith('gender-'))browse.gender=kind==='gender-invalid'?'future':kind==='gender-null'?null:kind.slice(7);
 if(kind==='empty-memory')browse.genderBySport={};
 if(kind==='absent-view'){delete browse.gender;delete browse.genderBySport;}
 if(kind==='memory-array')browse.genderBySport=[];
 if(kind==='memory-null')browse.genderBySport=null;
 if(kind==='memory-invalid')browse.genderBySport={'sport:cricket':'future'};
 if(kind==='memory-future-sport')browse.genderBySport={'sport:future-unknown':'men'};
 if(kind==='memory-wrapper')browse.genderBySport={schemaVersion:'future.v1'};
 if(kind==='unknown-view')browse.futureViewChoice=true;
 c.saveFollowBrowse(browse);
 if(kind==='empty-memory')assert.equal(Object.keys(c.userPreferences.followBrowse.genderBySport).length,0);
 if(kind==='absent-view')assert(!Object.hasOwn(c.userPreferences.followBrowse,'gender')&&!Object.hasOwn(c.userPreferences.followBrowse,'genderBySport'));
 assert.equal(c.pendingPreferenceIntent('A'),null,'view-only writer cannot invent a receipt');
 const cricket=!kind.startsWith('gender-')&&!kind.startsWith('memory')&&!['empty-memory','unknown-view','taxonomy-unavailable'].includes(kind);
 const write=(format=selected,level='follow')=>{selected=format;c.setDirectoryEntityFollow(cricket?(kind==='state-alias'?'team:cricket:espn-387':stateId):football,level,{sportKey:cricket?'cricket':'football'});};
 write();
 if(['both','remove-format','last-OFF','writer-order'].includes(kind)){write('One Day Cup');if(kind!=='both')write('Shield','unfollow');if(kind==='last-OFF')write('One Day Cup','unfollow');if(kind==='writer-order')write('Shield');}
 if(kind==='remove-field'){
  const next=clone(c.userPreferences);next.preferenceGraph=systems.setEntityFollow(next.preferenceGraph,stateId,'follow');
  assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));assert(!Object.hasOwn(c.userPreferences.preferenceGraph.entityFollows.find(row=>row.participantId===stateId),'cricketFormats'));
 }
 if(kind==='empty-conflict')write('Shield','unfollow');
 if(['format-invalid','format-duplicate','format-null','unknown-record'].includes(kind)){
  const next=clone(c.userPreferences),row=next.preferenceGraph.entityFollows.find(r=>r.participantId===stateId);
  if(kind==='unknown-record')row.futureRecordChoice=true;
  else row.cricketFormats=kind==='format-invalid'?['Future']:kind==='format-duplicate'?['Shield','Shield']:null;
  assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));
  assert.deepEqual(c.userPreferences.preferenceGraph.entityFollows.find(r=>r.participantId===stateId).cricketFormats,row.cricketFormats,'negative data must survive the real writer/normalizer');
 }
 if(kind==='view-after-receipt')c.saveFollowBrowse({gender:'open',genderBySport:{'sport:horse-racing':'open'}});
 if(kind==='taxonomy-unavailable')delete c.NOTHINGSPORTS_SELECTOR_TAXONOMY;
 const original=c.pendingPreferenceIntent('A');assert(original);assert.equal(Object.keys(original).length,6);
 if(kind==='current-edit'){
  const next=clone(c.userPreferences);next.preferenceGraph.entityFollows[0].followLevel='unfollow';
  assert(c.savePreferences(next,{deferFollowEffects:true}));assert.deepEqual(c.pendingPreferenceIntent('A'),original);
 }
 const localViews=clone(c.userPreferences.followBrowse),remote=clone(base);
 remote.preferences.preferenceGraph.domainPreferences.push(systems.expandTemplate('local-B','sport:football','template:casual',{enabled:false}));
 if(kind==='empty-conflict')remote.preferences=future.setFormatFollow(remote.preferences,stateId,'One Day Cup',true);
 assert(c.PROFILE_STORAGE.preferenceBaseMatches({basePreferences:remote.preferences},c.mergePreferences(remote.preferences)),'remote fixture is stable under the real app normalizer');
 const changed=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:patches.createPatch(base,remote,{baseUpdatedAt:base.updatedAt})}});assert.equal(changed.status,200);
 const remoteBefore=api.state(),currentBefore=clone(c.currentServerStatePayload()),stored=JSON.stringify([...values]),sent=[];
 c.serverSyncClient.loadState=async()=>{
  reads++;const r=await api.handle({method:'GET',url:'/api/user-state',headers:{}});
  if(kind==='owner-read')account='B';if(kind==='generation-read'){generation++;c.invalidateServerStateSyncScope();}
  return{user:r.body.user,state:transport.stateFromDatabaseRow(r.body.state)};
 };
 c.serverSyncClient.savePatch=async patch=>{
  writes++;sent.push(clone(patch));assert.equal(patch.baseUpdatedAt,api.state().updatedAt,'existing fresh conditional version');
  assert.deepEqual(c.pendingPreferenceIntent('A'),newer||original,'no receipt rewrite before owned ACK');
  if(kind!=='R2-format'||writes===1)assert(patch.changes.every(change=>change.path[0]!=='preferences'||change.path[1]!=='followBrowse'),'independent plan must not send device views');
  const r=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch}});
  if(r.status!==200)throw Object.assign(Error('Disposable conditional conflict'),{status:r.status,code:r.body.code});
  if(kind==='R2-format'&&!newer){write('One Day Cup');newer=c.pendingPreferenceIntent('A');assert.notEqual(newer.receiptId,original.receiptId);}
  if(kind==='owner-ACK')account='B';if(kind==='generation-ACK'){generation++;c.invalidateServerStateSyncScope();}
  const state=transport.stateFromDatabaseRow(r.body.state);
  if(kind==='ACK-mismatch')state.preferences.preferenceGraph.entityFollows.find(row=>row.participantId===stateId).cricketFormats=['One Day Cup'];
  return{user:r.body.user,state};
 };
 if(kind.startsWith('cas-'))api.raceOnce(()=>api.mutate(state=>{
  if(kind==='cas-conflict')state.preferences=future.setFormatFollow(state.preferences,stateId,'One Day Cup',true);
  else state.preferences.preferenceGraph.domainPreferences[0].editorialSensitivity='high';
 }));
 let caught;try{await c.syncCurrentServerState();}catch(error){caught=error;}
 const lifetime=/^(owner|generation)-/.test(kind);
 const held=['gender-invalid','gender-null','memory-array','memory-null','memory-invalid','memory-future-sport','memory-wrapper','unknown-view','taxonomy-unavailable',
  'format-invalid','format-duplicate','format-null','unknown-record','empty-conflict','current-edit','cas-conflict','ACK-mismatch'].includes(kind);
 if(lifetime||held){
  if(held)assert.equal(caught?.code,'preference_base_changed',kind);
  assert.deepEqual(c.pendingPreferenceIntent('A'),original,kind+': pending intent stays exact');
  assert.equal(JSON.stringify([...values]),stored,kind+': current persisted choices cannot be acknowledged/replaced');
  assert.deepEqual(clone(c.currentServerStatePayload()),currentBefore,kind+': current RAM choices stay intact');
  assert.equal(writes,['cas-conflict','ACK-mismatch','owner-ACK','generation-ACK'].includes(kind)?1:0,kind);
  if(!['cas-conflict','ACK-mismatch','owner-ACK','generation-ACK'].includes(kind))assert.deepEqual(api.state(),remoteBefore);
 }else{
  assert.equal(caught,undefined,kind);
  if(kind==='R2-format'){
   const pending=c.pendingPreferenceIntent('A');assert.equal(pending.receiptId,newer.receiptId);assert.deepEqual(pending.preferences.preferenceGraph.entityFollows.find(row=>row.participantId===stateId).cricketFormats,['Shield','One Day Cup']);
   newer=pending;await c.syncCurrentServerState();
  }
  assert.equal(c.pendingPreferenceIntent('A'),null,'only matching ACK clears the current receipt');
  assert.equal(c.serverPersistence.state,'signedIn');
  assert.equal(writes,kind==='cas-disjoint'||kind==='R2-format'?2:1);
  assert.deepEqual(c.userPreferences.followBrowse,localViews,'accepted remote apply retains exact device views');
  // R2's second leg now has a matching baseline and uses the established
  // ordinary-save path; preserve its existing view-patch behaviour as well.
  assert.deepEqual(api.state().preferences.followBrowse,kind==='R2-format'?localViews:base.preferences.followBrowse,'independent plan retains remote views; compatible R2 retains ordinary-save semantics');
  assert.equal(api.state().preferences.followFirst.notifications.enabled,false);
  if(cricket){const row=api.state().preferences.preferenceGraph.entityFollows.find(row=>row.participantId===stateId);assert(row);
   const expected=kind==='remove-field'?undefined:kind==='last-OFF'?[]:kind==='oneday'||kind==='remove-format'?['One Day Cup']:kind==='writer-order'?['One Day Cup','Shield']:kind==='both'||kind==='R2-format'?['Shield','One Day Cup']:['Shield'];
   assert.deepEqual(row.cricketFormats,expected);if(kind==='last-OFF')assert.equal(row.followLevel,'unfollow');}
 }
 return {helperFile,kind,passed:true,reads,writes,held:held||lifetime};
}
module.exports=async function pr41CompatibilityTests(){
 const old=require(cricketFile),oldGlobal=globalThis.NOTHINGSPORTS_CRICKET_COVERAGE,results=[];
 // Compose exactly the approved future producer/normalizer for this one suite;
 // restore both public module seams before returning to any other test.
 require.cache[cricketFile].exports=future;globalThis.NOTHINGSPORTS_CRICKET_COVERAGE=future;
 try{for(const helperFile of ['config/preference-intent-reconcile.js','assets/js/account-awareness-runtime.js'])for(const kind of kinds)results.push(await run(helperFile,kind));}
 finally{require.cache[cricketFile].exports=old;globalThis.NOTHINGSPORTS_CRICKET_COVERAGE=oldGlobal;}
 assert.equal(require(cricketFile),old);assert.equal(globalThis.NOTHINGSPORTS_CRICKET_COVERAGE,oldGlobal,'future producer overlay does not escape this composed test');
 console.log('PR41 typed compatibility: '+results.length+' actual writer/receipt/queue/API source-and-compiled-helper cases passed; local gender memory, state formats, strict unknown/type/current/CAS/R2/ACK/lifetime controls.');
 return results;
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
