'use strict';
// PRIVATE SOURCE PROPOSAL. Execution is limited to the allocated Linux focused lane.
// Capture real clocks and the admitted context before any synthetic clock/env double.
const NSB_ASSERT=require('node:assert/strict'),NSB_FS=require('node:fs'),NSB_PATH=require('node:path'),NSB_CRYPTO=require('node:crypto');
const NSB_NATIVE_MONO=process.hrtime.bigint.bind(process.hrtime);
const NSB_GET=k=>{const x=process.env[k];NSB_ASSERT(/^[1-9][0-9]*$/.test(x||''),'Canonical focused input '+k);return BigInt(x);};
const NSB_ENTRY=NSB_GET('NS_FOCUSED_ENTRY_MONOTONIC_NS'),NSB_AGG=NSB_GET('NS_FOCUSED_AGGREGATE_DEADLINE_NS'),NSB_SOFT=NSB_GET('NS_FOCUSED_CHILD_SOFT_DEADLINE_NS'),NSB_HARD=NSB_GET('NS_FOCUSED_CHILD_HARD_DEADLINE_NS');
NSB_ASSERT.equal(process.platform,'linux');NSB_ASSERT.equal(process.arch,'x64');NSB_ASSERT.equal(process.version,'v24.21.0');NSB_ASSERT.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');
NSB_ASSERT.equal(process.env.NS_FOCUSED_CHILD_SOFT_MS,'32000');NSB_ASSERT.equal(process.env.NS_FOCUSED_CLOSURE_RESERVE_MS,'3000');
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
const NSB_GUARD_BYTES=NSB_BOOT_READ(NSB_GUARD_PATH,211953);NSB_ASSERT.equal(NSB_GUARD_BYTES.length,211953);NSB_ASSERT.equal(NSB_CRYPTO.createHash('sha256').update(NSB_GUARD_BYTES).digest('hex'),'ed164e005853c40080dc608937ceaaf2ce2da2c2cba54167db531a2448bdc573');
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
const pause=n=>new Promise(r=>setTimeout(r,n));
let interrupted=false;for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{interrupted=true});
let currentCase=-1;const results=[],caseNames=['success','nonzero','overflow','timeout','synthetic-unresolved','chromium','webkit'];
function durable(file,value,end){clock.remaining(end);fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
// Projection only: no commands, environment bytes, tokens or post-deadline kernel reads.
function captureCaseMetadata(tracker,child,phase,end,state){
 clock.remaining(end);
 const scope=tracker?tracker.scope():null,identities=tracker?tracker.records():[];
 const project=p=>Object.fromEntries(['pid','uid','startTicks','parentPid','pgid','sessionId','state'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]));
 const all=identities.map(project),record={
  phase,capturedAtNs:String(clock.nowNs()),caseDeadlineNs:String(end),childPid:child?.pid||null,
  wrapperClosed:state.closed,wrapperExitObserved:state.exitObserved,wrapperExit:state.exit,
  trackerRootObserved:tracker?.rootObserved||false,ownedClosureObserved:state.observed,
  trackedIdentityCount:all.length,trackedIdentities:all.slice(0,64),trackedIdentityListSha256:sha(Buffer.from(JSON.stringify(all))),
  omittedIdentityCount:Math.max(0,all.length-64),ownershipHolds:tracker?[...tracker.holds]:[],
  scope:scope?{callerPid:scope.callerPid,callerUid:scope.callerUid,snapshotStartedNs:scope.snapshotStartedNs,snapshotCompletedNs:scope.snapshotCompletedNs,
   preSpawnIdentityCount:scope.preSpawnIdentityCount,preSpawnMetadataSha256:scope.preSpawnMetadataSha256,rootIdentity:scope.rootIdentity,rootObservedAtNs:scope.rootObservedAtNs,
   actualRootAfterSnapshot:scope.actualRootAfterSnapshot,stableClosureInventory:scope.stableClosureInventory,lastMetadataSha256:scope.lastMetadataSha256,
   excludedPreExistingCount:scope.excludedPreExisting?.length||0,unknownOrOwnershipHolds:scope.unknownOrOwnershipHolds,permanentOwnershipHolds:scope.permanentOwnershipHolds,
   childHandleBoundAtNs:scope.childHandleBoundAtNs,boundChildPid:scope.boundChildPid,rootEventJoinSha256:scope.rootEventJoinSha256,
   rootVisibility:scope.rootVisibility,knownVisibility:scope.knownVisibility,rootEventProof:scope.rootEventProof}:null,
  metadataOnly:true,notIndependentOsClosureProof:true
 };
 assert(Buffer.byteLength(JSON.stringify(record))<=65536,'Bounded per-case kernel diagnostics');return record;
}
async function one(parent,name,script,kind,engine,index){
 // The unresolved synthetic guard needs its own closure window; the seven
 // case maxima total 28 seconds and leave up to four seconds for setup/report.
 const windows=[3000,3000,3000,4000,9000,3000,3000];
 const future=windows.slice(index).reduce((n,v)=>n+v,0);clock.remaining(soft,future+100);const end=clock.nowNs()+ms(windows[index]);NSB_ACTIVE_END=end;
 let root=null,tracker=null,child=null,closed=false,exitObserved=false,exit=null,reason=null,receipt=null,observed=false,passed=false,done=Promise.resolve(),outputBytes=0,metadata=null,lastHoldKey=null;const logs=[];
 const fail=e=>{if(!reason)reason=String(e)};
 const capture=phase=>{try{metadata=captureCaseMetadata(tracker,child,phase,end,{closed,exitObserved,exit,observed});}catch(e){metadata={...(metadata||{}),lastRequestedPhase:phase,metadataNotRefreshed:true,captureFailure:String(e)};fail('Case metadata capture failed: '+String(e));}};
 try{
  clock.remaining(end,300);root=fs.mkdtempSync(path.join(parent,'ns613-owned-negative-'));fs.chmodSync(root,0o700);
  const admission=path.join(root,engine?'ns-normal-613-engine':'ns-normal-613-admission');fs.mkdirSync(admission,{mode:0o700});const pidFile=path.join(root,'inner.pid');
  const now=clock.nowMs(),budget=(kind==='timeout'||kind==='unresolved')?6800:8000,deadline=now+budget;
  const context={repository:'hartican/sportscal',headSha:'a'.repeat(40),baseSha:'b'.repeat(40),testedMergeSha:'c'.repeat(40),bodySha256:'d'.repeat(64),intentSha256:'e'.repeat(64),allocationId:'SYNTHETIC_TEST_ONLY',laneId:'SYNTHETIC_TEST_ONLY',ownedOperationId:'SYNTHETIC_TEST_ONLY',startedAt:iso(now),clockObservedAt:iso(now),startMonotonicNs:String(clock.nowNs()),validUntil:iso(deadline+1000),actionDeadlineAt:iso(deadline),maxWallMs:budget,...(engine?{engine}:{})};durable(path.join(admission,'normal613-context.json'),context,end);
  let preload=null;if(kind==='unresolved'){preload=path.join(root,'synthetic-preload.cjs');clock.remaining(end);fs.writeFileSync(preload,`const cp=require('node:child_process'),{EventEmitter}=require('node:events'),{PassThrough,Writable}=require('node:stream');cp.spawn=()=>{const c=new EventEmitter();c.pid=987654321;c.stdin=new Writable({write(_b,_e,cb){cb()}});c.stdout=new PassThrough();c.stderr=new PassThrough();c.unref=()=>{};return c};process.kill=(id)=>{if(id!==-987654321)throw Error('refuse non-synthetic pid');return true};`,{flag:'wx',mode:0o600});}
  tracker=NS.normal613FocusedOwnedProcesses(token,clock,end);assert(tracker.holds.length===0,'Complete pre-spawn ownership snapshot required');
  clock.remaining(end,300);logs.push(fs.openSync(path.join(root,'wrapper.stdout.log'),'wx',0o600));logs.push(fs.openSync(path.join(root,'wrapper.stderr.log'),'wx',0o600));
  const id=engine?'pwa':'journey';clock.remaining(end,300);child=cp.spawn(process.execPath,[guard,'--normal613-run',id,'--','bash','-Eeuo','pipefail'],{env:{...process.env,NS_FOCUSED_OWNER_TOKEN:token,RUNNER_TEMP:root,GITHUB_JOB:engine?'installed-upgrade':'fixture-activation',GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',...(preload?{NODE_OPTIONS:'--require='+preload}:{})},detached:true,stdio:['pipe','pipe','pipe']});
  done=new Promise(resolve=>{child.once('error',e=>{fail(e);resolve()});child.once('exit',(code,signal)=>{exitObserved=true;try{tracker.recordRootExit(child,code,signal)}catch(e){fail('Root exit join: '+String(e))}});child.once('close',(code,signal)=>{closed=true;exit={code,signal};try{tracker.recordRootClose(child,code,signal)}catch(e){fail('Root close join: '+String(e))}resolve()})});
  tracker.bindChild(child);
  for(const [i,stream] of [child.stdout,child.stderr].entries())stream.on('error',fail).on('data',b=>{try{clock.remaining(end);outputBytes+=b.length;if(outputBytes>6*1024*1024)throw Error('test wrapper output limit');fs.writeSync(logs[i],b)}catch(e){fail(e)}});
  child.stdin.on('error',fail);tracker.setRoot(child.pid);capture('ROOT_OBSERVED_BEFORE_STDIN');if(tracker.holds.length&&!tracker.waitingForRootExit)fail('Owned tracker hold: '+JSON.stringify(tracker.holds));if(reason)throw Error(reason);durable(path.join(root,'wrapper-start.json'),{pid:child.pid,case:name,synthetic:!!preload},end);
  const quoted="'"+pidFile.replace(/'/g,"'\\''")+"'";child.stdin.end('printf "%s\\n" "$$" > '+quoted+'\n'+script);
  while(!closed&&!reason&&!interrupted){clock.remaining(end,300);tracker.observe();const holdKey=JSON.stringify(tracker.holds);if(tracker.holds.length&&holdKey!==lastHoldKey){capture('ACTIVE_TRACKER_HOLD');lastHoldKey=holdKey;}if(tracker.holds.length&&!tracker.waitingForRootExit)fail('Owned tracker hold: '+holdKey);if(!reason)await Promise.race([done,pause(Math.min(10,clock.remaining(end)))])}if(interrupted)fail('interrupted');
 }catch(e){fail(e)}finally{
  NSB_CLEANUP=true;
  if(child&&tracker){try{const termUntil=clock.nowNs()+ms(100);for(;;){clock.remaining(end);const snap=tracker.observe();if(closed&&exitObserved&&snap.closed){observed=true;capture('ACTUAL_TRACKER_CLOSURE_OBSERVED');break}if(tracker.holds.length&&JSON.stringify(tracker.holds)!==lastHoldKey){capture('CLEANUP_TRACKER_HOLD');lastHoldKey=JSON.stringify(tracker.holds)}tracker.signalOwned(clock.nowNs()<termUntil?'SIGTERM':'SIGKILL');await pause(Math.min(10,clock.remaining(end)))}}catch(e){fail('CLEANUP_HOLD '+String(e))}}
  if(child&&!observed)fail('CLEANUP_HOLD owned closure unobserved');
  for(const stream of [child?.stdin,child?.stdout,child?.stderr])try{stream?.destroy()}catch(e){fail('descriptor close '+String(e))}
  for(const fd of logs)try{fs.closeSync(fd)}catch(e){fail('log close '+String(e))}
  NSB_CLEANUP=false;
 }
 try{
  assert(!reason&&closed&&exitObserved&&observed&&!interrupted,'Owned wrapper/group or descriptors unresolved');clock.remaining(end);
  const id=engine?'pwa':'journey',admission=path.join(root,engine?'ns-normal-613-engine':'ns-normal-613-admission'),receiptFile=path.join(admission,'command-'+id+'.json');receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  let materializerReadReuse=null;
  if(name==='success'){
   const lines=fs.readFileSync(path.join(root,'wrapper.stdout.log'),'utf8').split('\n').filter(line=>line.startsWith('NS_MATERIALIZER_REUSE '));
   assert.equal(lines.length,1,'Actual CLI/IO controls must complete exactly once within the existing owned case');
   materializerReadReuse=JSON.parse(lines[0].slice('NS_MATERIALIZER_REUSE '.length));
   assert.equal(materializerReadReuse.schemaVersion,'normal613-materializer-read-reuse-controls.v1');
   assert.equal(materializerReadReuse.sourceSha256,'0757edcce5a3d1d54f0a56f457884a6565629a5741c592f80012683d7498f7f0');
   assert.equal(materializerReadReuse.runs,7);assert.equal(materializerReadReuse.outcomes.length,7);
   assert.equal(materializerReadReuse.observedActualCli,true);assert.equal(materializerReadReuse.syntheticFixtureOnly,true);
  }
  const fakeOnly=kind==='unresolved',proved=receipt.childClosed===true&&receipt.ownedGroupClosed===true,fakeOnlyProved=fakeOnly&&receipt.childPid===987654321&&receipt.childClosed===false&&receipt.ownedGroupClosed===false;
  if(kind==='success'){assert.equal(exit.code,0);assert.equal(receipt.status,0);assert(proved)}else{assert.notEqual(exit.code,0);assert(receipt.failure||receipt.status!==0||receipt.cleanupStatus==='FAILED_OR_UNKNOWN');if(kind==='overflow')assert(receipt.outputOverflow);if(kind==='timeout')assert(receipt.failure&&/deadline|closure|descendant/i.test(receipt.failure));if(fakeOnly){assert(fakeOnlyProved);assert.equal(receipt.cleanupStatus,'FAILED_OR_UNKNOWN')}}
  assert(proved||fakeOnlyProved);const disposition={name,wrapperClosed:closed,actualOwnedClosure:observed,syntheticOnly:fakeOnly,materializerReadReuse,exit,status:'PASS_SYNTHETIC_ONLY',scopeDiagnostics:metadata};durable(path.join(root,'test-disposition.json'),disposition,end);clock.remaining(end);fs.rmSync(root,{recursive:true,force:false});results.push(disposition);passed=true;
 }catch(e){fail(e)}finally{if(!passed&&root)console.error(JSON.stringify({status:'CLEANUP_HOLD',ownedRoot:root,name,reason,wrapperClosed:closed,wrapperExitObserved:exitObserved,actualOwnedClosure:observed,scopeDiagnostics:metadata,diagnosticsAreCached:true}));}
 if(reason||!passed)throw Error(reason||'FAIL_OR_UNKNOWN');
 NSB_ACTIVE_END=soft;
}
// Runs inside the existing success wrapper, process group, 3-second case window and cleanup.
const MATERIALIZER_READ_REUSE_PROBE="'use strict';\nconst assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');\nconst sha=b=>crypto.createHash('sha256').update(b).digest('hex'),source=fs.readFileSync(process.argv[2]);\nassert.equal(sha(source),process.argv[3],'Exact admitted materializer under actual CLI observation');\nconst end=process.hrtime.bigint()+2200000000n;\nfunction remaining(){const n=Number((end-process.hrtime.bigint())/1000000n)-30;assert(n>0,'Existing success-case subordinate read-reuse deadline');return Math.max(1,n);}\nconst root=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'materializer-read-reuse-'));fs.chmodSync(root,0o700);\nconst outcomes=[];let runs=0;\ntry{\n const tool=path.join(root,'tool'),repo=path.join(root,'repo');fs.mkdirSync(path.join(tool,'scripts'),{recursive:true});fs.mkdirSync(path.join(tool,'config'));fs.mkdirSync(repo);\n const script=path.join(tool,'scripts/materialize-git-tree.js');fs.writeFileSync(script,source,{flag:'wx',mode:0o600});\n const policy={includeDirectories:['api/','data/'],includeFiles:[],excludeDirectories:[],excludeFiles:[],rootExtensions:[],compactJson:true,preserveBytes:[]};\n fs.writeFileSync(path.join(tool,'config/deployment-manifest.json'),JSON.stringify(policy),{flag:'wx',mode:0o600});\n const preload=path.join(root,'observe.cjs');fs.writeFileSync(preload,\"'use strict';\\nconst fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');\\nconst root=process.env.NS_REUSE_TEST_ROOT,trace=process.env.NS_REUSE_TEST_TRACE,output=process.env.NS_REUSE_TEST_OUTPUT;\\nconst reads={},gitReads={},read=fs.readFileSync.bind(fs),write=fs.writeFileSync.bind(fs),exec=cp.execFileSync.bind(cp);\\nfs.readFileSync=function(file,...args){if(typeof file==='string'){const p=path.resolve(file);if(p.startsWith(root+path.sep)&&!p.startsWith(path.join(root,'.git')+path.sep)){const key=path.relative(root,p).split(path.sep).join('/');reads[key]=(reads[key]||0)+1;}}return read(file,...args);};\\ncp.execFileSync=function(command,args,...rest){if(command==='git'&&args[0]==='cat-file'&&args[1]==='blob'){gitReads[args[2]]=(gitReads[args[2]]||0)+1;const value=exec(command,args,...rest);return process.env.NS_REUSE_TEST_BAD_OID===args[2]?Buffer.from('not the admitted blob\\\\n'):value;}return exec(command,args,...rest);};\\nfs.writeFileSync=function(file,...args){if(process.env.NS_REUSE_TEST_WRITE_FAIL==='1'&&typeof file==='string'&&path.resolve(file)===path.join(output,'api/entry.js'))throw Error('SYNTHETIC_REUSE_WRITE_FAILURE');return write(file,...args);};\\nprocess.once('exit',()=>{const value=JSON.stringify({reads,gitReads});if(Buffer.byteLength(value)>65536)throw Error('Trace bound');write(trace,value,{flag:'wx',mode:0o600});});\\n\",{flag:'wx',mode:0o600});\n const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};\n for(const name of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_CONFIG_COUNT','GIT_CONFIG_PARAMETERS','NODE_OPTIONS'])delete env[name];\n const git=(...args)=>cp.execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-c','user.name=Controlled fixture','-c','user.email=fixture@example.invalid','-C',repo,...args],{env,timeout:remaining(),maxBuffer:65536,stdio:['ignore','pipe','pipe']}).toString().trim();\n const put=(name,value,mode=0o644)=>{const file=path.join(repo,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,{mode});fs.chmodSync(file,mode);};\n git('init','-q');\n const originals={\n  'api/entry.js':Buffer.from('module.exports=require(\"../scripts/parser\");\\n'),\n  'api/shared.js':Buffer.from('module.exports=7;\\n'),\n  'api/shared-again.js':Buffer.from('module.exports=7;\\n'),\n  'api/executable.js':Buffer.from('module.exports=8;\\n'),\n  'api/empty.js':Buffer.alloc(0),\n  'scripts/parser.js':Buffer.from('module.exports=2;\\n'),\n  'data/context.json':Buffer.from('{ \"answer\" : 42 }\\n'),\n  'notes.txt':Buffer.from('default materialization retains non-policy paths\\n')\n };\n for(const [name,value]of Object.entries(originals))put(name,value,name==='api/executable.js'?0o755:0o644);\n fs.symlinkSync('shared.js',path.join(repo,'api/link.js'));put('.env.synthetic','synthetic, not a credential\\n');put('supabase_keys.txt','synthetic, not a key\\n');\n git('add','-f','.');git('commit','-qm','Synthetic immutable materializer fixture');const revision=git('rev-parse','HEAD'),entryOid=git('rev-parse',revision+':api/entry.js');\n const js=Object.keys(originals).filter(name=>name.endsWith('.js'));\n function run(name,{deployment=true,badOid='',writeFail=false,expectError=null}={}){\n  remaining();const output=path.join(root,'output-'+runs),trace=path.join(root,'trace-'+runs+'.json');runs++;\n  let failure=null;\n  try{cp.execFileSync(process.execPath,[script,revision,output,...(deployment?['--deployment']:[])],{cwd:repo,env:{...env,NODE_OPTIONS:'--require='+preload,NS_REUSE_TEST_ROOT:repo,NS_REUSE_TEST_TRACE:trace,NS_REUSE_TEST_OUTPUT:output,NS_REUSE_TEST_BAD_OID:badOid,NS_REUSE_TEST_WRITE_FAIL:writeFail?'1':'0'},timeout:remaining(),maxBuffer:65536,stdio:['ignore','pipe','pipe']});}catch(e){failure=e;}\n  if(expectError){assert(failure&&Number.isInteger(failure.status)&&failure.status!==0,'Actual child must fail and close, not time out');assert(expectError.test(String(failure.stderr)),name+' exact negative');}\n  else assert.equal(failure,null,name+' actual CLI success');\n  const stat=fs.lstatSync(trace);assert(stat.isFile()&&stat.size<=65536);const observed=JSON.parse(fs.readFileSync(trace,'utf8'));\n  outcomes.push({name,status:failure?'EXPECTED_REJECTION':'PASS',workingReads:observed.reads,gitReads:observed.gitReads});\n  return {output,observed};\n }\n function exactOutput(output,deployment){\n  for(const [name,value]of Object.entries(originals)){if(deployment&&name==='notes.txt')continue;const wanted=deployment&&name.endsWith('.json')?Buffer.from(JSON.stringify(JSON.parse(value))+'\\n'):value;assert(fs.readFileSync(path.join(output,name)).equals(wanted),'Exact raw/compacted output '+name);}\n  assert.equal(fs.readlinkSync(path.join(output,'api/link.js')),'shared.js');assert(fs.statSync(path.join(output,'api/executable.js')).mode&0o111);\n  assert(!fs.existsSync(path.join(output,'.env.synthetic'))&&!fs.existsSync(path.join(output,'supabase_keys.txt')));\n  if(deployment){const inventory=JSON.parse(fs.readFileSync(path.join(output,'deployment-files.json'),'utf8'));assert.equal(inventory.revision,revision);for(const row of inventory.files){const expected=row.path==='api/link.js'?Buffer.from('shared.js'):originals[row.path];assert(expected);assert.equal(row.sourceBytes,expected.length);assert.equal(row.gitBlob,crypto.createHash('sha1').update('blob '+expected.length+'\\0').update(expected).digest('hex'));const actual=row.path==='api/link.js'?Buffer.from(fs.readlinkSync(path.join(output,row.path))):fs.readFileSync(path.join(output,row.path));assert.equal(row.bytes,actual.length);assert.equal(row.sha256,sha(actual));}}\n }\n const first=run('working-once');exactOutput(first.output,true);for(const name of js)assert.equal(first.observed.reads[name],1,'One real working JS read '+name);assert.deepEqual(first.observed.gitReads,{});\n put('api/entry.js','mismatched working bytes\\n');\n const fallback=run('fallback-once');exactOutput(fallback.output,true);for(const name of js)assert.equal(fallback.observed.reads[name],1,'No closure-to-emission JS reread '+name);assert.deepEqual(fallback.observed.gitReads,{[entryOid]:1});\n run('wrong-raw-oid',{badOid:entryOid,expectError:/Raw JavaScript blob verification failed/});\n put('api/entry.js',originals['api/entry.js']);\n run('write-error-cleanup',{writeFail:true,expectError:/SYNTHETIC_REUSE_WRITE_FAILURE/});\n const fresh=run('fresh-invocation');exactOutput(fresh.output,true);for(const name of js)assert.equal(fresh.observed.reads[name],1,'No cross-invocation cache reuse '+name);\n const normal=run('nondeployment-unchanged',{deployment:false});exactOutput(normal.output,false);for(const name of js)assert.equal(normal.observed.reads[name],1,'Default mode remains one source pass');\n const large=Buffer.alloc(16*1024*1024+1,32);large[0]=47;large[1]=47;put('api/a-large.js',large);put('api/b-large.js',large);\n git('add','api/a-large.js','api/b-large.js');git('commit','-qm','Aggregate retained-cache overflow, individually under limit');\n // Revision is intentionally immutable per run; obtain the overflow revision separately.\n const overflowRevision=git('rev-parse','HEAD'),output=path.join(root,'overflow-output'),trace=path.join(root,'overflow-trace.json');let overflow=null;\n try{cp.execFileSync(process.execPath,[script,overflowRevision,output,'--deployment'],{cwd:repo,env:{...env,NODE_OPTIONS:'--require='+preload,NS_REUSE_TEST_ROOT:repo,NS_REUSE_TEST_TRACE:trace,NS_REUSE_TEST_OUTPUT:output},timeout:remaining(),maxBuffer:65536,stdio:['ignore','pipe','pipe']});}catch(e){overflow=e;}\n assert(overflow&&Number.isInteger(overflow.status)&&overflow.status!==0);assert(/Retained raw JavaScript cache byte bound/.test(String(overflow.stderr)));\n const bounded=JSON.parse(fs.readFileSync(trace,'utf8'));assert.equal(bounded.reads['api/a-large.js'],1);assert.equal(bounded.reads['api/b-large.js'],1);assert(!fs.existsSync(path.join(output,'api/a-large.js')),'Aggregate rejection occurs before emission');\n outcomes.push({name:'aggregate-cache-overflow',status:'EXPECTED_REJECTION',individuallyUnderLimit:true,aggregateBytes:large.length*2,limit:32*1024*1024});remaining();\n console.log('NS_MATERIALIZER_REUSE '+JSON.stringify({schemaVersion:'normal613-materializer-read-reuse-controls.v1',sourceSha256:sha(source),runs:runs+1,outcomes,observedActualCli:true,syntheticFixtureOnly:true,providerRequests:0,releaseAcceptance:false}));\n}finally{fs.rmSync(root,{recursive:true,force:false});}\n";
function materializerReadReuseScript(){
 const quote=value=>"'"+value.replace(/'/g,"'\\''")+"'";
 return "printf 'ok\\n'\nnode - "+quote(path.join(__dirname,'materialize-git-tree.js'))+" "+quote('0757edcce5a3d1d54f0a56f457884a6565629a5741c592f80012683d7498f7f0')+" <<'NS_REUSE_CLI'\n"+MATERIALIZER_READ_REUSE_PROBE+"\nNS_REUSE_CLI\n";
}
async function main(){assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');assert(process.env.RUNNER_TEMP);const root=fs.realpathSync(process.env.RUNNER_TEMP),cases=[['success',materializerReadReuseScript(),'success',null],['nonzero','exit 13\n','failure',null],['overflow','head -c 4194305 /dev/zero\n','overflow',null],['timeout','sleep 60\n','timeout',null],['synthetic-unresolved','printf ignored\n','unresolved',null],['chromium','printf ok\n','success','chromium'],['webkit','printf ok\n','success','webkit']];for(let i=0;i<cases.length;i++){currentCase=i;await one(root,...cases[i],i);}clock.remaining(soft);console.log(JSON.stringify({schemaVersion:'normal613-owned-negative-controls.v1',status:'PASS_SYNTHETIC_WRAPPER_SUBSET_ONLY',results,realAuthority:false,providerRequests:0,releaseAcceptance:false}));}
NSB_RUN(main,e=>{console.error(JSON.stringify({status:'FAIL_OR_UNKNOWN',results,failedCase:currentCase<0?null:caseNames[currentCase],unrun:caseNames.slice(currentCase+1),error:String(e.stack||e).slice(0,4096),releaseAcceptance:false}));process.exitCode=1});
