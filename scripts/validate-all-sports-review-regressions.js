'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../config/all-sports-view'),match=require('../config/match-centre');
const drain=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function element(){return {dataset:{},isConnected:false,children:[],getAttribute(){},setAttribute(){},removeAttribute(){},append(...items){this.children.push(...items);items.forEach(i=>i.isConnected=true);},replaceChildren(...items){this.children=items;}};}
function centre(){
 let resolve,reject,requests=0,starts=[];
 const pending=new Promise((yes,no)=>{resolve=yes;reject=no;}),panel=element();panel.isConnected=true;
 const context={console,Date,Promise,URL,URLSearchParams,AbortController,AbortSignal,Map,Set,activeTab:'match-centre',account:'one',userPreferences:{showSpoilers:false},eventActions:{},navigator:{},clearInterval(){},
  serverSyncClient:{sessionSubject:()=>context.account},document:{querySelector:()=>null,createElement:element,getElementById:()=>panel,head:element(),addEventListener(){}},loadDeferredScript:()=>{requests++;return pending;}};
 const source=fs.readFileSync('assets/js/match-centre-ui.source.js','utf8'),end=source.lastIndexOf('\n})();');assert(end>0);
 // Expose existing navigation only; run the actual public render/loader path.
 const exposed=source.slice(0,end)+'\nglobalThis.qa={select:selectMatchCentreView,view:()=>selectedView};'+source.slice(end);
 vm.runInNewContext(exposed,context);
 const actualRender=context.renderMatchCentre;
 context.renderMatchCentre=()=>{if(context.qa.view()==='all-sports')return actualRender();};
 return {context,panel,requests:()=>requests,starts,resolve(){context.createAllSportsView=()=>({start(){starts.push({owner:context.account,results:context.userPreferences.showSpoilers});},stop(){}});resolve();},reject};
}
async function reentry(){
 const c=centre();c.context.qa.select('all-sports');c.context.qa.select('followed');c.context.qa.select('all-sports');
 assert.equal(c.requests(),1,'Returning before download completion must reuse one request');assert.equal(c.starts.length,0);
 c.context.userPreferences.showSpoilers=true;c.resolve();await drain();
 assert.equal(c.starts.length,1,'Returning to All Sports before its module resolves must mount the current visit');assert.equal(c.starts[0].results,true,'The current preference is read at completion');
}
async function ownerAndFailure(){
 const stale=centre();stale.context.qa.select('all-sports');stale.context.qa.select('followed');stale.resolve();await drain();assert.equal(stale.starts.length,0,'Leaving must not mount stale UI');
 const changed=centre();changed.context.qa.select('all-sports');changed.context.account='two';changed.context.userPreferences.showSpoilers=true;changed.context.renderMatchCentre();changed.resolve();await drain();assert.equal(changed.requests(),1);assert.deepEqual(changed.starts,[{owner:'two',results:true}],'Only the current owner may mount after a shared download');
 const failed=centre();failed.context.qa.select('all-sports');failed.context.qa.select('followed');failed.context.qa.select('all-sports');failed.reject(Error('offline'));await drain();assert(failed.panel.children.some(n=>n.textContent==='Retry'),'The current visit receives the failed shared download and a usable Retry');
}
function compositionCentre(){
 let release;const restored=new Promise(resolve=>{release=resolve;}),calls=[],panel=element();panel.isConnected=true;
 const context={console,Date,Promise,URL,URLSearchParams,Headers,AbortController,AbortSignal,Map,Set,activeTab:'match-centre',activeEvents:[],account:'',navigator:{},innerHeight:844,userPreferences:{version:26,onboardingComplete:true,showSpoilers:false,followedSports:[],feedControls:{spoilers:'strict'}},eventActions:{},serverPersistence:{user:null},NOTHINGSPORTS_MATCH_CENTRE:match,location:{href:'http://native.local/',origin:'http://native.local'},clearInterval(){},setInterval:()=>1,eventFollowReason:()=>false,createMatchCentreRefresh:()=>({cancel(){},pulling:false}),loadDeferredScript:()=>new Promise(()=>{}),
  serverSyncClient:{sessionSubject:()=>context.account},disposableStore:{hydrate:()=>restored},document:{hidden:false,querySelector:s=>s.startsWith('#listView .mc-membership-tabs')?{textContent:context.qa.view()==='followed'?'Followed':'All Sports'}:null,querySelectorAll:()=>[],createElement:element,getElementById:()=>panel,head:element(),addEventListener(){}},
  fetch:async(url,init)=>{const headers=new Headers(init?.headers);calls.push({url,method:init?.method||'GET',body:init?.body,contentType:headers.get('content-type'),authorization:headers.has('authorization')});return {ok:true,json:async()=>({events:[],fixtures:[],pagination:{nextCursor:null}})};}};
 const source=fs.readFileSync('assets/js/match-centre-ui.source.js','utf8'),end=source.lastIndexOf('\n})();');assert(end>0);
 // Only layout is the mocked host boundary. Queued restore, generation,
 // navigation, hydration, body construction and fetch observer are real.
 vm.createContext(context);vm.runInContext(source.slice(0,end)+'\nrender=()=>{};globalThis.qa={hydrate,select:selectMatchCentreView,view:()=>selectedView};'+source.slice(end),context,{filename:'assets/js/match-centre-ui.source.js'});
 vm.runInContext('('+require('./validate-all-sports-view-browser').observeApiFetch.toString()+')();',context);
 return {context,calls,release};
}
async function followedCompositionGuard(){
 const {publicFollowedComposition,mutationRequests}=require('./validate-all-sports-view-browser'),c=compositionCentre(),before=JSON.stringify([c.context.userPreferences,c.context.eventActions]);
 await c.context.qa.hydrate();assert.equal(c.calls.length,1);const request=c.calls[0],invocation=c.context.qaApiInvocations[0];
 assert.equal(publicFollowedComposition(request,invocation),true,'The actual Followed caller uses a bounded read-only public composition POST');assert.equal(mutationRequests(c.calls,c.context.qaApiInvocations,1).length,0);assert.equal(JSON.stringify([c.context.userPreferences,c.context.eventActions]),before);
 const changed=patch=>[{...request,...patch},{...invocation,...patch}],bad=[...['/api/user-state','/api/product-events','/api/feed','/api/feed?scope=athletes&limit=50&cursor=0','/api/feed?scope=match-centre&limit=60&cursor=0','/api/feed?scope=match-centre&limit=50&cursor=50'].map(url=>changed({url})),changed({authorization:true}),changed({method:'PUT'}),changed({contentType:'text/plain'}),changed({body:JSON.stringify({...JSON.parse(request.body),action:'save'})}),[request,{...invocation,view:'All Sports'}],[request,{...invocation,tab:'feed'}],[request,{...invocation,initiator:'another-module.js'}],[request,{...invocation,preferences:'{}'}],[request,null]];
 for(const [r,i] of bad)assert.equal(publicFollowedComposition(r,i),false,'Unknown/wrong-scope/body/phase/auth/caller POST must remain a guard failure');
 assert.equal(mutationRequests([request],[],1).length,1,'XHR/unobserved calls are not waived');assert.equal(mutationRequests([request,request],[invocation],2).length,1,'One invocation cannot waive two network requests');assert.equal(mutationRequests([request,request],[invocation,invocation],1).length,1,'The explicit Followed-visit read budget still applies');
 const large=JSON.parse(request.body);large.preferences.qaPadding='x'.repeat(131072);assert.equal(publicFollowedComposition({...request,body:JSON.stringify(large)},{...invocation,body:JSON.stringify(large),preferences:JSON.stringify(large.preferences)}),false,'Even matching read inputs retain the public body-size cap');
 await c.context.fetch('/api/user-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save'})});assert.equal(mutationRequests(c.calls,c.context.qaApiInvocations,1).length,1,'The real pass-through observer still catches a personal API POST');
 // Exercise the actual server's public POST route and pure feed builder.
 // Private authentication/state dependencies are forbidden, not mocked green.
 const pipeline=require('../lib/server-feed-pipeline'),clock=new Date('2026-10-24T04:00:00Z'),d={...pipeline,overlaySnapshots:require('../lib/live-fixtures').overlaySnapshots,eventFeed:{version:'native-controlled',publishedAt:clock.toISOString(),events:[]},contextualEvents:[],canonicalSportContext:{participants:[]},FOLLOW_FIXTURE_VERSION:'native-controlled',readLiveSnapshots:async()=>({revision:'native-controlled',sources:[],stale:false}),resolveUserFollowFixtures:async()=>({events:[],participants:[]})};
 const response={setHeader(){},status(code){this.code=code;return this;},send(body){this.body=JSON.parse(body);return this;},json(body){this.body=body;return this;}};
 await require('../api/feed').createFeedHandler({load:()=>d,clock:()=>clock,authenticate:()=>{throw Error('A public composition must not read/write private account state');}})({url:request.url,method:request.method,body:JSON.parse(request.body)},response);
 assert.equal(response.code,200,JSON.stringify(response.body));assert.equal(response.body.events.length,0);assert.equal(JSON.stringify([c.context.userPreferences,c.context.eventActions]),before);
}
async function queuedHydrationFence(){
 for(const move of ['all-sports','feed','owner','stay']){
  const c=compositionCentre();c.context.renderMatchCentre();assert.equal(c.calls.length,0);
  if(move==='all-sports')c.context.qa.select('all-sports');if(move==='feed')c.context.activeTab='feed';if(move==='owner')c.context.account='other';
  c.release(null);await drain();assert.equal(c.calls.length,move==='stay'?1:0,'Queued Followed hydration must respect the original '+move+' navigation/owner ticket');
 }
}
async function retainedFreshness(){
 const now=Date.now(),stamp=new Date(now).toISOString(),window=model.windowFor('today',now);
 const live={id:'fixture:nrl:retained-live-only',key:'nrl',name:'Retained live fixture',status:'live',statusCheckedAt:stamp,scoreCheckedAt:stamp,startTimeUtc:new Date(now-3600000).toISOString()};
 const ordinary={id:'fixture:nrl:static',key:'nrl',name:'Static fixture',status:'upcoming',startTimeUtc:new Date(now+1000).toISOString(),stale:true};
 const original=JSON.stringify(live);let reads=0,saves=0;
 const context={console,Date,Promise,Map,Set,URLSearchParams,AbortController,AbortSignal,NOTHINGSPORTS_ALL_SPORTS:model,NOTHINGSPORTS_MATCH_CENTRE:match,document:{hidden:false},disposableStore:{set(){saves++;}},
  fetch:async()=>{reads++;return {ok:true,json:async()=>({enabled:true,schemaVersion:'all-sports.v1',window,revision:'retained-case',membershipStale:true,events:[ordinary],pagination:{cursor:0,limit:50,total:1,nextCursor:null}})};}};
 let source=fs.readFileSync('assets/js/all-sports-ui.source.js','utf8');const seam='return {start,stop,render,visibility};';assert.equal(source.split(seam).length,2);
 // Render is the mocked host boundary; selection, pagination, retained merge,
 // completion and the real live-state model all execute without replacement.
 source=source.replace(seam,'render=()=>{};return {start,stop,render,visibility,load,state};');vm.runInNewContext(source,context);
 const view=context.createAllSportsView({active:()=>true,owner:()=> 'one'});view.state().events=[live];await view.load(true);
 const current=view.state().events.find(e=>e.id===live.id);assert(current,'A missing degraded row must remain in membership');
 assert.equal(current.stale,true,'A retained live-only row omitted from degraded static pages must be qualified stale');assert.equal(match.liveState(current,now),'awaiting-update');assert.equal(current.statusCheckedAt,stamp);assert.equal(current.status,'live');assert.equal(JSON.stringify(live),original);assert.equal(saves,0,'A degraded union cannot replace the last-good cache');assert.equal(reads,1);
}
function reverseAliasBridge(){
 const official=Object.freeze({id:'fixture:nrl:official',key:'nrl',sourceType:'official',sourceUrl:'https://official.example/fixture',sourceCheckedAt:'2026-10-24T04:00:00Z',status:'upcoming'});
 const reporting=Object.freeze({id:'fixture:nrl:reporting',key:'nrl',sourceType:'trusted-reporting',sourceUrl:'https://reporting.example/fixture',sourceCheckedAt:'2026-10-24T03:00:00Z',status:'upcoming'});
 const bridge=Object.freeze({id:'fixture:nrl:bridge',key:'nrl',sourceType:'trusted-reporting',sourceEventIds:[official.id,reporting.id]});
 for(const records of [[reporting,official,bridge],[official,reporting,bridge]]){
  const before=JSON.stringify(records),selected=model.unique(records);assert.equal(selected.length,1);
  assert.equal(selected[0],official,'An alias bridge encountered in [1,0] order must retain the actual official source winner');assert.equal(selected[0].sourceCheckedAt,official.sourceCheckedAt);assert.equal(selected[0].sourceUrl,official.sourceUrl);assert.equal(JSON.stringify(records),before);
 }
}
async function lateSelectedObservation(){
 const now=Date.now(),asOf=now-60000,window=model.windowFor('today',asOf),stamp=new Date(now).toISOString();
 const base={id:'fixture:nrl:late-selected',key:'nrl',name:'Live after pagination anchor',status:'live',startTimeUtc:new Date(asOf-3600000).toISOString(),statusCheckedAt:new Date(asOf).toISOString(),homeParticipantId:'home',awayParticipantId:'away',homeScore:6,awayScore:0};
 const latest={...base,statusCheckedAt:stamp,scoreCheckedAt:stamp,homeScore:12};const original=JSON.stringify(latest);let reads=0;
 const context={console,Date,Promise,Map,Set,URLSearchParams,AbortController,AbortSignal,NOTHINGSPORTS_ALL_SPORTS:model,NOTHINGSPORTS_MATCH_CENTRE:match,innerWidth:390,innerHeight:800,document:{hidden:false},
  fetch:async()=>{reads++;return {ok:true,json:async()=>({enabled:true,events:[latest],fixtures:[match.compact(latest,{checkedAt:stamp,stale:false})]})};}};
 const source=fs.readFileSync('assets/js/all-sports-ui.source.js','utf8').replace('return {start,stop,render,visibility};',`render=()=>{};chrome={body:{querySelectorAll:()=>[{dataset:{sportsId:'${base.id}'},getBoundingClientRect:()=>({top:0,bottom:100,left:0,right:300})}]}};return {start,stop,render,visibility,poll,state};`);
 vm.runInNewContext(source,context);const view=context.createAllSportsView({active:()=>true,owner:()=> 'one'});view.state().window=window;view.state().events=[base];await view.poll();
 const current=view.state().events[0];assert.equal(current.statusCheckedAt,stamp);assert.equal(model.select([current],window).length,1,'A source-confirmed live fixture cannot disappear when a selected observation is later than the frozen pagination anchor');assert.equal(model.select([{...current,status:'completed',completedAt:stamp}],window).length,0,'An explicit completion still removes the fixture');assert.equal(model.select([{...current,statusCheckedAt:new Date(now+60000).toISOString()}],window,now).length,0,'A future status observation still cannot establish play');assert.equal(view.state().window.asOf,asOf);assert.equal(view.state().window.end,window.end);assert.equal(JSON.stringify(latest),original);assert.equal(reads,1);
}
function scoreElement(tag){
 const node={tagName:tag.toUpperCase(),dataset:{},className:'',children:[],parentNode:null,isConnected:true,_text:'',append(...items){for(let child of items){if(typeof child==='string'){const text=scoreElement('text');text._text=child;child=text;}child.parentNode=this;this.children.push(child);}},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);},setAttribute(k,v){this[k]=v;},querySelectorAll(selector){const matches=n=>selector.startsWith('.')?n.className.split(/\s+/).includes(selector.slice(1)):selector==='[data-feed-score-style]'&&Object.hasOwn(n.dataset,'feedScoreStyle');const result=[];for(const child of this.children){if(matches(child))result.push(child);result.push(...child.querySelectorAll(selector));}return result;},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};
 node.classList={contains:name=>node.className.split(/\s+/).includes(name),add:name=>{node.className+=' '+name;},toggle(name,on){if(on)this.add(name);else node.className=node.className.split(/\s+/).filter(n=>n!==name).join(' ');}};
 Object.defineProperty(node,'textContent',{get(){return this._text+this.children.map(n=>n.textContent).join('');},set(value){this._text=String(value);this.children=[];}});return node;
}
async function matchCentreScores(){
 for(const key of ['nrl','afl','tennis']){
  const now=Date.now(),event={id:'fixture:'+key+':results',key,name:'Home v Away',status:'live',statusCheckedAt:new Date(now).toISOString(),scoreCheckedAt:new Date(now).toISOString(),homeParticipantId:'home',awayParticipantId:'away',participants:[{id:'home',displayName:'Home'},{id:'away',displayName:'Away'}],...(key==='tennis'?{tournamentLevel:'ATP1000',sets:[{home:6,away:4}],games:{home:2,away:1}}:{homeScore:18,awayScore:12})};
  const head=scoreElement('head'),card=scoreElement('article');card.className='event-card feed-fixture is-opened';card.dataset.cardMode='schedule';let polls=0;
  const context={console,Date,Promise,Map,Set,activeTab:'match-centre',results:true,strict:false,NOTHINGSPORTS_MATCH_CENTRE:match,NOTHINGSPORTS_FIXTURE_IDENTITY:require('../config/fixture-identity'),NOTHINGSPORTS_FEED_CARD_PRESENTATION:{displayLabel:(_id,label)=>label},profileFixtureEvents:new Map([[event.id,event]]),cardIdentityParticipants:()=>event.participants,serverSyncClient:{sessionSubject:()=> 'one'},queueLiveFixtureSnapshot:()=>{polls++;},document:{createElement:scoreElement,head,querySelector:s=>head.querySelector(s)},isSpoilerVisible:()=>context.results&&!context.strict,fetch:()=>{throw Error('The shared score renderer must not add a poller');},updateEventAction:()=>{throw Error('No personal action write');},setCardState:()=>{throw Error('No personal card state write');}};
  let release;const pending=new Promise(resolve=>{release=resolve;});vm.createContext(context);context.loadDeferredScript=async url=>{if(url.startsWith('config/feed-live-scores.js')){await pending;vm.runInContext(fs.readFileSync('config/feed-live-scores.js','utf8'),context);}};
  vm.runInContext(fs.readFileSync('config/feed-live-score-loader.js','utf8'),context);
  context.NOTHINGSPORTS_FEED_SCORE_UI.install(card,event);context.results=false;release();await drain();assert.equal(card.querySelector('.feed-live-score'),null,'A privacy choice made during the shared score download applies at completion');
  context.results=true;context.NOTHINGSPORTS_FEED_SCORE_UI.install(card,event);
  assert(card.querySelector('.feed-live-score'),'Results ON must mount the actual shared '+key+' score summary in a Match Centre schedule card');assert.match(card.textContent,key==='tennis'?/6–4.*2–1/:/Home 18.*Away 12/);
  context.results=false;context.NOTHINGSPORTS_FEED_SCORE_UI.install(card,event);assert.equal(card.querySelector('.feed-live-score'),null,'Results OFF clears visible and accessible score text');
  context.results=true;context.strict=true;context.NOTHINGSPORTS_FEED_SCORE_UI.install(card,event);assert.equal(card.querySelector('.feed-live-score'),null,'Strict protection wins over Results ON');assert.equal(polls,0,'Match Centre does not acquire a second Feed poller');
  context.strict=false;card.dataset.cardMode='calendar';context.NOTHINGSPORTS_FEED_SCORE_UI.install(card,event);assert.equal(card.querySelector('.feed-live-score'),null,'Other Match Centre card types keep their existing boundary');
  context.activeTab='feed';context.NOTHINGSPORTS_FEED_SCORE_UI.install(card,event);assert(card.querySelector('.feed-live-score'),'The original Feed installer still works');assert.equal(polls,1);
 }
}
async function run(){let failed=false;for(const [name,test] of [['pending module re-entry',reentry],['current owner/failure controls',ownerAndFailure],['public Followed composition versus mutation guard',followedCompositionGuard],['queued Followed hydration generation fence',queuedHydrationFence],['retained live-only degradation',retainedFreshness],['reverse-order alias source winner',reverseAliasBridge],['late selected observation',lateSelectedObservation],['Match Centre Results ON/OFF/strict',matchCentreScores]]){try{await test();console.log('PASS '+name);}catch(error){failed=true;console.error('FAIL '+name+': '+error.message);}}if(failed)throw Error('All Sports review regressions failed');}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports=run;
