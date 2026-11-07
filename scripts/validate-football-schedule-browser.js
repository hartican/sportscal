'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const inspector=process.env.POSITION_REHEARSAL_FILE?JSON.parse(require('node:fs').readFileSync(process.env.POSITION_REHEARSAL_FILE,'utf8')):require('../data/code-inspector/football.json');
if(process.env.POSITION_PENDING_REHEARSAL==='1')for(const entry of inspector.standings){if(entry.competitionId==='competition:uefa-champions-league'){entry.rank=null;entry.rankPending=true;entry.sharedRank=false;}}
(async()=>{
 const engine=process.env.QA_BROWSER||'chromium';assert(['chromium','webkit'].includes(engine));
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{
  const file=path.join(__dirname,'..',new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));
  fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});
 });
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await pw[engine].launch(engine==='chromium'?{channel:'chrome'}:{});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const localOrigin=process.env.QA_BASE_URL?new URL(process.env.QA_BASE_URL).origin:`http://127.0.0.1:${server.address().port}`;
  await page.route('**/*',r=>new URL(r.request().url()).origin===localOrigin&&!new URL(r.request().url()).pathname.startsWith('/api/')?r.continue():r.fulfill({status:503,json:{}}));
  if(process.env.POSITION_PENDING_REHEARSAL==='1'||process.env.POSITION_REHEARSAL_FILE)await page.route('**/data/code-inspector/football.json',r=>r.fulfill({json:inspector}));
  // Seed an existing local profile before startup; otherwise the scheduled
  // first-run wizard can reopen after the test starts clicking schedule tabs.
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:football'],showSpoilers:false,onboardingComplete:true})));
  await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>typeof saveFollowBrowse==='function'&&typeof FOLLOW_FIRST!=='undefined');
  await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
  await page.evaluate(()=>{
   userPreferences=FOLLOW_FIRST.migratePreferences({selectedSelectorEntityIds:['sport:football'],showSpoilers:false,onboardingComplete:true});
   activeTab='follow';followHomeView='browse';saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'schedule',scheduleScope:null});renderAll();
  });
  await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:football'&&!codeInspectorChunkLoading);
  try{await page.locator('.code-inspector-group').first().waitFor({timeout:10000});}catch(e){console.log(await page.evaluate(()=>({tab:activeTab,code:activeInspectorCodeId,text:document.getElementById('listView').innerText,loading:startupCoordinator.isHydrating})));throw e;}
  assert.equal(await page.locator('.code-inspector-group').count(),1);assert.equal(await page.locator('.code-inspector-group[data-current-round=true]').count(),1,'All Football selects the next source-backed round');
  const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([key])=>key!=='followBrowse'))));
  if(await page.getByRole('button',{name:'Expand Follow navigation',exact:true}).count())await page.getByRole('button',{name:'Expand Follow navigation',exact:true}).click();await page.locator('.follow-section-tabs').getByRole('button',{name:'Standings',exact:true}).click();
  assert.match(await page.locator('.follow-schedule-panel').innerText(),/Standings hidden/);
  assert.equal(await page.locator('.code-inspector-standing-row').count(),0);
  await page.getByRole('button',{name:'Reveal standings',exact:true}).click();
  await page.locator('#confirmStandingsRevealBtn').click();
  await page.locator('.code-inspector-standing-row').first().waitFor();
  assert.equal(inspector.standings.filter(row=>row.competitionId!=='competition:australian-championship').length,92);
  assert.equal(inspector.standings.filter(row=>row.competitionId==='competition:australian-championship').length,16);
  assert.equal(await page.locator('.code-inspector-standing-row').count(),108);
  const expectedPositions=inspector.standings.map(e=>`${e.rankPending?'Pending ·':`${e.sharedRank?'Joint ':''}${e.rank}.`} ${e.displayName}`).sort();
  const displayedPositions=await page.locator('.code-inspector-standing-row strong').allTextContents();
  assert.deepEqual(displayedPositions.sort(),expectedPositions,'Schedule preserves every shared/pending position beside its sourced team');
  const expectedNotes=[...[...new Map(inspector.standings.filter(e=>e.competitionId!=='competition:australian-championship').map(e=>[e.competitionId,e.tableNote])).values()],...['A','B','C','D'].map(group=>inspector.standings.find(e=>e.competitionId==='competition:australian-championship'&&e.groupId===group)?.tableNote)].filter(Boolean);
  assert.deepEqual((await page.locator('.standings-source-note').allTextContents()).sort(),expectedNotes.sort(),'all source explanations remain visible, including shared/pending EPL rules');
  assert((await page.locator('.standings-source-note').allTextContents()).some(note=>/Provisional.*community/.test(note)));
  await page.locator('.code-inspector-standing-row').first().scrollIntoViewIfNeeded();
  assert.match(await page.locator('.code-inspector-standing-row').first().innerText(),/played.*wins.*draws.*pts/);
  assert.match(await page.locator('.follow-schedule-panel').innerText(),/Table checked/);
  for(const width of [320,390,768,1280])for(const theme of ['day','night']){
   await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${theme}: no page overflow`);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([key])=>key!=='followBrowse')))),before,'viewing schedules and revealing table must not mutate follows or Results');
  for(const date of ['2026-09-25','2026-09-29'])for(const mode of ['schedule','feed']){
   await page.evaluate(({date,mode})=>{
    const fixture=codeInspectorChunk.fixtures.find(f=>f.id===`football-australia-brazil-${date}`);
    if(fixture?.status!=='completed')throw Error('Expected retained completed friendly '+date);
    activeTab=mode==='feed'?'feed':'follow';
    const host=document.getElementById('listView');host.replaceChildren(mode==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard(canonicalFeedFixtureForInspector(fixture)||fixture));
   },{date,mode});
   const free=page.locator('#listView a.provider-link[aria-label*="10 Streaming"]');
   assert.equal(await free.count(),0,`${date} ${mode}: finished live-only coverage is not an available replay`);
   assert.equal(await page.locator('#listView a.provider-link').count(),0,`${date} ${mode}: no unverified replay action`);
  }
  // Replay the real published pre-result packet at its historical clock. This
  // retains positive free-TV coverage without treating a final as a live match.
  const historic=require('./fixtures/football-viewing-before-results-20260924.json');
  assert.equal(historic.sourceSha,'daf5052decc98be6420ad49688f3104487fd5ee0');
  assert.deepEqual(historic.fixtures.map(f=>f.status),['upcoming','upcoming']);
  const present=Date.now();await page.clock.setFixedTime(new Date('2026-09-24T12:00:00Z'));
  await page.evaluate(fixtures=>{const previous=EVENTS.slice();EVENTS.splice(0,EVENTS.length,...fixtures);window.__qaFootballPresentEvents=previous;},historic.fixtures);
  try{for(const date of ['2026-09-25','2026-09-29'])for(const mode of ['schedule','feed']){
   await page.evaluate(({date,mode,fixtures})=>{const fixture=fixtures.find(f=>f.id===`football-australia-brazil-${date}`);activeTab=mode==='feed'?'feed':'follow';document.getElementById('listView').replaceChildren(mode==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard(canonicalFeedFixtureForInspector(fixture)||fixture));},{date,mode,fixtures:historic.fixtures});
   const free=page.locator('#listView a.provider-link[aria-label*="10 Streaming"]');
   assert.equal(await free.count(),date==='2026-09-25'?1:0,`${date} ${mode}: historical fixture-specific free option`);
   const paid=page.locator('#listView a.provider-link[aria-label*="Paramount"]');assert.equal(await paid.count(),1,`${date} ${mode}: historical confirmed Paramount option`);await paid.scrollIntoViewIfNeeded();assert(await paid.isVisible());assert.equal(await paid.getAttribute('href'),'https://www.paramountplus.com/au/');
   if(date==='2026-09-25'){await free.scrollIntoViewIfNeeded();assert(await free.isVisible());assert.equal(await free.getAttribute('href'),'https://10.com.au/');}
  }}finally{await page.evaluate(()=>{EVENTS.splice(0,EVENTS.length,...window.__qaFootballPresentEvents);delete window.__qaFootballPresentEvents;});await page.clock.setFixedTime(new Date(present));}
  for(const [competitionId,slug] of [['competition:premier-league-2026-27','premier-league'],['competition:uefa-champions-league','uefa-champions-league'],['competition:uefa-europa-league','uefa-europa-league']])for(const mode of ['schedule','feed']){
   await page.evaluate(({mode,competitionId})=>{
    const fixture=codeInspectorChunk.fixtures.find(f=>f.competitionId===competitionId&&f.status==='completed');
    activeTab=mode==='feed'?'feed':'follow';
    document.getElementById('listView').replaceChildren(mode==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard(fixture));
   },{mode,competitionId});
   assert.equal(await page.locator('#listView a.provider-link').count(),0,`${mode}: unconfirmed replay is omitted`);
   assert.equal(await page.locator('#listView .fixture-providers').count(),0,'No empty provider row');
  }
  console.log(engine+' Football browser: matchweek navigation, Results-off protection, dated 20-club EPL and two 36-club European tables, four widths, unchanged preferences, completed replay protection and historical fixture-specific Feed/Schedule free viewing passed.');
 }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
})().catch(e=>{console.error(e);process.exitCode=1;});
