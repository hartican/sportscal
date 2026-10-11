'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),capture=require('./fixtures/football-card-privacy-20261012.json');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:34219',checks=[];
const policies=[
 {name:'global on',global:true,override:'inherit',strict:false,visible:true},
 {name:'fixture hide',global:true,override:'hide',strict:false,visible:false},
 {name:'fixture show',global:false,override:'show',strict:false,visible:true},
 {name:'strict',global:true,override:'show',strict:true,visible:false},
 {name:'global off',global:false,override:'inherit',strict:false,visible:false}
];
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch();
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   const origin=new URL(base).origin;
   await context.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===origin&&!u.pathname.startsWith('/api/')?r.continue():r.fulfill({status:503,json:{}});});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,reminderChoice:'off',selectedSelectorEntityIds:['sport:football'],followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}})));
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden',timeout:60000});await page.waitForFunction(()=>!startupCoordinator.isHydrating());
   await page.evaluate(capture=>{codeInspectorChunk={code:{id:'sport:football'},fixtures:capture.fixtures,standings:capture.standings};},capture);
   for(const width of [320,390])for(const fixture of capture.fixtures)for(const mode of ['feed','schedule'])for(const policy of policies){
    await page.setViewportSize({width,height:844});
    const unchanged=await page.evaluate(({fixture,mode,policy})=>{
     activeTab=mode==='feed'?'feed':'follow';userPreferences.showSpoilers=policy.global;userPreferences.feedControls.spoilers=policy.strict?'strict':policy.global?'results_visible':'standard';updateEventSpoilerState(fixture,{override:policy.override});
     let mount=document.getElementById('qaFootballPrivacy');if(!mount){mount=document.createElement('main');mount.id='qaFootballPrivacy';mount.style.cssText='position:fixed;inset:0;z-index:999999;overflow:auto;padding:8px;background:var(--bg)';document.body.append(mount);}
     setCardState(fixture,'opened');const original=queueLiveFixtureSnapshot,facts=JSON.stringify(fixture),preferences=JSON.stringify(userPreferences);queueLiveFixtureSnapshot=()=>{};
     try{mount.replaceChildren(mode==='feed'?buildEventCard(fixture):buildCodeInspectorFixture(fixture));}finally{queueLiveFixtureSnapshot=original;}
     return facts===JSON.stringify(fixture)&&preferences===JSON.stringify(userPreferences);
    },{fixture,mode,policy});assert(unchanged,'Native card leaves facts and preferences unchanged');
    const table=page.locator('#qaFootballPrivacy .football-card-standings');await table.waitFor({state:'attached',timeout:15000});
    assert.equal(await table.locator('li').count(),policy.visible?2:0,mode+' '+policy.name+' table');
    if(!policy.visible)assert.match(await table.innerText(),/hidden while Results is off/);
    if(fixture.footballMatchContext){const detail=page.locator('#qaFootballPrivacy .football-match-context');await detail.waitFor({state:'attached'});assert.equal(await detail.locator('li').count(),policy.visible?2:0,'Team records obey the same choice');}
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'Tables fit the page');
    checks.push({engine,width,mode,fixtureId:fixture.id,policy:policy.name,passed:true});
   }
   for(const mode of ['feed','schedule'])for(const policy of policies.filter(p=>['fixture hide','fixture show','strict'].includes(p.name))){
    const fixture=capture.sharedNblContextFixture;assert(fixture);await page.setViewportSize({width:390,height:844});
    await page.evaluate(({fixture,mode,policy})=>{activeTab=mode==='feed'?'feed':'follow';userPreferences.showSpoilers=policy.global;userPreferences.feedControls.spoilers=policy.strict?'strict':policy.global?'results_visible':'standard';updateEventSpoilerState(fixture,{override:policy.override});setCardState(fixture,'opened');const original=queueLiveFixtureSnapshot;queueLiveFixtureSnapshot=()=>{};try{document.getElementById('qaFootballPrivacy').replaceChildren(mode==='feed'?buildEventCard(fixture):buildCodeInspectorFixture(fixture));}finally{queueLiveFixtureSnapshot=original;}},{fixture,mode,policy});
    const detail=page.locator('#qaFootballPrivacy .football-match-context');await detail.waitFor({state:'attached'});assert.equal(await detail.locator('li').count(),policy.visible?2:0,'Shared NBL context retains privacy');
    checks.push({engine,width:390,mode,fixtureId:fixture.id,policy:policy.name,sharedNblContext:true,passed:true});
   }
   // Inspector membership can clear before a deferred standings read returns.
   // Change the real fixture choice while the one existing read is held.
   let release,started;const gate=new Promise(r=>release=r),request=new Promise(r=>started=r);let reads=0;
   await page.route('**/data/code-inspector/football.json',async r=>{reads++;started();await gate;await r.fulfill({json:{code:{id:'sport:football'},fixtures:capture.fixtures,standings:capture.standings}});});
   const fixture=capture.fixtures[0];
   await page.evaluate(fixture=>{codeInspectorChunk=null;activeTab='feed';userPreferences.showSpoilers=true;userPreferences.feedControls.spoilers='results_visible';updateEventSpoilerState(fixture,{override:'inherit'});setCardState(fixture,'opened');const original=queueLiveFixtureSnapshot;queueLiveFixtureSnapshot=()=>{};try{document.getElementById('qaFootballPrivacy').replaceChildren(buildEventCard(fixture));}finally{queueLiveFixtureSnapshot=original;}},fixture);
   try{
    let timer;try{await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Deferred table read was not observed')),15000);})]);}finally{clearTimeout(timer);}
    await page.evaluate(fixture=>updateEventSpoilerState(fixture,{override:'hide'}),fixture);
   }finally{release();}
   const late=page.locator('#qaFootballPrivacy .football-card-standings');await late.waitFor({state:'attached'});assert.equal(await late.locator('li').count(),0);assert.match(await late.innerText(),/hidden while Results is off/);assert.equal(reads,1,'Reuse the single existing table read');
   checks.push({engine,mode:'feed',policy:'hide during deferred read',reads,passed:true});assert.deepEqual(errors,[]);
   await context.close();console.log('Football privacy browser: '+engine+' native cards and late loading passed.');
  }finally{await browser.close();}
 }
 if(process.env.QA_OUTPUT)fs.writeFileSync(process.env.QA_OUTPUT,JSON.stringify({checkedAt:new Date().toISOString(),passed:true,base,checks,limits:['Captured real source facts rendered through native Feed and Schedule builders.','Disposable preferences; APIs/providers blocked; no customer, provider or reminder writes.','Browser evidence, not physical-phone use or full Football approval.']},null,2)+'\n');
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
