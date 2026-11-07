'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof buildCodeInspectorFixture==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 for(const [code,id] of [['rugby-union','fixture:rugby:wr:5bf5174c-3bb4-40ab-8b1b-68afa79e332c'],['cricket','fixture:cricket:espn:1513451'],['cricket','fixture:cricket:espn:1551839']]){
  const f=await page.evaluate(async({code,id})=>(await(await fetch('/data/code-inspector/'+code+'.json')).json()).fixtures.find(f=>f.id===id||f.sourceEventIds?.includes(id)),{code,id});assert(f);assert.equal(f.status,'completed');assert(f.scoreDisplay);
  for(const mode of ['feed','schedule'])for(const show of [false,true]){
   await page.evaluate(({f,mode,show})=>{activeTab=mode==='feed'?'feed':'follow';userPreferences.showSpoilers=show;setCardState(mode==='schedule'?(canonicalFeedFixtureForInspector(f)||f):f,'opened');document.getElementById('listView').replaceChildren(mode==='feed'?buildEventCard({...f,eventId:f.id}):buildCodeInspectorFixture(f));},{f,mode,show});
   const text=await page.locator('#listView').innerText(),outcome=f.scoreDisplay.replace(/^.*?((?:won|win) by )/i,'$1');if(show)assert(text.includes(outcome),id+': result visible');else assert(!text.includes(outcome),id+': result protected');
   for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),id+': no overflow');}
  }
 }
 console.log('Live coverage browser: rugby result, cricket draw and cricket win render in Feed/Schedule, protect Results-off and fit four widths.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
