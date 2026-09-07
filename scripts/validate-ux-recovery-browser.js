'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8887';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.clock.setFixedTime(new Date('2026-09-07T02:30:00Z'));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,feedCompact:true,followedSports:['afl','nrl','nrlw'],selectedSelectorEntityIds:['sport:afl-premiership','sport:nrl'],followFirst:{collectionFollows:['collection:tennis:mens-top-10']},followBrowse:{sportId:'sport:tennis',categoryId:'',section:'teams-players',page:2}})));
 await page.addInitScript(()=>{window.__qaNavTime=performance.now();const visible=()=>{const card=document.querySelector('.event-card'),launch=document.getElementById('startupLaunch');if(card&&card.getBoundingClientRect().height>0&&(!launch||launch.hidden)){requestAnimationFrame(()=>{window.__firstVisibleCardMs=performance.now();});}else requestAnimationFrame(visible);};requestAnimationFrame(visible);});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>typeof startupFunnelFinished!=='undefined'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 await page.waitForTimeout(500);
 const snapshot=()=>page.evaluate(()=>({ids:[...document.querySelectorAll('.event-card')].map(c=>c.dataset.eventId).sort(),startup:feedPerformanceMetrics.startupCompleteMs-window.__qaNavTime,firstCard:feedPerformanceMetrics.firstCardRenderedMs-window.__qaNavTime,firstVisibleCard:window.__firstVisibleCardMs-window.__qaNavTime,active:activeEvents.length,majorLoaded:Boolean(majorEventsDocument),directories:[...followDirectoryChunks.keys()]}));
 const cold=await snapshot();
 const clipped=await page.locator('.compact-card-time').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.textContent));
 await page.getByRole('button',{name:'Follow',exact:true}).click();
 await page.locator('.follow-section-tabs').getByRole('button',{name:'Teams & players',exact:true}).waitFor();
 await page.waitForTimeout(600);
 const directory=await page.locator('#listView').evaluate(c=>({elements:c.querySelectorAll('*').length,images:c.querySelectorAll('img').length}));
 const track=await page.locator('.follow-sport-track').elementHandle();
 await page.getByRole('button',{name:'Major Events',exact:true}).click();
 const retained=await track.evaluate(n=>n.isConnected);
 await page.getByRole('button',{name:'Feed',exact:true}).click();await page.waitForTimeout(600);
 const navigated=await snapshot();
 await page.reload();await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());await page.waitForTimeout(500);
 const reloaded=await snapshot();
 console.log(JSON.stringify({cold:{...cold,ids:cold.ids.length},navigated:{...navigated,ids:navigated.ids.length},reloaded:{...reloaded,ids:reloaded.ids.length},clipped,directory,retained,errors},null,2));
 const failures=[];
 if(JSON.stringify(cold.ids)!==JSON.stringify(navigated.ids)||JSON.stringify(cold.ids)!==JSON.stringify(reloaded.ids))failures.push('Feed membership depends on visiting Follow');
 if(cold.startup-cold.firstCard>1000)failures.push('Usable Feed is blocked after first card renders');
 if(clipped.length)failures.push('Compact clips start times');
 if(!retained)failures.push('Follow destroys its sport track');
 assert.deepEqual(failures,[]);
 assert(directory.elements<1000,'The initial directory must be bounded');
 // Real pointer input on a published fixture. Samples record the first animation
 // frame with new state and a second frame after the browser can paint it.
 await page.evaluate(()=>{
  window.__uxFrames=[];window.__uxPointers=[];
  document.addEventListener('pointerdown',event=>{
   const card=event.target.closest('.event-card'),toggle=event.target.closest('.feed-compact-toggle');
   if(!card&&!toggle)return;
   window.__uxPointers.push({id:card?.dataset.eventId,level:card?.dataset.cardLevel,target:event.target.className});
   const begin=performance.now(),before=card?.dataset.cardLevel,top=card?.getBoundingClientRect().top,beforeLabel=toggle?.textContent;
   const sample=()=>{
    if(performance.now()-begin>3000)return;
    const changed=card?card.dataset.cardLevel!==before:toggle.textContent!==beforeLabel;
    if(changed)requestAnimationFrame(()=>window.__uxFrames.push({kind:card?'card':'toggle',elapsed:performance.now()-begin,top,after:card?.getBoundingClientRect().top,level:card?.dataset.cardLevel}));
    else requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
  },true);
 });
 const publishedId=await page.evaluate(()=>activeEvents.find(e=>/Wests Tigers/.test(e.name))?.eventId);
 assert(publishedId,'Published Wests Tigers fixture must be present');
 const published=page.locator(`.event-card[data-event-id="${publishedId}"]`).first();
 await published.scrollIntoViewIfNeeded();
 const moves=[];
 for(let i=0;i<12;i++){
  const box=await published.boundingBox();
  // Click the card's content area, away from dismiss, disclosure and actions.
  const content=published.locator('.compact-card-name,.event-name').first();
  await content.click();
  await page.waitForTimeout(160);
  const next=await published.boundingBox();moves.push(Math.abs(next.y-box.y));
 }
 const frames=await page.evaluate(()=>window.__uxFrames);
 if(frames.length!==12)console.log('Pointer trace',await page.evaluate(()=>({pointers:window.__uxPointers,frames:window.__uxFrames,selection:getSelection().toString()})),await published.getAttribute('data-card-level'));
 assert.equal(frames.length,12,'Every real pointer click must change the card');
 assert(Math.max(...moves)<=2,`Card anchors moved: ${moves}`);
 assert(Math.max(...frames.map(s=>s.elapsed))<=100,`Visible response exceeded 100ms: ${JSON.stringify(frames)}`);
 for(let i=0;i<100;i++){
  const toggle=page.locator('.feed-compact-toggle');
  await toggle.click();
  await page.waitForTimeout(100);
  const state=await page.evaluate(()=>({compact:userPreferences.feedCompact,levels:[...document.querySelectorAll('.event-card')].map(c=>c.dataset.cardLevel)}));
  assert(state.levels.every(level=>level===(state.compact?'L0':'L1')),'Compact/Expand mixed card levels');
 }
 const toggleFrames=await page.evaluate(()=>window.__uxFrames.filter(frame=>frame.kind==='toggle'));
 assert.equal(toggleFrames.length,100);assert(Math.max(...toggleFrames.map(frame=>frame.elapsed))<=100,`Toggle paint opportunity exceeded 100ms: ${Math.max(...toggleFrames.map(frame=>frame.elapsed))}`);
 await page.getByRole('button',{name:'Expand',exact:true}).click();await page.waitForTimeout(200);
 await published.evaluate(node=>window.scrollTo({top:scrollY+node.getBoundingClientRect().top-stickyFeedChromeHeight()-20,behavior:'instant'}));await page.waitForTimeout(200);
 const anchor=()=>published.evaluate(node=>node.getBoundingClientRect().top);
 const lateMoves=[];
 // Real pointer movement must select/scroll without expanding the card.
 const content=published.locator('.event-name').first(),box=await content.boundingBox(),level=await published.getAttribute('data-card-level');
 await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();await page.mouse.move(box.x+40,box.y+5,{steps:5});await page.mouse.up();assert.equal(await published.getAttribute('data-card-level'),level);await page.evaluate(()=>getSelection().removeAllRanges());
 // Delay the actual identity asset above the reading anchor, preserving its URL.
 await page.route('**/*ux-delayed-logo=*',async route=>{await new Promise(resolve=>setTimeout(resolve,200));await route.continue();});
 const image=page.locator('.event-card img').first();const beforeImage=await anchor();
 await image.evaluate(async image=>{image.loading='eager';const url=new URL(image.currentSrc||image.src);url.searchParams.set('ux-delayed-logo','1');image.src=url.href;await image.decode();});await page.waitForTimeout(150);lateMoves.push(Math.abs(await anchor()-beforeImage));
 // Load the real public NSC response after a delay; never submit a contribution.
 const payload=await (await page.request.get('https://nothingsport.vercel.app/api/nothingscore?ids='+encodeURIComponent(publishedId))).json();assert(payload.snapshots?.length,'The delayed response must contain the published fixture');
 await page.route('**/api/nothingscore?**',async route=>{await new Promise(resolve=>setTimeout(resolve,200));await route.fulfill({json:payload});});
 const beforeNsc=await anchor();await page.evaluate(id=>loadNothingscoreBatch([id]),publishedId);await page.waitForTimeout(250);lateMoves.push(Math.abs(await anchor()-beforeNsc));
 const beforeClock=await anchor();await page.clock.setFixedTime(new Date('2026-09-07T02:31:00Z'));await page.evaluate(()=>{refreshFeedClock();window.dispatchEvent(new Event('focus'));});await page.waitForTimeout(200);lateMoves.push(Math.abs(await anchor()-beforeClock));
 assert(Math.max(...lateMoves)<=2,`Delayed content or clock moved the reading anchor: ${lateMoves}`);
 await page.screenshot({path:'/tmp/ux-recovery-feed-standard.png'});await page.unrouteAll({behavior:'wait'});
 console.log(JSON.stringify({cardFrames:frames,maximumAnchorMovement:Math.max(...moves),spacedToggles:100,maximumTogglePaintMs:Math.max(...toggleFrames.map(frame=>frame.elapsed)),delayedImageNscClockAnchorMoves:lateMoves}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
