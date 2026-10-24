'use strict';
// Opt-in test observation only. Never imported by the product or its worker.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const PREFIX='[pwa-offline-observer]';
const LIMITS=Object.freeze({events:1024,critical:128,snapshots:8,bytes:524288,field:512,snapshotMs:1500});
const PREFLIGHT_PATH='/__qa_offline_proxy_preflight__';
const CANARIES=Object.freeze({http:'http://ns-offline-http.invalid/proxy-proof',https:'https://ns-offline-https.invalid/proxy-proof'});
const LATE=new Set(['boundary-start','setOffline-true-start','setOffline-true-end','setOffline-false-start','setOffline-false-end',
 'reload-start','reload-resolved','reload-original-error','request','response','requestfinished','requestfailed','origin-socket-destroy',
 'snapshot-unavailable','page-crash','browser-disconnected','cleanup-start','browser-close-error','server-close-error','diagnostic-stop-not-release-acceptance']);
function proxyTarget(req,origin,connect=false){
 try{
  const owned=new URL(origin),raw=req.url;
  if(typeof raw!=='string'||/[\\\r\n\s]/.test(raw))return{allow:false,canary:null};
  if(connect)return{allow:false,canary:req.method==='CONNECT'&&raw==='ns-offline-https.invalid:443'?'https':null};
  const target=new URL(raw,origin),relative=raw.startsWith('/')&&!raw.startsWith('//');
  const absolute=raw===origin||raw.startsWith(origin+'/')||raw.startsWith(origin+'?');
  const allow=(relative||absolute)&&target.origin===owned.origin&&!target.username&&!target.password&&req.headers?.host===owned.host;
  return{allow,canary:!allow&&req.method==='GET'&&target.href===CANARIES.http?'http':null};
 }catch{return{allow:false,canary:null};}
}
function mode(env=process.env){
 if(![undefined,'','0','1'].includes(env.PWA_OFFLINE_DIAGNOSTIC))throw Error('Invalid offline diagnostic mode');
 const enabled=env.PWA_OFFLINE_DIAGNOSTIC==='1';
 if(enabled&&(env.PWA_BROWSER!=='webkit'||!path.isAbsolute(env.PWA_OFFLINE_DIAGNOSTIC_DIR||'')))throw Error('Diagnostic requires WebKit and an absolute artifact directory');
 return enabled;
}
const text=value=>String(value??'').slice(0,LIMITS.field);
const errorText=error=>text(String(error?.message||error).replace(/https?:\/\/[^\s]+/g,'[url]'));
function create({enabled=false,directory,version,now=Date.now}={}){
 let origin,port,started=now(),sequence=0,requestSequence=0,socketSequence=0,eventBytes=0,writeFailure,boundary=false;
 const lateSlots=new Map();
 const requests=new WeakMap(),sockets=new WeakMap();
 const report={format:'installed-offline-diagnostic.v1',diagnosticOnly:true,releaseAcceptance:false,
  version:text(version),node:process.version,pid:process.pid,limits:LIMITS,
  environmentChange:'Owned-server deny-only HTTP/CONNECT proxy; SW-controlled .invalid preflight in a separate fresh context before app context. Proxy/preflight/observation differ from failed CI.',
  events:[],critical:[],snapshots:[],lifecycle:{},dropped:{events:0,critical:0,snapshots:0,bytes:0},externalDenied:0,externalResponses:0,
  proxy:{httpDenied:0,connectDenied:0,canaryHttpDenied:0,canaryHttpsDenied:0},preflight:{verified:false,contextClosed:false}};
 if(enabled){if(!path.isAbsolute(directory||''))throw Error('Absolute diagnostic directory required');fs.mkdirSync(directory,{recursive:true});}
 function location(value){try{const u=new URL(value,origin);return{scope:u.origin===origin?'loopback':'external',host:text(u.host),path:text(u.pathname),installed:u.searchParams.get('installed-pwa-upgrade')==='1'};}catch{return{scope:'invalid'};}}
 function allowed(value){try{return new URL(value).origin===origin;}catch{return false;}}
 function add(event,detail={},critical=false){
  if(!enabled)return;
  const item={sequence:++sequence,ms:Math.max(0,now()-started),event,...detail};
  const late=critical&&LATE.has(event)&&(boundary||['page-crash','browser-disconnected','cleanup-start','browser-close-error','server-close-error'].includes(event));
  if(late){
   const prior=lateSlots.get(event);
   if(prior){Object.assign(prior,item,{count:prior.count+1});return;}
   if(lateSlots.size>=LIMITS.critical/2){report.dropped.critical++;return;}
   item.count=1;item.firstSequence=item.sequence;lateSlots.set(event,item);report.critical.push(item);return;
  }
  const list=critical?report.critical:report.events,key=critical?'critical':'events';
  const size=Buffer.byteLength(JSON.stringify(item));
  // Reserve half the byte budget for fixed-shape snapshots and critical facts.
  if(list.length>=(critical?LIMITS.critical/2:LIMITS[key])){report.dropped[key]++;return;}
  if(!critical&&eventBytes+size>LIMITS.bytes/2){report.dropped.bytes++;return;}
  if(!critical)eventBytes+=size;list.push(item);
 }
 function flush(){
  if(!enabled)return;
  let output=JSON.stringify(report)+'\n';
  // Discard activity first. Never silently evict the reserved boundary facts.
  for(const key of ['events','snapshots'])while(Buffer.byteLength(output)>LIMITS.bytes&&report[key].length){
   report[key].shift();report.dropped[key]++;output=JSON.stringify(report)+'\n';
  }
  if(Buffer.byteLength(output)>LIMITS.bytes)throw Error('Offline diagnostic metadata exceeds fixed artifact byte budget');
  try{fs.writeFileSync(path.join(directory,'offline-boundary.json'),output);return true;}
  catch(error){writeFailure=error;report.writeFailure=errorText(error);return false;}
 }
 function requestId(request){if(!requests.has(request))requests.set(request,++requestSequence);return requests.get(request);}
 function details(request){return{id:requestId(request),location:location(request.url()),type:text(request.resourceType()),navigation:request.isNavigationRequest()};}
 function setOrigin(value){
  if(!enabled)return;
  const u=new URL(value);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port)throw Error('Diagnostic requires its owned loopback origin');
  origin=u.origin;port=Number(u.port);report.origin=origin;flush();
 }
 function launchOptions(){if(enabled&&!origin)throw Error('Owned origin required before proxy launch');return enabled?{proxy:{server:origin,bypass:'127.0.0.1:'+port}}:{};}
 function proxyRequest(req,_res){
  if(!enabled)return false;
  const target=proxyTarget(req,origin);if(target.allow)return false;
  report.proxy.httpDenied++;report.externalDenied++;
  if(target.canary==='http'){report.proxy.canaryHttpDenied++;report.proxy.httpEvidence={method:'GET',target:CANARIES.http};}
  add('proxy-http-denied',{location:location(req.url),canary:target.canary});req.socket.destroy();return true;
 }
 function proxyConnect(req,socket){
  const target=proxyTarget(req,origin,true);report.proxy.connectDenied++;report.externalDenied++;
  if(target.canary==='https'){report.proxy.canaryHttpsDenied++;report.proxy.httpsEvidence={method:'CONNECT',authority:'ns-offline-https.invalid:443'};}
  add('proxy-connect-denied',{authority:text(req.url),canary:target.canary});socket.destroy();
 }
 function attachServer(server){if(enabled)server.on('connect',proxyConnect);}
 function preflightDocument(req,res){
  if(!enabled||req.url!==PREFLIGHT_PATH)return false;
  res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
  res.end('<!doctype html><meta charset="utf-8"><title>Offline proxy preflight</title><script>navigator.serviceWorker.register("/service-worker.js").catch(()=>{});</script>');return true;
 }
 async function preflight(browser,expectedVersion){
  if(!enabled)return;
  if(report.preflight.started){report.preflight.verified=false;throw Error('Only one proxy preflight is permitted');}
  report.preflight.started=true;report.preflight.verified=false;report.preflight.contextClosed=false;
  let context,original;
  const before={http:report.proxy.canaryHttpDenied,https:report.proxy.canaryHttpsDenied};
  add('preflight-start',{},true);flush();
  try{
   context=await browser.newContext({serviceWorkers:'allow'});await attach(context,{preflight:true});
   const page=await context.newPage();await page.goto(origin+PREFLIGHT_PATH,{waitUntil:'domcontentloaded',timeout:10000});
   await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL===new URL('/service-worker.js',location.href).href,null,{timeout:30000});
   const facts=await page.evaluate(async({urls,expectedVersion})=>{
    const controller=navigator.serviceWorker.controller,registration=await navigator.serviceWorker.getRegistration();
    const version=await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);
     channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.version||null);};controller.postMessage({type:'nothingsport-worker-version'},[channel.port2]);});
    if(String(version)!==String(expectedVersion)||registration?.active?.state!=='activated')throw Error('Preflight must use the actual installed baseline worker');
    const outcomes=await Promise.all(Object.entries(urls).map(async([key,url])=>{const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),3000);
     try{await fetch(url,{cache:'no-store',signal:abort.signal});return[key,'resolved'];}catch{return[key,abort.signal.aborted?'timeout':'rejected'];}finally{clearTimeout(timer);}}));
    return{controller:controller.scriptURL,document:location.href,active:registration.active.state,version:String(version),outcomes:Object.fromEntries(outcomes)};
   },{urls:CANARIES,expectedVersion:String(expectedVersion)});
   const denied={http:report.proxy.canaryHttpDenied-before.http,https:report.proxy.canaryHttpsDenied-before.https};
   report.preflight.facts={controller:location(facts.controller),document:location(facts.document),active:text(facts.active),version:text(facts.version),outcomes:facts.outcomes,denied};
   if(facts.controller!==origin+'/service-worker.js'||facts.document!==origin+PREFLIGHT_PATH||facts.active!=='activated'||facts.version!==String(expectedVersion)||facts.outcomes.http!=='rejected'||facts.outcomes.https!=='rejected'||denied.http<1||denied.https<1||report.externalResponses)throw Error('Proxy preflight failed: actual HTTP and HTTPS proxy denial required');
   report.preflight.verified=true;add('preflight-verified',{denied},true);
  }catch(error){original=error;report.preflight.verified=false;report.preflight.error=errorText(error);throw error;}
  finally{
   try{if(context){await context.close();report.preflight.contextClosed=true;}}
   catch(error){report.preflight.closeError=errorText(error);report.preflight.verified=false;if(!original)throw error;}
   finally{flush();}
  }
 }
 function beginBoundary(){
  if(!enabled)return;
  if(writeFailure)throw writeFailure;
  if(!report.preflight.verified||!report.preflight.contextClosed||report.externalResponses)throw Error('Offline boundary requires completed verified proxy preflight');
  boundary=true;add('boundary-start',{},true);flush();
 }
 async function attach(context,{preflight=false}={}){
  if(!enabled)return;
  if(!origin)throw Error('Set owned origin before attaching diagnostic');
  // Install before the first page. The product worker itself returns without
  // handling cross-origin fetches; external responses are independently a failure.
  await context.route('**/*',async route=>{
   if(allowed(route.request().url())||(preflight&&Object.values(CANARIES).includes(route.request().url())))return route.continue();
   report.externalDenied++;add('external-denied',{location:location(route.request().url())});
   return route.abort('blockedbyclient');
  });
  await context.addInitScript(({prefix})=>{
   const publish=(event,trusted)=>console.debug(prefix+JSON.stringify({event,trusted,online:navigator.onLine,
    controller:navigator.serviceWorker?.controller?.scriptURL||null,
    version:document.querySelector('meta[name="app-shell-version"]')?.content||null}));
   for(const event of ['pageshow','pagehide','online','offline'])addEventListener(event,entry=>publish(event,entry.isTrusted));
   navigator.serviceWorker?.addEventListener('controllerchange',entry=>publish('controllerchange',entry.isTrusted));
  },{prefix:PREFIX});
  context.on('request',request=>{const item=details(request);add('request',item,item.navigation);if(item.navigation)flush();});
  context.on('response',response=>{
   const request=response.request(),item={...details(request),status:response.status(),worker:response.fromServiceWorker()};
   if(item.location.scope!=='loopback')report.externalResponses++;
   add('response',item,item.navigation);if(item.navigation)flush();
  });
  for(const terminal of ['requestfinished','requestfailed'])context.on(terminal,request=>{
   const item={...details(request),failure:terminal==='requestfailed'?errorText(request.failure()?.errorText):null};
   add(terminal,item,item.navigation);if(item.navigation)flush();
  });
  context.on('page',page=>{
   page.on('crash',()=>{add('page-crash',{},true);flush();});
   page.on('close',()=>add('page-close',{},true));
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())add('frame-navigation',{location:location(frame.url())},true);});
   page.on('pageerror',error=>add('pageerror',{error:errorText(error)}));
   page.on('console',message=>{
    if(!message.text().startsWith(PREFIX))return;
    try{const value=JSON.parse(message.text().slice(PREFIX.length));
     if(!['pageshow','pagehide','online','offline','controllerchange'].includes(value.event))return;
     if(typeof value.trusted!=='boolean')return;
     const key=value.event+':'+(value.trusted?'trusted':'synthetic'),prior=report.lifecycle[key];
     report.lifecycle[key]={eventName:value.event,trusted:value.trusted,count:(prior?.count||0)+1,firstMs:prior?.firstMs??now()-started,lastMs:now()-started,
      online:value.online===true,controller:value.controller?location(value.controller):null,version:/^\d+$/.test(value.version||'')?text(value.version):null};
    }catch{add('invalid-observer-message',{},true);}
   });
  });
  add('external-denial-installed',{},true);flush();
 }
 function socketFailure(req){
  if(!enabled)return;
  if(!sockets.has(req.socket))sockets.set(req.socket,++socketSequence);
  const main=location(req.url).path==='/';
  add('origin-socket-destroy',{socket:sockets.get(req.socket),remotePort:req.socket.remotePort,location:location(req.url),mode:text(req.headers['sec-fetch-mode'])},main);
  if(main)flush();
 }
 function watchBrowser(browser){
  if(!enabled)return;
  add('browser-runtime',{version:text(browser.version())},true);
  browser.on('disconnected',()=>{add('browser-disconnected',{},true);flush();});
 }
 async function capture(label,page){
  if(!enabled)return;
  let timer;
  try{
   const state=await Promise.race([page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    const read=worker=>worker?new Promise(resolve=>{
     const channel=new MessageChannel(),done=version=>{clearTimeout(timer);channel.port1.close();resolve({state:worker.state,url:worker.scriptURL,version:/^\d+$/.test(String(version))?String(version):null});};
     const timer=setTimeout(()=>done(null),1000);channel.port1.onmessage=event=>done(event.data?.version);
     try{worker.postMessage({type:'nothingsport-worker-version'},[channel.port2]);}catch{done(null);}
    }):null;
    const response=await caches.match('/index.html'),bytes=response?await response.arrayBuffer():null;
    return{version:document.querySelector('meta[name="app-shell-version"]')?.content||null,online:navigator.onLine,
     controller:navigator.serviceWorker.controller?.scriptURL||null,
     workers:await Promise.all([read(registration?.active),read(registration?.waiting),read(registration?.installing)]),
     caches:(await caches.keys()).slice(0,32),shell:bytes?{status:response.status,bytes:bytes.byteLength,
      version:new TextDecoder().decode(bytes).match(/name="app-shell-version" content="(\d+)"/)?.[1]||null,
      sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('')}:null};
   }),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Diagnostic snapshot deadline')),LIMITS.snapshotMs);})]);
   const item={label,ms:now()-started,version:text(state.version),online:state.online===true,
    controller:state.controller?location(state.controller):null,
    workers:state.workers.map(worker=>worker?{state:text(worker.state),location:location(worker.url),version:text(worker.version)}:null),
    caches:state.caches.map(text),shell:state.shell};
   if(report.snapshots.length<LIMITS.snapshots)report.snapshots.push(item);else report.dropped.snapshots++;
  }catch(error){add('snapshot-unavailable',{label,error:errorText(error)},true);}
  finally{clearTimeout(timer);flush();}
 }
 async function reload(page,perform){
  if(!enabled)return perform();
  add('reload-start',{},true);flush();
  try{const response=await perform();add('reload-resolved',{},true);await capture('after-reload',page);return response;}
  catch(error){add('reload-original-error',{error:errorText(error)},true);await capture('reload-failed',page);throw error;}
 }
 async function accepted(page){
  if(!enabled)return;
  if(!boundary||!report.preflight.verified||!report.preflight.contextClosed)throw Error('Offline boundary requires completed verified proxy preflight');
  await capture('offline-assertions-complete',page);
  if(report.externalResponses)throw Error('Diagnostic isolation failed: external response observed');
  report.outcome='offline-boundary-observed-with-existing-assertions';add('diagnostic-stop-not-release-acceptance',{},true);flush();
  if(writeFailure)throw writeFailure;
 }
 async function cleanup(browser,server,originalError){
  if(!enabled)throw Error('Diagnostic cleanup requires explicit mode');
  let cleanupError;
  add('cleanup-start',{},true);
  try{await browser?.close();}catch(error){cleanupError=error;add('browser-close-error',{error:errorText(error)},true);}
  try{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}catch(error){cleanupError ||= error;add('server-close-error',{error:errorText(error)},true);}
  const portClosed=port?await new Promise(resolve=>{
   const socket=net.createConnection({host:'127.0.0.1',port});let done=false;
   const finish=value=>{if(done)return;done=true;socket.destroy();resolve(value);};
   socket.setTimeout(250,()=>finish(false));socket.once('connect',()=>finish(false));socket.once('error',error=>finish(error.code==='ECONNREFUSED'));
  }):null;
  report.cleanup={browserClosed:!browser?.isConnected(),serverClosed:!server.listening,port:port||null,portClosed};
  if(originalError){report.outcome='original-failure-preserved';report.originalError=errorText(originalError);}
  if(!report.cleanup.browserClosed||!report.cleanup.serverClosed||portClosed===false)cleanupError ||= Error('Diagnostic cleanup incomplete');
  try{flush();cleanupError ||= writeFailure;}catch(error){cleanupError ||= error;}
  if(cleanupError&&!originalError)throw cleanupError;
 }
 return{enabled,setOrigin,attach,add,flush,capture,reload,accepted,cleanup,socketFailure,watchBrowser,location,allowed,report,
  launchOptions,proxyRequest,attachServer,preflightDocument,preflight,beginBoundary};
}
module.exports={mode,create,LIMITS,PREFIX,proxyTarget,CANARIES,PREFLIGHT_PATH};
