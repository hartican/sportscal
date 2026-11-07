#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33956',out=process.env.WSL_QA_OUTPUT||'/tmp/wsl-qa';fs.mkdirSync(out,{recursive:true});
const events=require('../data/events.json').events.filter(e=>e.competitionId==='competition:wsl-championship-tour');
// Every distinct venue/season, including neutral-country and unconfirmed entries.
const samples=[...new Map(events.map(e=>[e.weekendId,e])).values()];
(async()=>{
 const report={cases:[],errors:[]};
 for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of[320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});page.on('pageerror',e=>report.errors.push(e.message));
   await page.route('**/api/**',route=>route.fulfill({status:503,json:{}}));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'day',version:25,selectedSelectorEntityIds:['sport:wsl'],followedSports:['wsl'],followFirst:{refinement:{completedAt:'2026-10-03T00:00:00Z'}}})));
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&startupFunnelFinished,null,{timeout:60000});
   for(const theme of['day','night'])for(const state of['opened','compact'])for(const surface of['feed','detail'])for(const event of samples){
    const r=await page.evaluate(async({theme,state,surface,event})=>{
     applyThemePreference(theme);document.getElementById('venue-test')?.remove();activeTab=surface==='feed'?'feed':'follow';setCardState(event,state);
     const mount=document.createElement('section');mount.id='venue-test';mount.style.cssText='position:fixed;top:16px;left:0;right:0;z-index:100000;width:100%;max-width:520px;margin:auto;background:var(--bg);';
     const card=buildEventCard(event,{mode:surface==='feed'?'calendar':'schedule'}),list=document.createElement('div');list.id='listView';list.append(card);mount.append(list);document.body.append(mount);
     const hero=card.querySelector('.venue-location-hero'),image=hero?.querySelector('img');if(!image)throw Error('Missing venue fallback');await image.decode();
     const a=image.getBoundingClientRect(),c=card.getBoundingClientRect();return {height:a.height,left:a.left,right:a.right,cardLeft:c.left,cardRight:c.right,naturalWidth:image.naturalWidth,caption:hero.querySelector('.f1-location-caption').textContent,src:image.getAttribute('src'),fallback:hero.classList.contains('is-venue-fallback'),palette:[card.style.getPropertyValue('--fixture-left'),card.style.getPropertyValue('--fixture-right')],overflow:document.documentElement.scrollWidth>innerWidth+1};
    },{theme,state,surface,event});
    assert.equal(r.height,state==='compact'?130:220);assert(r.naturalWidth>0&&r.fallback&&!r.overflow);assert(r.left>=r.cardLeft-1&&r.right<=r.cardRight+1);assert.match(r.caption,/Break shape unverified/);assert.match(r.src,/wave-white.svg/);assert(r.palette.every(Boolean));
    assert.deepEqual(r.palette,require('../config/feed-card-presentation').palette(event).slice(0,2),'Country panel must retain the host palette, even with confirmed team entries');
    report.cases.push({engine:name,width,theme,state,surface,eventId:event.id,...r});
    if(width===390&&surface==='feed'&&['wsl:2026:portugal','wsl:2026:philippines','wsl:2026:bells-beach'].includes(event.weekendId))await page.locator('#venue-test').screenshot({path:path.join(out,`${name}-${theme}-${state}-${event.weekendId.replaceAll(':','-')}.png`)});
   }
   await page.evaluate(()=>document.getElementById('venue-test')?.remove());
   await page.locator('.tab-btn[data-tab="events"]').click();await page.getByRole('combobox',{name:'Sport category',exact:true}).selectOption('wsl');await page.locator('.events-overview-card .venue-location-hero').first().waitFor();
   const parents=await page.locator('.events-overview-card').count();assert(parents===3);assert.equal(await page.locator('.events-overview-card .nsc-rating-block').count(),0);
   await page.locator('.tab-btn[data-tab="follow"]').click();
   await page.locator('#follow-navigation-controls').waitFor();
   const expand=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await expand.count())await expand.click();
   const select=page.locator('#follow-navigation-controls [data-follow-sport="sport:surf"]').first();
   await select.waitFor({state:'attached'});
   if(!await select.isVisible())await page.getByRole('button',{name:'More sports',exact:true}).click();
   await select.waitFor();await select.click();
   await page.locator('.follow-category-bar').getByRole('button',{name:'WSL',exact:true}).click();
   // The More sports dialog has its own h2; inspect the navigation heading.
   await page.waitForFunction(()=>document.querySelector('#follow-navigation-controls > h2')?.textContent.trim().endsWith('WSL'));
   const reveal=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await reveal.count())await reveal.click();
   const image=page.locator('#follow-navigation-controls h2 img.event-brand-logo').first();await image.waitFor();await image.evaluate(i=>i.decode());assert.match(await image.getAttribute('src'),/assets\/identities\/wsl\/brand.png/);
   assert.equal(await page.locator('footer .wsl-attribution').count(),0);
   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^About/}).click();await page.locator('.about-acknowledgements>summary').click();await page.locator('.about-acknowledgements').evaluate(n=>n.querySelectorAll('details').forEach(d=>d.open=true));assert(await page.locator('.settings-about .wsl-attribution').isVisible());
   // UI consent must agree with Feed, including a retained broad Surfing follow.
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&startupFunnelFinished);
   await page.locator('.tab-btn[data-tab="follow"]').click();
   await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.version=25;next.selectedSelectorEntityIds=['sport:surf'];next.followedSports=['surf','wsl','big-wave'];savePreferences(next);renderFollowView();});
   const checkbox=page.getByRole('checkbox',{name:'Follow WSL',exact:true});await checkbox.waitFor();assert.equal(await checkbox.isChecked(),false);
   await checkbox.check();await page.waitForFunction(()=>userPreferences.selectedSelectorEntityIds.includes('sport:wsl'));
   assert(await page.evaluate(e=>!!FOLLOW_FIRST.reasonForEvent(e,userPreferences),samples.find(e=>e.id.endsWith('portugal'))));
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&startupFunnelFinished);
   assert(await page.evaluate(()=>userPreferences.selectedSelectorEntityIds.includes('sport:wsl')),'explicit choice survives reload');
   if(await page.locator('#dismissTunePromptBtn').isVisible())await page.locator('#dismissTunePromptBtn').click();
   await page.locator('.tab-btn[data-tab="follow"]').click();
   if(await page.locator('#dismissTunePromptBtn').isVisible())await page.locator('#dismissTunePromptBtn').click();
   const restoredCheckbox=page.getByRole('checkbox',{name:'Follow WSL',exact:true});await restoredCheckbox.waitFor();await restoredCheckbox.uncheck();
   await page.waitForFunction(()=>!userPreferences.selectedSelectorEntityIds.includes('sport:wsl'));
   assert(await page.evaluate(()=>userPreferences.selectedSelectorEntityIds.includes('sport:surf')),'unfollowing WSL preserves broad Surfing');
   await page.evaluate(()=>saveFollowSport({id:'big-wave',selectorId:'sport:big-wave',label:'Big-wave'},false));
   assert(!await page.evaluate(()=>userPreferences.selectedSelectorEntityIds.includes('sport:wsl')),'unfollowing a sibling never opts into WSL');
   await page.close();
  }}finally{await browser.close();}
 }
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(`WSL venue browser: ${report.cases.length} cases in Chromium/WebKit, all venue/season panels, Events, Follow and credits passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
