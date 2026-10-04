#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const original=require('../data/canonical/afl-nrl-2026.json').events.find(e=>e.id==='event:aflw:cd_m20262640808');
const fixture={...require('../data/code-inspector/aflw.json').fixtures.find(e=>e.id===original.id),status:'live',scheduleStatus:'confirmed',statusCheckedAt:'2026-10-04T05:49:24.432Z',statusSourceUrl:original.source.sourceUrl};
for(const key of ['homeScore','awayScore','score','scoreDisplay','result','canonicalResultScoreline','outcomeText','recapText'])delete fixture[key];
fixture.participantSlots=fixture.participantSlots.map(({score,...slot})=>slot);
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(err?'':data);});});
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,engine=process.env.BROWSER_ENGINE||'chromium',browser=await pw[engine].launch(),rows=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  await page.route('https://**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:['sport:aflw']})));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
  await page.locator('#startupLaunch').waitFor({state:'hidden',timeout:60000});
  const shell=await page.locator('meta[name="app-shell-version"]').getAttribute('content');
  for(const width of [320,390,1280])for(const theme of ['dark','light'])for(const mode of ['compact','expanded','schedule'])for(const state of ['fresh','stale','unobserved'])for(const results of [false,true]){
   await page.setViewportSize({width,height:844});
   await page.clock.setFixedTime(new Date(state==='fresh'?'2026-10-04T06:00:00Z':'2026-10-04T08:00:00Z'));
   const input=state==='unobserved'?{...fixture,status:'upcoming',statusCheckedAt:null}:fixture;
   const receipt=await page.evaluate(({fixture,theme,mode,results})=>{
    activeTab=mode==='schedule'?'follow':'feed';userPreferences.feedCompact=mode==='compact';userPreferences.showSpoilers=results;applyThemePreference(theme);
    const before=JSON.stringify(userPreferences),event=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(fixture);setCardState(event,mode==='compact'?'compact':'opened');
    // Replay the publication consistently on both surfaces. Today's genuine
    // later final must not be mixed into the earlier controlled live snapshot.
    for(const records of [EVENTS,activeEvents])for(let i=0;i<records.length;i++)if([records[i].id,records[i].canonicalEventId].includes(fixture.id))records[i]=event;
    const card=mode==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard(event);card.style.contentVisibility='visible';document.getElementById('listView').replaceChildren(card);
    const timing=card.querySelector('.fixture-timing-badge,.event-timing-state');
    return {text:card.innerText,timing:timing?.textContent,liveNow:NOTHINGSPORTS_FEED_CONTROLS.matchesTiming(event,'live_now',new Date()),preferencesPreserved:JSON.stringify(userPreferences)===before,overflow:document.documentElement.scrollWidth>innerWidth+1,sourceClock:NOTHINGSPORTS_FIXTURE_IDENTITY.fromSchedule(fixture,{slug:'aflw'}).statusCheckedAt};
   },{fixture:input,theme,mode,results});
   const label=`${engine}/${width}/${theme}/${mode}/${state}/${results}`,expected=state==='fresh'?/live(?: now)?/i:/Awaiting match update/i;
   assert(expected.test(receipt.timing||''),label+': mounted timing describes source freshness: '+JSON.stringify(receipt.timing));
   assert.equal(receipt.liveNow,state==='fresh',label+': stale status cannot enter Live Now');
   assert.equal(receipt.sourceClock,input.statusCheckedAt,label+': conversion cannot renew source observation');
   assert(receipt.preferencesPreserved&&!receipt.overflow,label+': no preference mutation or page overflow');
   assert(!receipt.text.includes('71-16'),label+': another fixture score cannot leak into a live replay');
   rows.push({engine,shell,width,theme,mode,state,results,...receipt});
  }
  if(process.env.REFERENCE_STATUS_REPORT_PATH)fs.writeFileSync(process.env.REFERENCE_STATUS_REPORT_PATH,JSON.stringify({checkedAt:new Date().toISOString(),engine,shell,cases:rows.length,scope:'Actual public AFLW fixture replayed at controlled observation times through mounted Feed/compact/Schedule renderers. APIs/workers isolated; no real live-match, account, navigation, phone or push proof.',rows},null,2)+'\n');
  console.log(`${engine}: ${rows.length} canonical source-status rendering cases passed`);
 }finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
