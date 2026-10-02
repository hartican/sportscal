#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33956',out=process.env.DAKAR_QA_OUTPUT||'/tmp/dakar-venue-qa';fs.mkdirSync(out,{recursive:true});
const samples=require('../data/events.json').events.filter(e=>e.dakarCalendar),art=require('../config/venue-artwork');
(async()=>{const report={cases:[],errors:[]};for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});try{for(const width of[320,390,768,1280]){
  console.log('Starting '+name+' '+width);const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});page.on('pageerror',e=>report.errors.push(e.message));if(!base.startsWith('https:'))await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'day',version:27,selectedSelectorEntityIds:['sport:dakar'],followedSports:['dakar'],followFirst:{refinement:{completedAt:'2026-10-03T00:00:00Z'}}})));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>!startupCoordinator.isHydrating()&&startupFunnelFinished,null,{timeout:60000});
  await page.waitForFunction(()=>activeEvents.filter(e=>e.dakarCalendar&&e.season==='2027').length===14,null,{timeout:60000});
  for(const theme of['day','night'])for(const state of['opened','compact'])for(const surface of['feed','detail'])for(const event of samples){
   const result=await page.evaluate(async({theme,state,surface,event})=>{
    applyThemePreference(theme);document.getElementById('venue-test')?.remove();activeTab=surface==='feed'?'feed':'follow';setCardState(event,state);
    const mount=document.createElement('section');mount.id='venue-test';mount.style.cssText='position:fixed;top:16px;left:0;right:0;z-index:100000;width:100%;max-width:520px;margin:auto;background:var(--bg);';
    const card=buildEventCard(event,{mode:surface==='feed'?'calendar':'schedule'}),list=document.createElement('div');list.id='listView';list.append(card);mount.append(list);document.body.append(mount);
    const hero=card.querySelector('.venue-location-hero'),image=hero?.querySelector('img');if(!image)throw Error('Missing Dakar artwork '+event.id+' '+surface+' '+state);await image.decode();const a=image.getBoundingClientRect(),c=card.getBoundingClientRect();
    const canvas=document.createElement('canvas');canvas.width=300;canvas.height=220;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,300,220);const data=ctx.getImageData(0,0,300,220).data;let solid=0;for(let i=3;i<data.length;i+=4)if(data[i]>127)solid++;
    return {height:a.height,left:a.left,right:a.right,cardLeft:c.left,cardRight:c.right,naturalWidth:image.naturalWidth,caption:hero.querySelector('.f1-location-caption').textContent,src:image.getAttribute('src'),fallback:hero.classList.contains('is-venue-fallback'),palette:[card.style.getPropertyValue('--fixture-left'),card.style.getPropertyValue('--fixture-right')],opaqueFraction:solid/(300*220),overflow:document.documentElement.scrollWidth>innerWidth+1};
   },{theme,state,surface,event});
   assert.equal(result.height,state==='compact'?130:220);assert(result.naturalWidth>0&&!result.overflow);assert(result.left>=result.cardLeft-1&&result.right<=result.cardRight+1);assert.equal(result.src,art.resolve(event).path);assert.equal(result.fallback,art.resolve(event).kind==='fallback');assert.match(result.caption,new RegExp(event.venue.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert(result.opaqueFraction>.003&&result.opaqueFraction<.6,'course gaps and glyph background must be transparent');assert.deepEqual(result.palette,require('../config/feed-card-presentation').palette(event).slice(0,2));
   report.cases.push({engine:name,width,theme,state,surface,eventId:event.id,...result});if(width===390&&surface==='feed'&&event.roundNumber===1&&event.season==='2027')await page.locator('#venue-test').screenshot({path:path.join(out,`${name}-${theme}-${state}-dakar.png`)});
  }
  await page.evaluate(()=>document.getElementById('venue-test')?.remove());
  await page.locator('.tab-btn[data-tab="events"]').click();await page.waitForFunction(()=>document.querySelectorAll('.events-overview-card .venue-location-hero').length===1);
  assert.equal(await page.locator('.event-overviews-host').count(),1);assert.equal(await page.locator('.events-overview-card .nsc-rating-block').count(),0);
  const parent=page.locator('.events-overview-card .venue-location-hero img');await parent.scrollIntoViewIfNeeded();await parent.evaluate(i=>i.decode());assert.match(await parent.getAttribute('src'),/dakar-2027-edition.svg/);await page.locator('.events-overview-card').screenshot({path:path.join(out,`${name}-${width}-edition.png`)});
  await page.route(/\/assets\/identities\/dakar\/dakar-2027-edition\.svg(?:\?.*)?$/,r=>r.abort());
  for(const theme of['day','night']){
   await page.evaluate(theme=>{applyThemePreference(theme);const mount=document.createElement('section');mount.id='failed-dakar-test';mount.style.cssText='position:fixed;inset:0;z-index:100000;width:100%;max-width:520px;margin:auto';document.body.append(mount);appendVenuePanel(mount,mount,{key:'dakar',season:'2027',isEditionOverview:true,editionGeometryVerified:true,editionArtworkId:'dakar-2027',venue:'Dakar 2027',venueCountryCode:'SA'});const image=mount.querySelector('img');image.loading='eager';image.src+='?failure-probe='+theme;},theme);
   await page.waitForFunction(()=>document.querySelector('#failed-dakar-test .venue-location-hero')?.classList.contains('is-venue-fallback'));const fallback=page.locator('#failed-dakar-test img');await fallback.evaluate(i=>i.decode());assert.match(await fallback.getAttribute('src'),/rally-raid-white.svg/);await page.evaluate(()=>document.getElementById('failed-dakar-test').remove());
  }
  await page.unroute(/\/assets\/identities\/dakar\/dakar-2027-edition\.svg(?:\?.*)?$/);
  await page.locator('.tab-btn[data-tab="follow"]').click();const expand=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await expand.count())await expand.click();
  const motorsport=page.locator('[data-follow-sport="sport:motorsport"]').first();await motorsport.waitFor({state:'visible'});await motorsport.click();await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:f1'&&!codeInspectorChunkLoading);await page.evaluate(()=>scrollTo(0,0));const reveal=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await reveal.count())await reveal.click();
  await page.locator('.follow-category-bar').getByRole('button',{name:'Dakar Rally',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#follow-navigation-controls > h2')?.textContent.includes('Dakar'));
  const revealDakar=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await revealDakar.count())await revealDakar.click();
  await page.waitForFunction(()=>document.querySelector('.schedule-rest-note')?.textContent.includes('Bisha'));
  await page.evaluate(()=>scrollTo(0,0));const showMark=page.getByRole('button',{name:'Expand Follow navigation',exact:true});if(await showMark.count())await showMark.click();
  const mark=page.locator('#follow-navigation-controls h2 img.event-brand-logo').first();await mark.evaluate(i=>i.decode());assert.match(await mark.getAttribute('src'),/dakar-brand.png/);
  await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.selectedSelectorEntityIds=['sport:motorsport'];next.followedSports=['motorsport'];savePreferences(next,{viewOnly:true});renderFollowView();});await page.waitForFunction(()=>document.querySelector('input[aria-label="Follow Dakar Rally"]')?.checked===false);assert.equal(await page.getByRole('checkbox',{name:'Follow Dakar Rally',exact:true}).isChecked(),false,'broad Motorsport cannot show the new Dakar choice as followed');
  assert.match(await page.locator('.schedule-rest-note').last().textContent(),/9 Jan|9 JAN/i);assert.equal(await page.locator('.schedule-rest-note .nsc-rating-block').count(),0);
  assert(await page.locator('footer .dakar-attribution').isVisible());await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^About/}).click();assert(await page.locator('.settings-about .dakar-attribution').isVisible());await page.close();
 }}finally{await browser.close();}}
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(`Dakar: ${report.cases.length} card cases, Chromium/WebKit, four widths, both themes/states/surfaces, transparent artwork, fallback, edition parents, Schedule rest notes, Follow and credits passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
