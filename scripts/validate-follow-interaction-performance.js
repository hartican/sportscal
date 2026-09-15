#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:[],selectedSelectorEntityIds:[]})));
 await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'Isolated Follow performance QA'}}));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:8896');
 await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:60000});
 await page.getByRole('button',{name:'Follow',exact:true}).first().click();
 await page.evaluate(()=>{saveFollowBrowse({sportId:'sport:ice-hockey',categoryId:'sport:ice-hockey',section:'teams-players'});renderFollowView();});
 await page.locator('.follow-directory-row').first().waitFor({timeout:30000});
 assert((await page.locator('.follow-directory-row').count())<=40,'Ice Hockey mounts a bounded first page');
 const result=await page.locator('.follow-directory-row').first().evaluate(async row=>{
   const button=row.querySelector('.football-follow-toggle'),before=button.textContent,start=performance.now();
   let rebuilds=0;const original=requestFeedRebuildAfterFollowChange;requestFeedRebuildAfterFollowChange=()=>{rebuilds++;return Promise.resolve(true);};
   button.click();const first={text:button.textContent,pressed:button.getAttribute('aria-pressed'),connected:row.isConnected,elapsed:performance.now()-start};
   button.click();await new Promise(resolve=>setTimeout(resolve,1500));requestFeedRebuildAfterFollowChange=original;
   return {...first,before,rebuilds,finalText:button.textContent};
 });
 assert.notEqual(result.text,result.before,'Follow state updates synchronously');
 assert.equal(result.pressed,'true');assert.equal(result.connected,true,'Follow patches the existing row');
 assert(result.elapsed<100,'Follow feedback stays within the interaction frame');
 assert.equal(result.rebuilds,1,'rapid changes coalesce into one background rebuild');
 assert.equal(result.finalText,result.before,'second tap restores the original state');
 const containment=await page.locator('.follow-directory-row').first().evaluate(row=>getComputedStyle(row).contentVisibility);
 assert.equal(containment,'auto');
 await page.evaluate(()=>{saveFollowBrowse({sportId:'sport:football',categoryId:'sport:football',section:'teams-players'});renderFollowView();});
 await page.locator('.football-club-row').first().waitFor({timeout:30000});
 const footballRows=await page.locator('.football-club-row').count();assert(footballRows<=40,'Football mounts a bounded first page');
 const footballPatch=await page.locator('.football-club-row').first().evaluate(row=>{const button=row.querySelector('.football-follow-toggle'),before=button.textContent;button.click();return{before,after:button.textContent,connected:row.isConnected};});
 assert.notEqual(footballPatch.after,footballPatch.before);assert.equal(footballPatch.connected,true,'Football Follow patches the existing row');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({iceHockeyRows:40,footballRows,...result,footballPatch,containment}));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
