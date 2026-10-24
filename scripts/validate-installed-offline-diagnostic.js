'use strict';
// Deterministic controls only: no browser launch, external request or production I/O.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{execFileSync}=require('node:child_process'),acorn=require('acorn');
const {mode,create,LIMITS,PREFIX,proxyTarget,CANARIES,PREFLIGHT_PATH}=require('./lib/installed-offline-diagnostic'),{boundedSink,runtimeMetadata,validateRuntime,reapOwnedGroups,CAPS}=require('./run-installed-offline-diagnostic');
const root=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-offline-controls-'));let passed=0;
const check=(condition,label)=>{assert(condition,label);passed++;};
const state={version:'593',online:true,controller:'http://127.0.0.1:12345/service-worker.js',workers:[{url:'http://127.0.0.1:12345/service-worker.js',state:'activated',version:'593'},null,null],caches:['nothingsport-shell-v593'],shell:{status:200,bytes:123,version:'593',sha256:'a'.repeat(64)}};
const page={evaluate:async()=>structuredClone(state)};
const request=(url,navigation=false)=>({url:()=>url,resourceType:()=>navigation?'document':'image',isNavigationRequest:()=>navigation,failure:()=>({errorText:'failed http://127.0.0.1:12345/api?secret=PRIVATE'})});
function context(){const c=new EventEmitter();c.route=async(pattern,handler)=>{c.pattern=pattern;c.handler=handler;};c.addInitScript=async(fn,arg)=>{c.init={fn,arg};};return c;}
function read(directory){return JSON.parse(fs.readFileSync(path.join(directory,'offline-boundary.json'),'utf8'));}
async function ownedServer(){const server=http.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server;}
// Only syscall/transport doubles: no DNS, browser launch or external socket.
async function fakePreflight(probe,{http=true,https=true,controller=probe.report.origin+'/service-worker.js',document=probe.report.origin+PREFLIGHT_PATH,active='activated',version='592',outcomes={http:'rejected',https:'rejected'},closeError=false}={}){
 const c=context(),server=new EventEmitter();probe.attachServer(server);
 const preflightPage={goto:async url=>assert.equal(url,probe.report.origin+PREFLIGHT_PATH),waitForFunction:async()=>{},evaluate:async()=>{
  if(http)await c.handler({request:()=>request(CANARIES.http),abort:async()=>{},continue:async()=>probe.proxyRequest({url:CANARIES.http,method:'GET',headers:{host:'ns-offline-http.invalid'},socket:{destroy(){}}},{})});
  if(https)await c.handler({request:()=>request(CANARIES.https),abort:async()=>{},continue:async()=>server.emit('connect',{url:'ns-offline-https.invalid:443',method:'CONNECT'}, {destroy(){}})});
  return{controller,document,active,version,outcomes};
 }};
 c.newPage=async()=>preflightPage;c.close=async()=>{if(closeError)throw Error('preflight close failed');};
 await probe.preflight({newContext:async()=>c},'592');return c;
}
async function main(){
 try{
  check(mode({})===false&&mode({PWA_OFFLINE_DIAGNOSTIC:'0'})===false,'default mode OFF');
  for(const env of [{PWA_OFFLINE_DIAGNOSTIC:'true'},{PWA_OFFLINE_DIAGNOSTIC:'1',PWA_BROWSER:'chromium',PWA_OFFLINE_DIAGNOSTIC_DIR:'/tmp/proof'},{PWA_OFFLINE_DIAGNOSTIC:'1',PWA_BROWSER:'webkit',PWA_OFFLINE_DIAGNOSTIC_DIR:'relative'}]){assert.throws(()=>mode(env));passed++;}
  check(mode({PWA_OFFLINE_DIAGNOSTIC:'1',PWA_BROWSER:'webkit',PWA_OFFLINE_DIAGNOSTIC_DIR:'/tmp/proof'})===true,'explicit valid mode');
  const runtime={platform:'linux',node:'v24.21.0',playwright:'1.62.1',browserMetadata:{revision:'2336'}};validateRuntime(runtime);passed++;
  for(const change of [{platform:'darwin'},{node:'v25.0.0'},{playwright:'1.64.1'},{browserMetadata:{revision:'2365'}}]){assert.throws(()=>validateRuntime({...runtime,...change}));passed++;}
  for(const env of [{PWA_EXECUTABLE_PATH:'/other/runtime'},{PWA_KEEP_OPEN:'1'}]){assert.throws(()=>validateRuntime(runtime,env));passed++;}
  const fakePackage=path.join(temporary,'package'),fakeBrowser=path.join(temporary,'browser');fs.mkdirSync(fakePackage);fs.mkdirSync(fakeBrowser);
  fs.writeFileSync(path.join(fakePackage,'package.json'),JSON.stringify({version:'1.62.1',main:'index.js'}));fs.writeFileSync(path.join(fakePackage,'index.js'),'module.exports={webkit:{executablePath:()=>'+JSON.stringify(path.join(fakeBrowser,'pw_run.sh'))+'}};');
  fs.writeFileSync(path.join(fakeBrowser,'libsoup-3.0.so.0'),Buffer.from('synthetic binary\0libsoup/3.6.5\0'));const metadata=runtimeMetadata(fakePackage);
  check(metadata.bundledSoup[0].versionStrings[0]==='3.6.5'&&metadata.bundledSoup[0].sha256.length===64,'bundled library literal/version/hash read without execution');
  const inertPath=path.join(temporary,'must-not-exist'),inert=create({directory:inertPath});
  const forbidden=new Proxy({},{get(){throw Error('disabled diagnostic touched its argument');}});
  inert.setOrigin('invalid');await inert.attach(forbidden);await inert.capture('disabled',forbidden);inert.watchBrowser(forbidden);inert.socketFailure(forbidden);inert.add('disabled');inert.flush();await inert.accepted(forbidden);
  check(!fs.existsSync(inertPath),'disabled mode writes nothing/registers nothing');
  assert.deepEqual(inert.launchOptions(),{});passed++;inert.attachServer(forbidden);await inert.preflight(forbidden,'592');inert.beginBoundary();
  check(inert.proxyRequest(forbidden,forbidden)===false&&inert.preflightDocument(forbidden,forbidden)===false,'normal mode never changes transport/document handling');
  let calls=0;check(await inert.reload(null,async()=>{calls++;return 17;})===17&&calls===1,'disabled mode executes original exactly once');
  const error=Error('original navigation failed');await assert.rejects(inert.reload(null,async()=>{throw error;}),value=>value===error);passed++;
  const directory=path.join(temporary,'active'),probe=create({enabled:true,directory,version:'593'});
  assert.throws(()=>probe.setOrigin('https://example.com'));passed++;
  probe.setOrigin('http://127.0.0.1:12345');const c=context();await probe.attach(c);
  await fakePreflight(probe);probe.beginBoundary();
  check(c.pattern==='**/*'&&c.init,'external denial installed before page creation');
  for(const url of ['https://example.com/logo.png','http://localhost:12345/x','http://127.0.0.1:12346/x','http://127.0.0.1.evil:12345/x','file:///tmp/x']){
   let aborted=false,continued=false;await c.handler({request:()=>request(url),abort:async code=>{aborted=code==='blockedbyclient';},continue:async()=>{continued=true;}});check(aborted&&!continued,'deny nonowned origin: '+url);
  }
  let continued=false;await c.handler({request:()=>request('http://127.0.0.1:12345/index.html'),abort:async()=>{throw Error('loopback denied');},continue:async()=>{continued=true;}});check(continued,'owned loopback retains its actual worker/network path');
  const document=request('http://127.0.0.1:12345/?installed-pwa-upgrade=1&secret=PRIVATE',true);
  c.emit('request',document);c.emit('response',{request:()=>document,status:()=>200,fromServiceWorker:()=>true});c.emit('requestfinished',document);
  const created=new EventEmitter();c.emit('page',created);created.emit('crash');
  const browser=new EventEmitter();browser.version=()=> '26.5';probe.watchBrowser(browser);browser.emit('disconnected');
  await probe.capture('before-offline',page);
  check(await probe.reload(page,async()=>200)===200,'successful original reload preserved');
  const before=read(directory),navigation=before.critical.filter(item=>item.navigation);
  check(navigation.length===3&&new Set(navigation.map(item=>item.id)).size===1,'exact request/response/terminal identity');
  check(navigation[1].status===200&&navigation[1].worker===true,'worker response fact retained');
  check(before.critical.some(item=>item.event==='page-crash')&&before.critical.some(item=>item.event==='browser-disconnected'),'crash/disconnection retained');
  check(!JSON.stringify(before).includes('PRIVATE'),'query values omitted');
  const failure=Error('WebKit encountered an internal error');
  await assert.rejects(probe.reload({evaluate:async()=>{throw Error('observer failed');}},async()=>{throw failure;}),value=>value===failure);passed++;
  check(read(directory).critical.some(item=>item.event==='reload-original-error'),'original failure flushed despite unavailable snapshot');
  const failedWrites=create({enabled:true,directory:path.join(temporary,'failed-writes')}),write=fs.writeFileSync;
  try{fs.writeFileSync=()=>{throw Error('artifact write failed');};await assert.rejects(failedWrites.reload(page,async()=>{throw failure;}),value=>value===failure);passed++;}
  finally{fs.writeFileSync=write;}
  await probe.accepted(page);check(read(directory).releaseAcceptance===false,'diagnostic success cannot become release acceptance');
  c.emit('response',{request:()=>request('https://example.com/x'),status:()=>200,fromServiceWorker:()=>false});
  await assert.rejects(probe.accepted(page),/isolation failed/);passed++;
  for(let index=0;index<3000;index++)probe.add('bounded',{value:'x'.repeat(512)});
  for(let index=0;index<200;index++)probe.add('critical-bounded',{value:'y'.repeat(512)},true);
  for(let index=0;index<12;index++)await probe.capture('bounded',page);
  probe.flush();const bounded=read(directory);
  check(fs.statSync(path.join(directory,'offline-boundary.json')).size<=LIMITS.bytes,'fixed artifact byte budget');
  check(bounded.events.length<=LIMITS.events&&bounded.critical.length<=LIMITS.critical&&bounded.snapshots.length<=LIMITS.snapshots,'fixed event/snapshot counts');
  check(bounded.dropped.events+bounded.dropped.bytes>0&&bounded.dropped.critical>0&&bounded.dropped.snapshots>0,'overflow explicit');
  const sink=boundedSink(path.join(temporary,'stderr.log'),16);sink.write(Buffer.alloc(80,97));sink.write(Buffer.alloc(20,98));assert.deepEqual(sink.snapshot(),{received:100,written:16,dropped:84,limit:16});passed++;
  check(fs.statSync(path.join(temporary,'stderr.log')).size===16&&CAPS.stderr===262144&&CAPS.maximumMs===360000,'bounded debug stderr and adapter deadline');
  const tail=boundedSink(path.join(temporary,'stderr-tail.log'),16,{tail:true});tail.write(Buffer.alloc(100,97));tail.write(Buffer.from('CRASH-SIGNAL'));check(fs.readFileSync(path.join(temporary,'stderr-tail.log'),'utf8').endsWith('CRASH-SIGNAL')&&tail.snapshot().written===16,'bounded stderr retains latest crash signal');
  // Source-valid adapter cleanup: simulate syscall results only; no real
  // process signals, browser or native run. Positive leaders are already dead.
  const gone=()=>Object.assign(Error('gone'),{code:'ESRCH'});
  for(const stopOn of ['SIGTERM','SIGKILL','never']){
   let live=true;const operations=[],waits=[];
   const result=await reapOwnedGroups([41001,42001,42001],{ownerPid:40001,wait:async ms=>waits.push(ms),kill(target,signal){
    operations.push({target,signal});if(target>0||target===-41001||!live)throw gone();
    assert.equal(target,-42001,'only the recorded detached browser group');
    if(signal===stopOn)live=false;
   }});
   check(result.before[1].leader.state==='gone'&&result.before[1].group.state==='present','dead leader/live group is independently observed');
   check(result.forced&&!result.clean,'forced cleanup cannot return a successful diagnostic');
   check(result.groupsGone===(stopOn!=='never'),'final group presence must be established directly');
   assert.deepEqual(operations.filter(item=>item.signal!==0).map(item=>item.signal),stopOn==='SIGTERM'?['SIGTERM']:['SIGTERM','SIGKILL']);passed++;
   check(waits.every(ms=>ms===250)&&waits.length<=2,'existing short cleanup waits remain bounded');
  }
  const absent=await reapOwnedGroups([41001],{ownerPid:40001,wait:async()=>{throw Error('no cleanup wait needed');},kill(){throw gone();}});
  check(absent.clean&&absent.groupsGone&&!absent.forced,'only confirmed absent groups/leaders permit clean success');
  const denied=[];const unknown=await reapOwnedGroups([41001],{ownerPid:40001,wait:async()=>{throw Error('unknown group must not be signalled');},kill(target,signal){denied.push({target,signal});if(target>0)throw gone();throw Object.assign(Error('permission unknown'),{code:'EPERM'});}});
  check(!unknown.clean&&!unknown.groupsGone&&unknown.after[0].group.state==='unknown'&&denied.every(item=>item.signal===0),'permission uncertainty cannot mean gone or trigger an unknown signal');
  const leaderOnly=await reapOwnedGroups([41001],{ownerPid:40001,wait:async()=>{},kill(target,signal){assert.equal(signal,0);if(target<0)throw gone();}});
  check(!leaderOnly.clean&&leaderOnly.groupsGone&&!leaderOnly.forced,'an escaped/reused positive leader is uncertain; do not signal outside the recorded group');
  let probes=0;const reappeared=await reapOwnedGroups([41001],{ownerPid:40001,wait:async()=>{},kill(target,signal){assert.equal(signal,0,'never signal a group that reappears after observed absence');if(target>0||++probes!==2)throw gone();}});
  check(!reappeared.clean&&!reappeared.forced,'a reappeared group cannot be assumed to retain earlier ownership');
  let uncertainProbe=0;const transientUnknown=await reapOwnedGroups([41001],{ownerPid:40001,wait:async()=>{},kill(target,signal){assert.equal(signal,0);if(target<0&&++uncertainProbe===2)throw Object.assign(Error('unknown'),{code:'EPERM'});throw gone();}});
  check(!transientUnknown.clean,'even intermediate uncertainty must fail cleanup');
  for(const invalid of [0,1,-1,NaN,1.5,40001]){
   await assert.rejects(reapOwnedGroups([41001,invalid],{ownerPid:40001,kill(){throw Error('invalid certificates must be refused before any syscall');}}),/Invalid recorded/);passed++;
  }
  const adapter=fs.readFileSync(path.join(__dirname,'run-installed-offline-diagnostic.js'),'utf8'),cleanupStart=adapter.indexOf(' const ownedGroups=await'),cleanupEnd=adapter.indexOf('\n}',cleanupStart);
  assert(cleanupStart>0&&cleanupEnd>cleanupStart,'actual adapter cleanup/exit source');
  let descendant=true;const actual={Date,JSON,console:{log(){}},child:{pid:41001},pids:new Set([42001]),started:Date.now(),result:{code:0,signal:null},timedOut:false,
   stdout:{snapshot:()=>({})},stderr:{snapshot:()=>({})},directory:'/synthetic',path:{join:()=>'/synthetic/lifecycle.json'},process:{exitCode:null},fs:{writeFileSync(_file,value){actual.summary=JSON.parse(value);}}};
  actual.reapOwnedGroups=ids=>reapOwnedGroups(ids,{ownerPid:40001,wait:async()=>{},kill(target,signal){if(target>0||target===-41001||!descendant)throw gone();if(signal==='SIGKILL')descendant=false;}});
  vm.createContext(actual);await vm.runInContext('(async()=>{'+adapter.slice(cleanupStart,cleanupEnd)+'})()',actual);
  check(actual.process.exitCode===1&&!descendant&&actual.summary.ownedGroups.forced&&actual.summary.ownedGroups.groupsGone,'actual adapter rejects zero-exit dead-leader/live-group run after bounded TERM/KILL');
  for(const original of [null,failure]){
   const server=await ownedServer(),dir=path.join(temporary,'cleanup-'+Boolean(original)),p=create({enabled:true,directory:dir});p.setOrigin('http://127.0.0.1:'+server.address().port);
   const b={close:async()=>{throw Error('cleanup signal');},isConnected:()=>false};
   if(original){await p.cleanup(b,server,original);check(read(dir).outcome==='original-failure-preserved','cleanup cannot replace original failure');}
   else{await assert.rejects(p.cleanup(b,server,null),/cleanup signal/);passed++;}
   const proof=read(dir);check(!server.listening&&proof.cleanup.serverClosed&&proof.cleanup.portClosed,'owned server closes even after browser-close error');
  }
  const own='http://127.0.0.1:12345',headers={host:'127.0.0.1:12345'},transport=create({enabled:true,directory:path.join(temporary,'transport')});transport.setOrigin(own);
  const preflightRoutes=await fakePreflight(transport);
  for(const url of Object.values(CANARIES)){
   let continued=0;await preflightRoutes.handler({request:()=>request(url),abort:async()=>{throw Error('fixed preflight canary must reach the proxy');},continue:async()=>{continued++;}});check(continued===1,'dedicated preflight permits exact canary to transport');
   let aborted=0;await c.handler({request:()=>request(url),abort:async()=>{aborted++;},continue:async()=>{throw Error('main context must not exempt canaries');}});check(aborted===1,'main app context retains independent external denial');
  }
  let unrelatedAborted=0;await preflightRoutes.handler({request:()=>request('https://unrelated.invalid/logo'),abort:async()=>{unrelatedAborted++;},continue:async()=>{throw Error('unrelated external request must not use canary exemption');}});check(unrelatedAborted===1,'preflight exemption is not a blanket outside allowance');
  const counterBefore={...transport.report.proxy};
  await assert.rejects(fakePreflight(transport),/Only one proxy preflight/);passed++;
  assert.throws(()=>transport.beginBoundary(),/requires completed verified/);passed++;
  assert.deepEqual(transport.launchOptions(),{proxy:{server:own,bypass:'127.0.0.1:12345'}});passed++;
  for(const url of ['/index.html','/?installed-pwa-upgrade=1','/api/user-state',own+'/config/x.js',own]){
   const req={url,headers,socket:{destroy(){throw Error('owned transport must remain unchanged');}}};check(proxyTarget(req,own).allow&&!transport.proxyRequest(req,forbidden),'exact owned relative/absolute positive: '+url);
  }
  for(const [url,host]of [[CANARIES.http,'ns-offline-http.invalid'],['http://example.com/','example.com'],['https://example.com/','example.com'],['//example.com/x',headers.host],['http://127.0.0.1:12346/x',headers.host],['http://127.0.0.1.evil:12345/x',headers.host],['http://user@127.0.0.1:12345/x',headers.host],['http://127.1:12345/x',headers.host],['/index.html','wrong-host'],['\\\\example.com/x',headers.host],['/x\r\nHost:evil',headers.host],['relative',headers.host],['file:///tmp/x',headers.host]]){
   let destroyed=0;const req={url,method:'GET',headers:{host},socket:{destroy(){destroyed++;}}};check(!proxyTarget(req,own).allow&&transport.proxyRequest(req,forbidden)&&destroyed===1,'deny without any upstream response/socket: '+url);
  }
  const connectServer=new EventEmitter();transport.attachServer(connectServer);
  for(const authority of ['ns-offline-https.invalid:443','example.com:443','127.0.0.1:12345','ns-offline-https.invalid:444','user@ns-offline-https.invalid:443','ns-offline-https.invalid:443/path']){
   let destroyed=0;connectServer.emit('connect',{url:authority,method:'CONNECT'},{destroy(){destroyed++;}});check(destroyed===1&&!proxyTarget({url:authority},own,true).allow,'deny every CONNECT tunnel: '+authority);
  }
  check(transport.report.proxy.canaryHttpDenied-counterBefore.canaryHttpDenied===1&&transport.report.proxy.canaryHttpsDenied-counterBefore.canaryHttpsDenied===1,'only exact HTTP URI and HTTPS authority can prove preflight');
  let writes=0;check(transport.preflightDocument({url:PREFLIGHT_PATH},{writeHead(status,h){assert.equal(status,200);assert.equal(h['cache-control'],'no-store');writes++;},end(body){assert(body.includes('serviceWorker.register')&&!body.includes('http://')&&!body.includes('https://'));writes++;}})&&writes===2,'minimal preflight document uses only actual same-origin worker');
  check(!transport.preflightDocument({url:'/index.html'},forbidden),'no product document/header changes');
  for(const options of [{http:false},{https:false},{version:'old'},{controller:'http://elsewhere.invalid/service-worker.js'},{document:own+'/other'},{active:'installing'},{outcomes:{http:'resolved',https:'rejected'}},{outcomes:{http:'timeout',https:'rejected'}},{closeError:true}]){
   const p=create({enabled:true,directory:path.join(temporary,'preflight-'+passed)});p.setOrigin(own);
   await assert.rejects(fakePreflight(p,options));passed++;assert.throws(()=>p.beginBoundary());passed++;
  }
  const overflow=create({enabled:true,directory:path.join(temporary,'late-critical')});overflow.setOrigin(own);const live=context();await overflow.attach(live);await fakePreflight(overflow);
  const lifecyclePage=new EventEmitter();live.emit('page',lifecyclePage);
  for(let index=0;index<100;index++)lifecyclePage.emit('console',{text:()=>PREFIX+JSON.stringify({event:'pageshow',trusted:false,online:true,controller:own+'/service-worker.js',version:'593'})});
  lifecyclePage.emit('console',{text:()=>PREFIX+JSON.stringify({event:'pageshow',trusted:true,online:true,version:'593'})});
  for(let index=0;index<3000;index++)overflow.add('ordinary-traffic',{value:'x'.repeat(512)});
  for(let index=0;index<200;index++)overflow.add('prelude-critical',{value:'y'.repeat(512)},true);
  overflow.beginBoundary();const lateDocument=request(own+'/?installed-pwa-upgrade=1',true);live.emit('request',lateDocument);
  const fixed=['setOffline-true-start','setOffline-true-end','setOffline-false-start','setOffline-false-end','reload-start','reload-resolved','reload-original-error','cleanup-start'];
  for(const event of fixed)overflow.add(event,{},true);
  for(let index=0;index<160;index++)overflow.socketFailure({url:'/?installed-pwa-upgrade=1',socket:{remotePort:index},headers:{'sec-fetch-mode':'same-origin'}});
  live.emit('response',{request:()=>lateDocument,status:()=>200,fromServiceWorker:()=>true});live.emit('requestfinished',lateDocument);
  overflow.flush();const retained=read(path.join(temporary,'late-critical'));
  for(const event of [...fixed,'request','response','requestfinished','origin-socket-destroy'])check(retained.critical.some(item=>item.event===event),'late protocol fact survives prelude overflow: '+event);
  check(retained.lifecycle['pageshow:synthetic'].count===100&&retained.lifecycle['pageshow:trusted'].count===1,'all resume events counted truthfully outside critical storage');
  check(retained.critical.find(item=>item.event==='origin-socket-destroy').count===160,'repeated socket facts aggregate without losing final cleanup');
  check(retained.dropped.events+retained.dropped.bytes>0&&retained.dropped.critical>0&&retained.critical.length<=128&&fs.statSync(path.join(temporary,'late-critical/offline-boundary.json')).size<=524288,'same byte/critical caps with truthful independent overflow');
  const baseline=execFileSync('git',['show','d31f1af9b5697502938a09f000d779abe30a6209:scripts/validate-installed-pwa-upgrade-browser.js'],{cwd:root,encoding:'utf8'}),current=fs.readFileSync(path.join(__dirname,'validate-installed-pwa-upgrade-browser.js'),'utf8');
  function callsIn(source,select){const selected=[];function walk(node){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&select(node.callee))selected.push(source.slice(node.start,node.end));for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}}walk(acorn.parse(source,{ecmaVersion:'latest'}));return selected;}
  const assertion=callee=>callee.type==='Identifier'&&callee.name==='assert'||callee.type==='MemberExpression'&&callee.object.name==='assert';
  assert.deepEqual(callsIn(current,assertion),callsIn(baseline,assertion),'every original assertion retains exact text/order');passed++;
  const timed=callee=>callee.type==='MemberExpression'&&['waitForTimeout','waitForFunction'].includes(callee.property.name);
  assert.deepEqual(callsIn(current,timed),callsIn(baseline,timed),'every original timed wait/deadline retains exact text/order');passed++;
  check(current.indexOf('await offlineProbe.preflight(browser')<current.indexOf('const context=await browser.newContext')&&current.indexOf('offlineProbe.beginBoundary();')<current.indexOf("await offlineProbe.capture('before-offline'"),'preflight precedes fresh original app context; verified boundary gate precedes offline transition');
  for(const file of ['index.html','service-worker.js','assets/js/app-update.js','assets/js/app-shell-runtime.js','assets/js/account-awareness-runtime.js']){assert(fs.readFileSync(path.join(root,file)).equals(execFileSync('git',['show','d31f1af9b5697502938a09f000d779abe30a6209:'+file],{cwd:root,maxBuffer:8*1024*1024})),file+' remains exact failing app bytes');passed++;}
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/installed-upgrade-tests.yml'),'utf8');
  check(workflow.includes("'[\"webkit\"]' || '[\"chromium\",\"webkit\"]'")&&workflow.includes('OFFLINE DIAGNOSTIC - NOT RELEASE ACCEPTANCE'),'distinct single-engine opt-in check');
  check(workflow.includes("if: ${{ !contains(github.event.pull_request.labels.*.name, 'pwa-offline-diagnostic') }}")&&workflow.includes('ACCOUNT_RECOVERY_CASE: all'),'normal full account gate retained; diagnostic cannot masquerade as it');
  check(!workflow.includes('workflow_dispatch')&&!workflow.includes('contents: write')&&workflow.includes('contents: read')&&workflow.includes('if: always()'),'existing PR adapter/read permission/failure artifact upload retained');
  console.log('Installed offline diagnostic: '+passed+' deterministic guards passed; no native/cloud run or release acceptance.');
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=main;
