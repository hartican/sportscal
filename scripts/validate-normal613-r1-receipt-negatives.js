'use strict';
// PRIVATE SOURCE PROPOSAL. Execution is limited to the allocated Linux focused lane.
// Capture real clocks and the admitted context before any synthetic clock/env double.
const NSB_ASSERT=require('node:assert/strict'),NSB_FS=require('node:fs'),NSB_PATH=require('node:path'),NSB_CRYPTO=require('node:crypto');
const NSB_NATIVE_MONO=process.hrtime.bigint.bind(process.hrtime);
const NSB_GET=k=>{const x=process.env[k];NSB_ASSERT(/^[1-9][0-9]*$/.test(x||''),'Canonical focused input '+k);return BigInt(x);};
const NSB_ENTRY=NSB_GET('NS_FOCUSED_ENTRY_MONOTONIC_NS'),NSB_AGG=NSB_GET('NS_FOCUSED_AGGREGATE_DEADLINE_NS'),NSB_SOFT=NSB_GET('NS_FOCUSED_CHILD_SOFT_DEADLINE_NS'),NSB_HARD=NSB_GET('NS_FOCUSED_CHILD_HARD_DEADLINE_NS');
NSB_ASSERT.equal(process.platform,'linux');NSB_ASSERT.equal(process.arch,'x64');NSB_ASSERT.equal(process.version,'v24.21.0');NSB_ASSERT.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');
NSB_ASSERT.equal(process.env.NS_FOCUSED_CHILD_SOFT_MS,'28000');NSB_ASSERT.equal(process.env.NS_FOCUSED_CLOSURE_RESERVE_MS,'3000');
NSB_ASSERT(NSB_ENTRY<NSB_SOFT&&NSB_SOFT<NSB_HARD&&NSB_HARD<=NSB_AGG-3000000000n&&NSB_HARD-NSB_SOFT===3000000000n,'Subordinate absolute deadlines');
NSB_ASSERT(NSB_ENTRY<=NSB_NATIVE_MONO()&&NSB_SOFT<=NSB_ENTRY+120000000000n,'Bootstrap stays inside existing aggregate cap');
NSB_ASSERT(NSB_NATIVE_MONO()<NSB_SOFT,'No setup after child deadline');
const NSB_TOKEN=process.env.NS_FOCUSED_OWNER_TOKEN;NSB_ASSERT(/^[a-f0-9]{64}$/.test(NSB_TOKEN||''),'Inherited owner marker');
const NSB_RAW_FS={};for(const name of ['readFileSync','writeFileSync','openSync','closeSync','readSync','writeSync','fsyncSync','mkdirSync','mkdtempSync','chmodSync','lstatSync','statSync','fstatSync','realpathSync','readdirSync','rmSync','unlinkSync','existsSync'])NSB_RAW_FS[name]=NSB_FS[name];
function NSB_BOOT_READ(file,max){
 const check=()=>NSB_ASSERT(NSB_NATIVE_MONO()<NSB_SOFT,'Bounded bootstrap remains charged');check();
 const before=NSB_RAW_FS.lstatSync(file);NSB_ASSERT(before.isFile()&&!before.isSymbolicLink()&&before.uid===process.getuid()&&before.size<=max,'Bounded regular owned bootstrap input');
 check();const fd=NSB_RAW_FS.openSync(file,NSB_FS.constants.O_RDONLY|NSB_FS.constants.O_NOFOLLOW);
 try{const opened=NSB_RAW_FS.fstatSync(fd);for(const k of ['dev','ino','size','mtimeMs','ctimeMs'])NSB_ASSERT.equal(opened[k],before[k]);const chunks=[],buffer=Buffer.alloc(65536);let count=0;
  for(;;){check();const n=NSB_RAW_FS.readSync(fd,buffer,0,Math.min(buffer.length,max-count+1),null);if(!n)break;count+=n;NSB_ASSERT(count<=max,'Bootstrap grew beyond bound');chunks.push(Buffer.from(buffer.subarray(0,n)));}
  check();const after=NSB_RAW_FS.fstatSync(fd);for(const k of ['dev','ino','size','mtimeMs','ctimeMs'])NSB_ASSERT.equal(after[k],opened[k]);NSB_ASSERT.equal(count,before.size);return Buffer.concat(chunks);
 }finally{NSB_RAW_FS.closeSync(fd);}
}
const NSB_TEMP=NSB_RAW_FS.realpathSync(process.env.RUNNER_TEMP),NSB_GUARD_PATH=NSB_PATH.join(__dirname,'validate-forward-onboarding-ci.js');
const NSB_GUARD_BYTES=NSB_BOOT_READ(NSB_GUARD_PATH,160425);NSB_ASSERT.equal(NSB_GUARD_BYTES.length,160425);NSB_ASSERT.equal(NSB_CRYPTO.createHash('sha256').update(NSB_GUARD_BYTES).digest('hex'),'a2e3389d3d34897e63ed8fc9b903652cb9552aef92618a2287db71805425c6c3');
const NSB_S=require('./validate-forward-onboarding-ci').normal613FocusedControls;
const NSB_CONTEXT_PATH=NSB_PATH.join(NSB_TEMP,'ns-normal-613-admission','normal613-context.json');
NSB_ASSERT(NSB_NATIVE_MONO()<NSB_SOFT,'Context bootstrap remains charged');
const NSB_CONTEXT_STAT=NSB_RAW_FS.lstatSync(NSB_CONTEXT_PATH);NSB_ASSERT(NSB_CONTEXT_STAT.isFile()&&!NSB_CONTEXT_STAT.isSymbolicLink()&&NSB_CONTEXT_STAT.uid===process.getuid()&&(NSB_CONTEXT_STAT.mode&0o077)===0&&NSB_CONTEXT_STAT.size<=65536,'Genuine private bounded context');
const NSB_CONTEXT_BYTES=NSB_BOOT_READ(NSB_CONTEXT_PATH,65536);
const NSB_CONTEXT=JSON.parse(NSB_CONTEXT_BYTES.toString('utf8')),NSB_CLOCK=NSB_S.normal613FocusedClock(NSB_CONTEXT,NSB_ENTRY,NSB_AGG);
let NSB_ACTIVE_END=NSB_SOFT,NSB_INTERRUPTED=false,NSB_CLEANUP=false;const NSB_ROOTS=new Set(),NSB_FDS=new Map(),NSB_OUTPUT_ERRORS=[];
const NSB_CHECK=()=>{NSB_ASSERT(!NSB_INTERRUPTED||NSB_CLEANUP,'Focused child interrupted');return NSB_CLOCK.remaining(NSB_ACTIVE_END);};NSB_CHECK();
const NSB_SIGNAL=()=>{NSB_INTERRUPTED=true;};process.on('SIGTERM',NSB_SIGNAL);process.on('SIGINT',NSB_SIGNAL);
const NSB_STREAM_ERROR=e=>{NSB_OUTPUT_ERRORS.push(String(e));NSB_INTERRUPTED=true;process.exitCode=1;};process.stdout.on('error',NSB_STREAM_ERROR);process.stderr.on('error',NSB_STREAM_ERROR);
const NSB_CONSOLE_LOG=console.log.bind(console),NSB_CONSOLE_ERROR=console.error.bind(console);
console.log=(...args)=>{NSB_CHECK();return NSB_CONSOLE_LOG(...args);};
// Error diagnostics may use the existing hard/closure reserve, never renew it.
console.error=(...args)=>{NSB_CLOCK.remaining(NSB_HARD);return NSB_CONSOLE_ERROR(...args);};
for(const name of ['readFileSync','writeFileSync','openSync','readSync','writeSync','fsyncSync','mkdirSync','mkdtempSync','chmodSync','lstatSync','statSync','fstatSync','realpathSync','readdirSync','rmSync','unlinkSync','existsSync']){
 const original=NSB_RAW_FS[name];NSB_FS[name]=function(...args){
  const checkpoint=()=>{if(name==='rmSync'||name==='unlinkSync')return NSB_CLOCK.remaining(NSB_ACTIVE_END);return NSB_CHECK();};
  checkpoint();if(name==='openSync')NSB_ASSERT(NSB_FDS.size<256,'Focused descriptor inventory bound');const value=original.apply(this,args);
  // Register resources before the post-operation check can fail.
  if(name==='openSync'){NSB_FDS.set(value,null);const st=NSB_RAW_FS.fstatSync(value);NSB_FDS.set(value,{dev:st.dev,ino:st.ino,uid:st.uid,rdev:st.rdev});}
  if(name==='mkdtempSync'){
   NSB_ASSERT(typeof value==='string'&&NSB_PATH.resolve(value).startsWith(NSB_TEMP+NSB_PATH.sep),'Test-created scratch stays under original runner temp');NSB_ROOTS.add(NSB_PATH.resolve(value));
  }
  checkpoint();return value;
 };
}
// A close attempt must remain possible after a work deadline or injected write error.
NSB_FS.closeSync=function(fd){const value=NSB_RAW_FS.closeSync(fd);NSB_FDS.delete(fd);return value;};
function NSB_REPORT_HOLD(message){process.exitCode=1;try{NSB_CLOCK.remaining(NSB_HARD);NSB_CONSOLE_ERROR(JSON.stringify({status:'CLEANUP_HOLD',message:(typeof message==='string'?message:JSON.stringify(message)).slice(0,4096),releaseAcceptance:false}));}catch{/* Parent observes nonzero/timeout and retained scratch; no closure claim. */}}
async function NSB_RUN(fn,onError){
 let failed=null;try{await fn();NSB_CHECK();}catch(e){failed=e;}
 finally{
  // Restore injected methods before descriptor and retained-scratch accounting.
  for(const [name,method]of Object.entries(NSB_RAW_FS))NSB_FS[name]=method;
  console.log=NSB_CONSOLE_LOG;console.error=NSB_CONSOLE_ERROR;
  let rescued=0;for(const [fd,identity]of NSB_FDS)try{
   const now=NSB_RAW_FS.fstatSync(fd);NSB_ASSERT(identity&&['dev','ino','uid','rdev'].every(k=>now[k]===identity[k]),'CLEANUP_HOLD descriptor identity changed');
   NSB_RAW_FS.closeSync(fd);NSB_FDS.delete(fd);rescued++;
  }catch(e){if(e.code==='EBADF')NSB_FDS.delete(fd);else failed=failed||e;}
  if(rescued||NSB_FDS.size)failed=failed||Error('CLEANUP_HOLD descriptors required final rescue or identity remains unresolved');
  const retained=[];for(const root of NSB_ROOTS)try{NSB_CLOCK.remaining(NSB_HARD);NSB_RAW_FS.lstatSync(root);retained.push(root);}catch(e){if(e.code!=='ENOENT'){failed=failed||e;retained.push(root);}}
  if(retained.length){failed=failed||Error('CLEANUP_HOLD retained owned scratch');NSB_REPORT_HOLD({retained});}
  if(NSB_OUTPUT_ERRORS.length)failed=failed||Error('Output descriptor failure: '+NSB_OUTPUT_ERRORS.join('; '));
  if(NSB_INTERRUPTED)failed=failed||Error('Focused child interrupted');
  if(!failed)try{NSB_CLOCK.remaining(NSB_SOFT);}catch(e){failed=e;}
  process.removeListener('SIGTERM',NSB_SIGNAL);process.removeListener('SIGINT',NSB_SIGNAL);
 }
 if(failed){process.exitCode=1;try{NSB_CLOCK.remaining(NSB_HARD);onError(failed);}catch(e){NSB_REPORT_HOLD(e);}}
}

const assert=NSB_ASSERT,fs=NSB_FS,path=NSB_PATH,crypto=require('node:crypto'),cp=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),guard=NSB_GUARD_PATH,NS=NSB_S;
const entry=NSB_ENTRY,aggregate=NSB_AGG,soft=NSB_SOFT,hard=NSB_HARD,token=NSB_TOKEN,clock=NSB_CLOCK;
const ms=n=>BigInt(n)*1000000n,mono=clock.nowNs,iso=n=>new Date(n).toISOString();
const qualifier=path.join(__dirname,'validate-sync-current-forward.js'),fixture=path.join(__dirname,'fixtures/sync-normal-613-20261112.json');
const keys='schemaVersion publisherHeadSha publisherTreeSha actualAssembledSourceManifestPath actualAssembledSourceManifestSha256 actualDeploymentSourceManifestPath actualDeploymentSourceManifestSha256 releaseGitSha actualTestedMergeSha actualCloudRunId actualCloudRunAttempt actualCloudJobId namedAllocationId freshMainAndReservationBindingSha256 actualNodeBinarySha256 actualDependencyProofSha256 admissionGranted jobIdKind actualCloudJobKey actualCloudNumericJobId actualWorkflowPath observedAt eventBodySha256 headRole testedCommitRole releaseRole qualifier fixture approvedFinalMap runtime reservation freshMainAndReservationBinding git cloudContext normal613Action normal613Intent normal613Ack'.split(' ');
function base(){const r=Object.fromEntries(keys.map(k=>[k,null]));Object.assign(r,{schemaVersion:'normal613-qualification-execution-receipt.v1',admissionGranted:true,jobIdKind:'github-job-key',actualCloudJobKey:'fixture-activation',actualCloudJobId:'github-job-key:fixture-activation',actualCloudNumericJobId:null,actualWorkflowPath:'.github/workflows/installed-upgrade-tests.yml',headRole:'pull_request.head.sha',testedCommitRole:'pull_request-merge-checkout',releaseRole:'source-qualification-candidate',namedAllocationId:'SYNTHETIC_TEST_ONLY'});return r;}
assert.equal(process.env.NS_FOCUSED_R1_EARLY_TOTAL_MS,'1000');assert.equal(process.env.NS_FOCUSED_R1_TRAVERSAL_TOTAL_MS,'7000');
assert.equal(sha(fs.readFileSync(qualifier)),'a54983351de787e957658f92efedf1e10b470cbb06af252070eb1661228a970f');assert.equal(sha(fs.readFileSync(fixture)),'744ddb4c83e97810bdd9f6778de0f50a5033695f24739d642c9179822c58a5d2');
let interrupted=false;for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{interrupted=true});
const pause=n=>new Promise(resolve=>setTimeout(resolve,n));
const rows=[],caseNames=['missing-deployment-path','admission-false','numeric-job-not-outer-join','wrong-release-role','actual-r1-source-traversal-corruption','actual-r1-dependency-traversal-corruption','actual-r1-deployment-traversal-corruption'];
let caseIndex=0,currentCase=-1;const totals=[1000,1000,1000,1000,7000,7000,7000];
function remainingWindow(outer,windowMs){
 currentCase=caseIndex;assert.equal(outer,soft);assert.equal(totals[caseIndex],windowMs,'Exact ordered R1 case window');
 const future=totals.slice(caseIndex).reduce((a,b)=>a+b,0);clock.remaining(soft,future+100);caseIndex++;
 NSB_ACTIVE_END=mono()+ms(windowMs);return NSB_ACTIVE_END;
}
// The updated production tracker must exclude this reporter while observing its descendants.
// The exact caller-exclusion guard identity is bound below.
async function runBounded(root,args,env,end,outputLimit){
 let child=null,tracker=null,closed=false,exit=null,error=null,out=[],err=[],bytes=0,done=Promise.resolve();
 const fail=e=>{if(!error)error=String(e)};
 try{
  clock.remaining(end,300);tracker=NS.normal613FocusedOwnedProcesses(process.env.NS_FOCUSED_OWNER_TOKEN,clock,end);
  child=cp.spawn(process.execPath,args,{env:{...env,NS_FOCUSED_OWNER_TOKEN:process.env.NS_FOCUSED_OWNER_TOKEN},detached:true,stdio:['ignore','pipe','pipe']});
  done=new Promise(resolve=>{child.once('error',e=>{fail(e);resolve()});child.once('close',(code,signal)=>{closed=true;exit={code,signal};resolve()});});
  for(const [stream,chunks] of [[child.stdout,out],[child.stderr,err]])stream.on('data',b=>{bytes+=b.length;if(bytes>outputLimit){fail('output limit');return}chunks.push(b)}).on('error',fail);
  tracker.setRoot(child.pid);
  while(!closed&&!error&&!interrupted){clock.remaining(end,300);tracker.observe();await Promise.race([done,pause(Math.min(10,clock.remaining(end)))])}
  if(interrupted)fail('interrupted');if(!closed)fail('child did not close');
 }catch(e){fail(e)}finally{
  NSB_CLEANUP=true;
  let observed=false;
  try{
   if(child&&tracker){
    const termUntil=mono()+ms(100);
    for(;;){clock.remaining(end);const observation=tracker.observe();if(closed&&observation.closed){observed=true;break}
     tracker.signalOwned(mono()<termUntil?'SIGTERM':'SIGKILL');await pause(Math.min(10,clock.remaining(end)));
    }
   }else if(child)fail('spawn without ownership tracker');
  }catch(e){fail('CLEANUP_HOLD '+String(e))}
  for(const stream of [child?.stdin,child?.stdout,child?.stderr])try{stream?.destroy()}catch(e){fail('descriptor close '+String(e))}
  if(child&&!observed)fail('CLEANUP_HOLD closure unobserved');
  NSB_CLEANUP=false;
 }
 if(error){console.error(JSON.stringify({status:'CLEANUP_HOLD',ownedRoot:root,wrapperClosed:closed,reason:error}));throw Error(error)}
 return {status:exit.code,signal:exit.signal,stdout:Buffer.concat(out).toString('utf8'),stderr:Buffer.concat(err).toString('utf8')};
}
async function one(parent,name,mutate,needle,outer){const end=remainingWindow(outer,1000),root=fs.mkdtempSync(path.join(parent,'ns613-r1-negative-'));let passed=false;
 try{clock.remaining(end);fs.chmodSync(root,0o700);const admission=path.join(root,'ns-normal-613-admission');fs.mkdirSync(admission,{mode:0o700});const r=base();mutate(r);const bytes=Buffer.from(JSON.stringify(r)+'\n'),file=path.join(admission,'execution-receipt.json');fs.writeFileSync(file,bytes,{mode:0o600});
 const run=await runBounded(root,[qualifier,'--normal613-full','--execution-receipt',file,'--execution-receipt-sha256',sha(bytes)],{...process.env,RUNNER_TEMP:root,GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_JOB:'fixture-activation'},end,1048576);
 assert.notEqual(run.status,0);assert.match(run.stderr,needle);assert(!/all51 completed arms required|paired-ordinary-hydration/.test(run.stdout),'No qualification credited');assert(mono()<end,'case deadline');passed=true;return {name,status:'PASS',childExit:run.status};
 }finally{if(passed&&mono()<end){clock.remaining(end);fs.rmSync(root,{recursive:true,force:false});NSB_ACTIVE_END=soft;}else console.error(JSON.stringify({status:'CLEANUP_HOLD',ownedRoot:root,reason:'failed control or closure/report deadline'}));}}
async function main(){assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');assert(process.env.RUNNER_TEMP);const outer=soft,root=fs.realpathSync(process.env.RUNNER_TEMP);
 clock.remaining(soft,25100);
 rows.push(await one(root,'missing-deployment-path',r=>delete r.actualDeploymentSourceManifestPath,/closed object keys/,outer));
 rows.push(await one(root,'admission-false',r=>{r.admissionGranted=false},/false !== true/,outer));
 rows.push(await one(root,'numeric-job-not-outer-join',r=>{r.actualCloudNumericJobId=1},/numeric job ID belongs/,outer));
 rows.push(await one(root,'wrong-release-role',r=>{r.releaseRole='production'},/source-qualification-candidate/,outer));
 for(const kind of ['source','dependency','deployment'])rows.push(await traversal(root,kind,outer));
 assert(mono()<outer,'FAIL: reporting deadline');console.log(JSON.stringify({schemaVersion:'normal613-r1-receipt-negative-controls.v1',status:'PASS_SYNTHETIC_NEGATIVES_ONLY',rows,fullReceiptCompatibility:'UNRUN',providerRequests:0,realAuthority:false,releaseAcceptance:false}));}
NSB_RUN(main,e=>{console.error(JSON.stringify({status:'FAIL_OR_UNKNOWN',rows,failedCase:currentCase<0?null:caseNames[currentCase],unrun:caseNames.slice(currentCase+1),error:String(e.stack||e).slice(0,4096),releaseAcceptance:false}));process.exitCode=1;});

// Mutations operate only on test-owned copies of already genuinely admitted inputs.
// Source corruption changes a returned buffer, not a candidate file. The inherited
// focused process group owns the qualifier and synchronous Git descendants.
async function traversal(parent,kind,outer){
 const end=remainingWindow(outer,7000);
 const oldRoot=fs.realpathSync(path.join(process.env.RUNNER_TEMP,'ns-normal-613-admission')),original=path.join(oldRoot,'execution-receipt.json'),expected=process.env.NS_FOCUSED_RECEIPT_SHA256;assert(/^[a-f0-9]{64}$/.test(expected||''),'Genuine focused receipt digest required');const raw=fs.readFileSync(original);assert.equal(sha(raw),expected);const receipt=JSON.parse(raw.toString('utf8'));
 const root=fs.mkdtempSync(path.join(parent,'ns613-r1-traversal-'));const admission=path.join(root,'ns-normal-613-admission');let passed=false;
 function clone(source,name){clock.remaining(end);const real=fs.realpathSync(source);assert(real.startsWith(oldRoot+path.sep),'Only existing owned admission data');const st=fs.lstatSync(real);assert(st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&st.size<=16*1024*1024);const bytes=fs.readFileSync(real),dest=path.join(admission,name);fs.writeFileSync(dest,bytes,{mode:0o600,flag:'wx'});return {path:dest,bytes:bytes.length,sha256:sha(bytes)};}
 try{
  clock.remaining(end);fs.chmodSync(root,0o700);fs.mkdirSync(admission,{mode:0o700});
  const assembled=clone(receipt.actualAssembledSourceManifestPath,'assembled-source-manifest.json');assert.equal(assembled.sha256,receipt.actualAssembledSourceManifestSha256);receipt.actualAssembledSourceManifestPath=assembled.path;
  const deployment=clone(receipt.actualDeploymentSourceManifestPath,'deployment-files.json');assert.equal(deployment.sha256,receipt.actualDeploymentSourceManifestSha256);receipt.actualDeploymentSourceManifestPath=deployment.path;
  for(const [obj,key,name]of [[receipt.runtime,'dependencyProof','dependencies.json'],[receipt.reservation,'receipt','reservation-receipt.json'],[receipt.freshMainAndReservationBinding,'receipt','fresh.json'],[receipt,'normal613Intent','intent.json'],[receipt,'normal613Ack','ack.json']]){const old=obj[key],copy=clone(old.path,name);assert.equal(copy.bytes,old.bytes);assert.equal(copy.sha256,old.sha256);obj[key]={...old,...copy};}
  if(kind==='dependency'){const proof=receipt.runtime.dependencyProof,doc=JSON.parse(fs.readFileSync(proof.path,'utf8'));assert(Array.isArray(doc.files)&&doc.files.length>0);doc.files.splice(1,0,{...doc.files[0]});const b=Buffer.from(JSON.stringify(doc)+'\n');fs.writeFileSync(proof.path,b);proof.bytes=b.length;proof.sha256=sha(b);receipt.actualDependencyProofSha256=proof.sha256;}
  if(kind==='deployment'){const doc=JSON.parse(fs.readFileSync(deployment.path,'utf8'));assert(Array.isArray(doc.files)&&doc.files.length>0);doc.files.pop();const b=Buffer.from(JSON.stringify(doc)+'\n');fs.writeFileSync(deployment.path,b);receipt.actualDeploymentSourceManifestSha256=sha(b);}
  const manifest=JSON.parse(fs.readFileSync(assembled.path,'utf8')),target=manifest.files.find(x=>x.mode==='100644'&&x.bytes>0&&x.path!=='scripts/fixtures/sync-normal-613-20261112.json');assert(target,'Owned source target required');const targetPath=path.resolve(target.path),fixturePath=path.resolve('scripts/fixtures/sync-normal-613-20261112.json');
  const q=fs.readFileSync(qualifier,'utf8');assert(q.includes('function admitNormal613()')&&q.includes('const inputRow=sourceLeaves.get(fullAdmission'),'Known pre-matrix latch anchors');
  const preload=path.join(root,'synthetic-read-preload.cjs'),preloadSource=`const fs=require('node:fs'),open=fs.openSync,read=fs.readFileSync,close=fs.closeSync,fdPaths=new Map();fs.openSync=function(f,...a){const fd=open.call(this,f,...a);if(typeof f==='string')fdPaths.set(fd,f);return fd};fs.closeSync=function(fd,...a){fdPaths.delete(fd);return close.call(this,fd,...a)};fs.readFileSync=function(f,...a){const b=read.call(this,f,...a);if(typeof f!=='number'||!Buffer.isBuffer(b))return b;const p=fdPaths.get(f),stack=new Error().stack||'';if(p===${JSON.stringify(fixturePath)}&&!stack.includes('admitNormal613'))throw Error('TEST_STOP_BEFORE_MATRIX');if(${JSON.stringify(kind)}==='source'&&p===${JSON.stringify(targetPath)}&&stack.includes('admitNormal613')){if(!b.length)throw Error('TEST_EMPTY_TARGET');const x=Buffer.from(b);x[0]^=1;process.stderr.write('TEST_SOURCE_CORRUPTION_APPLIED\\n');return x}return b};`;
  fs.writeFileSync(preload,preloadSource,{mode:0o600,flag:'wx'});const bytes=Buffer.from(JSON.stringify(receipt)+'\n'),file=path.join(admission,'execution-receipt.json');fs.writeFileSync(file,bytes,{mode:0o600,flag:'wx'});
  const run=await runBounded(root,[qualifier,'--normal613-full','--execution-receipt',file,'--execution-receipt-sha256',sha(bytes)],{...process.env,RUNNER_TEMP:root,NODE_OPTIONS:'--require='+preload},end,2*1024*1024);
  assert(mono()<end,'FAIL: traversal window expired');assert.notEqual(run.status,0);assert.match(run.stderr,/"status":"ADMISSION_FAILED"/);assert.match(run.stderr,/"matrixArmsStarted":0/);assert(!/TEST_STOP_BEFORE_MATRIX/.test(run.stderr),'Intended corruption guard not reached');
  if(kind==='source'){assert.match(run.stderr,/TEST_SOURCE_CORRUPTION_APPLIED/);assert.match(run.stderr,/raw identity/);}if(kind==='dependency')assert.match(run.stderr,/dependency path scope\/duplicate/);if(kind==='deployment')assert.match(run.stderr,/complete deployment projection/);
  passed=true;return {name:'actual-r1-'+kind+'-traversal-corruption',status:'PASS_EXPECTED_REJECTION',childExit:run.status,matrixArmsStarted:0,controlledBufferOnly:kind==='source',releaseAcceptance:false};
 }finally{if(passed&&mono()<end){clock.remaining(end);fs.rmSync(root,{recursive:true,force:false});NSB_ACTIVE_END=soft;}else console.error(JSON.stringify({status:'CLEANUP_HOLD',ownedRoot:root,reason:'failed control or qualifier/stdio closure unconfirmed'}));}
}
