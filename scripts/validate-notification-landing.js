'use strict';
// Exercise the actual cold-start route through both deferred navigation modules.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const shell=html.slice(html.indexOf('async function syncAppRouteFromLocation(){'),html.indexOf('\nfunction codeInspectorGroupLabel('));
assert(shell.includes('function focusPendingNotificationEvent()'));
const navigationCode=fs.readFileSync('assets/js/notification-navigation.js','utf8');
const fixtureCode=fs.readFileSync('assets/js/fixture-navigation.js','utf8'),milestoneCode=fs.readFileSync('assets/js/milestone-alerts-ui.source.js','utf8');
const event={id:'fixture:cricket:CA:39990',canonicalEventId:'fixture:cricket:CA:39990'};
const matchCentreCode=fs.readFileSync('assets/js/match-centre-ui.source.js','utf8'),retainedStart=matchCentreCode.indexOf(' globalThis.openRetainedMilestoneMatchCentreFixture='),retainedCode=matchCentreCode.slice(retainedStart,matchCentreCode.indexOf(' navigator.serviceWorker?.addEventListener',retainedStart));
assert(retainedStart>=0&&retainedCode.includes('disposableStore'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function scenario({restoreDuringLoad=false,replacement=false}={}){
 let owner='',release,opened=null;
 const location=new URL('https://nothingsport.example/?event='+encodeURIComponent(event.id)+'&surface=match-centre&moment=expired-test');
 const frames=[],context={navigator:{},URL,URLSearchParams,Promise,AbortSignal,console,location,
  pendingNotificationEventId:'',activeTab:'feed',activeView:'list',activeFilter:'all',activeEvents:[],startupFeedState:{phase:'ready'},eventsDeepLinkReturnState:null,
  serverSyncClient:{sessionSubject:()=>owner},
  history:{state:null,replaceState(state,unused,url){this.state=state;location.href=new URL(url,location).href;}},
  syncNscPageFromHistory:()=>false,codeInspectorCodeFromLocation:()=>'',inspectorPickerHash:()=>'#picker',syncCodeInspectorFromLocation:async()=>{},eventsDeepLinkFromLocation:()=>null,
  renderAll(){},syncTopLevelNavigationState(){},showToast(){},cardStateForEvent:()=>'compact',setCardState(){},
  activateTopLevelTab(tab){context.activeTab=tab;},loadMatchCentre:async()=>{},
  openMilestoneMatchCentreFixture(fixture){opened=fixture.id;},
  fetch:async()=>({ok:true,json:async()=>({events:[event,{id:'fixture:cricket:CA:40000'}],fixtures:[]})}),readStorage:()=>null,PUSH_INSTALLATION_STORAGE_KEY:'installation',
  loadDeferredScript(url){if(url.includes('fixture-navigation'))return new Promise(resolve=>{release=()=>{vm.runInContext(fixtureCode,context);resolve();};});vm.runInContext(milestoneCode,context);return Promise.resolve();},
 };
 context.window=context;context.requestAnimationFrame=callback=>frames.push(callback);vm.createContext(context);vm.runInContext(shell,context);vm.runInContext(navigationCode,context);
 await context.syncAppRouteFromLocation();frames.shift()();
 if(restoreDuringLoad)owner='restored-account';
 if(replacement){location.search='?event=fixture%3Acricket%3ACA%3A40000&surface=match-centre';await context.syncAppRouteFromLocation();frames.shift()();}
 release();await tick();if(replacement){release();await tick();}await tick();
 return {tab:context.activeTab,opened,pending:context.pendingNotificationEventId};
}
// The old request has already entered its fetch (or retained-cache hydration).
async function fetchRace({retained=false,hydrateRace=false,oldFirst=false,legacyBootstrap=false,thirdTap=false}={}){
 const old=event;let next={id:'fixture:cricket:CA:40000'};const initialNext=next,events=new Map([[old.id,old],[next.id,next]]),mounted=[],receipts=[],frames=[],requests=new Map(),loads=new Set();
 const oldMoment='11111111-1111-4111-8111-111111111111';let newMoment='22222222-2222-4222-8222-222222222222';
 let releaseRetained;
 const location=new URL('https://nothingsport.example/?event='+encodeURIComponent(old.id)+'&surface=match-centre&moment=test-'+oldMoment);
 const context={navigator:{},URL,URLSearchParams,Promise,AbortSignal,console,location,
  pendingNotificationEventId:'',activeTab:'feed',activeView:'list',activeFilter:'all',activeEvents:[],startupFeedState:{phase:'ready'},eventsDeepLinkReturnState:null,
  serverSyncClient:{sessionSubject:()=> 'account',getSession:()=>({}),notificationCommand:async data=>receipts.push(data.testId)},
  history:{state:null,replaceState(state,unused,url){this.state=state;location.href=new URL(url,location).href;}},
  syncNscPageFromHistory:()=>false,codeInspectorCodeFromLocation:()=>'',inspectorPickerHash:()=>'#picker',syncCodeInspectorFromLocation:async()=>{},eventsDeepLinkFromLocation:()=>null,
  renderAll(){},syncTopLevelNavigationState(){},showToast(){},cardStateForEvent:()=>'compact',setCardState(){},
  activateTopLevelTab(tab){context.activeTab=tab;},loadMatchCentre:async()=>{},
  openMilestoneMatchCentreFixture(fixture){mounted.push(fixture.id);},
  ticket:()=>({}),valid:()=>true,cacheKey:()=> 'retained',notificationTarget:null,notificationRetained:false,membership:[],liveFixtureEvents:[],render(){},m:()=>({compact:e=>e}),
  disposableStore:{hydrate:async()=>{if(hydrateRace)await new Promise(resolve=>releaseRetained=resolve);return {events:[old]};}},
  fetch(url){return new Promise((resolve,reject)=>requests.set(new URL(url,location).searchParams.get('ids'),{resolve,reject}));},
  readStorage:()=>({installationId:'test-install',secret:'test-only'}),PUSH_INSTALLATION_STORAGE_KEY:'installation',
  loadDeferredScript(url){if(!loads.has(url)){loads.add(url);vm.runInContext(url.includes('fixture-navigation')?fixtureCode:milestoneCode,context);}return Promise.resolve();},
 };
 context.window=context;context.requestAnimationFrame=callback=>frames.push(callback);vm.createContext(context);vm.runInContext(shell,context);if(!legacyBootstrap)vm.runInContext(navigationCode,context);
 vm.runInContext(retainedCode,context);
 const drain=async()=>{for(let i=0;i<4;i++){await tick();while(frames.length)frames.shift()();}};
 const finish=id=>requests.get(id).resolve({ok:true,json:async()=>({events:[events.get(id)],fixtures:[]})});
 await context.syncAppRouteFromLocation();await drain();assert(requests.has(old.id));
 if(hydrateRace){requests.get(old.id).reject(Error('offline'));await drain();assert(releaseRetained);}
 if(legacyBootstrap)vm.runInContext(navigationCode,context);
 location.search='?event='+encodeURIComponent(next.id)+'&surface=match-centre&moment=test-'+newMoment;await context.syncAppRouteFromLocation();await drain();
 if(thirdTap){next={id:'fixture:cricket:CA:40001'};events.set(next.id,next);newMoment='33333333-3333-4333-8333-333333333333';location.search='?event='+encodeURIComponent(next.id)+'&surface=match-centre&moment=test-'+newMoment;await context.syncAppRouteFromLocation();await drain();}
 const newerStarted=requests.has(next.id);
 if(newerStarted&&!oldFirst){finish(next.id);await drain();}
 if(hydrateRace)releaseRetained();else if(retained)requests.get(old.id).reject(Error('offline'));else finish(old.id);
 await drain();
 const loadingAfterOld=vm.runInContext('Boolean(notificationFixtureLoading)',context);
 if(thirdTap){finish(initialNext.id);await drain();}
 if(requests.has(next.id)&&(oldFirst||!newerStarted)){finish(next.id);await drain();}
 return {mounted,receipts,newerStarted,loadingAfterOld,oldMoment,newMoment,next:next.id};
}
// Replay platform failures against the actual worker and actual application routing.
class Channel {
 constructor(){this.port1={close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))};}
}
function cacheStorage(){const stores=new Map();return {async open(name){if(!stores.has(name)){const rows=new Map();stores.set(name,{async match(key){return rows.get(String(key.url||key))?.clone();},async put(key,response){rows.set(String(key.url||key),response.clone());},async delete(key){return rows.delete(String(key.url||key));},async keys(){return [...rows.keys()].map(url=>new Request(url));}});}return stores.get(name);}};}
async function tap({reject=false,noClient=false,lateBoot=false,focusReject=false,foreign=false,restart=false,elapsed=0,suppressBoot=false}={}){
 let time=Date.now();class Clock extends Date{static now(){return time;}}
 const caches=cacheStorage(),workerSource=fs.readFileSync('service-worker.js','utf8'),listeners={},jobs=[],frames=[];
 let opened=null,appReady=!lateBoot;
 const location=new URL('https://nothingsport.example/'),client={id:'home-screen-client',type:'window',url:location.href,visibilityState:'visible',
  async focus(){if(focusReject)throw Error('focus failed');return this;},
  async navigate(url){if(reject)throw Error('navigate failed');this.url=url;location.href=url;return this;},
  postMessage(data){if(appReady)for(const handler of appListeners)handler({data,source:controller});},
 };
 const controller={scriptURL:'https://nothingsport.example/service-worker.js',postMessage(data,ports){listeners.message?.({data,source:client,ports,waitUntil:p=>jobs.push(p)});}};
 const appListeners=[],navigator={serviceWorker:{controller,ready:Promise.resolve({active:controller}),addEventListener(type,handler){if(type==='message')appListeners.push(handler);}}};
 const app={URL,URLSearchParams,Promise,AbortSignal,Date:Clock,MessageChannel:Channel,setTimeout,clearTimeout,location,navigator,
  document:{hidden:false,addEventListener(){}},addEventListener(){},
  pendingNotificationEventId:'',activeTab:'feed',activeView:'list',activeFilter:'all',activeEvents:[],startupFeedState:{phase:'ready'},eventsDeepLinkReturnState:null,
  serverSyncClient:{sessionSubject:()=> 'stored-account'},
  history:{state:null,replaceState(state,unused,url){this.state=state;location.href=new URL(url,location).href;}},
  syncNscPageFromHistory:()=>false,codeInspectorCodeFromLocation:()=>'',inspectorPickerHash:()=>'#picker',syncCodeInspectorFromLocation:async()=>{},eventsDeepLinkFromLocation:()=>null,
  renderAll(){},syncTopLevelNavigationState(){},showToast(){},cardStateForEvent:()=>'compact',setCardState(){},
  activateTopLevelTab(tab){app.activeTab=tab;},loadMatchCentre:async()=>{},openMilestoneMatchCentreFixture(fixture){opened=fixture.id;},
  fetch:async()=>({ok:true,json:async()=>({events:[event],fixtures:[]})}),readStorage:()=>null,PUSH_INSTALLATION_STORAGE_KEY:'installation',
  loadDeferredScript(url){vm.runInContext(url.includes('fixture-navigation')?fixtureCode:milestoneCode,app);return Promise.resolve();},
 };
 app.window=app;app.requestAnimationFrame=callback=>frames.push(callback);vm.createContext(app);vm.runInContext(shell,app);if(!lateBoot)vm.runInContext(navigationCode,app);
 const worker={location:{origin:location.origin},clients:{matchAll:async()=>noClient?[]:[client],openWindow:async()=>client},addEventListener:(type,handler)=>listeners[type]=handler};
 const marker=workerSource.includes('const NOTIFICATION_NAVIGATION_CACHE')?'const NOTIFICATION_NAVIGATION_CACHE':'self.addEventListener("notificationclick",';
 const installWorker=()=>vm.runInNewContext(workerSource.slice(workerSource.indexOf(marker)),{self:worker,caches,Request,Response,URL,Promise,Date:Clock,crypto:require('node:crypto').webcrypto,MessageChannel:Channel,setTimeout,clearTimeout});
 installWorker();if(appReady)app.startMilestoneNotificationNavigation?.();await tick();
 let pending;listeners.notificationclick({notification:{data:{kind:'milestone',url:foreign?'https://other.example/':'/?event='+encodeURIComponent(event.id)+'&surface=match-centre&moment=expired-test'},close(){}},waitUntil:p=>pending=p});
 let failure;try{await pending;}catch(error){failure=error.message;}
 time+=elapsed;if(restart)installWorker();
 appReady=true;if(lateBoot&&!suppressBoot)vm.runInContext(navigationCode,app);
 await app.syncAppRouteFromLocation();
 for(let i=0;i<8;i++){await tick();while(frames.length)frames.shift()();await Promise.allSettled(jobs.splice(0));}
 return {tab:app.activeTab,opened,failure,caches,client,controller,jobs,app,listeners};
}
(async()=>{
 for(const options of [{},{retained:true},{retained:true,hydrateRace:true},{oldFirst:true},{oldFirst:true,legacyBootstrap:true},{oldFirst:true,legacyBootstrap:true,thirdTap:true}]){const result=await fetchRace(options);console.log('In-flight tap race:',JSON.stringify({options,...result}));assert.deepEqual(result.mounted,[result.next],'Superseded current/retained fetch must not mount the old match');assert.deepEqual(result.receipts,[result.newMoment],'Only the newest exact landing may report a receipt');assert.equal(result.newerStarted,true,'The newer request must not wait behind the old fetch');if(options.oldFirst)assert.equal(result.loadingAfterOld,true,'An old finalizer cannot clear the newer loading state');}
 const normal=await scenario();assert.equal(normal.opened,event.id,'Stable-session cold launch opens the exact fixture');
 const replaced=await scenario({replacement:true});assert.equal(replaced.opened,'fixture:cricket:CA:40000','A second exact-match tap supersedes a still-loading first tap');
 const switched=await scenario({restoreDuringLoad:true});assert.equal(switched.opened,null,'A changed account cannot receive the earlier account route');
 for(const options of [{reject:true},{reject:true,focusReject:true},{noClient:true},{noClient:true,lateBoot:true},{noClient:true,lateBoot:true,restart:true}]){
  const result=await tap(options);
  console.log('Notification tap replay:',JSON.stringify({options,tab:result.tab,opened:result.opened,failure:result.failure}));
  assert.equal(result.failure,undefined,'Rejected platform navigation/focus must retain the exact-match tap');
  assert.equal(result.tab,'match-centre','A revived or root-launched window must leave the main Feed');
  assert.equal(result.opened,event.id,'The exact requested fixture must expand, including after late startup and worker restart');
  result.controller.postMessage({type:'nothingsport-notification-navigation-request'},[new Channel().port2]);await Promise.allSettled(result.jobs.splice(0));
  const cache=await result.caches.open('nothingsport-notification-navigation-v1');assert.equal((await cache.keys()).length,0,'Acknowledged navigation is removed and cannot replay');
 }
 const expired=await tap({noClient:true,lateBoot:true,elapsed:120001});assert.equal(expired.opened,null,'Expired handoffs cannot replay on later app opens');assert.equal((await(await expired.caches.open('nothingsport-notification-navigation-v1')).keys()).length,0);
 const scoped=await tap({noClient:true,lateBoot:true,suppressBoot:true}),channel=new Channel();let other;channel.port1.onmessage=e=>other=e.data;scoped.listeners.message({data:{type:'nothingsport-notification-navigation-request'},source:{id:'other-window',type:'window'},ports:[channel.port2],waitUntil:p=>scoped.jobs.push(p)});await Promise.all(scoped.jobs.splice(0));await tick();assert.equal(other,null,'A different window cannot claim the clicked window destination');const scopedCache=await scoped.caches.open('nothingsport-notification-navigation-v1');assert.equal((await scopedCache.keys()).length,1);
 const unsafe=await tap({foreign:true});assert.equal(unsafe.opened,null,'Foreign notification targets cannot create an in-app destination');
 console.log('Notification landing: cold start, account guard, rejected navigation/focus, root launch, late app boot, worker restart, acknowledgement and origin safety passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
