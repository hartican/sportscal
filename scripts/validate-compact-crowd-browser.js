'use strict';
const assert=require('node:assert/strict');const {chromium}=require('playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8879';
(async()=>{const browser=await chromium.launch({headless:true});const evidence=[];
try{for(const width of [390,768,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['afl','tennis','f1','premier-league'],selectedSelectorEntityIds:['sport:afl-premiership','sport:tennis']})));
 await page.goto(base+'/?crowdQA='+width);await page.waitForFunction(()=>typeof setFeedCompact==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 await page.evaluate(()=>{
   activeEvents=activeEvents.filter(e=>e.date>='2026-09-05'&&e.date<='2026-09-07').map(e=>({...e,manualPin:true}));getFilteredEvents=()=>activeEvents;
   activeTab='feed';activeView='list';activeFilter='all';calendarInitialJumpPending=false;renderAll();
 });
 assert(await page.locator('.event-card').count()>3,'real published fixture coverage');
 await page.getByRole('button',{name:'Compact',exact:true}).click();await page.waitForFunction(()=>compactRenderFrame===null);
 const geometry=await page.locator('.is-compact-row').evaluateAll(cards=>cards.map(c=>({height:c.getBoundingClientRect().height,overflow:c.scrollWidth>c.clientWidth+1,text:c.querySelector('.compact-card-name')?.textContent})));
 assert(geometry.length>3);assert(geometry.every(c=>c.height<=52&&!c.overflow),JSON.stringify(geometry.slice(0,5)));
 assert.equal(await page.locator('.traffic-light-dot').count(),0);
 // Rapid taps must finish in a single mode, including all loaded cards.
 const toggles=await page.evaluate(async()=>{const render=renderListView;let renders=0;renderListView=(...args)=>{renders++;return render(...args)};const started=performance.now();for(let i=0;i<10;i++)document.querySelector('.feed-view-actions button').click();const inputMs=performance.now()-started;await new Promise(requestAnimationFrame);renderListView=render;return {renders,inputMs};});assert.equal(toggles.renders,1,'rapid taps coalesce into one render');assert(toggles.inputMs<100,'Compact acknowledgement is immediate');
 assert.equal(await page.locator('.event-card:not(.is-compact-row)').count(),0);
 await page.getByRole('button',{name:'Calendar sync',exact:true}).click();await page.getByRole('button',{name:'Select fixtures',exact:true}).click();
 const selection=page.locator('.is-compact-row [data-calendar-id]:not(:disabled)').first();const old=await selection.isChecked();const selectionCard=selection.locator('xpath=ancestor::*[contains(@class,"event-card")][1]');await selectionCard.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));const summaryBox=await selectionCard.locator('.compact-card-summary').boundingBox();await page.mouse.click(summaryBox.x+summaryBox.width*.6,summaryBox.y+summaryBox.height/2);assert.equal(await selection.isChecked(),!old);
 await page.evaluate(()=>scrollBy(0,300));const toolbar=await page.locator('.calendar-selection-toolbar').evaluate(e=>({position:getComputedStyle(e).position,top:e.getBoundingClientRect().top}));assert.equal(toolbar.position,'sticky');assert(toolbar.top>=0);
 await page.getByRole('button',{name:'Done selecting',exact:true}).click();
 await page.getByRole('button',{name:'Expand',exact:true}).click();await page.waitForFunction(()=>compactRenderFrame===null);
 assert.equal(await page.locator('.is-compact-row').count(),0,'normal mode clears legacy minimise');
 await page.screenshot({path:`/tmp/sportscal-standard-${width}.png`});
 await page.locator('.tab-btn[data-tab="events"]').click();assert.equal(await page.locator('.nsc-rating-block').count(),0);assert.equal(await page.locator('.calendar-selection-toolbar').count(),0);assert(!await page.locator('#calendarSyncBtn').isVisible());
 await page.locator('.tab-btn[data-tab="follow"]').click();const track=page.locator('.follow-sport-track');const followPageSize=width<=600?4:width<=1000?6:8;await page.getByRole('button',{name:'Next sports',exact:true}).click();await page.waitForTimeout(350);await track.locator('button').nth(followPageSize).click();await page.waitForFunction(()=>followBrowseState().page===1&&Math.round(document.querySelector('.follow-sport-track').scrollLeft/Math.max(1,document.querySelector('.follow-sport-track').clientWidth))===1);
 // Isolated synthetic session and intercepted requests exercise the real one-tap client.
 let ratingWrites=0;
 const ratingDetail={eventId:'qa-inline',phase:'heat',peerResults:{average:3.5,count:6},currentUser:{contribution:null}};
 await page.route('**/api/nothingscore**',async route=>{const request=route.request();if(request.method()==='POST'){ratingWrites++;const body=request.postDataJSON();await new Promise(resolve=>setTimeout(resolve,180));ratingDetail.currentUser.contribution={rating:body.rating};return route.fulfill({contentType:'application/json',body:JSON.stringify({eventId:'qa-inline',phase:'heat',rating:body.rating,pointsAwarded:ratingWrites===1?2:0})});}return route.fulfill({contentType:'application/json',body:JSON.stringify({detail:ratingDetail,snapshots:[]})});});
 await page.evaluate(detail=>{const token='qa.'+btoa(JSON.stringify({sub:'qa-browser-owner'}))+'.local';localStorage.setItem('ns_auth_persistent_session_v1',JSON.stringify({accessToken:token,refreshToken:'qa-local-only',expiresAt:Date.now()+3600000}));serverPersistence.user={id:'qa-browser-owner'};const host=document.createElement('section');host.id='qa-inline-host';document.body.appendChild(host);host.appendChild(buildInlineCrowdRating({id:'qa-inline',name:'QA fixture'},detail));},ratingDetail);
 const ratingHost=page.locator('#qa-inline-host');await ratingHost.getByRole('button',{name:/^5 out of 5/}).click();await ratingHost.getByText('+2 points',{exact:true}).waitFor();assert.equal(ratingWrites,1);assert.equal(await ratingHost.locator('.is-filled').count(),5);
 assert(await ratingHost.getByRole('button',{name:/^2 out of 5/}).isDisabled(),'Upcoming rating seals after the first submission');
 await ratingHost.getByRole('button',{name:/^2 out of 5/}).click({force:true});await page.waitForTimeout(80);assert.equal(ratingWrites,1);assert.equal(await ratingHost.locator('.is-filled').count(),5);
 await page.evaluate(()=>{document.getElementById('qa-inline-host').remove();localStorage.removeItem('ns_auth_persistent_session_v1');serverPersistence.user=null;});await page.unroute('**/api/nothingscore**');
 // Controlled API responses verify layout and interactions, separately from DB transaction checks.
 const entries=await page.evaluate(()=>activeEvents.slice(0,8).map((e,i)=>({id:e.eventId||e.id,name:e.name,key:e.key,startTimeUtc:e.startTimeUtc,phase:'heat',rank:i<5?i+1:null,crowd:{average:4.2,count:i<5?8:2,early:i>=5}})));
 await page.route('**/api/nothingscore?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().includes('rankings=')?{entries,nextCursor:null}:{viewer:{signedIn:false,pilot:false},snapshots:[]})}));
 await page.locator('#nothingscoreBtn').click();await page.getByRole('button',{name:'Upcoming',exact:true}).waitFor();await page.locator('.nsc-fixture-row').first().waitFor();assert.equal(await page.locator('.nsc-fixture-row').count(),entries.length);
 await page.getByLabel('Fixture scope').selectOption('all');await page.getByRole('button',{name:'Live',exact:true}).click();await page.getByRole('button',{name:'Past',exact:true}).click();assert(await page.getByLabel('Date range').isVisible());
 await page.locator('.nsc-fixture-row').first().waitFor();
 await page.screenshot({path:`/tmp/sportscal-crowd-${width}.png`});
 assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));assert.deepEqual(errors,[]);
 evidence.push({width,realFixtures:geometry.length,maxCompactHeight:Math.max(...geometry.map(x=>x.height)),rapidToggle:toggles,calendarRowSelection:true,stickyToolbar:true,followTrackRetained:true,crowdTabs:true,oneTapRatingAndSeal:true,consoleErrors:errors});await page.close();
}}finally{await browser.close();}console.log(JSON.stringify(evidence,null,2));})().catch(error=>{console.error(error);process.exitCode=1;});
