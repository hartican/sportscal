#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33956',out=process.env.WRC_QA_OUTPUT||'/tmp/wrc-qa';fs.mkdirSync(out,{recursive:true});
const events=require('../data/events.json').events;const samples=events.filter(e=>e.key==='wrc'&&e.status!=='cancelled');
(async()=>{
 const report={cases:[],errors:[]};
 for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of[320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});page.on('pageerror',e=>report.errors.push(e.message));
   await page.route('**/api/**',route=>route.fulfill({status:503,json:{}}));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'day',selectedSelectorEntityIds:['sport:wrc'],followedSports:['wrc']})));
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
    if(event.season==='2027')assert(result.caption.includes('France')&&result.caption.includes('unverified'));report.cases.push({name,width,theme,state,surface,eventId:event.id,...result});
    assert.equal(result.fallback,event.courseGeometryVerified!==true,'verified course replaces the fallback on both surfaces');
    if(width===390&&surface==='feed')await page.locator('#pilot-test').screenshot({path:path.join(out,`${name}-${theme}-${state}-${event.courseArtworkId||event.roundNumber||'future-fallback'}.png`)});
   }
   await page.route('**/sardegna-lerno-2026.svg*',route=>route.abort());
   await page.evaluate(event=>{const card=buildEventCard(event);document.getElementById('pilot-test').replaceChildren(card);const image=card.querySelector('.venue-location-hero img');image.src+='?failed-source-test=1';},samples.find(e=>e.courseGeometryVerified));
   await page.waitForFunction(()=>{const image=document.querySelector('#pilot-test .venue-location-hero img');return image?.src.includes('helmet-white.svg')&&image.naturalWidth>0;});
   await page.unroute('**/sardegna-lerno-2026.svg*');
   // Shared Events parent, visible credits and local Follow badge.
   await page.evaluate(async()=>{activeTab='events';userPreferences.selectedSelectorEntityIds=['sport:wrc'];userPreferences.followedSports=['wrc'];const container=document.getElementById('listView');container.replaceChildren();await loadDeferredScript('config/surface-category-ui.js?v=340');await loadDeferredScript('config/event-overviews-ui.js?v=376');await NOTHINGSPORTS_EVENT_OVERVIEWS_UI.render(container);});
   const parents=await page.locator('.events-overview-card').count();assert(parents>0);assert.equal(await page.locator('.events-overview-card .nsc-rating-block').count(),0);assert.equal(await page.locator('.events-overview-card .venue-location-hero').count(),parents);
   await page.evaluate(()=>document.getElementById('pilot-test')?.remove());
   await page.locator('.tab-btn[data-tab="follow"]').click();
   await page.getByRole('button',{name:/^Motorsport/}).click();await page.getByRole('button',{name:'WRC',exact:true}).click();
   const expand=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await expand.count())await expand.click();
   const mark=page.locator('#follow-navigation-controls h2 .follow-sport-mark img.event-brand-logo');await mark.waitFor();await mark.evaluate(image=>image.decode());assert.match(await mark.getAttribute('src'),/assets\/identities\/competitions\/wrc-(?:dark|light)\.png/);assert(await mark.isVisible());
   await page.waitForFunction(()=>{const image=document.querySelector('#follow-navigation-controls h2 .follow-sport-mark img.event-brand-logo');return image&&getComputedStyle(image).opacity==='1'&&!image.parentElement.querySelector('.identity-image-placeholder');});
   assert.equal(await page.locator('footer .wrc-attribution').count(),0);
   if(width===390){
    const transparency=await page.evaluate(async()=>{
     const image=new Image();image.src='assets/identities/wrc/routes/sardegna-lerno-2026.svg';await image.decode();const canvas=document.createElement('canvas');canvas.width=400;canvas.height=160;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,400,160);const data=ctx.getImageData(0,0,400,160).data;let ink=0,nonWhite=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>=128){ink++;if(Math.min(data[i],data[i+1],data[i+2])<250)nonWhite++;}return{fraction:ink/64000,nonWhite,corners:[0,399,400*159,63999].map(i=>data[i*4+3])};
    });
    assert(transparency.fraction>0.01&&transparency.fraction<0.15,'competitive-stage lines retain transparent space between them');assert.equal(transparency.nonWhite,0);assert.deepEqual(transparency.corners,[0,0,0,0]);report.transparency||=[];report.transparency.push({engine:name,...transparency});
    await page.evaluate(async()=>{await loadDeferredScript('assets/js/settings-optional-ui.js?v=386');const host=document.createElement('section');host.id='qa-about-credits';document.body.append(host);NOTHINGSPORTS_FANTASY_UI.renderAboutSettings(host);});
    assert(await page.locator('#qa-about-credits a[href*="SS8-11.pdf"]').count()>0,'About exposes the individual course source');
    assert.match(await page.locator('#qa-about-credits').innerText(),/Sporticon|ookami/);
    await page.evaluate(()=>document.getElementById('qa-about-credits').remove());
    assert(await page.locator('a[href*="SS8-11.pdf"]').count()>0,'individual source credit remains visible in the footer');
   }
   await page.close();
  }}finally{await browser.close();}
 }
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(`WRC browser: ${report.cases.length} card/detail cases, Events parents, credits and Follow identity passed in Chromium/WebKit.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
