'use strict';
// Actual cold directory writer and retained-receipt persistence; disposable state only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),acorn=require('acorn');
const root=process.env.NS_FOLLOW_REPRO_ROOT||path.resolve(__dirname,'../..');
const profile=require(path.join(root,'config/profile-storage')),systems=require(path.join(root,'config/preference-system'));
const {actualContext}=require(path.join(root,'scripts/lib/user-state-optional-view-tests'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function savePreferences('));
const ast=acorn.parse(script,{ecmaVersion:'latest'}),clone=x=>JSON.parse(JSON.stringify(x));
function decl(name){const a=ast.body.filter(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.equal(a.length,1);return script.slice(a[0].start,a[0].end);}
function setup(advance=true){
 const f=actualContext('config/preference-intent-reconcile.js'),{c}=f;
 Object.assign(c,{recordPreferenceChange(){},renderTabCounts(){},productSportForPreferenceIdentifier:()=> 'football',followCollectionsById:()=>({}),NOTHINGSPORTS_CRICKET_COVERAGE:require(path.join(root,'config/cricket-coverage')),toasts:[]});c.showToast=s=>c.toasts.push(s);
 vm.runInContext(decl('setDirectoryEntityFollow')+'\n'+decl('syncDirectoryFollowButton')+'\n'+decl('buildDirectoryFollowButton')+'\n'+decl('setServerStateBaseline'),c);
 c.userPreferences=c.mergePreferences({version:27,onboardingComplete:true,theme:'day',selectedSelectorEntityIds:[],followedSports:[],pilotMeasurement:{enabled:false},followFirst:{notifications:{enabled:false,userChoice:false}},preferenceGraph:systems.createPreferenceGraph({profileId:'owned-follow-fixture',domainIds:['sport:football']})});
 f.base=c.currentServerStatePayload();f.base.updatedAt='2026-11-01T00:00:00.000Z';c.setServerStateBaseline(f.base);c.applyServerState(f.base);
 assert.notEqual(c.setDirectoryEntityFollow('team:football:epl:2','follow'),false);f.original=clone(c.pendingPreferenceIntent('A'));
 f.remote=clone(f.base);f.remote.updatedAt='2026-11-01T00:01:00.000Z';f.remote.preferences.preferenceGraph=systems.setEntityFollow(f.remote.preferences.preferenceGraph,'team:football:epl:3','follow');
 if(advance){c.applyServerState({...f.remote,preferences:f.original.preferences});c.setServerStateBaseline(f.remote);c.serverPersistence.state='error';}
 return f;
}
const row=(p,id)=>p.preferenceGraph.entityFollows.find(x=>x.participantId===id),newId='team:football:epl:4';
async function run(){const results=[],test=async(name,body)=>{await body();results.push(name);};
 await test('new-follow-retains-original-base-and-old-choice',()=>{const f=setup(),before=clone(f.c.serverStateBaseline);assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);const r=f.c.pendingPreferenceIntent('A');assert.equal(r.baseUpdatedAt,f.original.baseUpdatedAt);assert.deepEqual(clone(r.basePreferences),f.original.basePreferences);assert.notEqual(r.receiptId,f.original.receiptId);assert.equal(row(r.preferences,newId).followLevel,'follow');assert.equal(row(r.preferences,'team:football:epl:2').followLevel,'follow');assert.deepEqual(clone(f.c.serverStateBaseline),before);assert(!row(r.preferences,'team:football:epl:3'),'no unseen remote choice replay');const bundle=profile.loadActiveProfile(f.storage);assert(bundle.entityFollows.some(x=>x.participantId===newId&&x.followLevel==='follow'));});
 for(const [id,label,leagueId] of [['team:nrl:329','Penrith Panthers','competition:nrl-premiership-2026'],['team:nrl:321','Warriors','competition:nrl-premiership-2026'],['team:nrl:kiwis','New Zealand Kiwis',null]])await test('actual-NRL-button-'+id,()=>{
  const f=setup(),catalogue=JSON.parse(fs.readFileSync(path.join(root,'data/follow-directory/nrl.v1.json'),'utf8'));let found;
  function walk(x){if(x&&typeof x==='object'){if(x.id===id)found=x;for(const v of Object.values(x))walk(v);}}walk(catalogue);assert(found);assert.equal(found.displayName,label);assert.equal(found.leagueId,leagueId);
  f.c.document.createElement=()=>({dataset:{},attributes:{},handlers:{},classList:{toggle(){}},closest:()=>null,setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.handlers[k]=v;}});
  const button=f.c.buildDirectoryFollowButton(id,{sportKey:'nrl',leagueId,label});assert.equal(button.textContent,'Follow');button.handlers.click();assert.equal(button.textContent,'Following');assert.equal(button.attributes['aria-pressed'],'true');
  let r=f.c.pendingPreferenceIntent('A');assert.equal(row(r.preferences,id).followLevel,'follow');assert.equal(row(r.preferences,'team:football:epl:2').followLevel,'follow');assert.deepEqual(clone(r.basePreferences),f.original.basePreferences);
  button.handlers.click();r=f.c.pendingPreferenceIntent('A');assert.equal(button.textContent,'Follow');assert.equal(row(r.preferences,id).followLevel,'unfollow');assert.deepEqual(clone(r.basePreferences),f.original.basePreferences);
 });
 await test('explicit-unfollow-then-new-follow-preserves-removal',()=>{const f=setup();assert.notEqual(f.c.setDirectoryEntityFollow('team:football:epl:2','unfollow'),false);assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);const r=f.c.pendingPreferenceIntent('A');assert.equal(row(r.preferences,'team:football:epl:2').followLevel,'unfollow');assert.equal(row(r.preferences,newId).followLevel,'follow');assert.deepEqual(clone(r.basePreferences),f.original.basePreferences);});
 await test('compatible-existing-base-still-works',()=>{const f=setup(false);assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.deepEqual(clone(f.c.pendingPreferenceIntent('A').basePreferences),f.original.basePreferences);});
 await test('raw-recorder-stale-base-guard-still-rejects',()=>{const f=setup(),before=JSON.stringify([...f.values]);assert.throws(()=>profile.recordPreferenceIntent(f.storage,f.c.activeProfileBundle,{ownerId:'A',generation:0,baseUpdatedAt:f.remote.updatedAt,basePreferences:f.remote.preferences,preferences:f.c.userPreferences}),/original server baseline/);assert.equal(JSON.stringify([...f.values]),before);});
 for(const [name,alter]of [['wrong-owner',c=>{c.serverSyncClient.sessionSubject=()=> 'B';c.serverSyncClient.accountSnapshot=()=>({accountId:'B',generation:0,hasSession:true});}],['ended-session',c=>{c.serverSyncClient.accountSnapshot=()=>({accountId:'A',generation:0,hasSession:false});}],['baseline-generation',c=>{c.serverStateBaseline.generation=1;}],['no-baseline',c=>{c.serverStateBaseline=null;}]] )await test(name+'-retains-state',()=>{const f=setup();alter(f.c);const before=JSON.stringify([...f.values]),current=clone(f.c.userPreferences);assert.equal(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.equal(JSON.stringify([...f.values]),before);assert.deepEqual(clone(f.c.userPreferences),current);});
 await test('storage-failure-keeps-old-receipt-and-current',()=>{const f=setup(),before=JSON.stringify([...f.values]),current=clone(f.c.userPreferences);f.storage.setItem=()=>{throw Error('owned storage failure');};assert.equal(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.equal(JSON.stringify([...f.values]),before);assert.deepEqual(clone(f.c.userPreferences),current);});
 await test('other-owner-pending-entry-is-unchanged',()=>{const f=setup();f.c.activeProfileBundle=profile.recordPreferenceIntent(f.storage,f.c.activeProfileBundle,{ownerId:'B',generation:0,baseUpdatedAt:f.base.updatedAt,basePreferences:f.base.preferences,preferences:f.base.preferences});const b=clone(profile.readPreferenceIntent(f.storage,f.c.activeProfileBundle,'B'));assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.deepEqual(clone(profile.readPreferenceIntent(f.storage,f.c.activeProfileBundle,'B')),b);});
 await test('cold-writer-does-not-load-account-helper',()=>{const f=setup();f.c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE=undefined;assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.equal(row(f.c.pendingPreferenceIntent('A').preferences,newId).followLevel,'follow');});
 await test('restored-receipt-keeps-old-base-under-current-session',()=>{const f=setup();f.c.serverSyncClient.accountSnapshot=()=>({accountId:'A',generation:1,hasSession:true});f.c.serverStateBaseline.generation=1;assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);const r=f.c.pendingPreferenceIntent('A');assert.equal(r.generation,1);assert.equal(r.baseUpdatedAt,f.original.baseUpdatedAt);assert.deepEqual(clone(r.basePreferences),f.original.basePreferences);});
 await test('typed-device-view-drift-preserved',()=>{const f=setup(),view={sportId:'sport:nrl',page:2,section:'teams-players'};f.c.userPreferences.followBrowse=view;f.c.userPreferences.feedCompact=true;assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);const r=f.c.pendingPreferenceIntent('A');assert.deepEqual(clone(r.preferences.followBrowse),view);assert.equal(r.preferences.feedCompact,true);assert.equal(row(r.preferences,'team:football:epl:2').followLevel,'follow');});
 await test('ordinary-unrecorded-choice-after-advanced-baseline-held',()=>{const f=setup();f.c.userPreferences.theme='night';const current=clone(f.c.userPreferences),before=JSON.stringify([...f.values]);assert.equal(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.deepEqual(clone(f.c.userPreferences),current);assert.equal(JSON.stringify([...f.values]),before);});
 await test('same-base-deliberate-coalescing-unchanged',()=>{const f=setup(false);f.c.userPreferences.theme='night';assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.equal(f.c.pendingPreferenceIntent('A').preferences.theme,'night');});
 for(const [name,change]of [['unknown-view',p=>{p.followBrowse={futureChoice:true};}],['invalid-view',p=>{p.feedCompact='yes';}],['missing-pending-choice',p=>{p.preferenceGraph.entityFollows=[];}]])await test(name+'-cannot-replace-pending-intent',()=>{const f=setup();change(f.c.userPreferences);const current=clone(f.c.userPreferences),before=JSON.stringify([...f.values]);assert.equal(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.deepEqual(clone(f.c.userPreferences),current);assert.equal(JSON.stringify([...f.values]),before);});
 for(const [name,change]of [['missing-accepted-preferences',b=>{b.state.preferences=null;}],['invalid-accepted-clock',b=>{b.updatedAt='invalid';}]])await test(name+'-held',()=>{const f=setup();change(f.c.serverStateBaseline);const before=JSON.stringify([...f.values]);assert.equal(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.equal(JSON.stringify([...f.values]),before);});
 await test('missing-receipt-expectation-is-an-actual-absence-fence',()=>{const f=setup(),before=JSON.stringify([...f.values]);assert.throws(()=>profile.recordPreferenceIntent(f.storage,f.c.activeProfileBundle,{ownerId:'A',generation:0,baseUpdatedAt:f.original.baseUpdatedAt,basePreferences:f.original.basePreferences,preferences:f.c.userPreferences,expectedReceipt:null}),/Pending choices changed/);assert.equal(JSON.stringify([...f.values]),before);});
 await test('concurrent-receipt-revision-cannot-be-overwritten',()=>{
  const f=setup(),current=clone(f.c.userPreferences);let concurrent,stored;
  f.c.PROFILE_STORAGE={...profile,recordPreferenceIntent(storage,bundle,args){
   const next=clone(current);next.preferenceGraph=systems.setEntityFollow(next.preferenceGraph,'team:football:epl:5','follow');
   const b=profile.recordPreferenceIntent(storage,bundle,{ownerId:'A',generation:0,baseUpdatedAt:f.original.baseUpdatedAt,basePreferences:f.original.basePreferences,preferences:next});concurrent=clone(profile.readPreferenceIntent(storage,b,'A'));stored=JSON.stringify([...f.values]);
   return profile.recordPreferenceIntent(storage,b,args);
  }};
  assert.equal(f.c.setDirectoryEntityFollow(newId,'follow'),false);assert.equal(JSON.stringify([...f.values]),stored);assert.deepEqual(clone(f.c.pendingPreferenceIntent('A')),concurrent);assert.deepEqual(clone(f.c.userPreferences),current);
 });
 await test('owned-ACK-carries-new-follow-R2-without-clearing-it',()=>{
  const f=setup(),patches=require(path.join(root,'config/user-state-sync')),life=f.c.serverSyncClient.accountSnapshot();
  const plan=f.c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan(f.original,f.remote,life,f.c.userPreferences);assert(plan);
  assert.notEqual(f.c.setDirectoryEntityFollow(newId,'follow'),false);const newer=clone(f.c.pendingPreferenceIntent('A'));
  const bundle=profile.acknowledgePreferenceIntent(f.storage,f.c.activeProfileBundle,plan.receipt,plan.receipt.preferences,patches,{generation:0,updatedAt:'2026-11-01T00:02:00.000Z'});const retained=profile.readPreferenceIntent(f.storage,bundle,'A');
  assert.equal(retained.receiptId,newer.receiptId);assert.equal(retained.baseUpdatedAt,'2026-11-01T00:02:00.000Z');for(const id of ['team:football:epl:2','team:football:epl:3',newId])assert.equal(row(retained.preferences,id).followLevel,'follow');
 });

 for(const kind of ['unresolved','already-accepted','save-failure','wrong-ACK'])await test('actual-queued-sync-local-API-'+kind,async()=>{
  const f=setup(),{c}=f,transport=require(path.join(root,'config/server-sync'));
  if(kind==='already-accepted'){
   f.remote={...clone(f.base),preferences:clone(f.original.preferences),updatedAt:'2026-11-01T00:01:00.000Z'};
   c.applyServerState(f.remote);c.setServerStateBaseline(f.remote);
  }
  const api=require(path.join(root,'scripts/lib/local-user-state-api'))('A');api.seed(f.remote);
  // API/database/auth are disposable local doubles. No provider connection exists.
  const pendingTimers=new Map();let timerId=0;
  c.setTimeout=(fn)=>{const id=++timerId;pendingTimers.set(id,fn);return id;};c.clearTimeout=id=>pendingTimers.delete(id);c.window=c;
  Object.assign(c,{serverSyncSequence:Promise.resolve(),serverSyncTimer:null,startupFunnelFinished:false,
   directoryFollowEffectsTimer:null,scrollMomentumActive:false,feedViewGeneration:0,followFeedRefreshGeneration:0,
   followFeedRefreshTimer:null,followFeedRefreshInFlight:null,remoteFeedRefreshInFlight:null,followFeedRefreshPending:false,
   loadFollowedScheduleFixtures:async()=>{},clearCachedPersonalisedFeed:async()=>{},refreshRemoteFeed:async()=>({source:'server'}),
   setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_remote,current)=>current,clearAcknowledgedFixturePinCommands(){}});
  vm.runInContext(['emptyServerStatePayload','serverErrorEndsSession','applyServerStatePreservingChanges',
   'localPreferenceRecoveryBlocked','queueServerStateSync','serverStateSyncScope','reconcileCurrentServerState','syncCurrentServerState',
   'acknowledgePreferenceReceipt','advancePreferenceReceiptBase','verifyPreferenceIntentBase',
   'queueDirectoryFollowEffects','requestFeedRebuildAfterFollowChange'].map(decl).join('\n'),c);
  let saves=0;
  c.serverSyncClient.loadState=async()=>{const r=await api.handle({method:'GET',url:'/api/user-state',headers:{}});assert.equal(r.status,200);return {user:r.body.user,state:transport.stateFromDatabaseRow(r.body.state)};};
  c.serverSyncClient.savePatch=async patch=>{
   saves++;assert.equal(patch.baseUpdatedAt,api.state().updatedAt,'fresh CAS base');
   assert.deepEqual(clone(c.pendingPreferenceIntent('A').basePreferences),f.original.basePreferences,'original base retained until ACK');
   if(kind==='save-failure')throw Object.assign(Error('Disposable save failure'),{code:'server_sync_failed'});
   const r=await api.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch}});assert.equal(r.status,200);
   const state=transport.stateFromDatabaseRow(r.body.state);if(kind==='wrong-ACK')state.preferences.preferenceGraph.entityFollows=[];
   return {user:r.body.user,state};
  };
  assert.notEqual(c.setDirectoryEntityFollow(newId,'follow'),false);
  const r2=clone(c.pendingPreferenceIntent('A'));assert.notEqual(r2.receiptId,f.original.receiptId);assert.deepEqual(r2.basePreferences,f.original.basePreferences);
  assert.equal(saves,0,'deliberate local write does not pretend to be a server ACK');assert(pendingTimers.size,'actual directory writer queues follow effects');
  c.activeProfileBundle=profile.loadActiveProfile(f.storage);
  assert.deepEqual(clone(c.pendingPreferenceIntent('A')),r2,'receipt survives profile reload');
  assert(c.activeProfileBundle.entityFollows.some(x=>x.participantId===newId&&x.followLevel==='follow'),'choice survives profile reload');
  // Drain the actual debounce/idle/rebuild/sync chain with virtual timers.
  for(let i=0;i<8&&saves===0;i++){
   assert(pendingTimers.size,'queued chain must reach sync');const [id,fn]=pendingTimers.entries().next().value;pendingTimers.delete(id);await fn();await Promise.resolve();
  }
  if(kind==='save-failure'||kind==='wrong-ACK')await assert.rejects(c.serverSyncSequence);else await c.serverSyncSequence;
  assert.equal(saves,1,'actual queued path reaches one local API save');
  if(kind==='save-failure'||kind==='wrong-ACK'){
   assert.deepEqual(clone(c.pendingPreferenceIntent('A')),r2,'failed or mismatched ACK cannot discard pending intent');
   assert.equal(row(c.userPreferences,newId).followLevel,'follow');assert.equal(c.serverPersistence.state,'error');
  }else{
   assert.equal(c.pendingPreferenceIntent('A'),null,'only proven owned ACK clears the new receipt');
   assert.equal(row(api.state().preferences,newId).followLevel,'follow');assert.equal(row(api.state().preferences,'team:football:epl:2').followLevel,'follow');
   if(kind==='unresolved')assert.equal(row(api.state().preferences,'team:football:epl:3').followLevel,'follow');
   assert.equal(c.serverPersistence.state,'signedIn');assert.equal(row(c.userPreferences,newId).followLevel,'follow');
  }
 });
 return {cases:results.length,passed:results,scope:'actual directory writer/normalizer/owned receipt/local persistence; local API/database doubles only; no real SDK/network/browser or private state'};}
module.exports={setup,run};if(require.main===module)run().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
