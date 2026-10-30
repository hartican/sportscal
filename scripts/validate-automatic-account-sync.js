'use strict';
// Actual deferred lifecycle owner -> serialized reconcile -> real handler/CAS.
// UI leaves/auth/database are disposable. No browser, network or manual Sync.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const part=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x);assert(x>=0&&y>x,a);return html.slice(x,y);};
const clone=structuredClone;
// Reuse compiled code only; every fixture still receives a fresh VM/storage/API.
const programs=new Map();
function execute(source,context){if(!programs.has(source))programs.set(source,new vm.Script(source));return programs.get(source).runInContext(context);}
async function fixture({compiled=false}={}){
 const f=require('./lib/user-state-optional-view-tests').actualContext('config/preference-intent-reconcile.js'),{c}=f;
 const listeners=new Map(),timers=new Map();let tick=0,nextId=0,loads=0,fail=false,gate=null,cancelled=0;
 const on=(key,fn)=>{const list=listeners.get(key)||[];list.push(fn);listeners.set(key,list);};
 const schedule=(fn,delay=0)=>{const id=++nextId;timers.set(id,{at:tick+delay,fn});return id;};
 Object.assign(c,{Date:class extends Date{static now(){return 1793318400000+tick;}},setTimeout:schedule,clearTimeout:id=>{if(timers.delete(id))cancelled++;},
  serverSyncSequence:Promise.resolve(),serverSyncTimer:null,accountIndicatorJourney:null,startupFunnelFinished:false,
  followSharedHandle:async()=>{},clearAcknowledgedFixturePinCommands(){},setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_remote,current)=>current,
  accountIndicatorGeneration:0,accountIndicatorController:null,navigator:{onLine:true},settingsSection:'main',nothingscoreViewerScope:null,
  NOTHINGSPORTS_ACCOUNT_AWARENESS_UI:{create:()=>({render(){}})},renderAccountIndicator(){},addEventListener:on});
 const host={contains:()=>false,replaceChildren(){},setAttribute(){},classList:{contains:()=>false}};
 c.document={readyState:'complete',hidden:false,activeElement:null,getElementById:()=>host,addEventListener:on,querySelector:()=>({content:'603'})};
 execute(part('function activeProfileSection(','\nfunction saveActiveProfileSections(')+part('function queueServerStateSync(){','\nfunction invalidateServerStateSyncScope(')+part('function setServerStateBaseline(','\nfunction queueServerStateSync(')+part('function invalidateServerStateSyncScope(){','\nasync function reconcileCurrentServerState(')+part('async function reconcileCurrentServerState(','\nfunction normalizeServerArchiveReferences(')+part('async function hydrateUserMetaSeed(','\nfunction sydneyPartsFromIso('),c);
 execute(part('async function refreshFeedOnFirstLoad(){','\nfunction requestFeedRefreshForFilterChange('),c);
 Object.assign(c,{startupSessionStateBaseline:null,restoreCachedPersonalisedFeed:async()=>null,loadPublicFeedFirstPage:async()=>({source:'public'}),feedPerformanceMetrics:{},publishFeedPerformanceMetrics(){},feedPerformanceNow:()=>0,loadingController:{complete(){}},refreshRemoteFeed:async()=>({source:'server'})});
 c.serverSyncClient.getSession=()=>({accountId:'A'});c.serverSyncClient.restoreSession=async()=>({accountId:'A'});c.serverSyncClient.status=async()=>({configured:true});c.serverSyncClient.loadMeta=async()=>({meta:null});
 execute(part('function renderAccountIndicator(){','\nfunction ensureAccountIndicator('),c);
 c.setServerPersistence=patch=>{Object.assign(c.serverPersistence,patch);c.renderAccountIndicator();};
 c.userPreferences=c.mergePreferences({version:28,onboardingComplete:true,theme:'night'});for(let i=0;i<3;i++)c.userPreferences=c.mergePreferences(c.userPreferences);
 const api=require('./lib/local-user-state-api')('A');api.seed(c.currentServerStatePayload());c.applyServerState(api.state());c.setServerStateBaseline(api.state());
 const request=async(method,patch)=>{const r=await api.handle({method,url:'/api/user-state',headers:{},...(patch?{body:{patch}}:{})});if(r.status!==200)throw Object.assign(Error('Disposable API'),{status:r.status,code:r.body.code});return {user:r.body.user,state:c.SERVER_SYNC.stateFromDatabaseRow(r.body.state)};};
 c.serverSyncClient.loadState=async()=>{loads++;if(gate)await gate.promise;if(fail){if(fail==='once')fail=false;throw Object.assign(Error('Disposable offline'),{status:503});}return request('GET');};
 c.serverSyncClient.savePatch=p=>request('PUT',p);
 function mount(sourceOverride=null){if(sourceOverride){execute(fs.readFileSync(__dirname+'/../config/account-sync-diagnostic.js','utf8'),c);execute(sourceOverride,c);}else if(compiled)execute(fs.readFileSync(__dirname+'/../assets/js/account-awareness-runtime.js','utf8'),c);else{execute(fs.readFileSync(__dirname+'/../config/account-sync-diagnostic.js','utf8'),c);execute(fs.readFileSync(__dirname+'/../assets/js/account-indicator-app.js','utf8'),c);}c.NOTHINGSPORTS_ACCOUNT_AWARENESS_UI={create:()=>({render(){}})};c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.mount();}
 async function settle(wait=true){for(let i=0;i<30;i++)await Promise.resolve();if(wait)await c.serverSyncSequence.catch(()=>{});for(let i=0;i<10;i++)await Promise.resolve();}
 return {c,api,mount,get loads(){return loads;},setFail(value){fail=value;},hold(){let resolve;gate={promise:new Promise(r=>resolve=r),resolve};return ()=>{const old=gate;gate=null;old.resolve();};},event(name){for(const fn of listeners.get(name)||[])fn();},settle,async advance(to,wait=true){while(true){const job=[...timers].filter(([,j])=>j.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!job)break;timers.delete(job[0]);tick=job[1].at;await job[1].fn();await settle(wait);}tick=to;await settle(wait);},edit(){const p=clone(c.userPreferences);p.theme='day';assert(c.savePreferences(p,{deliberate:true}));},get timerCount(){return timers.size;},get cancelledTimers(){return cancelled;}};
}
async function forwardUpdate(compiled,dirty=false){
 const fresh=await fixture({compiled});if(dirty)fresh.edit();fresh.c.serverPersistence={state:'checking',user:null};fresh.c.serverStateBaseline=null;
 let version='603',reloads=0,versionReads=0,timer=0;const handlers=new Map(),values=new Map();
 const worker={postMessage(_message,ports){ports[0].postMessage({version});}};
 const registration={active:worker,update:async()=>{},addEventListener(){}};
 const old={console,Date,Promise,Set,AbortController,setTimeout:()=>++timer,clearTimeout(){},
  MessageChannel:class{constructor(){const a={close(){}};this.port1=a;this.port2={postMessage:data=>a.onmessage?.({data})};}},
  document:{activeElement:null,hidden:false,querySelector:()=>({content:'603'}),addEventListener(){}},
  navigator:{onLine:true,serviceWorker:{controller:worker,register:async()=>registration,addEventListener:(name,fn)=>handlers.set(name,fn)}},
  sessionStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
  location:{protocol:'https:',href:'https://fixture.invalid/',reload(){reloads++;void fresh.c.refreshFeedOnFirstLoad();}},
  persistCurrentChatDraft(){},flushDisposableStore:async()=>{},scrollY:0,activeTab:'feed',activeView:'list',activeFilter:'all',eventsViewTab:'overviews',SERVICE_WORKER_RELOAD_STATE_KEY:'fixture:reload',
  fetch:async()=>{versionReads++;return {ok:true,json:async()=>({version:'603'})};},addEventListener(){}};
 old.window=old;vm.createContext(old);execute(part('async function reloadForUpdatedServiceWorker(){','\nconst startupCoordinator ='),old);execute(fs.readFileSync(__dirname+'/../assets/js/app-update.source.js','utf8'),old);
 old.NOTHINGSPORTS_APP_UPDATE.configure(old.reloadForUpdatedServiceWorker);for(let i=0;i<50;i++)await Promise.resolve();assert.equal(reloads,0);
 version='604';await handlers.get('controllerchange')();for(let i=0;i<50;i++)await Promise.resolve();await fresh.settle();assert.equal(reloads,1);assert.equal(fresh.loads,dirty?2:1,'dirty bootstrap uses initial restore plus fresh conditional-save read');assert.equal(fresh.c.serverPersistence.state,'signedIn');assert.equal(fresh.api.metrics.rowWrites,dirty?1:0);assert.equal(fresh.api.calls.filter(call=>call.method==='PUT').length,dirty?1:0,'count every attempted save, including refused/no-op attempts');assert.equal(fresh.c.pendingPreferenceIntent('A'),null);assert.equal(fresh.api.state().preferences.theme,dirty?'day':'night');assert.equal(versionReads,1);
 await handlers.get('controllerchange')();for(let i=0;i<20;i++)await Promise.resolve();assert.equal(reloads,1,'same forward signal cannot reload twice');
 // Synthetic worker/message ports and new VM realm: source bridge only, never
 // real service-worker installation, served-version binding or native proof.
}
async function reviewCase(compiled,kind,sourceOverride=null){
 const f=await fixture({compiled});f.mount(sourceOverride);
 if(kind==='focus'){f.event('focus');await f.settle();assert.equal(f.loads,1,'standalone focus must automatically read');f.event('online');f.event('visibilitychange');await f.settle();assert.equal(f.loads,1,'focus/visible/online coalesce');return;}
 const release=f.hold();f.event('pageshow');for(let i=0;i<20;i++)await Promise.resolve();f.event('online');await f.advance(16000,false);assert.equal(f.loads,1,'held work over boundary cannot overlap');assert.equal(f.c.serverPersistence.state,'syncing');
 f.setFail('once');release();await f.settle();await f.advance(16000);
 assert.equal(f.loads,2,'late failed settlement must retain and consume the same availability witness');assert.equal(f.c.serverPersistence.state,'signedIn');assert.equal(f.api.calls.filter(x=>x.method==='PUT').length,0);await f.advance(60000);assert.equal(f.loads,2);
}
async function run(){
 for(const compiled of [false,true]){
  await reviewCase(compiled,'focus');await reviewCase(compiled,'late');
  const restoring=await fixture({compiled});restoring.c.serverPersistence={state:'checking',user:null};const finishRestore=restoring.hold();await restoring.c.refreshFeedOnFirstLoad();restoring.mount();restoring.event('online');await restoring.advance(16000,false);assert.equal(restoring.loads,1);restoring.setFail('once');finishRestore();await restoring.settle();await restoring.advance(16000);assert.equal(restoring.loads,2,'late bootstrap settlement releases the witnessed wake through actual state rendering');assert.equal(restoring.c.serverPersistence.state,'signedIn');assert.equal(restoring.api.calls.filter(call=>call.method==='PUT').length,0);
  const lateClean=await fixture({compiled});lateClean.mount();const finish=lateClean.hold();lateClean.event('focus');for(let i=0;i<20;i++)await Promise.resolve();lateClean.event('online');await lateClean.advance(16000,false);assert.equal(lateClean.loads,1);finish();await lateClean.settle();await lateClean.advance(60000);assert.equal(lateClean.loads,1,'late clean settlement consumes witness without another request');assert.equal(lateClean.timerCount,0);
  for(const fence of ['owner','profile','generation','session','hidden','offline','recovery-busy','uncertain']){
   const x=await fixture({compiled});x.mount();const finish=x.hold();x.event('focus');for(let i=0;i<20;i++)await Promise.resolve();x.event('online');await x.advance(16000,false);
   if(fence==='owner')x.c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'B',generation:1});if(fence==='profile')x.c.activeProfileBundle.profile.id='other';if(fence==='generation')x.c.serverStateSyncGeneration++;if(fence==='session')x.c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'A',generation:1});if(fence==='hidden')x.c.document.hidden=true;if(fence==='offline')x.c.navigator.onLine=false;if(fence==='recovery-busy')x.c.localPreferenceRecoveryBusy=true;if(fence==='uncertain')x.c.localPreferenceRecoveryHold={accountId:'A',profileId:x.c.activeProfileBundle.profile.id,sessionGeneration:0};
   x.setFail('once');finish();await x.settle();await x.advance(60000);assert.equal(x.loads,1,'late settlement refuses '+fence);assert.equal(x.api.calls.filter(call=>call.method==='PUT').length,0);assert.equal(x.timerCount,0);
  }
  const replaced=await fixture({compiled});await replaced.advance(0);replaced.mount();replaced.setFail(true);replaced.event('focus');await replaced.settle();replaced.event('online');assert.equal(replaced.timerCount,1);const cancelled=replaced.cancelledTimers;replaced.c.serverStateSyncGeneration++;replaced.event('online');assert.equal(replaced.timerCount,1);assert.equal(replaced.cancelledTimers,cancelled+1,'replacing witness cancels old timer directly');replaced.c.serverSyncClient.accountSnapshot=()=>({hasSession:false,accountId:null,generation:1});replaced.c.renderAccountIndicator();assert.equal(replaced.timerCount,0,'ending lifetime cancels pending timer');assert.equal(replaced.cancelledTimers,cancelled+2);await replaced.advance(60000);assert.equal(replaced.loads,1);
  for(const state of ['hidden','offline']){const x=await fixture({compiled});x.mount();if(state==='hidden')x.c.document.hidden=true;else x.c.navigator.onLine=false;x.event('focus');await x.settle();assert.equal(x.loads,0,'focus skips '+state);}

  const startup=await fixture({compiled});startup.c.serverPersistence={state:'checking',user:null};startup.c.serverStateBaseline=null;await startup.c.refreshFeedOnFirstLoad();await startup.settle();assert.equal(startup.c.serverPersistence.state,'signedIn','actual first-load startup restores account without manual Sync');assert.equal(startup.loads,1);assert.equal(startup.api.calls.filter(call=>call.method==='PUT').length,0);startup.mount();await startup.settle();assert.equal(startup.loads,1,'late helper mount after clean startup does not duplicate state load');
  const restored=await fixture({compiled});restored.c.serverPersistence={state:'checking',user:null};await restored.c.bootstrapServerPersistence();await restored.settle();assert.equal(restored.c.serverPersistence.state,'signedIn');assert.equal(restored.api.calls.filter(call=>call.method==='PUT').length,0,'sign-in restoration clean read only');
  for(const mountBeforeOnline of [false,true]){const x=await fixture({compiled});x.c.serverPersistence={state:'checking',user:null};x.c.navigator.onLine=false;x.setFail(true);await x.c.refreshFeedOnFirstLoad();await x.settle();assert.equal(x.c.serverPersistence.state,'error');if(mountBeforeOnline)x.mount();x.setFail(false);x.c.navigator.onLine=true;x.event('online');if(!mountBeforeOnline)x.mount();await x.settle();assert.equal(x.c.serverPersistence.state,'signedIn','offline first load reconnect before/after helper');assert.equal(x.api.calls.filter(call=>call.method==='PUT').length,0);}
  await forwardUpdate(compiled);await forwardUpdate(compiled,true);
  const visible=await fixture({compiled});visible.mount();visible.event('focus');await visible.settle();assert.equal(visible.loads,1,'standalone visible focus invokes automatic recovery');visible.event('visibilitychange');await visible.settle();assert.equal(visible.loads,1,'visible return invokes the existing account owner');
  const f=await fixture({compiled});f.mount();f.event('pageshow');await f.settle();assert.equal(f.loads,1);assert.equal(f.api.calls.filter(call=>call.method==='PUT').length,0,'clean resume performs no PUT');
  f.event('online');f.event('pageshow');await f.settle();assert.equal(f.loads,1,'successful burst coalesces');
  const offline=await fixture({compiled});offline.mount();offline.c.navigator.onLine=false;offline.event('online');await offline.settle();assert.equal(offline.loads,0);offline.c.navigator.onLine=true;offline.event('online');await offline.settle();assert.equal(offline.loads,1);
  const local=await fixture({compiled});local.mount();local.edit();await local.advance(650);assert.equal(local.api.metrics.rowWrites,1,'actual650ms default writer ACKs without manual Sync');assert.equal(local.c.pendingPreferenceIntent('A'),null);assert.equal(local.api.state().preferences.theme,'day');
  // An actual lifecycle read is in flight when connectivity returns; the
  // existing owner sees the event while busy, then that issued read fails.
  const cold=await fixture({compiled});cold.event('online');assert.equal(cold.loads,0);cold.c.serverPersistence.state='error';cold.mount();await cold.settle();assert.equal(cold.loads,1,'cold helper error mount owns recovery');
  const silent=await fixture({compiled});silent.mount();silent.setFail(true);silent.event('pageshow');await silent.settle();silent.setFail(false);await silent.advance(60000);assert.equal(silent.loads,1,'failure alone cannot start a blind retry loop');
  for(const fence of ['profile','generation','owner','session','subject','hidden','offline','uncertain','recovery-busy']){
   const x=await fixture({compiled});x.mount();const release=x.hold();x.event('pageshow');for(let i=0;i<20;i++)await Promise.resolve();x.event('online');x.setFail(true);release();await x.settle();x.setFail(false);
   if(fence==='profile')x.c.activeProfileBundle.profile.id='other';if(fence==='generation')x.c.serverStateSyncGeneration++;if(fence==='owner')x.c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'B',generation:1});if(fence==='session')x.c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'A',generation:1});if(fence==='subject')x.c.serverSyncClient.sessionSubject=()=> 'B';if(fence==='recovery-busy')x.c.localPreferenceRecoveryBusy=true;if(fence==='hidden')x.c.document.hidden=true;if(fence==='offline')x.c.navigator.onLine=false;
   if(fence==='uncertain')x.c.localPreferenceRecoveryHold={accountId:'A',profileId:x.c.activeProfileBundle.profile.id,sessionGeneration:0};
   await x.advance(60000);assert.equal(x.loads,1,'owed wake respects '+fence);assert.equal(x.api.calls.filter(call=>call.method==='PUT').length,0);
  }
  const held=await fixture({compiled});held.mount();held.edit();const originalReceipt=clone(held.c.pendingPreferenceIntent('A'));held.api.mutate(s=>s.preferences.futureChoice={enabled:false});await held.advance(650);held.event('pageshow');await held.settle();assert.equal(held.c.serverPersistence.state,'error');assert.deepEqual(held.c.pendingPreferenceIntent('A'),originalReceipt);assert.equal(held.api.calls.filter(call=>call.method==='PUT').length,0,'unknown genuine conflict holds without upload');
  const race=await fixture({compiled});race.mount();race.edit();race.api.raceOnce(()=>race.api.mutate(s=>s.eventSpoilerState={other:false}));await race.advance(650);assert.equal(race.api.calls.filter(x=>x.status===409).length,1);assert.equal(race.api.metrics.rowWrites,1);assert.equal(race.api.state().eventSpoilerState.other,false);assert.equal(race.c.pendingPreferenceIntent('A'),null,'real conditional409 rebase preserves remote unrelated state');
  const fulfilled=await fixture({compiled});fulfilled.mount();const complete=fulfilled.hold();fulfilled.event('pageshow');for(let i=0;i<20;i++)await Promise.resolve();fulfilled.event('online');complete();await fulfilled.settle();await fulfilled.advance(60000);assert.equal(fulfilled.loads,1,'busy event followed by clean ACK needs no follow-up');assert.equal(fulfilled.api.calls.filter(call=>call.method==='PUT').length,0);
  const twice=await fixture({compiled});twice.mount();const end=twice.hold();twice.event('pageshow');for(let i=0;i<20;i++)await Promise.resolve();twice.event('online');twice.setFail(true);end();await twice.settle();await twice.advance(60000);assert.equal(twice.loads,2,'a failed owed follow-up cannot loop without another event');assert.equal(twice.api.calls.filter(call=>call.method==='PUT').length,0);
  const cooldown=await fixture({compiled});cooldown.mount();cooldown.setFail(true);cooldown.event('pageshow');await cooldown.settle();cooldown.setFail(false);cooldown.event('online');await cooldown.advance(14999);assert.equal(cooldown.loads,1);await cooldown.advance(15000);assert.equal(cooldown.loads,2);assert.equal(cooldown.c.serverPersistence.state,'signedIn');await cooldown.advance(60000);assert.equal(cooldown.loads,2);
  const busy=await fixture({compiled});busy.mount();const release=busy.hold();busy.event('pageshow');for(let i=0;i<20;i++)await Promise.resolve();assert.equal(busy.c.serverPersistence.state,'syncing');
  busy.event('online');busy.setFail(true);release();await busy.settle();assert.equal(busy.c.serverPersistence.state,'error');assert.equal(busy.loads,1);
  busy.setFail(false);await busy.advance(15000);
  console.log(JSON.stringify({compiled,case:'online-during-issued-failed-lifecycle-read',loads:busy.loads,state:busy.c.serverPersistence.state,puts:busy.api.metrics.rowWrites,manualSyncCalls:0}));
  assert.equal(busy.c.serverPersistence.state,'signedIn','witnessed reconnect during busy failed read must receive one bounded automatic follow-up');assert.equal(busy.loads,2);assert.equal(busy.api.calls.filter(call=>call.method==='PUT').length,0);
 }
 console.log('Automatic source controls PASS; no browser/installed/OS-suspended proof.');
}
module.exports={run,fixture,reviewCase};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
