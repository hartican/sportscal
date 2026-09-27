'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:nrl-premiership'],followedSports:['nrl'],onboardingComplete:true,showSpoilers:false})));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
 await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 for(const testCase of [{code:'nrl',id:'evt_84',opponent:/Knights/,time:/7:30\s*PM/i,exclusive:true},{code:'nrlw',id:'event:nrlw:2026:grand-final',opponent:/Broncos/,time:/4:00\s*PM/i,exclusive:false}]){
 const data=await page.evaluate(async code=>await(await fetch(`/data/follow-schedule/${code}.json`)).json(),testCase.code);
 const fixture=data.fixtures.find(e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].includes(testCase.id));assert(fixture);
 for(const mode of ['feed','schedule']){
  await page.evaluate(({fixture,mode})=>{activeTab=mode==='feed'?'feed':'follow';document.getElementById('listView').replaceChildren(mode==='feed'?buildEventCard(fixture):buildCodeInspectorFixture(fixture));},{fixture,mode});
  const card=page.locator('#listView');const text=await card.innerText();assert.match(text,/Roosters/);assert.match(text,testCase.opponent);assert.match(text,testCase.time);
  assert.equal(await card.locator('.fixture-profile-link').count(),2);
  assert.equal(await card.locator('a.provider-link[aria-label*="9Now"]').count(),1);
  if(testCase.exclusive) assert.equal(await card.locator('a.provider-link[aria-label*="Kayo"], a.provider-link[aria-label*="Foxtel"]').count(),0,'exclusive final must not inherit normal-round viewing');
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 }
 }
 console.log('NRL and NRLW Grand Final live-render contract: resolved teams, Sydney DST kickoff, profile links, exclusive viewing and four widths passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
