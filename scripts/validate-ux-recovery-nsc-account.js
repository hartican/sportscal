'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,feedCompact:true,followedSports:['nrl']})));
  await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:8887');
  await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
  // An account restore without opening a rated Feed card. No real account or writes.
  const reads=[];
  await page.route('**/api/nothingscore?**',async route=>{
   assert.equal(route.request().method(),'GET','No account writes');
   const options=Object.fromEntries(new URL(route.request().url()).searchParams);reads.push(options);
   await new Promise(resolve=>setTimeout(resolve,150));
   const payload=options.rankings?{entries:[],nextCursor:null}:options.leaderboard?{entries:[]}:{viewer:{signedIn:true,canContribute:true,profile:null},detail:null};
   await route.fulfill({json:payload});
  });
  await page.evaluate(()=>{serverPersistence.user={id:'qa-account'};nothingscoreViewer={signedIn:false};});
  await page.getByRole('button',{name:'Nothing Score rankings',exact:true}).click();
  await page.getByRole('button',{name:'My NSC',exact:true}).click();
  await page.waitForFunction(()=>nothingscoreViewer.signedIn===true,null,{timeout:3000});
  await page.getByText('Rating privately',{exact:true}).waitFor();
  assert.equal(await page.getByText('Checking this account…',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Back to fixture rankings',exact:true}).count(),0,'There is one Back path');
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'My NSC',exact:true}).waitFor();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.waitForFunction(()=>!document.body.classList.contains('nsc-open'));

  assert.equal(reads.filter(r=>r.eventId).length,1,'My NSC loads its account once');
  console.log(JSON.stringify({accountLoaded:true,singleBackPath:true,reads:reads.length}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
