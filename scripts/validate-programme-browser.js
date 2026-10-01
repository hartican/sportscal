#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:tennis','sport:tennis-women'],followedSports:['tennis','tennis-women'],showSpoilers:false,followFirst:{followedMajorEventIds:['billie-jean-king-cup']}})));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991',{waitUntil:'commit'});
 await page.waitForFunction(()=>typeof userPreferences==='object'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 await page.evaluate(async()=>{await loadTennisFeedParents();activeTab='feed';renderAll();});
 const id='tennis-parent:billie-jean-king-cup:2026:tournament:tennis:bjk-cup-finals-2026';
 const slot=page.locator(`[data-feed-event-id="${id}"]`).first();if(await slot.count())await slot.scrollIntoViewIfNeeded();
 const parent=page.locator(`.tennis-feed-parent[data-event-id="${id}"]`);await parent.waitFor();assert.match(await parent.innerText(),/Completed/);
 await parent.getByRole('button',{name:'Expand Billie Jean King Cup Finals schedule',exact:true}).click();await parent.locator('.tennis-contest-row').first().waitFor();assert.equal(await parent.locator('.tennis-contest-row').count(),7);
 await parent.locator('.tennis-tie-details summary').first().click();assert(!(await parent.innerText()).includes('7-6(2) 4-6 6-4'),'Results-off hides rubber scores');
 await page.locator('#homeSpoilerToggle').click();await page.locator('dialog[open] [data-confirm]').click();
 await page.waitForFunction(()=>userPreferences.showSpoilers===true);
 await parent.locator('.tennis-contest-row').first().waitFor();
 const detail=parent.locator('.tennis-tie-details').first();if(await detail.getAttribute('open')===null)await detail.locator('summary').click();
 assert((await parent.innerText()).includes('7-6(2) 4-6 6-4'),'Revealed results retain the full rubber score');
 assert.equal(await parent.locator('.nsc-widget').count(),0,'Overview has no rating owner');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.evaluate(()=>setActiveFeedFilter('sport:tennis-women',{refresh:false}));
 await page.waitForFunction(()=>activeFilter==='sport:tennis-women');await parent.waitFor();assert.match(await parent.innerText(),/Completed/);
 await page.evaluate(()=>setActiveFeedFilter('sport:tennis',{refresh:false}));
 await page.waitForFunction(()=>activeFilter==='sport:tennis');assert.equal(await parent.count(),0,'Women’s parent cannot appear in men’s filtered Feed');
 await page.evaluate(()=>setActiveFeedFilter('all',{refresh:false}));
 await page.waitForFunction(()=>activeFilter==='all');
 const projection=await page.evaluate(async()=>{const r=await fetch('/data/code-inspector/nrl.json');return (await r.json()).fixtures;});
 assert(!projection.some(e=>['evt_81','evt_82','evt_83'].includes(e.id)));assert(projection.some(e=>e.sourceEventIds?.includes('evt_84')));assert.equal(projection.filter(e=>e.id.includes('preliminary-final-')&&e.status==='completed').length,2);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({scope:'Isolated explicit-follow Feed and expanded BJK parent; account APIs blocked',completedParent:true,ties:7,resultsPrivacy:true,teamParentCategory:true,widths:[320,390,768,1280],nrlSummariesRemoved:3,nrlPreliminaryResultsRetained:2,grandFinalAliasRetained:true}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
