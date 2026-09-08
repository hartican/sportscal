#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const width of [390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date(Math.max(Date.parse('2026-09-08T00:00:00Z'),Date.parse(require('../feeds/provider-exports/tennis/us-open-2026-official-schedule.json').capturedAt)+1000)));
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['f1','tennis'],selectedSelectorEntityIds:['sport:f1','sport:tennis']})));
  const entries=Array.from({length:30},(_,i)=>({profileId:`profile-${i}`,rank:i+1,name:`Sports Fan ${i+1}`,handle:`fan_${i+1}`,fixtures:30-i,points:120-i,efficiency:i===2?null:.85,isViewer:i===29}));
  let failure=false;const requests=[];
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url());requests.push({path:url.pathname,query:url.search,method:route.request().method()});
   if(url.searchParams.has('ladder')){const cursor=Number(url.searchParams.get('cursor')||0);return route.fulfill(failure?{status:503,json:{error:'Test outage'}}:{json:{schemaVersion:'nothing-score-ladder.v1',entries:entries.slice(cursor,cursor+25),viewer:entries[29],signedIn:true,total:30,nextCursor:cursor===0?25:null}});}
   return route.fulfill({status:503,json:{error:'Isolated local QA'}});
  });
  await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:8765');await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
  await page.locator('.tab-btn[data-tab="feed"]').click();
  await page.locator('#homeSpoilerToggle').click();await page.locator('#resultsConfirmation').waitFor();assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false);
  await page.getByRole('button',{name:'Keep results OFF'}).click();assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false);
  await page.locator('#homeSpoilerToggle').click();await page.locator('#resultsConfirmation [data-confirm]').click();assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),true);
  await page.locator('#homeSpoilerToggle').click();assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false);
  await page.locator('#calendarSyncBtn').click();const bounds=await page.locator('#calendarSyncDialog').boundingBox();assert(bounds.y>=20&&bounds.y+bounds.height<=844-10);assert(Math.abs(bounds.x+bounds.width/2-width/2)<3);
  await page.getByRole('button',{name:'Close calendar sync'}).click();
  if(width===390){
   await page.locator('#calendarSyncBtn').click();await page.getByRole('button',{name:'Select fixtures',exact:true}).click();
   await page.getByRole('button',{name:'Select all matching',exact:true}).click();await page.waitForFunction(()=>!calendarChoice.busy,null,{timeout:30000});
   assert(await page.evaluate(()=>calendarChoice.included.size>0),'real bulk button commits matching fixtures');
   await page.getByRole('button',{name:'Unselect all matching',exact:true}).click();await page.waitForFunction(()=>!calendarChoice.busy);assert.equal(await page.evaluate(()=>calendarChoice.included.size),0);
   await page.getByRole('button',{name:'Done selecting',exact:true}).click();
  }
  await page.evaluate(()=>openNothingscoreDrawer());await page.locator('[data-ladder-profile="profile-0"]').waitFor();
  assert.equal(await page.locator('#nothingscoreTitle').textContent(),'Nothing Score');assert.equal(await page.locator('#nothingscoreBody').evaluate(e=>e.scrollTop),0);
  await page.locator('.nsc-ladder-frozen:not([hidden])').waitFor();assert.equal(await page.locator('.nsc-ladder-frozen').getByText('@fan_30 · You').count(),1);
  await page.screenshot({path:`/tmp/nsc-ladder-${width}.png`});
  await page.getByRole('button',{name:'Load more'}).click();await page.locator('[data-ladder-profile="profile-29"]').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.nsc-ladder-frozen').hidden);
  await page.locator('#nothingscoreBody').evaluate(e=>e.scrollTop=0);await page.waitForFunction(()=>!document.querySelector('.nsc-ladder-frozen').hidden);
  assert(requests.filter(r=>r.query.includes('ladder')).every(r=>r.method==='GET'&&!r.query.includes('preferences')),'ladder uses bounded read-only requests');
  assert.equal(requests.some(r=>r.query.includes('rewards')),false,'ladder never invokes reward sync');
  failure=true;await page.evaluate(()=>renderCrowdRankings());await page.getByRole('button',{name:'Retry',exact:true}).waitFor();failure=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('[data-ladder-profile="profile-0"]').waitFor();
  await page.evaluate(()=>setNothingscoreDrawerOpen(false));
  await page.evaluate(()=>{
   const fixture={id:'qa-card',eventId:'qa-card',key:'tennis',name:'Alex de Minaur v Daniil Medvedev',eventName:'US Open',competitionId:'competition:tennis:us-open:2026',date:'2026-09-09',time:'04:00',startTimeUtc:'2026-09-08T18:00:00Z',timePrecision:'exact',matchupSides:[{players:[{id:'alex',name:'Alex de Minaur',countryCode:'AU'},{id:'alex',name:'Alex de Minaur',countryCode:'AU'}]},{players:[{id:'daniil',name:'Daniil Medvedev',countryCode:'RU'}]}]};
   nothingscoreSnapshots.set(fixture.id,{eventId:fixture.id,phase:'heat',peerResults:{count:1,average:3,label:'Interesting'},currentUser:null});
   const host=document.createElement('div');host.id='qa-shared-card';host.append(buildEventCard(fixture,{mode:'feed'}));document.querySelector('#listView').prepend(host);
  });
  const card=page.locator('#qa-shared-card');await card.scrollIntoViewIfNeeded();assert.equal(await card.locator('.nsc-rating-block svg').count(),5);assert.equal(await card.locator('.major-event-matchup-player').filter({hasText:'Alex de Minaur'}).count(),1);
  assert.equal(await card.locator('[data-country-code="RU"]').count(),0);assert(await card.getByText(/1 Nothinger expects this to be 3.0\/5/).count());assert(await card.getByText('INTERESTING',{exact:true}).count());
  const summaryBounds=await card.locator('.nsc-peer-summary').boundingBox(),tagBounds=await card.locator('.fixture-tags').boundingBox();assert(tagBounds.y>=summaryBounds.y+summaryBounds.height-1,'tags occupy their own line beneath the contributor summary');
  await card.screenshot({path:`/tmp/shared-card-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,spoilerConfirmation:true,calendarBounds:true,ladderPagination:true,frozenViewer:true,retry:true,sharedFlames:true,dedup:true,errors}));await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
