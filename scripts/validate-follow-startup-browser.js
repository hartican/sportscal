#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),report=[];
const person={id:'competitor:tennis:atp:carlos-alcaraz',displayName:'Carlos Alcaraz',sportKey:'tennis'};
const preferences={version:24,onboardingComplete:true,selectedSelectorEntityIds:['sport:afl-premiership','sport:nrl-premiership'],followedSports:['afl','nrl'],preferenceGraph:{entityFollows:[{participantId:person.id,followLevel:'follow'}]},followBrowse:{sportId:'sport:afl',categoryId:'sport:afl-premiership',section:'teams-players'}};
function latch(){let release;const promise=new Promise(resolve=>{release=resolve;});return{promise,release};}
async function ready(page){await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&typeof userPreferences==='object');await page.evaluate(()=>{acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});});}
async function openFollow(page){await page.evaluate(()=>{closeSettings();globalThis.qaFollowTap=performance.now();document.querySelector('.tabs [data-tab=follow]').click();});}
async function controls(page){
 await page.waitForFunction(()=>['My athletes & teams','Browse sports'].every(label=>[...document.querySelectorAll('#listView .follow-home-tabs button')].some(b=>b.textContent===label)),null,{timeout:300});
 const elapsed=await page.evaluate(()=>performance.now()-qaFollowTap);assert(elapsed<300,`Follow controls took ${elapsed.toFixed(0)}ms`);return elapsed;
}
async function localPerson(page){await page.evaluate(p=>{canonicalPreferenceParticipants=[...Array.from({length:1000},(_,i)=>({id:'competitor:tennis:qa:'+i,canonicalName:'Other player '+i})),p];},person);}
async function createPage(browser,base,{route='',api}={}){
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[],reads=[];
 page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(p=>localStorage.setItem('ns_preferences_v1',JSON.stringify(p)),preferences);
 await page.route('**/api/**',r=>{const url=new URL(r.request().url());if(url.searchParams.get('scope')==='athletes'){reads.push(url.href);return api?api(r,url):r.fulfill({json:{events:[],athletes:[person],pagination:{nextCursor:null}}});}return r.fulfill({status:503,json:{error:'Isolated Follow startup QA'}});});
 return{page,errors,reads,goto:async()=>{await page.goto(base+route,{waitUntil:'domcontentloaded'});await ready(page);}};
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
  await page.evaluate(()=>{document.querySelector('.tabs [data-tab=feed]').click();document.querySelector('.tabs [data-tab=follow]').click();qaFollowTap=performance.now();});await controls(page);
  assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:'module failure, explicit retry and warm return'});
 }finally{await page.close();}
 // Account changes immediately clear private response records and reject stale work.
 gate=latch();ctx=await createPage(browser,base,{api:async r=>{await gate.promise;return r.fulfill({json:{events:[],athletes:[{...person,displayName:'Old account response'}],pagination:{nextCursor:null}}});}});page=ctx.page;
 console.log(engine+': account switch');
 try{
  await ctx.goto();await localPerson(page);await page.evaluate(()=>{globalThis.qaOwner='account-one';serverSyncClient.sessionSubject=()=>qaOwner;});await openFollow(page);await controls(page);await page.locator('.athletes-heading').waitFor();await page.waitForTimeout(100);
  await page.evaluate(()=>{qaOwner='account-two';const p=clonePreferences(userPreferences);p.preferenceGraph.entityFollows=[];p.followFirst.collectionFollows=[];userPreferences=p;canonicalPreferenceParticipants=[];renderAll();});
  assert.equal(await page.locator('.athletes-person').count(),0);gate.release();await page.waitForTimeout(200);assert.equal(ctx.reads.length,2,'account switch queues only the latest membership read');
  await page.evaluate(()=>document.querySelector('.tabs [data-tab=events]').click());await page.waitForTimeout(100);
  assert.equal(await page.locator('.athletes-person').count(),0);assert(!/Old account response/.test(await page.locator('#listView').innerText()));assert.deepEqual(ctx.errors,[]);report.push({engine,scenario:'account switch and navigation reject late data'});
 }finally{gate.release();await page.close();}
}
(async()=>{
 let server,base=process.env.QA_BASE_URL;
 if(!base){server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 try{for(const engine of (process.env.QA_BROWSER?[process.env.QA_BROWSER]:['chromium','webkit'])){const browser=await pw[engine].launch({headless:true});try{await run(browser,base,engine);}finally{await browser.close();}}console.log(JSON.stringify({followStartup:'passed',runs:report},null,2));}
 finally{if(server)await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
