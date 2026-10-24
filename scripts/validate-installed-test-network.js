'use strict';
// Pure transport/actual page-function controls. No browser, DNS or live socket.
const assert=require('node:assert/strict'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{createHash,webcrypto}=require('node:crypto');
const {create,target,CANARIES,PREFLIGHT_PATH}=require('./lib/installed-test-network');
const OWN='http://127.0.0.1:12345',HEADERS={host:'127.0.0.1:12345'};let checks=0;
const ok=(condition,message)=>{assert(condition,message);checks++;};
const fail=fn=>{assert.throws(fn);checks++;};
async function reject(promise,message){await assert.rejects(promise,message);checks++;}
const forbidden=new Proxy({},{get(){throw Error('must not touch owned response or open upstream');}});
function configured(){const network=create(),server=new EventEmitter();network.setOrigin(OWN);network.attachServer(server);return{network,server};}
function browserDouble(network,server,options={}){
 const version=options.version||'592',html='<meta name="app-shell-version" content="'+version+'">',digest=createHash('sha256').update(html).digest('hex');
 const expected={version,indexSha256:options.expectedHash||digest},calls={contexts:0,fetches:0,opens:0,closed:0,timers:[],cleared:0};let connected=true;
 const context=new EventEmitter();
 context.route=async(_pattern,handler)=>{context.handler=options.routeAbort?route=>route.abort('blockedbyclient'):handler;};
 const page={goto:async(url,settings)=>{assert.equal(url,OWN+PREFLIGHT_PATH);assert.equal(settings.timeout,10000);},
  waitForFunction:async predicate=>{if(!vm.runInContext('('+predicate.toString()+')()',sandbox))throw Error('no actual owned controller');},
  evaluate:async(fn,argument)=>{sandbox.argument=argument;return vm.runInContext('('+fn.toString()+')(argument)',sandbox);}};
 context.newPage=async()=>page;context.close=async()=>{calls.closed++;if(options.closeError)throw Error('context close failed');};
 const sandbox=vm.createContext({URL,location:{href:OWN+PREFLIGHT_PATH},TextDecoder,Uint8Array,crypto:webcrypto,AbortController,
  // The historical236 fixture deliberately has no MessageChannel/version API.
  navigator:{serviceWorker:{controller:options.noController?null:{scriptURL:options.wrongController?'http://other.invalid/sw':OWN+'/service-worker.js'},getRegistration:async()=>({active:{state:options.inactive?'installing':'activated'}})}},
  caches:{keys:async()=>options.noCache?[]:['nothingsport-shell-v'+version],open:async key=>{calls.opens++;assert.equal(key,'nothingsport-shell-v'+version);return{match:async key=>{assert.equal(key,'/index.html');return options.noIndex?null:new Response(options.wrongIndex?html+'changed':html);}};}},
  setTimeout(fn,ms){calls.timers.push(ms);if(options.timeout)fn();return calls.timers.length;},clearTimeout(){calls.cleared++;},
  fetch:async(url)=>{
   calls.fetches++;let denied=false;
   await context.handler({request:()=>({url:()=>url}),abort:async()=>{denied=true;},continue:async()=>{
    if(url===CANARIES.http&&!options.omitHttp)denied=network.handleRequest({url,method:'GET',headers:{host:'ns-installed-http.invalid'},socket:{destroy(){}}});
    if(url===CANARIES.https&&!options.omitHttps){server.emit('connect',{url:'ns-installed-https.invalid:443',method:'CONNECT'},{destroy(){denied=true;}});}
   }});
   if(options.externalResponse)context.emit('response',{url:()=>url});
   if(options.resolve)return new Response('not a rejection');
   // Rejection alone is insufficient: omitted proxy evidence/route-only abort
   // must fail even though this page sees exactly the same TypeError.
   if(denied||options.omitHttp||options.omitHttps)throw TypeError('network rejected');
   return new Response('unexpected success');
  }});
 return{expected,context,calls,browser:{newContext:async settings=>{calls.contexts++;assert.equal(settings.serviceWorkers,'allow');return context;},close:async()=>{connected=false;if(options.browserCloseError)throw Error('browser close failed');},isConnected:()=>connected}};
}
async function main(){
 const unconfigured=create();fail(()=>unconfigured.launchOptions());fail(()=>unconfigured.setOrigin('https://example.invalid'));fail(()=>unconfigured.setOrigin(OWN+'/'));fail(()=>unconfigured.assertIsolated());
 const {network,server}=configured();assert.deepEqual(network.launchOptions(),{proxy:{server:OWN,bypass:'127.0.0.1:12345'}});checks++;
 for(const url of ['/index.html','/api/user-state','/?installed-pwa-upgrade=1',OWN,OWN+'/config/x.js']){
  const req={url,method:'POST',headers:HEADERS,socket:{destroy(){throw Error('owned request destroyed');}}};ok(target(req,OWN).allow&&!network.handleRequest(req),'exact owned relative/absolute request remains on existing path');
 }
 for(const [url,host]of [[CANARIES.http,'ns-installed-http.invalid'],['https://outside.invalid/x','outside.invalid'],['//outside.invalid/x',HEADERS.host],['/x','wrong'],['http://127.0.0.1:12346/x',HEADERS.host],['http://127.0.0.1.evil:12345/x',HEADERS.host],['http://user@127.0.0.1:12345/x',HEADERS.host],['http://127.1:12345/x',HEADERS.host],['\\\\outside.invalid/x',HEADERS.host],['/x\r\nHost:outside',HEADERS.host],['relative',HEADERS.host],['file:///tmp/x',HEADERS.host]]){
  let destroyed=0;const req={url,method:'GET',headers:{host},socket:{destroy(){destroyed++;}}};ok(!target(req,OWN).allow&&network.handleRequest(req)&&destroyed===1,'invalid/outside HTTP is destroyed without a response or upstream');
 }
 for(const authority of ['ns-installed-https.invalid:443','outside.invalid:443','127.0.0.1:12345','user@ns-installed-https.invalid:443','ns-installed-https.invalid:444','ns-installed-https.invalid:443/path']){
  let destroyed=0;server.emit('connect',{url:authority,method:'CONNECT'},{destroy(){destroyed++;}});ok(destroyed===1,'all CONNECT tunnels denied');
 }
 ok(network.snapshot().proxy.canaryHttpDenied===1&&network.snapshot().proxy.canaryHttpsDenied===1,'exact GET URI and CONNECT authority evidence only');
 ok(!target({url:CANARIES.http,method:'POST'},OWN).canary&&!target({url:'ns-installed-https.invalid:443',method:'GET'},OWN,true).canary,'wrong methods cannot prove preflight');
 let body;ok(network.preflightDocument({url:PREFLIGHT_PATH},{writeHead(code,headers){assert.equal(code,200);assert.equal(headers['cache-control'],'no-store');},end(value){body=value;}})&&body.includes('serviceWorker.register')&&!/https?:\/\//.test(body),'minimal same-origin preflight document');
 ok(!network.preflightDocument({url:'/index.html'},forbidden),'product document/headers stay with original server');
 for(const version of ['236','592']){
  const {network:n,server:s}=configured(),fixture=browserDouble(n,s,{version});await n.preflight(fixture.browser,fixture.expected);n.assertIsolated();checks++;
  const result=n.snapshot();ok(result.preflight.verified&&result.preflight.contextClosed&&result.preflight.facts.version===version&&result.preflight.facts.indexSha256===fixture.expected.indexSha256,'real page function supports exact historical cache without modern reply protocol');
  ok(result.preflight.facts.denied.http===1&&result.preflight.facts.denied.https===1&&fixture.calls.fetches===2,'actual route callback must reach both deny handlers');
  ok(fixture.calls.timers.length===2&&fixture.calls.timers.every(ms=>ms===3000)&&fixture.calls.cleared===2,'canaries retain bounded deadlines');
  let unrelated=0;await fixture.context.handler({request:()=>({url:()=>CANARIES.https+'?not-the-canary'}),abort:async()=>{unrelated++;},continue:async()=>{throw Error('canary exemption must be exact');}});ok(unrelated===1,'preflight is not a blanket outside-origin exemption');
  await n.attachContext(fixture.context);for(const url of Object.values(CANARIES)){let aborted=0;await fixture.context.handler({request:()=>({url:()=>url}),abort:async()=>{aborted++;},continue:async()=>{throw Error('main context cannot exempt canaries');}});ok(aborted===1,'normal app context has no canary exemption');}
  await reject(n.preflight(fixture.browser,fixture.expected),/Only one/);fail(()=>n.assertIsolated());
 }
 for(const options of [{noController:true},{wrongController:true},{inactive:true},{noCache:true},{noIndex:true},{wrongIndex:true},{expectedHash:'0'.repeat(64)},{omitHttp:true},{omitHttps:true},{routeAbort:true},{resolve:true},{timeout:true},{externalResponse:true},{closeError:true}]){
  const {network:n,server:s}=configured(),fixture=browserDouble(n,s,options);await reject(n.preflight(fixture.browser,fixture.expected));fail(()=>n.assertIsolated());
  ok(fixture.calls.closed===1,'failed preflight always closes its own context');
  if(options.noController||options.wrongController||options.inactive||options.noCache||options.noIndex||options.wrongIndex||options.expectedHash)ok(fixture.calls.fetches===0,'no canary or app request before exact baseline worker/cache proof');
  if(options.noCache)ok(fixture.calls.opens===0,'missing baseline cache is not silently created');
 }
 const {network:n,server:s}=configured(),fixture=browserDouble(n,s);await n.preflight(fixture.browser,fixture.expected);n.assertIsolated();
 const before=n.snapshot();fixture.context.emit('response',{url:()=>OWN+'/api/user-state'});ok(n.snapshot().externalResponses===before.externalResponses,'owned responses do not weaken isolation');
 fixture.context.emit('response',{url:()=> 'https://outside.invalid/logo'});fail(()=>n.assertIsolated());ok(n.snapshot().externalResponses===1,'independent actual-response guard catches proxy/routing coverage gaps');
 ok(Buffer.byteLength(JSON.stringify(n.snapshot()))<4096,'network summary remains small without event/trace retention');
 for(const original of [null,Error('original test failure')]){
  const {network:n}=configured(),server={listening:true,close(done){this.listening=false;done();}},browser={close:async()=>{throw Error('browser close failed');},isConnected:()=>false};
  if(original){await n.close(browser,server,original);checks++;}else await reject(n.close(browser,server,null),/browser close failed/);
  ok(!server.listening&&n.snapshot().cleanup.failed&&n.snapshot().cleanup.serverClosed,'cleanup closes server and never replaces original failure');
 }
 const clean={listening:true,close(done){this.listening=false;done();}};await network.close({close:async()=>{},isConnected:()=>false},clean);ok(network.snapshot().cleanup.browserClosed&&network.snapshot().cleanup.serverClosed&&!network.snapshot().cleanup.failed,'normal owned cleanup summary');
 const late=configured(),lateFixture=browserDouble(late.network,late.server);await late.network.preflight(lateFixture.browser,lateFixture.expected);late.network.assertIsolated();
 const closing={listening:true,close(done){this.listening=false;done();}},lateBrowser={close:async()=>lateFixture.context.emit('response',{url:()=> 'https://outside.invalid/late'}),isConnected:()=>false};
 await reject(late.network.close(lateBrowser,closing,null),/external response/);ok(late.network.snapshot().externalResponses===1&&late.network.snapshot().cleanup.failed,'late response during browser close cannot follow a false passing isolation verdict');
 console.log('Installed test network: '+checks+' pure controls passed; no browser/DNS/live socket or release acceptance.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=main;
