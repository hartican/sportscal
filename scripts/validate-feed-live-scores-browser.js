'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});try{
 for(const width of [390,1280]){
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width,height:844},locale:'en-AU',timezoneId:'Australia/Sydney'});await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:24,onboardingComplete:true,selectedSelectorEntityIds:['sport:tennis'],followedSports:['tennis'],showSpoilers:true,fantasyDeadlines:{enabled:false}})));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences==='object'&&!startupCoordinator.isHydrating()&&startupFeedState.phase==='ready'&&!remoteFeedRefreshInFlight&&followedScheduleLoads.size===0);await page.locator('#startupLaunch').waitFor({state:'hidden'});
 const result=await page.evaluate(async capturedCricket=>{
  await loadDeferredScript('config/match-centre.js?v=435');await loadDeferredScript('config/feed-live-scores.js?v=437');await ensureFeedScoreUi();activeTab='feed';userPreferences.showSpoilers=true;userPreferences.fantasyDeadlines.enabled=false;
  const savedQueue=queueLiveFixtureSnapshot;queueLiveFixtureSnapshot=()=>{};if(liveFixtureRefresh)await liveFixtureRefresh;
  const date=new Date().toISOString(),event={id:'qa:feed-score',key:'tennis',name:'First v Second',date:date.slice(0,10),time:'20:00',startTimeUtc:date,status:'live',scoreCheckedAt:date,sets:[{home:6,away:4}],games:{home:2,away:1}};
  setCardState(event,'compact');const host=document.createElement('div');host.append(buildEventCard(event));document.body.append(host);
  const compact=host.querySelector('.event-card').dataset.cardState==='compact'&&host.querySelector('.event-card').classList.contains('is-minimised-row')&&!host.querySelector('.feed-live-score');
  setCardState(event,'selected');host.replaceChildren(buildEventCard(event));const normal=host.querySelector('.feed-live-score')?.textContent.includes('6–4')===true;
  userPreferences.showSpoilers=false;host.replaceChildren(buildEventCard(event));const hidden=!host.querySelector('.feed-live-score')&&!host.innerHTML.includes('6–4');
  userPreferences.showSpoilers=true;setCardState(event,'opened');host.replaceChildren(buildEventCard(event));const expanded=Boolean(host.querySelector('.feed-live-score'));
  const previousSpoilers=eventSpoilerState,previousPolicy=userPreferences.feedControls.spoilers;
  eventSpoilerState={[eventActionKey(event)]:{override:'hide'}};host.replaceChildren(buildEventCard(event));const localHide=!host.querySelector('.feed-live-score');
  eventSpoilerState={[eventActionKey(event)]:{override:'show'}};userPreferences.showSpoilers=false;host.replaceChildren(buildEventCard(event));const localShow=Boolean(host.querySelector('.feed-live-score'));
  userPreferences.feedControls.spoilers='strict';host.replaceChildren(buildEventCard(event));const strictHide=!host.querySelector('.feed-live-score');
  eventSpoilerState=previousSpoilers;userPreferences.feedControls.spoilers=previousPolicy;userPreferences.showSpoilers=true;host.replaceChildren(buildEventCard(event));
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(host.querySelector('.event-card'),{...event,sets:[{home:7,away:5}]},{resultsOn:true});const updated=host.querySelector('.feed-live-score').textContent.includes('7–5')&&host.querySelectorAll('.feed-live-score').length===1;
  host.className='feed-card-slot';host.dataset.feedEventId=event.id;feedCardSlots.set(event.id,{event,slot:host,mounted:true});activeEvents.push(event);
  const oldFetch=window.fetch;let requestUrl='';window.fetch=async url=>{if(String(url).startsWith('/api/fixtures?')){requestUrl=String(url);return new Response(JSON.stringify({schemaVersion:'live-fixtures.v1',revision:'qa-score-refresh',sources:[{checked_at:new Date().toISOString(),fixtures:[{...event,sets:[{home:7,away:6}]}]}]}),{status:200});}return oldFetch(url);};
  liveFixtureRefresh=null;liveFixtureLastRequestedAt=0;await refreshLiveFixtureSnapshot();
  const sportingRequest=Boolean(requestUrl)&&!requestUrl.includes('fantasy=1');const snapshotUpdated=host.querySelector('.feed-live-score')?.textContent.includes('7–6')===true;
  window.fetch=oldFetch;
  const marker='fixture-observations.v1',stamp=new Date().toISOString();
  const prior={id:'qa:corrected-score',key:'nrl',status:'completed',homeScore:1,awayScore:0,sourceCheckedAt:new Date(Date.now()-60000).toISOString()};
  const corrected=NOTHINGSPORTS_FIXTURE_IDENTITY.mergeOverlays([prior],[{...prior,homeScore:2,fixtureObservationSchema:marker,scoreCheckedAt:stamp,statusCheckedAt:stamp,scoreFactObservedAt:stamp}])[0];
  const scoreHost=document.createElement('div');scoreHost.className='event-card';document.body.append(scoreHost);
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,corrected,{resultsOn:true});const finalCorrection=scoreHost.textContent.includes('Home 2')&&scoreHost.textContent.includes('Away 0')&&scoreHost.textContent.includes('Finished');
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,corrected,{resultsOn:false});const correctedSpoilerSafe=!scoreHost.querySelector('.feed-live-score');
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,{...corrected,status:'live',scoreCheckedAt:null,statusCheckedAt:stamp},{resultsOn:true});const unknownDegraded=scoreHost.textContent.includes('Last available score')&&scoreHost.textContent.includes('Awaiting source update')&&!scoreHost.textContent.includes('Live');
  const football=await(await fetch('/data/code-inspector/football.json')).json();
  let settledFinals=true,settledPrivacy=true,pilotCompacts=true;
  for(const competitionId of ['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league']){
   const finals=football.fixtures.filter(f=>f.competitionId===competitionId&&f.status==='completed');settledFinals&&=finals.length>0;
   for(const fixture of finals){const before=JSON.stringify(fixture),year=new Date(fixture.scoreCheckedAt).getFullYear();NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,fixture,{resultsOn:true});settledFinals&&=scoreHost.textContent.includes('Finished')&&scoreHost.textContent.includes('Update needed')===Boolean(fixture.stale)&&scoreHost.querySelector('time')?.dateTime===fixture.scoreCheckedAt&&scoreHost.textContent.includes(String(year))&&/\b(AEDT|AEST)\b/.test(scoreHost.textContent)&&JSON.stringify(fixture)===before;NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,fixture,{resultsOn:false});settledPrivacy&&=!scoreHost.querySelector('.feed-live-score');}
   setCardState(finals[0],'selected');host.replaceChildren(buildEventCard(finals[0]));
   const normalScore=host.querySelector('.card-result-score,.feed-live-score strong'),sourceScore=NOTHINGSPORTS_MATCH_CENTRE.compact(finals[0]).score;
   const normalPilot={id:finals[0].id,classes:host.querySelector('.event-card')?.className,text:normalScore?.textContent,sourceHome:sourceScore.home,sourceAway:sourceScore.away};
   const numbers=normalPilot.text?.match(/\d+/g)||[];if(!normalScore||![sourceScore.home,sourceScore.away].every(value=>numbers.includes(String(value))))throw Error('Normal sourced result regression: '+JSON.stringify(normalPilot));
   if(host.querySelector('.feed-live-score')){if(!host.querySelector('.feed-live-score time')||host.textContent.includes('Update needed')!==Boolean(finals[0].stale))throw Error('Shared final source provenance regression: '+JSON.stringify(normalPilot));}
   pilotCompacts&&=Boolean(normalScore);

   setCardState(finals[0],'compact');host.replaceChildren(buildEventCard(finals[0]));const rowPilot={id:finals[0].id,classes:host.querySelector('.event-card')?.className,minimised:Boolean(host.querySelector('.is-minimised-row')),score:Boolean(host.querySelector('.feed-live-score'))};if(!rowPilot.minimised||rowPilot.score)throw Error('Minimised pilot regression: '+JSON.stringify(rowPilot));pilotCompacts&&=rowPilot.minimised&&!rowPilot.score;
  }
  const oldFinal={...corrected,scoreCheckedAt:'2025-12-31T13:05:00.000Z'};
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,oldFinal,{resultsOn:true});const crossYear=scoreHost.textContent.includes('1 Jan 2026')&&scoreHost.textContent.includes('12:05 am AEDT')&&scoreHost.querySelector('time')?.dateTime===oldFinal.scoreCheckedAt&&!scoreHost.textContent.includes('Update needed');
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,{...oldFinal,stale:true},{resultsOn:true});const explicitFailure=scoreHost.textContent.includes('Update needed');
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,{...corrected,status:'live',scoreCheckedAt:new Date(Date.now()+86400000).toISOString()},{resultsOn:true});const futureDateHidden=!scoreHost.querySelector('time')&&scoreHost.textContent.includes('Awaiting source update');
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(scoreHost,{...corrected,scoreCheckedAt:null},{resultsOn:true});const missingFinalDate=scoreHost.textContent.includes('Source date unavailable')&&!scoreHost.textContent.includes('Update needed');
  const cricketBefore=JSON.stringify(capturedCricket);userPreferences.showSpoilers=true;userPreferences.feedControls.spoilers='results_visible';
  setCardState(capturedCricket,'opened');host.replaceChildren(buildEventCard(capturedCricket));
  const cricketCard=host.querySelector('.event-card'),cricketLine=cricketCard.querySelector('.card-result-line');
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(cricketCard,capturedCricket,{resultsOn:true});
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(cricketCard,capturedCricket,{resultsOn:true});
  const cricketOutcomeRetained=Boolean(cricketLine)&&cricketCard.querySelector('.card-result-line')===cricketLine&&cricketCard.innerText.includes(capturedCricket.outcomeText)&&NOTHINGSPORTS_FEED_LIVE_SCORES.presentation(capturedCricket,{resultsOn:true})===null;
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(cricketCard,capturedCricket,{resultsOn:false});
  const cricketOutcomeHidden=!cricketCard.innerText.includes(capturedCricket.outcomeText)&&!cricketCard.querySelector('.card-result-line,.feed-live-score');
  const cricketEvidenceUnchanged=JSON.stringify(capturedCricket)===cricketBefore;
  scoreHost.remove();feedCardSlots.delete(event.id);host.remove();queueLiveFixtureSnapshot=savedQueue;return {compact,normal,hidden,expanded,localHide,localShow,strictHide,updated,sportingRequest,snapshotUpdated,fantasyOff:!userPreferences.fantasyDeadlines.enabled,finalCorrection,correctedSpoilerSafe,unknownDegraded,settledFinals,settledPrivacy,pilotCompacts,crossYear,explicitFailure,futureDateHidden,missingFinalDate,cricketOutcomeRetained,cricketOutcomeHidden,cricketEvidenceUnchanged};
 },require('./fixtures/cricket-result-fallback-20261016.json').fixture);if(Object.values(result).some(value=>value!==true))console.log(JSON.stringify({engine,width,...result}));for(const [key,value] of Object.entries(result))assert.equal(value,true,key);console.log(JSON.stringify({engine,width,...result}));
 const reviewed=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json').events.filter(e=>e.status==='completed');
 const realResults=await page.evaluate(fixtures=>{
  const saved=JSON.stringify(userPreferences),rows=[];
  try{for(const fixture of fixtures){
   userPreferences.showSpoilers=true;setCardState(fixture,'selected');const visible=buildEventCard(fixture);
   userPreferences.showSpoilers=false;const hidden=buildEventCard(fixture),schedule=buildCodeInspectorFixture(fixture);
   rows.push({id:fixture.id,table:[...visible.querySelectorAll('.tennis-set-table tbody tr')].map(tr=>({name:tr.querySelector('th')?.textContent,games:[...tr.querySelectorAll('td')].map(td=>td.firstChild?.textContent.trim())})),visible:visible.textContent,hidden:hidden.textContent,schedule:schedule.textContent,score:fixture.score,sets:fixture.sets.map(s=>`${s.home}–${s.away}`).join('  '),outcome:fixture.outcomeText,resultNodes:hidden.querySelectorAll('.card-result-line,.feed-live-score,.spoiler-facts').length});
  }}finally{userPreferences=JSON.parse(saved);}return rows;
 },reviewed);
 for(const row of realResults){const fixture=reviewed.find(f=>f.id===row.id);if(row.table.length){assert.equal(row.table.length,2);const normalized=name=>String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');for(const player of row.table){const identity=fixture.participants.find(p=>[p.displayName,p.name,...(p.aliases||[])].filter(Boolean).some(name=>normalized(name)===normalized(player.name)));assert(identity,'normal result table retains a verified player name: '+JSON.stringify(row));const role=identity.id===fixture.homeParticipantId?'home':identity.id===fixture.awayParticipantId?'away':null;assert(role,'table player maps to a sourced home/away identity');assert.deepEqual(player.games,fixture.sets.map(set=>String(set[role])),'actual reviewed set scores remain attached to the correct player');}}else assert(row.visible.includes(row.sets),'actual reviewed oriented sets are available with Results ON: '+JSON.stringify(row));assert(![row.hidden,row.schedule].some(text=>[row.score,row.sets,row.outcome].some(value=>text.includes(value)))&&row.resultNodes===0,'actual reviewed Feed/Schedule final stays hidden with Results OFF');}
 console.log(JSON.stringify({engine,width,reviewedFinalsSpoilerSafe:realResults.length}));

 await page.close();}
 }finally{await browser.close();}}}finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
