'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..'),report=process.env.SKI_CALENDAR_BROWSER_REPORT;
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(err,bytes)=>{res.writeHead(err?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(err?'':bytes);});});
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,observations=[],journeys=[];
 try{
  for(const name of ['chromium','webkit']){
   const browser=await playwright[name].launch(name==='chromium'?{channel:'chrome'}:{});
   try{
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
    await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
    await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:['sport:skiing'],followFirst:{notifications:{autoRemindersEnabled:false}}})));
    await page.goto(base);await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
    const documents=await page.evaluate(async()=>({schedule:await(await fetch('/data/code-inspector/skiing.json')).json(),feed:await(await fetch('/data/events.json')).json()}));
    const ids=['evt_101','evt_102','evt_103','evt_104'],fixtures=documents.schedule.fixtures.filter(f=>ids.includes(f.id));assert.equal(fixtures.length,4);
    await page.evaluate(()=>openCodeInspector('sport:skiing',{pushHistory:false}));
    await page.waitForFunction(()=>activeInspectorCodeId==='sport:skiing'&&codeInspectorChunk?.fixtures?.length===4);
    await page.waitForFunction(()=>!!document.querySelector('[data-event-id="evt_101"]'),{},{timeout:15000});
    const firstVisible=await page.evaluate(()=>[...document.querySelectorAll('.code-inspector-view [data-event-id]')].map(e=>e.dataset.eventId));
    assert.deepEqual(firstVisible,['evt_104','evt_101','evt_102'],'Venue calendar days must be in chronological order');
    await page.getByRole('button',{name:'Later rounds / events',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('[data-event-id="evt_103"]'));
    const journey=await page.evaluate(()=>({code:activeInspectorCodeId,fixtures:codeInspectorChunk.fixtures.map(f=>f.id),visibleIds:[...document.querySelectorAll('.code-inspector-view [data-event-id]')].map(e=>e.dataset.eventId),text:document.body.innerText,preferences:JSON.stringify(userPreferences)}));
    assert(ids.every(id=>journey.visibleIds.includes(id)),'Later navigation must reveal all four retained appointments');
    if(report)fs.writeFileSync(path.join(path.dirname(report),`${name}-schedule-journey.json`),JSON.stringify(journey,null,2)+'\n');
    assert(journey.text.includes('Kvitfjell')&&journey.text.includes('Sun Valley')&&journey.text.includes('Shahdag'),'Actual Schedule must render all retained appointments');assert(/partial/i.test(journey.text),'Schedule must disclose partial coverage');journeys.push({browser:name,...journey});
    const sun=documents.feed.events.find(e=>e.id==='evt_103');
    const exact={...sun,startTimeUtc:'2027-03-20T20:00:00.000Z',timePrecision:'exact',scheduleStatus:'confirmed',timeTbc:false,startTimeTbc:false};
    for(const width of [320,390,1280])for(const theme of ['day','night'])for(const mode of ['feed','schedule','fallback'])for(const fixture of [...fixtures,exact]){
     await page.setViewportSize({width,height:844});const controlled=fixture===exact;
     const observation=await page.evaluate(({fixture,theme,mode,controlled})=>{
      document.documentElement.dataset.theme=theme;const before=JSON.stringify(userPreferences);activeTab=mode==='feed'?'feed':'follow';activeInspectorCodeId=null;
      const event=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(fixture),host=document.getElementById('listView');host.replaceChildren(mode==='schedule'?buildCodeInspectorFixture(event):mode==='fallback'?buildFixtureFallbackCard(event):buildEventCard(event));
      const card=host.querySelector('[data-event-id]');if(!card)throw Error('Source card did not render');
      card.scrollIntoView({block:'center'});const bounds=card.getBoundingClientRect();const text=card.textContent,instant=eventReminderTiming(event);
      return {id:fixture.id,controlled,mode,text,visibleOnScreen:bounds.width>0&&bounds.height>0&&bounds.bottom>120&&bounds.top<innerHeight,timeTbc:/time tbc/i.test(text),venueDate:/Norway date|Idaho date|Azerbaijan dates/i.test(text),unverifiedWatch:/Watch via FIS broadcast/i.test(text),reminderClock:!!instant,preferencesPreserved:JSON.stringify(userPreferences)===before,overflow:document.documentElement.scrollWidth>innerWidth+1,sourceClock:event.sourceCheckedAt,normalizedDate:event.date};
     },{fixture,theme,mode,controlled});
     assert(observation.preferencesPreserved);assert(observation.visibleOnScreen,'Source renderer must be visible in the viewport');assert(!observation.overflow,JSON.stringify({name,width,mode,id:fixture.id}));assert(!observation.unverifiedWatch);
     if(controlled){assert.equal(observation.normalizedDate,'2027-03-21');assert(!observation.venueDate);assert(!observation.timeTbc);}
     else{assert(observation.timeTbc,JSON.stringify({name,mode,id:fixture.id,text:observation.text.slice(0,400)}));assert(observation.venueDate,JSON.stringify({name,mode,id:fixture.id,text:observation.text.slice(0,550)}));assert(!observation.reminderClock);}
     observations.push({browser:name,width,theme,...observation});
     if(report&&width===390&&theme==='day'&&mode==='feed'&&fixture.id==='evt_103'&&!controlled)await page.screenshot({path:path.join(path.dirname(report),`${name}-sun-valley.png`),fullPage:false});
    }
   }finally{await browser.close();}
  }
 }finally{if(server)await new Promise(resolve=>server.close(resolve));}
 const proof={checkedAt:new Date().toISOString(),base,cases:observations.length,publishedCases:observations.filter(o=>!o.controlled).length,controlledCases:observations.filter(o=>o.controlled).length,journeys,observations,limits:['Published cases read actual served documents; the exact Sun Valley recovery is a controlled future source observation.','APIs mocked unavailable; service workers blocked; no authenticated operation, customer activity, physical device, playback, source refresh or push.']};
 if(report){fs.mkdirSync(path.dirname(report),{recursive:true});fs.writeFileSync(report,JSON.stringify(proof,null,2)+'\n');}
 console.log(`Skiing: ${proof.publishedCases} published/${proof.controlledCases} controlled Feed/Schedule/fallback cases and two actual Schedule journeys pass in Chromium/WebKit, three widths/two themes.`);
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
