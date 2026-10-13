'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const reference='2026-10-13T00:26:33Z',fixtures=[
 require('../data/follow-schedule/cricket.json').fixtures.find(f=>f.sourceEventIds?.includes('fixture:cricket:CA:39990')),
 require('../data/follow-schedule/tennis.json').fixtures.find(f=>f.id==='fixture:tennis:espn:wta:184356'),
];
assert(fixtures.every(Boolean),'Actual published Cricket and Tennis fixtures must exist');
function serve(){
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}
async function prepare(page,base){
 const held=[];
 await page.clock.install({time:new Date(reference)});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Controlled local validation: external API disabled'}}));
 await page.route('**/api/nothingscore**',async route=>{
  const request=route.request(),url=new URL(request.url()),ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean),eventId=url.searchParams.get('eventId'),body=request.method()==='POST'?request.postDataJSON():null;
  const result=await page.evaluate(({ids,eventId,body})=>{
   if(!window.ratingsQa)return{mode:'empty',payload:{snapshots:[]}};
   if(body){ratingsQa.writes.push({...body,at:Date.now()});if(ratingsQa.mode!=='post-failure')return{mode:'unexpected-write'};ratingsQa.saved=body.rating;return{mode:'healthy',payload:{...body,submitted:true,pointsAwarded:0}};}
   if(ids.length)ratingsQa.reads.push({ids,at:Date.now()});
   if(ratingsQa.mode==='held'&&ids.length){ratingsQa.held.push({ids});return{mode:'held'};}
   if(eventId&&ratingsQa.mode==='post-failure')return{mode:'failed-detail'};
   return{mode:ratingsQa.mode,payload:['healthy','post-failure'].includes(ratingsQa.mode)?{snapshots:ids.map(id=>ratingsSnapshot(id)),...(eventId?{detail:ratingsSnapshot(eventId)}:{})}:{snapshots:[]}};
  },{ids,eventId,body});
  if(result.mode==='held'){held.push({route,ids});return;}
  if(['failed-detail','unexpected-write'].includes(result.mode))return route.fulfill({status:503,json:{error:'Controlled local ratings failure'}});
  return route.fulfill({json:result.payload});
 });
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:27,onboardingComplete:true,showSpoilers:false,feedCompact:false,followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}})));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 await page.evaluate(()=>{document.getElementById('startupLaunch')?.remove();document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelectorAll('.modal-backdrop').forEach(n=>n.classList.remove('show'));document.body.classList.remove('modal-open','settings-open');});
 await page.addStyleTag({content:'*{animation:none!important;transition:none!important}'});
 await page.clock.pauseAt(new Date(Date.parse(reference)+60_000));
 await page.evaluate(({fixtures,reference})=>{
  window.ratingsQa={fixtures,reference,reads:[],writes:[],mode:'empty',held:[],saved:4,failureAt:{}};
  serverSyncClient.clearSession();localStorage.setItem(NOTHINGSPORTS_SERVER_SYNC.PERSISTENT_SESSION_STORAGE_KEY,JSON.stringify({accessToken:'qa.'+btoa(JSON.stringify({sub:'qa-local-ratings-owner'}))+'.test',refreshToken:'local-only',expiresAt:Date.now()+86400000}));serverPersistence.user={id:'qa-local-ratings-owner'};
  window.ratingsSnapshot=(id,count=7)=>({eventId:id,phase:'pulse',ratingRequired:false,peerResults:{phase:'pulse',count,average:count?4.2:null,rawAverage:count?4.2:null},currentUser:{contribution:{rating:ratingsQa.saved},submissions:{pulse:{rating:ratingsQa.saved,submitted:true}}}});
  // The wait begins when the read fails, after its HTTP response settles.
  // Request start can precede that by a browser clock tick under load.
  const failure=nothingscoreReadRecovery.failure;
  nothingscoreReadRecovery.failure=function(id){ratingsQa.failureAt[id]=Date.now();return failure.call(this,id);};
  nowAEST=()=>new Date(reference);
 },{fixtures,reference});
 return {async releaseHeld(count=null){for(const item of held.splice(0)){const snapshots=count===null?[]:await page.evaluate(({ids,count})=>ids.map(id=>ratingsSnapshot(id,count)),{ids:item.ids,count});await item.route.fulfill({json:{snapshots}}).catch(()=>{});}await page.evaluate(()=>{ratingsQa.held=[];});}};
}
async function mount(page,{theme='day',retained=true}={}){
 await page.evaluate(({theme,retained})=>{
  window.clearTimeout(nothingscoreBatchTimer);nothingscoreBatchTimer=null;window.clearTimeout(nothingscorePollTimer);nothingscorePollTimer=null;
  ++nothingscoreReadGeneration;nothingscoreReadRecovery.reset();nothingscoreLoadErrors.clear();nothingscoreLoadedAt.clear();nothingscorePendingIds.clear();nothingscoreBatchInFlight.clear();nothingscoreSnapshots.clear();
  ratingsQa.reads=[];ratingsQa.writes=[];ratingsQa.held=[];ratingsQa.failureAt={};ratingsQa.mode='empty';ratingsQa.saved=4;applyThemePreference(theme);userPreferences.feedCompact=false;userPreferences.showSpoilers=false;activeTab='feed';activeView='list';activeInspectorCodeId=null;
  activeEvents=ratingsQa.fixtures;feedCardSlots.clear();previousFeedClockKey=feedClockKey();
  const list=document.getElementById('listView');list.style.display='block';list.replaceChildren();document.querySelectorAll('main>section').forEach(n=>{if(n!==list)n.style.display='none';});
  ratingsQa.fixtures.forEach((event,i)=>{const id=nothingscoreEventId(event);if(i===1&&retained)nothingscoreSnapshots.set(id,ratingsSnapshot(id));setCardState(event,'selected');const card=buildEventCard(event);card.dataset.ratingsQa=String(i);list.append(card);});
  syncNothingscoreReadRecovery();
 },{theme,retained});
 await page.clock.runFor(100);
 await page.waitForFunction(()=>ratingsQa.fixtures.every(e=>nothingscoreLoadErrors.has(nothingscoreEventId(e)))&&nothingscoreBatchInFlight.size===0);
 await page.clock.runFor(50);
}
async function observed(page){return page.locator('[data-ratings-qa]').evaluateAll(cards=>cards.map(card=>{
 const buttons=[...card.querySelectorAll('.nsc-rating-retry')],button=buttons[0],host=button?.parentElement,rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};},a=button&&rect(button),b=host&&rect(host);
 return{case:card.dataset.ratingsQa,buttons:buttons.length,button:a,host:b,centreOffset:a&&b?Math.abs(a.x+a.width/2-b.x-b.width/2):null,text:card.querySelector('.nsc-peer-summary')?.textContent,filled:card.querySelectorAll('.nsc-rating-block.is-filled').length,selected:card.querySelectorAll('.nsc-rating-block.is-selected').length,disabled:button?.disabled};
}));}
async function due(page,expectedReads,wait){
 const info=await page.evaluate(()=>({now:Date.now(),next:Math.min(...ratingsQa.fixtures.map(e=>nothingscoreReadRecoveryState(e).nextRetryAt)),failedAt:ratingsQa.failureAt[nothingscoreEventId(ratingsQa.fixtures[0])]}));
 assert(Number.isFinite(info.failedAt),'actual failure callback timestamp is observed');
 assert.equal(info.next-info.failedAt,wait,'successive delay from the failed read');
 await page.clock.runFor(info.next-info.now-1);assert.equal(await page.evaluate(()=>ratingsQa.reads.length),expectedReads-1,'no retry before its deadline');
 await page.clock.runFor(1);await page.waitForFunction(n=>ratingsQa.reads.length===n,expectedReads);await page.clock.runFor(50);await page.waitForFunction(()=>nothingscoreBatchInFlight.size===0);
}
async function run(){
 const output=process.env.QA_SCREENSHOT_DIR||'/Users/jackhartican/Documents/AI/Codex/compact-cards-ratings-2026-10-13';fs.mkdirSync(output,{recursive:true});
 const server=await serve(),base=process.env.QA_BASE_URL||'http://127.0.0.1:'+server.address().port,results=[];
 try{for(const engine of (process.env.QA_BROWSER?[process.env.QA_BROWSER]:['chromium','webkit'])){
  const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{const page=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block',timezoneId:'Australia/Sydney',locale:'en-AU'}),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));const transport=await prepare(page,base);
   for(const width of [320,390,1280])for(const theme of ['day','night']){
    await page.setViewportSize({width,height:1000});await mount(page,{theme});const cards=await observed(page);
    fs.writeFileSync(path.join(output,`ratings-observed-${engine}-${width}-${theme}.json`),JSON.stringify({engine,width,theme,cards},null,2));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,`ratings-${engine}-${width}-${theme}.png`),fullPage:true});
    assert.equal(cards.length,2);for(const card of cards){assert.equal(card.buttons,1,'one retry control per actual card');assert(card.centreOffset<1,'retry is horizontally centred: '+JSON.stringify(card));assert(card.button.height>=44&&card.button.width>=44,'retry target is at least44px');assert(!card.text.includes('Be the first'),'failed reads cannot assert an empty community');assert(!card.disabled,'settled failure permits immediate manual retry');}
    assert.match(cards[0].text,/unavailable/);assert.match(cards[1].text,/7 Nothingers.*4\.2\/5.*Saved ratings/);assert.equal(cards[1].filled,4,'saved vote survives failed read');assert.equal(cards[1].selected,1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
    results.push({engine,width,theme,cards});console.log(`${engine}/${width}/${theme}: actual empty and retained cards, one centred44px retry target, last-good totals/vote passed`);
   }
   await mount(page);for(const [reads,wait]of [[2,30_000],[3,60_000],[4,120_000]])await due(page,reads,wait);
   const exhausted=await page.evaluate(()=>ratingsQa.fixtures.map(e=>nothingscoreReadRecoveryState(e)));assert(exhausted.every(s=>s.exhausted&&s.nextRetryAt===null));await page.clock.runFor(600_000);assert.equal(await page.evaluate(()=>ratingsQa.reads.length),4,'exhaustion makes no later timed reads');
   await page.evaluate(()=>{ratingsQa.mode='held';});await page.locator('[data-ratings-qa="0"] .nsc-rating-retry').click();await page.clock.runFor(50);assert.equal(await page.evaluate(()=>ratingsQa.reads.length),5,'manual retry is immediate');assert(await page.locator('[data-ratings-qa="0"] .nsc-rating-retry').isDisabled());assert.equal(await page.evaluate(()=>retryNothingscoreRatings(ratingsQa.fixtures[0])),false,'a rapid second manual retry coalesces');assert.equal(await page.evaluate(()=>ratingsQa.reads.length),5);
   await page.evaluate(()=>{ratingsQa.mode='empty';});await transport.releaseHeld();await page.clock.runFor(50);await page.waitForFunction(()=>nothingscoreBatchInFlight.size===0);const fresh=await page.evaluate(()=>nothingscoreReadRecoveryState(ratingsQa.fixtures[0]));assert.equal(fresh.attempts,0);assert(fresh.nextRetryAt!==null,'failed manual retry starts a fresh cycle');
   await mount(page);await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(300_000);assert.equal(await page.evaluate(()=>ratingsQa.reads.length),1,'hidden view pauses recovery');await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(50);assert.equal(await page.evaluate(()=>ratingsQa.reads.length),2,'foreground resumes one due batch');assert.equal(await page.evaluate(()=>ratingsQa.reads.at(-1).ids.length),2);
   await mount(page);await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));});await page.clock.runFor(300_000);assert.equal(await page.evaluate(()=>ratingsQa.reads.length),1,'offline view pauses recovery');await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));});await page.clock.runFor(50);assert.equal(await page.evaluate(()=>ratingsQa.reads.length),2,'online resumes one due batch');
   await mount(page);await page.evaluate(()=>{document.getElementById('listView').replaceChildren();syncNothingscoreReadRecovery();});await page.clock.runFor(300_000);assert.equal(await page.evaluate(()=>ratingsQa.reads.length),1,'unmounted cards do not retry');
   await mount(page);await page.evaluate(()=>{ratingsQa.mode='held';retryNothingscoreRatings(ratingsQa.fixtures[0]);});await page.waitForFunction(()=>ratingsQa.held.length===1);await page.evaluate(()=>{const old=serverPersistence.user.id;serverPersistence.user={id:'qa-new-local-owner'};syncNothingscoreSessionState(old,serverPersistence.user.id);});await transport.releaseHeld(99);await page.clock.runFor(100);assert(!(await page.locator('#listView').innerText()).includes('99 Nothingers'),'old-account response cannot become a new-account card');await transport.releaseHeld();
   await mount(page);await page.evaluate(()=>{ratingsQa.mode='post-failure';ratingsQa.fixtures.forEach(e=>{const id=nothingscoreEventId(e);nothingscoreReadRecovered(id);mergeNothingscoreSnapshot(ratingsSnapshot(id));});nothingscoreQueueRender();});await page.clock.runFor(50);
   await page.locator('[data-ratings-qa="0"]').getByRole('button',{name:'3 out of 5: High stakes',exact:true}).click();await page.clock.runFor(50);await page.waitForFunction(()=>nothingscoreLoadErrors.has(nothingscoreEventId(ratingsQa.fixtures[0])));const afterVote=await page.evaluate(()=>({state:nothingscoreReadRecoveryState(ratingsQa.fixtures[0]),writes:ratingsQa.writes.length,saved:nothingscoreSnapshots.get(nothingscoreEventId(ratingsQa.fixtures[0])).currentUser.contribution.rating}));assert.equal(afterVote.writes,1);assert.equal(afterVote.saved,3);assert(afterVote.state.nextRetryAt!==null,'failed post-save READ enters timed recovery');await page.clock.runFor(afterVote.state.nextRetryAt-await page.evaluate(()=>Date.now()));await page.clock.runFor(50);assert.equal(await page.evaluate(()=>ratingsQa.writes.length),1,'summary recovery never repeats the acknowledged local write');assert(!await page.evaluate(()=>nothingscoreLoadErrors.has(nothingscoreEventId(ratingsQa.fixtures[0]))));assert.equal(await page.locator('[data-ratings-qa="0"] .nsc-rating-block.is-filled').count(),3,'saved vote survives automatic summary recovery');
   assert.deepEqual(pageErrors,[]);results.push({engine,timedRetries:[30_000,60_000,120_000],exhaustion:true,manualCoalescing:true,hidden:true,offline:true,unmounted:true,oldAccountRejected:true,postSaveReadRecovery:true});console.log(`${engine}: timed budget, exhaustion/manual, hidden/offline/route, account fence and post-save read recovery passed`);
  }finally{await browser.close();}
 }}finally{await new Promise(resolve=>server.close(resolve));}
 fs.writeFileSync(path.join(output,'ratings-recovery-browser-results.json'),JSON.stringify({reference,evidence:'Local native cards, real client summary/recovery owner, controlled transport and browser clock. Synthetic isolated owner only; no external authenticated request or customer write. Desktop browser evidence is not physical-iPhone evidence.',results},null,2));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
