#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:34006',runs=[];
const people=Array.from({length:128},(_,i)=>({id:`competitor:tennis:atp:qa-${i}`,displayName:`Player ${String(128-i).padStart(3,'0')}`,sportKey:'tennis'}));
const fixtures=Array.from({length:50},(_,i)=>({id:`fixture:tennis:qa:${i}`,canonicalEventId:`fixture:tennis:qa:${i}`,name:`Player ${128-i} v Opponent`,key:'tennis',sport:'Tennis',cardKind:'fixture',contestUnit:'match',date:'2099-10-06',startTimeUtc:`2099-10-06T${String(10+i%10).padStart(2,'0')}:00:00Z`,participantsConfirmed:true,participantIds:[people[i].id,'competitor:tennis:atp:qa-opponent'],participants:[people[i],{id:'competitor:tennis:atp:qa-opponent',name:'Opponent'}],tournamentName:'China Open',eventFamilyId:'china-open',tour:'ATP',tournamentLevel:'500',round:'final',roundLabel:'Final',status:'scheduled',timePrecision:'exact',sourceCheckedAt:new Date().toISOString(),sourceUrl:'https://www.atptour.com/en/scores/current'}));
const preferences={version:26,onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:people.map(p=>({participantId:p.id,followLevel:'follow'}))},followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}};
(async()=>{
 for(const engine of process.env.QA_BROWSER?[process.env.QA_BROWSER]:['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true});
  try{for(const width of [390,1280]){
   const page=await browser.newPage({serviceWorkers:'block',viewport:{width,height:844}}),errors=[];let release;const gate=new Promise(r=>release=r);let reads=0;
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(p=>localStorage.setItem('ns_preferences_v1',JSON.stringify(p)),preferences);
   await page.route('**/data/tennis-journeys.v1.json*',r=>r.fulfill({json:{players:[],editions:[],sources:[],milestones:[]}}));
   await page.route('**/api/**',async r=>{const u=new URL(r.request().url());if(u.pathname==='/api/feed'&&u.searchParams.get('scope')==='athletes'){reads++;await gate;return r.fulfill({json:{events:fixtures,athletes:people,pagination:{nextCursor:null}}});}return r.fulfill({status:503,json:{error:'Isolated responsiveness QA'}});});
   try{
    await page.goto(base,{waitUntil:'commit'});await page.waitForFunction(()=>typeof activateTopLevelTab==='function');await page.evaluate(p=>{acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});canonicalPreferenceParticipants=p;},people);await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.waitForFunction(()=>!startupCoordinator.isHydrating());await page.evaluate(fixtures=>{activeEvents=Array.from({length:1000},(_,i)=>({...fixtures[i%fixtures.length],id:'fixture:tennis:fallback:'+i,canonicalEventId:'fixture:tennis:fallback:'+i}));globalThis.qaFollowTap=performance.now();},fixtures);
    await page.locator('.tabs [data-tab=follow]').click();await page.waitForFunction(()=>!!globalThis.NOTHINGSPORTS_ATHLETES_UI);await page.waitForFunction(()=>document.querySelector('.athletes-person'));
    const fallback=await page.evaluate(()=>({renderMs:performance.now()-qaFollowTap,fixtures:activeEvents.length}));assert(fallback.renderMs<1500,'Opening Follow against the full retained catalogue must stay interactive');assert.equal(fallback.fixtures,1000);assert(await page.locator('.athletes-person .athletes-next-match').count()>0,'The initial render must use retained fixture data');
    await page.evaluate(()=>{const next=NOTHINGSPORTS_ATHLETES.next;globalThis.qaNextCalls=0;NOTHINGSPORTS_ATHLETES.next=(...a)=>{qaNextCalls++;return next(...a);};globalThis.qaStarted=performance.now();globalThis.qaLongestTask=0;globalThis.qaObserver=typeof PerformanceObserver==='function'?new PerformanceObserver(l=>l.getEntries().forEach(e=>qaLongestTask=Math.max(qaLongestTask,e.duration))):null;try{qaObserver?.observe({entryTypes:['longtask']});}catch{}});
    release();await page.waitForFunction(()=>!document.querySelector('#listView [role=status]'));
    const metrics=await page.evaluate(()=>({settledMs:performance.now()-qaStarted,nextCalls:qaNextCalls,longestTaskMs:qaLongestTask}));
    console.log(JSON.stringify({engine,width,...metrics}));
    assert(metrics.nextCalls<=people.length*2,`Fixture selection repeated ${metrics.nextCalls} times for ${people.length} follows`);
    assert(metrics.settledMs<1500,`Settled Follow blocked for ${metrics.settledMs.toFixed(0)}ms`);
    assert.equal(await page.locator('.athletes-person').count(),people.length,'Every saved favourite remains accessible');
    assert(!/Checking published fixtures|Device permission|push subscription|Reminder timing needs verification|Official tennis schedules/.test(await page.locator('#listView').innerText()),'Landing view omits repeated diagnostic copy');
    assert.equal(await page.locator('.athletes-heading h2').count(),0,'The selected tab already labels this list');
    const choices=await page.evaluate(()=>JSON.stringify([userPreferences.preferenceGraph,userPreferences.followFirst,userPreferences.showSpoilers,eventActions]));
    await page.mouse.move(Math.min(width-20,350),750);await page.mouse.wheel(0,700);await page.waitForFunction(()=>scrollY>100);
    await page.getByRole('button',{name:`Open ${people[70].displayName} profile in Follow`,exact:true}).click();await page.locator('.athletes-profile-back').waitFor();
    await page.getByRole('button',{name:'Back',exact:true}).click();await page.locator('.athletes-person').first().waitFor();
    await page.getByRole('button',{name:'Browse sports',exact:true}).click();await page.locator('.follow-navigation').waitFor();
    assert.equal(await page.evaluate(()=>JSON.stringify([userPreferences.preferenceGraph,userPreferences.followFirst,userPreferences.showSpoilers,eventActions])),choices,'Viewing, scrolling and switching preserves personal settings');
    if(width===390){await page.evaluate(()=>{ensureFollowCollectionDirectories=()=>new Promise(()=>{});});await page.getByRole('button',{name:'My athletes & teams',exact:true}).click();const start=Date.now();await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#listView [role=status]')&&!document.querySelector('.athletes-heading button').disabled);assert(Date.now()-start<1500,'An unresponsive identity directory cannot block schedule completion');assert.equal(await page.locator('.athletes-person').count(),people.length);
     await page.route('**/api/feed?*',()=>new Promise(()=>{}));const stalled=Date.now();await page.evaluate(()=>{userPreferences=clonePreferences(userPreferences);userPreferences.theme='light';NOTHINGSPORTS_ATHLETES_UI.start();});await page.mouse.wheel(0,500);await page.getByText('Showing available information. Refresh to check for updates.',{exact:true}).waitFor({timeout:12000});assert(Date.now()-stalled<12000,'A stalled fixture read must settle within the existing ten-second deadline');assert.equal(await page.locator('#listView [role=status]').count(),0,'Timeout clears the loading state');assert.equal(await page.locator('.athletes-person').count(),people.length,'Timeout preserves saved favourites');await page.unroute('**/api/feed?*');await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#listView [role=status]')&&!document.querySelector('#listView').textContent.includes('Showing available information'));}
    assert.deepEqual(errors,[]);runs.push({engine,width,people:people.length,reads,...metrics,fallback,scrollAndClicks:true});
   }finally{release();await page.close();}
  }}finally{await browser.close();}
 }
 const receipt={checkedAt:new Date().toISOString(),runs};if(process.env.FOLLOW_RESPONSIVENESS_REPORT_PATH)fs.writeFileSync(process.env.FOLLOW_RESPONSIVENESS_REPORT_PATH,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
