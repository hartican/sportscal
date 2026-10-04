#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const stages=require('../data/canonical/uefa-champions-league-2026-27.json').phases.find(p=>p.phaseId==='knockout').fixtures;
const expected=stages.map(f=>f.id),observations=[],out=process.env.UCL_CALENDAR_QA_OUTPUT;
const selector='.code-inspector-fixtures [data-inspector-fixture-id^="major-stage:uefa-champions-league-"]';
function localServer(){
 return http.createServer((req,res)=>{
  const target=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));
  if(!target.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
  fs.readFile(target,(error,bytes)=>{
   res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(target)]||'text/html'});
   res.end(error?'':bytes);
  });
 });
}
async function openCalendar(page,base){
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:football'],showSpoilers:false,version:26})));
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>typeof saveFollowBrowse==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating()&&startupFunnelFinished,null,{timeout:30000});
 await page.evaluate(()=>openCodeInspector('sport:football',{pushHistory:false}));
 await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:football'&&!codeInspectorChunkLoading,null,{timeout:15000});
 await page.locator('.follow-category-bar').getByRole('button',{name:/Champions League/}).click();
 await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='competition:uefa-champions-league'&&!codeInspectorChunkLoading,null,{timeout:15000});
 await page.locator('.code-inspector-group').first().waitFor();
 for(let i=0;i<10&&await page.locator(selector).count()<5;i++){
  const later=page.getByRole('button',{name:'Later rounds / events',exact:true});
  if(!await later.count())break;
  await later.click();
 }
 assert.equal(await page.locator(selector).count(),5,'all existing stages remain reachable through actual Schedule navigation');
}
async function verifyCalendar(page,name){
 const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([k])=>k!=='followBrowse'))));
 for(const width of[320,390,768,1280])for(const theme of['day','night'])for(const state of['compact','opened']){
  await page.setViewportSize({width,height:844});
  await page.evaluate(({theme,state,ids})=>{
   applyThemePreference(theme);
   for(const id of ids)setCardState(codeInspectorChunk.fixtures.find(f=>f.id===id),state);
   renderCodeInspector();
  },{theme,state,ids:expected});
  await page.waitForFunction(()=>document.querySelectorAll('.code-inspector-fixtures [data-inspector-fixture-id^="major-stage:uefa-champions-league-"]').length===5);
  const rows=await page.locator(selector).evaluateAll(cards=>cards.map(c=>({
   id:c.dataset.inspectorFixtureId,text:c.innerText,state:c.dataset.cardState,
   pins:c.querySelectorAll('.code-inspector-feed-action').length,
   invalidTiming:c.querySelectorAll('.event-timing-state.live-now,.event-timing-state.starts-soon,.event-timing-state.just-finished').length,
   card:c.getBoundingClientRect().width,dateChip:c.querySelector('.event-date-chip')?.getBoundingClientRect().width,
  })));
  assert.deepEqual(rows.map(r=>r.id),expected,'actual Schedule orders the stage windows chronologically');
  for(const [i,row]of rows.entries()){
   assert(row.text.toLocaleLowerCase('en-AU').includes(stages[i].displayDateLabel.toLocaleLowerCase('en-AU')),`${name}/${width}/${state}: missing ${stages[i].displayDateLabel}`);
   assert.equal(row.pins,0,'calendar-only records do not gain Add to Feed through invented match dates');
   assert.equal(row.invalidTiming,0);
   if(state==='opened')assert(row.dateChip<=row.card+1,'calendar label fits the actual card');
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  observations.push({engine:name,width,theme,state,ids:rows.map(r=>r.id),labels:stages.map(f=>f.displayDateLabel),calendarOnly:true,actualScheduleNavigation:true});
 }
 assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([k])=>k!=='followBrowse')))),before,'calendar browsing changes no follows, Results or account settings');
 await page.evaluate(async()=>{saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'schedule'});await openCodeInspector('competition:uefa-champions-league',{pushHistory:false});});
 await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='competition:uefa-champions-league'&&!codeInspectorChunkLoading);
 assert.equal(await page.evaluate(()=>followBrowseState().categoryId),'sport:champions-league','direct Schedule links retain the correct child selector');
}
(async()=>{
 const server=process.env.QA_BASE_URL?null:localServer();
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
   const browser=await engine.launch({headless:true});
   try{
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await openCalendar(page,process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`);
    await verifyCalendar(page,name);
    assert.deepEqual(errors,[]);
    await page.close();
   }finally{await browser.close();}
  }
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
 if(out){
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({checkedAt:new Date().toISOString(),cases:observations.length,observations,scope:'Real published programme records through actual Schedule navigation; API reads fail closed. No fixture injection, account write or physical device.'},null,2)+'\n');
 }
 console.log('UCL calendar browser: '+observations.length+' Chromium/WebKit width/theme/card-state cases, all five dates, chronological Schedule, unknown kickoffs, no new pins and unchanged preferences passed.');
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
