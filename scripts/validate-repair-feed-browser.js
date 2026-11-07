'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const published=require('../lib/calendar-catalogue').catalogue();
const bjk=published.find(e=>e.competitionId==='competition:billie-jean-king-cup');
const failures=[];
(async()=>{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(engineName==='chromium'?{channel:'chrome'}:{});
  try{for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-09-27T02:00:00Z')});
   await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,selectedSelectorEntityIds:['sport:f1','sport:tennis'],followFirst:{refinement:{promptedAt:'2026-09-27T00:00:00Z'}}})));
   await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:34006');
   await page.waitForFunction(()=>typeof renderAll==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
   await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.followFirst.refinement.promptedAt=new Date().toISOString();next.selectedSelectorEntityIds=['sport:f1','sport:tennis'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);next.preferenceGraph.entityFollows=[{participantId:'athlete:f1:max-verstappen',followLevel:'follow'},{participantId:'athlete:f1:fernando-alonso',followLevel:'follow'}];savePreferences(next);acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});closeSettings();document.querySelectorAll('.modal-backdrop').forEach(x=>x.classList.remove('show'));activeTab='feed';activeView='list';renderAll();});
   await page.waitForFunction(()=>{const splash=document.getElementById('startupLaunch');return !splash||splash.hidden||getComputedStyle(splash).display==='none';});
   const labels=await page.evaluate(()=>{
    const render=show=>{userPreferences.showSpoilers=show;const node=document.createElement('div');appendFollowedFixtureParticipants(node,{key:'f1',participantIds:['athlete:f1:max-verstappen','athlete:f1:fernando-alonso'],participants:[{id:'athlete:f1:max-verstappen',name:'Max Verstappen'},{id:'athlete:f1:fernando-alonso',name:'Fernando Alonso'}]});return [...node.querySelectorAll('a,button')].map(x=>x.textContent);};
    return {off:render(false),on:render(true)};
   });
   try{assert.deepEqual(labels.off,['Fernando Alonso','Max Verstappen']);assert.deepEqual(labels.on,labels.off);}catch(e){console.error(`${engineName}/${width}: regression failed`);failures.push(`${engineName}/${width}: followed tags expose source/result order ${JSON.stringify(labels)}`);}
   const taxonomy=await page.evaluate(e=>({node:DISCOVERY_CATALOGUE.eventNodeId({...e,discoverySportId:'sport:football'}),football:feedFilterMatchesEvent('sport:football',{...e,discoverySportId:'sport:football'}),tennis:feedFilterMatchesEvent('sport:tennis-women',{...e,discoverySportId:'sport:football'}),legacyNode:DISCOVERY_CATALOGUE.eventNodeId({key:'tennis',gender:'mixed',competitionId:e.competitionId,discoverySportId:'sport:football'})}),bjk);
   try{assert.equal(taxonomy.football,false);assert.equal(taxonomy.tennis,true);assert.equal(taxonomy.legacyNode,'sport:tennis');}catch(e){console.error(`${engineName}/${width}: regression failed`);failures.push(`${engineName}/${width}: stale BJK label crosses sport ${JSON.stringify(taxonomy)}`);}
   await page.route('**/qa-unavailable-page.json',r=>r.fulfill({status:503,json:{}}));
   await page.evaluate(()=>{publicFeedManifest={sourceVersion:'controlled-failed-page',pages:[{path:'/qa-unavailable-page.json'}]};publicFeedNextPageIndex=0;});
   await page.locator('#feedViewFilterBtn').click();await page.waitForFunction(()=>document.querySelector('dialog[open]'),null,{timeout:10000}).catch(async e=>{console.error(await page.evaluate(()=>({tab:activeTab,button:document.getElementById('feedViewFilterBtn').outerHTML,dialogs:[...document.querySelectorAll('dialog')].map(d=>d.outerHTML),scripts:[...document.scripts].map(s=>s.src).filter(s=>s.includes('feed-filter'))})));throw e;});await page.getByLabel('Sport',{exact:true}).selectOption('sport:tennis');await page.getByRole('button',{name:'Apply',exact:true}).click();
   try{await page.waitForFunction(()=>!document.querySelector('dialog[open]'),null,{timeout:2500});assert.equal(await page.evaluate(()=>feedViewFilters.sport),'sport:tennis');}catch(e){console.error(`${engineName}/${width}: regression failed`);failures.push(`${engineName}/${width}: Apply blocked by optional unavailable page`);await page.getByRole('button',{name:'Close',exact:true}).click();}
   assert.deepEqual(errors,[],'no uncaught page errors');
   await context.close();console.log(`${engineName}/${width}: checked source-order spoilers, BJK taxonomy and failed-page Apply`);
  }}finally{await browser.close();}
 }
 assert.deepEqual(failures,[]);console.log('Repair Feed browser regression passed. Controlled source-order and unavailable-page cases use the actual app callers.');
})().catch(e=>{console.error(e);process.exitCode=1;});
