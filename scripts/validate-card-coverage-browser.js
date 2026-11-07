'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const events=require('../data/events.json').events,pga=require('../data/canonical/pga-tour-schedule.json').presidentsCup;
const bjk=require('../data/tennis-feed-parents.v1.json').parents.find(e=>/Billie/.test(e.name));
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
for(const width of [320,390,768,1280])for(const theme of ['day','night']){
 const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33981');await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 await page.evaluate(({theme})=>{document.querySelectorAll('.modal-backdrop').forEach(n=>n.classList.remove('show'));document.getElementById('startupLaunch')?.remove();document.documentElement.dataset.theme=theme;activeTab='feed';activeView='list';nowAEST=()=>new Date('2026-09-25T01:00:00Z');}, {theme});
 for(const ev of [bjk,pga[0],events.find(e=>e.id==='football-australia-brazil-2026-09-25'),events.find(e=>e.name.includes('Fulham v Manchester United')),events.find(e=>e.key==='f1'&&/Azerbaijan.*Qualifying/i.test(e.name)),require('../data/follow-schedule/cricket.json').fixtures.find(e=>e.id==='fixture:cricket:CA:39987')]){
  assert(ev);
  await page.evaluate(ev=>{setCardState(ev,'selected');document.querySelector('#listView').replaceChildren(buildEventCard(ev));observeDeferredCardImages();},ev);
  const card=page.locator('#listView .event-card');await card.scrollIntoViewIfNeeded();
  if(ev.tournamentParent){assert(await card.evaluate(c=>c.classList.contains('parent-ongoing')));const toggle=card.locator('.tournament-parent-heading button');assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');if(ev.eventFamilyId==='presidents-cup')await card.locator('.tournament-fixture-slots[open]').waitFor();await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');}
  else if(ev.key==='f1'){assert.equal(await card.locator('.fixture-event-caption').count(),0);assert((await card.innerText()).includes('Baku City Circuit, Baku'));assert(await card.evaluate(c=>c.style.getPropertyValue('--fixture-accent')));}
  else {await page.waitForFunction(()=>[...document.querySelectorAll('#listView img[data-identity-image]')].every(i=>i.naturalWidth>0));const labels=await card.locator('.fixture-profile-link').evaluateAll(ns=>ns.map(n=>{const side=n.closest('.feed-opponent,.compact-matchup-side,.major-event-matchup-side'),link=n.getBoundingClientRect(),column=side?.getBoundingClientRect();return {align:getComputedStyle(n).textAlign,decoration:getComputedStyle(n).textDecorationLine,offset:column?Math.abs((link.left+link.width/2)-(column.left+column.width/2)):Infinity}}));assert(labels.length>=2);assert(labels.every(n=>n.align==='center'&&n.decoration.includes('underline')&&n.offset<1));const colours=await card.evaluate(c=>[c.style.getPropertyValue('--fixture-left'),c.style.getPropertyValue('--fixture-right')]);assert(colours[0]&&colours[1]&&colours[0]!==colours[1]);}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width===390&&process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await card.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/${ev.id.replace(/[^a-z0-9]/gi,'-')}-${theme}.png`});}
 }
 for(const parent of [bjk,pga[0]]){await page.evaluate(ev=>{nowAEST=()=>new Date(ev.date+'T01:00:00Z');document.querySelector('#listView').replaceChildren(buildEventCard(ev));},parent);assert.equal(await page.locator('#listView .parent-ongoing').count(),0);assert(await page.locator('#listView .event-card').isVisible());}
 console.log(`${width}/${theme}: ongoing parents, separate expansion, centred underlined labels, distinct tints, no overflow`);await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
