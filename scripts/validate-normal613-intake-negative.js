'use strict';
// PRIVATE SOURCE PROPOSAL. Execution is limited to the allocated Linux focused lane.
// Capture real clocks and the admitted context before any synthetic clock/env double.
const NSB_ASSERT=require('node:assert/strict'),NSB_FS=require('node:fs'),NSB_PATH=require('node:path'),NSB_CRYPTO=require('node:crypto');
const NSB_NATIVE_MONO=process.hrtime.bigint.bind(process.hrtime);
const NSB_GET=k=>{const x=process.env[k];NSB_ASSERT(/^[1-9][0-9]*$/.test(x||''),'Canonical focused input '+k);return BigInt(x);};
const NSB_ENTRY=NSB_GET('NS_FOCUSED_ENTRY_MONOTONIC_NS'),NSB_AGG=NSB_GET('NS_FOCUSED_AGGREGATE_DEADLINE_NS'),NSB_SOFT=NSB_GET('NS_FOCUSED_CHILD_SOFT_DEADLINE_NS'),NSB_HARD=NSB_GET('NS_FOCUSED_CHILD_HARD_DEADLINE_NS');
NSB_ASSERT.equal(process.platform,'linux');NSB_ASSERT.equal(process.arch,'x64');NSB_ASSERT.equal(process.version,'v24.21.0');NSB_ASSERT.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');
NSB_ASSERT.equal(process.env.NS_FOCUSED_CHILD_SOFT_MS,'4000');NSB_ASSERT.equal(process.env.NS_FOCUSED_CLOSURE_RESERVE_MS,'3000');
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
const NSB_GUARD_BYTES=NSB_BOOT_READ(NSB_GUARD_PATH,193605);NSB_ASSERT.equal(NSB_GUARD_BYTES.length,193605);NSB_ASSERT.equal(NSB_CRYPTO.createHash('sha256').update(NSB_GUARD_BYTES).digest('hex'),'a78201621fc5bb972bc130e93f1e4730c3f543859dffb5770a945ac2763ea164');
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

// PRIVATE SOURCE PROPOSAL — UNPARSED AND UNRUN. Synthetic negatives only; no provider call.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const expectedGuard='a78201621fc5bb972bc130e93f1e4730c3f543859dffb5770a945ac2763ea164';
assert.equal(sha(fs.readFileSync(path.join(__dirname,'validate-forward-onboarding-ci.js'))),expectedGuard,'Reviewed R3 plus proposed export seam');
const {normal613Intake,normal613Main,normal613FocusedControls}=require('./validate-forward-onboarding-ci');
const expectedReservation='daa00a480a28b0cca1d2f9922c82fc9394a5460b0d45f87c3566e42b58a473d7';
const qualifier={path:'scripts/validate-sync-current-forward.js',bytes:101617,sha256:'a54983351de787e957658f92efedf1e10b470cbb06af252070eb1661228a970f',gitBlob:'dece0f0ecffeb0435f7970bab922a0a37b2f10b9',mode:'100644'};
const fixture={path:'scripts/fixtures/sync-normal-613-20261112.json',bytes:53227,sha256:'744ddb4c83e97810bdd9f6778de0f50a5033695f24739d642c9179822c58a5d2',gitBlob:'4901efd92c8b1d8ef255a06629b8c8bcc5038780',mode:'100644'};
const H='a'.repeat(40),T='b'.repeat(40),TREE='c'.repeat(40),BASE='9f20813c9855e30d4ca32e721862f739b6d696ba';
const envKeys=['RUNNER_TEMP','GITHUB_EVENT_PATH','GITHUB_ACTIONS','GITHUB_EVENT_NAME','GITHUB_REPOSITORY','GITHUB_JOB','GITHUB_RUN_ATTEMPT','GITHUB_WORKFLOW_REF','GITHUB_REF','GITHUB_RUN_ID','GITHUB_SHA'];
function syntheticEvent(reservation,now,allowance,expiry){
 const binding={schemaVersion:'normal-ready-613-binding.v1',phase:'qualification',repository:'hartican/sportscal',preparedForBaseSha:BASE,productSourceSha:'491d0ebcb2210b29a1ae6164c0c4deef1b04f2ec',productSourceTree:'b69736ee739e7b31eebe58108c14889a333a756c',publisherHeadSha:H,expectedPublisherTreeSha:TREE,reviewedFinalMapSha256:'d'.repeat(64),expectedAssembledManifestSha256:'e'.repeat(64),expectedSourceEntryCount:1,expectedBaseRelativePathCount:1,qualifier,fixture,reservation:{schemaVersion:'ns-app-version-reservation.v1',reservationId:'ns-app-version-613-sportsyurt-20261112',version:'613',rawBytes:1362,rawSha256:expectedReservation,queue:'https://github.com/hartican/sportscal/issues/28',commentId:6813306721},actionIntent:{allocationId:'SYNTHETIC_TEST_ONLY',laneId:'SYNTHETIC_TEST_ONLY',ownedOperationId:'SYNTHETIC_TEST_ONLY',purpose:'normal613-qualification',intentSha256:'f'.repeat(64),sourceReviewId:'SYNTHETIC_TEST_ONLY',sourceReviewSha256:'1'.repeat(64),priorOwnedClosureReference:'SYNTHETIC_TEST_ONLY',validUntil:new Date(expiry).toISOString(),maxWallMs:allowance,resultContentDispositionSha256:'2'.repeat(64)},reservationReceiptBase64:reservation.toString('base64')};
 const body=JSON.stringify({schemaVersion:'ns-release-handover.normal613.v1',scope:'synthetic only',commit:H,testsAndResults:'synthetic only',dependencies:'synthetic only',databaseAndConfigChanges:'synthetic only',knownRisks:'synthetic only',rollback:'synthetic only',sourceQualificationBinding:binding});
 return {action:'ready_for_review',number:1,repository:{full_name:'hartican/sportscal',private:false},pull_request:{number:1,draft:false,updated_at:new Date(now-1000).toISOString(),head:{sha:H,repo:{full_name:'hartican/sportscal',private:false}},base:{sha:BASE,repo:{full_name:'hartican/sportscal',private:false}},body}};
}
async function one(name,kind,reservation,parent){NSB_CHECK();
 const root=fs.mkdtempSync(path.join(parent,'ns613-intake-negative-'));fs.chmodSync(root,0o700);const oldEnv=Object.fromEntries(envKeys.map(k=>[k,process.env[k]])),oldExec=cp.execFileSync,oldFetch=global.fetch,oldRead=fs.readFileSync,oldNow=Date.now,oldMono=process.hrtime.bigint;let gitCalls=0,fetchCalls=0,fetchAborted=false,virtual=0,started=Date.now(),mono=process.hrtime.bigint();
 const now=Date.now(),expiry=kind==='already-expired'?now-1:now+60000,allowance=kind==='hanging-request'?200:5000,event=path.join(root,'event.json'),eventValue=syntheticEvent(reservation,now,allowance,expiry);fs.writeFileSync(event,JSON.stringify(eventValue),{mode:0o600});
 if(kind==='revalidation-expired'){const prior=path.join(root,'ns-normal-613-admission');fs.mkdirSync(prior,{mode:0o700});const startedAt=new Date(now-6000).toISOString();const context={bodySha256:sha(Buffer.from(eventValue.pull_request.body)),headSha:H,validUntil:new Date(expiry).toISOString(),maxWallMs:allowance,startedAt,clockObservedAt:startedAt,startMonotonicNs:String(mono-6000000000n),actionDeadlineAt:new Date(now-1000).toISOString()};fs.writeFileSync(path.join(prior,'normal613-context.json'),JSON.stringify(context),{mode:0o600});}
 Object.assign(process.env,{RUNNER_TEMP:root,GITHUB_EVENT_PATH:event,GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_JOB:'fixture-activation',GITHUB_RUN_ATTEMPT:'1',GITHUB_WORKFLOW_REF:'hartican/sportscal/.github/workflows/installed-upgrade-tests.yml@refs/pull/1/merge',GITHUB_REF:'refs/pull/1/merge',GITHUB_RUN_ID:'1',GITHUB_SHA:T});
 try{
  if(kind!=='hanging-request'){Date.now=()=>started+virtual;process.hrtime.bigint=()=>mono+BigInt(virtual)*1000000n;}
  fs.readFileSync=(file,...args)=>{const value=oldRead(file,...args);if(kind==='exhausted-before-git'&&String(file)===event)virtual=5001;return value;};
  const observedTimeouts=[];cp.execFileSync=(file,args,opts)=>{assert.equal(file,'git');assert(opts.timeout>0&&opts.timeout<=5000);observedTimeouts.push(opts.timeout);gitCalls++;if(kind==='sequential-slow-git')virtual+=2000;return [T,BASE+' '+H,TREE,TREE][gitCalls-1]+'\n';};
  global.fetch=(_u,options)=>{fetchCalls++;assert.equal(kind,'hanging-request','Unexpected fetch in negative test');return new Promise((_,reject)=>{options.signal.addEventListener('abort',()=>{fetchAborted=true;reject(Object.assign(Error('synthetic abort'),{name:'AbortError'}));},{once:true});});};
  await assert.rejects(normal613Intake(kind==='revalidation-expired'?'qualification':null),kind==='hanging-request'?/synthetic abort/:/Expired allocated action|Intake deadline/);
  if(['already-expired','exhausted-before-git','revalidation-expired'].includes(kind)){assert.equal(gitCalls,0);assert.equal(fetchCalls,0);}
  if(kind==='sequential-slow-git'){assert.equal(gitCalls,3);assert.equal(fetchCalls,0);assert(observedTimeouts[1]<observedTimeouts[0]&&observedTimeouts[2]<observedTimeouts[1]);}
  if(kind==='hanging-request'){assert.equal(gitCalls,4);assert.equal(fetchCalls,1);assert(fetchAborted);}
  if(kind==='revalidation-expired')assert.equal(fs.existsSync(path.join(root,'ns-normal-613-admission','normal613-readback-before-qualification.json')),false,'No revalidation proof');else assert.equal(fs.existsSync(path.join(root,'ns-normal-613-admission')),false,'Failure must precede proof directory');
  return {name,status:'PASS',gitCalls,fetchCalls,fetchAborted,observedTimeouts};
 }finally{cp.execFileSync=oldExec;global.fetch=oldFetch;fs.readFileSync=oldRead;Date.now=oldNow;process.hrtime.bigint=oldMono;for(const k of envKeys){if(oldEnv[k]===undefined)delete process.env[k];else process.env[k]=oldEnv[k];}fs.rmSync(root,{recursive:true,force:false});assert(!fs.existsSync(root),'Owned fixture root removed');}
}
async function engineExpired(engine,parent){NSB_CHECK();
 const root=fs.mkdtempSync(path.join(parent,'ns613-engine-negative-'));fs.chmodSync(root,0o700);const keys=['RUNNER_TEMP','GITHUB_JOB','NS_OBSERVED_ENGINE','NS_NORMAL613_ENGINE_CONTEXT','NS_NORMAL613_ENGINE_CONTEXT_SHA256','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SHA'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const oldExec=cp.execFileSync;let gitCalls=0;
 const now=Date.now(),start=now-6000,until=now+60000;const v={schemaVersion:'normal613-admitted-engine-context.v1',repository:'hartican/sportscal',pullRequest:1,headSha:H,baseSha:BASE,testedMergeSha:T,tree:TREE,bodySha256:'1'.repeat(64),intentSha256:'2'.repeat(64),ackSha256:'3'.repeat(64),policySha256:sha(Buffer.from(JSON.stringify(normal613FocusedControls.NORMAL613_CALLER_POLICY))),sourceManifestSha256:'4'.repeat(64),executionReceiptSha256:'5'.repeat(64),allocationId:'SYNTHETIC_TEST_ONLY',laneId:'SYNTHETIC_TEST_ONLY',ownedOperationId:'SYNTHETIC_TEST_ONLY',validUntil:new Date(until).toISOString(),actionStartedAt:new Date(start).toISOString(),actionDeadlineAt:new Date(start+5000).toISOString(),maxWallMs:5000,allocatedAt:new Date(start-1000).toISOString(),runId:'1',runAttempt:1,engines:['chromium','webkit']};const bytes=Buffer.from(JSON.stringify(v)+'\n');
 Object.assign(process.env,{RUNNER_TEMP:root,GITHUB_JOB:'installed-upgrade',NS_OBSERVED_ENGINE:engine,NS_NORMAL613_ENGINE_CONTEXT:bytes.toString('base64'),NS_NORMAL613_ENGINE_CONTEXT_SHA256:sha(bytes),GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:T});
 try{cp.execFileSync=()=>{gitCalls++;throw Error('unexpected Git')};await assert.rejects(normal613Main(['--normal613-engine-context']),/Expired allocated action/);assert.equal(gitCalls,0);assert(!fs.existsSync(path.join(root,'ns-normal-613-engine')));assert(!fs.existsSync(path.join(root,'ns-upgrade-proof')));return {name:'engine-'+engine+'-expired-before-git-mkdir',status:'PASS',gitCalls};}
 finally{cp.execFileSync=oldExec;for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}fs.rmSync(root,{recursive:true,force:false});assert(!fs.existsSync(root));}
}
async function main(){NSB_CHECK();NSB_CHECK();
 assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');assert(process.env.RUNNER_TEMP&&process.env.NS_TEST_RESERVATION_PATH,'Owned cloud temp and retained exact reservation path required');
 const reservation=fs.readFileSync(process.env.NS_TEST_RESERVATION_PATH);assert.equal(reservation.length,1362);assert.equal(sha(reservation),expectedReservation,'Retained reservation bytes');const parent=fs.realpathSync(process.env.RUNNER_TEMP),rows=[];
 for(const [n,k]of [['expired-first-allowance','already-expired'],['exhausted-before-first-git','exhausted-before-git'],['sequential-slow-git','sequential-slow-git'],['revalidation-original-expired','revalidation-expired'],['hanging-request-clamped','hanging-request']])rows.push(await one(n,k,reservation,parent));
 for(const engine of ['chromium','webkit'])rows.push(await engineExpired(engine,parent));
 console.log(JSON.stringify({schemaVersion:'normal613-intake-negative-controls.v1',status:'PASS_SYNTHETIC_NEGATIVES_ONLY',rows,providerRequests:0,realAuthority:false,releaseAcceptance:false,notCovered:['engine positive and cross-job joins','revalidation positive and authority joins','full cleanup','51-arm','paired','browser']}));
}
NSB_RUN(main,e=>{console.error(JSON.stringify({status:'FAIL_OR_UNKNOWN',error:String(e.stack||e).slice(0,4096),releaseAcceptance:false}));process.exitCode=1;});
