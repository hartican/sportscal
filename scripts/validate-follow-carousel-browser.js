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
  await page.evaluate(()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.theme='night';next.followBrowse={sportId:'sport:cricket',categoryId:'sport:cricket',section:'teams-players'};savePreferences(next);});
  await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());
  await page.getByRole('button',{name:'Follow',exact:true}).first().click();
  const bar=page.locator('.follow-sport-bar');await bar.waitFor();
  assert.deepEqual(await bar.locator(':scope > .follow-sport-icon > span:last-child').allTextContents(),['AFL','NRL','Rugby Union','Football','Cricket','Tennis','More']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'fixed Follow navigation must not move the viewport sideways');
  const escaped=await page.locator('.follow-sport-mark .identity-image-placeholder').evaluateAll(nodes=>nodes.filter(n=>{const a=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return a.width>b.width+1||a.height>b.height+1;}).length);
  assert.equal(escaped,0,'sport placeholders must stay inside their icon boxes');
  await page.getByRole('button',{name:'More sports',exact:true}).click();
  const dialog=page.locator('.follow-more-dialog');await dialog.waitFor();
  const firstTwo=await dialog.locator('[data-follow-sport] > span:last-child').evaluateAll(nodes=>nodes.slice(0,2).map(node=>node.textContent));
  assert.deepEqual(firstTwo,['NFL','NBL']);
  await dialog.locator('[data-follow-sport="sport:nbl"]').click();
  await page.waitForFunction(()=>followBrowseState().sportId==='sport:nbl');
  assert.equal(await page.locator('.follow-section-panel').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  console.log('Follow navigation: fixed primary order, More ordering, NBL selection and viewport containment passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
