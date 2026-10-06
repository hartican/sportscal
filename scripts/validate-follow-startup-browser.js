#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),report=[];
const person={id:'competitor:tennis:atp:carlos-alcaraz',displayName:'Carlos Alcaraz',sportKey:'tennis'};
const preferences={version:24,onboardingComplete:true,selectedSelectorEntityIds:['sport:afl-premiership','sport:nrl-premiership'],followedSports:['afl','nrl'],preferenceGraph:{entityFollows:[{participantId:person.id,followLevel:'follow'}]},followBrowse:{sportId:'sport:afl',categoryId:'sport:afl-premiership',section:'teams-players'}};
function latch(){let release;const promise=new Promise(resolve=>{release=resolve;});return{promise,release};}
async function ready(page){try{await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&typeof userPreferences==='object');await page.evaluate(()=>{acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});});await page.locator('#startupLaunch').waitFor({state:'hidden'});}catch(error){console.error('Startup failure diagnostic',await page.evaluate(()=>({readyState:document.readyState,navigation:typeof activateTopLevelTab,preferences:typeof userPreferences,splash:document.querySelector('#startupLaunch')?.textContent,scripts:[...document.scripts].map(s=>s.src).filter(Boolean),nativeErrors:globalThis.qaNativeErrors})));throw error;}}
async function openFollow(page){await page.evaluate(()=>{closeSettings();document.querySelector('.tabs [data-tab=follow]').addEventListener('click',()=>{globalThis.qaFollowTap=performance.now();},{capture:true,once:true});});await page.locator('.tabs [data-tab=follow]').click();}
async function controls(page){
 await page.waitForFunction(()=>['My athletes & teams','Browse sports'].every(label=>[...document.querySelectorAll('#listView .follow-home-tabs button')].some(b=>b.textContent===label)),null,{timeout:300});
 const elapsed=await page.evaluate(()=>performance.now()-qaFollowTap);assert(elapsed<300,`Follow controls took ${elapsed.toFixed(0)}ms`);return elapsed;
}
async function localPerson(page){await page.evaluate(p=>{canonicalPreferenceParticipants=[...Array.from({length:1000},(_,i)=>({id:'competitor:tennis:qa:'+i,canonicalName:'Other player '+i})),p];},person);}
async function fixtureAccount(page,id){
 await page.evaluate(id=>{serverSyncClient.clearSession();const token='x.'+btoa(JSON.stringify({sub:id}))+'.unsigned';localStorage.setItem(NOTHINGSPORTS_SERVER_SYNC.PERSISTENT_SESSION_STORAGE_KEY,JSON.stringify({accessToken:token,refreshToken:'local-qa-only',expiresAt:Date.now()+3600000}));serverPersistence.user={id};},id);
 assert.equal(await page.evaluate(()=>serverSyncClient.sessionSubject()),id,'The actual frozen request client must adopt the fixture account');
}
async function createPage(browser,base,{route='',api,profile=preferences}={}){
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[],reads=[],writes=[],pendingFeedReads=new Set();
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/data/feed/'))pendingFeedReads.add(r);});
 for(const event of ['requestfinished','requestfailed'])page.on(event,r=>pendingFeedReads.delete(r));
 page.setDefaultTimeout(10000);
 page.on('pageerror',e=>{errors.push(e.message);if(process.env.FOLLOW_DEFAULT_TRACE==='1')console.error('Page error diagnostic',e.message.slice(0,300),e.stack?.slice(-700));});
 if(process.env.FOLLOW_DEFAULT_TRACE==='1')page.on('requestfailed',r=>console.error('Request failure diagnostic',r.url().slice(0,200),r.failure()));
 await page.addInitScript(p=>{if(!localStorage.getItem('ns_install_v1'))localStorage.setItem('ns_preferences_v1',JSON.stringify(p));},profile);
 if(process.env.FOLLOW_DEFAULT_TRACE==='1')await page.addInitScript(()=>{globalThis.qaNativeErrors=[];addEventListener('error',e=>qaNativeErrors.push({type:'error',message:e.message,filename:e.filename,line:e.lineno,stack:e.error?.stack}));addEventListener('unhandledrejection',e=>qaNativeErrors.push({type:'rejection',message:String(e.reason),stack:e.reason?.stack}));});
 await page.route('**/api/**',r=>{const url=new URL(r.request().url()),method=r.request().method();if(!['GET','HEAD','OPTIONS'].includes(method)&&!(method==='POST'&&url.pathname==='/api/feed'&&['athletes','match-centre'].includes(url.searchParams.get('scope'))))writes.push({path:url.pathname,method});if(url.searchParams.get('scope')==='athletes'){reads.push(url.href);return api?api(r,url):r.fulfill({json:{events:[],athletes:[person],pagination:{nextCursor:null}}});}return r.fulfill({status:503,json:{error:'Isolated Follow startup QA'}});});
 return{page,errors,reads,writes,pendingFeedReads,goto:async()=>{await page.goto(base+route,{waitUntil:'commit'});await ready(page);}};
}
async function run(browser,base,engine){
 console.log(engine+': delayed module startup');
 // First open must remain usable while the optional interface cannot arrive.
 let gate=latch(),ctx=await createPage(browser,base),page=ctx.page;
 try{
  await page.route('**/config/athletes.js*',async r=>{await gate.promise;await r.continue();});await ctx.goto();await localPerson(page);await openFollow(page);
  const ms=await controls(page);assert.match(await page.locator('#listView').innerText(),/Loading favourites/);
  assert.match(await page.locator('.athletes-person').first().innerText(),/Carlos Alcaraz/,'known local follows show before modules arrive');
  await page.getByRole('button',{name:'Browse sports',exact:true}).click();await page.locator('.follow-navigation').waitFor();
  gate.release();await page.waitForFunction(()=>!!globalThis.NOTHINGSPORTS_ATHLETES_UI);await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>followHomeView),'browse');assert.equal(await page.locator('.athletes-heading').count(),0,'late favourites module cannot replace Browse');
  assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:'cold modules and late navigation',controlsMs:ms});
 }finally{gate.release();await page.close();}
 // Browse is independent of incomplete or failed Feed hydration.
 for(const restored of [false,true]){
  console.log(engine+': '+(restored?'restored':'early')+' Browse during Feed startup');
  gate=latch();ctx=await createPage(browser,base,{route:restored?'#follow/browse':''});page=ctx.page;
  try{
   await page.route('**/data/follow-schedule/**',async r=>{await gate.promise;await r.continue();});await ctx.goto();
   if(!restored){await openFollow(page);await controls(page);await page.getByRole('button',{name:'Browse sports',exact:true}).click();}
   await page.locator('.follow-navigation').waitFor();assert.equal(await page.evaluate(()=>startupCoordinator.isHydrating()),true,'test must retain the actual Feed barrier');
   await page.evaluate(()=>{startupFeedState={...startupFeedState,phase:'failed',issues:['published feed']};renderAll();});
   assert(await page.locator('.follow-navigation').isVisible(),'Feed failure cannot cover Follow');
   await page.evaluate(()=>renderCurrentSection());assert(await page.locator('.follow-navigation').isVisible());
   await page.evaluate(()=>document.querySelector('.tabs [data-tab=feed]').click());assert.equal(await page.evaluate(()=>startupCoordinator.isHydrating()),true,'opening Follow must not release Feed readiness');
   assert.equal(await page.locator('.follow-navigation').count(),0);assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:restored?'restored Browse during Feed startup':'early Browse and failed Feed'});
  }finally{gate.release();await page.close();}
 }
 // Optional journey information cannot delay names or cause a false empty state.
 gate=latch();ctx=await createPage(browser,base,{route:'#follow'});page=ctx.page;let journeys=0,matchCentre=0;
 console.log(engine+': optional journey startup');
 try{
  await page.route('**/config/tennis-journeys.js*',async r=>{journeys++;await gate.promise;await r.continue();});
  await page.route('**/data/tennis-journeys.v1.json*',async r=>{await gate.promise;await r.continue();});
  await page.route('**/config/match-centre.js*',async r=>{matchCentre++;await r.continue();});
  await ctx.goto();await page.locator('.athletes-heading').waitFor({timeout:2000});await page.locator('.athletes-person').first().waitFor({timeout:2000});
  assert.equal(matchCentre,0,'favourites do not load unused Match Centre code');
  assert.equal(journeys,1,'optional journey module is shared');assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:'restored favourites with delayed optional journeys'});
 }finally{gate.release();await page.close();}
 // Re-renders share one schedule request and retain last-good names on failure.
 gate=latch();let fail=false;ctx=await createPage(browser,base,{api:async r=>{await gate.promise;return r.fulfill({status:fail?503:200,json:fail?{}:{events:[],athletes:[person],pagination:{nextCursor:null}}});}});page=ctx.page;
 console.log(engine+': slow API and request coalescing');
 try{
  await ctx.goto();await localPerson(page);await openFollow(page);await controls(page);await page.locator('.athletes-heading').waitFor();
  await page.waitForFunction(()=>document.querySelector('.athletes-person'));
  await page.evaluate(()=>{for(let i=0;i<8;i++)renderAll();});await page.waitForTimeout(150);assert.equal(ctx.reads.length,1,'one in-flight membership request');
  assert(!/Follow athletes to see/.test(await page.locator('#listView').innerText()),'loading cannot claim no follows');
  gate.release();await page.waitForTimeout(200);assert.equal(ctx.reads.length,1,'settling one request cannot launch queued duplicates');
  fail=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByText('Showing available information. Refresh to check for updates.').waitFor();
  assert.equal(await page.locator('.athletes-person').count(),1,'failed refresh retains known favourites');
  await page.evaluate(()=>{for(let i=0;i<8;i++)renderAll();});await page.waitForTimeout(250);assert(ctx.reads.length<=3,'failed refresh cannot fan out into a retry chain');
  assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:'slow API, shared requests and retained failure',reads:ctx.reads.length});
 }finally{gate.release();await page.close();}
 // An identity awaiting its first response is not an empty Follow list.
 gate=latch();const apiGate=latch();ctx=await createPage(browser,base,{api:async r=>{await apiGate.promise;return r.fulfill({json:{events:[],athletes:[],pagination:{nextCursor:null}}});}});page=ctx.page;
 console.log(engine+': first response pending');
 try{
  await page.route('**/data/tennis-journeys.v1.json*',async r=>{await gate.promise;await r.continue();});await ctx.goto();
  await page.evaluate(()=>{canonicalPreferenceParticipants=[];followDirectoryChunks.clear();});await openFollow(page);await controls(page);await page.locator('.athletes-heading').waitFor();
  assert.match(await page.locator('#listView').innerText(),/Checking published fixtures/);assert(!/Follow athletes to see/.test(await page.locator('#listView').innerText()));
  apiGate.release();await page.waitForTimeout(100);assert(!/Follow athletes to see/.test(await page.locator('#listView').innerText()),'unresolved saved follows cannot flash an empty list');
  gate.release();await page.locator('.athletes-person').first().waitFor();assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:'unknown first response never flashes empty follows'});
 }finally{gate.release();apiGate.release();await page.close();}
 // Failed module loading keeps navigation and explicit Retry functional.
 ctx=await createPage(browser,base);page=ctx.page;let failModule=true;
 console.log(engine+': module failure and retry');
 try{
  await page.route('**/assets/js/athletes-ui.js*',r=>failModule?r.fulfill({status:503,headers:{'Cache-Control':'no-store'},body:''}):r.continue());await ctx.goto();await openFollow(page);await controls(page);
  await page.getByRole('button',{name:'Retry',exact:true}).waitFor();assert(await page.getByRole('button',{name:'Browse sports',exact:true}).isVisible());
  failModule=false;await page.getByRole('button',{name:'Retry',exact:true}).click();try{await page.locator('.athletes-heading').waitFor();}catch(error){console.error('Retry diagnostics',await page.evaluate(()=>({view:followHomeView,tab:activeTab,pending:!!loadAthletes.pending,ui:!!globalThis.NOTHINGSPORTS_ATHLETES_UI,text:document.querySelector('#listView').innerText,loaded:[...loadDeferredScript.requests.keys()].filter(u=>u.includes('athletes'))})),ctx.errors);throw error;}
  await page.locator('.tabs [data-tab=feed]').click();await openFollow(page);await controls(page);
  assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:'module failure, explicit retry and warm return'});
 }finally{await page.close();}
 // Account changes immediately clear private response records and reject stale work.
 gate=latch();ctx=await createPage(browser,base,{api:async r=>{await gate.promise;return r.fulfill({json:{events:[],athletes:[{...person,displayName:'Old account response'}],pagination:{nextCursor:null}}});}});page=ctx.page;
 console.log(engine+': account switch');
 try{
  await ctx.goto();await localPerson(page);await fixtureAccount(page,'account-one');await openFollow(page);await controls(page);await page.locator('.athletes-heading').waitFor();await page.waitForTimeout(100);
  await fixtureAccount(page,'account-two');await page.evaluate(()=>{const p=clonePreferences(userPreferences);p.preferenceGraph.entityFollows=[];p.followFirst.collectionFollows=[];userPreferences=p;canonicalPreferenceParticipants=[];renderAll();});
  assert.equal(await page.locator('.athletes-person').count(),0);gate.release();await page.waitForTimeout(200);assert.equal(ctx.reads.length,2,'account switch queues only the latest membership read');
  await page.evaluate(()=>document.querySelector('.tabs [data-tab=events]').click());await page.waitForTimeout(100);
  assert.equal(await page.locator('.athletes-person').count(),0);assert(!/Old account response/.test(await page.locator('#listView').innerText()));assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:'account switch and navigation reject late data'});
 }finally{gate.release();await page.close();}
}
async function queuedNavigation(browser,base,engine){
 for(const mode of ['normal','beforeunload','pagehide']){
  const gate=latch();let first=true;
  const ctx=await createPage(browser,base,{api:async r=>{if(first){first=false;await gate.promise;return r.fulfill({status:503,json:{error:'Interrupted first read'}});}return r.fulfill({json:{events:[],athletes:[person],pagination:{nextCursor:null}}});}}),page=ctx.page;
  console.log(engine+': queued profile read '+mode);
  try{
   await ctx.goto();await localPerson(page);const rootRead=page.waitForRequest(r=>{const u=new URL(r.url());return u.pathname==='/api/feed'&&u.searchParams.get('scope')==='athletes'&&!u.searchParams.get('participantId');});await openFollow(page);await rootRead;await page.locator('.athletes-heading').waitFor();await page.waitForFunction(()=>!!globalThis.NOTHINGSPORTS_ATHLETES_UI);
   await page.getByRole('button',{name:'Open Carlos Alcaraz profile in Follow',exact:true}).click();await page.locator('.athletes-profile-back').waitFor();
   const choices=await page.evaluate(()=>JSON.stringify([userPreferences,eventActions]));
   assert.equal(ctx.reads.length,1,'Profile intent queues behind the actual pending membership read');
   await page.evaluate(()=>{globalThis.qaQueued=NOTHINGSPORTS_ATHLETES_UI.refresh();});
   if(mode!=='normal')await page.evaluate(type=>dispatchEvent(type==='pagehide'?new PageTransitionEvent(type,{persisted:true}):new Event(type,{cancelable:true})),mode);
   gate.release();await page.evaluate(()=>qaQueued);
   assert.equal(ctx.reads.length,mode==='normal'?2:1,'An outgoing page must not start the queued replacement read');
   if(mode==='pagehide')await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
   if(mode==='beforeunload')await page.getByRole('button',{name:'Refresh',exact:true}).click();
   await page.waitForTimeout(150);assert.equal(ctx.reads.length,2,'A surviving or restored page can read the latest profile');
   assert(new URL(ctx.reads[1]).searchParams.get('participantId')===person.id,'The latest profile wins');
   assert.equal(await page.evaluate(()=>JSON.stringify([userPreferences,eventActions])),choices,'Navigation lifecycle leaves sporting and reminder choices intact');
   assert.deepEqual(ctx.errors,[]);assert.deepEqual(ctx.writes,[]);report.push({engine,scenario:'queued profile read '+mode,reads:ctx.reads.length,choicesPreserved:true});
  }finally{gate.release();await page.close();}
 }
}
async function savedFootballInterruptions(browser,base,engine){
 const ids=['team:football:epl:1','team:football:club:lens','team:football:club:lech-poznan'];
 for(const mode of ['superseded','unavailable']){
  const gate=latch();let first=true;
  const profile={version:26,onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[...ids.map(participantId=>({participantId,followLevel:'follow'})),{participantId:'team:football:epl:2',followLevel:'mute'}]},followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}};
  const ctx=await createPage(browser,base,{profile,api:async r=>{if(first){first=false;await gate.promise;}return r.fulfill({status:mode==='unavailable'?503:200,json:mode==='unavailable'?{error:'Unavailable'}:{events:[],athletes:ids.map(id=>({id,displayName:'Response identity'})),pagination:{nextCursor:null}}});}}),page=ctx.page;
  console.log(engine+': saved Football names with '+mode+' fixture read');
  try{
   await ctx.goto();await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&!publicFeedWarmHandle);await page.route('**/api/user-state',r=>r.fulfill({json:{user:{id:'saved-football-qa'},state:null}}));
   await fixtureAccount(page,'saved-football-qa');await page.evaluate(()=>{canonicalPreferenceParticipants=[];footballDirectoryData=null;});
   const read=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/feed'&&new URL(r.url()).searchParams.get('scope')==='athletes');await openFollow(page);await read;await page.locator('.athletes-heading').waitFor();
   await page.evaluate(()=>{globalThis.qaHydration=NOTHINGSPORTS_ATHLETES_UI.refresh();globalThis.qaObserved=serverSyncClient.loadFeed({scope:'athletes',limit:50}).catch(e=>{globalThis.qaReadError=e.code;});});
   const choices=await page.evaluate(()=>JSON.stringify([userPreferences,eventActions]));
   if(mode==='superseded')await page.evaluate(()=>serverSyncClient.savePatch({}));
   gate.release();await page.evaluate(()=>Promise.all([qaHydration,qaObserved]));
   if(mode==='superseded')assert.equal(await page.evaluate(()=>qaReadError),'feed_request_superseded','The actual background-save/read overlap rejects the old reply');
   assert.deepEqual((await page.locator('.athletes-person').evaluateAll(nodes=>nodes.map(n=>n.dataset.athleteId))).sort(),[...ids].sort(),'Saved names must survive a rejected or unavailable fixture response');
   const names=await page.locator('.athletes-person .athletes-name').allTextContents();assert(names.includes('Arsenal')&&names.includes('Lens')&&names.includes('Lech Poznań'),'Names come from the retained directory, not the rejected API reply');
   assert.equal(ctx.reads.length,1,'No automatic replacement/retry or full roster request is needed');
   assert.equal(await page.evaluate(()=>JSON.stringify([userPreferences,eventActions])),choices);assert.equal(await page.locator('.athletes-person[data-athlete-id="team:football:epl:2"]').count(),0);assert.deepEqual(ctx.errors,[]);
   report.push({engine,scenario:'saved Football names with '+mode+' fixture read',names,readCount:ctx.reads.length,choicesPreserved:true});
  }catch(error){console.error('Saved-team caller diagnostic',await page.evaluate(()=>({text:document.querySelector('#listView')?.innerText,owner:serverSyncClient.sessionSubject(),readError:globalThis.qaReadError})),ctx.errors);throw error;}finally{gate.release();await page.close();}
 }
}
async function keyboardRetention(browser,base,engine){
 const ids=['team:football:epl:1','team:football:club:lens','team:football:club:lech-poznan'];
 const fixtures=require('../data/code-inspector/football.json').fixtures.filter(f=>ids.some(id=>f.participantIds?.includes(id))&&Date.parse(f.startTimeUtc)>Date.now());
 const profile={version:26,onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:ids.map(participantId=>({participantId,followLevel:'follow'}))},followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}};
 for(const mode of ['refresh','failed refresh','load more','last page','same team','outside focus','route change','account change','profile return'].filter(mode=>!process.env.FOLLOW_KEYBOARD_CASE_FILTER||mode===process.env.FOLLOW_KEYBOARD_CASE_FILTER)){
  const ctx=await createPage(browser,base,{profile,api:r=>r.fulfill(mode==='failed refresh'&&ctx.reads.length===2?{status:503,json:{error:'Unavailable'}}:{json:{events:fixtures,athletes:ids.map(id=>({id,displayName:id,sportKey:'football'})),pagination:{nextCursor:['load more','last page'].includes(mode)?ctx.reads.length===1?50:mode==='load more'?100:null:null}}})}),page=ctx.page;
  console.log(engine+': keyboard '+mode);
  try{
   if(mode==='last page')await page.setViewportSize({width:390,height:640});await ctx.goto();await openFollow(page);await page.locator('.athletes-heading').waitFor();await page.evaluate(()=>NOTHINGSPORTS_ATHLETES_UI.refresh());await page.waitForFunction(()=>document.querySelectorAll('.athletes-person').length===3);
   const choices=()=>JSON.stringify([userPreferences.preferenceGraph.entityFollows,userPreferences.showSpoilers,userPreferences.followFirst.notifications,eventActions]);const before=await page.evaluate(choices);
   if(mode==='profile return'){
    for(const id of ids){const name=page.locator(`.athletes-person[data-athlete-id="${id}"] .athletes-name`);await name.focus();await page.keyboard.press('Enter');await page.locator('.athletes-profile-back').waitFor();await page.waitForFunction(()=>document.activeElement?.classList.contains('athletes-profile-back'));await page.keyboard.press('Enter');await page.waitForFunction(id=>document.activeElement?.closest('.athletes-person')?.dataset.athleteId===id,id);}
   }else if(mode.includes('refresh')||['load more','last page'].includes(mode)){
    await page.getByRole('button',{name:mode.includes('refresh')?'Refresh':'Load more favourites',exact:true}).focus();await page.keyboard.press('Enter');await page.evaluate(()=>NOTHINGSPORTS_ATHLETES_UI.refresh());await page.waitForFunction(mode=>mode==='load more'?document.activeElement.textContent==='Load more favourites':document.activeElement===document.querySelector('.athletes-heading button'),mode,{timeout:300});assert.equal(ctx.reads.length,2,'An explicit keyboard action still makes exactly one additional read');
   }else{
    await page.locator(`.athletes-person[data-athlete-id="${ids[2]}"]`).getByRole('button',{name:'Open match',exact:true}).focus();
    await page.evaluate(mode=>{NOTHINGSPORTS_ATHLETES_UI.start();if(mode==='route change')activateTopLevelTab('events');if(['outside focus','route change'].includes(mode))document.querySelector('.tabs [data-tab=events]').focus();if(mode==='account change'){serverSyncClient.clearSession();const token='x.'+btoa(JSON.stringify({sub:'keyboard-new-owner'}))+'.unsigned';localStorage.setItem(NOTHINGSPORTS_SERVER_SYNC.PERSISTENT_SESSION_STORAGE_KEY,JSON.stringify({accessToken:token,refreshToken:'local-qa-only',expiresAt:Date.now()+3600000}));serverPersistence.user={id:'keyboard-new-owner'};}},mode);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const focus=await page.evaluate(()=>({team:document.activeElement.closest('.athletes-person')?.dataset.athleteId,outside:document.activeElement===document.querySelector('.tabs [data-tab=events]'),body:document.activeElement===document.body,owner:serverSyncClient.sessionSubject(),tab:activeTab}));
    if(mode==='same team')assert.equal(focus.team,ids[2],'Repeated Open match labels retain the exact team context');else if(mode==='account change'){assert.equal(focus.owner,'keyboard-new-owner');assert(focus.body,'An old account cannot restore its control into the new session');}else assert(focus.outside,'A deferred restoration cannot take focus back from outside navigation');if(mode==='route change')assert.equal(focus.tab,'events');assert.equal(ctx.reads.length,1,'A same-data redraw does not add a fixture read');
   }
   if(mode==='last page')assert(await page.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'The last-page replacement control must be visible in the shorter viewport');assert.equal(await page.evaluate(choices),before);assert.deepEqual(ctx.errors,[]);assert.deepEqual(ctx.writes,[]);report.push({engine,scenario:'keyboard '+mode,choicesPreserved:true,reads:ctx.reads.length});
  }finally{await page.close();}
 }
}
async function initialBrowse(browser,base,engine){
 // A real reload advances existing visit/prompt counters and the local graph's
 // bookkeeping clock; sporting choices themselves must remain exact.
 const choices=()=>{const p=JSON.parse(JSON.stringify(userPreferences));delete p.followBrowse;delete p.ratingPromptState;if(p.preferenceGraph)delete p.preferenceGraph.updatedAt;if(p.followFirst?.refinement){delete p.followFirst.refinement.distinctOpenCount;delete p.followFirst.refinement.lastOpenId;}return p;};
 const cases=[
  {label:'Football first Browse',selected:['sport:football'],sport:'sport:football',category:'sport:football'},
  {label:'UCL child first Browse',selected:['sport:champions-league'],sport:'sport:football',category:'sport:champions-league'},
  {label:'AFLW child first Browse',selected:['sport:aflw'],sport:'sport:afl',category:'sport:aflw'},
  {label:'F1 child restored Browse',selected:['sport:f1'],sport:'sport:motorsport',category:'sport:f1',route:'#follow/browse'},
  {label:'NFL no-child first Browse',selected:['sport:american-football'],sport:'sport:american-football',category:''},
  {label:'Football club first Browse',selected:[],graph:{entityFollows:[{participantId:'team:football:epl:1',followLevel:'follow'},{participantId:'team:football:epl:2',followLevel:'mute'},{participantId:'team:football:epl:3',followLevel:'unfollow'}],competitionPreferences:[{competitionId:'competition:uefa-champions-league',enabled:false}]},sport:'sport:football',category:'sport:football',followFirst:{excludedMajorEventIds:['commonwealth-games'],notifications:{userChoice:false,enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}},
  {label:'Saved AFLW view remains',selected:['sport:football'],saved:{sportId:'sport:afl',categoryId:'sport:aflw',section:'teams-players'},sport:'sport:afl',category:'sport:aflw'},
  {label:'Empty preference legacy fallback',selected:[],sport:'sport:afl',category:'sport:afl-premiership'},
 ];
 for(const test of (process.env.FOLLOW_DEFAULT_CASE_FILTER?cases.filter(c=>c.label===process.env.FOLLOW_DEFAULT_CASE_FILTER):process.env.FOLLOW_DEFAULT_CASE_ONLY==='1'?cases.slice(0,1):cases)){
  console.log(engine+': '+test.label);
  const profile={version:26,onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:test.selected,...(test.graph?{preferenceGraph:test.graph}:{}),...(test.saved?{followBrowse:test.saved}:{}),...(test.followFirst?{followFirst:test.followFirst}:{})};
  const ctx=await createPage(browser,base,{profile,route:test.route||''}),page=ctx.page;
  const trace=[];const record=async stage=>{if(process.env.FOLLOW_DEFAULT_TRACE==='1')trace.push({stage,...await page.evaluate(()=>({graph:userPreferences.preferenceGraph,stored:JSON.parse(localStorage.getItem(PROFILE_STORAGE.KEYS.profilePrefix+activeProfileBundle.profile.id)),nativeErrors:globalThis.qaNativeErrors}))});};
  try{
   await ctx.goto();const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([key])=>key!=='followBrowse')))),beforeReloadChoices=JSON.stringify(await page.evaluate(choices));
   if(test.graph){assert.deepEqual(await page.evaluate(()=>userPreferences.preferenceGraph.entityFollows.map(({participantId,followLevel})=>({participantId,followLevel}))),test.graph.entityFollows);assert.equal(await page.evaluate(()=>userPreferences.followFirst.notifications.userChoice),false);}
   await record('initial');
   if(!test.route){await openFollow(page);await page.getByRole('button',{name:'Browse sports',exact:true}).click();}
   await page.locator('.follow-navigation').waitFor();
   const state=await page.evaluate(()=>({...followBrowseState()}));assert.equal(state.sportId,test.sport,test.label);assert.equal(state.categoryId,test.category,test.label);
   await record('after-first-browse');
   assert.deepEqual(state,await page.evaluate(()=>JSON.parse(localStorage.getItem(PROFILE_STORAGE.KEYS.profilePrefix+activeProfileBundle.profile.id)).preferences.followBrowse),'Initial view persists through the existing profile storage and view-only save');
   await record('after-persistence-read');
   assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([key])=>key!=='followBrowse')))),before,'Browsing cannot change sporting preferences, Results, reminder intent or exclusions');
   await page.evaluate(()=>{followRatingAffinity={sports:[{sportId:'sport:tennis',count:100,lastInteractedAt:new Date().toISOString()}]};renderFollowView();});
   assert.deepEqual(await page.evaluate(()=>({...followBrowseState()})),state,'Late affinity cannot replace the chosen initial or saved view');
   // This case checks persisted choices after startup. The separate delayed
   // Feed/module cases above exercise navigation during hydration. Finish the
   // isolated summary reads before replacing their document on reload.
   await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&!publicFeedWarmHandle&&!nothingscoreBatchInFlight.size&&!nothingscorePendingIds.size&&!nothingscoreBatchTimer);
   const settleDeadline=Date.now()+10000;while(ctx.pendingFeedReads.size&&Date.now()<settleDeadline)await page.waitForTimeout(50);
   assert.equal(ctx.pendingFeedReads.size,0,'The actual background Feed response finishes before the persistence reload');
   await page.reload({waitUntil:'commit'});await ready(page);await page.locator('.follow-navigation').waitFor();
   await record('after-reload');
   assert.deepEqual(await page.evaluate(()=>({...followBrowseState()})),state,'Reload retains the chosen view through the actual profile storage');
   assert.deepEqual(await page.evaluate(choices),JSON.parse(beforeReloadChoices),'Reload retains sporting choices while existing visit counters may advance');
   for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),test.label+': no page overflow');}
   assert.deepEqual(ctx.errors,[]);assert.deepEqual(ctx.writes,[],'View-only navigation cannot queue a remote state write');report.push({engine,scenario:test.label,sportId:state.sportId,categoryId:state.categoryId,preferencesPreserved:true,viewPersisted:true,reloadRetained:true,remoteWrites:0,lateAffinityStable:true,widths:[320,390,1280]});
  }finally{if(trace.length&&process.env.FOLLOW_STARTUP_REPORT_PATH)fs.writeFileSync(process.env.FOLLOW_STARTUP_REPORT_PATH+'.trace.json',JSON.stringify({engine,scenario:test.label,trace},null,2)+'\n');await page.close();}
 }
}
(async()=>{
 let server,base=process.env.QA_BASE_URL;
 if(!base){server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 try{for(const engine of (process.env.QA_BROWSER?[process.env.QA_BROWSER]:['chromium','webkit'])){const browser=await pw[engine].launch({headless:true});try{if(process.env.FOLLOW_KEYBOARD_ONLY!=='1'){if(process.env.FOLLOW_IDENTITIES_ONLY!=='1'){if(process.env.FOLLOW_LIFECYCLE_ONLY!=='1'){if(process.env.FOLLOW_DEFAULT_CASES_ONLY!=='1')await run(browser,base,engine);await initialBrowse(browser,base,engine);}await queuedNavigation(browser,base,engine);}await savedFootballInterruptions(browser,base,engine);}if(process.env.FOLLOW_IDENTITIES_ONLY!=='1')await keyboardRetention(browser,base,engine);}finally{await browser.close();}}const receipt={checkedAt:new Date().toISOString(),followStartup:'passed',runs:report};if(process.env.FOLLOW_STARTUP_REPORT_PATH)fs.writeFileSync(process.env.FOLLOW_STARTUP_REPORT_PATH,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));}
 finally{if(server)await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
