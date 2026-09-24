#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true}),output=process.env.BJK_QA_OUTPUT_DIR||path.join(os.tmpdir(),'bjk-browser');fs.mkdirSync(output,{recursive:true});
 try{
  for(const width of [320,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:process.env.BJK_QA_WORKERS==='allow'?'allow':'block'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:tennis'],followedSports:['tennis'],showSpoilers:false,followFirst:{followedMajorEventIds:['billie-jean-king-cup']}})));
   await page.goto(process.env.BJK_QA_URL||'http://127.0.0.1:33960',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof userPreferences==='object'&&!startupCoordinator.isHydrating());
   await page.evaluate(async()=>{await loadTennisFeedParents();activeTab='feed';userPreferences.showSpoilers=false;renderAll();});
   const parent=page.locator('.tennis-feed-parent').filter({hasText:'Billie Jean King Cup'}).first();
   async function open(){await parent.locator('summary').first().click();await parent.locator('.tennis-contest-row').first().waitFor();}
   await open();assert.equal(await parent.locator('.tennis-contest-row').count(),7);
   await parent.locator('.tennis-tie-details summary').first().click();
   let text=await parent.innerText();assert(text.includes('Marie Bouzkova'));assert(!text.includes('7-6(2)'),'scores hidden');assert(!text.includes('Czechia v Spain'),'future advancement hidden');assert(text.includes('Not before 19:00'));
   await page.evaluate(()=>{userPreferences.showSpoilers=true;renderAll();});await open();
   await parent.locator('.tennis-tie-details summary').first().click();
   text=await parent.innerText();assert(text.includes('7-6(2) 4-6 6-4'));assert(text.includes('Czechia v Spain'));assert(text.includes('Shenzhen Bay Sports Centre Arena'));assert(text.includes('Nine / beIN Sports'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   await page.screenshot({path:path.join(output,`bjk-${width}.png`)});
   const row=parent.locator('.tennis-contest-row').first();await row.getByRole('button',{name:'Add to Feed',exact:true}).click();
   const state=await page.evaluate(()=>getEventAction({id:'fixture:tennis:bjk-cup:2026:finals:qf1',eventId:'fixture:tennis:bjk-cup:2026:finals:qf1'}));assert(state.addedToFixtures);assert(!state.reminderRequested);
   assert.deepEqual(errors,[]);console.log(`${width}px: seven ties, source detail, match results, spoilers, pin/no reminder and no overflow passed`);await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
