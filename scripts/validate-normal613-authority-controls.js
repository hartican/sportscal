'use strict';
// PRIVATE SOURCE PROPOSAL. Execution is limited to the allocated Linux focused lane.
// Capture real clocks and the admitted context before any synthetic clock/env double.
const NSB_ASSERT=require('node:assert/strict'),NSB_FS=require('node:fs'),NSB_PATH=require('node:path'),NSB_CRYPTO=require('node:crypto');
const NSB_NATIVE_MONO=process.hrtime.bigint.bind(process.hrtime);
const NSB_GET=k=>{const x=process.env[k];NSB_ASSERT(/^[1-9][0-9]*$/.test(x||''),'Canonical focused input '+k);return BigInt(x);};
const NSB_ENTRY=NSB_GET('NS_FOCUSED_ENTRY_MONOTONIC_NS'),NSB_AGG=NSB_GET('NS_FOCUSED_AGGREGATE_DEADLINE_NS'),NSB_SOFT=NSB_GET('NS_FOCUSED_CHILD_SOFT_DEADLINE_NS'),NSB_HARD=NSB_GET('NS_FOCUSED_CHILD_HARD_DEADLINE_NS');
NSB_ASSERT.equal(process.platform,'linux');NSB_ASSERT.equal(process.arch,'x64');NSB_ASSERT.equal(process.version,'v24.21.0');NSB_ASSERT.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');
NSB_ASSERT.equal(process.env.NS_FOCUSED_CHILD_SOFT_MS,'8000');NSB_ASSERT.equal(process.env.NS_FOCUSED_CLOSURE_RESERVE_MS,'3000');
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
const NSB_GUARD_BYTES=NSB_BOOT_READ(NSB_GUARD_PATH,215519);NSB_ASSERT.equal(NSB_GUARD_BYTES.length,215519);NSB_ASSERT.equal(NSB_CRYPTO.createHash('sha256').update(NSB_GUARD_BYTES).digest('hex'),'1b6b20f27467a59e15fa42cf2949aef3528527081f3dc94920a11b71acb06102');
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

// SOURCE PROPOSAL ONLY. Synthetic relay records; no real authority or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),canonical=x=>Buffer.from(JSON.stringify(x)+'\n'),b64=b=>b.toString('base64'),iso=n=>new Date(n).toISOString();
const guard=path.join(__dirname,'validate-forward-onboarding-ci.js');assert.equal(sha(fs.readFileSync(guard)),'1b6b20f27467a59e15fa42cf2949aef3528527081f3dc94920a11b71acb06102');
const {normal613Intake,normal613ExpectedIntent,normal613FocusedControls:S}=require('./validate-forward-onboarding-ci'),p=S.NORMAL613_CALLER_POLICY;
const H='a'.repeat(40),T='b'.repeat(40),TREE='c'.repeat(40),BASE=p.base,results=[];
function build(reservation,now){
 const action={allocationId:'SYNTHETIC_TEST_ONLY',laneId:'SYNTHETIC_TEST_ONLY',ownedOperationId:'SYNTHETIC_TEST_ONLY',purpose:'normal613-qualification',intentSha256:'0'.repeat(64),sourceReviewId:'SYNTHETIC_TEST_ONLY',sourceReviewSha256:'1'.repeat(64),priorOwnedClosureReference:'SYNTHETIC_TEST_ONLY',validUntil:iso(now+60000),maxWallMs:30000,resultContentDispositionSha256:'2'.repeat(64)};
 const binding={schemaVersion:'normal-ready-613-binding.v1',phase:'qualification',repository:p.repository,preparedForBaseSha:p.base,productSourceSha:p.product,productSourceTree:p.productTree,publisherHeadSha:H,expectedPublisherTreeSha:TREE,reviewedFinalMapSha256:'3'.repeat(64),expectedAssembledManifestSha256:'4'.repeat(64),expectedSourceEntryCount:1,expectedBaseRelativePathCount:1,qualifier:p.qualifier,fixture:p.fixture,reservation:{schemaVersion:'ns-app-version-reservation.v1',reservationId:p.reservationId,version:'613',rawBytes:1362,rawSha256:p.reservationSha256,queue:'https://github.com/hartican/sportscal/issues/28',commentId:6813306721},actionIntent:action,reservationReceiptBase64:b64(reservation)};
 const fresh={schemaVersion:'normal613-fresh-main-reservation-binding.v1',phase:'qualification',purpose:'normal613-qualification',publisherThreadId:p.owners.PUBLISH,repository:p.repository,candidateHeadSha:H,candidateTreeSha:TREE,reviewedFinalMapSha256:binding.reviewedFinalMapSha256,expectedAssembledManifestSha256:binding.expectedAssembledManifestSha256,observedMainSha:BASE,mainObservedAt:iso(now-45000),mainRefEvidenceSha256:'5'.repeat(64),reservationId:p.reservationId,reservationVersion:'613',reservationReceiptSha256:p.reservationSha256,reservationConflictCheckedAt:iso(now-45000),knownConflictingReservation:false,globalReservationAvailability:'UNKNOWN; no global availability claim',namedAllocationId:action.allocationId,validUntil:action.validUntil,currentActionAuthority:'SYNTHETIC_TEST_ONLY'};
 const freshBytes=canonical(fresh),intent=normal613ExpectedIntent(binding,sha(freshBytes)),intentBytes=canonical(intent);action.intentSha256=sha(intentBytes);
 const body=JSON.stringify({schemaVersion:'ns-release-handover.normal613.v1',scope:'synthetic only',commit:H,testsAndResults:'synthetic only',dependencies:'synthetic only',databaseAndConfigChanges:'synthetic only',knownRisks:'synthetic only',rollback:'synthetic only',sourceQualificationBinding:binding}),bodyHash=sha(Buffer.from(body));
 const ack={...intent,schemaVersion:'normal613-action-ack.v1',intentSha256:action.intentSha256,bodySha256:bodyHash,acknowledgedBy:'nsRELEASE+nsPUBLISH',acknowledgedAt:iso(now-40000)},ackBytes=canonical(ack),ackHash=sha(ackBytes);
 const alloc={schemaVersion:'normal613-owned-allocation-attestation.v1',allocationId:action.allocationId,laneId:action.laneId,ownedOperationId:action.ownedOperationId,allocatedAt:iso(now-60000),validUntil:action.validUntil,maxWallMs:action.maxWallMs,resultContentDispositionSha256:action.resultContentDispositionSha256,permissionScope:'normal613-qualification-and-existing-installed-matrix'};
 const policyHash=sha(Buffer.from(JSON.stringify(p)));const namespace=sha(Buffer.from(JSON.stringify({schemaVersion:'normal613-action-namespace.v1',repository:p.repository,pullRequest:1,phase:'qualification',purpose:action.purpose,headSha:H,baseSha:BASE,intentSha256:action.intentSha256,bodySha256:bodyHash,allocationId:action.allocationId,laneId:action.laneId,ownedOperationId:action.ownedOperationId}))),marker='NS_NORMAL613_V1 '+namespace;
 const baseEnvelope={repository:p.repository,pullRequest:1,headSha:H,baseSha:BASE,intentSha256:action.intentSha256,bodySha256:bodyHash,policySha256:policyHash};
 function comment(id,envelope,at){return {id,body:marker+'\n'+canonical(envelope).toString(),issue_url:p.api+'/repos/'+p.repository+'/issues/1',url:p.api+'/repos/'+p.repository+'/issues/comments/'+id,user:{id:p.relayUserId},created_at:iso(at),updated_at:iso(at)};}
 const approvals=['RELEASE','PUBLISH'].map((role,i)=>comment(100+i,{schemaVersion:'normal613-role-envelope.v1',role,...baseEnvelope,ackBase64:b64(ackBytes),ackSha256:ackHash,intentBase64:b64(intentBytes),freshMainAndReservationBindingBase64:b64(freshBytes),ownerDecision:{threadId:p.owners[role],turnId:'00000000-0000-4000-8000-000000000001',decisionSha256:'6'.repeat(64),decidedAt:iso(now-50000)},allocation:alloc},now-30000+i));
 const witness=comment(102,{schemaVersion:'normal613-pre-ready-readback.v1',...baseEnvelope,ackSha256:ackHash,observedAt:iso(now-20000),ownerRecord:{threadId:p.owners.PUBLISH,turnId:'00000000-0000-4000-8000-000000000002',recordSha256:'7'.repeat(64)},comments:approvals.map(c=>({id:c.id,bodySha256:sha(Buffer.from(c.body)),authorId:c.user.id,createdAt:c.created_at,updatedAt:c.updated_at}))},now-19000);
 const event={action:'ready_for_review',number:1,repository:{full_name:p.repository,private:false},pull_request:{number:1,draft:false,updated_at:iso(now-10000),head:{sha:H,repo:{full_name:p.repository,private:false}},base:{sha:BASE,repo:{full_name:p.repository,private:false}},body}};
 return {event,comments:[...approvals,witness]};
}
function response(url,value,link){const data=Buffer.from(JSON.stringify(value));return {status:200,url,headers:new Headers({'content-type':'application/json','content-length':String(data.length),...(link?{link}:{})}),body:new ReadableStream({start(c){c.enqueue(data);c.close();}})};}
async function one(parent,reservation,kind){NSB_CHECK();
 const root=fs.mkdtempSync(path.join(parent,'ns613-authority-'));fs.chmodSync(root,0o700);const keys=['RUNNER_TEMP','GITHUB_EVENT_PATH','GITHUB_ACTIONS','GITHUB_EVENT_NAME','GITHUB_REPOSITORY','GITHUB_JOB','GITHUB_RUN_ATTEMPT','GITHUB_WORKFLOW_REF','GITHUB_REF','GITHUB_RUN_ID','GITHUB_SHA'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldExec=cp.execFileSync,oldFetch=global.fetch,oldNow=Date.now,oldMono=process.hrtime.bigint;const now=Date.parse('2026-11-13T00:00:00.000Z');let delta=0,gitCalls=0,providerCalls=0,prReads=0,scans=0;const x=build(reservation,now),event=path.join(root,'event.json');fs.writeFileSync(event,JSON.stringify(x.event),{mode:0o600});
 Object.assign(process.env,{RUNNER_TEMP:root,GITHUB_EVENT_PATH:event,GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:p.repository,GITHUB_JOB:'fixture-activation',GITHUB_RUN_ATTEMPT:'1',GITHUB_WORKFLOW_REF:p.repository+'/.github/workflows/installed-upgrade-tests.yml@refs/pull/1/merge',GITHUB_REF:'refs/pull/1/merge',GITHUB_RUN_ID:'1',GITHUB_SHA:T});
 try{
  Date.now=()=>now+delta;process.hrtime.bigint=()=>BigInt(delta)*1000000n;cp.execFileSync=()=>[T,BASE+' '+H,TREE,TREE][gitCalls++%4]+'\n';
  global.fetch=async url=>{providerCalls++;const u=new URL(url),pull='/repos/'+p.repository+'/pulls/1',list='/repos/'+p.repository+'/issues/1/comments',item='/repos/'+p.repository+'/issues/comments/';assert.equal(u.origin,p.api);
   if(u.pathname===pull){prReads++;const pr={...x.event.pull_request,state:'open'};if(kind==='changed-head'&&prReads===1)pr.head={...pr.head,sha:'9'.repeat(40)};if(kind==='changed-body'&&prReads===2)pr.body+=' ';return response(u.href,pr);}
   if(u.pathname===list){const page=Number(u.searchParams.get('page')||1);if(page===1)scans++;let comments=x.comments.map(c=>({...c,user:{...c.user}}));if(kind==='edited')comments[0].updated_at=iso(now-29999);if(kind==='wrong-actor')comments[0].user.id=42;if(kind==='duplicate')comments.push({...comments[0]});if(kind==='changed-readback'&&scans>1)comments[0].body+=' ';if(kind==='bad-ack'||kind==='wrong-role'||kind==='allocation-conflict'){const split=comments[0].body.indexOf('\n'),envelope=JSON.parse(comments[0].body.slice(split+1));if(kind==='bad-ack')envelope.ackSha256='9'.repeat(64);if(kind==='wrong-role')envelope.role='PUBLISH';if(kind==='allocation-conflict')envelope.allocation.laneId='SYNTHETIC_OTHER_LANE';comments[0].body=comments[0].body.slice(0,split+1)+canonical(envelope).toString();}if(kind==='hostile-pagination')return response(u.href,comments.slice(0,2),'<https://outside.invalid/page?per_page=100&page=2>; rel="next"');
    if(kind==='paginated'||kind==='incomplete-pagination'){const next=p.api+list+'?per_page=100&page=2';return page===1?response(u.href,comments.slice(0,2),'<'+next+'>; rel="next"'):response(u.href,kind==='incomplete-pagination'?[]:comments.slice(2));}
    return response(u.href,comments);
   }
   if(u.pathname.startsWith(item)){const id=Number(u.pathname.slice(item.length)),c=x.comments.find(c=>c.id===id);assert(c);if(kind==='changed-final-comment'&&id===100)return response(u.href,{...c,body:c.body+' '});return response(u.href,c);}
   throw Error('Unexpected synthetic URL '+u.pathname);
  };
  if(['positive','paginated'].includes(kind)){
   const first=await normal613Intake();assert.equal(first.headSha,H);assert.equal(first.actionDeadlineAt,iso(now+30000));const originalStart=first.startedAt,mono=first.startMonotonicNs;delta=250;gitCalls=0;await normal613Intake('admission');delta=500;gitCalls=0;const second=await normal613Intake('qualification');assert.equal(second.startedAt,originalStart);assert.equal(second.startMonotonicNs,mono);assert.equal(second.actionDeadlineAt,first.actionDeadlineAt);assert(fs.existsSync(path.join(root,'ns-normal-613-admission/normal613-readback-before-qualification.json')));
  }else if(kind==='revalidation-body-mismatch'){await normal613Intake();const prior=JSON.parse(x.event.pull_request.body);prior.scope='synthetic changed scope';x.event.pull_request.body=JSON.stringify(prior);fs.writeFileSync(event,JSON.stringify(x.event),{mode:0o600});delta=500;gitCalls=0;const callsBefore=providerCalls;await assert.rejects(normal613Intake('qualification'));assert.equal(gitCalls,0);assert.equal(providerCalls,callsBefore);assert(!fs.existsSync(path.join(root,'ns-normal-613-admission/normal613-readback-before-qualification.json')));}else{await assert.rejects(normal613Intake());assert(!fs.existsSync(path.join(root,'ns-normal-613-admission')),'Rejected authority must not create proof root');}
  results.push({kind,status:'PASS',syntheticFetches:providerCalls,gitCalls,realNetwork:false});
 }finally{cp.execFileSync=oldExec;global.fetch=oldFetch;Date.now=oldNow;process.hrtime.bigint=oldMono;for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}fs.rmSync(root,{recursive:true,force:false});assert(!fs.existsSync(root));}
}
async function main(){NSB_CHECK();NSB_CHECK();assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');assert(process.env.RUNNER_TEMP&&process.env.NS_TEST_RESERVATION_PATH);const r=fs.readFileSync(process.env.NS_TEST_RESERVATION_PATH);assert.equal(r.length,1362);assert.equal(sha(r),p.reservationSha256);const parent=fs.realpathSync(process.env.RUNNER_TEMP);for(const k of ['positive','paginated','incomplete-pagination','changed-head','changed-body','edited','wrong-actor','duplicate','bad-ack','wrong-role','allocation-conflict','hostile-pagination','changed-readback','changed-final-comment','revalidation-body-mismatch'])await one(parent,r,k);console.log(JSON.stringify({schemaVersion:'normal613-authority-synthetic-controls.v1',status:'PASS_SYNTHETIC_ONLY',results,realAuthority:false,providerRequests:0,releaseAcceptance:false}));}
NSB_RUN(main,e=>{console.error(JSON.stringify({status:'FAIL_OR_UNKNOWN',results,error:String(e.stack||e).slice(0,4096),releaseAcceptance:false}));process.exitCode=1;});
