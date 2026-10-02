#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.QA_BROWSER==='webkit'?webkit:chromium;
(async()=>{const browser=await engine.launch({headless:true,...(engine===chromium?{channel:'chrome'}:{})});try{
 for(const width of [320,390,768,1280])for(const theme of ['day','night']){
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['f1'],selectedSelectorEntityIds:['sport:f1']})));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');await page.waitForFunction(()=>typeof appendFollowedFixtureParticipants==='function');
 await page.evaluate(theme=>{applyThemePreference(theme);document.getElementById('startupLaunch')?.remove();document.body.classList.remove('startup-shell-visible');document.getElementById('timelineTools').hidden=false;document.getElementById('jumpTodayBtn').hidden=false;document.getElementById('mainContent').style.minHeight='4000px';},theme);
 const before=await page.locator('#jumpTodayBtn').boundingBox();await page.evaluate(()=>scrollTo(0,1200));const after=await page.locator('#jumpTodayBtn').boundingBox();assert(Math.abs(before.x-after.x)<1&&Math.abs(before.y-after.y)<1,'Jump to Now must stay fixed during page scrolling');assert(after.x+after.width<=width-8&&after.y+after.height<=844-8);
 const result=await page.evaluate(async()=>{
  cachedParticipantFollow=()=>({followed:true});const host=document.createElement('div');host.id='qa-presentation';host.style.cssText='position:fixed;inset:100px 8px auto;z-index:500;background:var(--bg-card)';document.body.append(host);
  const rows=[];
  for(const key of ['wrc','f1']){
    const ev={id:'qa:'+key,key,name:'Racing fixture',date:'2026-10-03',endDate:'2026-10-04',dateOnly:true,timePrecision:'date-only',venue:'QA venue',participants:Array.from({length:9},(_,i)=>({id:`competitor:${key}:${i}`,displayName:`Driver ${i} long-name`}))};
    activeTab='feed';setCardState(ev,'opened');const fixture=buildEventCard(ev);host.append(fixture);const row=fixture.querySelector('.fixture-participant-links');if(!row)throw Error('Followed drivers missing from actual '+key+' card');const links=[...row.querySelectorAll('.fixture-profile-link')];
    const positions=links.map(a=>({text:a.textContent,top:a.getBoundingClientRect().top,height:a.getBoundingClientRect().height,width:a.getBoundingClientRect().width}));
    const height=row.getBoundingClientRect().height;row.scrollLeft=row.scrollWidth;const rightmostVisible=links.at(-1).getBoundingClientRect().right<=row.getBoundingClientRect().right+1;
    row.scrollLeft=0;links.at(-1).focus();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    rows.push({key,names:positions.map(a=>a.text),tops:positions.map(a=>a.top),targetHeights:positions.map(a=>a.height),targetWidths:positions.map(a=>a.width),viewportWidth:row.clientWidth,rowHeight:height,finalHeight:row.getBoundingClientRect().height,rightmostVisible,scrollLeft:row.scrollLeft,overflowing:row.scrollWidth>row.clientWidth,pager:!!row.querySelector('.fixture-participant-page-control')});
  }
  const published=await fetch("data/events.json").then(r=>r.json());
  const grandFinal=published.events.find(e=>e.id==='event:afl:cd_m20260142901'||e.canonicalEventId==='event:afl:cd_m20260142901'||/Fremantle.*Brisbane/.test(e.name||''));
  if(!grandFinal)throw new Error('Published Fremantle–Brisbane fixture missing');activeTab='follow';setCardState(grandFinal,'opened');const card=buildEventCard(grandFinal);host.append(card);
  return {rows,marquee:card.classList.contains('is-marquee-fixture'),label:card.querySelector('.fixture-marquee-label')?.textContent,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 for(const row of result.rows){assert.equal(row.names.length,9,'every followed driver remains reachable');assert.equal(new Set(row.tops).size,1,'names remain on one line');assert.equal(row.rowHeight,row.finalHeight);assert(row.targetHeights.every(h=>h>=44),'links retain 44px touch height');assert(row.targetWidths.every(w=>w<row.viewportWidth*.8),'each name takes only its own width so multiple names fit');assert(row.rightmostVisible&&row.overflowing&&row.scrollLeft>0,'the last driver is reachable by horizontal and keyboard scrolling');assert(!row.pager,'pagination removed');}assert.equal(result.marquee,true);assert.match(result.label,/Grand Final/i);assert.equal(result.overflow,0);
 if(width===390&&theme==='day'&&process.env.QA_SCREENSHOT_PATH)await page.screenshot({path:process.env.QA_SCREENSHOT_PATH});
 console.log(width,theme,'fixed Now, F1/WRC horizontal scrolling and Grand Final accent passed');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
