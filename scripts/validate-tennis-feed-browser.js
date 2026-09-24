#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [320,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:tennis'],followedSports:['tennis'],followFirst:{followedMajorEventIds:['davis-cup']}})));
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  await page.goto(process.env.TENNIS_QA_URL||'http://127.0.0.1:33959');
  await page.waitForFunction(()=>typeof loadTennisFeedParents==='function'&&typeof userPreferences==='object');
  await page.evaluate(async()=>{await loadTennisFeedParents();activeTab='feed';renderAll();});
  await page.locator('.tennis-feed-parent').first().waitFor();
  const actual=await page.locator('.tennis-feed-parent').allTextContents();assert(actual.some(t=>t.includes('Davis Cup')),'followed Davis Cup parent in real Feed');
  const result=await page.evaluate(async()=>{
   const date=formatDateKey(nowAEST()),fixture={id:'qa-tennis-match',eventId:'qa-tennis-match',key:'tennis',name:'Player One v Player Two',participantIds:['athlete:tennis:qa-one','athlete:tennis:qa-two'],date,time:'23:00',roundLabel:'Quarterfinal',status:'upcoming',tournamentId:'qa-tournament',eventFamilyId:'qa-open'};
   const parent=NOTHINGSPORTS_TENNIS_FEED.buildParents({tournaments:[{tournamentId:'qa-tournament',name:'QA Open',season:2026,tour:'ATP',startDate:date,endDate:date,eventSeriesId:'event-series:qa-open',sourceUrl:'https://example.org/schedule'}]},[fixture])[0];
   tennisFeedContestDocument={fixtures:[fixture]};userPreferences.followFirst.followedMajorEventIds.push('qa-open');tennisFeedParentDocument.parents.push(parent);activeEvents.push(fixture);renderAll();
   return {parentId:parent.id,fixtureId:fixture.id};
  });
  const card=page.locator(`.tennis-feed-parent[data-event-id="${result.parentId}"]`);await card.locator('summary').click();
  await card.getByRole('button',{name:'Add to Feed',exact:true}).click();
  assert(await page.evaluate(()=>getEventAction({id:'qa-tennis-match',eventId:'qa-tennis-match'}).addedToFixtures));
  assert(!(await page.evaluate(()=>getEventAction({id:'qa-tennis-match',eventId:'qa-tennis-match'}).reminderRequested)));
  await page.locator(`.tennis-feed-parent[data-event-id="${result.parentId}"] summary`).click();
  await page.locator(`.tennis-feed-parent[data-event-id="${result.parentId}"]`).getByRole('button',{name:'In Feed',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'no horizontal overflow');
  assert.equal(await page.locator(`.tennis-feed-parent[data-event-id="${result.parentId}"] .nsc-widget`).count(),0,'parent has no fixture ratings');
  if(width===390)await page.screenshot({path:'/Users/jackhartican/Documents/AI/Codex/tennis-feed-normalisation/mobile-feed.png'});
  assert.deepEqual(errors,[],'no uncaught browser errors');console.log(width,'parent Feed, selection, In Feed row and responsive layout passed');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
