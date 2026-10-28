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
async function requestPairingGuard(){
 const {mutationRequests}=require('./validate-all-sports-view-browser'),c=compositionCentre();await c.context.qa.hydrate();
 const request=c.calls[0],invocation=c.context.qaApiInvocations[0],outside={...invocation,view:'All Sports'},mutation={...invocation,url:'/api/user-state',body:JSON.stringify({action:'save'})};
 const negatives=[
  ['orphan Followed invocation cannot waive identical All Sports request',[request],[invocation,outside],2],
  ['invalid invocation fails even when all identical requests arrive',[request,request],[invocation,outside],2],
  ['out-of-view invocation fails before an identical valid invocation',[request],[outside,invocation],2],
  ['unmatched mutation invocation',[],[mutation],1],
  ['unmatched out-of-view invocation',[],[outside],1],
  ['unmatched over-budget invocation',[request],[invocation,invocation],1],
  ['all unmatched invocations still consume the read budget',[],[invocation,invocation],1],
  ['valid invocation requires network corroboration',[],[invocation],1]
 ];
 const escaped=[];
 for(const [name,network,invocations,budget] of negatives){const receipts=[];if(mutationRequests(network,invocations,budget,receipts).length===0)escaped.push(name);else assert.equal(receipts.length,0,'A failed audit must not issue a read receipt: '+name);}
 assert.deepEqual(escaped,[],'Every invocation must be classified/counted independently and corroborated one-to-one');
 const identical=[];assert.equal(mutationRequests([request,request],[invocation,invocation],2,identical).length,0);assert.deepEqual(identical.map(r=>r.networkIndex),[0,1],'Identical valid calls still need two distinct network records');
 c.context.userPreferences.qaPairing=1;await c.context.qa.hydrate(true);
 assert.equal(c.calls.length,2);const receipts=[];
 assert.equal(mutationRequests([...c.calls].reverse(),c.context.qaApiInvocations,2,receipts).length,0,'Distinct valid calls can be corroborated even when network events arrive out of order');assert.equal(receipts.length,2);
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
 node.prepend=function(...items){const rest=this.children;this.children=[];this.append(...items,...rest);};node.appendChild=function(child){this.append(child);return child;};node.getAttribute=function(key){return this[key];};
 node.replaceChildren=function(...items){this._text='';for(const child of this.children)child.parentNode=null;this.children=[];this.append(...items);};Object.defineProperty(node,'childNodes',{get(){return this.children;}});
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
async function selectedCardsStayMounted(replay=null){
 const now=Date.now(),stamp=new Date(now).toISOString(),prior=new Date(now-1000).toISOString(),id=replay?.published.id||'fixture:tennis:mounted-summary';
 const base=replay?.published||Object.freeze({id,eventId:id,key:'tennis',name:'Native Home v Native Away',competitionName:'Native ATP Masters',tournamentLevel:'ATP1000',date:model.dayKey(now),startTimeUtc:new Date(now-3600000).toISOString(),status:'live',fixtureObservationSchema:'fixture-observations.v1',statusCheckedAt:prior,scoreCheckedAt:prior,sourceCheckedAt:prior,sourceUrl:'https://organiser.example/fixture',homeParticipantId:'home',awayParticipantId:'away',participants:[{id:'home',displayName:'Native Home'},{id:'away',displayName:'Native Away'}],sets:[{home:6,away:4}],games:{home:2,away:1}});
 const latest=replay?.published||{...base,statusCheckedAt:stamp,scoreCheckedAt:stamp,games:{home:3,away:1}},original=JSON.stringify(base);
 const handler=require('../lib/match-centre-handler').createMatchCentreHandler({enabled:()=>true,published:()=>[base],clock:()=>now,snapshotRead:async()=>({sources:replay?replay.globalSources:[{checked_at:prior,fixtures:[base]}],stale:false}),request:async(_url,{body,timeoutMs})=>{assert.deepEqual(body.p_fixture_ids,[id]);assert.equal(timeoutMs,3000);return [{fixture:latest,checked_at:stamp}];}});
 const listing={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({url:'/api/match-centre?view=all-sports&membership=everything&range=today'},listing);assert.equal(listing.code,200);assert.equal(listing.body.events.length,1);const mounted=listing.body.events[0];
 const reply={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({url:'/api/match-centre?view=all-sports&ids='+id},reply);assert.equal(reply.code,200);
 if(replay){assert.equal(JSON.stringify(reply.body.events),JSON.stringify(replay.selected.events));assert.equal(JSON.stringify(reply.body.fixtures),JSON.stringify(replay.selected.fixtures));assert.equal(JSON.stringify(mounted),JSON.stringify(replay.published),'Empty global sources retain the exact published input shape');}
 for(const mode of ['compact','opened','off','strict']){
  const card=scoreElement('article'),control=scoreElement('button'),head=scoreElement('head'),qualifier=scoreElement('small'),track={dataset:{overlapGroup:'retained'},scrollLeft:189};let replacements=0,reads=0;
  const opened=mode!=='compact';card.className=opened?'event-card feed-fixture is-opened':'event-card is-minimised-row';card.dataset.cardMode='schedule';card.dataset.cardState=opened?'opened':'compact';control.className=opened?'event-card-disclosure':'minimised-card-summary';card.append(control);
  const slot={dataset:{sportsId:id},isConnected:true,getBoundingClientRect:()=>({top:200,bottom:400,left:189,right:366}),querySelector:s=>s===':scope > .as-qualifier'?qualifier:s==='.event-card'?card:card.querySelector(s),querySelectorAll:()=>[control],prepend(){throw Error('The existing qualifier should be patched');}};control.closest=()=>slot;control.focus=()=>{};
  const body={querySelectorAll:s=>s==='[data-overlap-group]'?[track]:[slot],querySelector:()=>slot,replaceChildren(){replacements++;throw Error('Selected refresh detached the mounted card/track');}};
  const context={console,Date,Promise,Map,Set,URL,URLSearchParams,AbortController,AbortSignal,activeTab:'match-centre',innerWidth:390,innerHeight:844,scrollY:0,scrollBy(){},stickyFeedChromeHeight:()=>0,CSS:{escape:v=>v},results:mode!=='off',strict:mode==='strict',NOTHINGSPORTS_ALL_SPORTS:model,NOTHINGSPORTS_MATCH_CENTRE:match,NOTHINGSPORTS_FIXTURE_IDENTITY:require('../config/fixture-identity'),NOTHINGSPORTS_FEED_CARD_PRESENTATION:{displayLabel:(_id,label)=>label},profileFixtureEvents:new Map([[id,base]]),serverSyncClient:{sessionSubject:()=> 'one'},cardIdentityParticipants:()=>base.participants,queueLiveFixtureSnapshot(){throw Error('No parallel Feed poller');},
   document:{hidden:false,activeElement:control,getElementById:()=>({}),createElement:scoreElement,head,querySelector:s=>head.querySelector(s)},isSpoilerVisible:()=>context.results&&!context.strict,fetch:async(url,options)=>{assert.equal(url,'/api/match-centre?view=all-sports&ids='+encodeURIComponent(id));assert.equal(options.method||'GET','GET');reads++;return {ok:true,json:async()=>reply.body};},buildEventCard(){throw Error('Selected refresh rebuilt the mounted card');},syncElementAttributes(){},buildCompactCardSummary:event=>{const row=scoreElement('button');row.append(event.scoreCheckedAt);return row;}};
  const shell=fs.readFileSync('index.html','utf8'),metaStart=shell.indexOf('function sportMetaForEvent('),metaEnd=shell.indexOf('\n}',metaStart)+2;assert(metaStart>=0&&metaEnd>metaStart);context.SPORT_META={tennis:{label:'Tennis'}};
  vm.createContext(context);vm.runInContext(shell.slice(metaStart,metaEnd),context);const compact=fs.readFileSync('config/venue-panel-ui.js','utf8').match(/function refreshMinimisedCard\(card,ev\)\{[\s\S]*?\n\}/);assert(compact);vm.runInContext(compact[0],context);
  vm.runInContext(fs.readFileSync('config/feed-live-scores.js','utf8'),context);vm.runInContext(fs.readFileSync('config/feed-live-score-loader.js','utf8'),context);context.installFeedLiveScore=(...args)=>context.NOTHINGSPORTS_FEED_SCORE_UI.install(...args);
  const source=fs.readFileSync('assets/js/all-sports-ui.source.js','utf8'),seam='return {start,stop,render,visibility};';assert.equal(source.split(seam).length,2);
  vm.runInContext(source.replace(seam,'return {start,stop,render,visibility,poll,state,attach:(host,open)=>{chrome=host;expanded=open;chrome.layout=layoutKey(model().groups(model().select(state().events,state().window),state().window));},patchLayout:events=>{const days=model().groups(model().select(events,state().window),state().window);return patchCards(days,layoutKey(days));}};'),context);
  const view=context.createAllSportsView({active:()=>true,owner:()=> 'one'});view.state().events=[mounted];view.state().complete=true;view.attach({root:{isConnected:true},body,refresh:{},notice:{},bounds:{},ranges:{querySelectorAll:()=>[]},range:'today',restoringScroll:false},opened?id:null);
  const window=JSON.stringify(view.state().window);await view.poll();assert.equal(replacements,0,mode+' preserves the interactive surface');assert.equal(track.scrollLeft,189);assert.equal(card.children.includes(control),true);assert.equal(context.document.activeElement,control);assert.equal(reads,1);assert.equal(JSON.stringify(view.state().window),window);
  const current=context.profileFixtureEvents.get(id);assert.equal(current.scoreCheckedAt,stamp);assert.equal(current.statusCheckedAt,stamp);assert.equal(current.score.games.home,latest.games.home);assert.equal(current.sourceCheckedAt,base.sourceCheckedAt);
  if(!opened)assert.equal(control.textContent,stamp,'Actual shared compact lifecycle receives the fresh observation without replacing its button');
  else if(mode==='opened')assert.match(card.querySelector('.feed-live-score').textContent,new RegExp('6–4.*Games '+latest.games.home+'–1'));
  else assert.equal(card.querySelector('.feed-live-score'),null,'Results OFF/strict still hide fresh scores');
  assert.equal(view.patchLayout([{...current,venue:'Corrected venue'}]),false,'Changed static facts require the existing full render');assert.equal(view.patchLayout([{...current,status:'completed'}]),false,'A terminal membership change cannot be hidden by in-place score patching');
  assert.equal(view.patchLayout([{...current,manualEstimateHeld:true}]),false,'A real reader failure flag change is not ignored');
  delete context.SPORT_META.tennis;assert.equal(view.patchLayout([{...current,sport:'Unrecognised code'}]),false,'Actual sport-label fallback remains a renderer input');
 }
 assert.equal(JSON.stringify(base),original,'Mounted refresh cannot alter the source-owned original');
}
async function capturedFirstSelection(){
 const replay=require('./fixtures/all-sports-first-selected-native-20261024.json'),original=JSON.stringify(replay),RealDate=Date;
 assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync('scripts/validate-all-sports-view-browser.js')).digest('hex'),replay.harnessSha256,'The captured scenario remains bound to the unchanged native harness');
 const now=RealDate.parse(replay.now);global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 try{await selectedCardsStayMounted(replay);}finally{global.Date=RealDate;}
 assert.equal(JSON.stringify(replay),original,'The exact captured clocks/inputs stay immutable');
}
async function selectedStaticFactsRefresh(){
 // Keep the fixture, handler and real controller on the same Sydney test day.
 const RealDate=Date,now=RealDate.parse('2026-10-28T12:00:00+11:00');
 global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 try{
 const stamp=new Date(now-1000).toISOString(),id='fixture:tennis:static-refresh';
 const initial={id,eventId:id,key:'tennis',name:'Home v Away',competitionName:'Native Masters',tour:'ATP',tournamentLevel:'ATP1000',gender:'men',format:'Singles',matchFormat:'Singles',roundLabel:'Round 1',round:'R1',stage:'Singles',date:model.dayKey(now),startTimeUtc:new Date(now+3600000).toISOString(),status:'upcoming',displayTimeLabel:'Original schedule note',fixtureObservationSchema:'fixture-observations.v1',statusCheckedAt:stamp,scoreCheckedAt:stamp,sourceCheckedAt:stamp,sourceUrl:'https://organiser.example/fixture',homeParticipantId:'home',awayParticipantId:'away',sets:[{home:6,away:4}],games:{home:2,away:1}};
 const cases=[
  ['format',{format:'Doubles'},'live','.fixture-kind',/Men’s Doubles/],
  ['matchFormat',{matchFormat:'Doubles'},'upcoming','.fixture-kind',/Men’s Doubles/],
  ['gender',{gender:'women'},'live','.fixture-kind',/Women’s Singles/],
  ['tour',{tour:'WTA'},'upcoming','.tennis-fixture-competition',/WTA1000/],
  ['tournamentLevel',{tournamentLevel:'ATP500'},'live','.tennis-fixture-competition',/ATP500/],
  ['timePrecision',{timePrecision:'not-before'},'upcoming','.event-date-chip',/NOT BEFORE/],
  ['displayTimeLabel',{displayTimeLabel:'Corrected schedule note'},'upcoming','.event-date-chip',/Corrected schedule note/],
  ['roundLabel',{roundLabel:'Round 2'},'live','.tennis-fixture-round',/Round 2/],
  ['round',{round:'R2'},'live'],['stage',{stage:'Doubles'},'live','.fixture-kind',/Men’s Doubles/],
  ['unknown input',{futurePresentation:{label:'New context',nested:{version:2}}},'live'],
  ['unknown nested shape',{futurePresentation:{label:'Existing context',nested:{version:2,unrecognised:true}}},'live'],
  ['scheduled score only',{games:{home:3,away:1}},'upcoming']
 ];
 const shared=fs.readFileSync('config/venue-panel-ui.js','utf8'),shell=fs.readFileSync('index.html','utf8');
 const readFunction=(source,name)=>{const start=source.indexOf('function '+name+'('),end=source.indexOf('\n}',start)+2;assert(start>=0&&end>start,name+' must exist in the actual renderer');return source.slice(start,end);};
 for(const [name,change,status,selector,expected] of cases){
  const base={...initial,status,...(status==='live'?{startTimeUtc:new Date(now-3600000).toISOString()}:{}),...(name==='unknown nested shape'?{futurePresentation:{label:'Existing context',nested:{version:2}}}:{})},latest={...base,...change},original=JSON.stringify(base);let reads=0,replacements=0,built=[];
  const handler=require('../lib/match-centre-handler').createMatchCentreHandler({enabled:()=>true,published:()=>[base],clock:()=>now,snapshotRead:async()=>({sources:[{checked_at:stamp,fixtures:[base]}],stale:false}),request:async(_url,{body,timeoutMs})=>{assert.deepEqual(body.p_fixture_ids,[id]);assert.equal(timeoutMs,3000);return [{fixture:latest,checked_at:stamp}];}});
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}}),listing=response(),selected=response();
  await handler({url:'/api/match-centre?view=all-sports&membership=everything&range=today'},listing);await handler({url:'/api/match-centre?view=all-sports&ids='+id},selected);assert.equal(listing.code,200);assert.equal(selected.code,200);assert.equal(listing.body.events.length,1);
  // The real controller consumes real API replies and shared format, timing,
  // tennis context and essentials builders. Artwork/actions/native DOM are hosts.
  let contents=[];const qualifier=scoreElement('small'),track={dataset:{overlapGroup:'retained'},scrollLeft:189};
  const slot={dataset:{sportsId:id},isConnected:true,getBoundingClientRect:()=>({top:200,bottom:400,left:189,right:366}),querySelector:s=>s===':scope > .as-qualifier'?qualifier:s==='.event-card'?contents[0]:null};
  const body={querySelectorAll:s=>s==='[data-overlap-group]'?[track]:[slot],querySelector:()=>slot,replaceChildren(...nodes){replacements++;contents=nodes;}};
  const context={console,Date,Promise,Map,Set,URL,URLSearchParams,AbortController,AbortSignal,activeTab:'match-centre',innerWidth:390,innerHeight:844,scrollY:0,scrollBy(){},requestAnimationFrame(){},stickyFeedChromeHeight:()=>0,CSS:{escape:v=>v},NOTHINGSPORTS_ALL_SPORTS:model,NOTHINGSPORTS_MATCH_CENTRE:match,NOTHINGSPORTS_FIXTURE_IDENTITY:require('../config/fixture-identity'),NOTHINGSPORTS_CARD_TIMING:require('../config/card-timing'),NOTHINGSPORTS_FIXTURE_LABELS:require('../config/fixture-labels'),nowAEST:()=>new Date(now),FOLLOW_FIRST:{stageLabel:e=>e.roundLabel||e.round||e.stage||''},
   profileFixtureEvents:new Map(),document:{hidden:false,activeElement:null,getElementById:()=>({}),createElement:scoreElement},fetch:async(url,options)=>{assert.equal(url,'/api/match-centre?view=all-sports&ids='+encodeURIComponent(id));assert.equal(options.method||'GET','GET');reads++;return {ok:true,json:async()=>selected.body};},installFeedLiveScore(){},eventDateLabel:e=>e.date,eventLocationLabel:()=>'',fmtTime12:v=>v,buildEventTimingStateChip:()=>null,appendEventQuickActions(){},renderEventTitleIdentity:(node,e,title)=>{node.textContent=title;}};
  vm.createContext(context);
  for(const fn of ['compactFixtureFormat','buildTennisFixtureContext','buildFixtureTimingBadge','buildFixtureTimingGroup','buildFixtureCardEssentials'])vm.runInContext(readFunction(shared,fn),context);
  context.SPORT_META={tennis:{label:'Tennis'}};for(const fn of ['sportMetaForEvent','cricketPlayingFormatForEvent','eventTimeLabel'])vm.runInContext(readFunction(shell,fn),context);
  context.buildEventCard=(event,options)=>{built.push(event);context.profileFixtureEvents.set(id,event);const card=scoreElement('article');card.className='event-card is-opened';card.dataset.cardMode='schedule';card.dataset.cardState='opened';const format=scoreElement('span');format.className='fixture-kind';format.textContent=context.compactFixtureFormat(event);card.append(format,context.buildFixtureTimingGroup(event),context.buildFixtureCardEssentials(event,{options,displayTitle:event.name,status:event.status,state:'opened',meta:{label:'Tennis'}}));return card;};
  const mounted=listing.body.events[0];contents=[context.buildEventCard(mounted,{mode:'schedule',cardState:'opened'})];const before=selector?contents[0].querySelector(selector)?.textContent:null;built=[];
  const source=fs.readFileSync('assets/js/all-sports-ui.source.js','utf8'),seam='return {start,stop,render,visibility};';assert.equal(source.split(seam).length,2);
  vm.runInContext(source.replace(seam,'return {start,stop,render,visibility,poll,state,attach:host=>{chrome=host;expanded="'+id+'";chrome.layout=layoutKey(model().groups(model().select(state().events,state().window),state().window));}};'),context);
  const view=context.createAllSportsView({active:()=>true,owner:()=> 'one'});view.state().events=[mounted];view.state().complete=true;view.attach({root:{isConnected:true},body,refresh:{},notice:{},bounds:{},ranges:{querySelectorAll:()=>[]},range:'today',restoringScroll:false});const window=JSON.stringify(view.state().window);await view.poll();
  assert.equal(replacements,1,name+' must immediately use the full renderer');assert.equal(built.length,1);assert.equal(reads,1);assert.equal(JSON.stringify(view.state().window),window);assert.equal(track.scrollLeft,189);assert.equal(JSON.stringify(base),original);
  for(const [key,value] of Object.entries(change))assert.equal(JSON.stringify(built[0][key]),JSON.stringify(value),name+' must reach the shared renderer unchanged');
  for(const key of ['scoreCheckedAt','statusCheckedAt','sourceCheckedAt'])assert.equal(built[0][key],stamp,name+' is a static-only receipt, without advancing '+key);
  if(selector){const node=contents.map(section=>section.querySelector(selector)).find(Boolean);assert(node,name+' mounts the actual shared output');assert.match(node.textContent,expected);assert.notEqual(node.textContent,before,name+' must not leave the previous visible value');}
 }
 }finally{global.Date=RealDate;}
}
async function todayMidnightBoundary(){
 const RealDate=Date,now=RealDate.parse('2026-10-28T23:30:00+11:00');
 global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 try{
  const fixtures=[
   ['before-midnight','2026-10-28','2026-10-28T23:59:59.999+11:00'],
   ['at-midnight','2026-10-29','2026-10-29T00:00:00+11:00'],
   ['next-day','2026-10-29','2026-10-29T00:30:00+11:00']
  ].map(([suffix,date,startTimeUtc])=>({id:'fixture:tennis:'+suffix,key:'tennis',name:'Home v Away',date,startTimeUtc,status:'upcoming'})),original=JSON.stringify(fixtures);
  const handler=require('../lib/match-centre-handler').createMatchCentreHandler({enabled:()=>true,published:()=>fixtures,clock:()=>now,snapshotRead:async options=>{assert.equal(options.scope,'global');assert.equal(options.now,now);return {sources:[],stale:false};},request:async()=>{throw Error('Membership must not add a selected score read');}});
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}}),today=response(),rolling=response();
  await handler({url:'/api/match-centre?view=all-sports&membership=everything&range=today'},today);
  await handler({url:'/api/match-centre?view=all-sports&membership=everything&range=24'},rolling);
  assert.equal(today.code,200);assert.equal(rolling.code,200);
  assert.equal(today.body.window.end,RealDate.parse('2026-10-29T00:00:00+11:00'));
  assert.deepEqual(today.body.events.map(e=>e.id),['fixture:tennis:before-midnight'],'Today excludes fixtures at midnight and later, even when they are less than an hour away');
  assert.deepEqual(rolling.body.events.map(e=>e.id),['fixture:tennis:before-midnight','fixture:tennis:at-midnight','fixture:tennis:next-day'],'The separate rolling range can include the same next-day fixtures');
  assert.equal(JSON.stringify(fixtures),original,'Boundary checks must not change published fixture facts');
 }finally{global.Date=RealDate;}
}
async function run(){let failed=false;for(const [name,test] of [['pending module re-entry',reentry],['current owner/failure controls',ownerAndFailure],['public Followed composition versus mutation guard',followedCompositionGuard],['queued Followed hydration generation fence',queuedHydrationFence],['native request invocation/network pairing',requestPairingGuard],['retained live-only degradation',retainedFreshness],['reverse-order alias source winner',reverseAliasBridge],['late selected observation',lateSelectedObservation],['Match Centre Results ON/OFF/strict',matchCentreScores],['selected refresh retains mounted card lifecycle',selectedCardsStayMounted],['captured empty-source first selection retains card',capturedFirstSelection],['selected static facts and unknown shapes refresh',selectedStaticFactsRefresh],['Today excludes midnight and next-day fixtures',todayMidnightBoundary],['render-error fallback keeps local choice isolated',require('./validate-all-sports-card-fallback')]]){try{await test();console.log('PASS '+name);}catch(error){failed=true;console.error('FAIL '+name+': '+error.message);}}if(failed)throw Error('All Sports review regressions failed');}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports=run;
