'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const published=require('../data/feed/page-001.json');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{for(const width of [320,390,768,1280]){
 const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 if(process.env.QA_BASELINE_HTML)await page.route(/\/$/,r=>r.fulfill({contentType:'text/html',body:require('fs').readFileSync(process.env.QA_BASELINE_HTML,'utf8')}));
 await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33974');
 await page.waitForFunction(()=>typeof renderAll==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 await page.evaluate(async()=>{
  await loadAllFeedPages();
  const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.selectedSelectorEntityIds=['sport:afl-premiership','sport:nrl-premiership'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);savePreferences(next);
  document.querySelectorAll('.modal-backdrop').forEach(x=>x.classList.remove('show'));activeTab='feed';activeView='list';renderAll();
 });
 const before=await page.evaluate(()=>getFilteredEvents().map(e=>e.key));assert(before.includes('afl')&&before.includes('nrl'),'mixed followed Feed before filtering');
 let requests=0;await page.route('**/qa-filter-page.json',async route=>{requests++;await new Promise(r=>setTimeout(r,500));await route.fulfill({json:published});});
 await page.locator('#feedViewFilterBtn').click();await page.getByLabel('Sport',{exact:true}).selectOption('sport:afl-premiership');
 await page.evaluate(()=>{publicFeedManifest={sourceVersion:'qa',pages:[{path:'/qa-filter-page.json'}]};publicFeedNextPageIndex=0;void loadNextFeedPage();});
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('dialog[open]'),null,{timeout:5000});
 assert.equal(requests,1,'no duplicate page request');
 const filtered=await page.evaluate(()=>({keys:getFilteredEvents().map(e=>e.key),stored:JSON.parse(localStorage.getItem('ns-feed-view-filter-v1')),indicator:document.getElementById('feedViewFilterBtn').textContent}));
 assert(filtered.keys.length>0);assert(filtered.keys.every(k=>k==='afl'));assert.equal(filtered.stored.sport,'sport:afl-premiership');assert.equal(filtered.indicator,'Filter •');
 await page.locator('#feedViewFilterBtn').click();await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 assert(await page.evaluate(()=>getFilteredEvents().some(e=>e.key==='nrl')),'Clear restores other followed sports');
 const ratedId=await page.evaluate(()=>nothingscoreEventId(getFilteredEvents().find(e=>e.key==='afl')));
 // Deterministic read-only ratings response; no vote or account mutation.
 await page.route('**/api/nothingscore?*',route=>{const ids=new URL(route.request().url()).searchParams.get('ids')?.split(',')||[];return route.fulfill({json:{snapshots:ids.map(eventId=>({eventId,filterRatings:{personal:eventId===ratedId?5:null,crowd:4}}))}});});
 await page.locator('#feedViewFilterBtn').click();await page.getByLabel('Rating',{exact:true}).selectOption('5');await page.getByRole('button',{name:'Apply',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'),null,{timeout:10000});
 assert.deepEqual(await page.evaluate(()=>getFilteredEvents().map(nothingscoreEventId)),[ratedId],'five-flame filter uses actual rating data');
 await page.locator('#feedViewFilterBtn').click();await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 await page.locator('#feedViewFilterBtn').click();await page.getByRole('button',{name:'Close',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.id==='feedViewFilterBtn');
 assert.deepEqual(errors,[]);console.log(`${width}px: Filter Apply during paging, exact sport results, saved state, rating threshold, Clear and focus passed`);await page.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
