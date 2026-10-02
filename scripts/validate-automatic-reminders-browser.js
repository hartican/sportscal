'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname,file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const engine of ['chromium','webkit']){
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
 try{const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}});page.on('console',m=>{if(m.text().startsWith('QA:'))console.log(engine,m.text());});page.on('pageerror',e=>console.error(engine,e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:24,onboardingComplete:true,selectedSelectorEntityIds:['sport:nrl'],followedSports:['nrl'],showSpoilers:false,preferenceGraph:{entityFollows:[{participantId:'team:nrl:331',followLevel:'follow'}]}})));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences==='object'&&!startupCoordinator.isHydrating());
 const result=await page.evaluate(async()=>{
  const t=new Date(Date.now()+3600000).toISOString(),f={id:'fixture:qa:final',canonicalEventId:'fixture:qa:final',key:'nrl',sport:'NRL',name:'Grand Final',date:t.slice(0,10),time:'19:30',startTimeUtc:t,status:'upcoming',scheduleStatus:'confirmed',timePrecision:'not-before',sourceUrl:'https://organiser.example/final',sourceCheckedAt:new Date().toISOString(),roundLabel:'Grand Final',participantIds:['team:nrl:331','team:nrl:325']};
  const host=document.createElement('div');document.body.append(host);host.append(buildEventCard(f,{mode:'feed'}),buildEventCard({...f,id:'nested:qa:final',sourceEventIds:[f.id]},{mode:'feed'}));
  await loadDeferredScript('assets/js/tournament-fixture-ui.js?v='+document.querySelector('meta[name="app-shell-version"]').content);
  tournamentHorizon={tournaments:[{tournamentId:'qa:tour',publishedFixtures:[{...f,id:'nested:qa:event',sourceEventIds:[f.id]}]}]};
  const nested=document.createElement('div');host.append(nested);NOTHINGSPORTS_TOURNAMENT_UI.append(nested,{id:'qa:tour',tournamentId:'qa:tour',key:'nrl'});await new Promise(r=>setTimeout(r,20));nested.querySelector('details').open=true;await new Promise(r=>setTimeout(r,20));
  const buttons=[...host.querySelectorAll('[data-reminder-action-key]')];if(buttons.length!==3)throw Error('Both fixture instances must expose a reminder');
  const initial=buttons.every(b=>b.getAttribute('aria-pressed')==='true');
  updateEventAction(f,{saved:true});const saveNeutral=!Object.hasOwn(storedEventAction(f),'reminderRequested');
  removeWebPushReminder=async()=>{throw Error('Offline');};
  await toggleQuickReminder(f,buttons[0]);const rolledBack=getEventAction(f).reminderRequested&&!storedEventAction(f).reminderChoice;
  removeWebPushReminder=async()=>({cancelled:true});await toggleQuickReminder(f,buttons[0]);
  const off=buttons.every(b=>b.getAttribute('aria-pressed')==='false')&&storedEventAction(f).reminderChoice==='off';
  const rescheduledOff=getEventAction({...f,startTimeUtc:new Date(Date.now()+7200000).toISOString()}).reminderRequested===false;
  const next=clonePreferences(userPreferences);next.followFirst.notifications.autoRemindersEnabled=false;savePreferences(next);const globalOff=getEventAction({...f,id:'fixture:qa:other',canonicalEventId:'fixture:qa:other'}).reminderRequested===false;
  host.remove();return {initial,saveNeutral,rolledBack,off,rescheduledOff,globalOff,resultsOff:userPreferences.showSpoilers===false};
 });for(const [key,value] of Object.entries(result))assert.equal(value,true,key);
 await page.evaluate(()=>openSettings({section:'notifications'}));await page.locator('#autoRemindersEnabled').waitFor();assert.equal(await page.locator('#autoRemindersEnabled').isChecked(),false);
 console.log(JSON.stringify({engine,...result,settingsControl:true,realPush:false}));
 }finally{await browser.close();}}
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
