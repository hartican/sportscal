#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'}),page=await context.newPage();
  await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');
  await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
  await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.theme='night';next.followFirst.refinement.promptedAt=new Date().toISOString();next.followBrowse={sportId:'sport:cricket',categoryId:'sport:cricket',section:'teams-players',page:0};savePreferences(next);});
  await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());
  await page.getByRole('button',{name:'Follow',exact:true}).first().click();
  const track=page.locator('.follow-sport-track');await track.waitFor();
  const escaped=await page.locator('.follow-sport-mark .identity-image-placeholder').evaluateAll(nodes=>nodes.filter(n=>{const a=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return a.width>b.width+1||a.height>b.height+1;}).length);
  assert.equal(escaped,0,'sport placeholders must stay inside their icon boxes');
  await page.getByRole('button',{name:'Next sports',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.follow-sport-track').scrollLeft>100);
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Previous sports',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.follow-sport-track').scrollLeft<5);
  const cdp=await context.newCDPSession(page),box=await track.boundingBox();
  const start=box.x+box.width-15,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});
  for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start-i*18,y}]});await page.waitForTimeout(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>document.querySelector('.follow-sport-track').scrollLeft>80);
  await page.waitForTimeout(650);
  const visibleId=await track.evaluate(node=>{const box=node.getBoundingClientRect();return [...node.querySelectorAll('[data-follow-sport]')].find(button=>{const b=button.getBoundingClientRect();return b.left>=box.left&&b.right<=box.right;}).dataset.followSport;});
  await page.locator(`[data-follow-sport="${visibleId}"]`).tap();
  await page.waitForFunction(id=>followBrowseState().sportId===id,visibleId);
  assert.equal(await page.locator(`[data-follow-sport="${visibleId}"]`).getAttribute('aria-pressed'),'true');
  await page.locator('.follow-section-panel').waitFor();
  const pageNumber=await page.evaluate(()=>followBrowseState().page);
  await page.screenshot({path:'/private/tmp/follow-carousel-fixed.png'});
  await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());
  await page.getByRole('button',{name:'Follow',exact:true}).first().click();await track.waitFor();
  assert.equal(await page.evaluate(()=>followBrowseState().sportId),visibleId);
  assert.equal(await page.evaluate(()=>followBrowseState().page),pageNumber);
  // A missing logo takes the fallback path without becoming an input overlay.
  await page.evaluate(()=>document.querySelectorAll('.follow-sport-mark img').forEach(img=>img.dispatchEvent(new Event('error'))));
  const next=page.getByRole('button',{name:'Next sports',exact:true});if(await next.isEnabled())await next.click();else await page.getByRole('button',{name:'Previous sports',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  console.log('Follow carousel: arrows, native touch swipe, sport selection, saved page and failed-image fallback passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
