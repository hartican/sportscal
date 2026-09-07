#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:8887';
const events=require('../data/events.json').events;
const major=require('../config/major-events');
const catalogue=require('../data/major-events.v1.json');
const parent=catalogue.events.find(e=>e.name==='US Open 2026');
const derived=parent.subEvents.map(e=>major.fixtureFromSubEvent(e,parent)).find(Boolean);
const samples=[events.find(e=>e.key==='premier-league'),events.find(e=>e.key==='tennis'),events.find(e=>e.key==='f1'),derived];
assert(samples.every(Boolean),'All four published card families must be present');
(async()=>{
 const browser=await chromium.launch({headless:true});const evidence=[];
 try{for(const width of [325,390,768,1280])for(const textScale of [1,1.5]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['nrl'],feedCompact:true})));
  await page.goto(base);await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
  // This is component coverage with unmodified published fixtures. The separate
  // journey suite uses the application's real eligibility resolver throughout.
  await page.evaluate(({samples,textScale})=>{
   if(textScale!==1)document.documentElement.style.fontSize=`${16*textScale}px`;
   const host=document.createElement('section');host.id='published-card-audit';
   samples.forEach(ev=>{setCardState(ev,'compact');host.appendChild(buildEventCard(ev));});
   document.getElementById('listView').appendChild(host);
  },{samples,textScale});
  const rows=page.locator('#published-card-audit .event-card');
  assert((await rows.nth(1).locator('.compact-card-name').textContent()).includes('US Open'),'Tournament shorthand must retain its recognisable name');
  assert((await rows.nth(3).locator('.compact-card-name').textContent()).includes('/'),'Doubles shorthand must retain both players on each side');
  const compact=await rows.evaluateAll(cards=>cards.map(card=>{
   const time=card.querySelector('.compact-card-time'),name=card.querySelector('.compact-card-name');
   return {id:card.dataset.eventId,height:card.getBoundingClientRect().height,overflow:card.scrollWidth>card.clientWidth+1,timeClipped:time.scrollWidth>time.clientWidth+1,nameWidth:name.clientWidth,identities:card.querySelectorAll('.compact-card-icon img:not(.identity-image-placeholder img),.compact-card-icon svg').length};
  }));
  assert(compact.every(c=>!c.timeClipped&&!c.overflow&&c.nameWidth>0&&c.identities<=1),JSON.stringify({width,textScale,compact}));
  for(let i=0;i<samples.length;i++){
   const card=rows.nth(i);await card.locator('.compact-card-name').click();
   assert.equal(await card.getAttribute('data-card-level'),'L1');
   assert.equal(await card.locator('.nsc-rating-block').count(),5,'L1 reserves its shared rating control before API hydration');
   assert.equal(await card.locator('.nsc-peer-summary').count(),0,'L1 excludes crowd detail');
   const before=await card.getAttribute('data-card-level');
   await card.focus();await page.keyboard.press('Enter');assert.equal(await card.getAttribute('data-card-level'),'L2');
   const hit=await card.locator('.card-dismiss').boundingBox();assert(hit.width>=44&&hit.height>=44);
   assert.equal(await card.evaluate(c=>c.scrollWidth>c.clientWidth+1),false,'Expanded published card must fit');
   assert(await card.evaluate(c=>Math.abs(c.getBoundingClientRect().width-c.parentElement.getBoundingClientRect().width)<=2),'Every expanded card must use the same available width');
  }
  await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR||'/tmp',`ux-recovery-${width}-${textScale}.png`)});
  evidence.push({width,textScale,compact,errors});assert.deepEqual(errors,[]);await page.close();
 }
 console.log(JSON.stringify(evidence,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
