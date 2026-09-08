#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-09-08T12:00:00Z'));
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:[],preferenceGraph:{entityFollows:[{participantId:'competitor:f1:george-russell',followLevel:'follow'}]}})));
  let state='confirmed';
  const fixture={id:'qa-cross-code',eventId:'qa-cross-code',name:'Cross-code entry regression',date:'2026-09-09',key:'motorsport',dateOnly:true,timePrecision:'date-only',competitionId:'competition:nls-2026',competitionName:'NLS'};
  const entry=()=>({participantId:'competitor:f1:george-russell',displayName:'George Russell',countryCode:'GB',participationStatus:state,participationKind:'race',publishedAt:state==='withdrawn'?'2026-09-09':'2026-09-08',sourceUrl:'https://www.nuerburgring-langstrecken-serie.de/',checkedAt:'2026-09-08'});
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/fixtures'){
    if(url.searchParams.has('athlete'))return route.fulfill({json:{schemaVersion:'athlete-participation-live.v1',history:[{eventId:fixture.id,date:fixture.date,discipline:'NLS',kind:'race',description:'Confirmed entry — Cross-code entry regression',sourceUrl:entry().sourceUrl}]}});
    return route.fulfill({json:{schemaVersion:'live-fixtures.v1',revision:state,sources:[{source_id:'discovery-ai-athletes',fixtures:[{...fixture,enrichmentOnly:true,fixtureFallback:fixture,participationEvidence:[entry()],consensusTags:[{label:'Rivalry',confidence:.9,sourceUrls:['https://www.bbc.com/sport']}] }]}]}});
   }
   return route.fulfill({status:503,json:{error:'Isolated local QA'}});
  });
  await page.goto(base);await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
  await page.locator('.tab-btn[data-tab="feed"]').click();await page.evaluate(()=>refreshLiveFixtureSnapshot());
  const card=page.locator('#listView [data-event-id="qa-cross-code"]');await card.waitFor({state:'attached'});
  await card.scrollIntoViewIfNeeded();assert.match(await card.innerText(),/RIVALRY/i);assert.equal(await card.count(),1);
  await page.screenshot({path:`/tmp/discovery-feed-${width}.png`});
  await page.evaluate(async()=>{const chunk=await loadFollowDirectoryChunk('f1');await ensureAthleteProfileUi();await globalThis.NOTHINGSPORTS_ATHLETE_PROFILE_UI.open(chunk.records.find(record=>record.id==='competitor:f1:george-russell'),'f1');});
  await page.getByText('Confirmed entry — Cross-code entry regression',{exact:false}).waitFor();await page.locator('.athlete-profile-close').click();
  state='withdrawn';await page.evaluate(()=>refreshLiveFixtureSnapshot());
  await page.waitForFunction(()=>liveFixtureRevision==='withdrawn');
  assert(await page.evaluate(()=>activeEvents.some(event=>event.id==='qa-cross-code')),'withdrawal removes membership, not the calendar fixture');
  await card.waitFor({state:'detached',timeout:10000});
  assert.equal(await card.count(),0,'the athlete-only Feed excludes an explicitly withdrawn entry');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,crossSportFeed:true,consensusTag:true,liveProfile:true,withdrawalOnlyRemovesMembership:true,uncaughtErrors:errors}));await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
