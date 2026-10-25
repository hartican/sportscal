'use strict';
// Targeted installed-app acceptance. Actual shell/worker, optional module and
// public disposable store; constructed loopback fixtures, not hosted freshness.
// ALL_SPORTS_OFFLINE_ENGINES=chromium|webkit and
// ALL_SPORTS_OFFLINE_CASES=first-use|return select a smaller diagnostic run.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const match=require('../config/match-centre');
const {observeApiFetch,mutationRequests}=require('./validate-all-sports-view-browser');
const network=require('./lib/installed-test-network');
const {classify}=require('./lib/all-sports-offline-errors');
const root=path.resolve(__dirname,'..'),now=Date.parse('2026-10-26T04:00:00Z'),stamp=new Date(now).toISOString();
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const index=fs.readFileSync(path.join(root,'index.html')),version=index.toString().match(/name="app-shell-version" content="(\d+)"/)[1];
const modulePath='/assets/js/all-sports-ui.js?v='+version,moduleHash=hash(fs.readFileSync(path.join(root,'assets/js/all-sports-ui.js')));
const parentSource=index.toString().match(/async function loadMatchCentre\(\)\{[\s\S]*?\n\}/)[0];
const parentDependencies=[...parentSource.matchAll(/loadDeferredScript\('([^']+)'\)/g)].map(([,url])=>({url:'/'+url,sha256:hash(fs.readFileSync(path.join(root,url.split('?')[0])))}));
const sourceFields=['id','eventId','name','status','startTimeUtc','endTimeUtc','timePrecision','date','homeScore','awayScore','sourceUrl','sourceCheckedAt','statusCheckedAt','scoreCheckedAt','scoreFactObservedAt','statusFactObservedAt'];
const fixtures=['future-one','future-two','ongoing','tbc'].map((suffix,i)=>({
 id:'fixture:nrl:offline-'+suffix,eventId:'fixture:nrl:offline-'+suffix,key:'nrl',sport:'NRL',competitionName:'NRL',name:'Offline Home '+i+' v Offline Away '+i,
 date:'2026-10-26',status:i===2?'live':'upcoming',startTimeUtc:i===3?null:new Date(now+(i===2?-1:i+1)*3600000).toISOString(),timePrecision:i===3?'date-only':'exact',
 homeParticipantId:'team:nrl:offline-home-'+i,awayParticipantId:'team:nrl:offline-away-'+i,participantIds:['team:nrl:offline-home-'+i,'team:nrl:offline-away-'+i],
 sourceUrl:'https://organiser.example/constructed-offline-schedule',sourceCheckedAt:stamp,statusCheckedAt:stamp,scoreCheckedAt:stamp,scoreFactObservedAt:stamp,statusFactObservedAt:stamp,...(i===2?{homeScore:18,awayScore:12}:{}),
}));
const expectedFacts=fixtures.map(e=>({fields:Object.fromEntries(sourceFields.filter(key=>Object.hasOwn(e,key)).map(key=>[key,e[key]])),score:match.compact(e).score})).sort((a,b)=>a.fields.id.localeCompare(b.fields.id));
const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>now,published:()=>fixtures,snapshotRead:async()=>({stale:false,readAt:now,sources:[]}),request:async(_path,options)=>{
 assert(options.body.p_fixture_ids.length<=60);assert.equal(options.timeoutMs,3000);
 return fixtures.filter(e=>options.body.p_fixture_ids.includes(e.id)).map(fixture=>({fixture,checked_at:stamp}));
}});
let activeBrowser,stopFailure;
function seed({now}){
 // Seed a new disposable public profile only; an offline document reload must
 // load its actual saved choices rather than replacing them with test values.
 const RealDate=Date;globalThis.qaNow=Number(sessionStorage.getItem('qa_as_offline_clock'))||now;
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[qaNow]));}static now(){return qaNow;}};
 globalThis.qaDocumentToken=Math.random().toString(36);
 if(!localStorage.getItem('ns_preferences_v1'))localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:false,feedControls:{spoilers:'strict'},followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]}}));
}
async function personal(page){return page.evaluate(()=>({preferences:structuredClone(userPreferences),actions:structuredClone(eventActions),states:structuredClone(cardViewStates),spoilers:structuredClone(eventSpoilerState)}));}
async function startDocument(page){
 await page.locator('#startupLaunch').waitFor({state:'hidden'});
 await page.evaluate(()=>{
  setTunePromptOpen(false);suppressSessionRatingPrompt();globalThis.qaCardWrites=[];globalThis.qaFeedPolls=0;
  for(const name of ['setCardState','updateEventAction','recordEventFeedAction']){const original=globalThis[name];globalThis[name]=(...args)=>{qaCardWrites.push(name);return original(...args);};}
  const original=queueLiveFixtureSnapshot;globalThis.queueLiveFixtureSnapshot=(...args)=>{qaFeedPolls++;return original(...args);};
 });
}
async function enterMatchCentre(page){
 // The real reload owner can already restore this main tab. Re-selecting it
 // would create another Followed visit instead of the user's one return.
 if(!await page.evaluate(()=>activeTab==='match-centre'))await page.locator('.tabs [data-tab=match-centre]').click();
 await page.getByRole('tab',{name:'All Sports',exact:true}).waitFor();
 assert.equal(await page.getByRole('tab',{name:'Followed',exact:true}).getAttribute('aria-selected'),'true');
}
async function assertPersonal(page,saved,{acrossDocument=false}={}){
 const current=await personal(page);
 if(acrossDocument){
  // Reuse the profile owner's existing comparison of deliberate choices.
  // This retains every unknown preference and excludes only its own pointers
  // and session counters, rather than adding a test-specific ignore list.
  assert(await page.evaluate(saved=>NOTHINGSPORTS_PROFILE_STORAGE.preferenceBaseMatches({basePreferences:saved},userPreferences),saved.preferences),'Saved personal choices survive the real document reload');
 }else assert.deepEqual(current.preferences,saved.preferences,'All Sports does not change preferences');
 for(const key of ['actions','states','spoilers'])assert.deepEqual(current[key],saved[key],key+' is unchanged');
 assert.deepEqual(await page.evaluate(()=>qaCardWrites),[],'No personal card/action/engagement writers');
 assert.equal(await page.evaluate(()=>qaFeedPolls),0,'No Feed poller');
 assert.equal(current.preferences.showSpoilers,false);assert.equal(current.preferences.feedControls.spoilers,'strict');
 assert.deepEqual(current.preferences.followedSports,[]);assert.deepEqual(current.preferences.selectedSelectorEntityIds,[]);assert.deepEqual(current.preferences.preferenceGraph.entityFollows,[]);
}
async function cachedModule(page){return page.evaluate(async({version,modulePath})=>{
 const cache=await caches.open('nothingsport-shell-v'+version),response=await cache.match(modulePath);
 if(!response)return null;const bytes=await response.arrayBuffer();
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
},{version,modulePath});}
async function parentCache(page){return page.evaluate(async({version,dependencies})=>{
 const cache=await caches.open('nothingsport-shell-v'+version),result=[];
 for(const dependency of dependencies){const response=await cache.match(dependency.url);let sha256=null;
  if(response){const bytes=await response.arrayBuffer();sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  result.push({url:dependency.url,cached:Boolean(response),sha256,sourceMatches:sha256===dependency.sha256});
 }
 return result;
},{version,dependencies:parentDependencies});}
async function installedShell(page){
 await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL===new URL('/service-worker.js',location.href).href);
 const result=await page.evaluate(async version=>{
  const registration=await navigator.serviceWorker.getRegistration(),cache=await caches.open('nothingsport-shell-v'+version),response=await cache.match('/index.html');
  const bytes=await response.arrayBuffer();return {active:registration.active.state,indexSha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')};
 },version);
 assert.deepEqual(result,{active:'activated',indexSha256:hash(index)});return result;
}
async function cards(page){
 await page.waitForFunction(count=>document.querySelectorAll('[data-sports-id]').length===count&&document.querySelector('[aria-label="Refresh All Sports View"]')?.disabled===false,fixtures.length);
 const facts=await page.evaluate(({ids,fields})=>ids.map(id=>{const e=profileFixtureEvents.get(id);return {fields:Object.fromEntries(fields.filter(key=>Object.hasOwn(e,key)).map(key=>[key,e[key]])),score:NOTHINGSPORTS_MATCH_CENTRE.compact(e).score};}).sort((a,b)=>a.fields.id.localeCompare(b.fields.id)),{ids:fixtures.map(e=>e.id),fields:sourceFields});
 assert.deepEqual(facts,expectedFacts,'Every fixture retains its source-owned facts and score clocks');
 assert.deepEqual((await page.locator('[data-sports-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.sportsId))).sort(),fixtures.map(e=>e.id).sort());
 assert(await page.getByRole('heading',{name:'Time TBC',exact:true}).isVisible());return facts;
}
async function audit(page,writes,readBudget){
 const reads=[],calls=await page.evaluate(()=>qaApiInvocations);
 assert.deepEqual(mutationRequests(writes,calls,readBudget,reads),[],'Every non-GET API call is corroborated and bounded to an unchanged public Followed read');
 return reads;
}
async function closeCaseContext(context,originalError){
 try{await context.close();return {closed:true};}
 catch(cleanupError){if(!originalError)throw cleanupError;return {closed:false,secondaryError:cleanupError.message};}
}
async function checkCleanup(){
 const original=Error('original case failure'),secondary=Error('secondary context close failure');let closes=0;
 const clean={close:async()=>{closes++;}},failed={close:async()=>{closes++;throw secondary;}};
 assert.deepEqual(await closeCaseContext(clean),{closed:true});
 assert.deepEqual(await closeCaseContext(clean,original),{closed:true});
 assert.deepEqual(await closeCaseContext(failed,original),{closed:false,secondaryError:secondary.message});
 await assert.rejects(closeCaseContext(failed),error=>error===secondary);
 // Exercise the real catch/finally priority: the same original Error escapes
 // even when context.close rejects; a cleanup-only failure still rejects.
 await assert.rejects((async()=>{let error;try{throw original;}catch(failure){error=failure;throw failure;}finally{await closeCaseContext(failed,error);}})(),error=>error===original);
 assert.equal(closes,5);console.log('All Sports offline cleanup: 5 fault controls PASS (no browser/network).');
}
async function checkFixtures(){
 let result;await handler({method:'GET',url:'/api/match-centre?view=all-sports&ids='+encodeURIComponent(fixtures.map(e=>e.id).join(','))},{setHeader(){},status(code){assert.equal(code,200);return this;},json(body){result=body;}});
 assert.equal(result.events.length,fixtures.length);
 const facts=result.events.map(e=>({fields:Object.fromEntries(sourceFields.filter(key=>Object.hasOwn(e,key)).map(key=>[key,e[key]])),score:match.compact(e).score})).sort((a,b)=>a.fields.id.localeCompare(b.fields.id));
 assert.deepEqual(facts,expectedFacts,'Constructed source fixtures survive the actual selected handler without absent/default expectation races');
 console.log('All Sports offline fixtures: actual selected handler source facts/clocks PASS (no browser/network).');
}
async function engineRun(pw,engine,cases){
 const net=network.create(),apiRequests=[],moduleRequests=[],contexts=new Set(),ownedFailures=[];let browser,error,stage='setup',unreachable=false,failedOwned=0;
 const server=http.createServer(async(req,res)=>{
  if(net.handleRequest(req))return;
  if(unreachable){failedOwned++;const url=new URL(req.url,'http://localhost');if(ownedFailures.length<64)ownedFailures.push({method:req.method,path:url.pathname+url.search,stage,unreachable:true});req.socket.destroy();return;}
  if(net.preflightDocument(req,res))return;
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   apiRequests.push({method:req.method,path:url.pathname+url.search});
   if(url.pathname==='/api/match-centre'){
    try{return await handler(req,{setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return this;},json(body){res.setHeader('content-type','application/json');res.end(JSON.stringify(body));}});}catch(failure){res.writeHead(500);res.end('{}');return;}
   }
   res.statusCode=url.searchParams.get('scope')==='match-centre'?200:503;res.setHeader('content-type','application/json');res.end(JSON.stringify(url.searchParams.get('scope')==='match-centre'?{events:[],pagination:{nextCursor:null}}:{}));return;
  }
  if(url.pathname==='/assets/js/all-sports-ui.js')moduleRequests.push(url.pathname+url.search);
  let name;try{name=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';}catch{res.writeHead(400);res.end();return;}
  const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(failure,bytes)=>{res.writeHead(failure?404:200,{'content-type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(failure?'':bytes);});
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;net.setOrigin(origin);net.attachServer(server);
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:process.env.QA_BROWSER_CHANNEL||'chrome'}:{}),...net.launchOptions()});activeBrowser=browser;if(stopFailure)throw stopFailure;
  stage='network-preflight';await net.preflight(browser,{version,indexSha256:hash(index)});net.assertIsolated();
  for(const name of cases){
   stage=name+':installed-shell';unreachable=false;ownedFailures.length=0;
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'allow'});contexts.add(context);await net.attachContext(context);
   await context.addInitScript(observeApiFetch);await context.addInitScript(seed,{now});
   const page=await context.newPage(),errors=[],errorDetails=[],transportFailures=[],writes=[],responses=[],parentResponses=[],parentFailures=[],requestStart=moduleRequests.length;let caseError;
   page.on('pageerror',failure=>{errors.push(failure.message);errorDetails.push({name:failure.name,message:failure.message,stack:failure.stack,stage,unreachable});});
   page.on('requestfailed',request=>{const url=new URL(request.url());if(url.origin===origin&&transportFailures.length<64)transportFailures.push({method:request.method(),path:url.pathname+url.search,error:request.failure()?.errorText,stage,unreachable});});
   page.on('response',response=>{if(new URL(response.url()).pathname==='/assets/js/all-sports-ui.js')responses.push({url:response.url(),status:response.status(),fromServiceWorker:response.fromServiceWorker()});});
   const parentPath=url=>parentDependencies.some(d=>new URL(d.url,origin).href===url);
   page.on('response',response=>{if(parentPath(response.url()))parentResponses.push({url:new URL(response.url()).pathname+new URL(response.url()).search,status:response.status(),fromServiceWorker:response.fromServiceWorker()});});
   page.on('requestfailed',request=>{if(parentPath(request.url()))parentFailures.push({url:new URL(request.url()).pathname+new URL(request.url()).search,error:request.failure()?.errorText});});
   page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin&&url.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(request.method())){const headers=request.headers();writes.push({method:request.method(),url:url.pathname+url.search,body:request.postData(),contentType:headers['content-type'],authorization:Boolean(headers.authorization)});}});
   try{
    await page.goto(origin+'/?all-sports-installed-qa=1',{waitUntil:'domcontentloaded'});await startDocument(page);await installedShell(page);
    await audit(page,writes,0);writes.length=0;parentResponses.length=0;parentFailures.length=0;
    // Use the normal installed validator's fresh controlled document boundary.
    // Merely observing controller after clients.claim does not establish that
    // this initial document's earlier resource requests traversed the worker.
    const installedDocument=await page.reload({waitUntil:'domcontentloaded'});assert(installedDocument?.fromServiceWorker(),'The installed setup document traversed the actual worker');
    await startDocument(page);const shell=await installedShell(page);
    assert.equal(await cachedModule(page),null,'The optional All Sports module is absent after a fresh install');assert.equal(await page.evaluate(()=>typeof createAllSportsView),'undefined');
    assert.equal(moduleRequests.length,requestStart,'Installation did not fetch or precache All Sports');
    await enterMatchCentre(page);const saved=await personal(page);stage=name+':feature';
    assert.equal(await cachedModule(page),null);assert.equal(moduleRequests.length,requestStart);
    assert(parentResponses.length&&parentResponses.every(response=>response.fromServiceWorker&&response.status===200),'Installed parent dependencies traverse the actual worker');
    if(name==='first-use'){
     unreachable=true;await context.setOffline(true);
     await page.getByRole('tab',{name:'All Sports',exact:true}).click();
     await page.getByRole('button',{name:'Retry',exact:true}).waitFor();assert.match(await page.locator('#listView').innerText(),/All Sports View could not load\./);
     assert(await page.getByRole('button',{name:'Back to Match Centre',exact:true}).isVisible());assert.equal(await page.locator('[data-sports-id]').count(),0);
     await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
     assert.equal(await cachedModule(page),null);assert.equal(await page.evaluate(()=>typeof createAllSportsView),'undefined');
     await page.getByRole('button',{name:'Back to Match Centre',exact:true}).click();assert.equal(await page.getByRole('tab',{name:'Followed',exact:true}).getAttribute('aria-selected'),'true');
     await assertPersonal(page,saved);const publicFollowedReads=await audit(page,writes,2);assert.deepEqual(errors,[]);net.assertIsolated();
     console.log(JSON.stringify({engine,case:name,shell,installedDocumentFromWorker:true,firstUseOffline:true,optionalModuleAbsent:true,honestRetryAndBack:true,noCardsClaimed:true,personalChoicesPreserved:true,publicFollowedReads,errors}));
    }else{
     await page.getByRole('tab',{name:'All Sports',exact:true}).click();await cards(page);
     await page.waitForFunction(()=>Boolean(disposableStore.initial('all-sports:v1:public:today',null)));
     assert(await page.evaluate(()=>disposableStore.flush()),'The real public store flushed successfully');
     const persisted=await page.evaluate(()=>disposableStore.hydrate('all-sports:v1:public:today',null));assert.equal(persisted.events.length,fixtures.length);
     await page.waitForFunction(async({version,modulePath})=>Boolean(await(await caches.open('nothingsport-shell-v'+version)).match(modulePath)),{version,modulePath});
     assert.equal(await cachedModule(page),moduleHash,'The actual worker cached the exact optional module on use');assert.equal(moduleRequests.length,requestStart+1);
     assert(responses.length===1&&responses[0].fromServiceWorker&&responses[0].status===200,'Online first use traversed the actual controlling worker');
     await assertPersonal(page,saved);const onlineReads=await audit(page,writes,1),beforeReload=await personal(page),documentToken=await page.evaluate(()=>qaDocumentToken);
     const dependencies=await parentCache(page);console.log(JSON.stringify({engine,case:name,boundary:'online-before-offline',parentDependencies:dependencies,parentResponses}));
     assert(dependencies.every(dependency=>dependency.sourceMatches),'Every actually used parent dependency is saved through the existing worker');
     const cachedBefore=JSON.stringify(persisted);await page.evaluate(next=>sessionStorage.setItem('qa_as_offline_clock',String(next)),now+5*60000);
     net.assertIsolated();await context.setOffline(true);assert.equal(await page.evaluate(()=>navigator.onLine),false);
     // Match the existing installed QA: an unreachable owned origin exercises
     // navigation through the worker in WebKit, whose offline emulator can
     // reject navigation before dispatching a worker fetch. No response is faked.
     await context.setOffline(false);unreachable=true;writes.length=0;const rejectedBefore=failedOwned;
     stage=name+':offline-document';const navigation=await page.reload({waitUntil:'domcontentloaded'});assert(navigation?.fromServiceWorker(),'Offline document came from the real worker');
     await startDocument(page);assert.notEqual(await page.evaluate(()=>qaDocumentToken),documentToken,'A new document, not a retained in-memory view');
     assert.equal(await page.evaluate(()=>typeof createAllSportsView),'undefined','The document discarded the old module/controller memory');
     await installedShell(page);assert.equal(await cachedModule(page),moduleHash);await assertPersonal(page,beforeReload,{acrossDocument:true});
     await enterMatchCentre(page);const offlineBaseline=await personal(page);stage=name+':offline-feature';
     await page.getByRole('tab',{name:'All Sports',exact:true}).click();await cards(page);
     await page.waitForFunction(()=>/unavailable|incomplete|last available/i.test(document.querySelector('.as-notice')?.textContent||'')&&!document.querySelector('[aria-label="Refresh All Sports View"]').disabled);
     const notice=await page.locator('.as-notice').innerText();assert.match(notice,/unavailable|incomplete|last available/i);
     assert(await page.evaluate(ids=>ids.every(id=>profileFixtureEvents.get(id)?.stale===true),fixtures.map(e=>e.id)),'All restored fixtures are marked stale');
     assert.match(await page.locator('[data-sports-id="fixture:nrl:offline-ongoing"] .as-qualifier').innerText(),/Awaiting update/);
     assert(!/Underway/.test(await page.locator('[data-sports-id="fixture:nrl:offline-ongoing"] .as-qualifier').innerText()));
     assert.equal(JSON.stringify(await page.evaluate(()=>disposableStore.hydrate('all-sports:v1:public:today',null))),cachedBefore,'Offline errors do not overwrite the last-good public snapshot');
     assert.equal(responses.length,2);assert(responses[1].fromServiceWorker&&responses[1].status===200);assert.equal(moduleRequests.length,requestStart+1,'Offline module use did not reach the origin');
     assert(failedOwned>rejectedBefore,'Owned origin was actually unreachable at the transport boundary');
     assert.deepEqual(await page.evaluate(async version=>(await(await caches.open('nothingsport-shell-v'+version)).keys()).map(r=>new URL(r.url).pathname).filter(p=>p.startsWith('/api/')),version),[], 'API responses were not placed in the worker shell cache');
     await assertPersonal(page,offlineBaseline);const offlineReads=await audit(page,writes,1);net.assertIsolated();
     const classification=classify({engine,origin,workerVerified:true,allowedIds:fixtures.map(e=>e.id),errors:errorDetails,requests:transportFailures,server:ownedFailures});
     console.log(JSON.stringify({engine,case:name,rawErrors:errorDetails,transportFailures,ownedFailures,expectedWorkerTransportPairs:classification.expected,unclassifiedErrors:classification.unexpected}));
     assert.deepEqual(classification.unexpected,[],'Every reported error must have exact owned worker-transport failure proof');
     console.log(JSON.stringify({engine,case:name,shell,installedDocumentFromWorker:true,onlineFirstUseCachedModule:true,offlineDocumentFromWorker:true,newDocument:true,offlineModuleFromWorker:true,publicStoreRestored:true,fixtures:fixtures.length,sourceFactsAndClocksPreserved:true,staleAll:true,notice,privateWrites:0,noFeedPoller:true,personalChoicesPreserved:true,onlineReads,offlineReads,rawErrorCount:errors.length,expectedWorkerTransportPairs:classification.expected.length,unclassifiedErrors:classification.unexpected.length}));
    }
   }catch(failure){caseError=failure;console.error(JSON.stringify({engine,case:name,stage,error:failure.message,errors,errorDetails,transportFailures,ownedFailures,notice:await page.locator('#listView').innerText().catch(()=>null),apiRequests:apiRequests.slice(-8),moduleResponses:responses,parentResponses,parentFailures,parentDependencies:await parentCache(page).catch(()=>null),network:net.snapshot()}));throw failure;}
   finally{try{const closure=await closeCaseContext(context,caseError);if(!closure.closed)console.error(JSON.stringify({engine,case:name,contextCleanup:closure}));}finally{contexts.delete(context);unreachable=false;}}
  }
 }catch(failure){error=failure;console.error(JSON.stringify({engine,stage,setupFailure:['setup','network-preflight'].includes(stage)||stage.endsWith(':installed-shell'),error:failure.message}));throw failure;}
 finally{
  for(const context of contexts){const closure=await closeCaseContext(context,error);if(!closure.closed)console.error(JSON.stringify({engine,contextCleanup:closure}));}
  try{await net.close(browser,server,error);}finally{activeBrowser=null;console.log(JSON.stringify({engine,isolationAndCleanup:net.snapshot()}));}
 }
}
async function main(){
 const engines=(process.env.ALL_SPORTS_OFFLINE_ENGINES||'chromium,webkit').split(','),cases=(process.env.ALL_SPORTS_OFFLINE_CASES||'first-use,return').split(',');
 assert(engines.length&&new Set(engines).size===engines.length&&engines.every(e=>['chromium','webkit'].includes(e)),'Only the two installed browser engines are supported');
 assert(cases.length&&new Set(cases).size===cases.length&&cases.every(e=>['first-use','return'].includes(e)),'Only the two bounded offline cases are supported');
 const free=()=>{const disk=fs.statfsSync(root);return disk.bavail*disk.bsize;};assert(free()>=4.5*1024**3,'Browser lane entry needs 4.5 GiB free');
 const deadline=Math.min(Date.now()+120000,Date.parse(process.env.ALL_SPORTS_DEADLINE||'')||Infinity),watchdog=setInterval(()=>{
  if(!stopFailure&&(Date.now()>deadline||free()<3*1024**3)){stopFailure=Error('Offline browser allocation or host reserve exceeded');console.error(stopFailure.message);void activeBrowser?.close();}
 },1000);
 console.log(JSON.stringify({suite:'all-sports-installed-offline.v1',engines,cases,version,indexSha256:hash(index),moduleSha256:moduleHash,constructedLoopbackFixtures:true,productionFreshness:false,physicalDeviceProof:false}));
 try{const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');for(const engine of engines){if(stopFailure)throw stopFailure;await engineRun(pw,engine,cases);if(stopFailure)throw stopFailure;}}
 finally{clearInterval(watchdog);}
}
if(require.main===module)(process.argv.includes('--check-cleanup')?checkCleanup():process.argv.includes('--check-fixtures')?checkFixtures():main()).catch(failure=>{console.error(failure);process.exitCode=1;});
module.exports={main,closeCaseContext};
