'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const capture=require('./fixtures/football-table-freshness-20261012.json');
const current=require('../data/code-inspector/football.json');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:34219',checks=[],note='Table and recorded match results do not yet agree.';
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch();
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),origin=new URL(base).origin;
   await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin&&!u.pathname.startsWith('/api/')?route.continue():route.fulfill({status:503,json:{}});});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:true,reminderChoice:'off',selectedSelectorEntityIds:['sport:football'],followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}})));
   let releaseModule;const moduleGate=new Promise(r=>releaseModule=r);
   await page.route('**/assets/js/football-card-context.js*',async route=>{await moduleGate;await route.continue();});
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden',timeout:60000});await page.waitForFunction(()=>!startupCoordinator.isHydrating());
   try{
    await page.evaluate(async capture=>{
     await loadDeferredScript('assets/js/follow-schedule-panel.js?v='+document.querySelector('meta[name="app-shell-version"]').content);
     await loadDeferredScript('assets/js/follow-navigation.js?v=463');
     codeInspectorChunk={code:{id:'sport:football',slug:'football'},fixtures:capture.fixtures,standings:capture.standings};liveFixtureEvents=[capture.liveFixture];codeInspectorChunk.fixtures=liveScheduleFixtures(codeInspectorChunk.fixtures);
     let mount=document.getElementById('qaFootballFreshness');if(!mount){mount=document.createElement('main');mount.id='qaFootballFreshness';mount.style.cssText='position:fixed;inset:0;z-index:999999;overflow:auto;padding:8px;background:var(--bg)';document.body.append(mount);}
     userPreferences.showSpoilers=true;standingsRevealApproved=false;renderCodeInspectorStandings(mount,codeInspectorChunk.code);
    },capture);
    assert((await page.locator('#qaFootballFreshness').innerText()).includes('Checking table against recorded results'));
    await page.evaluate(()=>{userPreferences.showSpoilers=false;standingsRevealApproved=false;});
   }finally{releaseModule();}
   await page.waitForFunction(()=>Boolean(globalThis.NOTHINGSPORTS_FOOTBALL_CONTEXT?.footballTableWarning));
   await page.waitForFunction(()=>!document.querySelector('#qaFootballFreshness .standings-stale-note'));
   assert(!(await page.locator('#qaFootballFreshness').innerText()).includes(note));
   checks.push({engine,mode:'cold deferred full-table comparison, Results off before module arrives',passed:true});
   await page.unroute('**/assets/js/football-card-context.js*');
   for(const width of [320,390])for(const mode of ['feed','schedule'])for(const hide of [false,true]){
    await page.setViewportSize({width,height:844});
    const unchanged=await page.evaluate(({capture,mode,hide})=>{
     codeInspectorChunk={code:{id:'sport:football',slug:'football'},fixtures:capture.fixtures,standings:capture.standings};
     activeTab=mode==='feed'?'feed':'follow';userPreferences.showSpoilers=true;userPreferences.feedControls.spoilers='results_visible';updateEventSpoilerState(capture.currentFixture,{override:hide?'hide':'inherit'});
     setCardState(mode==='schedule'?(canonicalFeedFixtureForInspector(capture.currentFixture)||capture.currentFixture):capture.currentFixture,'opened');
     let mount=document.getElementById('qaFootballFreshness');if(!mount){mount=document.createElement('main');mount.id='qaFootballFreshness';mount.style.cssText='position:fixed;inset:0;z-index:999999;overflow:auto;padding:8px;background:var(--bg)';document.body.append(mount);}
     const facts=JSON.stringify(codeInspectorChunk),preferences=JSON.stringify(userPreferences),old=queueLiveFixtureSnapshot;queueLiveFixtureSnapshot=()=>{};
     try{mount.replaceChildren(mode==='feed'?buildEventCard(capture.currentFixture):buildCodeInspectorFixture(capture.currentFixture));}finally{queueLiveFixtureSnapshot=old;}
     return facts===JSON.stringify(codeInspectorChunk)&&preferences===JSON.stringify(userPreferences);
    },{capture,mode,hide});assert(unchanged);
    const table=page.locator('#qaFootballFreshness .football-card-standings');
    try{await table.waitFor({state:'attached'});}catch(error){
     if(process.env.QA_FAILURE_FILE)fs.writeFileSync(process.env.QA_FAILURE_FILE,JSON.stringify({engine,width,mode,hide,errors,state:await page.evaluate(()=>({html:document.getElementById('qaFootballFreshness')?.innerHTML.slice(0,3500),moduleKeys:Object.keys(globalThis.NOTHINGSPORTS_FOOTBALL_CONTEXT||{}),code:codeInspectorChunk?.code,fixtures:codeInspectorChunk?.fixtures?.length,activeTab}))},null,2)+'\n');
     throw error;
    }
    assert.equal(await table.locator('li').count(),hide?0:2);
    const shown=(await table.innerText()).includes(note);
    if(shown!==!hide&&process.env.QA_FAILURE_FILE)fs.writeFileSync(process.env.QA_FAILURE_FILE,JSON.stringify({engine,width,mode,hide,trace:await page.evaluate(()=>({code:codeInspectorChunk?.code,fixtureCount:codeInspectorChunk?.fixtures?.length,tableCount:codeInspectorChunk?.standings?.length,moduleReady:Boolean(globalThis.NOTHINGSPORTS_FOOTBALL_CONTEXT?.footballTableWarning)}))},null,2)+'\n');
    assert.equal(shown,!hide);
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));
    checks.push({engine,width,mode,hidden:hide,passed:true});
   }
   const merged=await page.evaluate(async capture=>{
    await loadDeferredScript('assets/js/follow-schedule-panel.js?v='+document.querySelector('meta[name="app-shell-version"]').content);
    await loadDeferredScript('assets/js/follow-navigation.js?v=463');
    codeInspectorChunk={code:{id:'sport:football',slug:'football'},fixtures:capture.fixtures,standings:capture.standings};
    const original=JSON.stringify(capture.fixtures);liveFixtureEvents=[capture.liveFixture];
    codeInspectorChunk.fixtures=liveScheduleFixtures(codeInspectorChunk.fixtures);
    const known=codeInspectorChunk.fixtures.find(f=>f.id===capture.currentFixture.id);
    activeInspectorCodeId='sport:football';codeInspectorTab='standings';userPreferences.showSpoilers=true;standingsRevealApproved=false;
    const mount=document.getElementById('qaFootballFreshness');mount.replaceChildren();renderCodeInspectorStandings(mount,codeInspectorChunk.code);
    return {status:known?.status,homeScore:known?.homeScore,awayScore:known?.awayScore,unchanged:original===JSON.stringify(capture.fixtures)};
   },capture);
   assert.equal(merged.status,'completed');assert.equal(merged.homeScore,2);assert.equal(merged.awayScore,1);assert(merged.unchanged);
   const full=page.locator('#qaFootballFreshness .code-inspector-published-standings');assert((await full.innerText()).includes(note));assert.equal(await full.locator('.code-inspector-standing-row').count(),20);
   checks.push({engine,width:390,mode:'full Follow table after actual liveScheduleFixtures merge',passed:true});
   await page.evaluate(current=>{liveFixtureEvents=[];codeInspectorChunk=current;const mount=document.getElementById('qaFootballFreshness');mount.replaceChildren();renderCodeInspectorStandings(mount,current.code);},current);
   assert(!(await page.locator('#qaFootballFreshness').innerText()).includes(note));checks.push({engine,mode:'published table recovery',passed:true});
   await page.evaluate(()=>{userPreferences.showSpoilers=false;standingsRevealApproved=false;const mount=document.getElementById('qaFootballFreshness');mount.replaceChildren();renderCodeInspectorStandings(mount,codeInspectorChunk.code);});
   assert.equal(await page.locator('#qaFootballFreshness .code-inspector-standing-row').count(),0);assert(!(await page.locator('#qaFootballFreshness').innerText()).includes(note));assert.deepEqual(errors,[]);
   checks.push({engine,mode:'full-table Results off',passed:true});await context.close();console.log('Football table freshness: '+engine+' native cards, real overlay, full table and recovery passed.');
  }finally{await browser.close();}
 }
 if(process.env.QA_OUTPUT)fs.writeFileSync(process.env.QA_OUTPUT,JSON.stringify({checkedAt:new Date().toISOString(),passed:true,base,checks,limits:['Dated actual EPL facts combined in a controlled late-result scenario.','Native card/full-table builders and actual existing live Schedule merge.','APIs/providers blocked; disposable choices; no customer/source/notification writes.','Browser evidence, not physical phone, actual outage or whole Football approval.']},null,2)+'\n');
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
