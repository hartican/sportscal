'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [320,390,768,1280])for(const colorScheme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:844},colorScheme,serviceWorkers:'block'}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  const fixture={id:'fixture:nrl:qa',eventId:'fixture:nrl:qa',key:'nrl',gender:'men',name:'Penrith Panthers v Melbourne Storm',status:'live',startTimeUtc:new Date(Date.now()-600000).toISOString(),homeParticipantId:'team:nrl:4',awayParticipantId:'team:nrl:3',participantIds:['team:nrl:4','team:nrl:3']};
  await page.addInitScript(()=>{globalThis.NOTHINGSPORTS_MATCH_CENTRE_ENABLED=true;localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:nrl'],followedSports:['nrl']}));});
  await page.route('**/api/**',route=>{const url=route.request().url();requests.push(url);if(url.includes('scope=match-centre'))return route.fulfill({json:{events:[fixture],pagination:{nextCursor:null}}});if(url.includes('/api/match-centre?'))return route.fulfill({json:{enabled:true,fixtures:[{id:fixture.id,status:'live',score:{home:18,away:12},homeParticipantId:fixture.homeParticipantId,awayParticipantId:fixture.awayParticipantId,checkedAt:new Date().toISOString(),officialUrl:'https://www.nrl.com/draw/'}]}});return route.fulfill({status:503,json:{}});});
  await page.goto(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:33962');
  await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&!startupCoordinator.isHydrating());
  await page.getByRole('button',{name:'Match Centre',exact:true}).click();
  await page.locator('.match-centre-card').waitFor();
  assert(await page.getByText('Results hidden',{exact:true}).isVisible());assert.equal(await page.locator('.match-centre-score').count(),0);
  await page.evaluate(()=>{userPreferences.showSpoilers=true;renderAll();});
  await page.waitForFunction(()=>document.querySelector('.match-centre-score')?.textContent.includes('18'));
  assert.equal(await page.locator('.match-centre-card .nsc-widget').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'no horizontal overflow');
  assert.equal(requests.filter(u=>u.includes('/api/match-centre?')).length,1,'coalesced score fetch');
  assert(!requests.some(u=>u.includes('/api/fixtures?')),'no full Feed live rebuild on Match Centre');
  assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:/^Feed/}).click();await page.waitForFunction(()=>activeTab==='feed');
  console.log(`${width} ${colorScheme}: navigation, spoiler safety, bounded polling and layout passed`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
