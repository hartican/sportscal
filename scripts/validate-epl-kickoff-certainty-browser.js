'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),certainty=require('./lib/epl-kickoff-certainty');
const root=path.resolve(__dirname,'..'),report=process.env.EPL_CERTAINTY_BROWSER_REPORT;
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(err,bytes)=>{res.writeHead(err?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(err?'':bytes);});});
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,observations=[];
 try{
  for(const name of ['chromium','webkit']){
   const browser=await playwright[name].launch(name==='chromium'?{channel:'chrome'}:{});
   try{const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:['sport:football']})));await page.goto(base);await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
    const fixtures=await page.evaluate(async()=>{const d=await(await fetch('/data/code-inspector/football.json')).json();const matches=d.fixtures.filter(f=>f.competitionId==='competition:premier-league-2026-27');return {confirmed:matches.find(f=>f.status==='upcoming'&&f.scheduleStatus==='confirmed'),provisional:matches.find(f=>f.status==='upcoming'&&f.scheduleStatus==='provisional')};});assert(fixtures.confirmed&&fixtures.provisional);
    const changedMillis=Date.parse(fixtures.confirmed.startTimeUtc)+3600000;
    fixtures.changed=certainty.qualify({...fixtures.confirmed,...require('./refresh-premier-league-cards').sydneyDateAndTime(changedMillis),startTimeUtc:new Date(changedMillis).toISOString()});
    fixtures.uncertain={...fixtures.confirmed,timeTbc:true,scheduleStatus:'tbc',timePrecision:'tbc'};
    for(const width of [320,390,1280])for(const theme of ['day','night'])for(const mode of ['feed','schedule','fallback'])for(const kind of ['confirmed','provisional','changed','uncertain']){
     await page.setViewportSize({width,height:844});const observation=await page.evaluate(({fixture,theme,mode,kind})=>{
      document.documentElement.dataset.theme=theme;const before=JSON.stringify(userPreferences);activeTab=mode==='feed'?'feed':'follow';
      const event=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(fixture),host=document.getElementById('listView');host.replaceChildren(mode==='schedule'?buildCodeInspectorFixture(fixture):mode==='fallback'?buildFixtureFallbackCard(event):buildEventCard(event));
      const card=host.querySelector('[data-event-id]');if(!card)throw Error('Actual card did not render');const text=card.textContent;
      return {mode,kind,text,approx:/approx\./i.test(text),reminderClock:!!eventReminderTiming(event),preferencesPreserved:JSON.stringify(userPreferences)===before,overflow:document.documentElement.scrollWidth>innerWidth+1,status:event.scheduleStatus,precision:event.timePrecision,sourceClock:event.sourceCheckedAt};
     },{fixture:fixtures[kind],theme,mode,kind});
     assert.equal(observation.reminderClock,kind==='confirmed');assert(observation.preferencesPreserved);assert(!observation.overflow,JSON.stringify({name,width,mode,kind}));assert.equal(observation.approx,['provisional','changed'].includes(kind),JSON.stringify({name,width,mode,kind,text:observation.text.slice(0,350)}));if(kind==='uncertain')assert(/time tbc/i.test(observation.text));observations.push({browser:name,width,theme,...observation});
    }
   }finally{await browser.close();}
  }
 }finally{if(server)await new Promise(resolve=>server.close(resolve));}
 if(report){fs.mkdirSync(path.dirname(report),{recursive:true});fs.writeFileSync(report,JSON.stringify({checkedAt:new Date().toISOString(),base,cases:observations.length,publishedCases:observations.filter(o=>['confirmed','provisional'].includes(o.kind)).length,controlledCases:observations.filter(o=>['changed','uncertain'].includes(o.kind)).length,observations,limits:['Backend APIs mocked unavailable; service workers blocked.','Confirmed/provisional cases use published documents; changed kickoff and explicit TBC are controlled source-to-screen cases.','No authenticated activity, physical device, playback, source refresh or push.']},null,2)+'\n');}
 console.log(`EPL certainty: ${observations.length} Feed/Schedule/fallback cases (72 published, 72 controlled), both engines, three widths/two themes, reminder eligibility and preferences pass.`);
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
