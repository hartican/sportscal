'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:nrl-premiership'],followedSports:['nrl'],onboardingComplete:true,showSpoilers:false})));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
 await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const data=await page.evaluate(async()=>await(await fetch('/data/follow-schedule/nrl.json')).json());
 const fixture=data.fixtures.find(e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].includes('evt_84'));assert(fixture);
 for(const mode of ['feed','schedule']){
  await page.evaluate(({fixture,mode})=>{activeTab=mode==='feed'?'feed':'follow';document.getElementById('listView').replaceChildren(mode==='feed'?buildEventCard(fixture):buildCodeInspectorFixture(fixture));},{fixture,mode});
  const card=page.locator('#listView');const text=await card.innerText();assert.match(text,/Roosters/);assert.match(text,/Knights/);assert.match(text,/7:30\s*PM/i);
  assert.equal(await card.locator('.fixture-profile-link').count(),2);
  assert.equal(await card.locator('a.provider-link[aria-label*="9Now"]').count(),1);
  assert.equal(await card.locator('a.provider-link[aria-label*="Kayo"], a.provider-link[aria-label*="Foxtel"]').count(),0,'exclusive final must not inherit normal-round viewing');
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 }
 console.log('Grand Final live-render contract: resolved teams, Sydney DST kickoff, profile links, exclusive viewing and four widths passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
