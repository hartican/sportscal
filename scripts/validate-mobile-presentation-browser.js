#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [320,390,768,1280])for(const theme of ['day','night']){
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['f1'],selectedSelectorEntityIds:['sport:f1']})));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');await page.waitForFunction(()=>typeof appendFollowedFixtureParticipants==='function');
 await page.evaluate(theme=>{applyThemePreference(theme);document.getElementById('startupLaunch')?.remove();document.body.classList.remove('startup-shell-visible');document.getElementById('timelineTools').hidden=false;document.getElementById('jumpTodayBtn').hidden=false;document.getElementById('mainContent').style.minHeight='4000px';},theme);
 const before=await page.locator('#jumpTodayBtn').boundingBox();await page.evaluate(()=>scrollTo(0,1200));const after=await page.locator('#jumpTodayBtn').boundingBox();assert(Math.abs(before.x-after.x)<1&&Math.abs(before.y-after.y)<1,'Jump to Now must stay fixed during page scrolling');assert(after.x+after.width<=width-8&&after.y+after.height<=844-8);
 const result=await page.evaluate(async()=>{
  cachedParticipantFollow=()=>({followed:true});const host=document.createElement('div');host.id='qa-presentation';host.style.cssText='position:fixed;inset:100px 8px auto;z-index:500;background:var(--bg-card)';document.body.append(host);
  const ev={id:'qa:wrc',key:'wrc',name:'WRC Rally',participants:Array.from({length:9},(_,i)=>({id:`competitor:wrc:${i}`,displayName:`Driver ${i} long-name`}))};appendFollowedFixtureParticipants(host,ev);const row=host.firstElementChild;const height=row.getBoundingClientRect().height;const names=new Set();let guard=0;do{row.querySelectorAll('.fixture-participant-page-names button,.fixture-participant-page-names a').forEach(a=>names.add(a.textContent));const next=row.querySelector('[aria-label="Next followed drivers and teams"]');if(next.disabled)break;next.click();}while(++guard<10);
  const published=await fetch("data/events.json").then(r=>r.json());
  const grandFinal=published.events.find(e=>e.id==='event:afl:cd_m20260142901'||e.canonicalEventId==='event:afl:cd_m20260142901'||/Fremantle.*Brisbane/.test(e.name||''));
  if(!grandFinal)throw new Error('Published Fremantle–Brisbane fixture missing');const card=buildEventCard(grandFinal);host.append(card);
  return {names:[...names],rowHeight:height,finalHeight:row.getBoundingClientRect().height,page:row.querySelector('.fixture-participant-page-count').textContent,marquee:card.classList.contains('is-marquee-fixture'),label:card.querySelector('.fixture-marquee-label')?.textContent,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert.equal(result.names.length,9,'every followed WRC driver remains reachable');assert.equal(result.rowHeight,result.finalHeight,'paging must not grow card height');assert.equal(result.marquee,true);assert.match(result.label,/Grand Final/i);assert.equal(result.overflow,0);
 if(width===390&&theme==='day'&&process.env.QA_SCREENSHOT_PATH)await page.screenshot({path:process.env.QA_SCREENSHOT_PATH});
 console.log(width,theme,'fixed Now, WRC pagination and Grand Final accent passed');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
