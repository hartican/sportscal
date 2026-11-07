'use strict';
// Pure VM executes the actual browser snapshot function; no browser or network.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events'),{webcrypto,createHash}=require('node:crypto');
const {create,pageSnapshot,sanitiseSnapshot}=require('./lib/installed-navigation-observation');
const OWN='http://127.0.0.1:12345',SECRET='PRIVATE_PREF_HEADER_QUERY_FIXTURE_ERROR',html='<meta name="app-shell-version" content="595"><p>'+SECRET+'</p>',hash=text=>createHash('sha256').update(text).digest('hex'),expected={version:'595',indexSha256:hash(html)};
async function run(){
 let checks=0;
 async function actual(options={}){
  let opens=0;
  const at=stage=>{if(options.failStage===stage)throw Object.assign(Error(SECRET),{name:options.errorClass||'InvalidStateError'});};
  const context=vm.createContext({URL,TextDecoder,Uint8Array,crypto:{subtle:{digest:async(...args)=>{at('index_digest');return webcrypto.subtle.digest(...args);}}},location:{href:OWN+'/?'+SECRET},document:{querySelector:()=>{at('document_state');return{content:'595'};}},
   navigator:{onLine:true,serviceWorker:{controller:{scriptURL:OWN+'/service-worker.js',state:'activated'},getRegistration:async()=>{at('registration');return{active:{state:'activated'}};}}},
   caches:{keys:async()=>{at('cache_keys');return options.missing?[]:['nothingsport-shell-v595'];},open:async()=>{opens++;at('cache_open');return{match:async()=>{at('cache_match');if(options.noIndex)return null;const response=new Response(options.html??html);return{ok:response.ok,arrayBuffer:async()=>{at('index_body');return response.arrayBuffer();}};}};}}});
  context.expected=expected;const raw=await vm.runInContext('('+pageSnapshot.toString()+')(expected)',context);
  return{value:sanitiseSnapshot(raw,expected),opens};
 }
 const good=await actual();assert.equal(good.value.indexSha256,expected.indexSha256);assert.equal(good.value.indexMatchesSource,true);assert.equal(good.value.controllerMatches,true);assert.equal(good.opens,1);checks++;
 const changed=await actual({html:html.replace('595','594')});assert.equal(changed.value.indexVersion,'594');assert.equal(changed.value.indexSha256,hash(html.replace('595','594')));assert.equal(changed.value.indexMatchesSource,false);checks++;
 const missing=await actual({missing:true});assert.equal(missing.opens,0,'Observation cannot create a missing cache');assert.equal(missing.value.cachePresent,false);assert.equal(missing.value.indexAvailable,false);assert.equal(missing.value.indexMatchesSource,null);checks++;
 const noIndex=await actual({noIndex:true});assert.equal(noIndex.value.indexAvailable,false);checks++;
 const oversized=await actual({html:'a'.repeat(4194305)});assert.equal(oversized.value.indexAvailable,false);assert.equal(oversized.value.indexSha256,null);checks++;
 for(const stage of ['registration','cache_keys','cache_open','cache_match','index_body','index_digest','document_state']){
  const rejected=await actual({failStage:stage});assert.equal(rejected.value.capture,'unavailable');assert.equal(rejected.value.reason,'snapshot_rejected');assert.equal(rejected.value.stage,stage);assert.equal(rejected.value.errorClass,'InvalidStateError');assert(!JSON.stringify(rejected).includes(SECRET));checks++;
 }
 const unknownError=await actual({failStage:'cache_match',errorClass:SECRET});assert.equal(unknownError.value.errorClass,'other');assert(!JSON.stringify(unknownError).includes(SECRET));checks++;
 const invalid=sanitiseSnapshot({documentVersion:SECRET,indexVersion:SECRET,indexSha256:SECRET,controllerState:SECRET,active:SECRET,online:SECRET,headers:SECRET,preferences:SECRET,payload:SECRET},expected);
 assert(!JSON.stringify(invalid).includes(SECRET));assert.equal(invalid.documentVersion,null);assert.equal(invalid.active,'unavailable');assert.equal(invalid.online,null);checks++;
 function setup(options={}){
  const logs=[],page=new EventEmitter(),frame={url:()=>OWN+'/?'+SECRET};page.mainFrame=()=>frame;page.evaluate=options.evaluate|| (async()=>({...good.value}));
  const observer=create({origin:OWN,expectedVersion:expected.version,expectedIndexSha256:expected.indexSha256,log:options.log|| (line=>logs.push(line)),...options.timer});observer.begin(page);
  const request=(url=OWN+'/?'+SECRET,nav=true,main=frame)=>({url:()=>url,isNavigationRequest:()=>nav,frame:()=>main,failure:()=>({errorText:SECRET})});
  return{observer,page,frame,logs,request};
 }
 const f=setup(),request=f.request();await f.observer.beforeReload();
 f.page.emit('request',request);f.observer.serverCutoff({url:'/?'+SECRET,headers:new Proxy({},{get(){throw Error('Headers forbidden');}})});
 f.page.emit('requestfailed',request);f.page.emit('response',{request:()=>request,status:()=>200,fromServiceWorker:()=>true});f.page.emit('framenavigated',f.frame);
 const events=f.observer.snapshot().events;assert.deepEqual(events.map(e=>e.kind),['document_request','owned_server_cutoff','document_failure','document_response','document_commit']);assert.equal(events[0].request,events[2].request);assert.equal(events[3].fromServiceWorker,true);checks++;
 const firstCount=events.length;f.page.emit('request',f.request('https://outside.invalid/'+SECRET));f.page.emit('request',f.request(OWN+'/api/'+SECRET,false));f.page.emit('request',f.request(OWN+'/fixture/'+SECRET,true,{}));f.observer.serverCutoff({url:'https://outside.invalid/'+SECRET});assert.equal(f.observer.snapshot().events.length,firstCount);checks++;
 f.page.emit('request',f.request(OWN+'/fixture/'+SECRET+'?'+SECRET));f.observer.serverCutoff({url:'/api/'+SECRET});
 assert.equal(f.observer.snapshot().events.at(-1).target,'other_owned_document');assert.equal(f.observer.snapshot().cutoffs.other,1);checks++;
 let operations=0;const response={unchanged:true};assert.equal(await f.observer.reload(async()=>{operations++;return response;}),response);assert.equal(operations,1);
 assert(f.logs.every(line=>!line.includes(SECRET)&&!line.includes('127.0.0.1')));for(const name of ['request','response','requestfailed','framenavigated'])assert.equal(f.page.listenerCount(name),0);checks++;
 const many=setup();for(let i=0;i<100;i++)many.page.emit('request',many.request());assert.equal(many.observer.snapshot().events.length,16);assert.equal(many.observer.snapshot().dropped,84);assert(Buffer.byteLength(JSON.stringify(many.observer.snapshot()))<8192);await many.observer.reload(async()=>{});checks++;
 const original=Error('WebKit encountered an internal error '+SECRET),fault=setup({evaluate:async()=>{throw Error(SECRET);},log:()=>{throw Error(SECRET);}});fault.page.off=()=>{throw Error(SECRET);};
 await fault.observer.beforeReload();assert.equal(fault.observer.snapshot().before.capture,'unavailable');assert.equal(fault.observer.snapshot().before.reason,'evaluation_rejected');assert.equal(fault.observer.snapshot().before.evaluationMayStillBePending,false);operations=0;
 await assert.rejects(fault.observer.reload(async()=>{operations++;throw original;}),error=>error===original);assert.equal(operations,1);checks++;
 const thrown=setup();await assert.rejects(thrown.observer.reload(async()=>{throw original;}),error=>error===original);assert(thrown.logs.every(line=>!line.includes(SECRET)));assert(thrown.logs.some(line=>line.includes('original_webkit_internal_error')));checks++;
 const cancelFault=setup({timer:{schedule:()=>0,cancel:()=>{throw Error(SECRET);}}});await cancelFault.observer.beforeReload();assert.equal(cancelFault.observer.snapshot().before.capture,'unavailable');await assert.rejects(cancelFault.observer.reload(async()=>{throw original;}),error=>error===original);checks++;
 let fire,clears=0,late;const expired=setup({evaluate:()=>new Promise(resolve=>{late=resolve;}),timer:{schedule:(fn,ms)=>{assert.equal(ms,1000);fire=fn;return 9;},cancel:id=>{assert.equal(id,9);clears++;}}});
 const pending=expired.observer.beforeReload();fire();await pending;late(good.value);await Promise.resolve();assert.equal(expired.observer.snapshot().before.capture,'unavailable');assert.equal(expired.observer.snapshot().before.reason,'observation_deadline');assert.equal(expired.observer.snapshot().before.stage,'unavailable');assert.equal(expired.observer.snapshot().before.evaluationMayStillBePending,true);assert.equal(clears,1);operations=0;await expired.observer.reload(async()=>{operations++;});assert.equal(operations,1);checks++;
 const bad=setup();bad.page.emit('request',{isNavigationRequest(){throw Error(SECRET);}});bad.observer.serverCutoff({get url(){throw Error(SECRET);}});assert.equal(bad.observer.snapshot().unavailable,2);await bad.observer.reload(async()=>{});assert(bad.logs.every(line=>!line.includes(SECRET)));checks++;
 const noWorkerFlag=setup(),r=noWorkerFlag.request();noWorkerFlag.page.emit('response',{request:()=>r,status:()=>0});assert.equal(noWorkerFlag.observer.snapshot().events[0].fromServiceWorker,null);assert.equal(noWorkerFlag.observer.snapshot().events[0].status,null);await noWorkerFlag.observer.reload(async()=>{});checks++;
 const unsupported=setup(),u=unsupported.request();unsupported.page.emit('response',{request:()=>u,status:()=>200,fromServiceWorker(){throw Error(SECRET);}});assert.equal(unsupported.observer.snapshot().events[0].status,200);assert.equal(unsupported.observer.snapshot().events[0].fromServiceWorker,null);assert.equal(unsupported.observer.snapshot().unavailable,1);await unsupported.observer.reload(async()=>{});checks++;
 const flood=setup();for(let i=0;i<1500;i++)flood.observer.serverCutoff({url:'/api/'+SECRET});flood.page.emit('request',flood.request());assert.equal(flood.observer.snapshot().events.length,1,'Other resource cutoffs cannot displace document signals');assert.equal(flood.observer.snapshot().cutoffs.total,999);assert.equal(flood.observer.snapshot().cutoffs.other,999);await flood.observer.reload(async()=>{});checks++;
 const main=fs.readFileSync(path.join(__dirname,'validate-installed-pwa-upgrade-browser.js'),'utf8');
 assert(main.includes("await navigationObservation.reload(()=>upgraded.reload({waitUntil:'domcontentloaded'}));"));
 assert(main.includes("assert.equal(await upgraded.locator('meta[name=\"app-shell-version\"]').getAttribute('content'),candidateVersion,'Offline navigation uses the validated current shell');"));
 assert(main.includes('await upgraded.waitForTimeout(31000)')&&main.includes('timeout:45000')&&main.includes('await assertCurrentScheduleAndScoreCaches(upgraded)'));
 assert(main.indexOf('if(installedNetwork.handleRequest(req))return;')<main.indexOf('navigationObservation?.serverCutoff(req)'));
 assert(main.indexOf('await context.setOffline(false);networkFailure=true;')<main.indexOf('await navigationObservation.beforeReload();'));checks++;
 return{checks,browserRuns:0,networkRequests:0,originalFailureSwallowed:false};
}
module.exports=run;
if(require.main===module)run().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
