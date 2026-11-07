'use strict';
// Synthetic local Git/file fixtures only: no deployed facts or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const resolver=require('./resolve-installed-production-baseline'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const SECRET='PRIVATE_INPUT_PATH_URL_OR_ERROR',NOW=Date.now(),stamp=new Date(NOW).toISOString(),clone=v=>JSON.parse(JSON.stringify(v));
async function primaryCaptureControls(){
 const passed=[],denied={network:0,provider:0,alias:0,child:0,filesystem:0},loads=[],module={exports:{}};
 const verifierSource=fs.readFileSync(path.join(__dirname,'verify-production-release.js'),'utf8');
 const closedRequire=name=>{
  loads.push(name);
  if(name==='node:fs')return new Proxy({},{get(){denied.filesystem++;throw Error(SECRET);}});
  if(name==='node:child_process')return{execFileSync(){denied.child++;throw Error(SECRET);}};
  if(['node:path','node:crypto'].includes(name))return require(name);
  if(name.includes('alias'))denied.alias++;
  else if(name.includes('vercel'))denied.provider++;
  else denied.network++;
  throw Error(SECRET);
 };
 require('node:vm').runInNewContext(verifierSource,{module,exports:module.exports,require:closedRequire,__dirname,Buffer,URL,Date,Uint8Array,AbortController,AbortSignal,performance,setTimeout,clearTimeout,process:{env:{}},fetch:()=>{denied.network++;throw Error(SECRET);},console:{log(){throw Error(SECRET);}}},{timeout:1000});
 const api=module.exports;
 const sourceFiles=['config/deployment-manifest.json',...api.FILES],blobs=new Map();
 // Existing accepted commit objects, not workspace files or a network fixture.
 for(const file of sourceFiles)blobs.set(file,cp.execFileSync('git',['show',api.BASELINE+':'+file],{cwd:path.join(__dirname,'..'),encoding:null,stdio:['ignore','pipe','pipe'],timeout:2000,maxBuffer:4194304,env:{PATH:process.env.PATH,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}}));
 assert.equal(hash(blobs.get('config/deployment-manifest.json')),api.POLICY_HASH);
 const nullObjects=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.assign(Object.create(null),Object.fromEntries(Object.entries(value).map(([key,child])=>[key,nullObjects(child)]))):value;
 const binding=()=>nullObjects({schemaVersion:'primary-baseline-capture-binding.v1',baselineSha:api.BASELINE,baselineVersion:api.BASELINE_VERSION,preparedForBaseSha:api.BASELINE,collectorSha:'a'.repeat(40),collectorTree:'b'.repeat(40),deployment:{id:api.DEPLOYMENT,state:'READY',releaseGitSha:api.BASELINE,origin:api.PRIMARY,checkedAt:stamp},alias:{domain:'nothingsport.app',deploymentId:api.DEPLOYMENT,projectId:api.PROJECT,teamId:api.TEAM,redirect:null,checkedAt:stamp},publisherWindow:{owner:'nsPUBLISH',held:true}});
 function fixture(){
  const f={binding:binding(),mono:0,wall:NOW,calls:[],timers:[],cancelledReaders:0,releasedReaders:0};
  f.advance=ms=>{f.mono+=ms;f.wall+=ms;};
  f.trigger=ms=>{const handle=[...f.timers].reverse().find(t=>t.ms===ms&&!t.closed);assert(handle);handle.fn();};
  f.read=args=>{
   if(args[0]==='rev-parse'){
    if(args[2]==='HEAD^{commit}')return Buffer.from('a'.repeat(40)+'\n');
    if(args[2]==='HEAD^{tree}')return Buffer.from('b'.repeat(40)+'\n');
    if(args[2]===api.BASELINE+'^{commit}')return Buffer.from(api.BASELINE+'\n');
    if(args[2]===api.BASELINE+'^{tree}')return Buffer.from(api.BASELINE_TREE+'\n');
   }
   if(args[0]==='merge-base'&&args[1]==='--is-ancestor')return Buffer.alloc(0);
   if(args[0]==='show'&&args[1].startsWith(api.BASELINE+':')){const found=blobs.get(args[1].slice(api.BASELINE.length+1));if(found)return found;}
   throw Error(SECRET);
  };
  f.response=(file,{status=200,bytes=blobs.get(file),headers={}}={})=>{
   let sent=false;
   return{status,headers:{get:key=>headers[key]??null},body:{
    cancel:async()=>{f.cancelledReaders++;},
    getReader:()=>({read:async()=>{f.advance(1);if(sent)return{done:true};sent=true;return{done:false,value:bytes};},cancel:async()=>{f.cancelledReaders++;},releaseLock:()=>{f.releasedReaders++;}})
   }};
  };
  f.request=async(url,options)=>{
   f.calls.push({url,options});f.advance(1);
   const pathname=new URL(url).pathname,file=pathname==='/'?'index.html':pathname.slice(1);
   assert(api.FILES.includes(file));return f.response(file);
  };
  f.run=overrides=>api.captureInstalledPrimaryBaseline({binding:f.binding,read:f.read,request:f.request,environment:{},now:()=>f.wall,timer:()=>f.mono,schedule:(fn,ms)=>{const handle={fn,ms,closed:false};f.timers.push(handle);return handle;},cancel:handle=>{handle.closed=true;},captureId:'closed-mock-capture',...overrides});
  return f;
 }
 async function control(name,operation){await operation();passed.push(name);}
 function stopped(report,code,attempts){assert.equal(report.state,'STOP_FIRST_FAILURE_NO_RETRY');assert.equal(report.readyForBaselineRecord,false);assert.equal(report.failure.code,code);assert.equal(report.attempted,attempts);assert(!JSON.stringify(report).includes(SECRET));}
 await control('independent INTENT/body ACK bytes join before any transport; not cloud authority',async()=>{
  const intentBytes=Buffer.from('{"scope":"SYNTHETIC_CONTROL_ONLY_NOT_AUTHORITY"}\n'),bodyBytes=Buffer.from('{"schemaVersion":"primary-baseline-capture-request.v1"}');
  const args={intentBytes,bodyBytes,acknowledgedIntentSha256:hash(intentBytes),acknowledgedBodySha256:hash(bodyBytes)};
  const joined=api.validateCaptureIntentBodyAck(args);assert.equal(joined.scope,'BYTE_JOIN_ONLY_NOT_ACK_AUTHENTICATION_OR_ACTION_AUTHORITY');
  for(const mutate of [
   x=>{x.intentBytes=Buffer.concat([x.intentBytes,Buffer.from(' ')]);},
   x=>{x.bodyBytes=Buffer.concat([x.bodyBytes,Buffer.from(' ')]);},
   x=>{x.acknowledgedIntentSha256='0'.repeat(64);},x=>{x.acknowledgedBodySha256='0'.repeat(64);},
   x=>{x.acknowledgedIntentSha256='invalid';},x=>{x.intentBytes=Buffer.alloc(api.MAX_RECEIPT+1);},
   x=>{x.bodyBytes=Buffer.alloc(65537);},
   x=>{x.bodyBytes=Buffer.concat([x.bodyBytes,Buffer.from('\n')]);x.acknowledgedBodySha256=hash(x.bodyBytes);},
   x=>{x.bodyBytes=Buffer.from('{"x":1,"x":2}');x.acknowledgedBodySha256=hash(x.bodyBytes);}
  ]){const f=fixture(),broken={...args};mutate(broken);assert.throws(()=>api.validateCaptureIntentBodyAck(broken));assert.equal(f.calls.length,0);}
 });
 await control('fixed accepted611 identity and matching source objects are genuinely applicable',async()=>{
  assert.equal(api.BASELINE,'4bff7ada7d03c3bff52a262f58e630fe47848a74');assert.equal(api.BASELINE_TREE,'5e6eff7d4307fb97e725f57469d9ecabcb78c7a2');assert.equal(api.BASELINE_VERSION,'611');assert.equal(api.DEPLOYMENT,'dpl_CRai77riopJQrZNyGbJZBKkVmPVA');
  assert.equal(JSON.parse(blobs.get('app-version.json')).version,'611');const f=fixture(),r=await f.run();assert.equal(r.baselineSha,api.BASELINE);assert.equal(r.baselineVersion,'611');assert.equal(r.readyForBaselineRecord,true);assert.equal(f.calls.length,3);
 });
 await control('old609 and wrong fixed611 identities refuse before transport',async()=>{
  for(const mutate of [
   b=>b.baselineVersion='609',b=>b.baselineVersion='612',b=>b.baselineSha='037a6214c1a573b57298d3ea504de0b89e31d473',
   b=>b.deployment.id='dpl_iMQryy8NccQZSzJnUc9i1HLdLYhB',b=>b.deployment.releaseGitSha='037a6214c1a573b57298d3ea504de0b89e31d473',
   b=>b.alias.deploymentId='dpl_iMQryy8NccQZSzJnUc9i1HLdLYhB',b=>b.alias.teamId='team_OTHER'
  ]){const f=fixture();mutate(f.binding);const r=await f.run();assert.equal(r.readyForBaselineRecord,false);assert.equal(r.attempted,0);assert.equal(f.calls.length,0);assert.equal(r.failure.code,'binding_identity');}
 });
 await control('actual module import is inert and cannot load alias/provider helpers',async()=>{
  assert.equal(typeof api.captureInstalledPrimaryBaseline,'function');assert.deepEqual(denied,{network:0,provider:0,alias:0,child:0,filesystem:0});assert(!loads.some(n=>n.includes('vercel')||n.includes('alias')));
 });
 await control('default normal route preserved; unknown flags cannot fall through to it',async()=>{
  let normal=0,capture=0,bindings=0;
  const environment=new Proxy({},{get(){throw Error(SECRET);}});
  assert.equal(await api.main({argv:[],environment,normal:async()=>{normal++;return'normal';},capture:async()=>{capture++;}}),'normal');
  for(const argv of [['--unknown'],['--capture-installed-primary-baseline','--skip']])await assert.rejects(()=>api.main({argv,environment,normal:async()=>{normal++;},capture:async()=>{capture++;},readBinding:()=>{bindings++;}}),e=>e.code==='invalid_arguments');
  assert.deepEqual([normal,capture,bindings],[1,0,0]);
 });
 await control('explicit capture CLI route does not invoke the normal verifier',async()=>{
  let normal=0,capture=0,reads=0;const logged=[];
  await api.main({argv:['--capture-installed-primary-baseline'],environment:{NS_PRIMARY_BASELINE_BINDING:'/closed-binding.json'},normal:async()=>{normal++;},readBinding:file=>{assert.equal(file,'/closed-binding.json');reads++;return binding();},capture:async({binding:b})=>{assert.equal(b.baselineSha,api.BASELINE);capture++;return{state:'PASS_THREE_PRIMARY_BODIES_NOT_RELEASE_ACCEPTANCE'};},log:x=>logged.push(x)});
  assert.deepEqual([normal,capture,reads,logged.length],[0,1,1,1]);
 });
 await control('binding input is bounded, owned, regular, stable and fail-closed without real filesystem access',async()=>{
  for(const kind of ['valid','relative','symlink','large','hardlink','writable','wrong-owner','changed-inode','changed-time','malformed']){
   let closes=0,stats=0;const bytes=Buffer.from(kind==='malformed'?'{'+SECRET:JSON.stringify(binding()));
   const initial={isFile:()=>true,isSymbolicLink:()=>kind==='symlink',size:kind==='large'?api.MAX_RECEIPT+1:bytes.length,nlink:kind==='hardlink'?2:1,uid:kind==='wrong-owner'?2000:1000,mode:kind==='writable'?0o666:0o644,ino:1,dev:1,mtimeMs:1,ctimeMs:1};
   const closedFs={constants:{O_RDONLY:0,O_NOFOLLOW:1},lstatSync:()=>initial,openSync:()=>3,fstatSync:()=>{stats++;return{...initial,ino:kind==='changed-inode'?2:1,mtimeMs:kind==='changed-time'&&stats>1?2:1};},readFileSync:()=>bytes,closeSync:()=>{closes++;}};
   const isolated={exports:{}},localRequire=name=>name==='node:fs'?closedFs:name==='node:child_process'?{execFileSync(){throw Error(SECRET);}}:['node:path','node:crypto'].includes(name)?require(name):(()=>{throw Error(SECRET);})();
   require('node:vm').runInNewContext(verifierSource,{module:isolated,exports:isolated.exports,require:localRequire,__dirname,Buffer,URL,Date,Uint8Array,AbortController,AbortSignal,performance,setTimeout,clearTimeout,process:{env:{},getuid:()=>1000},fetch(){throw Error(SECRET);}},{timeout:1000});
   if(kind==='valid'){assert.equal(JSON.stringify(isolated.exports.readCaptureBinding('/closed.json')),JSON.stringify(binding()));assert.equal(closes,1);}
   else{assert.throws(()=>isolated.exports.readCaptureBinding(kind==='relative'?'relative.json':'/closed.json'),e=>e.code==='binding_input'&&!e.message.includes(SECRET));assert.equal(closes,stats>0?1:0);}
  }
 });
 await control('exact three full primary entity bodies, order, hashes, clocks and cleanup',async()=>{
  const f=fixture(),r=await f.run();assert.equal(r.state,'PASS_THREE_PRIMARY_BODIES_NOT_RELEASE_ACCEPTANCE');assert.equal(r.readyForBaselineRecord,true);assert.deepEqual([r.attempted,r.completeBodies,r.matchedFiles],[3,3,3]);assert.deepEqual(Array.from(r.remaining),[]);
  assert.deepEqual(f.calls.map(c=>new URL(c.url).pathname),['/','/service-worker.js','/app-version.json']);
  for(let i=0;i<3;i++){
   const c=f.calls[i],entry=r.files[i],url=new URL(c.url);assert.equal(url.origin,api.PRIMARY);assert.deepEqual([...url.searchParams.keys()],['baselineProof']);assert.equal(c.options.method,'GET');assert.equal(c.options.redirect,'manual');assert.equal(c.options.credentials,'omit');assert.equal(c.options.referrer,'');assert.equal(c.options.referrerPolicy,'no-referrer');assert.equal(c.options.cache,'no-store');assert.deepEqual(Object.keys(c.options.headers).sort(),['Accept','Accept-Encoding','Cache-Control']);assert.equal(c.options.signal.aborted,true);
   assert.equal(entry.status,200);assert.equal(entry.servedBytes,blobs.get(api.FILES[i]).length);assert.equal(entry.servedSha256,hash(blobs.get(api.FILES[i])));assert(Date.parse(entry.bodyCompletedAt)>=Date.parse(entry.headersObservedAt));assert(Date.parse(entry.headersObservedAt)>=Date.parse(entry.requestStartedAt));assert(entry.elapsedMs<api.FILE_MS);
  }
  assert(f.timers.every(t=>t.closed));assert.equal(f.releasedReaders,3);assert(Buffer.byteLength(JSON.stringify(r))<=api.MAX_RECEIPT);
 });
 await control('binding shape, exact origin, deployment, alias, source SHA and held owner refuse before requests',async()=>{
  for(const mutate of [b=>b.url=SECRET,b=>b.baselineSha='c'.repeat(40),b=>b.baselineVersion='608',b=>b.deployment.origin='https://outside.invalid',b=>b.deployment.id='dpl_OTHER',b=>b.alias.domain='nothingsport.vercel.app',b=>b.alias.redirect='https://outside.invalid',b=>b.alias.projectId='prj_OTHER',b=>b.publisherWindow.held=false,b=>b.publisherWindow.owner='other']){
   const f=fixture();mutate(f.binding);const r=await f.run();assert.equal(r.readyForBaselineRecord,false);assert.equal(f.calls.length,0);assert.equal(r.state,'STOP_FIRST_FAILURE_NO_RETRY');assert(!JSON.stringify(r).includes(SECRET));
  }
 });
 await control('future, stale and malformed publisher observation clocks refuse with zero requests',async()=>{
  for(const field of ['deployment','alias'])for(const value of [new Date(NOW+1).toISOString(),new Date(NOW-86400001).toISOString(),'not-a-clock']){
   const f=fixture();f.binding[field].checkedAt=value;stopped(await f.run(),'binding_clock',0);assert.equal(f.calls.length,0);
  }
 });
 await control('actual collector/tree, ancestor read, materialization policy and baseline version are bound',async()=>{
  for(const change of ['collector','tree','baseline-tree','ancestor','policy','version']){
   const f=fixture(),original=f.read;
   if(change==='collector')f.binding.collectorSha='c'.repeat(40);
   if(change==='tree')f.binding.collectorTree='c'.repeat(40);
   f.read=args=>{
    if(change==='baseline-tree'&&args[0]==='rev-parse'&&args[2]===api.BASELINE+'^{tree}')return Buffer.from('c'.repeat(40)+'\n');
    if(change==='ancestor'&&args[0]==='merge-base')throw Error(SECRET);
    if(change==='policy'&&args[0]==='show'&&args[1].endsWith(':config/deployment-manifest.json'))return Buffer.from('{}');
    if(change==='version'&&args[0]==='show'&&args[1].endsWith(':app-version.json'))return Buffer.from('{"version":"608"}\n');
    return original(args);
   };
   const r=await f.run();assert.equal(r.readyForBaselineRecord,false);assert.equal(f.calls.length,0);assert(!JSON.stringify(r).includes(SECRET));
  }
 });
 await control('redirects and every non200 stop once, with no follow or error-body echo',async()=>{
  for(const status of [201,301,302,304,401,404,503]){
   const f=fixture();f.request=async(url,options)=>{f.calls.push({url,options});return f.response('index.html',{status,headers:{location:'https://outside.invalid/'+SECRET,'set-cookie':SECRET}});};
   const r=await f.run();stopped(r,'http_status',1);assert.equal(f.calls.length,1);assert.equal(r.files[0].status,status);assert.equal(r.files[0].servedSha256,null);assert.equal(f.cancelledReaders,1);
  }
 });
 await control('TLS verification failure is closed, preHTTP, one attempt and not a bypass or retry',async()=>{
  const f=fixture();f.request=async(url,options)=>{f.calls.push({url,options});throw Object.assign(Error(SECRET),{cause:{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}});};
  const r=await f.run();stopped(r,'tls_verification_failed',1);assert.equal(r.files[0].status,null);assert.equal(r.files[0].servedBytes,null);assert.equal(r.files[0].servedSha256,null);assert.equal(f.calls.length,1);assert(f.timers.every(t=>t.closed));
 });
 await control('unsafe TLS environment configurations refuse before any request',async()=>{
  for(const environment of [{NODE_TLS_REJECT_UNAUTHORIZED:'0'},{NODE_EXTRA_CA_CERTS:'/custom'},{SSL_CERT_FILE:'/custom'},{SSL_CERT_DIR:'/custom'},{NODE_OPTIONS:'--require custom'}]){
   const f=fixture();stopped(await f.run({environment}),'tls_configuration',0);assert.equal(f.calls.length,0);
  }
 });
 await control('complete wrong lengths and same-length hash mismatches are distinct failures',async()=>{
  for(const kind of ['length','hash']){
   const f=fixture(),bytes=Buffer.from(blobs.get('index.html'));if(kind==='hash')bytes[0]^=1;const served=kind==='length'?bytes.subarray(1):bytes;
   f.request=async(url,options)=>{f.calls.push({url,options});return f.response('index.html',{bytes:served});};
   const r=await f.run();stopped(r,kind==='length'?'body_length_mismatch':'body_hash_mismatch',1);assert.equal(r.completeBodies,1);assert.equal(r.files[0].servedBytes,served.length);assert.equal(r.files[0].servedSha256,hash(served));assert.equal(f.calls.length,1);assert.equal(f.cancelledReaders,1);
  }
 });
 await control('stream entity cap aborts before accepting an oversized chunk',async()=>{
  const f=fixture();f.request=async(url,options)=>{f.calls.push({url,options});return f.response('index.html',{bytes:Buffer.alloc(api.MAX_BODY+1)});};
  const r=await f.run();stopped(r,'body_too_large',1);assert.equal(r.completeBodies,0);assert.equal(r.files[0].servedBytes,null);assert.equal(r.files[0].servedSha256,null);assert.equal(f.cancelledReaders,1);
 });
 await control('header and complete-body deadlines stop even when injected transport ignores abort',async()=>{
  for(const stage of ['headers','body']){
   const f=fixture();
   f.request=async(url,options)=>{
    f.calls.push({url,options});
    const hang=()=>{f.advance(api.FILE_MS+1);f.trigger(api.FILE_MS);return new Promise(()=>{});};
    if(stage==='headers')return hang();
    return{status:200,headers:{get:()=>null},body:{getReader:()=>({read:hang,cancel:async()=>{f.cancelledReaders++;},releaseLock(){}})}};
   };
   const r=await f.run();stopped(r,'file_timeout',1);assert.equal(f.calls.length,1);assert.equal(r.files[0].status,stage==='headers'?null:200);assert.equal(r.files[0].servedSha256,null);assert(f.timers.every(t=>t.closed));assert.equal(f.calls[0].options.signal.aborted,true);
  }
 });
 await control('whole capture deadline remains independent of a later file deadline',async()=>{
  const f=fixture(),original=f.read;let advanced=false;
  f.read=args=>{if(!advanced&&args[0]==='show'){advanced=true;f.advance(api.CAPTURE_MS-1000);}return original(args);};
  f.request=async(url,options)=>{f.calls.push({url,options});f.advance(1001);f.trigger(api.CAPTURE_MS);return new Promise(()=>{});};
  const r=await f.run();stopped(r,'capture_timeout',1);assert(f.timers.every(t=>t.closed));
 });
 await control('backward and implausibly future response clocks cannot create served facts',async()=>{
  for(const amount of [-1,2000]){
   const f=fixture();f.request=async(url,options)=>{f.calls.push({url,options});f.wall+=amount;return f.response('index.html');};
   const r=await f.run();stopped(r,'capture_clock',1);assert.equal(r.files[0].servedSha256,null);assert.equal(r.readyForBaselineRecord,false);
  }
 });
 await control('partial capture keeps first actual proof but cannot emit a complete baseline record',async()=>{
  const f=fixture();f.request=async(url,options)=>{f.calls.push({url,options});return f.response(f.calls.length===1?'index.html':'service-worker.js',{status:f.calls.length===1?200:503});};
  const r=await f.run();stopped(r,'http_status',2);assert.equal(r.matchedFiles,1);assert.equal(r.completeBodies,1);assert.deepEqual(Array.from(r.remaining),['app-version.json']);assert.equal(r.files[0].servedSha256,hash(blobs.get('index.html')));assert.equal(r.files[1].servedSha256,null);assert.equal(f.calls.length,2);
 });
 await control('safe header bounds and no raw-body, redirect, cookie or error payload leakage',async()=>{
  const f=fixture();f.request=async(url,options)=>{f.calls.push({url,options});const pathname=new URL(url).pathname,file=pathname==='/'?'index.html':pathname.slice(1);return f.response(file,{headers:{etag:'X'.repeat(1000),location:SECRET,'set-cookie':SECRET,'content-type':'text/plain','content-encoding':'identity'}});};
  const r=await f.run();assert.equal(r.readyForBaselineRecord,true);assert(r.files.every(x=>x.headers.etag===null&&x.headers['content-type']==='text/plain'));assert(!JSON.stringify(r).includes(SECRET));assert(Buffer.byteLength(JSON.stringify(r))<=api.MAX_RECEIPT);
 });
 assert.deepEqual(denied,{network:0,provider:0,alias:0,child:0,filesystem:0});
 return{status:'PASS_PURE_PRIMARY_CAPTURE_CONTROLS',groups:passed.length,passed,networkRequests:denied.network,providerRequests:denied.provider,aliasCalls:denied.alias,fixtureGitReads:sourceFiles.length,scope:'Actual verifier in a closed VM with injected transport/clock/streams and four existing committed accepted611 blobs; synthetic transport only, no real611 capture or external INTENT/ACK authority; no real transport calibration, primary body observation, CI or device acceptance'};
}
async function run(){
 let checks=0;
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'installed-baseline-'));
 function fixture({preserve=true,policy}={}){
  const repo=fs.mkdtempSync(path.join(root,'git-')),git=args=>cp.execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:os.devNull},timeout:5000});
  const write=(file,value)=>{const target=path.join(repo,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
  const commit=message=>{git(['add','.']);git(['commit','--quiet','-m',message]);return git(['rev-parse','HEAD']).trim();};
  git(['init','--quiet']);git(['config','user.name','Synthetic test']);git(['config','user.email','test@example.invalid']);
  write('index.html','<meta name="app-shell-version" content="594">\n');write('service-worker.js','const SHELL_VERSION="594";\n');write('app-version.json','{\n  "version": "594"\n}\n');
  if(policy!==null)write('config/deployment-manifest.json',JSON.stringify(policy||{schemaVersion:'deployment-manifest.v1',compactJson:true,preserveBytes:preserve?resolver.FILES:[]}));
  const baseline=commit('Synthetic live594 source');
  write('index.html','<meta name="app-shell-version" content="595">\n');write('service-worker.js','const SHELL_VERSION="595";\n');write('app-version.json','{"version":"595"}\n');
  const base=commit('Synthetic unshipped main595');
  const record={schemaVersion:'installed-production-baseline.v1',preparedForBaseSha:base,baselineSha:baseline,baselineVersion:'594',deployment:{id:'dpl_LOCALTEST',state:'READY',releaseGitSha:baseline,origin:resolver.ORIGIN,checkedAt:stamp},files:{}};
  for(const file of resolver.FILES){const raw=Buffer.from(git(['show',baseline+':'+file])),served=file==='app-version.json'&&!preserve?Buffer.from(JSON.stringify(JSON.parse(raw))+'\n'):raw;record.files[file]={gitSha256:hash(raw),servedSha256:hash(served),servedBytes:served.length,status:200,checkedAt:stamp};}
  const source=fs.readFileSync(path.join(__dirname,'resolve-installed-production-baseline.js'));write('scripts/resolve-installed-production-baseline.js',source);
  const recordCommit=value=>{write(resolver.RECORD,typeof value==='string'?value:JSON.stringify(value));return commit('Synthetic committed baseline record');};recordCommit(record);
  return{repo,git,write,commit,baseline,base,record,recordCommit};
 }
 try{
  const f=fixture(),resolve=record=>resolver.resolve({record,prBaseSha:f.base,root:f.repo,now:NOW});
  assert.equal(resolve(f.record),f.baseline,'Live594 wins over unshippedmain595, with candidate595');checks++;
  const mutations=[
   ['record_schema',r=>r.schemaVersion='unknown'],['record_shape',r=>r.url='https://'+SECRET],['file_set',r=>r.files=[]],
   ['record_sha',r=>r.baselineSha='--'+SECRET],['record_sha',r=>r.preparedForBaseSha='A'.repeat(40)],['record_base_mismatch',r=>r.preparedForBaseSha='a'.repeat(40)],
   ['baseline_version',r=>r.baselineVersion=594],['baseline_version',r=>r.baselineVersion='0594'],['baseline_version',r=>r.baselineVersion='9'.repeat(17)],
   ['deployment_shape',r=>r.deployment.headers=SECRET],['deployment_binding',r=>r.deployment.state='BUILDING'],['deployment_binding',r=>r.deployment.id=SECRET],
   ['deployment_binding',r=>r.deployment.releaseGitSha=f.base],['deployment_binding',r=>r.deployment.origin='https://outside.invalid/'+SECRET],
   ['evidence_timestamp',r=>r.deployment.checkedAt='2026-02-30T00:00:00Z'],['evidence_not_fresh',r=>r.deployment.checkedAt=new Date(NOW+1).toISOString()],
   ['evidence_not_fresh',r=>r.deployment.checkedAt=new Date(NOW-86400001).toISOString()],['file_set',r=>delete r.files['service-worker.js']],
   ['file_set',r=>r.files['../'+SECRET]=r.files['index.html']],['file_proof',r=>r.files['index.html'].url=SECRET],['file_proof',r=>r.files['index.html'].status=304],
   ['file_proof',r=>r.files['index.html'].servedBytes=0],['file_proof',r=>r.files['index.html'].servedBytes=4194305],['file_proof',r=>r.files['index.html'].gitSha256=SECRET],
   ['file_proof',r=>r.files['index.html'].servedSha256=SECRET],['evidence_not_fresh',r=>r.files['index.html'].checkedAt=new Date(NOW-86400001).toISOString()],
   ['source_hash_mismatch',r=>r.files['index.html'].gitSha256='0'.repeat(64)],['served_hash_mismatch',r=>r.files['index.html'].servedSha256='0'.repeat(64)],
   ['served_hash_mismatch',r=>r.files['index.html'].servedBytes++],['baseline_version',r=>r.baselineVersion='593'],
   ['strict_upgrade_required',r=>{r.baselineSha=f.base;r.baselineVersion='595';r.deployment.releaseGitSha=f.base;}],
   ['git_read_failed',r=>{r.baselineSha='0'.repeat(40);r.deployment.releaseGitSha=r.baselineSha;}]
  ];
  for(const[code,change]of mutations){const r=clone(f.record);change(r);assert.throws(()=>resolve(r),e=>resolver.failureCode(e)===code,code);checks++;}
  assert.throws(()=>resolver.resolve({record:f.record,prBaseSha:SECRET,root:f.repo,now:NOW}),e=>resolver.failureCode(e)==='pr_base_missing');checks++;
  const unrelated=f.git(['commit-tree',f.baseline+'^{tree}','-m','Synthetic unrelated history']).trim(),foreign=clone(f.record);foreign.baselineSha=unrelated;foreign.deployment.releaseGitSha=unrelated;
  assert.throws(()=>resolve(foreign),e=>resolver.failureCode(e)==='baseline_not_ancestor');checks++;
  foreign.preparedForBaseSha=unrelated;assert.throws(()=>resolver.resolve({record:foreign,prBaseSha:unrelated,root:f.repo,now:NOW}),e=>resolver.failureCode(e)==='base_not_ancestor');checks++;
  const compact=fixture({preserve:false});assert.equal(resolver.resolve({record:compact.record,prBaseSha:compact.base,root:compact.repo,now:NOW}),compact.baseline);assert.notEqual(compact.record.files['app-version.json'].gitSha256,compact.record.files['app-version.json'].servedSha256);checks++;
  for(const policy of [null,{schemaVersion:'unknown',compactJson:true,preserveBytes:[]},{schemaVersion:'deployment-manifest.v1',compactJson:'yes',preserveBytes:[]}]){
   const bad=fixture({policy});assert.throws(()=>resolver.resolve({record:bad.record,prBaseSha:bad.base,root:bad.repo,now:NOW}),e=>resolver.failureCode(e)==='deployment_policy');checks++;
  }
  const boundary=clone(f.record);boundary.deployment.checkedAt=new Date(NOW-86400000).toISOString();assert.equal(resolve(boundary),f.baseline);checks++;
  const tagged=clone(f.record);f.git(['tag','-a','synthetic-baseline-tag',f.baseline,'-m','Test tag is not a commit id']);tagged.baselineSha=f.git(['rev-parse','synthetic-baseline-tag']).trim();tagged.deployment.releaseGitSha=tagged.baselineSha;assert.throws(()=>resolve(tagged),e=>resolver.failureCode(e)==='git_commit_required');checks++;
  const logs=[],deniedEnvironment=new Proxy({},{get(){throw Error(SECRET);}});resolver.main({argv:[],environment:deniedEnvironment,root:path.join(root,'missing'),log:line=>logs.push(line)});assert.deepEqual(JSON.parse(logs[0]),{state:'INERT_NO_BASELINE_READ',gitCalls:0,networkCalls:0});checks++;
  assert.equal(resolver.failureCode({baselineCode:SECRET,message:SECRET}),'resolution_failed');checks++;
  const preload=path.join(root,'deny.cjs');fs.writeFileSync(preload,"let n=0;const deny=()=>{n++;throw Error('Network forbidden');};global.fetch=deny;for(const name of ['http','https','net','tls']){const m=require('node:'+name);for(const k of ['request','get','connect','createConnection'])if(typeof m[k]==='function')m[k]=deny;}process.on('exit',()=>console.log(JSON.stringify({networkCalls:n})));\n");
  function cli({args=['--resolve'],output=path.join(root,'output-'+checks),base=f.base}={}){
   const p=cp.spawnSync(process.execPath,['--require',preload,path.join(f.repo,'scripts/resolve-installed-production-baseline.js'),...args],{cwd:f.repo,encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH,NS_INSTALLED_PR_BASE_SHA:base,GITHUB_OUTPUT:output}});
   assert(!p.error);assert(!p.stdout.includes(SECRET)&&!p.stderr.includes(SECRET)&&!p.stderr.includes(f.repo));assert(p.stdout.includes('"networkCalls":0'));return{...p,output};
  }
  const output=path.join(root,'valid-output');fs.writeFileSync(output,'');let result=cli({output});assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(output,'utf8'),'baseline_sha='+f.baseline+'\n');assert(!result.stdout.includes(f.baseline)&&!result.stdout.includes(f.base));checks++;
  f.write(resolver.RECORD,JSON.stringify({url:SECRET}));fs.writeFileSync(output,'');result=cli({output});assert.equal(result.status,0,'Uncommitted working copy cannot replace HEAD record');assert.equal(fs.readFileSync(output,'utf8'),'baseline_sha='+f.baseline+'\n');checks++;
  f.recordCommit('{'+SECRET);fs.writeFileSync(output,'prior\n');result=cli({output});assert.equal(result.status,1);assert(result.stderr.includes('record_json'));assert.equal(fs.readFileSync(output,'utf8'),'prior\n');checks++;
  f.recordCommit(f.record);result=cli({output:path.join(root,SECRET)});assert.equal(result.status,1);assert(result.stderr.includes('output_unavailable'));assert(!fs.existsSync(path.join(root,SECRET)));checks++;
  const symlink=path.join(root,'output-symlink');fs.symlinkSync(output,symlink);result=cli({output:symlink});assert.equal(result.status,1);assert(result.stderr.includes('output_unavailable'));assert.equal(fs.readFileSync(output,'utf8'),'prior\n');checks++;
  result=cli({output:root});assert.equal(result.status,1);assert(result.stderr.includes('output_unavailable'));checks++;
  result=cli({args:['--resolve','--record',SECRET],output});assert.equal(result.status,1);assert(result.stderr.includes('invalid_arguments'));checks++;
  fs.unlinkSync(path.join(f.repo,resolver.RECORD));fs.symlinkSync(SECRET,path.join(f.repo,resolver.RECORD));f.commit('Synthetic symlink record');result=cli({output});assert.equal(result.status,1);assert(result.stderr.includes('record_unavailable'));assert.equal(fs.readFileSync(output,'utf8'),'prior\n');checks++;
  fs.renameSync(path.join(f.repo,'.git'),path.join(f.repo,'hidden-git'));result=cli({output});assert.equal(result.status,1);assert.equal(result.stderr.trim(),'Installed baseline resolver: git_read_failed');assert.equal(fs.readFileSync(output,'utf8'),'prior\n');checks++;
  const primaryCapture=await primaryCaptureControls();
  return{checks,networkCalls:0,browserRuns:0,cloudVerification:false,releaseAcceptance:false,primaryCapture};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
module.exports=run;
if(require.main===module)run().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
