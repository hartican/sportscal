'use strict';
// Controlled worker-to-app handoff; native iPhone notification taps remain a device gate.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),model=require('../config/match-centre');
const navigationUrl=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').match(/assets\/js\/notification-navigation\.js\?v=\d+/)[0];
const root=path.resolve(__dirname,'..'),event={...require('./lib/milestone-fixtures').fixture(),status:'completed',officialScorecardUrl:'https://www.cricket.com.au/matches/CA%3A39990'};
const second={...event,id:'fixture:cricket:CA:40000',eventId:'fixture:cricket:CA:40000',canonicalEventId:'fixture:cricket:CA:40000',sourceEventIds:[]};let race=null;
const target='/?event='+encodeURIComponent(event.id)+'&surface=match-centre&moment=expired-browser-replay';
const workerProbe=`\nself.addEventListener('message',event=>{if(event.data?.type!=='qa-notification-handoff')return;event.waitUntil(handoffNotificationNavigation(event.source,new URL(event.data.url,self.location.origin)).then(()=>event.ports[0].postMessage({stored:true})));});\n`;
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
  response.setHeader('Content-Type','application/json');
  if(url.pathname==='/api/notifications'&&request.method==='POST'){let body='';request.on('data',chunk=>body+=chunk);request.on('end',()=>{const data=JSON.parse(body);if(data.action==='receipt')race?.receipts.push(data.testId);response.end('{}');});return;}
  if(url.pathname==='/api/match-centre'&&url.searchParams.get('context')==='milestone'){const e=url.searchParams.get('ids')===second.id?second:event;const finish=()=>{if(race?.retained&&e.id===event.id){response.statusCode=503;return response.end('{}');}response.end(JSON.stringify({enabled:true,events:[e],fixtures:[model.compact(e)]}));};if(race?.hold&&e.id===event.id){race.release=finish;return;}return finish();}
  if(url.pathname==='/api/match-centre'||url.searchParams.get('scope')==='match-centre')return response.end(JSON.stringify({enabled:true,events:[],fixtures:[],pagination:{nextCursor:null}}));
  response.statusCode=503;return response.end('{}');
 }
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!(/\.(html|js|json|css|svg|png|webp|woff2|ico|webmanifest|mp3)$/.test(file))||file.includes('/.git/')||file.includes('/supabase/')){response.statusCode=404;return response.end();}
 try{
  let bytes=fs.readFileSync(file);
  if(file.endsWith('/service-worker.js'))bytes=Buffer.from(bytes.toString()+workerProbe);
  if(file.endsWith('/index.html')&&url.searchParams.has('qa-late-handoff'))bytes=Buffer.from(bytes.toString().replace("  void loadDeferredScript('"+navigationUrl+"').catch(()=>{});",'  /* QA delays only the real handoff consumer. */'));
  response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');response.end(bytes);
 }catch{response.statusCode=404;response.end();}
});
async function handoff(page,url=target){return page.evaluate(url=>new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('Worker handoff timed out')),5000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};navigator.serviceWorker.controller.postMessage({type:'qa-notification-handoff',url},[channel.port2]);}),url);}
async function exact(page,fixture=event){
 const card=page.locator('[data-match-id="'+fixture.id+'"]');await card.locator('details[open]').waitFor();
 assert.equal(await page.evaluate(()=>activeTab),'match-centre');assert.equal(await card.locator('table').count(),0,'Results OFF survives the worker handoff');
 assert.equal(await page.evaluate(id=>Boolean(getEventAction({id}).addedToFixtures),fixture.id),false,'An exact landing never adds the fixture to Feed');
 await card.getByRole('link',{name:'Official scorecard',exact:true}).waitFor({state:'visible'});
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,receipts=[];
 try{for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{for(const lateBoot of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:[],followedSports:[],fantasyDeadlines:{enabled:false},followFirst:{notifications:{enabled:false,autoRemindersEnabled:false},refinement:{promptedAt:'2026-10-14'}}})));
   await page.goto(base+(lateBoot?'/?qa-late-handoff=1':'/'));await page.locator('#startupLaunch').waitFor({state:'hidden'});
   await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));setTunePromptOpen(false);suppressSessionRatingPrompt();});
   assert.equal(await page.evaluate(()=>activeTab),'feed');assert.equal((await handoff(page)).stored,true);
   if(lateBoot){assert.equal(await page.evaluate(()=>activeTab),'feed','A dropped cold-start message retains its destination');await page.evaluate(async url=>{await loadDeferredScript(url);startMilestoneNotificationNavigation();},navigationUrl);}
   await exact(page);
   await page.evaluate(()=>activateTopLevelTab('feed',{resetViewport:false}));await context.setOffline(true);await handoff(page);await exact(page);
   assert.match(await page.locator('.mc-status').first().innerText(),/Awaiting update|Finished/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
   if(!lateBoot){
    await context.setOffline(false);
    await page.evaluate(()=>{const mount=openMilestoneMatchCentreFixture;globalThis.qaMounted=[];globalThis.openMilestoneMatchCentreFixture=(e,s)=>{qaMounted.push(e.id);mount(e,s);};writeStorage(PUSH_INSTALLATION_STORAGE_KEY,{installationId:'test-installation',secret:'test-only'});});
    for(const retained of [false,true]){
     await page.evaluate(()=>{qaMounted.length=0;activateTopLevelTab('feed',{resetViewport:false});});
     const oldMoment='33333333-3333-4333-8333-333333333333',newMoment='44444444-4444-4444-8444-444444444444';race={hold:true,retained,receipts:[],release:null};
     await handoff(page,'/?event='+encodeURIComponent(event.id)+'&surface=match-centre&moment=test-'+oldMoment);
     for(let i=0;i<100&&!race.release;i++)await new Promise(resolve=>setTimeout(resolve,10));assert(race.release,'The old request entered its fetch');
     await handoff(page,'/?event='+encodeURIComponent(second.id)+'&surface=match-centre&moment=test-'+newMoment);await exact(page,second);
     race.release();await page.waitForTimeout(100);
     assert.deepEqual(await page.evaluate(()=>qaMounted),[second.id],'Only the newer fixture mounts');assert.deepEqual(race.receipts,[newMoment],'Only the newer landing reports a receipt');
     const result={engine,delayedOldFetch:true,retainedFailure:retained,newestOnlyMounted:true,newestOnlyReceipt:true,resultsOff:true,noFeedPin:true};receipts.push(result);console.log(JSON.stringify(result));race=null;
    }
   }
   assert.deepEqual(errors,[]);
   const receipt={engine,lateBoot,exactMatchExpanded:true,resultsOff:true,noFeedPin:true,officialScorecard:true,offlineRetainedLanding:true,errors};receipts.push(receipt);console.log(JSON.stringify(receipt));await context.close();
  }}finally{await browser.close();}
 }}finally{await new Promise(resolve=>server.close(resolve));}
 if(process.env.NOTIFICATION_LANDING_OUTPUT){fs.mkdirSync(process.env.NOTIFICATION_LANDING_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.NOTIFICATION_LANDING_OUTPUT,'browser-replays.json'),JSON.stringify({receipts,limit:'Controlled worker handoff, not a native notification tap or physical iPhone test.'},null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
