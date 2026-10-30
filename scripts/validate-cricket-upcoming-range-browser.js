'use strict';
// Actual Feed mounting and selected-score patch with a retained public source
// replay. This is local renderer proof, not fresh provider or device evidence.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {event,now}=require('./validate-cricket-upcoming-range'),root=path.resolve(__dirname,'..'),networkHelper=require('./lib/installed-test-network');
const scoreScripts=[...fs.readFileSync(path.join(root,'config/feed-live-score-loader.js'),'utf8').matchAll(/loadDeferredScript\('([^']+)'\)/g)].map(match=>match[1]);assert.equal(scoreScripts.length,2);
async function main(){
 const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),index=fs.readFileSync(path.join(root,'index.html')),version=index.toString().match(/name="app-shell-version" content="(\d+)"/)[1],deadline=Date.now()+120000;
 const free=()=>{const disk=fs.statfsSync(root);return disk.bavail*disk.bsize;};assert(free()>=4.5*1024**3);
 for(const engine of (process.env.CRICKET_RANGE_ENGINES||'chromium,webkit').split(',')){
  const network=networkHelper.create();let browser,error,watchdog;
  const server=http.createServer((req,res)=>{
   if(network.handleRequest(req)||network.preflightDocument(req,res))return;const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/qa-third-test.json'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(event));return;}
   if(url.pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}
   const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(error?'':bytes);});
  });
  try{
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;network.setOrigin(origin);network.attachServer(server);
   browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:process.env.QA_BROWSER_CHANNEL||'chrome'}:{}),...network.launchOptions()});
   watchdog=setInterval(()=>{if(Date.now()>deadline||free()<3*1024**3){console.error('Range browser allocation or reserve exceeded');void browser.close().catch(()=>{});}},2000);
   await network.preflight(browser,{version,indexSha256:crypto.createHash('sha256').update(index).digest('hex')});
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await network.attachContext(context);const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await context.addInitScript(({now})=>{const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:false,feedCompact:false,feedControls:{spoilers:'strict'},followedSports:['cricket'],preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]}}));},{now:+now});
   await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden'});
   const result=await page.evaluate(async({scoreScripts})=>{
    setTunePromptOpen(false);suppressSessionRatingPrompt();await ensureFeedScoreUi();for(const script of scoreScripts)await loadDeferredScript(script);const event=await(await fetch('/qa-third-test.json')).json();
    activeTab='feed';activeView='list';activeFilter='all';userPreferences.feedCompact=false;userPreferences.showSpoilers=false;userPreferences.feedControls.spoilers='strict';userPreferences.preferenceGraph.entityFollows=[{participantId:'team:cricket:australia',followLevel:'follow'}];
    activeEvents=[event];cardViewStates[event.id]='selected';renderListView();const list=document.getElementById('listView'),slot=list.querySelector('[data-feed-event-id="'+event.id+'"]');if(!slot)throw Error('Retained third Test did not enter the real Feed');slot._mountCard?.();const card=slot.querySelector('.event-card');
    const read=()=>{const badge=card.querySelector('.fixture-timing-badge'),day=badge?.querySelector('.fixture-timing-day'),box=badge?.getBoundingClientRect(),text=day?.getBoundingClientRect(),frame=card.getBoundingClientRect();return {range:day?.textContent,title:badge?.title,visible:day&&!day.hidden&&text.width>0&&text.height>0,clipped:box&&(text.top<box.top||text.bottom>box.bottom||text.left<box.left||text.right>box.right),centreDelta:box?Math.abs((box.left+box.right-frame.left-frame.right)/2):null};};
    const constructed=read(),saved=JSON.stringify({preferences:userPreferences,actions:eventActions,states:cardViewStates,spoilers:eventSpoilerState});
    NOTHINGSPORTS_FEED_LIVE_SCORES.install(card,event,{resultsOn:false});const patched=read();
    return {constructed,patched,group:slot.closest('.date-group')?.dataset.feedDate,copies:list.querySelectorAll('[data-feed-event-id="'+event.id+'"]').length,privatePreserved:saved===JSON.stringify({preferences:userPreferences,actions:eventActions,states:cardViewStates,spoilers:eventSpoilerState}),source:{id:event.id,date:event.date,start:event.startTimeUtc,endDate:event.endDate,end:event.endTimeUtc},scoreNodes:card.querySelectorAll('.feed-live-score').length,overflow:document.documentElement.scrollWidth-innerWidth};
   },{scoreScripts});
   assert.equal(result.group,'2026-10-31');assert.equal(result.copies,1);assert.equal(result.source.date,'2026-10-27');assert.equal(result.source.start,'2026-10-27T08:30:00.000Z');
   for(const value of [result.constructed,result.patched]){assert.match(value.range,/27 OCT.*31 OCT/);assert.match(value.title,/27 OCT.*31 OCT/);assert(value.visible);assert.equal(value.clipped,false);assert(value.centreDelta<18);}
   assert.deepEqual(result.patched,result.constructed,'Real selected-score patch preserves the constructor range');assert(result.privatePreserved);assert.equal(result.scoreNodes,0);assert.equal(result.overflow,0);assert.deepEqual(errors,[]);network.assertIsolated();
   if(process.env.CRICKET_RANGE_DIAGNOSTIC_DIR)await page.screenshot({path:path.join(process.env.CRICKET_RANGE_DIAGNOSTIC_DIR,'upcoming-range-'+engine+'.png'),fullPage:true});
   console.log(JSON.stringify({engine,width:390,retainedSourceReplay:true,productionOrPhysicalDeviceProof:false,...result,errors}));
  }catch(failure){error=failure;throw failure;}
  finally{clearInterval(watchdog);try{await network.close(browser,server,error);}finally{console.log(JSON.stringify({engine,isolationAndCleanup:network.snapshot()}));}}
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
