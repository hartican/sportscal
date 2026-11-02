'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const pagination=html.slice(html.indexOf('async function loadNextFeedPage('),html.indexOf('function observeFeedPageSentinel('));
const all=html.slice(html.indexOf('async function loadAllFeedPages('),html.indexOf('function hydrateFeedFilter('));
assert(pagination.startsWith('async function loadNextFeedPage('),'actual mounted pagination boundary');
assert(all.startsWith('async function loadAllFeedPages('),'actual mounted whole-feed loader boundary');
assert.doesNotThrow(()=>new Function(pagination+'\n'+all),'current loaders must parse');
async function check(signedIn,failed=false){
 let release,calls=0;const response=new Promise(resolve=>release=resolve);
 const context={FEED_PAGE_SIZE:20,feedPageLoading:false,feedPageRequest:null,feedViewGeneration:0,serverPersistence:{user:signedIn?{id:'test'}:null},serverFeedNextCursor:signedIn?'next':null,publicFeedManifest:{pages:[{path:'page.json'}]},publicFeedNextPageIndex:0,
 beginInSessionLoading:()=>({progress(){},complete(){},fail(){}}),feedPerformanceNow:()=>0,recordFeedInteraction(){},warmNextFeedPageDuringIdle(){},coerceEventList:p=>p.events,applyFeedEvents(){},setTimeout,console:{warn(){}},
 fetchJson:async()=>{calls++;await response;if(failed)throw Error('offline');return {events:[{id:'fixture'}]};},applyServerFeed:()=>{context.serverFeedNextCursor=null;}};
 context.serverSyncClient={loadFeed:context.fetchJson};vm.createContext(context);vm.runInContext(pagination+'\n'+all,context);
 const scrolling=context.loadNextFeedPage();
 const filtering=context.loadAllFeedPages();
 const outcome=filtering.then(()=>null,error=>error);release();await scrolling;const error=await outcome;
 assert.equal(calls,1,'scrolling and filtering share one request');
 if(failed){assert(error,'real failures remain retryable');const retry=context.loadNextFeedPage();await retry;assert.equal(calls,2,'failed in-flight request is cleared');}
 else assert.equal(error,null,'Filter must await the in-flight page, not report a load failure');
}
const warmSource=html.slice(html.indexOf('function warmNextFeedPageDuringIdle('),html.indexOf('async function loadNextFeedPage('));
assert(warmSource.startsWith('function warmNextFeedPageDuringIdle('),'actual optional Feed warm-up boundary');
const recovery=fs.readFileSync('scripts/validate-account-sync-recovery-browser.js','utf8');
const observerStart=recovery.indexOf('const originalFetch = window.fetch;');
const observer=recovery.slice(observerStart,recovery.indexOf("addEventListener('error'",observerStart));
assert(observer.includes('Reflect.apply(originalFetch, this, args)'),'actual passive diagnostic fetch wrapper');
async function checkObserver(){
 for(const mode of ['success','rejected','synchronous']){
  const failure=new TypeError('Disposable native fetch boundary'),response={ok:true},options={cache:'force-cache'};
  let calls=0,returned;const reports=[];
  const context={URL,document:{baseURI:'http://127.0.0.1:1234/'},location:{origin:'http://127.0.0.1:1234'},
   observedStaticPath:path=>path==='/data/feed/page-002.json',report:(...args)=>reports.push(args)};
  context.window={fetch:function(url,actualOptions){
   calls++;assert.equal(this,context.window);assert.equal(url,'data/feed/page-002.json');assert.equal(actualOptions,options);
   if(mode==='synchronous')throw failure;
   returned=mode==='rejected'?Promise.reject(failure):Promise.resolve(response);return returned;
  }};
  vm.createContext(context);vm.runInContext(observer,context);
  if(mode==='synchronous')assert.throws(()=>context.window.fetch('data/feed/page-002.json',options),error=>error===failure);
  else{
   const actual=context.window.fetch('data/feed/page-002.json',options);
   assert.equal(actual,returned,'observer must return the identical native promise');
   if(mode==='rejected')await assert.rejects(actual,error=>error===failure);else assert.equal(await actual,response);
  }
  assert.equal(calls,1,'observer must not duplicate a request');
  assert.equal(reports.filter(row=>row[0]==='fetch-sync-throw').length,mode==='synchronous'?1:0);
 }
 console.log('Passive fetch observer: identical receiver/arguments/promise/rejection/synchronous error; one underlying call.');
}
async function checkWarm(mode,timerFallback=false){
 const path='data/feed/page-002.json',failure=new TypeError('Disposable fetch start/body failure');
 let callback,calls=0,consumed=0,cancelled=0;const warnings=[],signal={};
 const schedule=(work,options)=>{callback=work;assert.equal(timerFallback?options:options.timeout,timerFallback?600:1800);return 17;};
 const context={publicFeedManifest:{pages:[{path}]},publicFeedNextPageIndex:0,
  serverPersistence:{user:null},warmedPublicFeedPages:new Set(),publicFeedWarmHandle:null,
  window:timerFallback?{setTimeout:schedule}:{requestIdleCallback:schedule},
  AbortSignal:{timeout:ms=>{assert.equal(ms,8000);return signal;}},
  console:{warn:(...args)=>warnings.push(args)},
  fetch:(requested,options)=>{
   calls++;assert.equal(requested,path);assert.equal(options.cache,'force-cache');
   assert.equal(options.credentials,'same-origin');assert.equal(options.signal,signal);
   if(mode==='sync-start')throw failure;
   if(mode==='async-fetch')return Promise.reject(failure);
   return Promise.resolve({ok:mode!=='http',status:503,body:{cancel:async()=>{cancelled++;}},
    arrayBuffer:async()=>{consumed++;if(mode==='body')throw failure;return new ArrayBuffer(0);}});
  }};
 vm.createContext(context);vm.runInContext(warmSource,context);
 assert.equal(context.warmNextFeedPageDuringIdle(),true);
 assert.equal(context.publicFeedWarmHandle,17);
 assert.equal(context.warmNextFeedPageDuringIdle(),false,'one outstanding page warm-up is retained');
 let result;
 assert.doesNotThrow(()=>{result=callback();},'optional preload must contain a synchronous fetch-start failure');
 if(result?.then)await result;
 await new Promise(setImmediate);
 assert.equal(context.publicFeedWarmHandle,null);assert.equal(calls,1,'failure must not start an automatic retry');
 assert.equal(warnings.length,mode==='success'?0:1,'failures remain visible through the existing warning');
 assert.equal(context.warmedPublicFeedPages.has(path),mode==='success','failed optional reads remain retryable');
 assert.equal(cancelled,mode==='http'?1:0);assert.equal(consumed,['success','body'].includes(mode)?1:0);
 if(['sync-start','async-fetch','body'].includes(mode))assert.equal(warnings[0][1],failure,'retain the actual failure');
 context.serverPersistence.user={id:'disposable'};
 assert.equal(context.warmNextFeedPageDuringIdle(),false,'signed-in Feed never acquires a public warm-up');
}
(async()=>{
 for(const signedIn of [false,true])for(const failed of [false,true])await check(signedIn,failed);
 console.log('Feed filtering joins in-flight public/signed-in pagination; real failures clear for retry.');
 await checkObserver();
 for(const timerFallback of [false,true])for(const mode of ['success','async-fetch','http','body','sync-start'])await checkWarm(mode,timerFallback);
 console.log('Optional Feed warm-up: 10 actual-callback controls pass for idle/timer, synchronous start, asynchronous fetch/body and HTTP failure; no automatic retry or account mutation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
