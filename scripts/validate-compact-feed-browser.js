#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const screenshotDir=process.env.QA_SCREENSHOT_DIR||'/Users/jackhartican/Documents/AI/Codex/compact-cards-ratings-2026-10-13';fs.mkdirSync(screenshotDir,{recursive:true});
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const engine=process.env.QA_BROWSER||'chromium',browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||'chrome'}));
 try{
  for(const width of (process.env.COMPACT_QA_WIDTHS||'320,390,768,1280').split(',').map(Number)){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();
   await page.route('**/api/fixtures*',route=>route.fulfill({status:503,json:{error:'Controlled published-data fallback'}}));
   await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');
   await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
   await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.selectedSelectorEntityIds=['sport:afl-premiership','sport:nrl','sport:f1','sport:tennis'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);next.preferenceGraph={...next.preferenceGraph,entityFollows:[{participantId:'athlete:tennis:alexander-zverev',followLevel:'follow'},{participantId:'athlete:tennis:carlos-alcaraz',followLevel:'follow'}]};next.feedCompact=false;next.theme="night";next.followFirst.refinement.promptedAt=new Date().toISOString();savePreferences(next);});
   await page.reload();await page.waitForFunction(()=>typeof startupCoordinator!=='undefined'&&!startupCoordinator.isHydrating()&&document.querySelector('.feed-card-slot .event-card'));
   await page.getByRole('button',{name:'Collapse all cards',exact:true}).click();
   await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&userPreferences.feedCompact&&document.querySelector('.feed-card-slot .is-compact-row'));
   await page.waitForTimeout(500);
   const geometry=await page.evaluate(()=>[...document.querySelectorAll('.feed-card-slot:has(.is-compact-row)')].map(slot=>{const card=slot.querySelector('.event-card');return{id:slot.dataset.feedEventId,slot:slot.getBoundingClientRect().height,card:card.getBoundingClientRect().height};}));
   const oversized=geometry.filter(row=>row.slot-row.card>4);
   await page.screenshot({path:path.join(screenshotDir,`compact-feed-${engine}-${width}.png`)});
   assert.deepEqual(oversized,[],`${width}px compact cards must not retain expanded slot height`);
   const rows=await page.locator('.feed-card-slot .is-minimised-row').evaluateAll(cards=>cards.map(card=>({height:card.getBoundingClientRect().height,nested:card.querySelectorAll('a,button,input,summary').length,details:card.querySelectorAll('.feed-live-score,.nsc-summary,.fixture-venue,.event-quick-actions,.fixture-card-footer').length,marks:[...card.querySelectorAll('.minimised-participant-frame')].map(n=>n.getBoundingClientRect().width),name:card.querySelector('.minimised-card-name')?.textContent,time:card.querySelector('.minimised-card-time')?.textContent,aria:card.querySelector('.minimised-card-summary')?.getAttribute('aria-label')})));
   assert(rows.length,'Feed has true minimised rows');
   for(const row of rows){assert.equal(Math.round(row.height),56,'every minimised card is one fixed-height row');assert.equal(row.nested,1,'native row button is its sole activation target');assert.equal(row.details,0,'minimised cards omit body detail');assert(row.name&&row.time&&row.aria,'names and source time/status remain');for(const size of row.marks)assert.equal(Math.round(size),20,'minimised artwork frames are tiny');}
   await page.getByRole('button',{name:'Expand all cards',exact:true}).click();
   await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!userPreferences.feedCompact&&!document.querySelector('.feed-card-slot .is-compact-row'));
   await page.getByRole('button',{name:'Collapse all cards',exact:true}).click();await page.waitForTimeout(350);
   assert(await page.locator('.feed-card-slot .event-card').count()<=60);
   await page.reload();await page.waitForFunction(()=>typeof startupCoordinator!=='undefined'&&!startupCoordinator.isHydrating()&&document.querySelector('.feed-card-slot .is-compact-row'));
   assert(await page.evaluate(()=>typeof userPreferences!=='undefined'&&userPreferences.feedCompact),'compact preference persists');
   const expandedGaps=await page.evaluate(()=>[...document.querySelectorAll('.feed-card-slot:has(.is-compact-row)')].filter(slot=>slot.getBoundingClientRect().height-slot.firstElementChild.getBoundingClientRect().height>4).length);
   assert.equal(expandedGaps,0,'cold compact slots fit their cards');
   const doubles=require('../lib/competition-fixtures').fixtures().find(e=>e.key==='tennis'&&e.participantIds?.length===4&&e.matchupSides?.length===2);
   assert(doubles,'source doubles fixture exists');
   await page.evaluate(e=>{setCardState(e,'selected');const holder=document.createElement('div');holder.id='compact-doubles-test';holder.appendChild(buildEventCard(e));document.querySelector('#listView').after(holder);},doubles);
   const doublesCard=page.locator('#compact-doubles-test');await doublesCard.scrollIntoViewIfNeeded();
   assert.equal(await doublesCard.locator('.major-event-matchup-player').count(),4,'normal doubles retains all four names');
   assert.equal(await doublesCard.locator('.major-event-matchup-player .country-flag').count(),4,'normal doubles restores a country flag beside every player');
   assert.match(await doublesCard.locator('.fixture-kind').textContent(),/doubles/i,'normal doubles format remains visible in its format capsule');
   const clipped=await doublesCard.locator('.major-event-matchup-player').evaluateAll(nodes=>nodes.filter(n=>[...n.children].some(c=>c.getBoundingClientRect().right>n.getBoundingClientRect().right+1)).length);
   assert.equal(clipped,0,'doubles names stay within their sides');
   await doublesCard.screenshot({path:path.join(screenshotDir,`compact-doubles-${engine}-${width}.png`)});
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
