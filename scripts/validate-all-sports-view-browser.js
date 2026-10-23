'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),sports=require('../config/all-sports-view'),match=require('../config/match-centre');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const root=path.resolve(__dirname,'..'),now=Date.parse('2026-10-24T04:00:00Z'),stamp=new Date(now).toISOString();
const fixtures=Array.from({length:132},(_,i)=>({id:'fixture:nrl:all-sports-'+i,eventId:'fixture:nrl:all-sports-'+i,key:'nrl',sport:'NRL',competitionName:'NRL',name:'Panthers '+i+' v Storm '+i,date:'2026-10-24',status:'upcoming',startTimeUtc:new Date(now+3600000+i*1000).toISOString(),homeParticipantId:'team:nrl:sports-home-'+i,awayParticipantId:'team:nrl:sports-away-'+i,participantIds:['team:nrl:sports-home-'+i,'team:nrl:sports-away-'+i],sourceCheckedAt:stamp,sourceUrl:'https://organiser.example/schedule'}));
fixtures.unshift({...fixtures[0],id:'fixture:nrl:underway',eventId:'fixture:nrl:underway',startTimeUtc:new Date(now-3600000).toISOString(),status:'live',statusCheckedAt:stamp,scoreCheckedAt:stamp,homeScore:321,awayScore:123});
fixtures.push({...fixtures[1],id:'fixture:nrl:tbc',eventId:'fixture:nrl:tbc',startTimeUtc:null,timePrecision:'date-only'},{...fixtures[1],id:'fixture:nrl:tomorrow',eventId:'fixture:nrl:tomorrow',startTimeUtc:new Date(now+12*3600000).toISOString(),date:'2026-10-25'},{...fixtures[1],id:'fixture:nrl:later',eventId:'fixture:nrl:later',startTimeUtc:new Date(now+30*3600000).toISOString(),date:'2026-10-25'});
let fail=false,partial=false,requests=[];
const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>now,published:()=>fixtures,snapshotRead:async()=>{if(fail)throw Error('mock source unavailable');return {stale:false,readAt:now,sources:[]};},request:async(_path,options)=>{assert(options.body.p_fixture_ids.length<=60);assert.equal(options.timeoutMs,3000);return fixtures.filter(e=>options.body.p_fixture_ids.includes(e.id)).map(fixture=>({fixture,checked_at:stamp}));}});
async function main(){
 const free=()=>{const disk=fs.statfsSync(root);return disk.bavail*disk.bsize;},allocated=Date.parse(process.env.ALL_SPORTS_DEADLINE||''),deadline=Math.min(Date.now()+(process.env.ALL_SPORTS_PAGER_PROBE?90000:360000),Number.isFinite(allocated)?allocated:Infinity);
 assert(free()>=4.5*1024**3,'Browser lane entry needs 4.5 GiB free');
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   requests.push(url.pathname+url.search);
   if(url.pathname==='/api/match-centre'){
    if(partial&&Number(url.searchParams.get('cursor'))>0){res.writeHead(503);res.end('{}');return;}
    try{return await handler(req,{setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return this;},json(body){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));}});}catch(e){res.writeHead(500);res.end('{}');return;}
   }
   res.statusCode=url.searchParams.get('scope')==='match-centre'?200:503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(url.searchParams.get('scope')==='match-centre'?{events:[],pagination:{nextCursor:null}}:{}));return;
  }
  const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const engine of (process.env.ALL_SPORTS_ENGINES||'chromium,webkit').split(',')){
   const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
   const watchdog=setInterval(()=>{if(Date.now()>deadline||free()<3*1024**3){console.error('Browser lane allocation or host reserve exceeded');void browser.close();}},5000);
   try{for(const width of (process.env.ALL_SPORTS_WIDTHS||'390,768,1280').split(',').map(Number)){
    fail=false;partial=false;requests=[];const errors=[],page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
    try{
     page.on('pageerror',e=>errors.push(e.message));
     await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:204,body:''}));
     await page.route('**/assets/js/all-sports-ui.js*',async route=>{await page.evaluate(()=>{userPreferences.qaPublicViewBookkeeping=true;userPreferences.showSpoilers=false;userPreferences.feedControls.spoilers='strict';});await route.continue();});
     await page.addInitScript(({now})=>{const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,feedControls:{spoilers:'results_visible'},followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]}}));},{now});
     await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
     await page.locator('.tabs [data-tab=match-centre]').click();assert.equal(await page.getByRole('tab',{name:'Followed',exact:true}).getAttribute('aria-selected'),'true');
     await page.getByRole('tab',{name:'All Sports',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-sports-id]').length===134&&!document.querySelector('[aria-label="Refresh All Sports View"]').disabled);await page.evaluate(()=>document.fonts.ready);
     assert.equal(await page.getByRole('tab',{name:'Today',exact:true}).getAttribute('aria-selected'),'true');assert(await page.getByRole('heading',{name:'Time TBC',exact:true}).isVisible());assert.match(await page.locator('.as-tbc').innerText(),/May fall within this range/);
     const geometry=await page.locator('.as-track.as-multiple').first().evaluate(track=>({track:track.clientWidth,card:track.firstElementChild.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth}));
     const columns=width>=1120?4:width>=760?3:2;assert(Math.abs(geometry.card-(geometry.track-12*(columns-1))/columns)<2);assert.equal(geometry.overflow,0);
     const saved=await page.evaluate(()=>({preferences:JSON.stringify(userPreferences),actions:JSON.stringify(eventActions),states:JSON.stringify(cardViewStates)}));
     await page.evaluate(()=>{globalThis.qaCardWrites=[];for(const name of ['setCardState','updateEventAction','recordEventFeedAction']){const old=globalThis[name];globalThis[name]=(...args)=>{qaCardWrites.push(name);return old(...args);};}});
     const first=page.locator('[data-sports-id="fixture:nrl:underway"]');await first.locator('.minimised-card-summary').click();await page.waitForFunction(()=>document.querySelector('[data-sports-id="fixture:nrl:underway"]')?.classList.contains('as-expanded'));
     assert(!/321|123/.test(await first.innerText()),'Results OFF selected during the pending module protects expanded content');assert.equal(await page.evaluate(()=>userPreferences.feedControls.spoilers),'strict');assert.equal(await page.locator('.as-expanded').count(),1);
     assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences)),saved.preferences);assert.equal(await page.evaluate(()=>JSON.stringify(cardViewStates)),saved.states);assert.deepEqual(await page.evaluate(()=>qaCardWrites),[],'Expansion delegates without persistent card/account/engagement writes');
     await first.locator('.event-card-disclosure').click();
     await page.waitForFunction(()=>!document.querySelector('.as-expanded'));
     await page.getByRole('button',{name:'Next overlapping fixtures',exact:true}).first().click();await page.waitForFunction(()=>{const track=document.querySelector('.as-track');return track?.scrollLeft>=track.clientWidth-24&&document.querySelector('.as-page-position')?.textContent.includes('Page 2 ');});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.match(await page.locator('.as-page-position').first().textContent(),/Page 2/);
     if(process.env.ALL_SPORTS_PAGER_PROBE){console.log(JSON.stringify({engine,width,probe:'settled horizontal pager',position:await page.locator('.as-page-position').first().textContent(),track:await page.locator('.as-track').first().evaluate(n=>({left:n.scrollLeft,width:n.clientWidth,total:n.scrollWidth})),errors}));continue;}
     await page.getByRole('tab',{name:'+24 hours',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-sports-id]').length===135&&!document.querySelector('[aria-label="Refresh All Sports View"]').disabled);
     await page.getByRole('tab',{name:'+48 hours',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-sports-id]').length===136&&!document.querySelector('[aria-label="Refresh All Sports View"]').disabled);assert.equal(await page.locator('.as-date').count(),2);
     await page.getByRole('tab',{name:'Everything',exact:true}).click();await page.getByRole('tab',{name:'All Sports',exact:true}).click();await page.getByRole('tab',{name:'+48 hours',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'+48 hours',exact:true}).getAttribute('aria-selected'),'true');
     fail=true;await page.getByRole('button',{name:'Refresh All Sports View',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.as-notice')?.textContent.includes('Current updates are unavailable'));assert.equal(await page.locator('[data-sports-id]').count(),136);assert.match(await page.locator('[data-sports-id="fixture:nrl:underway"] .as-qualifier').textContent(),/Awaiting update/,'A recent cached live fact loses an unqualified Live claim on a failed current read');
     fail=false;partial=true;await page.getByRole('button',{name:'Refresh All Sports View',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.as-notice')?.textContent.includes('Schedule incomplete'));assert.equal(await page.locator('[data-sports-id]').count(),136,'A failed continuation cannot erase retained fixture cards');
     const before=requests.length;await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);assert.equal(requests.length,before);
     assert.deepEqual(errors,[]);assert(requests.some(u=>u.includes('cursor=100')),'Data pagination is independent of horizontal UI pages');assert(requests.filter(u=>u.includes('view=all-sports')&&u.includes('ids=')).every(u=>new URL(u,base).searchParams.get('ids').split(',').length<=60));
     console.log(JSON.stringify({engine,width,columns,fixtures:136,completePagination:true,rollingRanges:true,inlineExpansion:true,resultsOff:true,accountPreserved:true,tbc:true,fallback:true,partial:true,hiddenStop:true,errors}));
    }catch(error){console.error(JSON.stringify({engine,width,errors,notice:await page.locator('.as-notice').textContent().catch(()=>null),pages:await page.locator('.as-page-position').allTextContents(),tracks:await page.locator('.as-track').evaluateAll(nodes=>nodes.map(n=>({left:n.scrollLeft,width:n.clientWidth,total:n.scrollWidth}))),lastRequests:requests.slice(-8)}));throw error;}finally{await page.close();}
   }}finally{clearInterval(watchdog);await browser.close();}
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
