'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33975');await page.waitForFunction(()=>typeof renderAll==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 await page.evaluate(async()=>{await loadAllFeedPages();const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.selectedSelectorEntityIds=['sport:nrl-premiership'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);next.feedCompact=false;savePreferences(next);document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.remove('show'));activeTab='feed';activeView='list';renderAll();});
 for(const [number,name,time,venue] of [[2,'Dolphins v Roosters','7:50 PM','SUNCORP STADIUM, BRISBANE'],[1,'Panthers v Knights','4:00 PM','ACCOR STADIUM, SYDNEY']]){
  const id=`major-match:nrl-finals-2026:preliminary-final-${number}`;
  assert(await page.evaluate(id=>getFilteredEvents().some(e=>e.canonicalEventId===id||e.id===id),id),name+' is in the followed Feed');
  const card=page.locator(`[data-feed-event-id="${id}"]`);for(let attempt=0;;attempt++){try{await card.scrollIntoViewIfNeeded();break;}catch(error){if(attempt===3)throw error;await page.waitForTimeout(150);}}await page.waitForTimeout(150);assert.equal(await card.count(),1,name+' appears once');
  const text=await card.innerText();for(const team of name.split(' v '))assert(text.includes(team),name+' named sides');assert(text.includes(time));assert(text.toUpperCase().includes(venue),text);assert(text.includes('PRELIM'));assert.equal(await card.locator('.fixture-access .provider-link').count(),4,'four verified providers');assert(!/Teams.*pending|winner of|Venue TBC/i.test(text));
  await card.locator('.event-card-disclosure').click();await page.waitForTimeout(100);assert((await card.innerText()).includes(number===2?'Isaiya Katoa':'Nathan Cleary'),'current expanded preview');
  if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await card.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/nrl-preliminary-${number}-${width}.png`});}
 }
 await page.evaluate(async()=>{await loadCodeInspectorManifest();await openCodeInspector('sport:nrl',{startingTab:'all-fixtures'});});
 const schedule=await page.evaluate(()=>codeInspectorChunk.fixtures.filter(e=>e.id?.includes('preliminary-final')).map(e=>({name:e.name,date:e.date,time:e.time,reason:automaticEventFollowReason(canonicalFeedFixtureForInspector(e))})));
 for(const name of ['Dolphins v Roosters','Panthers v Knights'])assert(schedule.some(e=>e.name===name&&e.time&&e.reason),name+' remains in Schedule and automatically followed');
 assert.deepEqual(errors,[]);console.log(`${width}px: both NRL preliminary finals appear once, with teams, exact times, venues, current copy and Schedule admission`);await page.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
