#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});const checks=[];
 try{
  const context=await browser.newContext({viewport:{width:320,height:844},serviceWorkers:'block'}),page=await context.newPage();
  let failDirectory=true;
  await page.route('**/data/follow-directory/f1.v1.*',route=>failDirectory?route.fulfill({status:503,body:'Directory unavailable'}):route.continue());
  await page.route('**/api/nothingscore*',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Temporarily unavailable"}'}));
  await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');
  await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
  await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.selectedSelectorEntityIds=['sport:f1','sport:afl-premiership','sport:nrl-premiership','sport:tennis'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);savePreferences(next);sessionStorage.setItem('ns_chat_draft_v2:repair-test',JSON.stringify({body:'Retain this unsent draft'}));});
  await page.reload();await page.waitForFunction(()=>document.querySelector('.event-card'));
  await page.getByRole('button',{name:'Follow',exact:true}).first().click();
  await page.evaluate(()=>{saveFollowBrowse({sportId:'sport:motorsport',categoryId:'sport:f1',section:'teams-players'});renderFollowView();});
  await page.getByText('F1 teams and players are temporarily unavailable.',{exact:false}).waitFor({timeout:30000});
  assert(await page.getByRole('button',{name:'Feed',exact:true}).isEnabled(),'Feed remains independently navigable');
  failDirectory=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.waitForFunction(()=>followDirectoryChunks.has('f1')&&document.querySelector('.football-directory'));
  checks.push('Failed directory exposes retry; retry restores Follow while optional ratings fail');
  await page.getByRole('button',{name:'Feed',exact:true}).first().click();
  await page.waitForFunction(()=>document.querySelector('.event-card'));
  const chatGeometry=await page.evaluate(()=>{chatState.isAdmin=true;const ev=activeEvents.find(e=>getEventStatus(e)==='upcoming'&&chatFixtureEligible(e)&&FOLLOW_FIRST.viewingLink(e,userPreferences.followFirst?.subscriptions||[]));const holder=document.createElement('div');holder.className='event-card';holder.style.width='286px';document.body.appendChild(holder);const row=appendEventQuickActions(holder,ev);const boxes=[...row.children].map(e=>({name:e.textContent,top:e.getBoundingClientRect().top,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,height:e.getBoundingClientRect().height}));const outer=holder.getBoundingClientRect();holder.remove();chatState.isAdmin=false;return{boxes,left:outer.left,right:outer.right};});
  assert(chatGeometry.boxes.some(b=>b.name==='Chat'),'exercise actual admin Chat control');
  assert(Math.max(...chatGeometry.boxes.map(b=>b.top))-Math.min(...chatGeometry.boxes.map(b=>b.top))<8,'Watch Remind Chat share a line');
  assert(chatGeometry.boxes.every(b=>b.height>=44&&b.left>=chatGeometry.left&&b.right<=chatGeometry.right),'three controls fit 320px with accessible targets');
  checks.push('Actual Watch, Remind and Chat controls fit a 320px card');
  const count=await page.locator('[data-feed-event-id]').count();
  for(let i=0;i<count;i+=15){await page.locator('[data-feed-event-id]').nth(i).scrollIntoViewIfNeeded();await page.waitForTimeout(180);assert(await page.locator('.feed-card-slot .event-card').count()<=60,'long scroll caps mounted cards');}
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ns_chat_draft_v2:repair-test')).body),'Retain this unsent draft');
  checks.push('Long scrolling caps mounted cards at 60 and preserves an unsent chat draft');
  console.log(JSON.stringify({checks},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
