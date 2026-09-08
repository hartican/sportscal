#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
 await page.evaluate(async()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.followFirst.refinement.promptedAt=new Date().toISOString();savePreferences(next);document.getElementById("settingsModal").classList.remove("show");await loadMajorEventsData();});
 for(const family of ['cincinnati-open','rugby-league-world-cup','australian-grand-prix']){
  const build=async()=>page.evaluate(family=>{document.getElementById('event-process-test')?.remove();const parent=majorEventsDocument.events.find(e=>MAJOR_EVENTS.eventFamilyId(e)===family);setCardState(parent,'selected');const host=document.createElement('div');host.id='event-process-test';host.appendChild(buildMajorEventCard(parent));document.body.appendChild(host);},family);
  await build();await page.locator('#event-process-test .major-event-family-follow').click();
  assert(await page.evaluate(f=>userPreferences.followFirst.followedMajorEventIds.includes(f),family),family+' explicit follow persists');
  await build();await page.locator('#event-process-test .major-event-family-follow').click();
  assert(await page.evaluate(f=>userPreferences.followFirst.excludedMajorEventIds.includes(f),family),family+' Events button sets exclusion');
  await build();await page.locator('#event-process-test .major-event-family-follow').click();
  assert(!await page.evaluate(f=>userPreferences.followFirst.excludedMajorEventIds.includes(f),family),family+' refollow clears exclusion');
 }
 await page.evaluate(()=>document.getElementById('event-process-test')?.remove());
 const id=await page.evaluate(async()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.followFirst.refinement.promptedAt=new Date().toISOString();next.followFirst.followedMajorEventIds=['us-open'];next.followFirst.startupMeta.majorEvents=['us-open'];next.selectedSelectorEntityIds=['sport:tennis'];next.followedSports=['tennis'];savePreferences(next);await loadFollowedScheduleFixtures();activeEvents=normalizeEvents(mergeFootballFixtureEvents(activeEvents));const fixture=activeEvents.find(e=>e.parentEventId==='major-event:us-open-2026'&&e.participantIds?.length&&eventMeetsDerivedRetention(e));if(!fixture)throw Error('US Open fixture absent');const selected=clonePreferences(userPreferences);selected.preferenceGraph.entityFollows=[{participantId:fixture.participantIds[0],followLevel:'follow'}];savePreferences(selected);eventActions[eventActionKey(fixture)]={...getEventAction(fixture),addedToFixtures:true,reminderRequested:true};saveEventActions(eventActions);renderAll();return fixture.id;});
 const saved=await page.evaluate(id=>JSON.stringify(getEventAction({id,eventId:id})),id);
 assert(await page.evaluate(id=>Boolean(eventFollowReason(activeEvents.find(e=>e.id===id))),id));
 await page.evaluate(()=>toggleMajorEventFollow('us-open'));
 assert.equal(await page.evaluate(()=>activeEvents.filter(e=>FOLLOW_FEED_POLICY.explicitlyExcluded(e,userPreferences)&&eventFollowReason(e)).length),0);
 assert.equal(await page.locator(`[data-feed-event-id="${id}"]`).count(),0,'unfollow removes card from DOM immediately');
 assert.equal(await page.evaluate(id=>JSON.stringify(getEventAction({id,eventId:id})),id),saved,'reminder and pin state retained');
 await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());
 assert(await page.evaluate(()=>userPreferences.followFirst.excludedMajorEventIds.includes('us-open')),'unfollow persists with failed APIs');
 assert(!await page.evaluate(()=>userPreferences.followFirst.followedMajorEventIds.includes('us-open')),'onboarding cannot silently refollow');
 assert.equal(await page.locator(`[data-feed-event-id="${id}"]`).count(),0,'cached fallback respects unfollow');
 await page.evaluate(()=>toggleMajorEventFollow('us-open'));
 await page.waitForFunction(id=>{const event=activeEvents.find(e=>e.id===id);return event&&eventFollowReason(event);},id);
 assert.equal(await page.evaluate(id=>JSON.stringify(getEventAction({id,eventId:id})),id),saved,'refollow restores the saved state');
 console.log('US Open unfollow/refollow: immediate removal, reload with failed APIs, no automatic reseed and preserved card state passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
