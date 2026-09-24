'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [320,390,768,1280])for(const colorScheme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:844},colorScheme,serviceWorkers:'block'});
  const tie={...require('../data/canonical/tennis-team-contests.v1.json').fixtures.find(f=>f.id==='fixture:tennis:bjk-cup:2026:finals:qf4'),status:'live',score:'1-0'};
  await page.route('**/api/**',route=>{const url=route.request().url();if(url.includes('scope=match-centre'))return route.fulfill({json:{events:[tie],pagination:{nextCursor:null}}});if(url.includes('/api/match-centre?'))return route.fulfill({json:{enabled:true,fixtures:[require('../config/match-centre').compact(tie,{rubbers:url.includes('rubbers=1')})]}});return route.fulfill({status:503,json:{}});});
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:tennis'],followedSports:['tennis'],showSpoilers:true})));
  await page.goto('http://127.0.0.1:33962');await page.waitForFunction(()=>typeof buildEventCard==='function'&&!startupCoordinator.isHydrating());
  const fixture=require('../data/canonical/tennis-team-contests.v1.json').fixtures.find(f=>f.id==='fixture:tennis:bjk-cup:2026:finals:sf2');
  await page.evaluate(f=>{activeTab='feed';userPreferences.showSpoilers=true;setCardState(f,'opened');document.getElementById('listView').replaceChildren(buildEventCard(f));},fixture);
  const card=page.locator('.tennis-team-tie');await card.waitFor();
  assert.equal(await card.locator('.event-hero-mark,.event-icon').count(),0,'no empty tennis hero');
  const box=await card.boundingBox();assert(box.height<650,`tie card ${box.height}px must remain compact`);
  if(width===390&&colorScheme==='dark')await page.screenshot({path:'/tmp/bjk-compact-tie-390.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
  await page.getByRole('button',{name:'Match Centre',exact:true}).click();await page.locator('.match-centre-card').waitFor();
  assert.match(await page.locator('.match-centre-score').innerText(),/China: 1.*Italy: 0/);
  await page.locator('.match-centre-card summary').click();await page.waitForFunction(()=>document.querySelector('.match-centre-card details')?.textContent.includes('6–0'));
  assert.match(await page.locator('.match-centre-card details').innerText(),/Zhang Shuai v Elisabetta Cocciaretto: 6–0\s+6–2/);
  await page.evaluate(()=>{userPreferences.showSpoilers=false;renderAll();});assert.equal(await page.locator('.match-centre-score,.match-centre-card details').count(),0);
  console.log(`${width} ${colorScheme}: tie height ${Math.round(box.height)}px, no empty hero/overflow; real tie/rubber scores and spoilers passed`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
