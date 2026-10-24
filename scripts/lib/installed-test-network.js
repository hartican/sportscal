'use strict';
// Network isolation for the normal installed-app QA, not product networking.
const PREFLIGHT_PATH='/__qa_installed_network__';
const CANARIES=Object.freeze({http:'http://ns-installed-http.invalid/proxy-proof',https:'https://ns-installed-https.invalid/proxy-proof'});
function target(req,origin,connect=false){
 try{
  const owned=new URL(origin),raw=req.url;if(typeof raw!=='string'||/[\\\r\n\s]/.test(raw))return{allow:false,canary:null};
  if(connect)return{allow:false,canary:req.method==='CONNECT'&&raw==='ns-installed-https.invalid:443'?'https':null};
  const url=new URL(raw,origin),relative=raw.startsWith('/')&&!raw.startsWith('//'),absolute=raw===origin||raw.startsWith(origin+'/')||raw.startsWith(origin+'?');
  const allow=(relative||absolute)&&url.origin===owned.origin&&!url.username&&!url.password&&req.headers?.host===owned.host;
  return{allow,canary:!allow&&req.method==='GET'&&url.href===CANARIES.http?'http':null};
 }catch{return{allow:false,canary:null};}
}
function create(){
 let origin,port;
 const state={format:'installed-test-network.v1',proxy:{httpDenied:0,connectDenied:0,routeDenied:0,canaryHttpDenied:0,canaryHttpsDenied:0},externalResponses:0,
  preflight:{started:false,verified:false,contextClosed:false},cleanup:null};
 const snapshot=()=>JSON.parse(JSON.stringify(state));
 function setOrigin(value){const u=new URL(value);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.username||u.password||u.origin!==value)throw Error('Installed test requires its exact owned loopback origin');origin=u.origin;port=u.port;}
 function launchOptions(){if(!origin)throw Error('Set owned test origin before browser launch');return{proxy:{server:origin,bypass:'127.0.0.1:'+port}};}
 function handleRequest(req){
  if(!origin)throw Error('Set owned test origin before serving requests');
  const result=target(req,origin);if(result.allow)return false;
  state.proxy.httpDenied++;
  if(result.canary==='http'){state.proxy.canaryHttpDenied++;state.proxy.httpEvidence={method:'GET',target:CANARIES.http};}
  req.socket.destroy();return true;
 }
 function attachServer(server){
  if(!origin)throw Error('Set owned test origin before attaching CONNECT denial');
  server.on('connect',(req,socket)=>{const result=target(req,origin,true);state.proxy.connectDenied++;
   if(result.canary==='https'){state.proxy.canaryHttpsDenied++;state.proxy.httpsEvidence={method:'CONNECT',authority:'ns-installed-https.invalid:443'};}
   socket.destroy();
  });
 }
 function preflightDocument(req,res){
  if(req.url!==PREFLIGHT_PATH)return false;
  res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
  res.end('<!doctype html><meta charset="utf-8"><title>Installed test network</title><script>navigator.serviceWorker.register("/service-worker.js").catch(()=>{});</script>');return true;
 }
 async function attachContext(context,{canaries=false}={}){
  if(!origin)throw Error('Set owned test origin before attaching context');
  await context.route('**/*',route=>{
   const url=route.request().url();let local=false;try{local=new URL(url).origin===origin;}catch{}
   if(local||(canaries&&Object.values(CANARIES).includes(url)))return route.continue();
   state.proxy.routeDenied++;return route.abort('blockedbyclient');
  });
  // This is an independent observation: route interception alone cannot prove
  // egress isolation when a real Service Worker controls the page.
  context.on('response',response=>{let local=false;try{local=new URL(response.url()).origin===origin;}catch{}if(!local)state.externalResponses++;});
 }
 async function preflight(browser,expected){
  if(state.preflight.started){state.preflight.verified=false;throw Error('Only one installed-network preflight is permitted');}
  state.preflight.started=true;
  if(!origin||!/^\d{1,16}$/.test(String(expected?.version))||!/^[a-f0-9]{64}$/.test(expected?.indexSha256||''))throw Error('Exact historical baseline version and index hash required');
  let context,originalError;const before={http:state.proxy.canaryHttpDenied,https:state.proxy.canaryHttpsDenied};
  try{
   context=await browser.newContext({serviceWorkers:'allow'});await attachContext(context,{canaries:true});
   const page=await context.newPage();await page.goto(origin+PREFLIGHT_PATH,{waitUntil:'domcontentloaded',timeout:10000});
   await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL===new URL('/service-worker.js',location.href).href,null,{timeout:30000});
   const facts=await page.evaluate(async({urls,expected})=>{
    const controller=navigator.serviceWorker.controller,registration=await navigator.serviceWorker.getRegistration(),key='nothingsport-shell-v'+expected.version;
    if(!controller||registration?.active?.state!=='activated'||!(await caches.keys()).includes(key))throw Error('Actual activated baseline worker/cache required');
    const response=await(await caches.open(key)).match('/index.html');if(!response?.ok)throw Error('Actual baseline cached index required');
    const bytes=await response.arrayBuffer(),version=new TextDecoder().decode(bytes).match(/name="app-shell-version" content="(\d+)"/)?.[1]||null;
    const indexSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
    if(version!==String(expected.version)||indexSha256!==expected.indexSha256)throw Error('Cached index must match exact historical baseline');
    const outcomes=await Promise.all(Object.entries(urls).map(async([name,url])=>{const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),3000);
     try{await fetch(url,{cache:'no-store',signal:abort.signal});return[name,'resolved'];}catch{return[name,abort.signal.aborted?'timeout':'rejected'];}finally{clearTimeout(timer);}}));
    return{controller:controller.scriptURL,document:location.href,active:registration.active.state,version,indexSha256,outcomes:Object.fromEntries(outcomes)};
   },{urls:CANARIES,expected:{version:String(expected.version),indexSha256:expected.indexSha256}});
   const denied={http:state.proxy.canaryHttpDenied-before.http,https:state.proxy.canaryHttpsDenied-before.https},outcome=value=>['rejected','timeout','resolved'].includes(value)?value:'unknown';
   state.preflight.facts={controllerMatches:facts.controller===origin+'/service-worker.js',documentMatches:facts.document===origin+PREFLIGHT_PATH,
    active:facts.active==='activated',version:/^\d{1,16}$/.test(facts.version||'')?facts.version:null,indexSha256:/^[a-f0-9]{64}$/.test(facts.indexSha256||'')?facts.indexSha256:null,
    outcomes:{http:outcome(facts.outcomes?.http),https:outcome(facts.outcomes?.https)},denied};
   if(facts.controller!==origin+'/service-worker.js'||facts.document!==origin+PREFLIGHT_PATH||facts.active!=='activated'||facts.version!==String(expected.version)||facts.indexSha256!==expected.indexSha256||facts.outcomes.http!=='rejected'||facts.outcomes.https!=='rejected'||denied.http<1||denied.https<1||state.externalResponses)throw Error('Installed test network preflight failed');
   state.preflight.verified=true;
  }catch(error){originalError=error;state.preflight.verified=false;throw error;}
  finally{try{if(context){await context.close();state.preflight.contextClosed=true;}}catch(error){state.preflight.verified=false;state.preflight.closeFailed=true;if(!originalError)throw error;}}
 }
 function assertIsolated(){if(!state.preflight.verified||!state.preflight.contextClosed||state.externalResponses)throw Error('Installed test network isolation is not verified');}
 async function close(browser,server,originalError){
  let cleanupError;
  try{await browser?.close();}catch(error){cleanupError=error;}
  try{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}catch(error){cleanupError ||= error;}
  if(state.externalResponses)cleanupError ||= Error('Installed test received an external response');
  state.cleanup={browserClosed:!browser?.isConnected(),serverClosed:!server.listening,preflightContextClosed:state.preflight.contextClosed};
  if((!state.cleanup.browserClosed||!state.cleanup.serverClosed)&&!cleanupError)cleanupError=Error('Installed test network cleanup incomplete');
  state.cleanup.failed=Boolean(cleanupError);
  if(cleanupError&&!originalError)throw cleanupError;
 }
 return{setOrigin,launchOptions,handleRequest,attachServer,preflightDocument,attachContext,preflight,assertIsolated,close,snapshot};
}
module.exports={create,target,CANARIES,PREFLIGHT_PATH};
