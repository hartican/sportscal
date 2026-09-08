#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),{chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const base=process.env.QA_BASE_URL||"http://127.0.0.1:8765";
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [390,1280]){
      const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:"block"}),errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.clock.setFixedTime(new Date(Math.max(Date.parse('2026-09-08T00:00:00Z'),Date.parse(require('../feeds/provider-exports/tennis/us-open-2026-official-schedule.json').capturedAt)+1000)));
      await page.addInitScript(()=>localStorage.setItem("ns_preferences_v1",JSON.stringify({onboardingComplete:true,followedSports:["f1","rugby","cricket"],selectedSelectorEntityIds:["sport:f1","sport:rugby","sport:cricket"],preferenceGraph:{entityFollows:[{participantId:"team:rugby:wallabies",followLevel:"follow"}]}})));
      let snapshot=null;
      await page.route("**/api/**",async route=>{
        if(new URL(route.request().url()).pathname==="/api/fixtures"&&snapshot)return route.fulfill({json:snapshot});
        return route.fulfill({status:503,json:{error:"Isolated local QA"}});
      });
      await page.goto(base);
      await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
      await page.locator('.tab-btn[data-tab="feed"]').click();
      await page.locator('#listView [data-event-id="fixture:rugby:ra:949461"]').waitFor({state:"attached"});
      assert(await page.evaluate(()=>activeEvents.some(event=>event.id==="fixture:cricket:CA:40954")),"new source-backed Cricket fixture reaches the app");
      await page.locator('#settingsBtn').click();
      await page.locator('[data-settings-section="all-followed"]').click();
      await page.locator('[data-followed-id="team:rugby:wallabies"]').waitFor({state:"visible"});
      await page.screenshot({path:`/tmp/all-followed-${width}.png`});
      await page.locator('#closeSettingsBtn').click();
      await page.evaluate(async()=>{
        const chunk=await loadFollowDirectoryChunk('f1');await ensureAthleteProfileUi();
        await globalThis.NOTHINGSPORTS_ATHLETE_PROFILE_UI.open(chunk.records.find(record=>record.id==='competitor:f1:max-verstappen'),'f1');
      });
      await page.getByRole('heading',{name:'Other disciplines & experience'}).waitFor();
      assert(await page.locator('.athlete-profile-drawer').getByText(/Won NLS9/).count());
      await page.locator('.athlete-profile-close').click();
      const fixture={id:"qa-live-international",eventId:"qa-live-international",key:"rugby",name:"Live revision test",competitionScope:"international",date:"2026-09-08",time:"20:00",startTimeUtc:"2026-09-08T10:00:00Z",status:"scheduled"};
      snapshot={schemaVersion:"live-fixtures.v1",revision:"qa-one",sources:[{source_id:"qa",fixtures:[fixture]}]};
      await page.evaluate(()=>refreshLiveFixtureSnapshot());
      await page.locator('#listView [data-event-id="qa-live-international"]').waitFor({state:"attached"});
      await page.locator('#listView [data-event-id="qa-live-international"]').scrollIntoViewIfNeeded();
      const before=await page.locator('#listView [data-event-id="qa-live-international"]').evaluate(element=>element.getBoundingClientRect().top);
      snapshot={...snapshot,revision:"qa-two",sources:[{source_id:"qa",fixtures:[{...fixture,status:"postponed",scheduleStatus:"postponed"}]}]};
      await page.evaluate(()=>refreshLiveFixtureSnapshot());
      await page.waitForFunction(()=>liveFixtureRevision==="qa-two");
      assert.equal(await page.evaluate(()=>activeEvents.find(event=>event.id==="qa-live-international").scheduleStatus),"postponed");
      snapshot=null;await page.evaluate(()=>refreshLiveFixtureSnapshot());
      assert.equal(await page.locator('#listView [data-event-id="qa-live-international"]').count(),1,"failed live refresh retains the card");
      const after=await page.locator('#listView [data-event-id="qa-live-international"]').evaluate(element=>element.getBoundingClientRect().top);
      assert(Math.abs(after-before)<45,`live refresh preserves the reading anchor (${before} → ${after})`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);console.log(JSON.stringify({width,sourceFixtures:true,allFollowed:true,liveRevisions:true,retainedOnFailure:true,anchorShift:after-before,uncaughtErrors:errors}));
      await page.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
