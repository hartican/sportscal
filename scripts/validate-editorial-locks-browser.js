#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {records:[approved]}=require('../config/editorial-locks');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 for(const width of [320,390,768,1280])for(const theme of ['day','night']){
  const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{}}));
  await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33974');
  await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
  await page.evaluate(async({theme})=>{
   document.getElementById('startupLaunch')?.remove();document.querySelectorAll('.modal-backdrop').forEach(node=>node.classList.remove('show'));
   document.documentElement.dataset.theme=theme;activeTab='feed';activeView='list';
   const events=(await(await fetch('data/events.json')).json()).events;
   const ev=events.find(event=>NOTHINGSPORTS_EDITORIAL_LOCKS.recordFor(event));
   window.lockQaEvent=ev;
   // Model an old cached projection trying to replace the approved copy.
   ev.editorialNarrative={...ev.editorialNarrative,hook:'Wrong cached preview',synopsis:'Wrong cached body'};
   const list=document.getElementById('listView');list.replaceChildren();list.style.display='';
   for(const state of ['opened','compact']){setCardState(ev,state);const card=buildEventCard(ev);card.dataset.lockQa=state;list.appendChild(card);}
  },{theme});
  const full=page.locator('[data-lock-qa="opened"]'),compact=page.locator('[data-lock-qa="compact"]');
  assert.equal(await full.locator('.editorial-l0-hook-copy').innerText(),approved.hook);
  assert.equal(await full.locator('.editorial-l0-supplement').innerText(),approved.synopsis);
  for(const card of [full,compact]){
   assert.equal(await card.locator('.fixture-stage-label').count(),1);
   assert.equal(await card.locator('.fixture-stage-label').innerText(),'GRAND FINAL');
   assert.equal(await card.locator('.fixture-marquee-label,.matchup-stage-badge,.compact-stage-label').count(),0);
   assert(!/marquee/i.test(await card.innerText()));
   const geometry=await card.evaluate(card=>{
    const rect=n=>n.getBoundingClientRect().toJSON(),label=card.querySelector('.fixture-stage-label'),badge=card.querySelector('.fixture-timing-badge');
    return {card:rect(card),label:rect(label),badge:rect(badge),colour:getComputedStyle(label).color,controls:[...card.querySelectorAll('.event-card-controls,.event-card-disclosure')].map(rect)};
   });
   assert(geometry.label.right<=geometry.card.right+1);
   assert(geometry.label.left>=geometry.badge.right||geometry.label.top>=geometry.badge.bottom-1,'stage follows timing or wraps below');
   for(const c of geometry.controls)assert(geometry.label.right<=c.left+1||geometry.label.left>=c.right-1||geometry.label.top>=c.bottom-1||geometry.label.bottom<=c.top+1,'stage avoids controls');
   assert.equal(geometry.colour,theme==='day'?'rgb(0, 107, 145)':'rgb(98, 201, 242)');
  }
  assert.equal(await full.locator('.nsc-rating-block').count(),5);
  const cachedProof=await page.evaluate(()=>{
   const event=window.lockQaEvent;
   return ['upcoming','live','postponed'].map(status=>{
    const e={...event,status,scheduleStatus:status};setCardState(e,'opened');
    return {hook:editorialNarrativeHookForDisplay(e),body:editorialNarrativeSynopsisForDisplay(e),consequence:editorialConsequenceForDisplay(e)};
   });
  });
  for(const item of cachedProof){assert.equal(item.hook,approved.hook);assert.equal(item.body,approved.synopsis);assert.equal(item.consequence,'');}
  await full.locator('.event-card-disclosure').click();
  await page.waitForFunction(()=>document.activeElement?.matches('.event-card-disclosure'));
  assert.deepEqual(errors,[]);
  if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/grand-final-${width}-${theme}.png`});}
  console.log(`${width}px ${theme}: exact locked copy, one stage badge, no Marquee, wrapping, controls and disclosure passed`);
  await page.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
