#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33956',out=process.env.MOTOGP_QA_OUTPUT||'/tmp/motogp-qa';fs.mkdirSync(out,{recursive:true});
const events=require('../data/events.json').events;const samples=['italy','austria','qatar','argentina'].map(slug=>events.find(e=>e.key==='motogp'&&e.sessionType==='race'&&e.canonicalEventId.includes(':'+slug)&&e.season===(slug==='argentina'?'2027':'2026')));
(async()=>{
 const report={cases:[],errors:[]};
 for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of[320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});page.on('pageerror',e=>report.errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'day',selectedSelectorEntityIds:['sport:motogp'],followedSports:['motogp']})));
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating()&&startupFunnelFinished,null,{timeout:60000});
   for(const theme of['day','night'])for(const state of['opened','compact'])for(const surface of['feed','detail'])for(const event of samples){
    const result=await page.evaluate(async({theme,state,surface,event})=>{
     document.documentElement.dataset.theme=theme;document.getElementById('pilot-test')?.remove();activeTab=surface==='feed'?'feed':'follow';setCardState(event,state);
     const mount=document.createElement('section');mount.id='pilot-test';mount.style.cssText='position:fixed;top:16px;left:0;right:0;z-index:100000;width:100%;max-width:520px;margin:auto;background:var(--bg);';
     const card=buildEventCard(event,{mode:surface==='feed'?'calendar':'schedule'});const list=document.createElement('div');list.id='listView';list.append(card);mount.append(list);document.body.append(mount);mount.scrollIntoView();
     const image=card.querySelector('.venue-location-hero img');if(!image)throw Error('Missing venue artwork');await image.decode();
     const rect=image.getBoundingClientRect(),c=card.getBoundingClientRect();return{width:rect.width,height:rect.height,left:rect.left,right:rect.right,cardLeft:c.left,cardRight:c.right,naturalWidth:image.naturalWidth,caption:card.querySelector('.f1-location-caption').textContent,src:image.getAttribute('src'),fallback:card.querySelector('.venue-location-hero').classList.contains('is-venue-fallback'),overflow:document.documentElement.scrollWidth>innerWidth+1};
    },{theme,state,surface,event});
    assert.equal(result.height,state==='compact'?130:220,JSON.stringify({name,width,theme,state,surface,result}));assert(result.naturalWidth>0);assert(!result.overflow);assert(result.left>=result.cardLeft-1&&result.right<=result.cardRight+1);assert(result.caption.includes(event.venue));
    if(event.scheduleNote)assert(result.caption.includes('TBC'));report.cases.push({name,width,theme,state,surface,eventId:event.id,...result});
    if(width===390&&surface==='feed'&&event.venue.includes('Mugello'))await page.locator('#pilot-test').screenshot({path:path.join(out,`${name}-${theme}-${state}.png`)});
   }
   await page.route('**/mugello.svg*',route=>route.abort());
   await page.evaluate(event=>{const card=buildEventCard(event);document.getElementById('pilot-test').replaceChildren(card);const image=card.querySelector('.venue-location-hero img');image.src+='?failed-source-test=1';},samples[0]);
   await page.waitForFunction(()=>{const image=document.querySelector('#pilot-test .venue-location-hero img');return image?.src.includes('motorcycle-white.svg')&&image.naturalWidth>0;});
   await page.unroute('**/mugello.svg*');
   // Shared Events parent, visible credits and local Follow badge.
   await page.evaluate(async()=>{activeTab='events';userPreferences.selectedSelectorEntityIds=['sport:motogp'];userPreferences.followedSports=['motogp'];const container=document.getElementById('listView');container.replaceChildren();await loadDeferredScript('config/surface-category-ui.js?v=340');await loadDeferredScript('config/event-overviews-ui.js?v=370');await NOTHINGSPORTS_EVENT_OVERVIEWS_UI.render(container);});
   const parents=await page.locator('.events-overview-card').count();assert(parents>0);assert.equal(await page.locator('.events-overview-card .nsc-rating-block').count(),0);assert.equal(await page.locator('.events-overview-card .venue-location-hero').count(),parents);
   const mark=await page.evaluate(()=>CARD_IDENTITIES.markForEvent({key:'motogp'}).url);assert.equal(mark,'assets/identities/motogp/badge.svg');assert(await page.locator('footer .venue-attribution').isVisible());
   await page.close();
  }}finally{await browser.close();}
 }
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(`MotoGP browser: ${report.cases.length} card/detail cases, Events parents, credits and Follow identity passed in Chromium/WebKit.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
