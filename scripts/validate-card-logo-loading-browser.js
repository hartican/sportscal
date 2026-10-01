'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const events=require('../data/events.json').events;
const fixtures=['rugby-australia-south-africa-2026-09-27','major-match-nrl-finals-2026-preliminary-final-2'].map(id=>events.find(e=>e.id===id));
assert(fixtures.every(Boolean));
(async()=>{
 const browser=await(process.env.QA_BROWSER==='webkit'?webkit.launch():chromium.launch({channel:'chrome'}));
 try{
  const page=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block'});
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33962');
  await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
  await page.addStyleTag({content:'*{transition:none!important;animation:none!important}header.top,#timelineTools{visibility:hidden!important}'});
  for(const width of [390,1280])for(const theme of ['day','night'])for(const fixture of fixtures)for(const tab of ['events','feed']){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(({fixture,tab,theme})=>{
    document.querySelectorAll('[role=dialog]').forEach(n=>n.parentElement.style.display='none');document.querySelectorAll('dialog[open]').forEach(n=>n.close());document.getElementById('startupLaunch')?.remove();document.body.classList.remove('modal-open','settings-open');
    applyThemePreference(theme);activeTab=tab;activeInspectorCodeId=null;userPreferences.feedCompact=false;setCardState(fixture,'opened');
    window.logoDecodes=[];window.originalLogoDecode=HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode=function(){return new Promise(resolve=>logoDecodes.push(resolve));};
    document.getElementById('listView').replaceChildren(buildEventCard(fixture));observeDeferredCardImages();
   },{fixture,tab,theme});
   const card=page.locator('#listView .event-card');await card.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>[...document.querySelectorAll('#listView .matchup-team-logo')].length===2&&[...document.querySelectorAll('#listView .matchup-team-logo')].every(i=>i.complete&&i.naturalWidth>0));
   const geometry=()=>card.evaluate(c=>[...c.querySelectorAll('.matchup-team-logo-slot')].map(s=>{const r=s.getBoundingClientRect(),i=s.querySelector('img').getBoundingClientRect();return {frame:{x:r.x,y:r.y,width:r.width,height:r.height},image:{x:i.x,y:i.y,width:i.width,height:i.height},fallbacks:s.querySelectorAll('.team-logo-fallback,.team-logo-monogram').length,opacity:getComputedStyle(s.querySelector('img')).opacity};}));
   const pending=await geometry();
   for(const s of pending){assert(Math.abs(s.image.y+s.image.height/2-(s.frame.y+s.frame.height/2))<1,'pending logo shares the frame centre rather than a second grid row');assert(s.image.height>=s.frame.height*.85,'pending logo retains its full size');}
   await page.evaluate(async()=>{const card=document.querySelector('#listView .event-card');card.remove();HTMLImageElement.prototype.decode=originalLogoDecode;logoDecodes.forEach(resolve=>resolve());await Promise.resolve();document.getElementById('listView').append(card);});
   await page.waitForFunction(()=>[...document.querySelectorAll('#listView .matchup-team-logo-slot')].every(s=>!s.querySelector('.team-logo-fallback,.team-logo-monogram')));
   const loaded=await geometry();
   for(let tap=0;tap<4;tap++){
    await page.locator('#listView .event-card-disclosure').click();
    const current=await geometry();assert.equal(current.length,2);for(let i=0;i<2;i++){assert.equal(current[i].fallbacks,0,'cached tap never reintroduces a fallback beside a logo');assert(Math.abs(current[i].image.height-loaded[i].image.height)<1,'tap preserves the logo dimensions');}
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   if(process.env.QA_SCREENSHOT_DIR&&width===390&&tab==='feed'){require('node:fs').mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await card.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/logos-${process.env.QA_BROWSER||'chromium'}-${fixture.key}-${theme}.png`});}
   console.log(`${width}/${theme}/${fixture.key}/${tab}: delayed decode, detached reveal and four cached taps passed`);
  }
  // A permanently unavailable identity leaves one centred fallback, without an image row.
  await page.route(/\/\.theme\/.*badge.*\.svg/,r=>r.abort());
  await page.evaluate(fixture=>{activeTab='events';setCardState(fixture,'opened');const card=buildEventCard(fixture);card.querySelectorAll('.matchup-team-logo').forEach(image=>{image.src=image.dataset.teamLogoLight+'?qa-failed-logo=1';});document.getElementById('listView').replaceChildren(card);observeDeferredCardImages();},fixtures[1]);
  await page.locator('#listView .event-card').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('#listView .matchup-team-logo-slot')].every(s=>!s.querySelector('img')&&s.querySelector('.team-logo-fallback,.team-logo-monogram')),null,{timeout:5000});
  const failed=await page.locator('#listView .matchup-team-logo-slot').evaluateAll(slots=>slots.map(s=>{const r=s.getBoundingClientRect(),f=s.querySelector('.team-logo-fallback,.team-logo-monogram').getBoundingClientRect();return Math.abs((r.y+r.height/2)-(f.y+f.height/2));}));
  assert(failed.every(offset=>offset<1),'failed images leave centred fallbacks');
  console.log('Failed assets retain one centred fallback per team.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
