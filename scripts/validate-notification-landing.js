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
// The viewport frame runs after routing may already have consumed the URL.
const mountCode=matchCentreCode.slice(matchCentreCode.indexOf(' globalThis.openMilestoneMatchCentreFixture='),retainedStart);
// Keep the real factory closure: a notification leaves All Sports through its
// existing selector/stop owner before taking its viewport validity ticket.
const ticketCode=matchCentreCode.slice(matchCentreCode.indexOf(' const owner='),matchCentreCode.indexOf(' const m='));
const selectionCode=matchCentreCode.slice(matchCentreCode.indexOf(' function selectMatchCentreView('),matchCentreCode.indexOf(' globalThis.renderMatchCentre='));
assert(ticketCode.includes('const valid=')&&selectionCode.includes('globalThis.stopMatchCentre='));
function viewportFrameGuard(initialView='followed',actualMount=mountCode){
 const frames=[],scrolls=[],focused=[],privateWrites=[],stops=[],saved=[],viewRenders=[],next={id:'fixture:cricket:CA:40000'};let subject='account',generation=0;
 const followed={events:[event],key:'retained-followed',checked:123,maxAge:120000,nextCursor:null};
 const preferences={showSpoilers:false,feedControls:{spoilers:'strict'},followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[{participantId:'team:nrl:kept-unfollow',followLevel:'unfollow'}]},notifications:{enabled:false},unknownChoice:'retain'};
 const actions={[event.id]:{pinned:false,reminder:false}},states={[event.id]:'compact'},spoilers={[event.id]:false};
 const personal=()=>JSON.stringify({preferences,actions,states,spoilers}),before=personal();
 const context={URLSearchParams,location:new URL('https://example.test/?moment=test-example'),activeTab:'match-centre',fixtureNavigationRevision:1,notificationTarget:null,notificationRetained:false,membershipOwner:'',scores:new Map(),expanded:new Set(),notice:'',
  selectedView:initialView,get generation(){return generation;},set generation(value){generation=value;},serverSyncClient:{sessionSubject:()=>subject},userPreferences:preferences,eventActions:actions,cardViewStates:states,eventSpoilerState:spoilers,
  viewCache:new Map([['followed',followed]]),membership:[],membershipKey:'',membershipCheckedAt:0,membershipMaxAge:120000,nextCursor:null,
  allSportsLoadingTicket:{view:'all-sports'},allSportsView:{stop:()=>stops.push('all-sports')},refreshControl:{cancel:()=>stops.push('refresh')},timer:null,clearInterval:()=>stops.push('timer'),manual:{},
  document:{getElementById:id=>{assert.equal(id,'listView');return {removeAttribute:name=>{assert.equal(name,'aria-busy');stops.push('busy');}};}},
  render(){},renderMatchCentre:()=>viewRenders.push({view:context.selectedView,generation}),saveMembership:t=>saved.push(t),m:()=>({id:e=>e.id,compact:e=>e,observation:(e,s)=>s}),
  cards:new Map([event,next].map((e,index)=>[e.id,{card:{getBoundingClientRect:()=>({top:1000+index*500}),focus:options=>focused.push({id:e.id,preventScroll:options.preventScroll})}}])),requestAnimationFrame:callback=>frames.push(callback),stickyFeedChromeHeight:()=>196,scrollY:700,scrollTo:options=>scrolls.push(options.top)};
 for(const name of ['savePreferences','setCardState','updateEventAction','recordEventFeedAction','writeStorage','queueUserStateSync'])context[name]=()=>{privateWrites.push(name);assert.fail('Notification viewport must not call personal writer '+name);};
 context.localStorage={setItem:context.writeStorage,removeItem:context.writeStorage};context.window=context;vm.createContext(context);vm.runInContext("'use strict';\n"+ticketCode+selectionCode+actualMount,context);
 context.openMilestoneMatchCentreFixture(event);context.location.search='';frames.shift()();assert.deepEqual(scrolls,[1492],'URL cleanup cannot cancel the current heading alignment');assert.deepEqual(focused,[{id:event.id,preventScroll:true}]);
 const switched=initialView==='all-sports',expectedView=switched?'followed':initialView;
 assert.equal(context.selectedView,expectedView,'Only All Sports notification routing switches to Followed');assert.equal(generation,switched?1:0,'The real selector invalidates the old view before the mount ticket');
 assert.deepEqual(stops,switched?['timer','all-sports','refresh','busy']:[]);assert.deepEqual(viewRenders,switched?[{view:'followed',generation:1}]:[]);
 assert.equal(saved.length,1);assert.equal(saved[0].view,expectedView);assert.equal(saved[0].generation,generation);assert.equal(saved[0].owner,subject);
 assert.equal(context.notificationTarget,event);assert.equal(context.membershipOwner,subject);assert(context.expanded.has(event.id));assert.equal(context.scores.get(event.id),event);
 if(switched){assert.equal(context.membership,followed.events);assert.equal(context.membershipKey,followed.key);assert.equal(context.allSportsLoadingTicket,null);assert.equal(context.manual,null);}
 scrolls.length=0;focused.length=0;context.openMilestoneMatchCentreFixture(event);context.fixtureNavigationRevision++;context.openMilestoneMatchCentreFixture(next);frames.shift()();frames.shift()();assert.deepEqual(scrolls,[1992],'Only the newest fixture may scroll or focus');assert.deepEqual(focused,[{id:next.id,preventScroll:true}]);
 for(const invalidate of [()=>{subject='other-account';},()=>{context.activeTab='feed';},()=>{generation++;}]){context.activeTab='match-centre';context.openMilestoneMatchCentreFixture(next);invalidate();const before=scrolls.length;frames.shift()();assert.equal(scrolls.length,before,'Account, tab or view changes cancel the deferred viewport movement');}
 context.activeTab='match-centre';context.openMilestoneMatchCentreFixture(next);const beforeViewChange={scrolls:scrolls.length,focused:focused.length};context.selectMatchCentreView(context.selectedView==='followed'?'everything':'followed');frames.shift()();
 assert.deepEqual({scrolls:scrolls.length,focused:focused.length},beforeViewChange,'A real view change also cancels the deferred scroll and focus');
 assert.equal(personal(),before,'Notification routing preserves every saved choice, action, card state and spoiler setting');assert.deepEqual(privateWrites,[]);
}
for(const view of ['followed','everything','all-sports'])viewportFrameGuard(view);
// The regression must reject a skipped reset, an unconditional reset, and a
// ticket captured before the real view switch rather than after it.
const reset="  if(selectedView==='all-sports')selectMatchCentreView('followed');\n",takeTicket='  const t=ticket(),revision=fixtureNavigationRevision;\n';assert(mountCode.includes(reset+takeTicket));
for(const [view,fault,message] of [
 ['all-sports',mountCode.replace(reset,''),'Only All Sports notification routing switches to Followed'],
 ['everything',mountCode.replace(reset,"  selectMatchCentreView('followed');\n"),'Only All Sports notification routing switches to Followed'],
 ['all-sports',mountCode.replace(reset+takeTicket,takeTicket+reset),'URL cleanup cannot cancel the current heading alignment'],
])assert.throws(()=>viewportFrameGuard(view,fault),error=>error.code==='ERR_ASSERTION'&&error.message.includes(message),'Actual route faults must fail at their intended assertion');
console.log('Notification viewport: actual Followed/Everything/All Sports selector, stop and ticket closure; original guards, private choices and three source-fault controls passed.');
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
async function tap({reject=false,noClient=false,lateBoot=false,focusReject=false,foreign=false,restart=false,elapsed=0,suppressBoot=false,openNull=false,discovery="exact",replacementId=false,newTapDuringDiscovery=false}={}){
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
  fetch:async()=>({ok:true,json:async()=>({events:[event,{id:'fixture:cricket:CA:40000'}],fixtures:[]})}),readStorage:()=>null,PUSH_INSTALLATION_STORAGE_KEY:'installation',
  loadDeferredScript(url){vm.runInContext(url.includes('fixture-navigation')?fixtureCode:milestoneCode,app);return Promise.resolve();},
 };
 app.window=app;app.requestAnimationFrame=callback=>frames.push(callback);vm.createContext(app);vm.runInContext(shell,app);if(!lateBoot)vm.runInContext(navigationCode,app);
 let enumerations=0,windowOpened=false;
 const worker={location:{origin:location.origin},clients:{
  matchAll:async()=>{enumerations++;if(!windowOpened)return noClient?[]:[client];if(newTapDuringDiscovery&&enumerations===2){const snapshot={...client};let second;listeners.notificationclick({notification:{data:{kind:'milestone',url:'/?event=fixture%3Acricket%3ACA%3A40000&surface=match-centre&moment=newer-click'},close(){}},waitUntil:p=>second=p});await second;return [snapshot];}if(discovery==='none')return [];if(discovery==='error')throw Error('local enumeration unavailable');return discovery==='ambiguous'?[client,{...client,id:'another-window'}]:[client];},
  openWindow:async url=>{windowOpened=true;if(replacementId)client.id='replacement-window';client.url=discovery==='root'?location.origin+'/':discovery==='foreign'?'https://other.example/':discovery==='wrongMoment'?url.replace('expired-test','newer-moment'):discovery==='wrongEvent'?url.replace('39990','40000'):url;return openNull?null:client;}
 },addEventListener:(type,handler)=>listeners[type]=handler};
 const marker=workerSource.includes('const NOTIFICATION_NAVIGATION_CACHE')?'const NOTIFICATION_NAVIGATION_CACHE':'self.addEventListener("notificationclick",';
 const installWorker=()=>vm.runInNewContext(workerSource.slice(workerSource.indexOf(marker)),{self:worker,caches,Request,Response,URL,Promise,Date:Clock,crypto:require('node:crypto').webcrypto,MessageChannel:Channel,setTimeout,clearTimeout});
 installWorker();if(appReady)app.startMilestoneNotificationNavigation?.();await tick();
 let pending;listeners.notificationclick({notification:{data:{kind:'milestone',url:foreign?'https://other.example/':'/?event='+encodeURIComponent(event.id)+'&surface=match-centre&moment=expired-test'},close(){}},waitUntil:p=>pending=p});
 let failure;try{await pending;}catch(error){failure=error.message;}
 time+=elapsed;if(restart)installWorker();
 appReady=true;if(lateBoot&&!suppressBoot)vm.runInContext(navigationCode,app);
 await app.syncAppRouteFromLocation();
 for(let i=0;i<8;i++){await tick();while(frames.length)frames.shift()();await Promise.allSettled(jobs.splice(0));}
 return {tab:app.activeTab,opened,failure,caches,client,controller,jobs,app,listeners,enumerations};
}
// A click superseded during its FIRST lookup must not touch any window.
async function initialEnumerationRace({existing=true,milestone=true}={}){
 const workerSource=fs.readFileSync('service-worker.js','utf8'),listeners={},actions=[],handoffs=[],caches=cacheStorage();
 const origin='https://nothingsport.example',oldUrl=origin+'/?event='+encodeURIComponent(event.id)+'&surface=match-centre&moment=old-click',newUrl=origin+'/?event=fixture%3Acricket%3ACA%3A40000&surface=match-centre&moment=new-click';
 let resolveFirst,enumerations=0,active='old';
 const client={id:'same-window',type:'window',url:origin+'/',async navigate(url){actions.push({action:'navigate',intent:active,url});this.url=url;return this;},async focus(){actions.push({action:'focus',intent:active,url:this.url});return this;},postMessage(data){handoffs.push(data.url);}};
 const worker={location:{origin},clients:{matchAll(){enumerations++;if(enumerations===1)return new Promise(resolve=>resolveFirst=resolve);return Promise.resolve(existing?[client]:[]);},async openWindow(url){actions.push({action:'openWindow',intent:active,url});client.url=url;return client;}},addEventListener:(type,handler)=>listeners[type]=handler};
 vm.runInNewContext(workerSource.slice(workerSource.indexOf('const NOTIFICATION_NAVIGATION_CACHE')),{self:worker,caches,Request,Response,URL,Promise,Date,crypto:require('node:crypto').webcrypto,MessageChannel:Channel,setTimeout,clearTimeout});
 const click=url=>{let pending;listeners.notificationclick({notification:{data:{kind:milestone?'milestone':'reminder',url},close(){}},waitUntil:p=>pending=p});return pending;};
 const old=click(oldUrl);assert.equal(typeof resolveFirst,'function');active='new';await click(newUrl);assert.equal(client.url,newUrl,'Newer click completes before the old initial lookup');active='old';resolveFirst(existing?[client]:[]);await old;
 return {actions,handoffs,client,newUrl,enumerations};
}
// Once a native action is issued, only its later worker continuations can be fenced.
async function pendingWindowRace({stage='navigate',milestone=true,lateNativeCommit=false}={}){
 const source=fs.readFileSync('service-worker.js','utf8'),listeners={},actions=[],handoffs=[],caches=cacheStorage(),origin='https://nothingsport.example';
 const oldUrl=origin+'/?event='+encodeURIComponent(event.id)+'&surface=match-centre&moment=old-click',newUrl=origin+'/?event=fixture%3Acricket%3ACA%3A40000&surface=match-centre&moment=new-click';
 let release,active='old',superseded=false,enumerations=0;
 const pause=()=>new Promise(resolve=>release=resolve),record=(action,url)=>actions.push({action,url,intent:active,afterSupersession:superseded});
 const client={id:'same-window',type:'window',url:origin+'/',async navigate(url){const old=active==='old';record('navigate',url);if(old&&stage==='navigate'){if(!lateNativeCommit)this.url=url;await pause();if(lateNativeCommit)this.url=url;}else this.url=url;return this;},async focus(){record('focus',this.url);if(active==='old'&&stage==='focus')await pause();return this;},postMessage(data){handoffs.push(data.url);}};
 const worker={location:{origin},clients:{async matchAll(){enumerations++;return stage==='openWindow'&&enumerations===1?[]:[client];},async openWindow(url){const old=active==='old';record('openWindow',url);if(old&&stage==='openWindow'){if(!lateNativeCommit)client.url=url;await pause();if(lateNativeCommit)client.url=url;}else client.url=url;return client;}},addEventListener:(type,handler)=>listeners[type]=handler};
 vm.runInNewContext(source.slice(source.indexOf('const NOTIFICATION_NAVIGATION_CACHE')),{self:worker,caches,Request,Response,URL,Promise,Date,crypto:require('node:crypto').webcrypto,MessageChannel:Channel,setTimeout,clearTimeout});
 const click=url=>{let pending;listeners.notificationclick({notification:{data:{kind:milestone?'milestone':'reminder',url},close(){}},waitUntil:p=>pending=p});return pending;};
 const old=click(oldUrl);await tick();assert.equal(typeof release,'function','Old native action must be pending');active='new';await click(newUrl);assert.equal(client.url,newUrl,'Newer destination is selected before the pending old action resolves');active='old';superseded=true;release();await old;
 return {actions,handoffs,client,newUrl,oldUrl,enumerations};
}
(async()=>{
 for(const options of [{existing:true},{existing:false},{existing:true,milestone:false},{existing:false,milestone:false}]){
  const race=await initialEnumerationRace(options);assert.deepEqual(race.actions.filter(action=>action.intent==='old'),[],'Superseded initial enumeration must perform no old navigate, focus or openWindow: '+JSON.stringify(options));assert.equal(race.client.url,race.newUrl,'Late initial lookup cannot replace the newer destination');assert(race.handoffs.every(url=>url===race.newUrl),'Only the newer destination may hand off');assert.equal(race.enumerations,2,'A superseded initial lookup adds no recovery enumeration');
 }
 console.log('Late initial enumeration: existing/absent window and milestone/reminder controls preserve the newer click without old window actions.');
 for(const options of [{stage:'navigate'},{stage:'navigate',milestone:false},{stage:'focus'},{stage:'focus',milestone:false},{stage:'openWindow'},{stage:'openWindow',milestone:false}]){
  const race=await pendingWindowRace(options);assert.deepEqual(race.actions.filter(action=>action.intent==='old'&&action.afterSupersession),[],'Superseded native continuation must perform no further window actions: '+JSON.stringify(options));assert.equal(race.client.url,race.newUrl,'A completed newer destination must survive an old worker continuation');assert(race.handoffs.every(url=>url===race.newUrl),'Old native continuations cannot hand off');assert.equal(race.enumerations,2,'Pending native actions add no recovery enumeration when a handle exists');
 }
 console.log('Pending navigate/focus/openWindow continuations: only the newest click may perform a further window action or handoff. Already-issued native late commits are a separate unresolved browser seam.');
 for(const options of [{noClient:true,lateBoot:true,openNull:true},{noClient:true,lateBoot:true,openNull:true,replacementId:true}]){
  const r=await tap(options);assert.equal(r.opened,event.id,'Null handle with uniquely proven exact URL must recover the requested match');assert.equal(r.tab,'match-centre');assert.equal(r.enumerations,2,'Exactly one extra native enumeration is allowed after the missing handle');
 }
 for(const discovery of ['none','ambiguous','foreign','wrongMoment','wrongEvent','root','error']){
  const r=await tap({noClient:true,lateBoot:true,openNull:true,discovery});assert.equal(r.opened,null,'No arbitrary window may claim '+discovery);assert.equal(r.tab,'feed');assert.equal(r.enumerations,2);
 }
 for(const options of [{},{noClient:true},{reject:true},{noClient:true,lateBoot:true}]){const r=await tap(options);assert.equal(r.opened,event.id);assert.equal(r.enumerations,1,'Existing and returned handles add no enumeration');}
 const newest=await tap({noClient:true,lateBoot:true,openNull:true,newTapDuringDiscovery:true});assert.equal(newest.opened,'fixture:cricket:CA:40000','A newer click cannot be overwritten by the old delayed enumeration');assert.equal(newest.enumerations,3);
 console.log('Missing-handle exact-window recovery and none/ambiguous/foreign/newer-target/root controls passed; original root-only reproduction remains unresolved.');
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
