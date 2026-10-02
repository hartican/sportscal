'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});try{
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}});await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:24,onboardingComplete:true,selectedSelectorEntityIds:['sport:tennis'],followedSports:['tennis'],showSpoilers:true,fantasyDeadlines:{enabled:false}})));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences==='object'&&!startupCoordinator.isHydrating());
 const result=await page.evaluate(async()=>{
  await loadDeferredScript('config/match-centre.js?v=356');await loadDeferredScript('config/feed-live-scores.js?v=374');activeTab='feed';userPreferences.showSpoilers=true;userPreferences.fantasyDeadlines.enabled=false;
  const date=new Date().toISOString(),event={id:'qa:feed-score',key:'tennis',name:'First v Second',date:date.slice(0,10),time:'20:00',startTimeUtc:date,status:'live',scoreCheckedAt:date,sets:[{home:6,away:4}],games:{home:2,away:1}};
  setCardState(event,'compact');const host=document.createElement('div');host.append(buildEventCard(event));document.body.append(host);
  const compact=host.querySelector('.event-card').dataset.cardState==='compact'&&host.querySelector('.feed-live-score').textContent.includes('6–4');
  userPreferences.showSpoilers=false;host.replaceChildren(buildEventCard(event));const hidden=!host.querySelector('.feed-live-score')&&!host.innerHTML.includes('6–4');
  userPreferences.showSpoilers=true;setCardState(event,'opened');host.replaceChildren(buildEventCard(event));const expanded=Boolean(host.querySelector('.feed-live-score'));
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(host.querySelector('.event-card'),{...event,sets:[{home:7,away:5}]},{resultsOn:true});const updated=host.querySelector('.feed-live-score').textContent.includes('7–5')&&host.querySelectorAll('.feed-live-score').length===1;
  host.className='feed-card-slot';host.dataset.feedEventId=event.id;feedCardSlots.set(event.id,{event,slot:host,mounted:true});activeEvents.push(event);
  const oldFetch=window.fetch;let requestUrl='';window.fetch=async url=>{if(String(url).startsWith('/api/fixtures?')){requestUrl=String(url);return new Response(JSON.stringify({schemaVersion:'live-fixtures.v1',revision:'qa-score-refresh',sources:[{checked_at:new Date().toISOString(),fixtures:[{...event,sets:[{home:7,away:6}]}]}]}),{status:200});}return oldFetch(url);};
  liveFixtureRefresh=null;liveFixtureLastRequestedAt=0;await refreshLiveFixtureSnapshot();
  const sportingRequest=Boolean(requestUrl)&&!requestUrl.includes('fantasy=1');const snapshotUpdated=host.querySelector('.feed-live-score')?.textContent.includes('7–6')===true;
  window.fetch=oldFetch;feedCardSlots.delete(event.id);host.remove();return {compact,hidden,expanded,updated,sportingRequest,snapshotUpdated,fantasyOff:!userPreferences.fantasyDeadlines.enabled};
 });for(const [key,value] of Object.entries(result))assert.equal(value,true,key);console.log(JSON.stringify({engine,...result}));
 }finally{await browser.close();}}}finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
