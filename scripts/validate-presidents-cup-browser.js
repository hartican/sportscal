'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 for(const width of [320,390,768,1280])for(const colorScheme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:844},colorScheme,serviceWorkers:'block'}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  const fixture={...require('../data/canonical/pga-tour-schedule.json').presidentsCup[0],status:'live',homeScore:3.5,awayScore:2.5};
  await page.addInitScript(()=>{globalThis.NOTHINGSPORTS_MATCH_CENTRE_ENABLED=true;localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:golf'],followedSports:['golf']}));});
  await page.route('**/api/**',route=>{const url=route.request().url();requests.push(url);if(url.includes('scope=match-centre'))return route.fulfill({json:{events:[fixture],pagination:{nextCursor:null}}});if(url.includes('/api/match-centre?'))return route.fulfill({json:{enabled:true,fixtures:[{id:fixture.id,status:'live',score:{home:3.5,away:2.5},homeParticipantId:fixture.homeParticipantId,awayParticipantId:fixture.awayParticipantId,checkedAt:new Date().toISOString(),officialUrl:'https://www.presidentscup.com/scoring'}]}});return route.fulfill({status:503,json:{}});});
  await page.goto(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:33981');
  await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&!startupCoordinator.isHydrating());
  const admission=await page.evaluate(async()=>{
   await loadFollowedScheduleFixtures();
   const broad=mergeMainFeedSpecialEvents(getFilteredEvents()).filter(e=>e.eventFamilyId==='presidents-cup').map(e=>e.id);
   userPreferences=mergePreferences({onboardingComplete:true,selectedSelectorEntityIds:[],followedSports:[],preferenceGraph:{domainPreferences:[]},followFirst:{followedMajorEventIds:['presidents-cup']}});await loadFollowedScheduleFixtures();
   const direct=mergeMainFeedSpecialEvents(getFilteredEvents()).filter(e=>e.eventFamilyId==='presidents-cup').map(e=>e.id);
   return {broad,direct};
  });
  assert.deepEqual(admission.broad,[fixture.id]);assert.equal(new Set(admission.direct).size,6,'direct Cup follow admits sourced sessions once');
  await page.route('**/data/follow-schedule/golf.json',route=>route.abort());
  const cached=await page.evaluate(async()=>{activeEvents=[];await loadFollowedScheduleFixtures();return mergeMainFeedSpecialEvents(getFilteredEvents()).filter(e=>e.eventFamilyId==='presidents-cup').map(e=>e.id);});
  assert.equal(new Set(cached).size,6,'last-good schedule survives an unavailable source');
  await page.unroute('**/data/follow-schedule/golf.json');
  await page.getByRole('button',{name:'Match Centre',exact:true}).click();
  await page.locator('.match-centre-card').waitFor();
  assert(await page.getByText('Results hidden',{exact:true}).isVisible());assert.equal(await page.locator('.match-centre-score').count(),0);
  await page.evaluate(()=>{userPreferences.showSpoilers=true;renderAll();});
  await page.waitForFunction(()=>document.querySelector('.match-centre-score')?.textContent.includes('3.5'));
  assert.match(await page.locator('.match-centre-score').innerText(),/USA: 3.5.*International: 2.5/);
  assert.equal(await page.locator('.match-centre-card a[href="https://www.presidentscup.com/scoring"]').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'no horizontal overflow');
  assert.equal(requests.filter(u=>u.includes('/api/match-centre?')).length,1,'coalesced score fetch');
  assert(!requests.some(u=>u.includes('/api/fixtures?')),'no full Feed live rebuild on Match Centre');
  assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:/^Feed/}).click();await page.waitForFunction(()=>activeTab==='feed');
  console.log(`${width} ${colorScheme}: navigation, spoiler safety, bounded polling and layout passed`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
