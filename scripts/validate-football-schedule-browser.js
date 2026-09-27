'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  // Seed an existing local profile before startup; otherwise the scheduled
  // first-run wizard can reopen after the test starts clicking schedule tabs.
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:football'],showSpoilers:false,onboardingComplete:true})));
  await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
  await page.waitForFunction(()=>typeof saveFollowBrowse==='function'&&typeof FOLLOW_FIRST!=='undefined');
  await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
  await page.evaluate(()=>{
   userPreferences=FOLLOW_FIRST.migratePreferences({selectedSelectorEntityIds:['sport:football'],showSpoilers:false,onboardingComplete:true});
   activeTab='follow';saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'schedule',scheduleScope:null});renderAll();
  });
  await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:football'&&!codeInspectorChunkLoading);
  try{await page.locator('.code-inspector-group').first().waitFor({timeout:10000});}catch(e){console.log(await page.evaluate(()=>({tab:activeTab,code:activeInspectorCodeId,text:document.getElementById('listView').innerText,loading:startupCoordinator.isHydrating})));throw e;}
  assert.match(await page.locator('.follow-schedule-panel').innerText(),/Premier League Matchweek/);
  const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([key])=>key!=='followBrowse'))));
  await page.locator('.follow-section-tabs').getByRole('button',{name:'Standings',exact:true}).click();
  assert.match(await page.locator('.follow-schedule-panel').innerText(),/Standings hidden/);
  assert.equal(await page.locator('.code-inspector-standing-row').count(),0);
  await page.getByRole('button',{name:'Reveal standings',exact:true}).click();
  await page.locator('#confirmStandingsRevealBtn').click();
  await page.locator('.code-inspector-standing-row').first().waitFor();
  assert.equal(await page.locator('.code-inspector-standing-row').count(),92);
  assert.equal(await page.locator('.standings-source-note').count(),2);
  assert.match(await page.locator('.standings-source-note').first().innerText(),/Provisional.*community/);
  await page.locator('.code-inspector-standing-row').first().scrollIntoViewIfNeeded();
  assert.match(await page.locator('.code-inspector-standing-row').first().innerText(),/played.*wins.*draws.*pts/);
  assert.match(await page.locator('.follow-schedule-panel').innerText(),/Table checked/);
  for(const width of [320,390,768,1280])for(const theme of ['day','night']){
   await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${theme}: no page overflow`);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([key])=>key!=='followBrowse')))),before,'viewing schedules and revealing table must not mutate follows or Results');
  for(const date of ['2026-09-25','2026-09-29'])for(const mode of ['schedule','feed']){
   await page.evaluate(({date,mode})=>{
    const fixture=codeInspectorChunk.fixtures.find(f=>f.id===`football-australia-brazil-${date}`);
    const host=document.getElementById('listView');host.replaceChildren(mode==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard(canonicalFeedFixtureForInspector(fixture)||fixture));
   },{date,mode});
   const free=page.locator('#listView a.provider-link[aria-label*="10 Streaming"]');
   assert.equal(await free.count(),date==='2026-09-25'?1:0,`${date} ${mode}: fixture-specific free option`);
   if(date==='2026-09-25'){await free.scrollIntoViewIfNeeded();assert(await free.isVisible());assert.equal(await free.getAttribute('href'),'https://10.com.au/');}
  }
  console.log('Football browser: matchweek navigation, Results-off protection, dated 20-club EPL and two 36-club European tables, four widths, unchanged preferences and fixture-specific Feed/Schedule viewing passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
