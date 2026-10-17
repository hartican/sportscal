'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:34109';
async function run(){
 const results=[];
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true,...(engine===chromium?{channel:'chrome'}:{})});
  try{for(const theme of ['day','night']){
   const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let releaseWarm;const warmGate=new Promise(resolve=>{releaseWarm=resolve;});
   await page.route('**/config/startup-view-cache.js*',async route=>{await warmGate;await route.continue();});
   await page.addInitScript(theme=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:24,onboardingComplete:true,theme,showSpoilers:true,selectedSelectorEntityIds:['sport:nrl'],followedSports:['nrl'],fantasyDeadlines:{enabled:false}})),theme);
   const fixture={id:'fixture:nrl:qa-loading',key:'nrl',sport:'NRL',name:'Broncos v Storm',status:'live',startTimeUtc:new Date(Date.now()-3600000).toISOString(),statusCheckedAt:new Date().toISOString(),sourceCheckedAt:new Date().toISOString(),homeParticipantId:'team:nrl:broncos',awayParticipantId:'team:nrl:storm',participantIds:['team:nrl:broncos','team:nrl:storm'],participants:[{id:'team:nrl:broncos',name:'Broncos'},{id:'team:nrl:storm',name:'Storm'}]};
   fixture.date=new Date(Date.now()+11*3600000).toISOString().slice(0,10);
   const observation={...fixture,score:{home:12,away:6},checkedAt:fixture.sourceCheckedAt};
   let memberHold=true,profileHold=false,fail=false,memberRelease,profileRelease;
   await page.route('**/api/**',async route=>{
    const url=route.request().url();
    if(url.includes('scope=athletes')){
     if(profileHold)await new Promise(resolve=>{profileRelease=resolve;});
     return route.fulfill(fail?{status:503,json:{}}:{json:{events:[fixture],athletes:fixture.participants.map(p=>({...p,displayName:p.name,sportKey:'nrl'})),pagination:{nextCursor:null}}});
    }
    if(url.includes('scope=match-centre')||url.includes('membership=everything')){
     if(memberHold)await new Promise(resolve=>{memberRelease=resolve;});
     return route.fulfill(fail?{status:503,json:{}}:{json:{enabled:true,membershipStale:false,events:[fixture],fixtures:[observation],pagination:{nextCursor:null}}});
    }
    if(url.includes('/api/match-centre?'))return route.fulfill({json:{enabled:true,fixtures:[observation]}});
    return route.fulfill({status:503,json:{}});
   });
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
   await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
   await page.locator('.tabs [data-tab=match-centre]').click();
   await page.getByRole('tab',{name:'Everything',exact:true}).click();
   const status=page.locator('.read-loading-status');await status.waitFor();
   assert.match(await status.innerText(),/Loading current fixtures/);
   assert.equal(await status.getAttribute('role'),'status');assert.equal(await status.getAttribute('aria-live'),'polite');
   assert.equal(await status.evaluate(n=>Boolean(n.closest('[aria-busy="true"]'))),false,'Loading announcement is outside busy content');
   await page.waitForFunction(()=>document.querySelector('.read-loading-status'));
   // A genuinely delayed successful response, rather than a warmed retry.
   await new Promise(resolve=>setTimeout(resolve,4000));assert(memberRelease);memberHold=false;memberRelease();
   await page.locator('.match-centre-card').waitFor();await status.waitFor({state:'hidden'});
   const before=await page.locator('.mc-score-cell').allTextContents();assert(before.includes('12')&&before.includes('6'));
   // Idle warm-up and an earlier direct open must execute the same UI once.
   // A second version reinitialises private view/expansion/refresh state.
   await page.evaluate(()=>{void loadDeferredStartupContext();});releaseWarm();await page.evaluate(()=>loadDeferredStartupContext());
   const uiUrls=await page.evaluate(async()=>{const reads=[...loadDeferredScript.requests].filter(([url])=>new URL(url).pathname==='/assets/js/match-centre-ui.js');await Promise.all(reads.map(([,promise])=>promise));return reads.map(([url])=>new URL(url).pathname+new URL(url).search);});
   assert.equal(new Set(uiUrls).size,1,'Idle warm-up and direct navigation must share one Match Centre UI version');
   assert.equal(await page.getByRole('tab',{name:'Everything',exact:true}).getAttribute('aria-selected'),'true','Warm-up cannot reset the chosen view');
   await page.clock.install();memberHold=true;memberRelease=null;
   await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();await status.waitFor();
   assert.match(await status.innerText(),/Existing scores stay visible/);assert.deepEqual(await page.locator('.mc-score-cell').allTextContents(),before);
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await status.evaluate(n=>getComputedStyle(n,'::before').animationName),'none');
   for(const width of [320,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
   assert(memberRelease);fail=true;memberHold=false;memberRelease();await status.waitFor({state:'hidden'});
   await page.getByText('Couldn’t refresh. Showing last available scores.',{exact:true}).waitFor();assert.deepEqual(await page.locator('.mc-score-cell').allTextContents(),before);
   // Navigate away while another refresh is pending. Its finally must not draw over Feed.
   await page.clock.fastForward(10001);fail=false;memberHold=true;memberRelease=null;
   await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();await status.waitFor();
   assert(memberRelease);await page.locator('.tabs [data-tab=feed]').click();memberHold=false;memberRelease();
   await page.waitForFunction(()=>activeTab==='feed');assert.equal(await page.locator('.read-loading-status').count(),0);
   // Profile loading has the same immediate feedback and keeps its existing schedule.
   await page.evaluate(f=>{activeEvents=[f];return openAthleteProfile(f.homeParticipantId,'Broncos','nrl');},fixture);
   await page.locator('.participant-profile-header').waitFor();await page.locator('.participant-calendar-row').first().waitFor();
   await page.locator('.read-loading-status').waitFor({state:'hidden'});
   const rowsBefore=await page.locator('.participant-calendar-row').allTextContents();assert(rowsBefore.length);
   profileHold=true;profileRelease=null;await page.clock.fastForward(10001);
   await page.getByRole('button',{name:'Refresh',exact:true}).click();const loading=page.locator('.read-loading-status');await loading.waitFor();
   assert.equal(await page.locator('.athletes-profile-fixtures').getAttribute('aria-busy'),'true');
   assert.equal(await loading.evaluate(n=>Boolean(n.closest('[aria-busy="true"]'))),false);
   assert.deepEqual(await page.locator('.participant-calendar-row').allTextContents(),rowsBefore);assert(profileRelease);
   fail=true;profileHold=false;profileRelease();await loading.waitFor({state:'hidden'});
   await page.getByText('Showing available information. Refresh to check for updates.',{exact:true}).waitFor();
   assert.deepEqual(await page.locator('.participant-calendar-row').allTextContents(),rowsBefore);
   // An older degraded notice cannot suppress the next loading indicator.
   await page.clock.fastForward(10001);profileHold=true;profileRelease=null;fail=false;
   await page.getByRole('button',{name:'Refresh',exact:true}).click();await loading.waitFor();
   assert(await page.getByText('Showing available information. Refresh to check for updates.',{exact:true}).isVisible());
   assert(profileRelease);await page.locator('.tabs [data-tab=feed]').click();profileHold=false;profileRelease();
   await page.waitForFunction(()=>activeTab==='feed');await page.evaluate(()=>new Promise(requestAnimationFrame));
   assert.equal(await page.locator('.participant-profile-header').count(),0);assert.equal(await page.locator('.read-loading-status').count(),0);assert.deepEqual(errors,[]);
   results.push({engine:engine.name(),theme,passed:true,initialDelayMs:4000,retainedMatchScores:true,retainedProfileSchedule:true,failureAndNavigation:true,accessibleStatus:true,reducedMotion:true,widths:[320,390,1280]});
   await page.close();console.log(engine.name()+' '+theme+': loading, retention, failure and navigation passed');
  }}finally{await browser.close();}
 }
 if(process.env.NS_LOADING_QA_DIR){fs.mkdirSync(process.env.NS_LOADING_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.NS_LOADING_QA_DIR,'summary.json'),JSON.stringify({passed:true,results,noProductionRequests:true},null,2)+'\n');}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
