#!/usr/bin/env node
'use strict';
// Controlled browser acceptance: test fixtures and isolated storage never reach production.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true});const evidence=[];let debugPage;
 try{for(const width of [390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',acceptDownloads:true});
  debugPage=page;page.setDefaultTimeout(10000);
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['afl'],selectedSelectorEntityIds:['sport:afl-premiership']})));
  await page.clock.install({time:new Date('2026-09-05T02:00:00Z')});
  await page.goto(`${base}/?acceptance=${width}`);
  await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
  await page.evaluate(()=>{
   userPreferences.followedSports=['afl','tennis','f1'];userPreferences.selectedSelectorEntityIds=['sport:afl-premiership','sport:tennis','sport:f1'];userPreferences.followFirst.australiansOnlySportIds=[];
   activeEvents=Array.from({length:12},(_,i)=>({id:'qa-'+i,eventId:'qa-'+i,name:'Carlton v Hawthorn '+i,key:'afl',date:'2026-09-05',time:`${String(8+i).padStart(2,'0')}:00`,status:i<3?'finished':'scheduled',venue:'MCG',stakesScore:5,expected:9,participantIds:['team:afl:carlton','team:afl:hawthorn'],manualPin:true}));
   activeTab='feed';activeView='list';activeFilter='all';calendarInitialJumpPending=false;renderAll();
  });
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.tab-btn[data-tab]').count(),3);
  const header=await page.evaluate(()=>{const a=document.getElementById('calendarSyncBtn').getBoundingClientRect(),b=document.getElementById('shareAppBtn').getBoundingClientRect();return {gap:b.left-a.right,h:a.height};});
  assert(header.gap>=0&&header.gap<=12&&header.h>=44);
  const card=page.locator('[data-event-id="qa-4"]');
  const align=async()=>{await card.evaluate(node=>window.scrollTo({top:window.scrollY+node.getBoundingClientRect().top-stickyFeedChromeHeight()-25,behavior:'instant'}));await page.waitForTimeout(100);};
  const rect=()=>card.evaluate(node=>({top:node.getBoundingClientRect().top,state:node.dataset.cardState,scroll:scrollY,max:document.documentElement.scrollHeight-innerHeight}));
  const deltas=[];
  for(const expected of ['opened','compact','selected']){
   await align();const before=await rect();await card.press('Enter');await page.waitForTimeout(150);const after=await rect();assert.equal(after.state,expected);assert(Math.abs(after.top-before.top)<=2,`width ${width} cycle ${expected} drift ${after.top-before.top}`);deltas.push(after.top-before.top);
  }
  for(const expected of ['opened','compact','selected']){
   await align();const before=await rect();await card.locator(expected==='selected'?'.compact-card-summary':'.event-date-line').click();await page.waitForTimeout(150);const after=await rect();assert.equal(after.state,expected);assert(Math.abs(after.top-before.top)<=2,`tap drift ${width}: ${after.top-before.top}`);deltas.push(after.top-before.top);
  }
  await align();let before=await rect();await card.locator('[data-card-control="expand"]').click();await page.waitForTimeout(150);let after=await rect();assert.equal(after.state,'opened');assert(Math.abs(after.top-before.top)<=2,`green expansion drift ${after.top-before.top}`);deltas.push(after.top-before.top);
  await align();before=await rect();await card.locator('[data-card-control="expand"]').click();await page.waitForTimeout(150);after=await rect();assert.equal(after.state,'selected');assert(Math.abs(after.top-before.top)<=2,`green collapse drift ${after.top-before.top}`);deltas.push(after.top-before.top);
  await page.getByRole('button',{name:'Calendar sync',exact:true}).click();await page.getByRole('button',{name:'Select fixtures',exact:true}).click();
  const checkbox=card.locator('[data-calendar-id]');await checkbox.check();assert.equal(await card.getAttribute('data-card-state'),'selected');
  await page.getByRole('button',{name:'Review calendar',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download ICS',exact:true}).click();const download=await downloaded;const fs=require('node:fs');const ics=fs.readFileSync(await download.path(),'utf8');assert(ics.includes('UID:qa-4@')&&ics.includes('BEGIN:VCALENDAR'));
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Done selecting',exact:true}).click();
  await page.getByRole('button',{name:'Compact',exact:true}).click();assert.equal(await card.getAttribute('data-card-state'),'compact');
  await page.getByRole('button',{name:'Compact',exact:true}).click();
  await align();before=await rect();await page.clock.fastForward(60000);await page.waitForTimeout(150);after=await rect();assert(Math.abs(after.top-before.top)<=2,`minute drift ${after.top-before.top}`);
  const viewing=await page.evaluate(()=>{
   const base={key:'football',date:'2026-09-05',time:'05:00',stakesScore:2};
   const host=document.createElement('section');host.id='provider-qa';document.getElementById('listView').append(host);
   host.append(buildEventCard({...base,id:'qa-betis',name:'Real Betis v Real Madrid',competitionId:'competition:la-liga'}),buildEventCard({...base,id:'qa-psg',name:'Paris Saint-Germain v AS Monaco',competitionId:'competition:ligue-1',broadcaster:'beIN Sports'}));
   return {bein:host.querySelector('[data-event-id="qa-betis"] .event-card-viewing-actions')?.textContent,psg:host.querySelector('[data-event-id="qa-psg"] .event-card-viewing-actions')?.textContent};
  });assert(viewing.bein.includes('Watch on')||viewing.bein.includes('Replay on'));assert(viewing.psg.includes('Australian viewing unconfirmed'));
  await page.locator('#provider-qa img[alt="beIN SPORTS logo"]').waitFor({state:'attached'});
  await page.locator('.tab-btn[data-tab="follow"]').click();await page.getByRole('button',{name:'AFL',exact:true}).click();await page.getByRole('button',{name:'AFL Premiership',exact:true}).click();
  await page.getByRole('button',{name:'Ladder',exact:true}).waitFor();
  const tabs=await page.locator('.follow-section-tabs button').allTextContents();assert.deepEqual(tabs,['Schedule','Ladder','Teams & players','Major Events']);
  const club=page.locator('[data-directory-team-id]').first();await club.waitFor();
  await club.evaluate(node=>window.scrollTo(0,window.scrollY+node.getBoundingClientRect().top-400));
  await page.waitForFunction(()=>{const node=document.querySelector('[data-directory-team-id]');const top=node?.getBoundingClientRect().top;return top>250&&top<650;});
  const followDeltas=[];
  for(const expanded of [true,false]){const beforeFollow=await club.evaluate(node=>({top:node.getBoundingClientRect().top,scrollY}));const box=await club.locator('.football-club-expand').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(200);const afterFollow=await club.evaluate(node=>({top:node.getBoundingClientRect().top,scrollY}));const delta=afterFollow.top-beforeFollow.top;assert(Math.abs(delta)<=2,`Follow drift ${width} expanded=${expanded}: ${delta}`);followDeltas.push(delta);}
  await page.getByRole('button',{name:'Schedule',exact:true}).click();await page.waitForSelector('[data-inspector-fixture-id]');assert(!await page.getByRole('tab',{name:'Players',exact:true}).count());
  await page.getByRole('button',{name:'Back to Follow',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'AFL Premiership',exact:true}).count(),1);
  await page.locator('.tab-btn[data-tab="events"]').click();await page.getByRole('tab',{name:/^Tickets/}).click();await page.getByRole('article',{name:'Australian Open 2027. Summary view.',exact:true}).waitFor();
  assert((await page.getByRole('article',{name:'Australian Open 2027. Summary view.',exact:true}).innerText()).includes('11 Jan 2027 - 31 Jan 2027'));
  assert((await page.getByRole('article',{name:'Formula 1 Australian Grand Prix 2027. Summary view.',exact:true}).innerText()).includes('Dates TBC'));
  assert.equal(await page.getByRole('link',{name:/Join waitlist for Formula 1 Australian/}).count(),1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`horizontal overflow ${width}`);
  evidence.push({width,anchorDeltas:deltas,followDeltas,guestIcs:true,providers:true,followBack:true,ticketDates:true});await page.close();
 }}catch(error){console.log('Failure URL',debugPage?.url());console.log((await debugPage?.locator('body').innerText())?.slice(0,1600));throw error;}finally{await browser.close();}
 console.log(JSON.stringify(evidence,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
