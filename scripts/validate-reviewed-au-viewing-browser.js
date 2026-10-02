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
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['rugby','cricket'],showSpoilers:false,preferenceGraph:{entityFollows:[{participantId:'team:rugby:wallabies',followLevel:'follow'},{participantId:'team:cricket:australia',followLevel:'follow'}]}})));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof buildCodeInspectorFixture==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const fixtures=await page.evaluate(async()=>{
  const load=async code=>(await(await fetch(`/data/code-inspector/${code}.json`)).json()).fixtures;
  const rugby=await load('rugby-union'),cricket=await load('cricket');
  return [rugby.find(f=>f.id==='rugby-australia-south-africa-2026-09-27'),rugby.find(f=>f.id==='rugby-new-zealand-australia-2026-10-10'),rugby.find(f=>f.id.includes('e492d961')),rugby.find(f=>f.competitionName==='Top 14 2027'),...['1525659','1525660','1525661','1525658'].map(id=>cricket.find(f=>f.id==='fixture:cricket:espn:'+id))];
 });assert(fixtures.every(Boolean));
 for(const mode of ['feed','schedule'])for(const show of [false,true])for(const width of [320,390,768,1280])for(const fixture of fixtures){
  await page.setViewportSize({width,height:844});
  const expected=await page.evaluate(({fixture,mode,show})=>{
   activeTab=mode==='feed'?'feed':'follow';activeInspectorCodeId=null;userPreferences.showSpoilers=show;userPreferences.feedCompact=false;
   const f={...fixture,eventId:fixture.id};setCardState(f,'opened');const card=mode==='feed'?buildEventCard(f):buildCodeInspectorFixture(fixture);card.style.contentVisibility='visible';document.getElementById('listView').replaceChildren(card);scrollTo(0,0);
   return FOLLOW_FIRST.viewingOptions(f).map(o=>({id:o.providerId,url:o.url,label:o.label,replay:o.liveOrReplay==='replay'}));
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
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${fixture.id}/${mode}/${width}: mobile layout`);
  observations.push({id:fixture.id,mode,show,width,providers:expected.map(o=>o.id),overflow});
 }
 await page.evaluate(()=>openCodeInspector('sport:cricket',{startingTab:'all-fixtures'}));await page.locator('.code-inspector-group').first().waitFor();
 const id='fixture:cricket:espn:1525659';
 for(let n=0;n<25&&await page.locator(`[data-event-id="${id}"]`).count()===0;n++){const later=page.getByRole('button',{name:'Later rounds / events',exact:true});if(!await later.count())break;await later.click();}
 const ordinary=page.locator(`[data-event-id="${id}"]`);await ordinary.waitFor({state:'attached'});assert.equal(await ordinary.locator('.fixture-providers a').count(),2,'ordinary Cricket Schedule presents both broadcasters');
 const report={checkedAt:new Date().toISOString(),browser:process.env.QA_BROWSER||'chromium',cases:observations.length,ordinaryCricketSchedule:true,observations,scope:'Actual source projections and opened Feed/Schedule rendering; APIs isolated and workers blocked. Public destinations only, no authenticated playback or physical device proof.'};
 if(process.env.QA_REPORT_FILE)fs.writeFileSync(process.env.QA_REPORT_FILE,JSON.stringify(report,null,2)+'\n');console.log(`${report.browser}: ${report.cases} viewing cases, four widths, Results privacy and ordinary Cricket Schedule passed.`);
 }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
})().catch(error=>{console.error(error);process.exitCode=1;});
