'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33978';
(async()=>{const browser=await (process.env.QA_BROWSER==='webkit'?webkit:chromium).launch(process.env.QA_BROWSER==='webkit'?{}:{channel:'chrome'});const failures=[];try{
const page=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block'});let mode='ok',calls=0;
await page.route('**/api/**',async r=>{
 const u=new URL(r.request().url());if(u.pathname==='/api/nothingscore'&&u.searchParams.has('ids')){
  calls++;if(mode==='stall'){await new Promise(resolve=>setTimeout(resolve,9500));return r.fulfill({status:503,json:{}}).catch(()=>{});}if(mode==='error')return r.fulfill({status:503,json:{error:'Unavailable'}});
  if(mode==='empty')return r.fulfill({json:{snapshots:[]}});
  return r.fulfill({json:{snapshots:u.searchParams.get('ids').split(',').map(eventId=>({eventId,phase:mode==='live'?'pulse':'heat',ratingRequired:mode!=='live',peerResults:mode==='live'?{count:0,average:null}:null,currentUser:{submissions:{},...(mode==='live'?{contribution:{rating:4}}:{})}})),viewer:{signedIn:true}}});
 }return r.fulfill({status:503,json:{}});
});
await page.goto(base);await page.waitForFunction(()=>typeof composeFeedCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
await page.evaluate(()=>{document.getElementById('startupLaunch')?.remove();document.querySelectorAll('.modal-backdrop').forEach(n=>n.classList.remove('show'));activeTab='feed';activeView='list';sessionStorage.setItem('ns_auth_session_v1',JSON.stringify({accessToken:'test.'+btoa(JSON.stringify({sub:'qa-rating-owner'}))+'.test',refreshToken:'test',expiresAt:Date.now()+3600000}));serverPersistence.user={id:'qa-rating-owner'};});
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures.push(name+': '+e.message);}}
await page.evaluate(async()=>{const d=await(await fetch('data/events.json')).json();window.recoveryEvent=d.events.find(e=>e.key==='nrl'&&e.date==='2026-09-25');setCardState(recoveryEvent,'selected');const list=document.getElementById('listView');list.replaceChildren(buildEventCard(recoveryEvent));});
await page.waitForFunction(()=>nothingscoreSnapshots.has(nothingscoreEventId(recoveryEvent)));
await check('successful sealed summary settles without a loading label',async()=>{await page.waitForTimeout(100);assert(!/Ratings loading|Checking your rating/.test(await page.locator('#listView').innerText()));});
for(const width of [320,390,768,1280])for(const theme of ['night','day']){
 await page.setViewportSize({width,height:1000});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
 await check(`${width}/${theme} logo remains inside frame before/after decoding`,async()=>{
  const bounds=await page.evaluate(async()=>{const imgs=[...document.querySelectorAll('#listView .matchup-team-logo')];for(const img of imgs){img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="133" height="139"><rect width="133" height="139" fill="red"/></svg>');await img.decode();finalizeLoadedIdentityImage(img);}return imgs.map(img=>({img:img.getBoundingClientRect().toJSON(),frame:img.parentElement.getBoundingClientRect().toJSON()}));});
  assert(bounds.length===2);for(const {img,frame}of bounds)assert(img.bottom<=frame.bottom+.5&&img.top>=frame.top-.5&&img.left>=frame.left-.5&&img.right<=frame.right+.5,JSON.stringify({img,frame}));
 });
}
mode='error';await page.evaluate(()=>{nothingscoreSnapshots.clear();nothingscoreLoadedAt.clear();nothingscoreLoadErrors.clear();registerNothingscoreEvent(recoveryEvent,{force:true});});await page.waitForFunction(()=>nothingscoreLoadErrors.has(nothingscoreEventId(recoveryEvent)));await page.waitForTimeout(100);
await check('failed signed-in read settles and offers retry',async()=>{const text=await page.locator('#listView').innerText();assert(!text.includes('Checking your rating'));assert(await page.locator('#listView .nsc-rating-retry').count());});
mode='ok';if(await page.locator('#listView .nsc-rating-retry').count()){await page.locator('#listView .nsc-rating-retry').click();await page.waitForFunction(()=>nothingscoreSnapshots.has(nothingscoreEventId(recoveryEvent)));await check('retry restores enabled flames',async()=>{await page.waitForFunction(()=>document.querySelectorAll('#listView .nsc-rating-block:disabled').length===0);assert.equal(await page.locator('#listView .nsc-rating-block').count(),5);});}
mode='empty';await page.evaluate(()=>{nothingscoreSnapshots.clear();nothingscoreLoadedAt.clear();nothingscoreLoadErrors.clear();registerNothingscoreEvent(recoveryEvent,{force:true});});await page.waitForFunction(()=>nothingscoreLoadErrors.has(nothingscoreEventId(recoveryEvent)));await check('omitted fixture offers retry without inventing zero ratings',async()=>{await page.locator('#listView .nsc-rating-retry').waitFor();assert(!(await page.locator('#listView').innerText()).includes('Be the first'));});
mode='live';await page.locator('#listView .nsc-rating-retry').click();await page.waitForFunction(()=>document.querySelectorAll('#listView .nsc-rating-block.is-filled').length===4);
await check('live zero-count snapshot settles and restores saved vote',async()=>{assert((await page.locator('#listView').innerText()).includes('Be the first to rate'));assert.equal(await page.locator('#listView .nsc-rating-block.is-filled').count(),4);});
mode='error';await page.evaluate(()=>{registerNothingscoreEvent(recoveryEvent,{force:true});});await page.waitForFunction(()=>nothingscoreLoadErrors.has(nothingscoreEventId(recoveryEvent)));await check('refresh failure retains the saved live vote',async()=>assert.equal(await page.locator('#listView .nsc-rating-block.is-filled').count(),4));
mode='stall';const stalledAt=Date.now();await page.evaluate(()=>{nothingscoreSnapshots.clear();nothingscoreLoadedAt.clear();nothingscoreLoadErrors.clear();registerNothingscoreEvent(recoveryEvent,{force:true});});
await page.waitForFunction(()=>nothingscoreLoadErrors.has(nothingscoreEventId(recoveryEvent)),null,{timeout:10000});
await check('stalled summary reaches retry by eight seconds',async()=>{assert(Date.now()-stalledAt<9500);await page.locator('#listView .nsc-rating-retry').waitFor();});
await check('sourced ODI providers resolve',async()=>{const providers=await page.evaluate(async()=>{const doc=await(await fetch('data/follow-schedule/cricket.json')).json();return FOLLOW_FIRST.viewingOptions(doc.fixtures.find(e=>e.id==='fixture:cricket:CA:39987')).map(p=>p.providerId);});assert.deepEqual(providers,['kayo','foxtel']);});
console.log({calls});if(failures.length)throw Error(failures.join('\n'));
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
