'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const aflwOnly=process.argv.includes('--aflw');
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/html'});res.end(e?'':b);});});
 if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await(process.env.QA_BROWSER==='webkit'?webkit:chromium).launch(),observations=[];
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.addInitScript(aflwOnly=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,...(aflwOnly?{selectedSelectorEntityIds:['sport:aflw']}:{followedSports:['rugby','cricket','golf']}),showSpoilers:false,preferenceGraph:{entityFollows:[{participantId:'team:rugby:wallabies',followLevel:'follow'},{participantId:'team:cricket:australia',followLevel:'follow'}]}})),aflwOnly);
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof buildCodeInspectorFixture==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const fixtures=await page.evaluate(async aflwOnly=>{
  const load=async code=>(await(await fetch(`/data/code-inspector/${code}.json`)).json()).fixtures;
  if(aflwOnly)return [(await load('aflw')).find(f=>f.id==='event:aflw:cd_m20262641601')];
  const rugby=await load('rugby-union'),cricket=await load('cricket'),golf=await load('golf'),hockey=await load('ice-hockey');
  return [rugby.find(f=>f.id==='rugby-australia-south-africa-2026-09-27'),rugby.find(f=>f.id==='rugby-new-zealand-australia-2026-10-10'),rugby.find(f=>f.id.includes('e492d961')),rugby.find(f=>f.competitionName==='Top 14 2027'),...['1525659','1525660','1525661','1525658'].map(id=>cricket.find(f=>f.id==='fixture:cricket:espn:'+id)),...['fixture:golf:lpga:2026068','fixture:golf:lpga:2026070','fixture:golf:lpga:2026063','fixture:golf:lpga:2026076','fixture:golf:pga:H2026166'].map(id=>golf.find(f=>f.id===id)),...['fixture:nhl:2026020035','fixture:nhl:2026020001','fixture:nhl:2026010063'].map(id=>hockey.find(f=>f.id===id))];
 },aflwOnly);assert(fixtures.every(Boolean));
 for(const mode of ['feed','schedule'])for(const show of [false,true])for(const width of [320,390,768,1280])for(const fixture of fixtures){
  await page.setViewportSize({width,height:844});
  const rendered=await page.evaluate(({fixture,mode,show})=>{
   activeTab=mode==='feed'?'feed':'follow';activeInspectorCodeId=null;userPreferences.showSpoilers=show;userPreferences.feedCompact=false;
   const f={...fixture,eventId:fixture.id};setCardState(f,'opened');const card=mode==='feed'?buildEventCard(f):buildCodeInspectorFixture(fixture);card.style.contentVisibility='visible';document.getElementById('listView').replaceChildren(card);scrollTo(0,0);
   return {marker:card.classList.contains('tournament-start-marker'),options:FOLLOW_FIRST.viewingOptions(f).map(o=>({id:o.providerId,url:o.url,label:o.label,paid:o.paid,accessType:o.accessType,replay:o.liveOrReplay==='replay',rightsScope:o.rightsScope,replayVerified:o.replayVerified}))};
  },{fixture,mode,show});
  const expected=rendered.options,presented=rendered.marker?[]:expected;
  const card=page.locator('#listView .event-card');await card.scrollIntoViewIfNeeded();
  const links=await card.locator('.fixture-providers a').evaluateAll(links=>links.map(a=>({href:a.getAttribute('href'),label:a.getAttribute('aria-label')})));
  assert.equal(links.length,presented.length,`${fixture.id}/${mode}: actual visible provider actions`);
  for(let i=0;i<links.length;i++){assert.equal(links[i].href,presented[i].url);const access={free:'Free',subscription:'Subscription',ppv:'Pay-per-view',included:'Included in plan'}[presented[i].accessType]||'Check cost';assert.equal(links[i].label,`${presented[i].replay?'Check replay availability':'Watch'} on ${presented[i].label} · ${access}`);}
  const text=await card.innerText();if(!expected.length&&!rendered.marker)assert(text.includes('Australian viewing unconfirmed'),'degraded state visible');
  if(rendered.marker){assert.equal(mode,'feed');assert.equal(await card.getByRole('button',{name:'Open in Events',exact:true}).count(),1,'Published multi-day Feed marker retains its genuine Events handoff');assert.equal(await card.locator('.provider-access').count(),0,'A calendar marker cannot invent a direct viewing action');}
  for(const caption of await card.locator('.provider-access').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,width:n.clientWidth,scroll:n.scrollWidth,height:n.clientHeight}))))assert(caption.width>0&&caption.height>0&&caption.scroll<=caption.width+1,'Provider cost caption is readable without clipping: '+caption.text);
  if(fixture.id==='event:aflw:cd_m20262641601'){
   assert.deepEqual(expected.map(o=>o.id),['seven','kayo','foxtel'],'The women’s final has its own confirmed options, free first');
   assert.equal(links[0].href,'https://7plus.com.au/aflw');assert(expected.every(o=>o.rightsScope==='fixture'&&!o.replayVerified));
   assert.deepEqual(expected.map(o=>o.accessType),['free','subscription','subscription'],'The existing provider metadata distinguishes free and paid access');
   assert.deepEqual(await card.locator('.provider-access').allTextContents(),['Free','Subscription','Subscription'],'Actual mixed-provider card clearly labels each free or paid destination');
   if(process.env.QA_SCREENSHOT_DIR&&mode==='feed'&&!show&&width===390)await card.screenshot({path:require('node:path').join(process.env.QA_SCREENSHOT_DIR,'aflw-access-'+(process.env.QA_BROWSER||'chromium')+'.png')});
   if(mode==='schedule'){assert.match(text,/27\s+Nov/i);assert.match(text,/Time TBC/i);assert.match(text,/Winner of PF1/);assert.match(text,/Winner of PF2/);}
  }
  if(fixture.id==='fixture:rugby:wr:e492d961-1f1e-4c37-b9d7-e9fd811459be'){
   assert.deepEqual(expected.map(o=>o.id),['youtube','stan'],'final free coverage appears before paid coverage');
   assert.equal(links[0].href,'https://www.youtube.com/@rugbycomau');
   assert(/Scotch College/i.test(text),`reviewed host venue is visible in ${mode}: ${text}`);
  }
  if(fixture.id==='rugby-australia-south-africa-2026-09-27')assert(show?/42\s*[–-]\s*38/.test(text):!/42\s*[–-]\s*38/.test(text),'Results privacy survives viewing change');
  if(['fixture:golf:lpga:2026068','fixture:golf:lpga:2026070'].includes(fixture.id)){
   assert.deepEqual(expected.map(o=>o.id),['kayo','foxtel']);assert(expected.every(o=>o.rightsScope==='competition'&&!o.replayVerified),'LPGA only claims reviewed competition carriage');
   if(!rendered.marker)assert(text.includes('Subscription'),'paid provider state is visible');
  }
  if(fixture.competitionId==='competition:nhl'){
   assert.deepEqual(expected.map(o=>o.id),fixture.roundLabel==='Regular season'?['disney']:[],'regular season only');
   assert(expected.every(o=>o.url==='https://www.disneyplus.com/en-au/welcome/espn-sports'&&o.rightsScope==='competition'&&!o.replayVerified));
   if(expected.length)assert(text.includes('Subscription'),`NHL paid-access label is visible (${fixture.id}/${mode}): ${text}`);
   if(fixture.id==='fixture:nhl:2026020001')assert(show?/1\s*[–-]\s*0/.test(text):!/1\s*[–-]\s*0/.test(text),'NHL zero final obeys Results privacy');
  }
  if(fixture.id==='fixture:golf:lpga:2026063'){
   assert.equal(fixture.fixtureResults.rows.length,144);assert(show&&!rendered.marker?text.includes(fixture.scoreDisplay):!text.includes('Winner: Yuna')&&!text.includes('won Walmart'),'retained LPGA classification obeys Results privacy; markers do not expose a final score');
   assert(!/multiple live stages/i.test(text),'completed tournament is not labelled live');
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${fixture.id}/${mode}/${width}: mobile layout`);
  observations.push({id:fixture.id,mode,show,width,providers:expected.map(o=>o.id),shownProviders:presented.map(o=>o.id),feedCalendarMarker:rendered.marker,overflow});
 }
 if(aflwOnly){
  await page.locator('#startupLaunch').waitFor({state:'hidden'});
  await page.evaluate(fixture=>openCodeInspector('sport:aflw',{focusFixture:fixture}),fixtures[0]);
  const ordinary=page.locator('[data-inspector-fixture-id="event:aflw:cd_m20262641601"]');
  await ordinary.waitFor({state:'visible'});assert.equal(await ordinary.locator('.fixture-providers a').count(),3,'Ordinary focused AFLW Schedule keeps all three supported actions');
  await page.context().route('https://7plus.com.au/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Isolated AFLW destination handoff</title>'}));
  const popupPromise=page.waitForEvent('popup');await ordinary.locator('.fixture-providers a').first().click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),'https://7plus.com.au/aflw');await popup.close();
  const report={checkedAt:new Date().toISOString(),browser:process.env.QA_BROWSER||'chromium',cases:observations.length,ordinaryAflwSchedule:true,isolated7plusClick:true,observations,scope:'Actual AFLW Code projection and native Feed/Schedule rendering, plus ordinary focused Schedule and isolated popup handoff. APIs isolated and workers blocked. Not actual playback, authenticated acceptance or physical device proof.'};
  if(process.env.QA_REPORT_FILE)fs.writeFileSync(process.env.QA_REPORT_FILE,JSON.stringify(report,null,2)+'\n');console.log(`${report.browser}: ${report.cases} AFLW viewing cases and ordinary Schedule handoff passed.`);return;
 }
 await page.evaluate(()=>openCodeInspector('sport:cricket',{startingTab:'all-fixtures'}));await page.locator('.code-inspector-group').first().waitFor();
 const id='fixture:cricket:espn:1525659';
 for(let n=0;n<25&&await page.locator(`[data-event-id="${id}"]`).count()===0;n++){const later=page.getByRole('button',{name:'Later rounds / events',exact:true});if(!await later.count())break;await later.click();}
 const ordinary=page.locator(`[data-event-id="${id}"]`);await ordinary.waitFor({state:'attached'});assert.equal(await ordinary.locator('.fixture-providers a').count(),2,'ordinary Cricket Schedule presents both broadcasters');
 const lpgaId='fixture:golf:lpga:2026068';
 await page.evaluate(fixture=>openCodeInspector('sport:golf',{focusFixture:fixture}),fixtures.find(f=>f.id===lpgaId));
 for(let n=0;n<25&&await page.locator(`[data-inspector-fixture-id="${lpgaId}"]`).count()===0;n++){const direction=Date.parse(fixtures.find(f=>f.id===lpgaId).date+'T00:00:00Z')<Date.now()?'Earlier rounds / events':'Later rounds / events';const more=page.getByRole('button',{name:direction,exact:true});if(!await more.count())break;await more.click();}
 const ordinaryGolf=page.locator(`[data-inspector-fixture-id="${lpgaId}"]`);await ordinaryGolf.waitFor({state:'attached'});assert.equal(await ordinaryGolf.locator('.fixture-providers a').count(),2,'ordinary Golf Schedule presents both reviewed LPGA broadcasters');
 const nhlId='fixture:nhl:2026020035';
 await page.evaluate(fixture=>openCodeInspector('sport:ice-hockey',{focusFixture:fixture}),fixtures.find(f=>f.id===nhlId));await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:ice-hockey');
 const ordinaryNhl=page.locator(`[data-inspector-fixture-id="${nhlId}"]`);
 for(let n=0;n<25&&await ordinaryNhl.count()===0;n++){const more=page.getByRole('button',{name:'Later rounds / events',exact:true});if(!await more.count())break;await more.click();}
 await ordinaryNhl.waitFor({state:'attached'});assert.equal(await ordinaryNhl.locator('.fixture-providers a').count(),1,'ordinary NHL Schedule has reviewed Disney action');assert((await ordinaryNhl.innerText()).includes('Subscription'));
 // Real user click into an isolated provider popup proves the destination handoff,
 // without subscriber login, a production write or a claim of video playback.
 const destination=page.context();await destination.route('https://www.disneyplus.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Isolated provider destination handoff</title>'}));
 await ordinaryNhl.scrollIntoViewIfNeeded();const popupPromise=page.waitForEvent('popup');await ordinaryNhl.locator('.fixture-providers a').click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),'https://www.disneyplus.com/en-au/welcome/espn-sports');await popup.close();
 const report={checkedAt:new Date().toISOString(),browser:process.env.QA_BROWSER||'chromium',cases:observations.length,ordinaryCricketSchedule:true,focusedGolfSchedule:true,focusedNhlSchedule:true,isolatedDisneyClick:true,observations,scope:'Actual source projections, supported Feed cards and calendar markers, opened Schedule rendering, current focused Golf/NHL schedule links and isolated Disney handoff; APIs isolated and workers blocked. Public destinations only, no authenticated playback or physical device proof.'};
 if(process.env.QA_REPORT_FILE)fs.writeFileSync(process.env.QA_REPORT_FILE,JSON.stringify(report,null,2)+'\n');console.log(`${report.browser}: ${report.cases} viewing cases, four widths, Results privacy and ordinary Cricket/Golf Schedule passed.`);
 }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
})().catch(error=>{console.error(error);process.exitCode=1;});
