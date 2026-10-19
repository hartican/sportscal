#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.CHAMPIONSHIP_PREVIEW_ROOT||path.join(__dirname,'..')),competitionId='competition:australian-championship';
const clubs=require('../data/canonical/football-directory.v1.json').teams.filter(t=>t.leagueId===competitionId);
async function leagueOnlyLifecycle(browser,{width,theme,base,source}){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),requests={normalFollowSchedule:0,legacyLeagueBundle:0};
 page.setDefaultTimeout(12000);page.on('request',r=>{const p=new URL(r.url()).pathname;if(p==='/data/follow-schedule/football.json')requests.normalFollowSchedule++;if(p==='/data/football/fixtures/australian-championship.json')requests.legacyLeagueBundle++;});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(theme=>{if(!localStorage.getItem('ns_preferences_v1'))localStorage.setItem('ns_preferences_v1',JSON.stringify({version:24,selectedSelectorEntityIds:[],followedSports:[],preferenceGraph:{domainPreferences:[],competitionPreferences:[],entityFollows:[]},showSpoilers:false,onboardingComplete:true,theme}));},theme);
 const ready=async()=>{await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());await page.locator('#startupLaunch').waitFor({state:'hidden'});};
 const browse=async()=>{await page.locator('.tabs [data-tab=follow]').click();await page.evaluate(()=>{acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});setTunePromptOpen(false);suppressSessionRatingPrompt();followHomeView='browse';saveFollowBrowse({sportId:'sport:football',categoryId:'sport:football',section:'schedule',scheduleScope:null});renderAll();});await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:football'&&!codeInspectorChunkLoading);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{scrollTo(0,0);requestAnimationFrame(resolve);})));const expand=page.getByRole('button',{name:'Expand Sports menu',exact:true});if(await expand.count())await expand.click();};
 try{
  await page.goto(base);await ready();await browse();
  assert.equal(await page.evaluate(()=>userPreferences.selectedSelectorEntityIds.includes('sport:football')||userPreferences.followedSports.includes('football')),false);assert.equal(await page.evaluate(()=>userPreferences.preferenceGraph.entityFollows.length),0);
  const checkbox=page.getByRole('checkbox',{name:'Follow Australian Championship',exact:true});assert.equal(await checkbox.isChecked(),false);await checkbox.check();
  await page.waitForFunction(id=>activeEvents.some(e=>e.competitionId===id)&&getFilteredEvents().some(e=>e.competitionId===id),competitionId);
  const beforeCold=requests.normalFollowSchedule;await page.reload();await ready();
  await page.waitForFunction(id=>activeEvents.some(e=>e.competitionId===id)&&getFilteredEvents().some(e=>e.competitionId===id),competitionId);
  assert.equal(await page.evaluate(()=>userPreferences.selectedSelectorEntityIds.includes('sport:football')||userPreferences.followedSports.includes('football')),false,'league-only cold reload adds no parent follow');
  assert(requests.normalFollowSchedule-beforeCold<=1,'normal loader coalesces cold startup');assert.equal(requests.legacyLeagueBundle,0,'no legacy duplicate fetch path');
  await page.locator('.tabs [data-tab=feed]').click();const slot=page.locator('[data-feed-event-id*="australian-championship"]').first();await slot.waitFor();await slot.scrollIntoViewIfNeeded();await slot.locator('.event-card').waitFor();
  await browse();assert.equal(await checkbox.isChecked(),true);await checkbox.uncheck();assert.equal(await page.evaluate(fixtures=>fixtures.filter(f=>automaticEventFollowReason(f)).length,source),0);
  await page.reload();await ready();assert.equal(await page.evaluate(id=>userPreferences.preferenceGraph.competitionPreferences.find(p=>p.competitionId===id)?.enabled,competitionId),false);assert.equal(await page.evaluate(fixtures=>fixtures.filter(f=>automaticEventFollowReason(f)).length,source),0);
  return requests;
 }catch(error){console.error(JSON.stringify({stage:'league-only',width,theme,state:await page.evaluate(()=>({selected:userPreferences.selectedSelectorEntityIds,graph:userPreferences.preferenceGraph,active:activeEvents.filter(e=>e.competitionId==='competition:australian-championship').length,text:document.getElementById('listView')?.innerText.slice(0,900)}))}));throw error;}finally{await context.close();}
}
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(e?'':b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const rows=[];
 try{for(const engine of (process.env.CHAMPIONSHIP_SMOKE?['chromium']:['chromium','webkit'])){
  const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of (process.env.CHAMPIONSHIP_SMOKE?[320]:[320,390,768,1280]))for(const theme of (process.env.CHAMPIONSHIP_SMOKE?['day']:['day','night'])){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();
   const requests={normalFollowSchedule:0,legacyLeagueBundle:0};page.on('request',r=>{const p=new URL(r.url()).pathname;if(p==='/data/follow-schedule/football.json')requests.normalFollowSchedule++;if(p==='/data/football/fixtures/australian-championship.json')requests.legacyLeagueBundle++;});
   page.setDefaultTimeout(12000);await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
   await page.addInitScript(theme=>{if(!localStorage.getItem('ns_preferences_v1'))localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:football'],showSpoilers:false,onboardingComplete:true,theme}));},theme);
   try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>typeof saveFollowBrowse==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
    await page.locator('#startupLaunch').waitFor({state:'hidden'});
    await page.evaluate(()=>{acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});setTunePromptOpen(false);suppressSessionRatingPrompt();});
    await page.locator('.tabs [data-tab=follow]').click();
    await page.getByRole('button',{name:'My athletes & teams',exact:true}).waitFor();
    await page.locator('.follow-home-tabs').getByRole('button',{name:'Sports',exact:true}).click();
    const search=page.getByRole('searchbox',{name:'Search all teams and athletes',exact:true});await search.waitFor();
    for(const club of clubs){await search.fill(club.displayName);await page.locator('.global-search-result').filter({has:page.locator(`[data-profile-trigger="search:${club.id}"]`)}).waitFor();}
    await search.fill('');
    const before=await page.evaluate(()=>JSON.stringify(userPreferences.preferenceGraph));
    await page.evaluate(()=>{followHomeView='browse';saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'teams-players',scheduleScope:null});renderAll();});
    await page.getByRole('combobox',{name:'League',exact:true}).waitFor();const teams=page.locator('.follow-directory-tabs').getByRole('button',{name:'Teams',exact:true});if(await teams.getAttribute('aria-pressed')!=='true')await teams.click();
    await page.getByRole('combobox',{name:'League',exact:true}).selectOption(competitionId);await page.waitForFunction(()=>document.querySelectorAll('.football-club-row').length===16);
    assert.equal(await page.locator('.football-club-row span.football-club-crest').count(),16);assert.equal(await page.locator('.football-club-row img.football-club-crest').count(),0);
    for(let i=0;i<2;i++){const row=page.locator('.football-club-row').first();await row.scrollIntoViewIfNeeded();await row.locator('.football-club-expand').click();await row.scrollIntoViewIfNeeded();assert.match(await row.textContent(),/Player directory unavailable/);await row.locator('.football-club-expand').click();}
    if(process.env.CHAMPIONSHIP_QA_DIR&&width===320)await page.screenshot({path:path.join(process.env.CHAMPIONSHIP_QA_DIR,`${engine}-${theme}-clubs.png`)});
    await page.evaluate(()=>{followHomeView='browse';saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'schedule',scheduleScope:null});renderAll();});
    await page.getByRole('button',{name:'Schedule',exact:true}).click();
    await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:football'&&!codeInspectorChunkLoading);
    const competition=page.getByRole('combobox',{name:'Competition',exact:true});assert.equal(await competition.locator(`option[value="${competitionId}"]`).innerText(),'Australian Championship');await competition.selectOption(competitionId);
    const source=await page.evaluate(id=>codeInspectorChunk.fixtures.filter(e=>e.competitionId===id),competitionId);assert.equal(source.length,48);assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences.preferenceGraph)),before,'browsing never follows');
    await page.getByRole('button',{name:'Standings',exact:true}).click();
    assert.equal(await page.getByRole('table',{name:/Australian Championship/}).count(),0);await page.getByRole('button',{name:'Reveal standings',exact:true}).click();await page.getByRole('button',{name:'Reveal once',exact:true}).click();
    const tables=page.getByRole('table',{name:/Australian Championship · Group/});await tables.first().waitFor();assert.equal(await tables.count(),4);for(const table of await tables.all())assert.equal(await table.getByRole('row').count(),4);
    assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false,'table consent does not change global Results');
    const sydney=tables.filter({hasText:'Sydney United 58'});await sydney.scrollIntoViewIfNeeded();assert.match(await sydney.innerText(),/2 pts/);
    const sutherland=tables.getByRole('row').filter({hasText:'Sutherland Sharks'});assert.match(await sutherland.textContent(),/1 played · 0 wins · 0 draws · 0 losses/,'published WDL conflict stays visible as supplied');
    if(process.env.CHAMPIONSHIP_QA_DIR&&width===320)await page.screenshot({path:path.join(process.env.CHAMPIONSHIP_QA_DIR,`${engine}-${theme}-groups.png`)});
    const shootout=source.find(f=>f.sourceWinnerId===0&&f.shootout?.home===5&&f.shootout?.away===6);assert(shootout);
    for(const shown of [false,true])for(const surface of ['schedule','feed']){
     await page.evaluate(({fixture,shown,surface})=>{setGlobalSpoilerPreference(shown);const host=document.createElement('section');host.id='championship-component-proof';host.append(surface==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard(fixture));document.getElementById('listView').replaceChildren(host);},{fixture:shootout,shown,surface});
     const host=page.locator('#championship-component-proof');await host.scrollIntoViewIfNeeded();const text=await host.textContent();if(shown){assert.match(text,/0[–-]0/);assert.match(text,/Penalties 5[–-]6/);}else assert(!/Penalties 5[–-]6/.test(text),'Results OFF hides shootout');assert.equal(await host.locator('a.provider-link').count(),0,'unverified broadcaster metadata creates no viewing claim');
    }
    await page.evaluate(()=>setGlobalSpoilerPreference(false));
    const expand=async()=>{const button=page.getByRole('button',{name:'Expand Sports menu',exact:true});if(await button.count())await button.click();};
    await expand();const leagueFollow=page.getByRole('checkbox',{name:'Follow Australian Championship',exact:true});assert.equal(await leagueFollow.isChecked(),false,'broad Football starts with league opt-in off');
    assert.equal(await page.evaluate(fixtures=>fixtures.filter(f=>automaticEventFollowReason(f)).length,source),0,'broad Football never admits Championship');
    const peerPreferences=await page.evaluate(id=>({domains:userPreferences.preferenceGraph.domainPreferences,entities:userPreferences.preferenceGraph.entityFollows,competitions:userPreferences.preferenceGraph.competitionPreferences.filter(p=>p.competitionId!==id)}),competitionId);
    await page.evaluate(()=>{globalThis.__champRebuilds=0;const original=requestFeedRebuildAfterFollowChange;requestFeedRebuildAfterFollowChange=(...args)=>{globalThis.__champRebuilds++;return original(...args);};});
    await leagueFollow.check();
    await page.waitForFunction(id=>userPreferences.preferenceGraph.competitionPreferences.some(p=>p.competitionId===id&&p.enabled===true),competitionId);
    assert.equal(await page.evaluate(()=>globalThis.__champRebuilds),1,'one existing rebuild owner per explicit change');
    assert.equal(await page.evaluate(fixtures=>fixtures.filter(f=>automaticEventFollowReason(f)).length,source),48);
    assert.deepEqual(await page.evaluate(id=>({domains:userPreferences.preferenceGraph.domainPreferences,entities:userPreferences.preferenceGraph.entityFollows,competitions:userPreferences.preferenceGraph.competitionPreferences.filter(p=>p.competitionId!==id)}),competitionId),peerPreferences,'league action preserves other preferences');
    await page.waitForFunction(id=>activeEvents.some(e=>e.competitionId===id)&&getFilteredEvents().some(e=>e.competitionId===id),competitionId);
    await page.locator('.tabs [data-tab=feed]').click();
    const slot=page.locator('[data-feed-event-id*="australian-championship"]').first();await slot.waitFor();await slot.scrollIntoViewIfNeeded();await slot.locator('.event-card').waitFor();
    await page.locator('.tabs [data-tab=follow]').click();await expand();await leagueFollow.uncheck();
    assert.equal(await page.evaluate(fixtures=>fixtures.filter(f=>automaticEventFollowReason(f)).length,source),0,'explicit OFF excludes league');assert.equal(await page.evaluate(()=>globalThis.__champRebuilds),2);
    await page.reload();await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());await page.locator('#startupLaunch').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(id=>userPreferences.preferenceGraph.competitionPreferences.find(p=>p.competitionId===id)?.enabled,competitionId),false,'explicit OFF survives local profile reload');
    assert.equal(await page.evaluate(fixtures=>fixtures.filter(f=>automaticEventFollowReason(f)).length,source),0);
    const leagueOnlyRequests=await leagueOnlyLifecycle(browser,{width,theme,base:`http://127.0.0.1:${server.address().port}`,source});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const result={engine,width,theme,searchableClubs:16,publishedFixtures:48,accessibleGroupTables:4,browsingDoesNotFollow:true,standingsConsent:true,mountedLeagueOptIn:true,defaultOff:true,localFeedReadback:true,offSurvivesReload:true,leagueOnlyColdReload:true,requests,leagueOnlyRequests};rows.push(result);console.log(JSON.stringify(result));
   }catch(error){console.error(JSON.stringify({engine,width,theme,state:await page.evaluate(()=>({text:document.getElementById('listView')?.innerText.slice(0,2000),browse:typeof followBrowseState==='function'?followBrowseState():null}))}));throw error;}finally{await context.close();}
  }}finally{await browser.close();}
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
 if(process.env.CHAMPIONSHIP_QA_DIR)fs.writeFileSync(path.join(process.env.CHAMPIONSHIP_QA_DIR,'browser-results.json'),JSON.stringify({previewRoot:root,outputOnlyProposedRootPatch:!!process.env.CHAMPIONSHIP_PREVIEW_ROOT,rows},null,2)+'\n');
 console.log(JSON.stringify({passed:rows.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
