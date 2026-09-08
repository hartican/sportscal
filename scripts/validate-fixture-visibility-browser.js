#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.QA_BASE_URL || "http://127.0.0.1:8765";

(async () => {
  const browser = await chromium.launch({headless:true});
  const evidence = [];
  let debugPage;
  try {
    for (const width of [390,1280]){
      const page = await browser.newPage({viewport:{width,height:844},serviceWorkers:"block"});
      debugPage = page;
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.clock.setFixedTime(new Date(Math.max(Date.parse('2026-09-08T00:00:00Z'),Date.parse(require('../feeds/provider-exports/tennis/us-open-2026-official-schedule.json').capturedAt)+1000)));
      await page.addInitScript(() => localStorage.setItem("ns_preferences_v1",JSON.stringify({
        onboardingComplete:true,followedSports:["f1","wrc","tennis"],selectedSelectorEntityIds:["sport:f1","sport:wrc","sport:tennis"],
        followBrowse:{sportId:"sport:motorsport",categoryId:"sport:f1",section:"teams-players",page:0},
      })));
      // Do not send fixture actions, analytics or account writes outside this isolated browser.
      await page.route("**/api/**", route => route.fulfill({status:503,json:{error:"Isolated local fixture QA"}}));
      await page.goto(base);
      await page.waitForFunction(() => typeof startupFunnelFinished !== "undefined" && startupFunnelFinished && !startupCoordinator.isHydrating());
      assert((await page.locator("body").innerText()).trim().length > 100, "the app must render meaningful content");
      await page.locator('.tab-btn[data-tab="feed"]').click();
      await page.locator('#listView [data-event-id="evt_27"]').waitFor({state:"attached"});
      await page.locator('#listView [data-event-id="evt_27"]').scrollIntoViewIfNeeded();
      await page.screenshot({path:`/tmp/fixture-feed-${width}.png`});
      const f1 = require("../data/code-inspector/f1.json");
      await page.route("**/data/code-inspector/f1.json",route=>route.fulfill({json:{...f1,fixtures:f1.fixtures.filter(fixture=>fixture.id === "evt_26").map(fixture=>({...fixture,status:"postponed",scheduleStatus:"postponed"}))}}));
      await page.evaluate(()=>loadFollowedScheduleFixtures());
      assert.equal(await page.locator('#listView [data-event-id="evt_27"]').count(),1,"a partial schedule refresh must retain the race exactly once");
      assert.equal(await page.evaluate(()=>activeEvents.find(event=>event.id === "evt_26").scheduleStatus),"postponed","an explicit schedule update must replace the retained status");
      await page.unroute("**/data/code-inspector/f1.json");
      await page.route("**/data/code-inspector/f1.json",route=>route.fulfill({status:503,json:{error:"source unavailable"}}));
      await page.evaluate(async()=>{await loadFollowedScheduleFixtures();await refreshRemoteFeed({quiet:true});});
      assert.equal(await page.locator('#listView [data-event-id="evt_27"]').count(),1,"source failure and public-page revalidation must not erase known followed fixtures");
      await page.unroute("**/data/code-inspector/f1.json");
      await page.locator('.tab-btn[data-tab="events"]').click();
      await page.locator('[data-major-event-id="major-event:us-open-2026"]').first().waitFor({state:"attached"});
      await page.locator('.tab-btn[data-tab="follow"]').click();
      await page.getByRole("button",{name:"Schedule",exact:true}).click();
      await page.locator('[data-inspector-fixture-id="evt_27"]').waitFor({state:"attached"});
      assert.equal(await page.locator('[data-inspector-fixture-id^="event:wrc"]').count(),0,"F1 Schedule must not display WRC rounds");
      await page.locator('.tab-btn[data-tab="feed"]').click();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const fallback = await page.evaluate(() => {
        const source = activeEvents.find(event => event.id === "evt_27");
        const host = document.createElement("section");
        host.id = "fixture-visibility-qa";
        // Keep the renderer fault fixture outside the list replaced by paging.
        document.getElementById("listView").before(host);
        const damaged = {...source,id:"qa-malformed-fixture",eventId:"qa-malformed-fixture",broadcastOptions:{bad:"optional format"},viewingOptions:{bad:"optional format"}};
        host.append(buildEventCard(damaged),buildEventCard({...source,id:"qa-neighbour",eventId:"qa-neighbour"}));
        return {ids:[...host.querySelectorAll(".event-card")].map(card => card.dataset.eventId),text:host.innerText,
          fallbackCount:host.querySelectorAll(".is-fixture-fallback").length};
      });
      assert.deepEqual(fallback.ids,["qa-malformed-fixture","qa-neighbour"],"a presentation failure must preserve both fixture cards");
      assert(/Italian (?:GP|Grand Prix)/i.test(fallback.text),"fallback must retain recognisable fixture information");
      assert.equal(fallback.fallbackCount,1,"malformed optional information must use the minimal card path");
      await page.locator('#fixture-visibility-qa .is-fixture-fallback').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{
        const rect=document.querySelector('#fixture-visibility-qa .is-fixture-fallback')?.getBoundingClientRect();
        return rect && rect.bottom>0 && rect.top<innerHeight;
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),false,"no horizontal overflow");
      assert.deepEqual(errors,[],"no uncaught browser errors");
      await page.screenshot({path:`/tmp/fixture-visibility-${width}.png`});
      evidence.push({width,coldFeed:true,partialRefresh:true,failedRefresh:true,usOpen:true,f1Schedule:true,fallback,uncaughtErrors:errors});
      await page.close();
    }
    console.log(JSON.stringify(evidence,null,2));
  } catch (error){
    if (debugPage && !debugPage.isClosed()){
      console.error("Browser failure state", (await debugPage.locator("body").innerText()).slice(0,1800));
      console.error("Feed failure diagnostics", await debugPage.evaluate(() => ({
        relevant:activeEvents.filter(event => event.key === "f1").map(event => ({id:event.id,date:event.date,name:event.name,follow:FOLLOW_FIRST.reasonForEvent(event,userPreferences)})),
        pageIndex:publicFeedNextPageIndex, preferences:userPreferences.followedSports,
      })));
      await debugPage.screenshot({path:"/tmp/fixture-visibility-failure.png"});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
