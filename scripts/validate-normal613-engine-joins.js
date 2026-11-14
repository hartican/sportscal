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

// SOURCE PROPOSAL ONLY. Synthetic identity and clock controls, not a real admission.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');const guard=path.join(__dirname,'validate-forward-onboarding-ci.js');
assert.equal(sha(fs.readFileSync(guard)),'ed164e005853c40080dc608937ceaaf2ce2da2c2cba54167db531a2448bdc573');
const {normal613Main,normal613FocusedControls}=require('./validate-forward-onboarding-ci');const policy=normal613FocusedControls.NORMAL613_CALLER_POLICY;
const H='a'.repeat(40),T='b'.repeat(40),TREE='c'.repeat(40),BASE=policy.base;const rows=[];const iso=n=>new Date(n).toISOString();
async function caseOne(parent,engine,kind){NSB_CHECK();
 const root=fs.mkdtempSync(path.join(parent,'ns613-engine-join-'));fs.chmodSync(root,0o700);const keys=['RUNNER_TEMP','GITHUB_JOB','NS_OBSERVED_ENGINE','NS_NORMAL613_ENGINE_CONTEXT','NS_NORMAL613_ENGINE_CONTEXT_SHA256','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SHA'];const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const oldExec=cp.execFileSync,oldNow=Date.now,oldMono=process.hrtime.bigint;
 const start=Date.parse('2026-11-13T00:00:00.000Z'),origin=start+2500,until=start+60000;let delta=0,calls=0;const timeouts=[];
 const v={schemaVersion:'normal613-admitted-engine-context.v1',repository:policy.repository,pullRequest:1,headSha:H,baseSha:BASE,testedMergeSha:T,tree:TREE,bodySha256:'1'.repeat(64),intentSha256:'2'.repeat(64),ackSha256:'3'.repeat(64),policySha256:sha(Buffer.from(JSON.stringify(policy))),sourceManifestSha256:'4'.repeat(64),executionReceiptSha256:'5'.repeat(64),allocationId:'SYNTHETIC_TEST_ONLY',laneId:'SYNTHETIC_TEST_ONLY',ownedOperationId:'SYNTHETIC_TEST_ONLY',validUntil:iso(until),actionStartedAt:iso(start),actionDeadlineAt:iso(kind==='reset-deadline'?start+9000:start+5000),maxWallMs:5000,allocatedAt:iso(start-1),runId:'1',runAttempt:1,engines:['chromium','webkit']};const bytes=Buffer.from(JSON.stringify(v)+'\n');
 Object.assign(process.env,{RUNNER_TEMP:root,GITHUB_JOB:'installed-upgrade',NS_OBSERVED_ENGINE:engine,NS_NORMAL613_ENGINE_CONTEXT:bytes.toString('base64'),NS_NORMAL613_ENGINE_CONTEXT_SHA256:sha(bytes),GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:T});
 try{
  Date.now=()=>origin+delta+(kind==='wall-divergence'&&calls>0?2000:0);process.hrtime.bigint=()=>BigInt(delta)*1000000n;
  cp.execFileSync=(file,args,opts)=>{assert.equal(file,'git');calls++;timeouts.push(opts.timeout);if(kind==='expire-before-mkdir')delta+=900;else delta+=300;return [T,BASE+' '+H,TREE][calls-1]+'\n';};
  if(kind==='positive'){
   await normal613Main(['--normal613-engine-context']);const saved=JSON.parse(fs.readFileSync(path.join(root,'ns-normal-613-engine/normal613-context.json'),'utf8'));assert.equal(saved.startedAt,v.actionStartedAt);assert.equal(saved.clockObservedAt,iso(origin));assert.equal(saved.actionDeadlineAt,v.actionDeadlineAt);assert.equal(saved.maxWallMs,v.maxWallMs);assert.equal(saved.engine,engine);assert.deepEqual(fs.readFileSync(path.join(root,'ns-upgrade-proof/normal613-admission-context.json')),bytes);assert.equal(calls,3);assert(timeouts[0]>timeouts[1]&&timeouts[1]>timeouts[2]);
  }else{
   await assert.rejects(normal613Main(['--normal613-engine-context']),/Expired allocated action|No action-budget reset|monotonic\/wall join/);
   if(kind==='reset-deadline')assert.equal(calls,0);if(kind==='expire-before-mkdir')assert.equal(calls,3);if(kind==='wall-divergence')assert.equal(calls,1);
   assert(!fs.existsSync(path.join(root,'ns-normal-613-engine')));assert(!fs.existsSync(path.join(root,'ns-upgrade-proof')));
  }
  rows.push({engine,kind,status:'PASS',gitCalls:calls,timeouts});
 }finally{cp.execFileSync=oldExec;Date.now=oldNow;process.hrtime.bigint=oldMono;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}fs.rmSync(root,{recursive:true,force:false});assert(!fs.existsSync(root),'Owned synthetic root removed');}
}
async function main(){NSB_CHECK();NSB_CHECK();assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');assert(process.env.RUNNER_TEMP);const root=fs.realpathSync(process.env.RUNNER_TEMP);for(const engine of ['chromium','webkit'])for(const kind of ['positive','reset-deadline','expire-before-mkdir','wall-divergence'])await caseOne(root,engine,kind);console.log(JSON.stringify({schemaVersion:'normal613-engine-join-controls.v1',status:'PASS_SYNTHETIC_ONLY',rows,providerRequests:0,realAuthority:false,releaseAcceptance:false}));}
NSB_RUN(main,e=>{console.error(JSON.stringify({status:'FAIL_OR_UNKNOWN',rows,error:String(e.stack||e).slice(0,4096),releaseAcceptance:false}));process.exitCode=1;});
