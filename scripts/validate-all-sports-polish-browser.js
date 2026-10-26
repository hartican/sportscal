'use strict';
// Targeted screenshot-sized All Sports regression. Real app and handler with
// constructed loopback fixtures; the original captured native harness is unchanged.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const root=path.resolve(__dirname,'..'),now=Date.parse('2026-10-24T04:00:00Z'),stamp=new Date(now).toISOString();
let scenario;
function resetScenario(){scenario={published:[]};}
function nativeFixture(key,suffix,facts){const id='fixture:'+key+':'+suffix,home='team:'+key+':'+suffix+'-home',away='team:'+key+':'+suffix+'-away';return {id,eventId:id,key,sport:key.toUpperCase(),competitionName:key.toUpperCase(),date:'2026-10-24',status:'live',startTimeUtc:new Date(now-3600000).toISOString(),homeParticipantId:home,awayParticipantId:away,participantIds:[home,away],participants:[{id:home,displayName:'Native Home'},{id:away,displayName:'Native Away'}],statusCheckedAt:stamp,scoreCheckedAt:stamp,sourceCheckedAt:stamp,sourceUrl:'https://organiser.example/constructed-polish',homeScore:18,awayScore:12,...facts};}
const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>now,published:()=>scenario.published,snapshotRead:async()=>({stale:false,readAt:now,sources:[]}),request:async(_path,options)=>{assert(options.body.p_fixture_ids.length<=60);assert.equal(options.timeoutMs,3000);return scenario.published.filter(e=>options.body.p_fixture_ids.includes(e.id)).map(fixture=>({fixture,checked_at:stamp}));}});
async function personalState(page){return page.evaluate(()=>({preferences:JSON.stringify(userPreferences),actions:JSON.stringify(eventActions),states:JSON.stringify(cardViewStates),spoilers:JSON.stringify(eventSpoilerState)}));}
async function enterAllSports(page,count){await page.getByRole('tab',{name:'All Sports',exact:true}).click();await page.waitForFunction(count=>document.querySelectorAll('[data-sports-id]').length===count&&document.querySelector('[aria-label="Refresh All Sports View"]')?.disabled===false,count);}
async function polish(browser,base,engine,network){
 resetScenario();scenario.published=Array.from({length:4},(_,i)=>nativeFixture('nrl','polish-'+i,{status:'upcoming',startTimeUtc:new Date(now+3600000).toISOString(),name:i<2?'Los Angeles Kings v New York Rangers and the visiting representative team':'Home representative team v Away representative team',fullSpiel:'Constructed fixture details for the expanded card. '.repeat(24)}));
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];let originalError;
 try{
  page.on('pageerror',error=>errors.push(error.message));
  await network.attachContext(page.context());
  await page.addInitScript(({now})=>{const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:false,feedControls:{spoilers:'strict'},followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]}}));},{now});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
  await page.locator('.tabs [data-tab=match-centre]').click();const before=await personalState(page);
  await enterAllSports(page,4);await page.evaluate(()=>document.fonts.ready);
  const text=await page.evaluate(()=>{const label=document.querySelector('[data-sports-id] .minimised-card-label'),box=label.getBoundingClientRect(),card=label.closest('.event-card').getBoundingClientRect();return {text:label.textContent,label:{top:box.top,bottom:box.bottom,height:box.height},card:{top:card.top,bottom:card.bottom,height:card.height},client:label.clientHeight,scroll:label.scrollHeight};});
  const last=page.locator('[data-sports-id="fixture:nrl:polish-3"]');await last.locator('.minimised-card-summary').scrollIntoViewIfNeeded();await last.locator('.minimised-card-summary').click();await page.locator('.as-expanded').waitFor();
  // Set the real horizontal viewport for this layout assertion. The unchanged
  // original native harness owns pager-button gesture/settled-page coverage.
  await page.locator('.as-track').evaluate(track=>track.scrollTo({left:0,behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('.as-track').scrollLeft<2);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const layout=await page.locator('.as-track').evaluate(track=>{const box=track.getBoundingClientRect(),cards=[...track.children].map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};}),visible=cards.filter(r=>r.right>box.left+1&&r.left<box.right-1);return {track:box.height,visibleMax:Math.max(...visible.map(r=>r.height)),visibleClipped:visible.some(r=>r.top<box.top||r.bottom>box.bottom),offscreenExpanded:track.querySelector('.as-expanded')?.getBoundingClientRect().left>=box.right-1,documentOverflow:document.documentElement.scrollWidth-innerWidth};});
  console.log(JSON.stringify({engine,probe:'All Sports compact text and offscreen expansion',text,layout,physicalDeviceProof:false}));
  if(process.env.ALL_SPORTS_DIAGNOSTIC_DIR)await page.screenshot({path:path.join(process.env.ALL_SPORTS_DIAGNOSTIC_DIR,'polish-'+engine+'.png'),fullPage:true});
  assert(text.label.top>=text.card.top&&text.label.bottom<=text.card.bottom&&text.scroll<=text.client+1,'The full wrapped fixture name fits inside the compact card');
  assert(layout.offscreenExpanded,'The expanded card is on another horizontal page');assert(layout.track-layout.visibleMax<45,'An offscreen expanded card must not leave a large blank gap');assert.equal(layout.visibleClipped,false,'Visible cards fit completely inside the horizontal viewport');assert.equal(layout.documentOverflow,0);
  assert.deepEqual(await personalState(page),before,'Browsing, expansion and paging preserve saved personal state');
  await last.locator('button').filter({hasText:'Add to Feed'}).scrollIntoViewIfNeeded();
  await page.evaluate(()=>{globalThis.qaCardWrites=[];for(const name of ['setCardState','updateEventAction','recordEventFeedAction']){const original=globalThis[name];globalThis[name]=(...args)=>{qaCardWrites.push(name);return original(...args);};}});
  await last.getByRole('button',{name:'Add to Feed',exact:true}).click();await last.getByRole('button',{name:'In Feed',exact:true}).waitFor();
  const pin=await page.evaluate(id=>{const e=profileFixtureEvents.get(id),action=getEventAction(e);return {action,queue:fixturePinQueue[eventActionKey(e)],writes:qaCardWrites,active:activeEvents.some(e=>e.id===id),expanded:document.querySelector('[data-sports-id="'+id+'"]')?.classList.contains('as-expanded')};},'fixture:nrl:polish-3');
  assert.equal(pin.action.addedToFixtures,true);assert.equal(pin.action.pinState,'added');assert.equal(pin.queue.enabled,true);assert.equal(pin.queue.mutationId,pin.action.pinMutationId);assert.equal(pin.active,true);assert.equal(pin.expanded,true);assert.deepEqual(pin.writes,['updateEventAction']);
  const after=await personalState(page);for(const field of ['preferences','states','spoilers'])assert.equal(after[field],before[field]);assert.deepEqual(errors,[]);
  network.assertIsolated();console.log(JSON.stringify({engine,probe:'All Sports Feed action and layout',wrappedText:true,visiblePageHeight:true,canonicalPin:true,privateChoicesPreserved:true,errors}));
 }catch(error){originalError=error;console.error(JSON.stringify({engine,probe:'polish failure',error:error.message,errors,tracks:await page.locator('.as-track').evaluateAll(nodes=>nodes.map(n=>({left:n.scrollLeft,top:n.scrollTop,height:n.clientHeight,scrollHeight:n.scrollHeight,width:n.clientWidth,style:n.style.height}))).catch(()=>null)}));throw error;}
 finally{try{await page.close();}catch(cleanupError){if(!originalError)throw cleanupError;console.error(JSON.stringify({engine,secondaryPageCleanupError:cleanupError.message}));}}
}
async function polishMain(){
 const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),crypto=require('node:crypto'),index=fs.readFileSync(path.join(root,'index.html')),version=index.toString().match(/name="app-shell-version" content="(\d+)"/)[1],deadline=Date.now()+120000;
 const free=()=>{const disk=fs.statfsSync(root);return disk.bavail*disk.bsize;};assert(free()>=4.5*1024**3);
 for(const engine of (process.env.ALL_SPORTS_ENGINES||'chromium,webkit').split(',')){
  const network=require('./lib/installed-test-network').create();let browser,error;
  const server=http.createServer(async(req,res)=>{
   if(network.handleRequest(req)||network.preflightDocument(req,res))return;const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/api/match-centre')return handler(req,{setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return this;},json(body){res.setHeader('content-type','application/json');res.end(JSON.stringify(body));}});
   if(url.pathname.startsWith('/api/')){res.statusCode=url.searchParams.get('scope')==='match-centre'?200:503;res.setHeader('content-type','application/json');res.end(JSON.stringify(url.searchParams.get('scope')==='match-centre'?{events:[],pagination:{nextCursor:null}}:{}));return;}
   const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(error?'':bytes);});
  });
  let watchdog;
  try{
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;network.setOrigin(base);network.attachServer(server);
   browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:process.env.QA_BROWSER_CHANNEL||'chrome'}:{}),...network.launchOptions()});
   watchdog=setInterval(()=>{if(Date.now()>deadline||free()<3*1024**3){console.error('Polish browser allocation or host reserve exceeded');void browser.close().catch(()=>{});}},2000);
   await network.preflight(browser,{version,indexSha256:crypto.createHash('sha256').update(index).digest('hex')});await polish(browser,base,engine,network);
  }catch(failure){error=failure;throw failure;}
  finally{clearInterval(watchdog);try{await network.close(browser,server,error);}finally{console.log(JSON.stringify({engine,polishIsolationAndCleanup:network.snapshot()}));}}
 }
}
polishMain().catch(error=>{console.error(error);process.exitCode=1;});
