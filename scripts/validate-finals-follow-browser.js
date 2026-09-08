#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
 await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.followFirst.refinement.promptedAt=new Date().toISOString();next.selectedSelectorEntityIds=['sport:afl-premiership','sport:nrl'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);next.preferenceGraph.domainPreferences=[{sportDomainId:'sport:afl',enabled:false},{sportDomainId:'sport:afl-premiership',enabled:true},{sportDomainId:'sport:nrl',enabled:true}];next.feedCompact=false;savePreferences(next);});
 await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());
 const id='event:afl:cd_m20260142701';
 const slot=page.locator(`[data-feed-event-id="${id}"]`);await slot.scrollIntoViewIfNeeded();await slot.locator('.event-card').waitFor();
 await page.locator('.tab-btn[data-tab=follow]').click();
 await page.evaluate(async()=>{await loadCodeInspectorManifest();await openCodeInspector('sport:afl',{startingTab:'all-fixtures'});});
 const result=await page.evaluate(id=>{const fixture=codeInspectorChunk.fixtures.find(e=>e.id===id);const card=buildCodeInspectorFixture(fixture);document.querySelector('#listView').appendChild(card);return {name:fixture.name,action:card.querySelector('.code-inspector-feed-action')?.textContent,reason:automaticEventFollowReason(canonicalFeedFixtureForInspector(fixture))};},id);
 console.log(JSON.stringify(result));assert.equal(result.action,'In Feed','followed final must not ask the user to Add to Feed again');
 await page.evaluate(async()=>{await openCodeInspector('sport:nrl',{startingTab:'all-fixtures'});const old={id:'major-match:nrl-finals-2026:elimination-final-1',key:'nrl',name:'Elimination Final 1 - 5th v 8th',date:'',time:null,scheduleStatus:'provisional',participantSlots:[{label:'5th'},{label:'8th'}]};liveFixtureEvents=[old];codeInspectorChunk.fixtures=liveScheduleFixtures(codeInspectorChunk.fixtures);});
 const nrl=await page.evaluate(()=>{const fixture=codeInspectorChunk.fixtures.find(e=>e.id==='major-match:nrl-finals-2026:elimination-final-1');const card=buildCodeInspectorFixture(fixture);return{name:fixture.name,date:fixture.date,time:fixture.time,action:card.querySelector('.code-inspector-feed-action')?.textContent};});
 assert.equal(nrl.name,'Sharks v Cowboys');assert.equal(nrl.date,'2026-09-12');assert.equal(nrl.time,'19:50');assert.equal(nrl.action,'In Feed');
 console.log(JSON.stringify(nrl));
 console.log('Finals appear in Feed and Follow schedule accurately reports their admission.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
