'use strict';
// Actual profile renderer and shared attribution, controlled existing source
// documents only. No provider request, account or guest write.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const published=require('../data/code-inspector/football.json');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('function buildEuropeanDetail('),end=html.indexOf('function buildFixtureResultAvailability(',start);
assert(start>=0&&end>start);const attribution=html.slice(start,end);
const scenarios=['backup-epl','backup-ucl','primary-epl','primary-ucl','backup-ucl-default-note','backup-epl-helper-failed','empty-table'];
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{
  const route=new URL(req.url,'http://local').pathname;
  if(route==='/profile-source-test.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><button id="origin">Open profile</button></body></html>');return;}
  fs.readFile(path.join(root,route),(error,bytes)=>{res.writeHead(error?404:200,{'content-type':route.endsWith('.js')?'application/javascript':'application/json'});res.end(error?'':bytes);});
 });
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,observations=[];
 try{for(const engine of process.env.BROWSER_ENGINE?[process.env.BROWSER_ENGINE]:['chromium','webkit']){
  const browser=await pw[engine].launch(engine==='chromium'?{channel:'chrome'}:{});
  try{for(const width of [320,1280])for(const scenario of scenarios){
   console.log('Source context case',engine,width,scenario);
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[],requests=[];
   page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push({method:request.method(),url:new URL(request.url()).pathname}));
   await page.route('**/api/**',route=>route.fulfill({status:503,json:{}}));
   if(scenario.endsWith('helper-failed'))await page.route('**/assets/js/football-card-context.js?*',route=>route.abort());
   if(process.env.QA_BASE_URL)await page.route('**/profile-source-test.html',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><button id="origin">Open profile</button></body></html>'}));
   await page.goto(base+'/profile-source-test.html');
   const competitionId=scenario.includes('ucl')?'competition:uefa-champions-league':'competition:premier-league-2026-27';
   const fixture=structuredClone(published.fixtures.find(f=>f.competitionId===competitionId&&f.status==='completed'));
   assert(fixture,'Existing completed fixture supplies the controlled renderer case');
   const delayed=scenario.startsWith('backup-'),rows=scenario==='empty-table'?[]:structuredClone(published.standings.filter(row=>row.competitionId===competitionId));
   if(delayed){
    fixture.scoreDisplay='Controlled final 0–2';fixture.delayedResultSource={provider:'Football-Data.org',attribution:'Football data provided by the Football-Data.org API',sourceUrl:'https://www.football-data.org/',updatedAt:'2026-10-01T12:00:00.000Z'};
    fixture.sourceAttribution ||= {provider:'Football-Data.org'};
    // Exercise a flagged non-first row too: the caveat belongs to the table.
    rows.at(-1).stale=true;if(!scenario.endsWith('default-note'))rows.at(-1).staleNote='Table awaits primary-source confirmation of delayed backup results.';
   }
   await page.evaluate(({fixture,rows})=>{
    window.userPreferences={showSpoilers:false};window.NOTHINGSPORTS_ATHLETE_PARTICIPATION={athletes:[]};
    window.spoilerSafeDisplayTitle=f=>f.displayName||f.name||'Controlled fixture';
    window.codeIdForEvent=()=> 'sport:football';window.loadCodeInspectorManifest=async()=>({codes:[{id:'sport:football',slug:'football',chunkPath:'/unneeded.json'}]});
    window.availableCodeInspectorChunk=()=>({schemaVersion:'code-inspector-chunk.v1',code:{id:'sport:football'},standings:rows});
    window.loadDeferredScript=url=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.onload=resolve;script.onerror=reject;document.head.append(script);});
    window.__sourceFixture=fixture;
   },{fixture,rows});
   await page.addScriptTag({url:base+'/config/feed-card-presentation.js'});
   await page.addScriptTag({content:attribution});
   const modulePath=process.env.QA_BASE_URL?html.match(/loadDeferredScript\(["'](config\/athlete-profile-ui\.js\?v=\d+)["']\)/)[1]:'config/athlete-profile-ui.js';
   await page.addScriptTag({url:base+'/'+modulePath});
   await page.evaluate(()=>{window.__open=NOTHINGSPORTS_ATHLETE_PROFILE_UI.open({id:__sourceFixture.participantIds[0],displayName:'Controlled club',profileOnly:true},'football',document.getElementById('origin'),{fixture:__sourceFixture});});
   const drawer=page.locator('.athlete-profile-drawer'),result=drawer.locator('section').filter({has:page.getByRole('heading',{name:/^Fixture results ·/})}),table=drawer.locator('section').filter({has:page.getByRole('heading',{name:'Ladder / standings',exact:true})});
   assert.equal(await drawer.locator('.profile-context-table').count(),0);
   assert.equal(await drawer.getByRole('link',{name:'Football data provided by the Football-Data.org API',exact:true}).count(),0,'Results-off does not reveal a delayed-final cue');
   assert.equal(await drawer.getByText(/Table awaits primary-source confirmation/).count(),0,'Table caveat stays under the same local Results reveal');
   await table.getByRole('button',{name:'Show profile standings',exact:true}).focus();await page.keyboard.press('Enter');
   await page.waitForFunction(()=>!document.querySelector('[role="status"]').textContent.startsWith('Loading'));
   assert(await table.getByRole('heading').evaluate(node=>node===document.activeElement));
   assert.equal(await table.locator('tr').count(),rows.length?rows.length+1:0);
   if(delayed)assert.equal(await table.getByText(scenario.endsWith('default-note')?'Table awaits primary-source confirmation.':'Table awaits primary-source confirmation of delayed backup results.',{exact:true}).count(),1,'Profile must preserve the Schedule stale-table caveat');
   else assert.equal(await table.getByText(/Table awaits primary-source confirmation/).count(),0,'Fresh/empty tables acquire no stale cue');
   if(rows.length&&competitionId.includes('uefa')){await table.getByRole('link',{name:'ODbL',exact:true}).waitFor();assert.equal(await table.getByRole('link',{name:'Dataset',exact:true}).getAttribute('href'),'/data/providers/openligadb/football-2026-27.json');}
   const resultReveal=result.getByRole('button',{name:'Show fixture results',exact:true});
   assert.equal(await resultReveal.count(),1,'Fixture result reveal is still present after standings: '+JSON.stringify(await drawer.locator('h3,button').allTextContents()));
   await resultReveal.focus();await page.keyboard.press('Enter');
   assert(await result.getByRole('heading').evaluate(node=>node===document.activeElement));
   if(delayed){
    await result.getByRole('link',{name:'Football data provided by the Football-Data.org API',exact:true}).waitFor();
    assert.match(await result.innerText(),/Delayed final result; primary source unavailable at recovery\./);
    assert.match(await result.innerText(),/Controlled final 0–2/);
   }else assert.equal(await result.getByRole('link',{name:'Football data provided by the Football-Data.org API',exact:true}).count(),0,'Primary results cannot gain backup provenance');
   if(competitionId.includes('uefa')){await result.getByRole('link',{name:'ODbL',exact:true}).waitFor();assert.equal(await result.getByRole('link',{name:'OpenLigaDB',exact:true}).getAttribute('href'),'https://www.openligadb.de/');}
   assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false);
   assert(!requests.some(r=>r.method!=='GET'),'No mutation is issued');assert(!requests.some(r=>r.url==='/unneeded.json'),'Existing table remains reused');assert.deepEqual(errors,[]);
   observations.push({engine,width,scenario,passed:true,scope:'Controlled source documents, actual profile renderer/shared attribution. No real backup observation or authenticated/physical-device proof.'});await page.close();
  }}finally{await browser.close();}
 }}finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
 if(process.env.PROFILE_SOURCE_CAPTURE)fs.writeFileSync(process.env.PROFILE_SOURCE_CAPTURE,JSON.stringify({checkedAt:new Date().toISOString(),cases:observations.length,observations},null,2)+'\n');
 console.log('Profile source context: '+observations.length+' stale/fresh/empty, primary/delayed, zero-score, Results/focus and failed-helper cases passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
