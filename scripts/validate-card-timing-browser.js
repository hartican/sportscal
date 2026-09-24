#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33972';
(async()=>{
 const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'chrome'});
 try{for(const width of [320,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  // Deterministic published-data fallback; never send synthetic fixture actions to production.
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{}}));
  await page.goto(base);await page.waitForFunction(()=>typeof buildEventCard==='function'&&!startupCoordinator.isHydrating());
  assert.match(await page.title(),/Nothing|Sport/i);
  const result=await page.evaluate(async()=>{
   document.getElementById('startupLaunch')?.remove();document.querySelectorAll('.modal-backdrop').forEach(node=>node.classList.remove('show'));
   activeTab='feed';activeView='list';
   document.querySelectorAll('main>section').forEach(node=>{if(node.id!=='listView')node.style.display='none';});
   const list=document.querySelector('#listView');list.style.display='';list.replaceChildren();
   const published=(await (await fetch('data/events.json')).json()).events;
   const source=['cricket','tennis','f1','golf'].map(key=>published.find(ev=>ev.key===key)).filter(Boolean);
   if(source.length<3)throw Error('Missing representative fixtures');
   const cases=[...source.map((ev,index)=>({...ev,id:`timing-qa-${index}`,eventId:`timing-qa-${index}`,status:'scheduled',scheduleStatus:'scheduled',date:'2027-01-15',startTimeUtc:'2027-01-14T15:30:00Z'})),
    {...source[0],id:'timing-qa-follows',eventId:'timing-qa-follows',timePrecision:'follows',date:'2027-01-15',status:'scheduled',scheduleStatus:'scheduled'},
    {...source[0],id:'timing-qa-finished',eventId:'timing-qa-finished',status:'completed',scheduleStatus:'completed'},
    {...source[0],id:'timing-qa-tbc',eventId:'timing-qa-tbc',timeTbc:true,participantIds:[],participants:[],name:'Unconfirmed sides',status:'scheduled',scheduleStatus:'scheduled'}];
   for(const [name,changes] of Object.entries({
    live:{status:'live',scheduleStatus:'live'},postponed:{status:'postponed',scheduleStatus:'postponed'},cancelled:{status:'cancelled',scheduleStatus:'cancelled'},
    estimated:{status:'scheduled',scheduleStatus:'scheduled',timePrecision:'estimated',estimatedStartTimeUtc:'2027-01-14T15:30:00Z'},
    range:{status:'scheduled',scheduleStatus:'scheduled',dateOnly:true,date:'2027-01-15',endDate:'2027-01-18'}
   }))cases.push({...source[0],...changes,id:`timing-qa-${name}`,eventId:`timing-qa-${name}`});
   window.timingQaFixtures=cases;
   for(const [index,ev] of cases.entries()){
    setCardState(ev,index===1?'compact':'selected');
    const card=buildEventCard(ev);card.dataset.timingQa='true';list.appendChild(card);
   }
   return cases.length;
  });
  await page.waitForTimeout(200);
  const geometry=await page.locator('[data-timing-qa]').evaluateAll(cards=>cards.map(card=>{
   const badge=card.querySelector('.fixture-timing-badge'),header=card.querySelector('.fixture-timing-header');
   const rect=node=>node?.getBoundingClientRect().toJSON();
   return {text:badge?.textContent,card:rect(card),badge:rect(badge),header:rect(header),controls:[...card.querySelectorAll('.event-card-controls,.event-card-disclosure')].map(rect),fallback:card.classList.contains('is-fixture-fallback'),compact:card.classList.contains('is-compact-row'),status:badge?.dataset.timingStatus,support:card.querySelector('.event-date-chip')?.textContent,colour:badge&&getComputedStyle(badge).color,background:badge&&getComputedStyle(badge).backgroundColor,areas:[...card.querySelectorAll('[data-card-area]')].map(n=>n.dataset.cardArea)};
  }));
  assert.equal(geometry.length,result);
  for(const g of geometry){
   assert(g.badge,`${width}: badge missing`);assert(!g.fallback,`${width}: unexpected fallback`);
   assert(g.badge.left>=g.card.left && g.badge.right<=g.card.right+1,`${width}: badge fits card`);
   for(const c of g.controls)assert(g.badge.right<=c.left+1||g.badge.left>=c.right-1||g.badge.bottom<=c.top+1||g.badge.top>=c.bottom-1,`${width}: badge overlaps control`);
   assert(g.colour&&g.background,'timing has theme-aware styling');
   if(g.status&&!g.compact)assert(g.support.includes('(Sydney time)'),`${width}: status retains scheduled time`);
   if(!g.compact)assert(g.areas.includes('artwork')&&g.areas.includes('essentials')&&g.areas.includes('ratings'));
  }
  const first=page.locator('[data-timing-qa]').first();
  const before=await first.getAttribute('data-card-state');
  await first.locator('.event-card-disclosure').click();
  const replacement=page.locator('[data-event-id="timing-qa-0"]');
  assert.notEqual(await replacement.getAttribute('data-card-state'),before,'disclosure changes actual card state');
  assert.equal(await replacement.locator('.fixture-timing-badge').count(),1);
  await page.waitForFunction(()=>document.activeElement?.matches('[data-event-id="timing-qa-0"] .event-card-disclosure'));
  assert(await replacement.locator('.event-card-disclosure').evaluate(node=>node===document.activeElement),'disclosure restores focus');
  assert.deepEqual(errors,[]);
  if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/feed-timing-${width}.png`});}
  console.log(`${width}px: ${result} fixture variants, badge geometry/contrast, separated areas and disclosure/focus passed`);
  await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
