#!/usr/bin/env node
'use strict';
// Exercise the rendered component: missing artwork and failed artwork must not
// make one team visually smaller than its opponent in the compact Feed or escape the narrow Schedule card.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const football=require('../data/code-inspector/football.json').fixtures;
const events=require('../data/events.json').events;
const fixtures=[football.find(f=>f.participantIds?.includes('team:football:club:lech-poznan')),
 events.find(f=>f.id==='major-match-nrl-finals-2026-preliminary-final-2'),
 events.find(f=>f.key==='afl'&&f.participantIds?.length===2&&f.date)];
assert(fixtures.every(Boolean),'Published Football, NRL and AFL inputs exist');
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));
  fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});
 });
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await(process.env.QA_BROWSER==='webkit'?webkit:chromium).launch();
 const observations=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  await page.route('https://**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:football'],showSpoilers:false,onboardingComplete:true})));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
  for(const mode of (process.env.QA_MODE?[process.env.QA_MODE]:['feed','schedule']))for(const width of [320,390,768,1280])for(const theme of ['day','night'])for(const fixture of fixtures)for(const failImages of [false,true]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(({fixture,theme,failImages,mode})=>{
    activeTab=mode==='feed'?'feed':'follow';activeInspectorCodeId=null;userPreferences.feedCompact=mode==='feed';userPreferences.showSpoilers=false;applyThemePreference(theme);
    const event={...fixture,eventId:fixture.eventId||fixture.id};setCardState(canonicalFeedFixtureForInspector(fixture)||event,mode==='feed'?'compact':'opened');setCardState(event,mode==='feed'?'compact':'opened');
    const card=mode==='feed'?buildEventCard(event):buildCodeInspectorFixture(fixture);card.style.contentVisibility='visible';const panel=document.createElement('div');panel.className=mode==='schedule'?'follow-schedule-panel':'';panel.append(card);document.getElementById('listView').replaceChildren(panel);observeDeferredCardImages();
    if(failImages)card.querySelectorAll('.compact-participant-mark,.matchup-team-logo').forEach(img=>{img.src='/qa-intentionally-unavailable-crest.svg';});
    scrollTo(0,0);
   },{fixture,theme,failImages,mode});
   const card=page.locator('#listView .event-card');await card.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>[...document.querySelectorAll('#listView .compact-participant-mark,#listView .matchup-team-logo')].every(img=>img.complete&&img.naturalWidth>0));
   const observation=await card.evaluate((card,mode)=>({compact:card.classList.contains('is-compact-row'),overflow:document.documentElement.scrollWidth>innerWidth+1,
    sides:[...card.querySelectorAll(mode==='feed'?'.compact-matchup-side':'.matchup-team-logo-slot')].map((side,index)=>{
     const identity=side.querySelector('img')||side.querySelector('.compact-participant-fallback,.team-logo-monogram');
     const box=identity?.getBoundingClientRect(),s=mode==='feed'?side.getBoundingClientRect():card.getBoundingClientRect(),link=mode==='feed'?side.querySelector('.fixture-profile-link'):card.querySelectorAll('.matchup-team-name .fixture-profile-link')[index];
     return {name:link?.textContent.trim(),profileLink:!!link,width:box?.width,height:box?.height,fallback:identity?.matches('.compact-participant-fallback,.team-logo-monogram'),fontPx:parseFloat(identity?getComputedStyle(identity).fontSize:'0'),inSide:!!box&&box.left>=s.left-1&&box.right<=s.right+1,loaded:identity?.tagName==='IMG'?identity.naturalWidth>0:null};
    })}),mode);
   const label=`${mode}/${width}/${theme}/${fixture.key}/${failImages?'failed artwork':'published artwork'}`;
   assert.equal(observation.compact,mode==='feed',label+': real requested state');assert.equal(observation.sides.length,2,label+': both participant identities');assert(!observation.overflow,label+': no horizontal overflow');
   for(const side of observation.sides){assert(side.profileLink&&side.name,label+': named profile control');assert(side.inSide,label+': identity fits participant column');if(mode==='feed')assert(Math.abs(side.width-48)<1&&Math.abs(side.height-48)<1,label+`: equal 48px identity frames; ${side.name} was ${side.width}x${side.height}`);else if(side.fallback)assert(Math.abs(side.width-side.height)<1,label+': round fallback rather than squeezed oval');if(side.fallback)assert(side.fontPx>=12,label+': readable initials');else assert(side.loaded,label+': real crest loaded');}
   if(failImages)assert(observation.sides.every(s=>s.fallback),label+': unavailable images retain initials');
   observations.push({mode,width,theme,sport:fixture.key,fixtureId:fixture.id,failImages,...observation});
   if(process.env.QA_SCREENSHOT_DIR&&mode==='feed'&&width===390&&fixture===fixtures[0]&&!failImages){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await card.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,`fixture-football-${process.env.QA_BROWSER||'chromium'}-${theme}.png`)});}
  }
  const report={checkedAt:new Date().toISOString(),browser:process.env.QA_BROWSER||'chromium',cases:observations.length,observations,scope:'Published Football/NRL/AFL compact Feed and opened Schedule components; missing and deliberately unavailable artwork, four widths and two themes. Anonymous isolated preferences, account APIs unavailable, worker blocked; not physical-device or permission certification.'};
  if(process.env.QA_REPORT_FILE)fs.writeFileSync(process.env.QA_REPORT_FILE,JSON.stringify(report,null,2)+'\n');
  console.log(`${report.browser}: ${report.cases} fixture identity cases passed; equal frames, readable initials and both profile controls.`);
 }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
})().catch(error=>{console.error(error);process.exitCode=1;});
