'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:33962';
(async()=>{for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:nrl'],followedSports:['nrl']})));
  let scoreReads=0,memberReads=0,fail=false,release=null,hold=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const fixture={id:'fixture:cricket:espn:1525655',eventId:'fixture:cricket:espn:1525655',key:'cricket',gender:'men',name:'South Africa v Australia',status:'live',startTimeUtc:new Date(Date.now()-3600000).toISOString(),homeParticipantId:'team:cricket:south-africa',awayParticipantId:'team:cricket:australia'};
  await page.route('**/api/**',async route=>{const u=route.request().url();if(u.includes('scope=match-centre')){memberReads++;return route.fulfill({json:{events:[fixture],pagination:{nextCursor:null}}});}if(u.includes('/api/match-centre?')){scoreReads++;if(hold)await new Promise(r=>{release=r;});return route.fulfill(fail?{status:503,json:{}}:{json:{enabled:true,fixtures:[{...fixture,score:{innings:[{team:'South Africa Men',runs:235,wickets:5,overs:'44.1'}]},checkedAt:new Date().toISOString()}]}});}return route.fulfill({status:503,json:{}});});
  await page.goto(origin);await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&!startupCoordinator.isHydrating());
  await page.getByRole('button',{name:'Match Centre',exact:true}).click();await page.locator('.match-centre-card').waitFor();
  await page.waitForFunction(()=>document.querySelector('.match-centre-card small')||document.querySelector('.match-centre-card')?.textContent.includes('Results hidden'));
  await page.evaluate(()=>{userPreferences.showSpoilers=true;renderAll();});await page.getByText('South Africa Men 235/5 (44.1 overs)',{exact:true}).waitFor();
  await page.clock.install();
  const touch=async(type,y,x=80,selector='.match-centre-card')=>page.evaluate(({type,y,x,selector})=>{const target=document.querySelector(selector),e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'||type==='touchcancel'?[]:[{clientX:x,clientY:y}]});target.dispatchEvent(e);},{type,y,x,selector});
  let initial=scoreReads,initialMembers=memberReads;await touch('touchstart',300);await touch('touchmove',340);await touch('touchend',340);assert.equal(scoreReads,initial,'short pull cancels');
  await touch('touchstart',300,80,'[aria-label="Refresh Match Centre"]');await touch('touchmove',410);await touch('touchend',410);assert.equal(scoreReads,initial,'interactive controls do not start a pull');
  await page.evaluate(()=>scrollTo(0,40));await touch('touchstart',300);await touch('touchmove',410);await touch('touchend',410);assert.equal(scoreReads,initial,'off-top pull ignored');await page.evaluate(()=>scrollTo(0,0));
  await touch('touchstart',300);await touch('touchmove',410);await touch('touchcancel',410);assert.equal(scoreReads,initial,'touch cancellation does not refresh');
  await touch('touchstart',300);await touch('touchmove',330,180);await touch('touchend',330,180);assert.equal(scoreReads,initial,'horizontal drag ignored');
  hold=true;await touch('touchstart',300);await touch('touchmove',400);assert.equal(scoreReads,initial,'holding cannot refresh before release');
  assert(await page.locator('.mc-refresh-indicator.visible').count());await touch('touchend',400);
  await page.waitForFunction(()=>document.querySelector('.mc-refresh-indicator.loading'));
  // Wait for the coalesced score request to reach the stub, without fixed sleeps.
  for(let i=0;!release&&i<100;i++)await page.evaluate(()=>new Promise(requestAnimationFrame));
  assert(release,'manual refresh reaches score API');assert.equal(scoreReads,initial+1);assert.equal(memberReads,initialMembers+1);
  release();hold=false;await page.getByText('Latest available scores loaded.',{exact:true}).waitFor();assert.equal(await page.locator('.mc-refresh-indicator.loading').count(),0);
  await page.getByRole('button',{name:'Refresh Match Centre'}).click();assert.equal(scoreReads,initial+1,'cooldown prevents duplicate requests');
  await page.clock.fastForward(10001);fail=true;await page.getByRole('button',{name:'Refresh Match Centre'}).click();await page.getByText('Couldn’t refresh. Showing last available scores.',{exact:true}).waitFor();
  assert(await page.getByText('South Africa Men 235/5 (44.1 overs)',{exact:true}).isVisible());assert.equal(await page.locator('.mc-refresh-indicator.loading').count(),0);
  await page.clock.fastForward(10001);fail=false;hold=true;release=null;await page.getByRole('button',{name:'Refresh Match Centre'}).click();
  for(let i=0;!release&&i<100;i++)await page.evaluate(()=>new Promise(requestAnimationFrame));assert(release);
  await page.getByRole('button',{name:/^Feed/}).click();release();hold=false;assert.equal(await page.locator('.mc-refresh-indicator.loading').count(),0);
  assert.equal(await page.locator('.match-centre-card').count(),0,'late refresh cannot redraw Feed');assert.deepEqual(errors,[]);
  console.log(`${engine.name()}: threshold, release, wheel, cooldown, failure retention and navigation race passed`);
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
