#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),snapshot=require('../data/football/fixtures/a-league-men.json');
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(e?'':b);});});
 if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const rows=[];
 try{for(const engine of ['chromium','webkit']){
  const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of [320,1280])for(const theme of ['day','night']){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();
   await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
   await page.addInitScript(theme=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:football'],showSpoilers:false,onboardingComplete:true,theme})),theme);
   await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`);
   await page.waitForFunction(()=>typeof saveFollowBrowse==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
   await page.evaluate(()=>{activeTab='follow';followHomeView='browse';saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'schedule',scheduleScope:null});renderAll();});
   try{await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:football'&&!codeInspectorChunkLoading);}catch(error){console.error(JSON.stringify({engine,width,theme,stage:'schedule-load',state:await page.evaluate(()=>({browse:followBrowseState(),tab:activeTab,activeCode:activeInspectorCodeId,manifest:!!codeInspectorManifest,loading:codeInspectorChunkLoading,chunk:codeInspectorChunk?.code,text:document.getElementById('listView').innerText.slice(0,1800)}))}));throw error;}
   const competition=page.getByRole('combobox',{name:'Competition',exact:true});
   assert.equal(await competition.locator('option[value="competition:a-leagues"]').innerText(),'A-League Men');
   await competition.selectOption('competition:a-leagues');
   try{await page.waitForFunction(()=>[...document.querySelectorAll('.code-inspector-group')].some(e=>/A-League Men/.test(e.textContent)));}catch(error){console.error(JSON.stringify({engine,width,theme,state:await page.evaluate(()=>({filter:NOTHINGSPORTS_FOLLOW_NAV.selected('sport:football'),text:document.getElementById('listView').innerText.slice(-2500),chunk:codeInspectorChunk?.fixtures.filter(e=>e.competitionId==='competition:a-leagues').length}))}));throw error;}
   const source=await page.evaluate(()=>codeInspectorChunk.fixtures.filter(e=>e.competitionId==='competition:a-leagues'));assert.equal(source.length,156);
   const opener=source.find(e=>e.canonicalEventId==='event:football:a-league-men:401892162');assert(opener);assert.equal(opener.venue,'Allianz Stadium');
   const first=source.find(e=>!['completed','finished','final'].includes(e.status)&&e.viewingOptions?.some(o=>o.providerId==='ten-tv'));assert(first,'official upcoming TV listing exists');
   const current=await page.locator('#listView').innerText();assert(current.includes('Sydney FC')&&current.includes('Western Sydney Wanderers'));assert(!current.includes('competition:a-leagues'));
   if(process.env.A_LEAGUE_QA_DIR&&width===320)await page.screenshot({path:path.join(process.env.A_LEAGUE_QA_DIR,`${engine}-${theme}-schedule.png`),fullPage:false});
   const before=await page.evaluate(()=>JSON.stringify(userPreferences.preferenceGraph));
   await page.evaluate(()=>{NOTHINGSPORTS_FOLLOW_NAV.setFilter('sport:football','competition',[]);renderFollowView();});
   assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences.preferenceGraph)),before,'browsing a league must not create follows');
   // Exercise the native card builders on both surfaces and repeat expansion.
   for(const mode of ['schedule','feed'])for(let i=0;i<2;i++){
    await page.evaluate(({fixture,mode})=>{activeTab=mode==='feed'?'feed':'follow';document.getElementById('listView').replaceChildren(mode==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard(fixture));},{fixture:first,mode});
    const provider=page.locator('#listView a.provider-link[aria-label*="Paramount"]');assert.equal(await provider.count(),1);assert.match(await provider.getAttribute('href'),/paramountplus/);
    const tv=page.locator('#listView a.provider-link[aria-label*="Network 10"]');assert.equal(await tv.count(),1);assert.match(await tv.getAttribute('href'),/where-to-watch/);
   }
   const followed=await page.evaluate(id=>{setDirectoryEntityFollow(id,'follow',{sportKey:'football',leagueId:'competition:a-leagues',label:'Sydney FC'});return userPreferences.preferenceGraph.entityFollows.some(f=>f.participantId===id&&f.followLevel==='follow');},snapshot.events[0].homeParticipantId);assert(followed);
   await page.reload();await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());assert(await page.evaluate(id=>userPreferences.preferenceGraph.entityFollows.some(f=>f.participantId===id&&f.followLevel==='follow'),snapshot.events[0].homeParticipantId),'A-League club follow survives local profile reload');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   console.log('passed',engine,width,theme);rows.push({engine,width,theme,schedule:156,competitionLabel:true,providers:true,followSurvivesReload:true});
   if(process.env.A_LEAGUE_QA_DIR&&width===320)await page.screenshot({path:path.join(process.env.A_LEAGUE_QA_DIR,`${engine}-${theme}.png`)});
   await context.close();
  }}finally{await browser.close();}
 }}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
 if(process.env.A_LEAGUE_QA_DIR)fs.writeFileSync(path.join(process.env.A_LEAGUE_QA_DIR,'browser-results.json'),JSON.stringify(rows,null,2)+'\n');
 console.log(JSON.stringify({passed:rows.length,cases:rows}));
})().catch(e=>{console.error(e);process.exitCode=1;});
