'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
 await page.waitForFunction(()=>typeof buildCodeInspectorFixture==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const fixtures=await page.evaluate(async()=>{const r=await fetch('/data/code-inspector/cricket.json');return (await r.json()).fixtures;});
 for(const id of ['40669','40672','40763','40997']){
  const key='fixture:cricket:CA:'+id;const f=fixtures.find(f=>f.id===key||f.sourceEventIds?.includes(key));assert(f);assert.equal(f.status,'completed');
  for(const mode of ['feed','schedule'])for(const show of [false,true]){
   await page.evaluate(({f,mode,show})=>{activeTab=mode==='feed'?'feed':'follow';userPreferences.showSpoilers=show;setCardState(mode==='schedule'?(canonicalFeedFixtureForInspector(f)||f):f,'opened');document.getElementById('listView').replaceChildren(mode==='feed'?buildEventCard({...f,eventId:f.id}):buildCodeInspectorFixture(f));},{f,mode,show});
   const text=await page.locator('#listView').innerText();assert(!/\bTBC\b/.test(text),id+': confirmed participants replace placeholder');
   if(show&&f.scoreDisplay)assert(text.includes(f.scoreDisplay),id+': confirmed result is revealed');
   if(!show)assert(!/win by|won by|abandoned|47 runs|4 wickets|6 wickets/i.test(text),id+': result hidden');
   for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),id+': no overflow');}
  }
 }
 console.log('Cricket current results browser: domestic men/women and abandoned match resolve in Feed/Schedule, Results-off protection and four widths passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
