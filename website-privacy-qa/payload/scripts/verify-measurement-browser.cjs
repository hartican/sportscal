'use strict';
// Standalone test-only payload runner. It never publishes a Site or visits the
// real app. --verify-only is safe on the source Mac; browsers are Linux-only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const args=process.argv.slice(2),option=name=>args.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const root=path.resolve(option('--root')||path.join(__dirname,'..')),manifestPath=option('--manifest');
const ORIGIN='https://nothingsport.com',PIXEL='1149008224326641',KEY='ns-website-measurement-v1';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=file=>fs.readFileSync(path.join(root,file));
function ingress(request,clock){const state=clock.scope();return Object.freeze({id:clock.next(),initiatedAtMs:clock.now(),phase:state.phase,withdrawalSeq:state.withdrawalSeq,url:request.url(),method:request.method(),resourceType:request.resourceType()});}
function stamp(clock){const state=clock.scope();return Object.freeze({seq:clock.next(),observedAtMs:clock.now(),phase:state.phase,withdrawalSeq:state.withdrawalSeq});}
async function bounded(promise,label,ms=15000){let timer;try{return await Promise.race([promise,new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error(label+' observation timed out')),ms);})]);}finally{clearTimeout(timer);}}
async function captureRequest(request,initial,clock){
 const headerObservation={started:stamp(clock)},headers=await bounded(request.allHeaders(),'request headers');headerObservation.completed=stamp(clock);
 const body=request.postData()||'',row={...initial,headerObservation,headers:Object.fromEntries(Object.entries(headers).filter(([key])=>!['authorization','proxy-authorization'].includes(key.toLowerCase()))),body:body.slice(0,131072),bodyBytes:Buffer.byteLength(body),credentialHeader:Boolean(headers.authorization||headers['proxy-authorization'])};
 row.documentObservation={started:stamp(clock)};
 try{row.document=await bounded(request.frame().evaluate(()=>({url:location.href,referrer:document.referrer,consent:localStorage.getItem('ns-website-measurement-v1')})),'request document');}catch{row.documentCaptureError=true;}
 row.documentObservation.completed=stamp(clock);
 return row;
}
async function responseReceipt(response,requestID,clock){
 const headerEvent=stamp(clock),finish=bounded(Promise.resolve().then(()=>response.finished()),'response finished').then(error=>({...stamp(clock),status:error?'failed':'finished',...(error?{error:String(error.message||error)}:{})}),error=>({...stamp(clock),status:'unobserved',error:error.message}));
 const header=await bounded(Promise.resolve().then(()=>response.allHeaders()),'response headers').then(headers=>({headers,completed:stamp(clock)}),error=>({error:error.message,completed:stamp(clock)}));
 const completion=await finish,row={seq:headerEvent.seq,requestID,phase:headerEvent.phase,headerEvent,headerObservation:header,completion,status:response.status(),url:response.url(),headers:header.headers||{}};
 if(header.error||completion.status==='unobserved')row.captureError=header.error||completion.error;
 if(new URL(response.url()).pathname.endsWith('/fbevents.js')&&completion.status==='finished')try{const bytes=await bounded(response.body(),'SDK body');row.sdkBytes=bytes.length;row.sdkSha256=hash(bytes);}catch(error){row.captureError=error.message;}
 return row;
}
function createAttempt(out,report,io=fs){
 io.mkdirSync(path.dirname(out),{recursive:true});io.mkdirSync(out);
 const file=path.join(out,'browser-privacy-report.json');report.passed=false;report.status='running';io.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return {write(value){const temporary=file+'.next';io.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'});io.renameSync(temporary,file);}};
}
async function drainEvidence(pending,ms=15000){const deadline=performance.now()+ms;while(pending.size){const left=deadline-performance.now();assert(left>0,'Pending observations did not settle');await bounded(Promise.allSettled([...pending]),'pending observations',left);}}
function trackEvidence(pending,promise,onError){let tracked;tracked=Promise.resolve(promise).catch(onError).finally(()=>pending.delete(tracked));pending.add(tracked);return tracked;}
async function ownedAttempt({attempt,report,execute,cleanup,drain,cleanupTimeoutMs=15000}){
 let first=null;report.failures=[];
 const fail=(error,stage)=>{const caught=error instanceof Error?error:Error(String(error)),record={stage,name:caught.name||'Error',message:caught.message,...(caught.fixtureCleanupFailures?{related:caught.fixtureCleanupFailures}:{})};report.failures.push(record);if(!first){first=caught;report.firstError=record;}};
 try{await execute();}catch(error){fail(error,'execute');}
 try{await bounded(Promise.resolve().then(drain),'observations before cleanup',cleanupTimeoutMs);}catch(error){fail(error,'observations-before-cleanup');}
 try{await bounded(Promise.resolve().then(cleanup),'browser cleanup',cleanupTimeoutMs);}catch(error){fail(error,'cleanup');}
 try{await bounded(Promise.resolve().then(drain),'observations after cleanup',cleanupTimeoutMs);}catch(error){fail(error,'observations-after-cleanup');}
 if(report.violations?.length)fail(Error('Privacy or capture violations remain'),'validation');
 report.passed=first===null;report.status=report.passed?'passed':'failed';
 try{attempt.write(report);}catch(error){fail(error,'report-write');report.passed=false;report.status='failed';}
 if(first)throw first;return report;
}
async function fixtureCase(create,body,report,{closeTimeoutMs=15000}={}){
 const f=await create();let first=null,value;const related=[];
 try{value=await body(f);}catch(error){first=error instanceof Error?error:Error(String(error));}
 try{await bounded(Promise.resolve().then(()=>f.close()),'per-fixture close',closeTimeoutMs);}catch(error){
  const caught=error instanceof Error?error:Error(String(error)),failure={kind:'fixture-cleanup-failed',error:caught.message};if(!first)first=caught;related.push(failure);
  try{report.violations.push(failure);}catch(reportError){related.push({kind:'fixture-cleanup-report-failed',error:String(reportError.message||reportError)});}
 }
 if(first){if(related.length)try{first.fixtureCleanupFailures=related;}catch{}throw first;}return value;
}
async function until(predicate,message){const deadline=Date.now()+15000;while(Date.now()<deadline){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error(message);}
function eventFields(row){
 const values=Object.create(null),type=row.headers?.['content-type']||'';
 const supported=new Set(['id','ev','dl','rl','if','ts','iw','cd','sw','sh','v','r','a','ec','fbp','it','coo','rqm','ler','es','tm','eid','exp','expv2','est_source','pmd','plt','tmd','med']);
 function add(key,value){
  assert(supported.has(key),'Unsupported event field: '+key);assert(!Object.hasOwn(values,key),'Duplicate event field: '+key);
  assert(typeof value==='string'&&value.length<=8192&&!/[\r\n\0]/.test(value),'Invalid scalar event field: '+key);
  if(key==='cd')assert(value===''||value==='{}','Custom data is not approved');
  else assert(!/[{}\[\]]/.test(value),'Nested event data is not approved');
  values[key]=value;
 }
 for(const [key,value] of new URL(row.url).searchParams)add(key,value);
 if(row.body){
  if(/^application\/x-www-form-urlencoded(?:;\s*charset=utf-8)?$/i.test(type))for(const [key,value] of new URLSearchParams(row.body))add(key,value);
  else{
   const match=type.match(/^multipart\/form-data;\s*boundary=(?:"([A-Za-z0-9'()+_,.\/:=?-]{1,70})"|([A-Za-z0-9'()+_,.\/:=?-]{1,70}))$/i);
   assert(match,'Unsupported event encoding; JSON/batched/nested envelopes are not accepted');
   const boundary=match[1]||match[2],first='--'+boundary+'\r\n',last='\r\n--'+boundary+'--\r\n';
   assert(row.body.startsWith(first)&&row.body.endsWith(last),'Invalid multipart event boundary');
   for(const part of row.body.slice(first.length,-last.length).split('\r\n--'+boundary+'\r\n')){
    const field=part.match(/^Content-Disposition: form-data; name="([A-Za-z0-9_\[\]]+)"\r\n\r\n([^\r\n]*)$/i);
    assert(field,'Unsupported multipart field, file or nested content');add(field[1],field[2]);
   }
  }
 }
 assert.equal(values.id,PIXEL);assert(['PageView','OpenApp'].includes(values.ev),'Unsupported event name');
 const documentURL=new URL(values.dl);assert.equal(documentURL.origin,ORIGIN);assert.equal(documentURL.pathname,'/');assert.equal(documentURL.search,'');assert(['','#whats-on','#how-it-works','#get-the-app'].includes(documentURL.hash));assert.equal(values.rl||'','');
 return values;
}
function sourceManifest(){
 assert(manifestPath,'--manifest=<hash-manifest.json> is required');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 assert.equal(manifest.origin,ORIGIN);assert.equal(manifest.pixel,PIXEL);
 assert.equal(manifest.originalSource,'6b023136d56548c13e458a30d4a9afbe983ade13');
 assert(/^[a-f0-9]{40}$/.test(manifest.candidateSource));
 for(const item of manifest.files){assert(!path.isAbsolute(item.path)&&!item.path.split('/').includes('..'));const bytes=read(item.path);assert.equal(bytes.length,item.bytes,item.path+' bytes changed');assert.equal(hash(bytes),item.sha256,item.path+' hash changed');}
 for(const file of ['site/index.html','public/measurement.js','public/measurement-start.js','public/website.js','lib/measurement-reload.mjs','app/privacy/reload/route.ts','scripts/verify-measurement-browser.cjs'])assert(manifest.files.some(row=>row.path===file),'Missing '+file);
 assert(read('public/measurement-start.js').toString().includes('sdkEnabled:false'),'Published bootstrap must remain gated until review');
 return manifest;
}
async function run(){
 if(args.includes('--verify-only')){const manifest=sourceManifest();console.log(JSON.stringify({passed:true,kind:'payload-integrity-only',candidateSource:manifest.candidateSource,files:manifest.files.length,nativeExecuted:false}));return;}
 const engine=option('--engine'),live=args.includes('--live-meta'),out=option('--output');assert(out&&path.isAbsolute(out),'An absolute owned QA output directory is required');
 const report={candidateSource:null,originalSource:'6b023136d56548c13e458a30d4a9afbe983ade13',engine,mode:live?'actual-sdk-network':'mock-sdk-browser',passed:false,cases:[],initiations:[],requests:[],responses:[],states:[],documents:[],cookies:[],violations:[],captureLimits:[
  'First-party responses are fulfilled from the pinned source on the approved domain; no real app/visitor/account/feed request is made. Images/fonts are placeholders, so this is not visual or hosted/Worker acceptance.',
  'The explicit QA bootstrap enables the actual controller only in an owned test context. The published bootstrap remains sdkEnabled:false; this is not acceptance of an enabled production bootstrap.',
  'Ingress scope, later document capture, header events and actual response settlement are distinct. No remote history or accepted/in-flight request is undone.'
 ],qaBootstrapProjections:[]};
 const attempt=createAttempt(out,report);let browser=null,measurementReload,manifest,maxRequests=0,requestCount=0,sequence=0;
 const requestIDs=new WeakMap(),pendingEvidence=new Set();
 function evidence(promise){return trackEvidence(pendingEvidence,promise,error=>report.violations.push({kind:'capture-error',error:String(error.message)}));}
 const feed={ok:true,events:[{id:'event:qa:cricket',name:'QA cricket',sport:'cricket',competition:'QA fixture',start:new Date(Date.now()+3600000).toISOString(),status:'scheduled',participants:[]},{id:'event:qa:football',name:'QA football',sport:'football',competition:'QA fixture',start:new Date(Date.now()+7200000).toISOString(),status:'scheduled',participants:[]}],fetchedAt:new Date().toISOString()};
 const localFiles=new Set();
 const canaries=['NS_QA_QUERY_PRIVATE','NS_QA_REFERRER_PRIVATE','NS_QA_HASH_PRIVATE'];
 function containsCanary(value){let text=value;for(let i=0;i<3;i++){if(canaries.some(canary=>text.includes(canary)))return true;try{text=decodeURIComponent(text);}catch{break;}}return false;}
 async function fixture({enable=false,hold=false,holdNetwork=false,stored=null,brokenStorage=false,feedFailure=false,emptyFeed=false,origin=ORIGIN}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',storageState:{cookies:[],origins:[]}}),events=[];let phase='before-consent',withdrawalSeq=null,releaseAsset=null,assetHeld=false;
  const clock={scope:()=>({phase,withdrawalSeq}),next:()=>++sequence,now:()=>performance.now()};
  await context.exposeBinding('__qaMeasurementState',(source,state)=>{report.states.push({seq:++sequence,phase,state});});
  await context.exposeBinding('__qaMeasurementEvent',(source,event)=>{events.push(event);});
  await context.addInitScript(({key,stored,hold,brokenStorage})=>{
   window.__qaHold=hold;window.__qaRelease=null;
   if(stored!==null&&localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({version:1,allowed:stored}));
   if(brokenStorage){Object.defineProperty(window,'localStorage',{get(){throw Error('Owned QA storage fault');}});}
  },{key:KEY,stored,hold,brokenStorage});
  const routeRequest=async route=>{
   const request=route.request(),initial=ingress(request,clock),url=new URL(request.url()),id=initial.id;requestIDs.set(request,id);report.initiations.push(initial);
   if(url.origin==='https://nothingsport.app'){report.requests.push({...initial,kind:'app-open-blocked'});await route.abort('blockedbyclient');return;}
   if(url.origin==='https://qa-entry.invalid'){await route.fulfill({contentType:'text/html',body:`<!doctype html><a id="enter" href="${ORIGIN}/?fbclid=NS_QA_QUERY_PRIVATE&amp;extra=NS_QA_QUERY_PRIVATE#whats-on">Enter website</a>`});return;}
   if(url.origin===origin){
    if(url.pathname==='/privacy/reload'){
     const response=measurementReload(new Request(request.url()));await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:''});return;
    }
    if(url.pathname==='/api/matchday'){await route.fulfill({status:feedFailure?503:200,contentType:'application/json',body:JSON.stringify(feedFailure?{ok:false}:emptyFeed?{...feed,events:[]}:feed)});return;}
    if(url.pathname==='/'){
     await route.fulfill({contentType:'text/html',headers:{'Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store'},body:read('site/index.html')});return;
    }
    if(url.pathname==='/measurement-start.js'&&enable){
     const mock=live?'':`,createSdk:()=>({ready:window.__qaHold?new Promise(resolve=>window.__qaRelease=resolve):Promise.resolve(),grant(){window.__qaMeasurementEvent('grant')},pageView(){window.__qaMeasurementEvent('PageView')},openApp(){window.__qaMeasurementEvent('OpenApp')},revoke(){window.__qaMeasurementEvent('revoke')},dispose(){window.__qaMeasurementEvent('dispose')}})${hold?",navigate:value=>window.__qaMeasurementEvent('navigation-held-for-lifetime-fault')":''}`;
     const projection=`NothingSportMeasurement.mount(window,{sdkEnabled:true,onState:state=>window.__qaMeasurementState(state)${mock}});`;
     report.qaBootstrapProjections.push({kind:'QA-only explicit controller enable',origin,sha256:hash(projection),publishedBootstrapHash:hash(read('public/measurement-start.js'))});
     await route.fulfill({contentType:'text/javascript',body:projection});return;
    }
    if(localFiles.has(url.pathname)){const extension=path.extname(url.pathname);await route.fulfill({contentType:extension==='.css'?'text/css':'text/javascript',body:read('public'+url.pathname)});return;}
    if(request.resourceType()==='image'){await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>'});return;}
    await route.fulfill({status:204,body:''});return;
   }
   const metaHost=['connect.facebook.net','www.facebook.com','facebook.com'].includes(url.hostname);
   const row={...await captureRequest(request,initial,clock),kind:metaHost?'meta':'unexpected-external'};
   if(row.credentialHeader)report.violations.push({kind:'unexpected-credential-header',id});
   if(row.documentCaptureError)report.violations.push({kind:'request-document-capture-unavailable',id});
   report.requests.push(row);
   if(row.bodyBytes>131072)report.violations.push({kind:'body-capture-truncated',id});
   const canary=containsCanary(row.url+JSON.stringify(row.headers)+row.body);if(canary)report.violations.push({kind:'private-canary-in-request',id});
   if(!metaHost){report.violations.push({kind:'unexpected-external-request',id});await route.abort();return;}
   requestCount++;
   if(row.credentialHeader||row.documentCaptureError||row.bodyBytes>131072||canary){await route.abort();return;}
   if(['/tr','/tr/'].includes(url.pathname))try{row.event=eventFields(row);}catch(error){report.violations.push({kind:'unsupported-event-envelope',id,error:error.message});await route.abort();return;}
   let consent=null;try{consent=JSON.parse(row.document?.consent||'null');}catch{}
   row.forwardingDecision=stamp(clock);
   if(!live||row.phase!=='consented'||row.forwardingDecision.phase!=='consented'||consent?.version!==1||consent.allowed!==true||!row.document||row.document.referrer!==''||new URL(row.document.url).search||requestCount>maxRequests){report.violations.push({kind:'meta-request-not-forwarded',id,ingressPhase:row.phase,decisionPhase:row.forwardingDecision.phase,budget:maxRequests});await route.abort();return;}
   row.forwardRequested=stamp(clock);
   if(holdNetwork&&url.pathname.endsWith('/fbevents.js')){
    const response=await route.fetch({timeout:15000,maxRedirects:0}),bytes=await response.body();
    report.responses.push({seq:++sequence,requestID:id,kind:'real-sdk-asset-response-held-by-QA',phase,completion:{...stamp(clock),status:'finished'},status:response.status(),sdkBytes:bytes.length,sdkSha256:hash(bytes)});
    await new Promise(resolve=>{releaseAsset=resolve;assetHeld=true;});
    try{await route.fulfill({response});}catch{report.captureLimits.push('A held pre-withdrawal SDK response could not be delivered to its discarded document; this is distinct from a new post-withdrawal request.');}
    return;
   }
   await route.continue();
  };
  await context.route('**/*',route=>{const pending=routeRequest(route);evidence(pending);return pending.catch(async()=>{try{await route.abort();}catch{}});});
  context.on('response',response=>{
   const url=new URL(response.url());if(!['connect.facebook.net','www.facebook.com','facebook.com'].includes(url.hostname))return;
   evidence(responseReceipt(response,requestIDs.get(response.request()),clock).then(row=>{report.responses.push(row);if(row.captureError)report.violations.push({kind:'response-capture-incomplete',requestID:row.requestID,error:row.captureError});}));
  });
  context.on('requestfailed',request=>{if(requestIDs.has(request))report.responses.push({seq:++sequence,requestID:requestIDs.get(request),kind:'request-failed',phase,settledAtMs:performance.now(),error:request.failure()?.errorText});});
  const page=await context.newPage();page.on('pageerror',error=>report.violations.push({kind:'page-error',phase,error:error.message}));
  const api={context,page,events,get assetHeld(){return assetHeld;},releaseAsset(){releaseAsset?.();},setPhase(next){phase=next;if(next==='withdrawn')withdrawalSeq=++sequence;},async document(label){const value=await page.evaluate(()=>({url:location.href,referrer:document.referrer,timeOrigin:performance.timeOrigin}));report.documents.push({seq:++sequence,label,phase,...value});return value;},async cookies(label){const rows=await context.cookies();report.cookies.push({seq:++sequence,label,phase,rows});return rows;},async close(){releaseAsset?.();await context.close();}};
  return api;
 }
 const useFixture=(options,body)=>fixtureCase(()=>fixture(options),body,report);
 async function activate(f,locator){
  if(await locator.evaluate(element=>element.closest('details')?.open===false))await locator.locator('xpath=ancestor::details').locator('summary').first().click();
  if(!await locator.isVisible())await f.page.setViewportSize({width:1280,height:900});
  if(!await locator.isVisible())await f.page.setViewportSize({width:390,height:844});
  assert(await locator.isVisible(),'App link must be reachable through the actual UI');
  const before=f.context.pages(),request=f.context.waitForEvent('request',{predicate:request=>new URL(request.url()).origin==='https://nothingsport.app',timeout:15000});
  await locator.click({modifiers:['Control']});await request;
  for(const page of f.context.pages())if(page!==f.page&&!before.includes(page))await bounded(page.close(),'QA popup close');
 }
 const count=(f,name)=>f.events.filter(value=>value===name).length;
 async function mockedOpen(f,locator){const before=count(f,'OpenApp');await activate(f,locator);await until(()=>count(f,'OpenApp')===before+1,'Actual delegated app-link event was not observed');}
 function eventRequests(){return report.requests.filter(row=>row.kind==='meta'&&row.forwardRequested&&/\/tr\/?(?:\?|$)/.test(row.url));}
 async function actualEvents(name,minimum){await until(()=>eventRequests().filter(row=>{try{return eventFields(row).ev===name;}catch{return false;}}).length>=minimum,'No real '+name+' request observed');}
 async function check(name,run){try{await run();report.cases.push({name,passed:true});}catch(error){report.cases.push({name,passed:false,error:error.message});throw error;}}
 await ownedAttempt({attempt,report,execute:async()=>{
  manifest=sourceManifest();report.candidateSource=manifest.candidateSource;report.originalSource=manifest.originalSource;attempt.write(report);
  assert.equal(process.platform,'linux','No local Mac browser launch is permitted');assert(['chromium','webkit'].includes(engine),'Choose exactly one Linux engine per allocated profile');
  if(live){assert.equal(process.env.NS_META_QA_SOURCE,manifest.candidateSource,'ROOT must allocate an exact-source real SDK window');assert.equal(process.env.NS_META_QA_ORIGIN,ORIGIN);assert.equal(process.env.NS_META_QA_PIXEL,PIXEL);}
  maxRequests=Number(process.env.NS_META_QA_MAX_REQUESTS||0);if(live)assert(Number.isInteger(maxRequests)&&maxRequests>0&&maxRequests<=40,'ROOT must bound the Meta request budget (1–40)');
  for(const row of manifest.files.filter(row=>row.path.startsWith('public/')))localFiles.add('/'+row.path.slice(7));
  const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');({measurementReload}=await import(pathToFileURL(path.join(root,'lib/measurement-reload.mjs')).href));browser=await pw[engine].launch({headless:true});
  await check('shipped gate, refusal, unavailable storage and other hosts have no Meta',async()=>{
   for(const settings of [{stored:true},{enable:true,stored:false},{enable:true,stored:true,brokenStorage:true},{enable:true,stored:true,origin:'https://preview.invalid'}]){
    await useFixture(settings,async f=>{await f.page.goto((settings.origin||ORIGIN)+'/',{waitUntil:'domcontentloaded'});await f.page.waitForFunction(()=>!!window.NothingSportMeasurement);assert.equal(await f.page.locator('script[src*="connect.facebook.net"]').count(),0);assert.equal((await f.cookies('off-negative')).length,0);await f.document('off-negative');});
   }
  });
  if(!live){
   await check('all static app links and dynamic installer/dialog/empty/failure links',async()=>{
    await useFixture({enable:true,stored:true},async f=>{
     await f.page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});await f.page.waitForFunction(()=>document.getElementById('measurement-status').textContent==='Optional measurement is on.');
     const staticLinks=await f.page.locator('a[href^="https://nothingsport.app"]').count();assert(staticLinks>=10);
     for(let i=0;i<staticLinks;i++)await mockedOpen(f,f.page.locator('a[href^="https://nothingsport.app"]').nth(i));
     await f.page.locator('[data-install]').first().click();await mockedOpen(f,f.page.locator('#main-dialog a[href^="https://nothingsport.app"]').first());await f.page.locator('.close-dialog').click();
     await f.page.locator('[data-event]').first().click();await mockedOpen(f,f.page.locator('#main-dialog a[href^="https://nothingsport.app"]').first());await f.page.locator('.close-dialog').click();
     const before=count(f,'OpenApp');await f.page.locator('a[href="#how-it-works"]').click();await f.page.locator('#refresh-feed').click();await f.page.setViewportSize({width:1280,height:900});await f.page.locator('img[src="/assets/app-qr.svg"]').first().click();assert.equal(count(f,'OpenApp'),before);assert.equal(count(f,'PageView'),1);
    });
    for(const options of [{feedFailure:true},{emptyFeed:true}])await useFixture({enable:true,stored:true,...options},async failed=>{await failed.page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});await failed.page.waitForFunction(()=>document.getElementById('measurement-status').textContent==='Optional measurement is on.');await mockedOpen(failed,failed.page.locator('.empty-state a[href^="https://nothingsport.app"]').first());});
   });
   await check('delayed SDK, withdrawal, old completion, and regrant',async()=>{
    await useFixture({enable:true,stored:true,hold:true},async f=>{await f.page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});await f.page.waitForFunction(()=>typeof window.__qaRelease==='function');await f.page.locator('[data-measurement-manage]').click();await f.page.locator('[data-measurement-choice="refuse"]').click();await f.page.evaluate(()=>window.__qaRelease());await until(()=>f.events.includes('navigation-held-for-lifetime-fault'),'Withdrawal did not reach the actual owner');assert.equal(count(f,'PageView'),0);assert.equal(count(f,'OpenApp'),0);assert.equal((await f.cookies('after-delayed-revoke')).length,0);});
   });
   await check('failed refusal persistence reaches a forced-off fresh document',async()=>{
    await useFixture({enable:true,stored:true},async f=>{await f.page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});await f.page.waitForFunction(()=>document.getElementById('measurement-status').textContent==='Optional measurement is on.');const old=await f.page.evaluate(()=>performance.timeOrigin);
     await f.page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='ns-website-measurement-v1')throw Error('Owned QA refusal storage fault');return original.call(this,key,value);};});
     await f.page.locator('[data-measurement-manage]').click();await f.page.locator('[data-measurement-choice="refuse"]').click();await f.page.waitForFunction(old=>performance.timeOrigin!==old&&location.search==='?privacy=off'&&localStorage.getItem('ns-website-measurement-v1')==='{"version":1,"allowed":false}',old);assert.equal(await f.page.locator('script[src*="facebook"]').count(),0);await f.document('forced-off-storage-fault');
    });
   });
  }
  if(live)await check('real delayed SDK asset cannot start its discarded document',async()=>{
   await useFixture({enable:true,stored:true,holdNetwork:true},async f=>{f.setPhase('consented');await f.page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});await until(()=>f.assetHeld,'Real SDK asset never reached the held-response boundary');const old=(await f.document('sdk-response-held')).timeOrigin;
    await f.page.locator('[data-measurement-manage]').click();f.setPhase('withdrawn');await f.page.locator('[data-measurement-choice="refuse"]').click();await f.page.waitForFunction(old=>performance.timeOrigin!==old&&localStorage.getItem('ns-website-measurement-v1')==='{"version":1,"allowed":false}',old);f.releaseAsset();assert.equal(await f.page.locator('script[src*="facebook"]').count(),0);assert.equal((await f.cookies('after-real-delayed-withdrawal')).length,0);await f.document('discarded-sdk-refused-document');
   });
  });
  await check('clean document, request metadata, withdrawal and refused next document',async()=>{
   await useFixture({enable:true},async f=>{
    await f.page.goto('https://qa-entry.invalid/private?ref=NS_QA_REFERRER_PRIVATE',{waitUntil:'domcontentloaded'});await f.page.locator('#enter').click();await f.page.waitForURL(ORIGIN+'/**');
    assert((await f.page.evaluate(()=>document.referrer)).includes('qa-entry.invalid'));assert.equal((await f.cookies('before-opt-in')).length,0);
    await f.document('dirty-entry');
    f.setPhase('consented');await f.page.locator('[data-measurement-choice="allow"]').click();await f.page.waitForFunction(()=>location.href==='https://nothingsport.com/'&&document.referrer===''&&document.getElementById('measurement-status').textContent==='Optional measurement is on.');
    await f.document('clean-before-sdk-events');await f.cookies('after-consent');
    if(live)await actualEvents('PageView',1);else await until(()=>count(f,'PageView')===1,'Initial PageView missing');
    if(live){await activate(f,f.page.locator('a.open-app-link'));await actualEvents('OpenApp',1);}else await mockedOpen(f,f.page.locator('a.open-app-link'));
    await f.page.locator('a[href="#how-it-works"]').click();await f.page.locator('#refresh-feed').click();
    await f.page.locator('[data-install]').first().click();await f.page.locator('[data-copy]').first().click();await f.page.locator('.close-dialog').click();
    await f.page.locator('[data-install]').first().click();if(live){await activate(f,f.page.locator('#main-dialog a[href^="https://nothingsport.app"]').first());await actualEvents('OpenApp',2);}else await mockedOpen(f,f.page.locator('#main-dialog a[href^="https://nothingsport.app"]').first());await f.page.locator('.close-dialog').click();
    const prior=await f.cookies('before-revoke'),oldDocument=(await f.document('before-revoke')).timeOrigin;
    await f.page.locator('[data-measurement-manage]').click();f.setPhase('withdrawn');await f.page.locator('[data-measurement-choice="refuse"]').click();await f.page.waitForFunction(old=>performance.timeOrigin!==old&&localStorage.getItem('ns-website-measurement-v1')==='{"version":1,"allowed":false}',oldDocument);
    const after=await f.cookies('after-revoke');await f.document('refused-new-document');assert.equal(await f.page.locator('script[src*="connect.facebook.net"]').count(),0);
    for(const cookie of after)if(!prior.some(old=>old.name===cookie.name&&old.domain===cookie.domain&&old.path===cookie.path&&old.value===cookie.value))report.violations.push({kind:'cookie-created-or-changed-after-withdrawal',name:cookie.name,domain:cookie.domain});
    await activate(f,f.page.locator('a.open-app-link'));assert.equal(await f.page.locator('script[src*="connect.facebook.net"]').count(),0);
    const regrantDocument=await f.page.evaluate(()=>performance.timeOrigin);await f.page.locator('[data-measurement-manage]').click();f.setPhase('consented');await f.page.locator('[data-measurement-choice="allow"]').click();await f.page.waitForFunction(old=>performance.timeOrigin!==old&&location.href==='https://nothingsport.com/'&&document.referrer===''&&document.getElementById('measurement-status').textContent==='Optional measurement is on.',regrantDocument);
    if(live)await actualEvents('PageView',2);else{await until(()=>count(f,'PageView')===2,'Fresh regrant did not emit one visit');assert.equal(count(f,'OpenApp'),2,'Denied activation was replayed after grant');}
    await f.document('fresh-regrant');
   });
  });
  if(live){
   // Native request evidence, including vendor-generated work, remains visible.
   const events=eventRequests();assert.equal(events.length,4,'Expected exactly two visits and two genuine app-link events');
   const names=[];for(const row of events){const fields=eventFields(row);row.event=fields;assert.equal(fields.id,PIXEL);assert(['PageView','OpenApp'].includes(fields.ev),'Unexpected automatic event');names.push(fields.ev);const url=new URL(fields.dl);assert.equal(url.origin,ORIGIN);assert.equal(url.pathname,'/');assert.equal(url.search,'');assert(['','#whats-on','#how-it-works','#get-the-app'].includes(url.hash));assert.equal(fields.rl||'','');assert(!Object.keys(fields).some(key=>/^ud(?:\[|$)|^cd\[|external_id|^fbc$|fbclid/i.test(key)),'Unapproved contact/custom/click-id metadata');}
   assert.equal(names.filter(name=>name==='PageView').length,2);assert.equal(names.filter(name=>name==='OpenApp').length,2);
   for(const row of report.requests.filter(row=>row.kind==='meta'))assert(!containsCanary(row.url+row.body));
  }
  await drainEvidence(pendingEvidence);assert.equal(report.violations.length,0,'Network, body, lifetime or capture violations remain');
 },drain:()=>drainEvidence(pendingEvidence),cleanup:async()=>{
  if(browser)await browser.close();
 }});
 assert(report.passed,'Browser privacy proof failed or incomplete');
 console.log(JSON.stringify({passed:report.passed,engine,mode:report.mode,metaRequests:requestCount,report:path.join(out,'browser-privacy-report.json')}));
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={eventFields,ingress,captureRequest,responseReceipt,createAttempt,ownedAttempt,drainEvidence,trackEvidence,fixtureCase};
