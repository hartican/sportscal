#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");

(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||"chrome"});
 try{
  const page=await browser.newPage({viewport:{width:390,height:900},serviceWorkers:"block"});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.addInitScript(()=>{
   localStorage.setItem("ns_preferences_v1",JSON.stringify({onboardingComplete:true,followedSports:["f1","nbl","afl","nrl"],selectedSelectorEntityIds:["sport:f1","sport:nbl","sport:afl-premiership","sport:nrl-premiership"],followBrowse:{sportId:"sport:nbl",section:"teams-players"}}));
   localStorage.setItem("ns_auth_persistent_session_v1",JSON.stringify({accessToken:"qa."+btoa(JSON.stringify({sub:"qa-user"}))+".test",refreshToken:"qa-refresh",expiresAt:Date.now()+3600000}));
  });
  await page.route("**/api/**",route=>{
   const url=new URL(route.request().url());
   if(url.pathname==="/api/nothingscore"&&url.searchParams.has("ratingAffinity"))return route.fulfill({json:{windowDays:90,sports:[{sportId:"sport:motorsport",count:10,lastInteractedAt:"2026-09-16T00:00:00Z"},{sportId:"sport:nbl",count:5,lastInteractedAt:"2026-09-15T00:00:00Z"}]}});
   return route.fulfill({status:503,json:{error:"Isolated local QA"}});
  });
  await page.goto(process.env.QA_BASE_URL||"http://127.0.0.1:8896");
  await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:60000});
  await page.getByRole("button",{name:"Follow",exact:true}).click();
  await page.locator(".follow-sport-bar").waitFor();
  assert.deepEqual(await page.locator(".follow-sport-bar > button").allTextContents(),["Motorsport","NBL","AFL","NRL","⋯More"],"ratings rank only the four followed sports before More");
  await page.locator(".follow-directory-tabs").waitFor({timeout:10000});
  assert.deepEqual(await page.locator(".follow-directory-tabs button").allTextContents(),["Teams","Players"]);
  assert.equal(await page.locator(".follow-directory-tabs button[aria-pressed=true]").textContent(),"Teams");
  assert.equal(await page.locator(".follow-directory-row").count(),10,"NBL Teams are distinct from players");
  await page.getByRole("button",{name:"Players",exact:true}).click();
  assert.equal(await page.locator(".follow-directory-tabs button[aria-pressed=true]").textContent(),"Players");
  assert.equal(await page.locator(".follow-directory-row").count(),22,"NBL Players have their own list");
  assert.deepEqual(errors,[]);
  console.log("Adaptive Follow grid browser ranking and NBL Teams/Players views passed.");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
