'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/html'});res.end(e?'':b);});});
 if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await(process.env.QA_BROWSER==='webkit'?webkit:chromium).launch(),observations=[];
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['rugby','cricket','golf'],showSpoilers:false,preferenceGraph:{entityFollows:[{participantId:'team:rugby:wallabies',followLevel:'follow'},{participantId:'team:cricket:australia',followLevel:'follow'}]}})));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof buildCodeInspectorFixture==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const fixtures=await page.evaluate(async()=>{
  const load=async code=>(await(await fetch(`/data/code-inspector/${code}.json`)).json()).fixtures;
  const rugby=await load('rugby-union'),cricket=await load('cricket'),golf=await load('golf');
  return [rugby.find(f=>f.id==='rugby-australia-south-africa-2026-09-27'),rugby.find(f=>f.id==='rugby-new-zealand-australia-2026-10-10'),rugby.find(f=>f.id.includes('e492d961')),rugby.find(f=>f.competitionName==='Top 14 2027'),...['1525659','1525660','1525661','1525658'].map(id=>cricket.find(f=>f.id==='fixture:cricket:espn:'+id)),...['fixture:golf:lpga:2026068','fixture:golf:lpga:2026070','fixture:golf:lpga:2026063','fixture:golf:lpga:2026076','fixture:golf:pga:H2026166'].map(id=>golf.find(f=>f.id===id))];
 });assert(fixtures.every(Boolean));
 for(const mode of ['feed','schedule'])for(const show of [false,true])for(const width of [320,390,768,1280])for(const fixture of fixtures){
  await page.setViewportSize({width,height:844});
  const expected=await page.evaluate(({fixture,mode,show})=>{
   activeTab=mode==='feed'?'feed':'follow';activeInspectorCodeId=null;userPreferences.showSpoilers=show;userPreferences.feedCompact=false;
   const f={...fixture,eventId:fixture.id};setCardState(f,'opened');const card=mode==='feed'?buildEventCard(f):buildCodeInspectorFixture(fixture);card.style.contentVisibility='visible';document.getElementById('listView').replaceChildren(card);scrollTo(0,0);
   return FOLLOW_FIRST.viewingOptions(f).map(o=>({id:o.providerId,url:o.url,label:o.label,replay:o.liveOrReplay==='replay',rightsScope:o.rightsScope,replayVerified:o.replayVerified}));
  },{fixture,mode,show});
  const card=page.locator('#listView .event-card');await card.scrollIntoViewIfNeeded();
  const links=await card.locator('.fixture-providers a').evaluateAll(links=>links.map(a=>({href:a.getAttribute('href'),label:a.getAttribute('aria-label')})));
  assert.equal(links.length,expected.length,`${fixture.id}/${mode}: actual visible provider actions`);
  for(let i=0;i<links.length;i++){assert.equal(links[i].href,expected[i].url);assert.equal(links[i].label,`${expected[i].replay?'Check replay availability':'Watch'} on ${expected[i].label}`);}
  const text=await card.innerText();if(!expected.length)assert(text.includes('Australian viewing unconfirmed'),'degraded state visible');
  if(fixture.id==='fixture:rugby:wr:e492d961-1f1e-4c37-b9d7-e9fd811459be'){
   assert.deepEqual(expected.map(o=>o.id),['youtube','stan'],'final free coverage appears before paid coverage');
   assert.equal(links[0].href,'https://www.youtube.com/@rugbycomau');
   assert(/Scotch College/i.test(text),`reviewed host venue is visible in ${mode}: ${text}`);
  }
  if(fixture.id==='rugby-australia-south-africa-2026-09-27')assert(show?/42\s*[–-]\s*38/.test(text):!/42\s*[–-]\s*38/.test(text),'Results privacy survives viewing change');
  if(['fixture:golf:lpga:2026068','fixture:golf:lpga:2026070'].includes(fixture.id)){
   assert.deepEqual(expected.map(o=>o.id),['kayo','foxtel']);assert(expected.every(o=>o.rightsScope==='competition'&&!o.replayVerified),'LPGA only claims reviewed competition carriage');
   assert(text.includes('Subscription'),'paid provider state is visible');
  }
  if(fixture.id==='fixture:golf:lpga:2026063'){
   assert.equal(fixture.fixtureResults.rows.length,144);assert(show?text.includes(fixture.scoreDisplay):!text.includes('Winner: Yuna')&&!text.includes('won Walmart'),'retained LPGA classification obeys Results privacy');
   assert(!/multiple live stages/i.test(text),'completed tournament is not labelled live');
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${fixture.id}/${mode}/${width}: mobile layout`);
  observations.push({id:fixture.id,mode,show,width,providers:expected.map(o=>o.id),overflow});
 }
 await page.evaluate(()=>openCodeInspector('sport:cricket',{startingTab:'all-fixtures'}));await page.locator('.code-inspector-group').first().waitFor();
 const id='fixture:cricket:espn:1525659';
 for(let n=0;n<25&&await page.locator(`[data-event-id="${id}"]`).count()===0;n++){const later=page.getByRole('button',{name:'Later rounds / events',exact:true});if(!await later.count())break;await later.click();}
 const ordinary=page.locator(`[data-event-id="${id}"]`);await ordinary.waitFor({state:'attached'});assert.equal(await ordinary.locator('.fixture-providers a').count(),2,'ordinary Cricket Schedule presents both broadcasters');
 await page.evaluate(()=>{saveFollowBrowse({sportId:'sport:golf-women',categoryId:'sport:golf-women',section:'schedule',scheduleScope:null});return openCodeInspector('sport:golf',{startingTab:'all-fixtures'});});await page.locator('.code-inspector-group').first().waitFor();
 const lpgaId='fixture:golf:lpga:2026068';
 for(let n=0;n<25&&await page.locator(`[data-inspector-fixture-id="${lpgaId}"]`).count()===0;n++){const later=page.getByRole('button',{name:'Later rounds / events',exact:true});if(!await later.count())break;await later.click();}
 const ordinaryGolf=page.locator(`[data-inspector-fixture-id="${lpgaId}"]`);await ordinaryGolf.waitFor({state:'attached'});assert.equal(await ordinaryGolf.locator('.fixture-providers a').count(),2,'ordinary Golf Schedule presents both reviewed LPGA broadcasters');
 const report={checkedAt:new Date().toISOString(),browser:process.env.QA_BROWSER||'chromium',cases:observations.length,ordinaryCricketSchedule:true,ordinaryGolfSchedule:true,observations,scope:'Actual source projections and opened Feed/Schedule rendering; APIs isolated and workers blocked. Public destinations only, no authenticated playback or physical device proof.'};
 if(process.env.QA_REPORT_FILE)fs.writeFileSync(process.env.QA_REPORT_FILE,JSON.stringify(report,null,2)+'\n');console.log(`${report.browser}: ${report.cases} viewing cases, four widths, Results privacy and ordinary Cricket/Golf Schedule passed.`);
 }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
})().catch(error=>{console.error(error);process.exitCode=1;});
