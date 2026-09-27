'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
 await page.waitForFunction(()=>typeof buildCodeInspectorFixture==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const fixtures=await page.evaluate(async()=>{const r=await fetch('/data/code-inspector/nbl.json');return (await r.json()).fixtures;});
 const free=f=>f.viewingOptions.some(o=>o.providerId==='nine');
 const cases=[fixtures.find(f=>free(f)&&f.status==='upcoming'),fixtures.find(f=>!free(f)&&f.status==='upcoming'),fixtures.find(f=>free(f)&&f.status==='completed')];
 assert(cases.every(Boolean),'future free, future paid and completed free cases exist');
 for(const f of cases)for(const mode of ['feed','schedule']){
  await page.evaluate(({f,mode})=>{activeTab=mode==='feed'?'feed':'follow';userPreferences.showSpoilers=false;setCardState(f,'opened');document.getElementById('listView').replaceChildren(mode==='feed'?buildEventCard({...f,eventId:f.id}):buildCodeInspectorFixture(f));},{f,mode});
  const links=page.locator('#listView a.provider-link');
  assert.equal(await links.count(),free(f)?4:3,`${mode}: exact provider count`);
  const nine=page.locator('#listView a.provider-link[href="https://www.9now.com.au/"]');
  assert.equal(await nine.count(),free(f)?1:0,`${mode}: free only with fixture evidence`);
  assert.equal(await page.locator('#listView a.provider-link[href="https://www.disneyplus.com/en-au"]').count(),1,'Disney has a usable destination');
  if(f.status==='completed')assert((await links.first().getAttribute('aria-label')).includes('Check replay availability'),'live right is not replay proof');
  for(const width of [320,390,768,1280])for(const theme of ['day','night']){
   await page.setViewportSize({width,height:844});await page.evaluate(theme=>applyThemePreference(theme),theme);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${mode} ${width} ${theme}: no overflow`);
  }
 }
 console.log('NBL viewing browser: free/paid/replay cases, usable provider links, Feed/Schedule and four widths in both themes passed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
