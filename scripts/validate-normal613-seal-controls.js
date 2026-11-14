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
const NSB_GUARD_BYTES=NSB_BOOT_READ(NSB_GUARD_PATH,202059);NSB_ASSERT.equal(NSB_GUARD_BYTES.length,202059);NSB_ASSERT.equal(NSB_CRYPTO.createHash('sha256').update(NSB_GUARD_BYTES).digest('hex'),'d9cf084966bbdffe88d343b96d16fa6ab218a853920c50ad5bf9379bb9f8829e');
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

// SOURCE PROPOSAL ONLY: synthetic proof inventory; no real admission or release authority.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');const guard=path.join(__dirname,'validate-forward-onboarding-ci.js');assert.equal(sha(fs.readFileSync(guard)),'d9cf084966bbdffe88d343b96d16fa6ab218a853920c50ad5bf9379bb9f8829e');
const {normal613Main,normal613FocusedControls:S}=require('./validate-forward-onboarding-ci');const canon=x=>Buffer.from(JSON.stringify(x)+'\n'),results=[];
const names=['assembled-source-manifest.json','dependencies.json','reservation-receipt.json','fresh-main-reservation-binding.json','execution-receipt.json','normal613-intent.json','normal613-ack.json','normal613-context.json','normal613-fresh.json','normal613-reservation.json','normal613-approval-witness.json','normal613-readback-before-admission.json','normal613-readback-before-qualification.json','normal613-admitted-engine-context.json','deployment-source-manifest.json','normal613-receipt-member-map.json'];
function put(dir,name,value){fs.writeFileSync(path.join(dir,name),Buffer.isBuffer(value)?value:canon(value),{mode:0o600,flag:'wx'});}
async function one(parent,role,kind){NSB_CHECK();
 const root=fs.mkdtempSync(path.join(parent,'ns613-seal-'));fs.chmodSync(root,0o700);const isEngine=role!=='fixture',admission=path.join(root,isEngine?'ns-normal-613-engine':'ns-normal-613-admission');fs.mkdirSync(admission,{mode:0o700});const keys=['RUNNER_TEMP','GITHUB_JOB','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_WORKFLOW_REF','NS_NORMAL613_JOB_STATUS'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{RUNNER_TEMP:root,GITHUB_JOB:isEngine?'installed-upgrade':'fixture-activation',GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',GITHUB_WORKFLOW_REF:'SYNTHETIC_TEST_ONLY',NS_NORMAL613_JOB_STATUS:'success'});
 try{
  const context={repository:'hartican/sportscal',headSha:'a'.repeat(40),baseSha:'b'.repeat(40),testedMergeSha:'c'.repeat(40),tree:'d'.repeat(40),bodySha256:'1'.repeat(64),intentSha256:'2'.repeat(64),allocationId:'SYNTHETIC_TEST_ONLY',laneId:'SYNTHETIC_TEST_ONLY',ownedOperationId:'SYNTHETIC_TEST_ONLY',actionDeadlineAt:'2026-11-13T00:01:00.000Z',engine:isEngine?role:null};put(admission,'normal613-context.json',context);
  const ids=isEngine?S.normal613EngineCommandIds(role):S.normal613FixtureCommandIds();
  for(const id of ids){put(admission,'command-'+id+'.json',{id,status:0,failure:null,childClosed:!(kind==='unresolved-child'&&id===ids[0]),ownedGroupClosed:true,outputOverflow:false});put(admission,'command-'+id+'.stdout.log',Buffer.alloc(0));put(admission,'command-'+id+'.stderr.log',Buffer.alloc(0));}
  if(isEngine){const proof=path.join(root,'ns-upgrade-proof');fs.mkdirSync(proof,{mode:0o700});for(const n of ['context.json','baseline-controls.log','installed-baseline.log','installed-tooling.json','install.log','normal613-admission-context.json'])if(!(kind==='missing-proof'&&n==='installed-tooling.json'))put(proof,n,Buffer.from('{}\n'));}
  else{
   for(const n of names)if(!['normal613-context.json','execution-receipt.json','normal613-receipt-member-map.json'].includes(n)&&!(kind==='missing-deployment'&&n==='deployment-source-manifest.json'))put(admission,n,Buffer.from('{}\n'));
   const content=Buffer.from('{}\n'),h=sha(content),receipt={actualAssembledSourceManifestPath:'/synthetic/assembled',actualAssembledSourceManifestSha256:h,actualDeploymentSourceManifestPath:'/synthetic/deployment',actualDeploymentSourceManifestSha256:h,runtime:{dependencyProof:{path:'/synthetic/deps',sha256:h}},reservation:{receipt:{path:'/synthetic/reservation',sha256:h}},freshMainAndReservationBinding:{receipt:{path:'/synthetic/fresh',sha256:h}},normal613Intent:{path:'/synthetic/intent',sha256:h},normal613Ack:{path:'/synthetic/ack',sha256:h}};const receiptBytes=canon(receipt);put(admission,'execution-receipt.json',receiptBytes);
   const members=new Map(['assembled-source-manifest.json','deployment-source-manifest.json','dependencies.json','reservation-receipt.json','fresh-main-reservation-binding.json','normal613-intent.json','normal613-ack.json'].map(n=>[n,{sha256:h,bytes:content.length}]));const refs=S.normal613ReceiptMemberReferences(receipt,members);if(kind==='mismatched-join')refs[1].sha256='f'.repeat(64);
   const mapping={schemaVersion:'normal613-receipt-member-map.v1',receipt:{member:'execution-receipt.json',bytes:receiptBytes.length,sha256:sha(receiptBytes)},references:refs};if(kind==='unicode-invalid')mapping.references[0].receiptPath='\ud800';put(admission,'normal613-receipt-member-map.json',mapping);
   const focused=path.join(root,'ns-normal-613-focused');fs.mkdirSync(focused,{mode:0o700});const common={repository:context.repository,headSha:context.headSha,testedMergeSha:context.testedMergeSha,runId:'1',runAttempt:1,executionReceiptSha256:sha(receiptBytes),originalDeadline:context.actionDeadlineAt};const fc={schemaVersion:'normal613-focused-context.v1',...common,assembledManifestSha256:receipt.actualAssembledSourceManifestSha256,aggregateEntryNs:'1000000000',aggregateDeadlineNs:'120000000000',sources:Array.from({length:8},(_,i)=>({synthetic:i}))};const fr={schemaVersion:'normal613-focused-report.v1',...common,status:kind==='focused-failed'?'FAILED_OR_UNKNOWN':'PASS_FOCUSED_SYNTHETIC_CONTROLS_ONLY',aggregateEntryNs:fc.aggregateEntryNs,aggregateDeadlineNs:fc.aggregateDeadlineNs,failure:null,releaseAcceptance:false,realAuthorityFromSyntheticRecords:false,unrun:[],newScratchRoots:[],completed:Array.from({length:8},(_,i)=>({id:i,status:0,reason:null,childClosed:true,topLevelGroupClosed:true,ownedCleanupObserved:true,ownedProcessIdentities:[{synthetic:i}],ownershipScope:{knownVisibility:[]},ownershipHolds:[],childSoftDeadlineNs:'2000000000',childHardDeadlineNs:'5000000000',childReportAccepted:true,cleanupHold:kind==='focused-held'&&i===0,newScratchRoots:[]}))};   if(kind.startsWith('root-visibility-')||kind.startsWith('known-visibility-')){
    const row=fr.completed[0],key={pid:41,uid:1001,startTicks:'7',pgid:41,sessionId:41},scope={callerPid:40,rootIdentity:{...key,parentPid:40},snapshotStartedNs:'1000000000',snapshotCompletedNs:'1020000000',childHandleBoundAtNs:'1050000000',boundChildPid:41,rootObservedAtNs:'1100000000',preSpawnMetadataSha256:'8'.repeat(64),actualRootAfterSnapshot:true,stableClosureInventory:true,unknownOrOwnershipHolds:[],permanentOwnershipHolds:[],knownVisibility:[]};
    row.childPid=41;row.signal=null;row.ownedProcessIdentities=[{...key,parentPid:40}];row.ownershipScope=scope;
    const join=sha(Buffer.from(JSON.stringify({root:key,callerPid:scope.callerPid,rootObservedAtNs:scope.rootObservedAtNs,preSpawnMetadataSha256:scope.preSpawnMetadataSha256,boundChildPid:scope.boundChildPid,childHandleBoundAtNs:scope.childHandleBoundAtNs})));
    scope.rootEventJoinSha256=join;scope.rootEventProof={exit:{pid:41,identity:{...key},rootEventJoinSha256:join,sameChildProcessHandle:true,code:0,signal:null,observedAtNs:'1300000000'},close:{pid:41,identity:{...key},rootEventJoinSha256:join,sameChildProcessHandle:true,code:0,signal:null,observedAtNs:'1400000000'}};
    scope.rootVisibility={identity:{...key},rootEventJoinSha256:join,status:'RESOLVED_AFTER_BOUND_ROOT_EXIT_CLOSE_AND_DOMAIN_ABSENCE',errorCode:'EACCES',lastErrorCode:'EACCES',readDenials:1,firstDeniedAtNs:'1200000000',lastDeniedAtNs:'1200000000',resolution:{rootAbsent:true,ownedDomainEmpty:true,firstMetadataSha256:'9'.repeat(64),secondMetadataSha256:'9'.repeat(64),firstInventoryStartedNs:'1500000000',secondInventoryStartedNs:'1600000000',inventoryCompletedNs:'1650000000',confirmedAtNs:'1700000000'}};
    if(kind==='root-visibility-pending')scope.rootVisibility.status='PENDING_BOUND_ROOT_EXIT_CLOSE_AND_DOMAIN_CLOSURE';
    if(kind==='root-visibility-missing-close')delete scope.rootEventProof.close;
    if(kind==='root-visibility-wrong-handle')scope.rootEventProof.exit.sameChildProcessHandle=false;
    if(kind==='root-visibility-wrong-pid')scope.rootEventProof.close.pid=42;
    if(kind==='root-visibility-wrong-birth')scope.rootVisibility.identity.startTicks='8';
    if(kind==='root-visibility-wrong-uid')scope.rootEventProof.exit.identity.uid=1002;
    if(kind==='root-visibility-pre-event-inventory')scope.rootVisibility.resolution.firstInventoryStartedNs='1250000000';
    if(kind==='root-visibility-unstable-inventory')scope.rootVisibility.resolution.secondMetadataSha256='a'.repeat(64);
    if(kind==='root-visibility-other-hold')scope.permanentOwnershipHolds=['SYNTHETIC_UNKNOWN_DESCENDANT'];
    if(kind==='root-visibility-no-absence')scope.rootVisibility.resolution.rootAbsent=false;
    if(kind==='root-visibility-after-deadline')scope.rootVisibility.resolution.confirmedAtNs='6000000000';
    if(kind==='root-visibility-wrong-code')scope.rootEventProof.close.code=1;
    if(kind.startsWith('known-visibility-')){
     const identity={pid:42,uid:1001,startTicks:'8',pgid:41,sessionId:41};row.ownedProcessIdentities.push({...identity,parentPid:41});
     const positiveProof={identity:{...identity},rootIdentity:{...key},rootEventJoinSha256:join,observedAtNs:'1150000000',parentPid:41,anchorIdentity:{...key},anchorObservedAtNs:'1100000000',positiveMarkerConfirmed:true,ownedDomainConfirmed:true,baselineAbsent:true};
     scope.knownVisibility=[{identity:{...identity},rootEventJoinSha256:join,positiveProof,positiveProofSha256:sha(Buffer.from(JSON.stringify(positiveProof))),status:'RESOLVED_AFTER_BOUND_ROOT_EXIT_CLOSE_AND_DOMAIN_ABSENCE',errorCode:'EACCES',lastErrorCode:'EACCES',firstDeniedAtNs:'1200000000',lastDeniedAtNs:'1200000000',lastIdentityCheckedAtNs:'1200000000',readDenials:1,resolution:{...scope.rootVisibility.resolution,deniedIdentityAbsent:true,deniedIdentity:{...identity}}}];
     if(kind==='known-visibility-pending')scope.knownVisibility[0].status='PENDING_BOUND_ROOT_EXIT_CLOSE_AND_DOMAIN_CLOSURE';
     if(kind==='known-visibility-missing-positive-proof')delete scope.knownVisibility[0].positiveProof;
     if(kind==='known-visibility-wrong-birth')scope.knownVisibility[0].identity.startTicks='9';
     if(kind==='known-visibility-missing-array')delete scope.knownVisibility;
     if(kind==='known-visibility-denial-after-inventories'){scope.knownVisibility[0].lastDeniedAtNs='1650000000';scope.knownVisibility[0].lastIdentityCheckedAtNs='1650000000';}
    }

   }
   put(focused,'context.json',fc);put(focused,'report.json',fr);put(focused,'stdout.log',Buffer.alloc(0));if(kind!=='focused-missing')put(focused,'stderr.log',Buffer.alloc(0));
  }
  const positive=kind==='positive'||kind==='root-visibility-positive'||kind==='known-visibility-positive';if(positive)await normal613Main(['--normal613-seal']);else await assert.rejects(normal613Main(['--normal613-seal']),/Incomplete producer evidence/);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'ns-normal-613-artifact/normal613-artifact-manifest.json'),'utf8'));assert.equal(manifest.status,positive?'COMPLETE':'FAILED_OR_UNKNOWN');assert.equal(manifest.releaseAcceptance,false);if(!positive)assert(manifest.issues.length>0);results.push({role,kind,status:'PASS',artifactStatus:manifest.status,issues:manifest.issues});
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}fs.rmSync(root,{recursive:true,force:false});assert(!fs.existsSync(root));}
}
async function main(){NSB_CHECK();NSB_CHECK();assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');assert(process.env.RUNNER_TEMP);const root=fs.realpathSync(process.env.RUNNER_TEMP);for(const kind of ['positive','missing-deployment','mismatched-join','unicode-invalid','unresolved-child','focused-missing','focused-failed','focused-held'])await one(root,'fixture',kind);for(const engine of ['chromium','webkit'])for(const kind of ['positive','missing-proof','unresolved-child'])await one(root,engine,kind);for(const kind of ["root-visibility-positive","root-visibility-pending","root-visibility-missing-close","root-visibility-wrong-handle","root-visibility-wrong-pid","root-visibility-wrong-birth","root-visibility-wrong-uid","root-visibility-pre-event-inventory","root-visibility-unstable-inventory","root-visibility-other-hold","root-visibility-no-absence","root-visibility-after-deadline","root-visibility-wrong-code"])await one(root,'fixture',kind);for(const kind of ['known-visibility-positive','known-visibility-pending','known-visibility-missing-positive-proof','known-visibility-wrong-birth','known-visibility-missing-array','known-visibility-denial-after-inventories'])await one(root,'fixture',kind);console.log(JSON.stringify({schemaVersion:'normal613-seal-synthetic-controls.v1',status:'PASS_SYNTHETIC_ONLY',results,notR1ReceiptAdmission:true,providerRequests:0,realAuthority:false,releaseAcceptance:false}));}
NSB_RUN(main,e=>{console.error(JSON.stringify({status:'FAIL_OR_UNKNOWN',results,error:String(e.stack||e).slice(0,4096),releaseAcceptance:false}));process.exitCode=1;});
