#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {sourceFingerprint}=require('./validate-feed-performance');
const origin=process.env.REPAIR_QA_URL||'http://127.0.0.1:33958';
const output=process.env.REPAIR_QA_OUTPUT||'/private/tmp/sportscal-feed-repair-browser.json';
(async()=>{
 const browser=await chromium.launch({headless:true});const audit={schemaVersion:'ui-performance-audit.v1',sourceFingerprint:sourceFingerprint(),runs:[],checks:[]};
 try{
  for(const width of (process.env.REPAIR_QA_WIDTHS||"320,390,768,1280").split(",").map(Number)){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin);await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating(),null,{timeout:45000});
   await page.evaluate(()=>{
    const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.selectedSelectorEntityIds=['sport:afl-premiership','sport:nrl-premiership','sport:tennis','sport:f1'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);
    next.preferenceGraph={...next.preferenceGraph,entityFollows:[{participantId:'competitor:f1:kimi-antonelli',followLevel:'follow'}]};savePreferences(next);
   });
   const samples=[];const cdp=await context.newCDPSession(page);await cdp.send("Network.enable");
   for(let attempt=0;attempt<6;attempt++){
    const cacheMode=attempt<3?"cold-network":"warm-network";await cdp.send("Network.setCacheDisabled",{cacheDisabled:attempt<3});
    if(attempt<3)await cdp.send("Network.clearBrowserCache");
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.NOTHINGSPORTS_FEED_PERFORMANCE?.startupCompleteMs>0,null,{timeout:45000});
    await page.waitForTimeout(1200);
    const sample=await page.evaluate(()=>({...NOTHINGSPORTS_FEED_PERFORMANCE,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,mounted:document.querySelectorAll('.feed-card-slot .event-card').length,requests:performance.getEntriesByType('resource').length}));
    sample.cacheMode=cacheMode;assert(sample.mounted<=60,`${width}: mounted cards ${sample.mounted}`);samples.push(sample);
   }
   for(const mode of ["cold-network","warm-network"])audit.runs.push({name:`${width}px saved follows ${mode}`,samples:samples.filter(s=>s.cacheMode===mode)});
   const logo=await page.locator('.matchup-team-logo-slot').first().boundingBox();assert(logo&&logo.width>=99&&logo.height>=99,`${width}: restored logo scale`);
   const actions=await page.evaluate(()=>[...document.querySelectorAll('.event-card-primary-actions .event-quick-actions')].map(row=>{const controls=[...row.children].filter(e=>e.getBoundingClientRect().width);return controls.map(e=>Math.round(e.getBoundingClientRect().top));}).filter(r=>r.length>1));
   assert(actions.every(tops=>Math.max(...tops)-Math.min(...tops)<8),`${width}: provider and reminder share a line`);
   await page.screenshot({path:`/private/tmp/sportscal-repair-${width}.png`});
   if(width===390){
    const expected=require('../lib/competition-fixtures').fixtures().filter(e=>['afl','nrl'].includes(e.key)&&require('../config/fixture-identity').retainedInActiveTimeline(e,new Date()));
    const ids=await page.evaluate(()=>[...document.querySelectorAll('[data-feed-event-id]')].map(e=>e.dataset.feedEventId));
    for(const event of expected)assert(ids.includes(event.id),`eligible final missing from timeline: ${event.id}`);
    assert.equal(ids.filter(id=>/nrl-finals.*grand-final/.test(id)).length,0,'Grand Final aliases deduplicate to evt_84');
    await page.locator('[data-feed-event-id="evt_27"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    fs.writeFileSync('/private/tmp/sportscal-profile-debug.json',JSON.stringify(await page.evaluate(()=>({follows:userPreferences.preferenceGraph.entityFollows,card:document.querySelector('[data-feed-event-id="evt_27"]')?.outerHTML,profiles:[...document.querySelectorAll('.fixture-profile-link')].map(e=>e.textContent)}))));
    const kimi=page.getByRole('button',{name:'Open Kimi Antonelli profile in Follow',exact:true}).first();await kimi.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>followedHomeTag(activeEvents.find(e=>e.id==='evt_27'))),'Home race','source-backed followed home race tag');
    const position=await page.evaluate(()=>scrollY);await kimi.click();
    await page.getByRole('dialog').waitFor();
    const toggle=page.getByRole('dialog').locator('.football-follow-toggle').first();await toggle.click();assert.equal(await page.evaluate(()=>directoryFollowLevel('competitor:f1:kimi-antonelli')),'mute');await toggle.click();assert.equal(await page.evaluate(()=>directoryFollowLevel('competitor:f1:kimi-antonelli')),'follow');
    await page.getByRole('button',{name:'Show fixture results',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.profile-context-table')].some(t=>t.rows.length===23),null,{timeout:20000});
    assert((await page.getByRole('dialog').innerText()).includes('Yuki Tsunoda'),'full race results include replacement driver');
    await page.waitForFunction(()=>[...document.querySelectorAll('.profile-context-table')].some(t=>t.rows.length===24),null,{timeout:20000});
    await page.goBack();await page.getByRole('dialog').waitFor({state:'detached'});await page.waitForTimeout(250);
    assert(Math.abs(await page.evaluate(()=>scrollY)-position)<100,'Back restores originating fixture position');
    for(let i=0;i<3;i++){for(const tab of ['Events','Follow','Feed']){await page.getByRole('button',{name:tab,exact:true}).first().click();await page.waitForTimeout(300);}}
    assert(await page.evaluate(()=>document.querySelectorAll('.feed-card-slot .event-card').length)<=60);
    audit.checks.push('Finals reach timeline; F1 complete results and standings; browser Back; repeated tab navigation');
   }
   assert.deepEqual(errors,[],`${width}: unhandled browser errors`);await context.close();
  }
 }finally{fs.writeFileSync(output,JSON.stringify(audit,null,2)+'\n');await browser.close();}
 console.log(`Feed repair browser evidence saved to ${output}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
