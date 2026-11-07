'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),id='rugby-australia-south-africa-2026-09-27',old='fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945';
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/html'});res.end(e?'':b);});});
 if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await(process.env.QA_BROWSER==='webkit'?webkit:chromium).launch();const observations=[];
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:rugby'],followedSports:['rugby'],showSpoilers:false,preferenceGraph:{entityFollows:[{participantId:'team:rugby:wallabies',followLevel:'follow'}]}})));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof buildCodeInspectorFixture==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const fixture=await page.evaluate(async id=>{const d=await(await fetch('/data/code-inspector/rugby-union.json')).json();const f=d.fixtures.filter(f=>f.id===id);if(f.length!==1)throw new Error('Duplicate Rugby projection');await openCodeInspector('sport:rugby-union',{startingTab:'all-fixtures'});return f[0];},id);
 await page.locator(".code-inspector-group").first().waitFor();
 for(let n=0;n<10&&await page.locator(`[data-event-id="${id}"]`).count()===0;n++){const earlier=page.getByRole("button",{name:"Earlier rounds / events",exact:true});if(await earlier.count()===0)break;await earlier.click();}
 for(let n=0;n<40&&await page.locator(`[data-event-id="${id}"]`).count()===0;n++){const later=page.getByRole("button",{name:"Later rounds / events",exact:true});if(await later.count()===0)break;await later.click();}
 await page.locator(`[data-event-id="${id}"]`).waitFor({state:"attached",timeout:5000});
 assert.equal(await page.locator(`[data-event-id="${id}"]`).count(),1,'ordinary Rugby Schedule journey has one fixture');
 for(const mode of ['feed','schedule'])for(const show of [false,true])for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(({fixture,mode,show})=>{activeTab=mode==='feed'?'feed':'follow';activeInspectorCodeId=null;userPreferences.showSpoilers=show;userPreferences.feedCompact=false;const f={...fixture,eventId:fixture.id};setCardState(f,'opened');const card=mode==='feed'?buildEventCard(f):buildCodeInspectorFixture(fixture);card.style.contentVisibility='visible';document.getElementById('listView').replaceChildren(card);scrollTo(0,0);},{fixture,mode,show});
  const card=page.locator('#listView .event-card');await card.scrollIntoViewIfNeeded();
  const text=await card.innerText();assert(/7:45|19:45/.test(text),`${mode}: host scheduled time`);assert(!/7:30|19:30/.test(text),'old provider time absent');
  if(show)assert(/42\s*[–-]\s*38|42.*38/s.test(text),'confirmed score revealed');else assert(!/42\s*[–-]\s*38|42.*38/s.test(text),'no score leak');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${mode}/${show}/${width}`);observations.push({mode,show,width,overflow});
 }
 const state=await page.evaluate(({id,old})=>{ratings={[old]:5};const before=getActual(id);setEventRating({id},4,{revealSpoilers:false});return {before,after:getActual(id),legacy:ratings[old],aliases:NOTHINGSPORTS_FIXTURE_IDENTITY.fixtureAliases(old)};},{id,old});assert.equal(state.before,5);assert.equal(state.after,4);assert.equal(state.legacy,undefined);assert(state.aliases.includes(id));
 const report={checkedAt:new Date().toISOString(),browser:process.env.QA_BROWSER||'chromium',cases:observations.length,observations,ordinaryScheduleJourney:true,legacyLocalRating:true,scope:'Isolated browser; account APIs unavailable and worker blocked. Ordinary Rugby Schedule plus opened Feed/Schedule components at four widths; not physical-device, private account or full Rugby certification.'};
 if(process.env.QA_REPORT_FILE)fs.writeFileSync(process.env.QA_REPORT_FILE,JSON.stringify(report,null,2)+'\n');console.log(`${report.browser}: ${report.cases} Rugby component cases and ordinary Schedule journey passed; one fixture, correct time, spoiler protection, saved rating and no overflow.`);
 }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
})().catch(e=>{console.error(e);process.exitCode=1});
