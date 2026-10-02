#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const nbl=process.argv.includes('--nbl'),sport=nbl?'NBL':'Football';
const root=path.resolve(__dirname,'..'),fixtures=require(`../data/code-inspector/${nbl?'nbl':'football'}.json`).fixtures;
const pilots=(nbl?['competition:nbl']:['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league']).map(id=>fixtures.find(f=>f.competitionId===id&&f.status==='upcoming')||fixtures.find(f=>f.competitionId===id));assert(pilots.every(Boolean));
const variants=[{name:'unobserved schedule',status:'upcoming',age:null,expected:'Awaiting match update'},{name:'old live',status:'live',age:31*60000,expected:'Awaiting match update'},{name:'future live',status:'live',age:-60000,expected:'Awaiting match update'},{name:'invalid live',status:'live',age:'invalid',expected:'Awaiting match update'},{name:'fresh live',status:'live',age:5*60000,expected:'LIVE'},{name:'fresh ongoing',status:'ongoing',age:0,expected:'ONGOING'},{name:'retained final',status:'completed',age:'invalid',expected:'FINISHED'},{name:'live two days later',status:'live',age:48*3600000,later:true,expected:'Awaiting match update'}];
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});});
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await(process.env.QA_BROWSER==='webkit'?webkit:chromium).launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  await page.route('https://**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.addInitScript(sportId=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:[sportId],showSpoilers:false,onboardingComplete:true})),nbl?'sport:nbl':'sport:football');
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
  const shell=await page.locator('meta[name="app-shell-version"]').getAttribute('content');const observations=[];
  for(const fixture of pilots)for(const variant of variants)for(const mode of ['compact','feed','schedule'])for(const width of [320,390])for(const theme of ['day','night']){
   const now=Date.parse(fixture.startTimeUtc)+(variant.later?48*3600000:30*60000);
   await page.clock.setFixedTime(now);await page.setViewportSize({width,height:844});
   const result=await page.evaluate(({fixture,variant,mode,theme,now})=>{
    activeTab=mode==='schedule'?'follow':'feed';activeInspectorCodeId=null;userPreferences.showSpoilers=false;userPreferences.feedCompact=mode==='compact';applyThemePreference(theme);
    const event={...fixture,eventId:fixture.id,status:variant.status,scheduleStatus:variant.status,statusCheckedAt:typeof variant.age==='number'?new Date(now-variant.age).toISOString():variant.age,statusSource:null,timingSource:null};
    const before=JSON.stringify(event),preferences=JSON.stringify(userPreferences);setCardState(event,mode==='compact'?'compact':'opened');
    // An isolated fixture key prevents canonical lookup from replacing the
    // controlled observation with the published upcoming row in Schedule.
    const input=mode==='schedule'?{...event,id:'status-rehearsal:'+fixture.id,eventId:'status-rehearsal:'+fixture.id}:event;
    setCardState(input,mode==='compact'?'compact':'opened');const card=mode==='schedule'?buildCodeInspectorFixture(input):buildEventCard(input);card.style.contentVisibility='visible';
    document.getElementById('listView').replaceChildren(card);scrollTo(0,0);
    const badge=card.querySelector('.fixture-timing-badge'),label=badge?.querySelector('small'),b=label?.getBoundingClientRect(),c=card.getBoundingClientRect();
    return {text:label?.textContent||'',aria:badge?.getAttribute('aria-label'),factsUnchanged:JSON.stringify(event)===before,preferencesUnchanged:JSON.stringify(userPreferences)===preferences,profileLinks:card.querySelectorAll('.fixture-profile-link').length,compact:card.classList.contains('is-compact-row'),inside:!!b&&b.width>0&&b.left>=c.left-1&&b.right<=c.right+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};
   },{fixture,variant,mode,theme,now});
   const label=`${fixture.competitionId}/${variant.name}/${mode}/${width}/${theme}`;
   assert.equal(result.text,variant.expected,label+': visible source-qualified status');assert(result.aria.includes(variant.expected)&&result.aria.includes('Sydney time'),label+': accessible status retains scheduled time');assert(result.inside&&!result.pageOverflow,label+': status is readable inside the mobile card');assert(result.factsUnchanged&&result.preferencesUnchanged,label+': no fact/date/consent mutation');assert.equal(result.profileLinks,2,label+': both canonical participant controls');assert.equal(result.compact,mode==='compact',label+': real requested state');
   observations.push({competitionId:fixture.competitionId,fixtureId:fixture.id,variant:variant.name,mode,width,theme,...result});
  }
  const report={checkedAt:new Date().toISOString(),sport,shell,browser:process.env.QA_BROWSER||'chromium',cases:observations.length,observations,scope:'Controlled status observations on published participants/fixtures, actual compact/full Feed/Schedule builders, fixed browser clock, mobile day/night. Anonymous preferences, account APIs unavailable and worker blocked. Not actual live-play, authenticated or physical-device acceptance.'};
  if(process.env.QA_REPORT_FILE)fs.writeFileSync(process.env.QA_REPORT_FILE,JSON.stringify(report,null,2)+'\n');console.log(`${report.browser}: ${report.cases} ${sport} status surface cases passed at shell ${shell}.`);
 }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
})().catch(error=>{console.error(error);process.exitCode=1;});
