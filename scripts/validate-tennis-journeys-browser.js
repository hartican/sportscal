'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 let server,base=process.env.QA_BASE_URL;if(!base){server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname,file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 try{for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[];let journeyRequests=0;
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname==='/data/tennis-journeys.v1.json')journeyRequests++;});await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
   const players=require('../data/tennis-journeys.v1.json').players;
   await page.addInitScript(players=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:24,onboardingComplete:true,selectedSelectorEntityIds:['sport:tennis'],followedSports:['tennis'],showSpoilers:false,preferenceGraph:{entityFollows:players.map(p=>({participantId:p.id,followLevel:'follow'}))}})),players);
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences==='object'&&!startupCoordinator.isHydrating());assert.equal(journeyRequests,0,'journey data is deferred until used');
   await page.evaluate(()=>openCodeInspector('sport:tennis'));const journeys=page.locator('[data-tennis-journeys]');await journeys.waitFor();assert.equal(await journeys.getAttribute('open'),null);await journeys.locator('summary').first().click();
   const miami=page.locator('[data-journey-edition="tennis-edition:miami-open:2027"]');await miami.waitFor();await miami.locator('summary').click();assert.match(await miami.innerText(),/ATP · 2027-03-17/);assert.match(await miami.innerText(),/WTA · 2027-03-16/);assert.match(await miami.innerText(),/Very likely · entry unconfirmed/);assert.match(await miami.innerText(),/checked 2026-10-02/);
   assert.equal(await journeys.locator('[data-reminder-action-key]').count(),0);assert.equal(await journeys.getByRole('button',{name:/Remind/}).count(),0);assert.equal(journeyRequests,1,'one shared document request');
   for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');}
   await page.setViewportSize({width:390,height:844});if(process.env.JOURNEY_QA_SCREENSHOT&&engine==='chromium')await page.screenshot({path:process.env.JOURNEY_QA_SCREENSHOT});
   await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.followFirst.excludedMajorEventIds.push('miami-open');const sab=next.preferenceGraph.entityFollows.find(p=>p.participantId.includes('sabalenka'));sab.followLevel='unfollow';savePreferences(next);renderCodeInspector();});
   await page.waitForFunction(()=>!document.querySelector('[data-journey-edition="tennis-edition:miami-open:2027"]')&&!!document.querySelector('[data-journey-edition="tennis-edition:wimbledon:2027"]'));
   await page.locator('[data-journey-edition="tennis-edition:wimbledon:2027"] summary').click();assert(!(await page.locator('[data-tennis-journeys]').innerText()).includes('Aryna Sabalenka'));assert.equal(journeyRequests,1);assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false);assert.equal(await page.evaluate(()=>activeEvents.some(e=>String(e.id).startsWith('tennis-edition:'))),false);assert.deepEqual(errors,[]);
   console.log(JSON.stringify({engine,base,rollingCalendar:true,separateTourDates:true,unconfirmedEntriesLabelled:true,deferredSharedRequest:true,exclusionsAndUnfollows:true,noFixturesOrReminders:true,resultsOffPreserved:true,widths:[320,390,768,1280]}));
  }finally{await browser.close();}
 }}finally{if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
