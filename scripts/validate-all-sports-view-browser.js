'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const sports=require('../config/all-sports-view'),match=require('../config/match-centre');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const root=path.resolve(__dirname,'..'),now=Date.parse('2026-10-24T04:00:00Z'),stamp=new Date(now).toISOString();
const fixtures=Array.from({length:132},(_,i)=>({id:'fixture:nrl:all-sports-'+i,eventId:'fixture:nrl:all-sports-'+i,key:'nrl',sport:'NRL',competitionName:'NRL',name:'Panthers '+i+' v Storm '+i,date:'2026-10-24',status:'upcoming',startTimeUtc:new Date(now+3600000+i*1000).toISOString(),homeParticipantId:'team:nrl:sports-home-'+i,awayParticipantId:'team:nrl:sports-away-'+i,participantIds:['team:nrl:sports-home-'+i,'team:nrl:sports-away-'+i],sourceCheckedAt:stamp,sourceUrl:'https://organiser.example/schedule'}));
fixtures.unshift({...fixtures[0],id:'fixture:nrl:underway',eventId:'fixture:nrl:underway',startTimeUtc:new Date(now-3600000).toISOString(),status:'live',statusCheckedAt:stamp,scoreCheckedAt:stamp,homeScore:321,awayScore:123});
fixtures.push({...fixtures[1],id:'fixture:nrl:tbc',eventId:'fixture:nrl:tbc',startTimeUtc:null,timePrecision:'date-only'},{...fixtures[1],id:'fixture:nrl:tomorrow',eventId:'fixture:nrl:tomorrow',startTimeUtc:new Date(now+12*3600000).toISOString(),date:'2026-10-25'},{...fixtures[1],id:'fixture:nrl:later',eventId:'fixture:nrl:later',startTimeUtc:new Date(now+30*3600000).toISOString(),date:'2026-10-25'});
let fail=false,partial=false,requests=[],scenario;
function resetScenario(){fail=false;partial=false;requests=[];scenario={published:fixtures,sources:[],selected:null,clock:now,scoreGate:null,scoreFail:false};}
resetScenario();
const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>scenario.clock,published:()=>scenario.published,snapshotRead:async()=>{if(fail)throw Error('mock source unavailable');return {stale:false,readAt:scenario.clock,sources:scenario.sources};},request:async(_path,options)=>{
 assert(options.body.p_fixture_ids.length<=60);assert.equal(options.timeoutMs,3000);
 if(scenario.scoreGate&&(!scenario.scoreGate.ids||options.body.p_fixture_ids.some(id=>scenario.scoreGate.ids.includes(id)))){scenario.scoreGate.entered.resolve();await scenario.scoreGate.release.promise;}
 if(scenario.scoreFail)throw Error('mock score source unavailable');
 return (scenario.selected||scenario.published).filter(e=>options.body.p_fixture_ids.includes(e.id)).map(fixture=>({fixture,checked_at:fixture.scoreCheckedAt||stamp}));
}});
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};};
async function reached(page,gate){
 // Match Playwright's existing default 30-second wait and stop on page close;
 // a missing request cannot leave a host-side promise alive past the watchdog.
 let timer,closed;
 try{await Promise.race([gate.promise,new Promise((_,reject)=>{closed=()=>reject(Error('Page closed before delayed transport was reached'));page.once('close',closed);timer=setTimeout(()=>reject(Error('Delayed transport was not reached')),30000);})]);}
 finally{clearTimeout(timer);page.off('close',closed);}
}
function nativeFixture(key='nrl',suffix='native',facts={}){
 const id=`fixture:${key}:${suffix}`,home=`team:${key}:${suffix}-home`,away=`team:${key}:${suffix}-away`;
 return {...fixtures[0],id,eventId:id,key,sport:key.toUpperCase(),competitionName:key==='tennis'?'Native ATP Masters':key.toUpperCase(),name:'Native Home v Native Away',homeParticipantId:home,awayParticipantId:away,participantIds:[home,away],participants:[{id:home,displayName:'Native Home'},{id:away,displayName:'Native Away'}],status:'live',startTimeUtc:new Date(now-3600000).toISOString(),statusCheckedAt:stamp,scoreCheckedAt:stamp,homeScore:18,awayScore:12,...facts};
}
async function personalState(page){return page.evaluate(()=>({preferences:JSON.stringify(userPreferences),actions:JSON.stringify(eventActions),states:JSON.stringify(cardViewStates),spoilers:JSON.stringify(eventSpoilerState)}));}
async function waitForCards(page,count){await page.waitForFunction(count=>document.querySelectorAll('[data-sports-id]').length===count&&document.querySelector('[aria-label="Refresh All Sports View"]')?.disabled===false,count);}
async function enterAllSports(page,count){await page.getByRole('tab',{name:'All Sports',exact:true}).click();await waitForCards(page,count);}
async function setOwner(page,owner){
 // Use the real custom auth client's storage/lifetime listener. These are
 // disposable unsigned test tokens, never hosted authentication evidence.
 await page.evaluate(owner=>{
  const key='ns_auth_persistent_session_v1',oldValue=localStorage.getItem(key),accessToken='e30.'+btoa(JSON.stringify({sub:owner}))+'.disposable';
  const newValue=JSON.stringify({accessToken,refreshToken:'disposable-native-refresh',expiresAt:Date.now()+3600000});
  localStorage.setItem(key,newValue);dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue,storageArea:localStorage,url:location.href}));
  renderMatchCentre();
 },owner);
 assert.equal(await page.evaluate(()=>serverSyncClient.sessionSubject()),owner);
}
async function assertGuards(page,saved){
 const current=await personalState(page);assert.deepEqual(current.actions,saved.actions);assert.deepEqual(current.states,saved.states);assert.deepEqual(current.spoilers,saved.spoilers);
 assert.deepEqual(await page.evaluate(()=>qaCardWrites),[],'Native grid work must not write personal card/account/engagement state');
 assert.equal(await page.evaluate(()=>qaFeedPolls),0,'Match Centre must not acquire the Feed poller');
}
function observeApiFetch(){
 // Observe invocation, not the later Playwright request-event delivery. Keep
 // the real fetch and transport intact, including errors and cancellation.
 const original=globalThis.fetch;globalThis.qaApiInvocations=[];
 globalThis.fetch=function(input,init){
  try{
   const url=new URL(typeof input==='string'||input instanceof URL?String(input):input?.url,location.href),method=String(init?.method||input?.method||'GET').toUpperCase();
   if(url.origin===location.origin&&url.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(method)){
    const headers=new Headers(init?.headers||input?.headers),entry={url:url.pathname+url.search,method,body:typeof init?.body==='string'?init.body:null,contentType:headers.get('content-type'),authorization:headers.has('authorization'),initiator:new Error().stack};
    try{entry.tab=activeTab;entry.view=document.querySelector('#listView .mc-membership-tabs [role="tab"][aria-selected="true"]')?.textContent;entry.owner=serverSyncClient?.sessionSubject()||'public';entry.preferences=JSON.stringify(userPreferences);entry.actions=JSON.stringify(eventActions);}catch{/* An unknown caller remains a failed guard. */}
    qaApiInvocations.push(entry);
   }
  }catch{/* Observation cannot change the real fetch; unmatched calls fail. */}
  return original.apply(this,arguments);
 };
}
function publicFollowedComposition(request,invocation){
 if(!invocation||request.method!=='POST'||invocation.method!==request.method||invocation.url!==request.url||invocation.body!==request.body||request.authorization||invocation.authorization||request.contentType!=='application/json'||invocation.contentType!=='application/json')return false;
 const url=new URL(request.url,'http://native.local');
 if(url.pathname!=='/api/feed'||url.searchParams.size!==3||url.searchParams.get('scope')!=='match-centre'||url.searchParams.get('limit')!=='50'||url.searchParams.get('cursor')!=='0'||invocation.tab!=='match-centre'||invocation.view!=='Followed'||!/(?:^|\/)match-centre-ui(?:\.source)?\.js(?:[?:]|$)/m.test(invocation.initiator||''))return false;
 if(typeof request.body!=='string'||Buffer.byteLength(request.body)>131072)return false;
 try{const body=JSON.parse(request.body);return Boolean(Object.keys(body).sort().join(',')==='eventUserState,preferences'&&body.preferences&&typeof body.preferences==='object'&&!Array.isArray(body.preferences)&&body.eventUserState&&typeof body.eventUserState==='object'&&!Array.isArray(body.eventUserState)&&JSON.stringify(body.preferences)===invocation.preferences&&JSON.stringify(body.eventUserState)===invocation.actions);}catch{return false;}
}
function mutationRequests(requests,invocations,readBudget,readReceipts=[]){
 const pending=requests.map((request,index)=>({request,index})),failures=[],corroborated=[];let reads=0;
 // Every invocation is judged and counted before network pairing. A missing
 // or delayed network event cannot erase an invalid or excess invocation.
 const audits=invocations.map((call,index)=>{const reasons=[];if(!publicFollowedComposition(call,call))reasons.push('invalid-invocation');else if(++reads>readBudget)reasons.push('read-budget-exceeded');return {call,index,reasons};});
 for(const {call,index:invocationIndex,reasons} of audits){
  const match=pending.findIndex(({request})=>['url','method','body','contentType','authorization'].every(key=>request[key]===call?.[key]));
  const network=match<0?null:pending.splice(match,1)[0];
  if(!network)reasons.push('uncorroborated-invocation');
  if(reasons.length)failures.push({reasons,invocationIndex,url:call?.url,method:call?.method,invocation:call?{tab:call.tab,view:call.view,owner:call.owner,initiator:call.initiator}:null});
  else corroborated.push({invocationIndex,networkIndex:network.index,url:call.url,tab:call.tab,view:call.view,owner:call.owner,unchangedInputs:true,initiator:call.initiator});
 }
 for(const {request,index} of pending)failures.push({reasons:['unmatched-network-request'],networkIndex:index,...request,body:undefined});
 // Do not grant even a partial waiver when another invocation is invalid.
 if(!failures.length)readReceipts.push(...corroborated);
 return failures;
}
function observeResultsInteraction({id}){
 const trace={id,phase:'entry',events:[],dropped:0},tokens=new WeakMap();let serial=0,sequence=0;
 const token=node=>{if(!node)return null;if(!tokens.has(node))tokens.set(node,++serial);return tokens.get(node);};
 const record=(type,detail={})=>{if(trace.events.length===160){trace.events.shift();trace.dropped++;}trace.events.push({sequence:++sequence,at:performance.now(),phase:trace.phase,type,...detail});};
 const slot=()=>document.querySelector('[data-sports-id="'+CSS.escape(id)+'"]');
 const state=node=>{const card=node?.querySelector('.event-card');return {connected:Boolean(node?.isConnected),expanded:node?.classList.contains('as-expanded'),cardState:card?.dataset.cardState,mode:card?.dataset.cardMode,summary:token(node?.querySelector('.minimised-card-summary')),scoreNodes:node?.querySelectorAll('.feed-live-score').length};};
 for(const type of ['pointerdown','mousedown','pointerup','mouseup','click'])document.addEventListener(type,event=>{const target=event.target,track=target.closest?.('.as-track'),row=target.closest?.('[data-sports-id]');if(row?.dataset.sportsId!==id&&!track?.querySelector('[data-sports-id="'+CSS.escape(id)+'"]'))return;record(type,{id:row?.dataset.sportsId||null,target:token(target.closest?.('.minimised-card-summary,.event-card-disclosure')||target),targetClass:target.className,trusted:event.isTrusted,...state(row?.dataset.sportsId===id?row:slot())});},{capture:true,passive:true});
 document.addEventListener('scroll',event=>{const track=event.target;if(track.matches?.('.as-track')&&track.querySelector('[data-sports-id="'+CSS.escape(id)+'"]'))record('scroll',{left:track.scrollLeft,width:track.clientWidth,...state(slot())});},{capture:true,passive:true});
 new MutationObserver(records=>{for(const mutation of records)for(const [type,nodes] of [['removed',mutation.removedNodes],['added',mutation.addedNodes]])for(const node of nodes){if(node.nodeType!==1)continue;for(const row of [node,...node.querySelectorAll('[data-sports-id]')])if(row.dataset.sportsId===id)record(type,state(row));}}).observe(document.getElementById('listView'),{childList:true,subtree:true});
 const original=globalThis.fetch;
 globalThis.fetch=function(input,init){const result=original.apply(this,arguments);try{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.pathname==='/api/match-centre'&&(url.searchParams.get('ids')||'').split(',').includes(id)){record('selected-request');void result.then(response=>record('selected-response',{status:response.status}),error=>record('selected-error',{name:error.name}));}}catch{}return result;};
 globalThis.qaResultsTrace=trace;
 globalThis.qaResultsSnapshot=()=>{const row=slot(),event=profileFixtureEvents.get(id),score=row?.querySelector('.feed-live-score'),rect=score?.getBoundingClientRect(),style=score&&getComputedStyle(score);return {trace,state:state(row),privacy:{results:userPreferences.showSpoilers,policy:userPreferences.feedControls.spoilers,visible:event&&isSpoilerVisible(event)},event:event&&{id:event.id,key:event.key,status:event.status,statusCheckedAt:event.statusCheckedAt,scoreCheckedAt:event.scoreCheckedAt,stale:event.stale,sets:event.sets,games:event.games,score:event.score},model:event&&{cardStatus:getEventStatus(event),supported:NOTHINGSPORTS_ALL_SPORTS.supported(event),liveState:NOTHINGSPORTS_MATCH_CENTRE.liveState(event),presentation:globalThis.NOTHINGSPORTS_FEED_LIVE_SCORES?.presentation(event,{resultsOn:isSpoilerVisible(event)})},renderer:{loader:Boolean(globalThis.NOTHINGSPORTS_FEED_SCORE_UI),scores:Boolean(globalThis.NOTHINGSPORTS_FEED_LIVE_SCORES),resultLines:row?.querySelectorAll('.card-result-line').length,tables:row?.querySelectorAll('.tennis-set-table').length},score:score&&{text:score.textContent,display:style.display,visibility:style.visibility,hidden:score.hidden,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}}};};
}
async function nativeRepairs(browser,base,engine){
 const cases=[
  ['latest visit and current owner/privacy',async(page,cleanup)=>{
   const held=deferred(),release=deferred();let downloads=0;cleanup.push(()=>release.resolve());
   scenario.published=[nativeFixture()];
   await page.route('**/assets/js/all-sports-ui.js*',async route=>{downloads++;held.resolve();await release.promise;await route.continue();});
   await page.evaluate(()=>{globalThis.qaMountOwners=[];new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node.matches('.all-sports-view'))qaMountOwners.push(serverSyncClient.sessionSubject()||'public');}).observe(document.getElementById('listView'),{childList:true,subtree:true});});
   await page.getByRole('tab',{name:'All Sports',exact:true}).click();await reached(page,held);
   await page.getByRole('button',{name:'Back to Match Centre',exact:true}).click();
   await page.getByRole('tab',{name:'All Sports',exact:true}).click();
   await setOwner(page,'native-owner-one');await setOwner(page,'native-owner-two');
   await page.evaluate(()=>{userPreferences.showSpoilers=false;userPreferences.feedControls.spoilers='strict';});
   const saved=await personalState(page);assert.equal(await page.locator('.all-sports-view').count(),0);assert.equal(downloads,1);
   release.resolve();await waitForCards(page,1);
   await page.locator('.minimised-card-summary').click();await page.locator('.as-expanded').waitFor();
   assert.equal(await page.locator('.feed-live-score').count(),0);assert(!/Native Home 18|Native Away 12/.test(await page.locator('.as-expanded').innerText()));
   assert.deepEqual(await page.evaluate(()=>qaMountOwners),['native-owner-two']);
   assert.equal(await page.evaluate(()=>disposableStore.initial('all-sports:v1:native-owner-one:today',null)),null);
   assert.equal(await page.evaluate(()=>disposableStore.initial('all-sports:v1:public:today',null)),null);
   assert(await page.evaluate(()=>Boolean(disposableStore.initial('all-sports:v1:native-owner-two:today',null))));
   assert.equal(downloads,1);await assertGuards(page,saved);assert.equal((await personalState(page)).preferences,saved.preferences);
  }],
  ['failed optional module, deliberate retry and stale exit',async(page,cleanup)=>{
   scenario.published=[nativeFixture()];const held=deferred(),release=deferred();let downloads=0;cleanup.push(()=>release.resolve());
   await page.route('**/assets/js/all-sports-ui.js*',async route=>{if(++downloads===1){await route.fulfill({status:503,body:''});return;}held.resolve();await release.promise;await route.continue();});
   const saved=await personalState(page);await page.getByRole('tab',{name:'All Sports',exact:true}).click();
   await page.getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(downloads,1);assert.equal(await page.locator('.all-sports-view').count(),0);
   assert(await page.getByRole('button',{name:'Back to Match Centre',exact:true}).isVisible());
   await page.getByRole('button',{name:'Retry',exact:true}).click();await reached(page,held);
   await page.getByRole('button',{name:'Back to Match Centre',exact:true}).click();release.resolve();
   await page.waitForFunction(()=>typeof createAllSportsView==='function');
   assert.equal(await page.locator('.all-sports-view').count(),0);assert.equal(await page.getByRole('tab',{name:'Followed',exact:true}).getAttribute('aria-selected'),'true');
   await enterAllSports(page,1);assert.equal(downloads,2);await assertGuards(page,saved);assert.equal((await personalState(page)).preferences,saved.preferences);
  }],
  ['omitted source-only row in degraded complete union',async page=>{
   const live=nativeFixture('nrl','source-only',{fixtureObservationSchema:'fixture-observations.v1',sourceType:'official',sourceUrl:'https://official.example/native-live',scoreFactObservedAt:stamp,statusFactObservedAt:stamp});
   const ordinary=nativeFixture('nrl','static-only',{status:'upcoming',startTimeUtc:new Date(now+3600000).toISOString()});
   scenario.published=[ordinary];scenario.sources=[{source_id:'native-official',checked_at:stamp,fixtures:[live]}];scenario.selected=[live,ordinary];
   const original=JSON.stringify(live),saved=await personalState(page),selected=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/match-centre'&&new URL(r.url()).searchParams.has('ids'));await enterAllSports(page,2);
   await (await selected).finished();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.waitForFunction(()=>Boolean(disposableStore.initial('all-sports:v1:public:today',null)));
   const cache=await page.evaluate(()=>JSON.stringify(disposableStore.initial('all-sports:v1:public:today',null)));
   fail=true;scenario.scoreFail=true;await page.getByRole('button',{name:'Refresh All Sports View',exact:true}).click();await waitForCards(page,2);
   await page.waitForFunction(()=>document.querySelector('.as-notice')?.textContent.includes('Current updates are unavailable'));
   assert.match(await page.locator('[data-sports-id="'+live.id+'"] .as-qualifier').innerText(),/Awaiting update/);
   const actual=await page.evaluate(ids=>ids.map(id=>profileFixtureEvents.get(id)),[live.id,ordinary.id]);assert(actual.every(e=>e.stale===true),'Every member of a degraded retained union is stale');
   for(const field of ['id','status','statusCheckedAt','scoreCheckedAt','startTimeUtc','sourceUrl','sourceCheckedAt','scoreFactObservedAt','statusFactObservedAt'])assert.equal(actual[0][field],live[field],field+' remains source-owned');
   assert.equal(await page.evaluate(()=>JSON.stringify(disposableStore.initial('all-sports:v1:public:today',null))),cache,'A degraded union must preserve last-good cache bytes');
   assert.equal(JSON.stringify(live),original);await assertGuards(page,saved);assert.equal((await personalState(page)).preferences,saved.preferences);
  }],
  ['reverse alias bridge retains official facts',async page=>{
   const official=nativeFixture('nrl','official',{status:'upcoming',startTimeUtc:null,timePrecision:'date-only',sourceType:'official',sourceUrl:'https://official.example/native-fixture',name:'Official Native Fixture'});
   const reporting={...official,id:'fixture:nrl:reporting',eventId:'fixture:nrl:reporting',sourceType:'trusted-reporting',sourceUrl:'https://reporting.example/native-fixture',sourceCheckedAt:'2026-10-24T03:00:00Z',name:'Conflicting Reporting Fixture'};
   const bridge={...reporting,id:'fixture:nrl:bridge',eventId:'fixture:nrl:bridge',sourceEventIds:[official.id,reporting.id],name:'Alias Bridge Fixture'};
   const saved=await personalState(page),orders=[[reporting,official,bridge],[official,reporting,bridge]],before=JSON.stringify(orders);
   scenario.published=orders[0];await enterAllSports(page,1);
   for(const records of orders){
    scenario.published=records;await page.getByRole('button',{name:'Refresh All Sports View',exact:true}).click();await waitForCards(page,1);
    assert.equal(await page.locator('[data-sports-id="'+official.id+'"]').count(),1);
    const actual=await page.evaluate(id=>profileFixtureEvents.get(id),official.id);
    for(const field of ['id','eventId','name','sourceType','sourceUrl','sourceCheckedAt','status','startTimeUtc'])assert.equal(actual[field],official[field],field+' must come from the official row');
    assert.equal(await page.evaluate(records=>{const selected=NOTHINGSPORTS_ALL_SPORTS.unique(records);return selected.length===1&&selected[0]===records.find(e=>e.sourceType==='official');},records),true,'The actual browser model retains the official object in both bridge orders');
   }
   assert.equal(JSON.stringify(orders),before);await assertGuards(page,saved);assert.equal((await personalState(page)).preferences,saved.preferences);
  }],
  ['selected observation after fixed listing anchor',async(page,cleanup)=>{
   await page.setViewportSize({width:1280,height:844});
   const live=nativeFixture('nrl','fresh-after-anchor'),completed=nativeFixture('nrl','completed-after-anchor'),future=nativeFixture('nrl','future-after-anchor');
   scenario.published=[live,completed,future];const gate={entered:deferred(),release:deferred()};scenario.scoreGate=gate;cleanup.push(()=>gate.release.resolve());
   const saved=await personalState(page),listed=page.waitForResponse(r=>new URL(r.url()).searchParams.get('view')==='all-sports'&&new URL(r.url()).searchParams.get('cursor')==='0');await enterAllSports(page,3);await reached(page,gate.entered);
   const anchor=await (await listed).json();assert.equal(anchor.window.asOf,now);assert.equal(typeof anchor.revision,'string');
   const bounds=await page.locator('.as-window').innerText(),listing=requests.filter(u=>u.includes('view=all-sports')&&!u.includes('ids=')).length;
   const later=now+60000,lateStamp=new Date(later).toISOString();scenario.clock=later;
   scenario.selected=[{...live,statusCheckedAt:lateStamp,scoreCheckedAt:lateStamp,homeScore:24},{...completed,status:'completed',statusCheckedAt:lateStamp,scoreCheckedAt:lateStamp,completedAt:lateStamp},{...future,statusCheckedAt:new Date(later+60000).toISOString(),scoreCheckedAt:lateStamp}];
   const source=JSON.stringify(scenario.selected);await page.evaluate(later=>{qaNow=later;},later);
   const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/match-centre'&&new URL(r.url()).searchParams.has('ids'));gate.release.resolve();
   const observed=await (await response).json();assert(observed.events.some(e=>e.id===live.id&&e.statusCheckedAt===lateStamp));
   await page.waitForFunction(id=>document.querySelectorAll('[data-sports-id]').length===1&&document.querySelector('[data-sports-id="'+id+'"]'),live.id);
   assert.match(await page.locator('[data-sports-id="'+live.id+'"] .as-qualifier').innerText(),/^Underway$/);
   const actual=await page.evaluate(id=>profileFixtureEvents.get(id),live.id);assert.equal(actual.statusCheckedAt,lateStamp);assert.equal(actual.homeScore,24);
   assert.equal(await page.locator('.as-window').innerText(),bounds);assert.equal(requests.filter(u=>u.includes('view=all-sports')&&!u.includes('ids=')).length,listing,'Selected observations must not re-anchor or reload membership');
   assert.equal(await page.evaluate(({id,window})=>NOTHINGSPORTS_ALL_SPORTS.select([profileFixtureEvents.get(id)],window).length,{id:live.id,window:anchor.window}),1,'The browser model still admits the rendered live row against the original API anchor');
   assert.equal(JSON.stringify(scenario.selected),source);await assertGuards(page,saved);assert.equal((await personalState(page)).preferences,saved.preferences);
  }],
  ['mounted Results ON/OFF/strict and delayed score privacy',async(page,cleanup)=>{
   const entries=['nrl','afl','tennis'].map(key=>nativeFixture(key,'native-results',key==='tennis'?{tournamentLevel:'ATP1000',homeScore:null,awayScore:null,sets:[{home:6,away:4}],games:{home:2,away:1}}:{}));
   scenario.published=entries;const held=deferred(),release=deferred();cleanup.push(()=>release.resolve());let downloads=0;
   const tennis=entries[2];
   await page.evaluate(observeResultsInteraction,{id:tennis.id});
   await page.route('**/config/feed-live-scores.js*',async route=>{downloads++;held.resolve();await release.promise;await route.continue();});
   const saved=await personalState(page);await enterAllSports(page,3);
   const first=page.locator('[data-sports-id="'+entries[0].id+'"]');await first.locator('.minimised-card-summary').click();await reached(page,held);
   await page.evaluate(()=>{userPreferences.showSpoilers=false;userPreferences.feedControls.spoilers='strict';});release.resolve();
   await page.waitForFunction(()=>Boolean(globalThis.NOTHINGSPORTS_FEED_LIVE_SCORES));
   // Wait for the real loader's completion callbacks, without adding a sleep.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await first.locator('.feed-live-score').count(),0);assert(!/Native Home 18|Native Away 12/.test(await first.innerText()));
   await first.locator('.event-card-disclosure').click();await page.waitForFunction(()=>!document.querySelector('.as-expanded'));
   for(const event of entries){
    const slot=page.locator('[data-sports-id="'+event.id+'"]');
    await page.evaluate(key=>{userPreferences.showSpoilers=true;userPreferences.feedControls.spoilers='results_visible';qaResultsTrace.phase=key+':results-on';},event.key);
    try{
     await slot.locator('.minimised-card-summary').click();
     await slot.locator('.feed-live-score').waitFor();
    }catch(error){console.error(JSON.stringify({engine,regression:'tennis selected-read/input causal trace',diagnostics:await page.evaluate(()=>qaResultsSnapshot()).catch(failure=>({snapshotError:failure.message}))}));if(process.env.ALL_SPORTS_DIAGNOSTIC_DIR)await page.screenshot({path:path.join(process.env.ALL_SPORTS_DIAGNOSTIC_DIR,'tennis-'+engine+'-failure.png'),fullPage:false}).catch(()=>{});throw error;}
    assert.match(await slot.locator('.feed-live-score').innerText(),event.key==='tennis'?/6–4.*Games 2–1/s:/Native Home 18.*Native Away 12/s);
    assert.equal(await slot.locator('.event-card').getAttribute('data-card-mode'),'schedule');
    for(const strict of [false,true]){
     await page.evaluate(strict=>{userPreferences.showSpoilers=strict;userPreferences.feedControls.spoilers=strict?'strict':'results_visible';},strict);
     // Rebuild through the grid's own native disclosure path; no installer,
     // renderer, model or controller is replaced by the harness.
     await slot.locator('.event-card-disclosure').click();await slot.locator('.minimised-card-summary').click();
     assert.equal(await slot.locator('.feed-live-score').count(),0,strict?'Strict hides results even when Results ON':'Results OFF clears score detail');
     assert(!/Native Home 18|Native Away 12|6–4|Games 2–1/.test(await slot.innerText()));
    }
    await slot.locator('.event-card-disclosure').click();
   }
   console.log(JSON.stringify({engine,diagnostic:'partial passive tennis trace',diagnostics:await page.evaluate(()=>qaResultsSnapshot())}));assert.equal(downloads,1);await assertGuards(page,saved);
  }],
  ['selected refresh during a trusted disclosure press',async(page,cleanup)=>{
   const leading=[nativeFixture('afl','press-leading'),nativeFixture('nrl','press-leading')],tennis=nativeFixture('tennis','press-summary',{tournamentLevel:'ATP1000',homeScore:null,awayScore:null,sets:[{home:6,away:4}],games:{home:2,away:1}});
   scenario.published=[...leading,tennis];const gate={ids:[tennis.id],entered:deferred(),release:deferred()};scenario.scoreGate=gate;cleanup.push(()=>gate.release.resolve());
   await page.evaluate(observeResultsInteraction,{id:tennis.id});const saved=await personalState(page),original=JSON.stringify(tennis);let target=null,pressed=false,selected,pressState;
   try{
    await enterAllSports(page,3);
    await page.waitForFunction(ids=>ids.every(id=>Object.hasOwn(profileFixtureEvents.get(id)||{},'score')),leading.map(e=>e.id));
    assert.equal(requests.filter(value=>{const url=new URL(value,base);return (url.searchParams.get('ids')||'').split(',').includes(tennis.id);}).length,0,'The off-screen target has not yet been selected');
    const slot=page.locator('[data-sports-id="'+tennis.id+'"]');await slot.locator('.minimised-card-summary').scrollIntoViewIfNeeded();await reached(page,gate.entered);
    target=await slot.locator('.minimised-card-summary').elementHandle();assert(target);await target.waitForElementState('stable');const box=await target.boundingBox();assert(box);
    await page.evaluate(()=>{qaResultsTrace.phase='selected-response-during-pointer-press';});
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();pressed=true;
    const down=await page.evaluate(()=>qaResultsTrace.events.findLast(event=>event.type==='pointerdown'));
    assert(down?.trusted&&down.id===tennis.id&&down.cardState==='compact','The genuine pointer press began on this mounted compact summary');
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/match-centre'&&(new URL(r.url()).searchParams.get('ids')||'').split(',').includes(tennis.id));
    gate.release.resolve();const receipt=await response;selected=await receipt.json();await receipt.finished();
    assert.equal(selected.events.length,1);assert.equal(selected.events[0].id,tennis.id);assert.equal(selected.events[0].statusCheckedAt,tennis.statusCheckedAt);
    assert.equal(JSON.stringify(selected.fixtures[0].score.sets),JSON.stringify(tennis.sets));assert.equal(JSON.stringify(selected.fixtures[0].score.games),JSON.stringify(tennis.games));
    // This is the real controller's processed observation/render boundary,
    // rather than a timer, synthetic scroll or direct renderer invocation.
    await page.waitForFunction(id=>profileFixtureEvents.get(id)?.score?.sets?.length===1,tennis.id);
    pressState=await target.evaluate((node,id)=>({originalConnected:node.isConnected,currentSummary:document.querySelector('[data-sports-id="'+CSS.escape(id)+'"] .minimised-card-summary')===node}),tennis.id);
    await page.mouse.up();pressed=false;
    await slot.locator('.feed-live-score').waitFor();
    assert.equal(await slot.evaluate(node=>node.classList.contains('as-expanded')),true,'The same native press must still expand after the selected response');
    assert.match(await slot.locator('.feed-live-score').innerText(),/6–4.*Games 2–1/s);assert.equal(await page.locator('.as-expanded').count(),1);
    assert.equal(JSON.stringify(tennis),original);await assertGuards(page,saved);assert.equal((await personalState(page)).preferences,saved.preferences);
    console.log(JSON.stringify({engine,diagnostic:'controlled selected response during trusted pointer sequence',pressState,diagnostics:await page.evaluate(()=>qaResultsSnapshot()),physicalDeviceProof:false}));
   }catch(error){console.error(JSON.stringify({engine,regression:'selected refresh during a trusted disclosure press',pressState,selected:selected&&{events:selected.events,fixtures:selected.fixtures},guards:await page.evaluate(()=>({writes:qaCardWrites,feedPolls:qaFeedPolls})).catch(()=>null),diagnostics:await page.evaluate(()=>qaResultsSnapshot()).catch(failure=>({snapshotError:failure.message})),physicalDeviceProof:false}));if(process.env.ALL_SPORTS_DIAGNOSTIC_DIR)await page.screenshot({path:path.join(process.env.ALL_SPORTS_DIAGNOSTIC_DIR,'press-refresh-'+engine+'-failure.png'),fullPage:false}).catch(()=>{});throw error;}
   finally{gate.release.resolve();if(pressed)await page.mouse.up().catch(()=>{});if(target)await target.dispose().catch(()=>{});}
  }]
 ];
 for(const [name,test] of cases){
  resetScenario();const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],writes=[],cleanup=[];
  try{
   page.on('pageerror',e=>errors.push(e.message));
   // Match the init-script observer's full page window, including the first
   // Followed navigation. Late delivery must not orphan its invocation.
   page.on('request',request=>{const url=new URL(request.url());if(url.origin===base&&url.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(request.method())){const headers=request.headers();writes.push({method:request.method(),url:url.pathname+url.search,body:request.postData(),contentType:headers['content-type'],authorization:Boolean(headers.authorization)});}});
   await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:204,body:''}));
   await page.addInitScript(observeApiFetch);
   await page.addInitScript(({now})=>{const RealDate=Date;globalThis.qaNow=now;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[qaNow]));}static now(){return qaNow;}};localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,feedControls:{spoilers:'results_visible'},followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]}}));},{now});
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
   await page.locator('.tabs [data-tab=match-centre]').click();
   await page.evaluate(()=>{globalThis.qaCardWrites=[];globalThis.qaFeedPolls=0;for(const name of ['setCardState','updateEventAction','recordEventFeedAction']){const original=globalThis[name];globalThis[name]=(...args)=>{qaCardWrites.push(name);return original(...args);};}const original=queueLiveFixtureSnapshot;globalThis.queueLiveFixtureSnapshot=(...args)=>{qaFeedPolls++;return original(...args);};});
   await test(page,cleanup);assert.deepEqual(errors,[]);
   const invocations=await page.evaluate(()=>qaApiInvocations),readBudget=name.startsWith('latest visit')||name.startsWith('failed optional')?2:1,publicFollowedReads=[];
   assert.deepEqual(mutationRequests(writes,invocations,readBudget,publicFollowedReads),[],'The native regression must not write an account/API or initiate public composition outside its bounded current Followed visit');
   console.log(JSON.stringify({engine,width:page.viewportSize().width,regression:name,mountedProductionPaths:true,accountPreserved:true,noFeedPoller:true,publicFollowedReads,errors}));
  }catch(error){console.error(JSON.stringify({engine,width:page.viewportSize().width,regression:name,errors,notice:await page.locator('.as-notice').textContent().catch(()=>null),lastRequests:requests.slice(-8)}));throw error;}
  finally{cleanup.forEach(release=>release());await page.close();}
 }
}
async function main(){
 const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const free=()=>{const disk=fs.statfsSync(root);return disk.bavail*disk.bsize;},allocated=Date.parse(process.env.ALL_SPORTS_DEADLINE||''),deadline=Math.min(Date.now()+(process.env.ALL_SPORTS_PAGER_PROBE?90000:360000),Number.isFinite(allocated)?allocated:Infinity);
 assert(free()>=4.5*1024**3,'Browser lane entry needs 4.5 GiB free');
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   requests.push(url.pathname+url.search);
   if(url.pathname==='/api/match-centre'){
    if(partial&&Number(url.searchParams.get('cursor'))>0){res.writeHead(503);res.end('{}');return;}
    try{return await handler(req,{setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return this;},json(body){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));}});}catch(e){res.writeHead(500);res.end('{}');return;}
   }
   res.statusCode=url.searchParams.get('scope')==='match-centre'?200:503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(url.searchParams.get('scope')==='match-centre'?{events:[],pagination:{nextCursor:null}}:{}));return;
  }
  const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const engine of (process.env.ALL_SPORTS_ENGINES||'chromium,webkit').split(',')){
   const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:process.env.QA_BROWSER_CHANNEL||'chrome'}:{})});
   const watchdog=setInterval(()=>{if(Date.now()>deadline||free()<3*1024**3){console.error('Browser lane allocation or host reserve exceeded');void browser.close();}},5000);
   try{for(const width of (process.env.ALL_SPORTS_WIDTHS||'390,768,1280').split(',').map(Number)){
    resetScenario();const errors=[],page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
    try{
     page.on('pageerror',e=>errors.push(e.message));
     await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:204,body:''}));
     await page.route('**/assets/js/all-sports-ui.js*',async route=>{await page.evaluate(()=>{userPreferences.qaPublicViewBookkeeping=true;userPreferences.showSpoilers=false;userPreferences.feedControls.spoilers='strict';});await route.continue();});
     await page.addInitScript(({now})=>{const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,feedControls:{spoilers:'results_visible'},followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]}}));},{now});
     await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
     await page.locator('.tabs [data-tab=match-centre]').click();assert.equal(await page.getByRole('tab',{name:'Followed',exact:true}).getAttribute('aria-selected'),'true');
     await page.getByRole('tab',{name:'All Sports',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-sports-id]').length===134&&!document.querySelector('[aria-label="Refresh All Sports View"]').disabled);await page.evaluate(()=>document.fonts.ready);
     assert.equal(await page.getByRole('tab',{name:'Today',exact:true}).getAttribute('aria-selected'),'true');assert(await page.getByRole('heading',{name:'Time TBC',exact:true}).isVisible());assert.match(await page.locator('.as-tbc').innerText(),/May fall within this range/);
     const geometry=await page.locator('.as-track.as-multiple').first().evaluate(track=>({track:track.clientWidth,card:track.firstElementChild.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth}));
     const columns=width>=1120?4:width>=760?3:2;assert(Math.abs(geometry.card-(geometry.track-12*(columns-1))/columns)<2);assert.equal(geometry.overflow,0);
     const saved=await page.evaluate(()=>({preferences:JSON.stringify(userPreferences),actions:JSON.stringify(eventActions),states:JSON.stringify(cardViewStates)}));
     await page.evaluate(()=>{globalThis.qaCardWrites=[];for(const name of ['setCardState','updateEventAction','recordEventFeedAction']){const old=globalThis[name];globalThis[name]=(...args)=>{qaCardWrites.push(name);return old(...args);};}});
     const first=page.locator('[data-sports-id="fixture:nrl:underway"]');await first.locator('.minimised-card-summary').click();await page.waitForFunction(()=>document.querySelector('[data-sports-id="fixture:nrl:underway"]')?.classList.contains('as-expanded'));
     assert(!/321|123/.test(await first.innerText()),'Results OFF selected during the pending module protects expanded content');assert.equal(await page.evaluate(()=>userPreferences.feedControls.spoilers),'strict');assert.equal(await page.locator('.as-expanded').count(),1);
     assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences)),saved.preferences);assert.equal(await page.evaluate(()=>JSON.stringify(cardViewStates)),saved.states);assert.deepEqual(await page.evaluate(()=>qaCardWrites),[],'Expansion delegates without persistent card/account/engagement writes');
     await first.locator('.event-card-disclosure').click();
     await page.waitForFunction(()=>!document.querySelector('.as-expanded'));
     await page.getByRole('button',{name:'Next overlapping fixtures',exact:true}).first().click();await page.waitForFunction(()=>{const track=document.querySelector('.as-track');return track?.scrollLeft>=track.clientWidth-24&&document.querySelector('.as-page-position')?.textContent.includes('Page 2 ');});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.match(await page.locator('.as-page-position').first().textContent(),/Page 2/);
     if(process.env.ALL_SPORTS_PAGER_PROBE){console.log(JSON.stringify({engine,width,probe:'settled horizontal pager',position:await page.locator('.as-page-position').first().textContent(),track:await page.locator('.as-track').first().evaluate(n=>({left:n.scrollLeft,width:n.clientWidth,total:n.scrollWidth})),errors}));continue;}
     await page.getByRole('tab',{name:'+24 hours',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-sports-id]').length===135&&!document.querySelector('[aria-label="Refresh All Sports View"]').disabled);
     await page.getByRole('tab',{name:'+48 hours',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-sports-id]').length===136&&!document.querySelector('[aria-label="Refresh All Sports View"]').disabled);assert.equal(await page.locator('.as-date').count(),2);
     await page.getByRole('tab',{name:'Everything',exact:true}).click();await page.getByRole('tab',{name:'All Sports',exact:true}).click();await page.getByRole('tab',{name:'+48 hours',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'+48 hours',exact:true}).getAttribute('aria-selected'),'true');
     fail=true;await page.getByRole('button',{name:'Refresh All Sports View',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.as-notice')?.textContent.includes('Current updates are unavailable'));assert.equal(await page.locator('[data-sports-id]').count(),136);assert.match(await page.locator('[data-sports-id="fixture:nrl:underway"] .as-qualifier').textContent(),/Awaiting update/,'A recent cached live fact loses an unqualified Live claim on a failed current read');
     fail=false;partial=true;await page.getByRole('button',{name:'Refresh All Sports View',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.as-notice')?.textContent.includes('Schedule incomplete'));assert.equal(await page.locator('[data-sports-id]').count(),136,'A failed continuation cannot erase retained fixture cards');
     const before=requests.length;await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);assert.equal(requests.length,before);
     assert.deepEqual(errors,[]);assert(requests.some(u=>u.includes('cursor=100')),'Data pagination is independent of horizontal UI pages');assert(requests.filter(u=>u.includes('view=all-sports')&&u.includes('ids=')).every(u=>new URL(u,base).searchParams.get('ids').split(',').length<=60));
     console.log(JSON.stringify({engine,width,columns,fixtures:136,completePagination:true,rollingRanges:true,inlineExpansion:true,resultsOff:true,accountPreserved:true,tbc:true,fallback:true,partial:true,hiddenStop:true,errors}));
    }catch(error){console.error(JSON.stringify({engine,width,errors,notice:await page.locator('.as-notice').textContent().catch(()=>null),pages:await page.locator('.as-page-position').allTextContents(),tracks:await page.locator('.as-track').evaluateAll(nodes=>nodes.map(n=>({left:n.scrollLeft,width:n.clientWidth,total:n.scrollWidth}))),lastRequests:requests.slice(-8)}));throw error;}finally{await page.close();}
   }if(!process.env.ALL_SPORTS_PAGER_PROBE)await nativeRepairs(browser,base,engine);}finally{clearInterval(watchdog);await browser.close();}
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={observeApiFetch,publicFollowedComposition,mutationRequests};
