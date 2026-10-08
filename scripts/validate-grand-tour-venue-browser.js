#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33956',out=process.env.GRAND_TOUR_QA_OUTPUT||'/tmp/grand-tour-qa';fs.mkdirSync(out,{recursive:true});
const samples=require('../data/events.json').events.filter(e=>e.grandTourCalendar),art=require('../config/venue-artwork');
async function checkColdFollow(browser,width){
 const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});try{await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'day',version:26,selectedSelectorEntityIds:['sport:tdf','sport:giro','sport:vuelta'],followedSports:['tdf','giro','vuelta']})));await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
   await page.locator('.tab-btn[data-tab="follow"]').click();
   const coldExpand=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await coldExpand.count())await coldExpand.click();
   const coldCycling=page.locator('#follow-navigation-controls [data-follow-sport="sport:cycling"]').first();await coldCycling.waitFor({state:'attached'});if(!await coldCycling.isVisible())await page.getByRole('button',{name:'More sports',exact:true}).click();await coldCycling.click();
   for(const[key,label]of[['tdf','Tour de France'],['giro','Giro d’Italia'],['vuelta','La Vuelta']]){
    const coldReveal=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await coldReveal.count())await coldReveal.click();
    await page.locator('.follow-category-bar').getByRole('button',{name:label,exact:true}).click();
    await page.waitForFunction(key=>{const image=document.querySelector('#follow-navigation-controls > h2 img.event-brand-logo');return image?.complete&&image.naturalWidth>0&&image.getAttribute('src')?.includes(key+'-brand.');},key);
   }

 }finally{await page.close();}
}
(async()=>{const report={cases:[],errors:[]};
 for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of[320,390,768,1280]){await checkColdFollow(browser,width);
   const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});page.on('pageerror',e=>report.errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'day',version:26,selectedSelectorEntityIds:['sport:tdf','sport:giro','sport:vuelta'],followedSports:['tdf','giro','vuelta'],followFirst:{refinement:{completedAt:'2026-10-03T00:00:00Z'}}})));
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&startupFunnelFinished,null,{timeout:60000});
   await page.locator('#listView .event-card[data-event-id*="tdf"][data-event-id*="2027"] .venue-location-hero img').first().waitFor();
   assert(await page.evaluate(()=>activeEvents.filter(e=>e.key==='tdf'&&e.season==='2027').length===3),'ordinary startup loads all three published stages for an explicit Tour follow');
   for(const theme of['day','night'])for(const state of['opened','compact'])for(const surface of['feed','detail'])for(const event of samples){
    const result=await page.evaluate(async({theme,state,surface,event})=>{
     applyThemePreference(theme);document.getElementById('venue-test')?.remove();activeTab=surface==='feed'?'feed':'follow';setCardState(event,state);
     const mount=document.createElement('section');mount.id='venue-test';mount.style.cssText='position:fixed;top:16px;left:0;right:0;z-index:100000;width:100%;max-width:520px;margin:auto;background:var(--bg);';
     const card=buildEventCard(event,{mode:surface==='feed'?'calendar':'schedule'}),list=document.createElement('div');list.id='listView';list.append(card);mount.append(list);document.body.append(mount);
     const hero=card.querySelector('.venue-location-hero'),image=hero?.querySelector('img');if(!image)throw Error('Missing venue artwork');await image.decode();const a=image.getBoundingClientRect(),c=card.getBoundingClientRect();
     const canvas=document.createElement('canvas');canvas.width=300;canvas.height=220;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,300,220);const data=ctx.getImageData(0,0,300,220).data;let solid=0;for(let i=3;i<data.length;i+=4)if(data[i]>127)solid++;
     return {height:a.height,left:a.left,right:a.right,cardLeft:c.left,cardRight:c.right,naturalWidth:image.naturalWidth,caption:hero.querySelector('.f1-location-caption').textContent,src:image.getAttribute('src'),fallback:hero.classList.contains('is-venue-fallback'),palette:[card.style.getPropertyValue('--fixture-left'),card.style.getPropertyValue('--fixture-right')],opaqueFraction:solid/(300*220),overflow:document.documentElement.scrollWidth>innerWidth+1};
    },{theme,state,surface,event});
    assert.equal(result.height,state==='compact'?130:220);assert(result.naturalWidth>0&&!result.overflow);assert(result.left>=result.cardLeft-1&&result.right<=result.cardRight+1);assert.equal(result.src,art.resolve(event).path);assert.equal(result.fallback,art.resolve(event).kind==='fallback');assert.match(result.caption,/→/);assert(result.opaqueFraction>.002&&result.opaqueFraction<.6,'route/wheel interiors and outer background remain transparent');assert.deepEqual(result.palette,require('../config/feed-card-presentation').palette(event).slice(0,2));
    report.cases.push({engine:name,width,theme,state,surface,eventId:event.id,...result});
    if(width===390&&surface==='feed'&&['evt_46','evt_65'].includes(event.id))await page.locator('#venue-test').screenshot({path:path.join(out,`${name}-${theme}-${state}-${event.id}.png`)});
   }
   await page.evaluate(()=>document.getElementById('venue-test')?.remove());await page.locator('.tab-btn[data-tab="events"]').click();
   for(const key of['tdf','giro','vuelta']){await page.getByRole('combobox',{name:'Sport category',exact:true}).selectOption(key);await page.locator('.events-overview-card .venue-location-hero').first().waitFor();assert.equal(await page.locator('.events-overview-card').count(),1);assert.equal(await page.locator('.events-overview-card .nsc-rating-block').count(),0);const image=page.locator('.events-overview-card .venue-location-hero img');await image.evaluate(i=>i.decode());assert.match(await image.getAttribute('src'),/bicycle-white.svg/);}
   await page.locator('.tab-btn[data-tab="follow"]').click();await page.evaluate(()=>{const p=clonePreferences(userPreferences);p.version=26;p.selectedSelectorEntityIds=['sport:cycling'];p.followedSports=['cycling','tdf','giro','vuelta'];savePreferences(p);renderFollowView();});
   const expand=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await expand.count())await expand.click();
   const cycling=page.locator('#follow-navigation-controls [data-follow-sport="sport:cycling"]').first();await cycling.waitFor({state:'attached'});if(!await cycling.isVisible())await page.getByRole('button',{name:'More sports',exact:true}).click();await cycling.click();
   for(const[key,label]of[['tdf','Tour de France'],['giro','Giro d’Italia'],['vuelta','La Vuelta']]){
    await page.locator('.follow-category-bar').getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(label=>document.querySelector('#follow-navigation-controls > h2')?.textContent.trim().endsWith(label),label);
    const reveal=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await reveal.count())await reveal.click();const logo=page.locator('#follow-navigation-controls h2 img.event-brand-logo').first();await logo.waitFor();await logo.evaluate(i=>i.decode());assert.match(await logo.getAttribute('src'),new RegExp(key+'-brand\\.(?:png|svg)$'));
    const checkbox=page.getByRole('checkbox',{name:'Follow '+label,exact:true});await checkbox.waitFor();assert.equal(await checkbox.isChecked(),false);await checkbox.check();await page.waitForFunction(key=>userPreferences.selectedSelectorEntityIds.includes('sport:'+key),key);await checkbox.uncheck();await page.waitForFunction(key=>!userPreferences.selectedSelectorEntityIds.includes('sport:'+key),key);assert(await page.evaluate(()=>userPreferences.selectedSelectorEntityIds.includes('sport:cycling')));
   }
   assert.equal(await page.locator('footer .cycling-attribution').count(),0);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^About/}).click();await page.locator('.about-acknowledgements>summary').click();await page.locator('.about-acknowledgements').evaluate(n=>n.querySelectorAll('details').forEach(d=>d.open=true));assert(await page.locator('.settings-about .cycling-attribution').isVisible());await page.close();
  }}finally{await browser.close();}
 }
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(`Grand Tour browser: ${report.cases.length} card cases, Chromium/WebKit, four widths, both themes/states/surfaces, transparency, edition parents, explicit child consent and credits passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
