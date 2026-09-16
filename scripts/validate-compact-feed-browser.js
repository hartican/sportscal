#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of (process.env.COMPACT_QA_WIDTHS||'320,390,768,1280').split(',').map(Number)){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();
   await page.route('**/api/fixtures*',route=>route.fulfill({status:304}));
   await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');
   await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
   await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.selectedSelectorEntityIds=['sport:afl-premiership','sport:nrl','sport:f1','sport:tennis'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);next.preferenceGraph={...next.preferenceGraph,entityFollows:[{participantId:'athlete:tennis:alexander-zverev',followLevel:'follow'},{participantId:'athlete:tennis:carlos-alcaraz',followLevel:'follow'}]};next.feedCompact=false;next.theme="night";next.followFirst.refinement.promptedAt=new Date().toISOString();savePreferences(next);});
   await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&document.querySelector('.feed-card-slot .event-card'));
   await page.getByRole('button',{name:'Collapse all cards',exact:true}).click();
   await page.waitForFunction(()=>userPreferences.feedCompact&&document.querySelector('.feed-card-slot .is-compact-row'));
   await page.waitForTimeout(500);
   const geometry=await page.evaluate(()=>[...document.querySelectorAll('.feed-card-slot:has(.is-compact-row)')].map(slot=>{const card=slot.querySelector('.event-card');return{id:slot.dataset.feedEventId,slot:slot.getBoundingClientRect().height,card:card.getBoundingClientRect().height};}));
   const oversized=geometry.filter(row=>row.slot-row.card>4);
   await page.screenshot({path:`/private/tmp/compact-feed-${width}.png`});
   assert.deepEqual(oversized,[],`${width}px compact cards must not retain expanded slot height`);
   const tennis=page.locator('.feed-card-slot:has(.compact-card-name .major-event-matchup-sides)').first();
   if(await tennis.count()){
    await tennis.scrollIntoViewIfNeeded();
    assert(await tennis.locator('.compact-format-badge').count(),`${width}px Tennis compact card must show its sourced format`);
    const players=await tennis.locator('.major-event-matchup-player').count();
    assert.equal(await tennis.locator('.major-event-matchup-player .country-flag').count(),players,`${width}px Tennis compact card must show a flag for every player with sourced nationality`);
    const overflow=await tennis.locator('.major-event-matchup-player').evaluateAll(nodes=>nodes.filter(node=>[...node.children].some(child=>child.getBoundingClientRect().right>node.getBoundingClientRect().right+1 || child.getBoundingClientRect().left<node.getBoundingClientRect().left-1)).map(node=>node.textContent));
    assert.deepEqual(overflow,[],`${width}px Tennis names must not overlap`);
   }
   const team=page.locator('.feed-card-slot .compact-matchup-grid:has(.compact-matchup-side)').first();
   if(await team.count()){
    assert.equal(await team.locator('.compact-matchup-side').count(),2,`${width}px team compact card must keep both participants`);
    assert.equal(await team.locator('.compact-participant-mark,.compact-participant-fallback').count(),2,`${width}px team compact card must show two crests or neutral fallbacks`);
   }
   assert.equal(await page.locator('.feed-card-slot .is-compact-row .compact-card-icon,.feed-card-slot .is-compact-row .event-brand-logo,.feed-card-slot .is-compact-row .event-sport-logo').count(),0,`${width}px compact cards must not depend on event or sport logos`);
   await page.getByRole('button',{name:'Expand all cards',exact:true}).click();
   await page.waitForFunction(()=>!userPreferences.feedCompact&&!document.querySelector('.feed-card-slot .is-compact-row'));
   await page.getByRole('button',{name:'Collapse all cards',exact:true}).click();await page.waitForTimeout(350);
   assert(await page.locator('.feed-card-slot .event-card').count()<=60);
   await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&document.querySelector('.feed-card-slot .is-compact-row'));
   assert(await page.evaluate(()=>userPreferences.feedCompact),'compact preference persists');
   const expandedGaps=await page.evaluate(()=>[...document.querySelectorAll('.feed-card-slot:has(.is-compact-row)')].filter(slot=>slot.getBoundingClientRect().height-slot.firstElementChild.getBoundingClientRect().height>4).length);
   assert.equal(expandedGaps,0,'cold compact slots fit their cards');
   const doubles=require('../lib/competition-fixtures').fixtures().find(e=>e.key==='tennis'&&e.participantIds?.length===4&&e.matchupSides?.length===2);
   assert(doubles,'source doubles fixture exists');
   await page.evaluate(e=>{const holder=document.createElement('div');holder.id='compact-doubles-test';holder.appendChild(buildEventCard(e));document.querySelector('#listView').appendChild(holder);},doubles);
   const doublesCard=page.locator('#compact-doubles-test');await doublesCard.scrollIntoViewIfNeeded();
   assert.equal(await doublesCard.locator('.major-event-matchup-player').count(),4,'doubles retains all four names');
   assert.equal(await doublesCard.locator('.major-event-matchup-player .country-flag').count(),4,'doubles restores a country flag beside every player');
   assert.match(await doublesCard.locator('.compact-format-badge').textContent(),/Doubles/,'doubles format takes the centre tag');
   const clipped=await doublesCard.locator('.major-event-matchup-player').evaluateAll(nodes=>nodes.filter(n=>[...n.children].some(c=>c.getBoundingClientRect().right>n.getBoundingClientRect().right+1)).length);
   assert.equal(clipped,0,'doubles names stay within their sides');
   await doublesCard.screenshot({path:`/private/tmp/compact-doubles-${width}.png`});
   await page.evaluate(()=>document.getElementById('compact-doubles-test').remove());
   await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);
   await page.locator('.tab-btn[data-tab=events]').click();await page.waitForTimeout(300);
   await page.locator('.tab-btn[data-tab=feed]').click();await page.waitForFunction(()=>document.querySelector('.feed-card-slot .is-compact-row'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow');
   await page.evaluate(()=>{sessionStorage.setItem('nothingsport:service-worker-reload.v1',JSON.stringify({savedAt:Date.now(),activeTab:'feed',activeView:'month',activeFilter:'all',scrollY:120}));location.reload();});
   await page.waitForFunction(()=>typeof startupCoordinator!=='undefined'&&!startupCoordinator.isHydrating()&&document.querySelector('.feed-card-slot .event-card'));
   await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>activeView),'list','saved Month View sessions migrate to List View');
   assert.equal(await page.locator('#monthView,[data-view=month]').count(),0,'retired Month View controls and container stay absent');
   await context.close();console.log(`${width}px compact geometry and expand/collapse passed`);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
