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
    const overflow=await tennis.locator('.major-event-matchup-player').evaluateAll(nodes=>nodes.filter(node=>[...node.children].some(child=>child.getBoundingClientRect().right>node.getBoundingClientRect().right+1 || child.getBoundingClientRect().left<node.getBoundingClientRect().left-1)).map(node=>node.textContent));
    assert.deepEqual(overflow,[],`${width}px Tennis names must not overlap`);
   }
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
   const clipped=await doublesCard.locator('.major-event-matchup-player').evaluateAll(nodes=>nodes.filter(n=>[...n.children].some(c=>c.getBoundingClientRect().right>n.getBoundingClientRect().right+1)).length);
   assert.equal(clipped,0,'doubles names stay within their sides');
   await doublesCard.screenshot({path:`/private/tmp/compact-doubles-${width}.png`});
   await page.evaluate(()=>document.getElementById('compact-doubles-test').remove());
   await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);
   await page.locator('.tab-btn[data-tab=events]').click();await page.waitForTimeout(300);
   await page.locator('.tab-btn[data-tab=feed]').click();await page.waitForFunction(()=>document.querySelector('.feed-card-slot .is-compact-row'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow');
   await context.close();console.log(`${width}px compact geometry and expand/collapse passed`);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
