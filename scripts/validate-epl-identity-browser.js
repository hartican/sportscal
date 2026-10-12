'use strict';
// Actual app and Feed handler; frozen retained source, unavailable account APIs.
// This is a browser rehearsal, never a provider check or physical-phone claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),Module=require('node:module');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const sample=require('./fixtures/epl-provider-identity-20261013.json').fixtures.find(x=>x.primary.id==='epl-2026-27-129031');
const filename=path.join(root,'api/feed.js'),unit=new Module(filename,module);unit.filename=filename;unit.paths=Module._nodeModulePaths(path.dirname(filename));unit._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.auditDependencies=feedDependencies;',filename);
const base=unit.exports.auditDependencies(),at='2026-10-12T18:24:20.229Z';
const handler=unit.exports.createFeedHandler({clock:()=>new Date(at),load:()=>({...base,readLiveSnapshots:async()=>({sources:[{source_id:'controlled-retained-calendar',fixtures:require('../data/football/fixtures/premier-league.json').events}],revision:'epl-browser-rehearsal',readAt:Date.parse(at),stale:false})})});
const preferences={version:26,onboardingComplete:true,showSpoilers:false,followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]},fantasyDeadlines:{enabled:false},followFirst:{notifications:{userChoice:false,enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}};
(async()=>{
 const calls=[],errors=[],observations=[];
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/api/feed'&&url.searchParams.get('scope')==='athletes'){
   try{let raw='';for await(const chunk of req)raw+=chunk;const response={setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return this;},json(body){calls.push(body);res.setHeader('content-type','application/json');res.end(JSON.stringify(body));return this;},send(body){calls.push(JSON.parse(body));res.setHeader('content-type','application/json');res.end(body);return this;}};await handler({url:req.url,method:req.method,headers:{},body:JSON.parse(raw||'{}')},response);}catch(e){errors.push(e.message);res.writeHead(500);res.end('{}');}return;
  }
  if(url.pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}
  const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'content-type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/html'});res.end(e?'':b);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await pw[process.env.QA_BROWSER||'chromium'].launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(p=>localStorage.setItem('ns_preferences_v1',JSON.stringify(p)),preferences);
  await page.goto(`http://127.0.0.1:${server.address().port}/#follow/profile/team%3Afootball%3Aepl%3A1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
  await page.locator('.participant-profile-header').getByRole('heading',{name:'Arsenal',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.participant-calendar-row').length===39);
  const returned=calls.flatMap(x=>x.events||[]),league=returned.filter(e=>e.competitionId==='competition:premier-league-2026-27');
  assert.equal(league.length,32);assert.equal(new Set(league.map(e=>e.participantIds.join('|'))).size,32);
  for(const event of league){const original=require('../data/events.json').events.find(e=>e.id===event.id);assert(original);for(const k of ['startTimeUtc','sourceCheckedAt','timePrecision'])assert.equal(event[k],original[k]);}
  const originalChoices=await page.evaluate(()=>({follows:JSON.stringify(userPreferences.preferenceGraph.entityFollows),spoilers:userPreferences.showSpoilers,actions:JSON.stringify(eventActions),notifications:JSON.stringify(userPreferences.followFirst.notifications)}));
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);observations.push({width,rows:await page.locator('.participant-calendar-row').count(),overflow:false});}
  await page.getByRole('button',{name:'Open match',exact:true}).first().click();await page.locator('[data-athlete-match-back]').waitFor();await page.getByRole('button',{name:'Back to athlete',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.participant-calendar-row').length===39);
  assert.deepEqual(await page.evaluate(()=>({follows:JSON.stringify(userPreferences.preferenceGraph.entityFollows),spoilers:userPreferences.showSpoilers,actions:JSON.stringify(eventActions),notifications:JSON.stringify(userPreferences.followFirst.notifications)})),originalChoices);
  const rating=await page.evaluate(({fixture,old})=>{ratings={[old]:5,unrelated:8};userPreferences.showSpoilers=false;const before=getActual(fixture),stars=actualStarValue(fixture);setEventRating(fixture,6,{revealSpoilers:false});const changed=getActual(fixture),legacy=ratings[old],unrelated=ratings.unrelated,spoilers=userPreferences.showSpoilers;setEventRating(fixture,null,{revealSpoilers:false});return {before,stars,changed,legacy,unrelated,spoilers,removed:getActual(fixture)};},{fixture:returned.find(e=>e.id===sample.primary.id),old:sample.secondary.canonicalEventId});
  assert.equal(rating.before,5);assert.equal(rating.stars,2.5);assert.equal(rating.changed,6);assert.equal(rating.legacy,undefined);assert.equal(rating.unrelated,8);assert.equal(rating.spoilers,false);assert.equal(rating.removed,null);assert.deepEqual(errors,[]);
  const result={at:new Date().toISOString(),browser:process.env.QA_BROWSER||'chromium',actualHandler:true,profileRows:39,uniqueLeagueGames:32,originalClocks:true,openAndBack:true,preferencesPreserved:true,legacyRatingAndRemoval:true,observations,limits:['retained source replay; account APIs unavailable; worker blocked','upgrade, hosted production and physical phone are separate checks']};
  if(process.env.QA_REPORT_FILE)fs.writeFileSync(process.env.QA_REPORT_FILE,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
