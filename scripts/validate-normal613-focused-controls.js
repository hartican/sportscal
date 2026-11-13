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

// PRIVATE SOURCE PROPOSAL — UNPARSED AND UNRUN. Only for a separately allocated Linux CI job.
// Imports actual reviewed guard functions via the proposed export-only seam, not reimplementations.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(fs.readFileSync(path.join(__dirname,'validate-forward-onboarding-ci.js'))),'a78201621fc5bb972bc130e93f1e4730c3f543859dffb5770a945ac2763ea164','Exact reviewed R3 with proposed export-only seam');
assert.equal(sha(fs.readFileSync(path.resolve('.github/workflows/installed-upgrade-tests.yml'))),'27fa852a067915ff9b4039a51a53eff606d222fb868a64144ecca82a46d6b3c9','Exact R3 workflow');
const guard=require('./validate-forward-onboarding-ci');
const S=guard.normal613FocusedControls;
assert(S&&S.version==='normal613-focused-controls.v1','Reviewed export-only seam required');
const {normal613Remaining,normal613OwnedRoot,normal613Save,normal613UnicodeSafe,normal613Canonical,normal613ReceiptMemberReferences,normal613FixtureCommandIds,normal613EngineCommandIds}=S;
const rows=[];
function run(name,fn){NSB_CHECK();const started=process.hrtime.bigint();try{fn();rows.push({name,status:'PASS',elapsedMs:Number(process.hrtime.bigint()-started)/1e6});}catch(e){rows.push({name,status:'FAIL',message:String(e.stack||e).slice(0,4096)});throw e;}}
function iso(n){return new Date(n).toISOString();}
function withClock(wall,mono,fn){const oldNow=Date.now,oldMono=process.hrtime.bigint;try{Date.now=()=>wall;process.hrtime.bigint=()=>BigInt(mono);return fn();}finally{Date.now=oldNow;process.hrtime.bigint=oldMono;}}
function context(start,wallOrigin,startMono,budget,until){return {startedAt:iso(start),clockObservedAt:iso(wallOrigin),startMonotonicNs:String(startMono),maxWallMs:budget,validUntil:iso(until),actionDeadlineAt:iso(Math.min(until,start+budget))};}
function clockTests(){
 const start=Date.parse('2026-11-13T00:00:00.000Z'),until=start+60000;
 run('short-original-allowance',()=>withClock(start+1200,1200000000n,()=>assert.equal(normal613Remaining(context(start,start,0,5000,until),30000),3800)));
 run('exhausted-original-allowance',()=>withClock(start+5000,5000000000n,()=>assert.throws(()=>normal613Remaining(context(start,start,0,5000,until),30000),/Expired allocated action/)));
 run('expired-valid-until',()=>withClock(start+1000,1000000000n,()=>assert.throws(()=>normal613Remaining(context(start,start,0,5000,start+1000),30000),/Expired allocated action/)));
 run('cross-job-clock-preserves-deadline',()=>withClock(start+3200,700000000n,()=>assert.equal(normal613Remaining(context(start,start+2500,0,5000,until),30000),1800)));
 run('deadline-reset-refused',()=>withClock(start+1000,1000000000n,()=>{const c=context(start,start,0,5000,until);c.actionDeadlineAt=iso(start+30000);assert.throws(()=>normal613Remaining(c,30000),/No action-budget reset/);}));
 run('clock-divergence-refused',()=>withClock(start+2500,0,()=>assert.throws(()=>normal613Remaining(context(start,start,0,5000,until),30000),/monotonic\/wall join/)));
}
function proofTests(root){
 const old=process.env.RUNNER_TEMP;process.env.RUNNER_TEMP=root;
 try{
  run('expired-before-mkdir',()=>{let count=0;assert.throws(()=>normal613OwnedRoot('expired-before-mkdir',true,()=>{count++;throw Error('TEST_EXPIRED');}),/TEST_EXPIRED/);assert.equal(count,1);assert.equal(fs.existsSync(path.join(root,'expired-before-mkdir')),false);});
  run('expired-before-open',()=>{const name='expired-before-open.json';assert.throws(()=>normal613Save(root,name,{x:'test'},()=>{throw Error('TEST_EXPIRED');}),/TEST_EXPIRED/);assert.equal(fs.existsSync(path.join(root,name)),false);});
  for(const [name,at] of [['expired-before-write',2],['expired-before-flush',3]])run(name,()=>{let calls=0,opened=0,closed=0,writes=0,flushed=0;const originals={open:fs.openSync,close:fs.closeSync,write:fs.writeSync,fsync:fs.fsyncSync};try{
   fs.openSync=(...a)=>{opened++;return originals.open(...a)};fs.closeSync=(...a)=>{closed++;return originals.close(...a)};fs.writeSync=(...a)=>{writes++;return originals.write(...a)};fs.fsyncSync=(...a)=>{flushed++;return originals.fsync(...a)};
   assert.throws(()=>normal613Save(root,name+'.json',{x:'test'},()=>{if(++calls===at)throw Error('TEST_EXPIRED');}),/TEST_EXPIRED/);
   assert.equal(opened,1);assert.equal(closed,1);assert.equal(flushed,0);assert.equal(writes,at===2?0:1);
  }finally{fs.openSync=originals.open;fs.closeSync=originals.close;fs.writeSync=originals.write;fs.fsyncSync=originals.fsync;}});
 }finally{if(old===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=old;}
}
function dataTests(){
 run('unicode-valid-roundtrip',()=>{const v={text:'é 🎾',nested:['雪']};normal613UnicodeSafe(v);const b=Buffer.from(JSON.stringify(v)+'\n');assert.deepEqual(normal613Canonical(b,'Valid'),v);});
 for(const [name,value]of [['high-value',{x:'\ud800'}],['low-array',['\udc00']],['high-key',{['\ud800']:1}]])run('unicode-reject-'+name,()=>assert.throws(()=>normal613UnicodeSafe(value),/Unpaired/));
 run('compact-receipt-member-joins',()=>{const h='a'.repeat(64),d={sha256:h,bytes:3},members=new Map(['assembled-source-manifest.json','deployment-source-manifest.json','dependencies.json','reservation-receipt.json','fresh-main-reservation-binding.json','normal613-intent.json','normal613-ack.json'].map(n=>[n,d]));const receipt={actualAssembledSourceManifestPath:'/synthetic/assembled',actualAssembledSourceManifestSha256:h,actualDeploymentSourceManifestPath:'/synthetic/deployment',actualDeploymentSourceManifestSha256:h,runtime:{dependencyProof:{path:'/synthetic/deps',sha256:h}},reservation:{receipt:{path:'/synthetic/reservation',sha256:h}},freshMainAndReservationBinding:{receipt:{path:'/synthetic/fresh',sha256:h}},normal613Intent:{path:'/synthetic/intent',sha256:h},normal613Ack:{path:'/synthetic/ack',sha256:h}};assert.equal(normal613ReceiptMemberReferences(receipt,members).length,7);for(const key of members.keys()){const bad=new Map(members);bad.delete(key);assert.throws(()=>normal613ReceiptMemberReferences(receipt,bad),/Receipt\/member content join/);}members.set('deployment-source-manifest.json',{...d,sha256:'b'.repeat(64)});assert.throws(()=>normal613ReceiptMemberReferences(receipt,members),/Receipt\/member content join/);});
 run('legacy-and-engine-identity-lists',()=>{assert.deepEqual(normal613FixtureCommandIds(),['journey','install','signup','feed','calendar','production','admission','qualifier','premerge']);const chromium=normal613EngineCommandIds('chromium'),webkit=normal613EngineCommandIds('webkit');assert(!chromium.includes('original-manifest'));assert.equal(webkit.filter(x=>x==='original-manifest').length,1);assert.deepEqual(webkit.filter(x=>x!=='original-manifest'),chromium);});
}
function runStaticInputBindings(){
 const files=[['scripts/validate-sync-current-forward.js',101617,'a54983351de787e957658f92efedf1e10b470cbb06af252070eb1661228a970f'],['scripts/fixtures/sync-normal-613-20261112.json',53227,'744ddb4c83e97810bdd9f6778de0f50a5033695f24739d642c9179822c58a5d2']];
 run('frozen-r1-inputs',()=>{for(const [name,size,h]of files){const b=fs.readFileSync(path.resolve(name));assert.equal(b.length,size);assert.equal(sha(b),h);}});
}

// New ownership-domain controls use only mocked kernel records and mocked signals.
// They are not Linux process observations or OS closure proof.
function ownershipDomainTests(){
 const token='d'.repeat(64),uid=process.getuid(),self=process.pid,host=self+10001,root=self+10002,child=self+10003,peer=self+10004;
 function fake(fn){
  const methods=['lstatSync','openSync','readSync','closeSync','readdirSync'],saved=Object.fromEntries(methods.map(n=>[n,fs[n]])),oldKill=process.kill;
  const procs=new Map(),fds=new Map(),signals=[],envReads=[],faults=new Map(),handles=new WeakMap();let nextFd=1000000,listHook=null;
  const record=(pid,values={})=>({pid,uid,startTicks:String(pid+100),parentPid:1,pgid:pid,sessionId:pid,state:'S',marker:false,...values});
  const gone=()=>{const e=Error('synthetic missing proc');e.code='ENOENT';return e;};
  const statBytes=p=>{const f=Array(40).fill('0');f[0]=p.state;f[1]=String(p.parentPid);f[2]=String(p.pgid);f[3]=String(p.sessionId);f[19]=p.startTicks;return Buffer.from(String(p.pid)+' (synthetic) '+f.join(' ')+'\n');};
  procs.set(1,record(1,{uid:0,parentPid:0}));procs.set(host,record(host,{denyEnvironment:true}));
  fs.lstatSync=file=>{
   NSB_CHECK();const m=/^\/proc\/([1-9]\d*)$/.exec(String(file));assert(m,'Mock only proc directories');const pid=Number(m[1]),p=procs.get(pid);if(!p)throw gone();
   if(faults.has(pid))throw faults.get(pid);
   return {uid:p.uid,dev:1,ino:pid,isDirectory:()=>true,isSymbolicLink:()=>false};
  };
  fs.readdirSync=file=>{NSB_CHECK();assert.equal(file,'/proc');const names=[...procs.keys()].map(String);if(listHook)listHook();return names;};
  fs.openSync=file=>{
   NSB_CHECK();const m=/^\/proc\/([1-9]\d*)\/(stat|environ)$/.exec(String(file));assert(m,'Mock only proc metadata/environment');const p=procs.get(Number(m[1]));if(!p)throw gone();
   if(m[2]==='environ'){envReads.push(p.pid);if(p.denyEnvironment){const e=Error('synthetic candidate environment denied');e.code=p.denyEnvironmentCode||'EACCES';throw e;}}
   const bytes=m[2]==='stat'?statBytes(p):Buffer.from(p.marker?'NS_FOCUSED_OWNER_TOKEN='+token+'\0':'OTHER=synthetic\0');
   const fd=nextFd++;fds.set(fd,{bytes,offset:0});return fd;
  };
  fs.readSync=(fd,b,off,n)=>{NSB_CHECK();const f=fds.get(fd);assert(f);const count=Math.min(n,f.bytes.length-f.offset);f.bytes.copy(b,off,f.offset,f.offset+count);f.offset+=count;return count;};
  fs.closeSync=fd=>{assert(fds.delete(fd),'Every mocked descriptor closes');};
  process.kill=(pid,signal)=>{NSB_CHECK();assert(pid>0&&pid!==self,'No bare group or caller signal');signals.push({pid,signal});};
  const make=(clock=NSB_CLOCK)=>S.normal613FocusedOwnedProcesses(token,clock,NSB_SOFT);
  const start=t=>{procs.set(root,record(root,{parentPid:self,pgid:root,sessionId:root,marker:true}));const h=Object.create(require('node:child_process').ChildProcess.prototype);h.pid=root;handles.set(t,h);t.bindChild(h);t.setRoot(root);return t;};
  try{fn({procs,record,signals,envReads,faults,make,start,handle:t=>handles.get(t),setListHook:fn=>{listHook=fn;}});assert.equal(fds.size,0,'Mock descriptors closed');}
  finally{for(const n of methods)fs[n]=saved[n];process.kill=oldKill;}
 }
 run('ownership-preexisting-denied-positive-exclusion',()=>fake(({make,start,envReads,signals})=>{
  const t=start(make());assert.equal(t.holds.length,0);assert(!envReads.includes(host));const scope=t.scope();
  assert(scope.actualRootAfterSnapshot);assert(scope.excludedPreExisting.some(p=>p.before.pid===host&&JSON.stringify(p.before)===JSON.stringify(p.observed)));
  t.signalOwned('SIGTERM');assert(signals.some(x=>x.pid===root));assert(!signals.some(x=>x.pid===host));
 }));
 run('ownership-root-exit-not-live-child-closure',()=>fake(({make,start,procs,record})=>{
  const t=start(make());procs.set(child,record(child,{parentPid:root,pgid:root,sessionId:root,marker:true}));t.observe();procs.delete(root);assert.equal(t.observe().closed,false);
 }));
 run('ownership-verified-all-exits-can-close',()=>fake(({make,start,procs})=>{
  const t=start(make());procs.delete(root);assert.equal(t.observe().closed,true);assert.equal(t.holds.length,0);
 }));
 run('ownership-owned-environment-denial-hard-hold',()=>fake(({make,start,procs,signals})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('UNOBSERVABLE_OWNED_CANDIDATE')));assert.equal(signals.length,0);procs.delete(root);assert.equal(t.observe().closed,false);
 }));
 run('ownership-new-unknown-denied-hard-hold',()=>fake(({make,start,procs,record,signals})=>{
  const t=start(make());procs.set(child,record(child,{denyEnvironment:true}));t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('UNOBSERVABLE_OWNED_CANDIDATE')));assert(!signals.some(x=>x.pid===child));
 }));
 run('ownership-metadata-unobservable-hard-hold',()=>fake(({make,start,procs,record,faults})=>{
  const t=start(make());procs.set(child,record(child));const e=Error('synthetic metadata denied');e.code='EACCES';faults.set(child,e);assert.equal(t.observe().closed,false);assert(t.holds.some(x=>x.includes('UNKNOWN_KERNEL_METADATA')));
 }));
 run('ownership-owned-uid-change-not-silently-filtered',()=>fake(({make,start,procs,signals})=>{
  const t=start(make());procs.get(root).uid=uid+1;t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('OWNED_IDENTITY_CHANGED')));assert.equal(signals.length,0);
 }));
 run('ownership-owned-pid-reuse-no-signal-or-false-closure',()=>fake(({make,start,procs,signals})=>{
  const t=start(make());procs.get(root).startTicks='999999999';t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('OWNED_IDENTITY_CHANGED')));assert.equal(signals.length,0);procs.delete(root);assert.equal(t.observe().closed,false);
 }));
 run('ownership-preexisting-pid-change-not-excluded',()=>fake(({make,start,procs,signals})=>{
  const t=start(make());procs.get(host).startTicks='999999998';t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('PREEXISTING_IDENTITY_CHANGED')));assert(!signals.some(x=>x.pid===host));
 }));
 run('ownership-marker-loss-hard-hold-no-signal',()=>fake(({make,start,procs,signals})=>{
  const t=start(make());procs.get(root).marker=false;t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('OWNERSHIP_MARKER_LOST')));assert.equal(signals.length,0);
 }));
 run('ownership-unowned-group-member-not-excluded',()=>fake(({make,start,procs,record,signals})=>{
  const t=start(make());procs.set(child,record(child,{parentPid:root,pgid:root,sessionId:root}));t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('UNOWNED_MEMBER_OF_OWNED_DOMAIN')));assert(!signals.some(x=>x.pid===child));
 }));
 run('ownership-unowned-session-peer-hard-hold',()=>fake(({make,start,procs,record})=>{
  const t=start(make());procs.set(child,record(child,{sessionId:root}));assert.equal(t.observe().closed,false);assert(t.holds.some(x=>x.includes('UNOWNED_MEMBER_OF_OWNED_DOMAIN')));
 }));
 run('ownership-session-escaped-denied-descendant-hard-hold',()=>fake(({make,start,procs,record,signals})=>{
  const t=start(make());procs.set(child,record(child,{parentPid:root,denyEnvironment:true}));t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('UNOBSERVABLE_OWNED_CANDIDATE')));assert(!signals.some(x=>x.pid===child));
 }));
 run('ownership-session-escaped-marked-descendant-remains-active',()=>fake(({make,start,procs,record,signals})=>{
  const t=start(make());procs.set(child,record(child,{parentPid:root,marker:true}));assert.equal(t.observe().closed,false);t.signalOwned('SIGTERM');assert(signals.some(x=>x.pid===child));assert(t.records().some(x=>x.pid===child));
 }));
 run('ownership-preexisting-domain-change-has-priority',()=>fake(({make,start,procs,signals})=>{
  const t=start(make());procs.get(host).pgid=root;procs.get(host).sessionId=root;t.signalOwned('SIGTERM');assert(t.holds.some(x=>x.includes('PREEXISTING_IDENTITY_CHANGED')));assert(!signals.some(x=>x.pid===host));
 }));
 run('ownership-caller-remains-excluded-and-cannot-be-root',()=>fake(({make,procs,record,envReads})=>{
  procs.set(self,record(self,{marker:true,denyEnvironment:true}));const t=make();assert.throws(()=>t.setRoot(self),/Calling reporter/);assert(!envReads.includes(self));
 }));
 run('ownership-preexisting-root-reuse-rejected',()=>fake(({make,start,procs,record})=>{
  procs.set(root,record(root));const t=start(make());assert(t.holds.some(x=>x.includes('ROOT_PROVENANCE_HOLD')));assert.equal(t.observe().closed,false);
 }));
 run('ownership-new-markerless-orphan-remains-unknown',()=>fake(({make,start,procs,record})=>{
  const t=start(make());procs.set(child,record(child,{parentPid:1}));procs.delete(root);assert.equal(t.observe().closed,false);assert(t.holds.some(x=>x.includes('POSSIBLY_OWNED_NEW_IDENTITY')));
 }));
 run('ownership-known-reparented-descendant-retains-safe-cleanup-and-blocks-closure',()=>fake(({make,start,procs,record,signals})=>{
  const t=start(make());procs.set(child,record(child,{parentPid:root,pgid:root,sessionId:root,marker:true}));
  assert.equal(t.observe().closed,false);assert(t.records().some(p=>p.pid===child));
  procs.delete(root);procs.get(child).parentPid=1;
  const orphan=t.observe();assert.equal(orphan.closed,false);assert.equal(t.holds.length,0);
  assert(t.records().some(p=>p.pid===child&&p.parentPid===1));
  t.signalOwned('SIGTERM');assert(signals.some(p=>p.pid===child));assert(!signals.some(p=>p.pid===host||p.pid===self));
  assert.equal(t.observe().closed,false,'A signal or leader exit is not observed descendant closure');
  procs.delete(child);assert.equal(t.observe().closed,true);assert.equal(t.holds.length,0);
 }));
 run('root-visibility-joined-exit-close-and-fresh-absence-resolves-only-typed-hold',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();assert(t.waitingForRootExit&&t.holds.length===1);
  procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);
  assert.equal(t.observe().closed,true);assert.equal(t.holds.length,0);
  const p=t.scope();assert.equal(p.rootVisibility.errorCode,'EACCES');assert.equal(p.rootVisibility.status,'RESOLVED_AFTER_BOUND_ROOT_EXIT_CLOSE_AND_DOMAIN_ABSENCE');
  assert(p.rootVisibility.readDenials>0&&p.rootEventProof.exit.sameChildProcessHandle&&p.rootEventProof.close.sameChildProcessHandle);
  assert.equal(p.rootVisibility.resolution.firstMetadataSha256,p.rootVisibility.resolution.secondMetadataSha256);
  assert(BigInt(p.rootVisibility.resolution.firstInventoryStartedNs)>=BigInt(p.rootEventProof.close.observedAtNs));
 }));
 run('root-visibility-typed-eperm-still-needs-complete-joined-closure',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;procs.get(root).denyEnvironmentCode='EPERM';t.observe();
  assert.equal(t.scope().rootVisibility.errorCode,'EPERM');procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert(t.observe().closed);
 }));
 run('root-visibility-root-deletion-without-events-remains-held',()=>fake(({make,start,procs})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);assert.equal(t.observe().closed,false);assert(t.holds.length);
 }));
 run('root-visibility-exit-without-close-remains-held',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);t.recordRootExit(handle(t),0,null);assert.equal(t.observe().closed,false);
 }));
 run('root-visibility-close-before-exit-is-permanent-join-hold',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();assert.throws(()=>t.recordRootClose(handle(t),0,null),/Exit must precede close/);procs.delete(root);assert.equal(t.observe().closed,false);assert(t.scope().permanentOwnershipHolds.length);
 }));
 run('root-visibility-wrong-childprocess-handle-cannot-join',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();const wrong=Object.create(require('node:child_process').ChildProcess.prototype);wrong.pid=root;
  assert.throws(()=>t.recordRootExit(wrong,0,null),/Bound actual ChildProcess/);procs.delete(root);assert.equal(t.observe().closed,false);assert(t.scope().permanentOwnershipHolds.length);
 }));
 run('root-visibility-mutated-handle-pid-cannot-join',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();handle(t).pid=child;
  assert.throws(()=>t.recordRootExit(handle(t),0,null),/Bound actual ChildProcess/);handle(t).pid=root;procs.delete(root);assert.equal(t.observe().closed,false);
 }));
 run('root-visibility-mismatched-close-code-cannot-resolve',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);t.recordRootExit(handle(t),0,null);assert.throws(()=>t.recordRootClose(handle(t),1,null));assert.equal(t.observe().closed,false);
 }));
 run('root-visibility-kernel-birth-drift-is-never-cleared',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.get(root).startTicks='999999999';t.observe();
  procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert.equal(t.observe().closed,false);assert(t.holds.some(x=>x.includes('OWNED_IDENTITY_CHANGED')));
 }));
 run('root-visibility-uid-drift-is-never-cleared',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.get(root).uid=uid+1;t.observe();
  procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert.equal(t.observe().closed,false);assert(t.holds.some(x=>x.includes('OWNED_IDENTITY_CHANGED')));
 }));
 run('root-visibility-pgid-drift-is-never-cleared',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.get(root).pgid=peer;t.observe();
  procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert.equal(t.observe().closed,false);
 }));
 run('root-visibility-session-drift-is-never-cleared',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.get(root).sessionId=peer;t.observe();
  procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert.equal(t.observe().closed,false);
 }));
 run('root-visibility-marker-loss-is-never-cleared',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.get(root).denyEnvironment=false;procs.get(root).marker=false;t.observe();
  procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert.equal(t.observe().closed,false);assert(t.holds.some(x=>x.includes('OWNERSHIP_MARKER_LOST')));
 }));
 run('root-visibility-root-present-after-joined-events-is-hard-contradiction',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);
  assert.equal(t.observe().closed,false);assert(t.holds.some(x=>x.includes('ROOT_PRESENT_AFTER_BOUND_EXIT_CLOSE')));procs.delete(root);assert.equal(t.observe().closed,false);
 }));
 run('root-visibility-surviving-descendant-prevents-resolution',()=>fake(({make,start,procs,record,handle})=>{
  const t=start(make());procs.set(child,record(child,{parentPid:root,pgid:root,sessionId:root,marker:true}));t.observe();
  procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);
  assert.equal(t.observe().closed,false);assert.equal(t.scope().rootVisibility.status,'PENDING_BOUND_ROOT_EXIT_CLOSE_AND_DOMAIN_CLOSURE');
 }));
 run('root-visibility-unobservable-descendant-hold-survives-root-closure',()=>fake(({make,start,procs,record,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.set(child,record(child,{parentPid:root,denyEnvironment:true}));t.observe();
  procs.delete(root);procs.delete(child);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert.equal(t.observe().closed,false);assert(t.scope().permanentOwnershipHolds.length);
 }));
 run('root-visibility-incomplete-kernel-inventory-never-resolves',()=>fake(({make,start,procs,faults,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();const e=Error('synthetic metadata denied');e.code='EACCES';faults.set(host,e);
  procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert.equal(t.observe().closed,false);faults.delete(host);assert.equal(t.observe().closed,false);
 }));
 run('root-visibility-another-hold-cannot-be-cleared-even-with-same-message',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();t.note(t.holds[0]);
  procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert.equal(t.observe().closed,false);assert(t.scope().permanentOwnershipHolds.length);
 }));
 run('root-visibility-exhausted-original-clock-never-resolves',()=>fake(({make,start,procs,handle})=>{
  let expired=false;const shrinkingClock={...NSB_CLOCK,remaining:(...args)=>{NSB_CHECK();if(expired)throw Error('SYNTHETIC_ORIGINAL_EXHAUSTED');return NSB_CLOCK.remaining(...args);}};
  const t=start(make(shrinkingClock));procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);
  expired=true;assert.throws(()=>t.observe(),/SYNTHETIC_ORIGINAL_EXHAUSTED/);assert(t.holds.length);
 }));
 run('root-visibility-changing-post-event-inventory-cannot-resolve',()=>fake(({make,start,procs,record,handle,setListHook})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);
  let changed=false;setListHook(()=>{if(!changed){changed=true;procs.set(peer,record(peer));}});
  assert.equal(t.observe().closed,false);assert.equal(t.scope().rootVisibility.status,'PENDING_BOUND_ROOT_EXIT_CLOSE_AND_DOMAIN_CLOSURE');
 }));
 run('root-visibility-post-resolution-root-reappearance-is-new-permanent-hold',()=>fake(({make,start,procs,record,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);t.recordRootExit(handle(t),0,null);t.recordRootClose(handle(t),0,null);assert(t.observe().closed);
  procs.set(root,record(root,{parentPid:self,pgid:root,sessionId:root,marker:true}));assert.equal(t.observe().closed,false);assert(t.holds.some(x=>x.includes('ROOT_REAPPEARED_AFTER_RESOLUTION')));
 }));
 run('root-visibility-nonzero-exit-can-prove-cleanup-but-not-zero-status-acceptance',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);t.recordRootExit(handle(t),1,null);t.recordRootClose(handle(t),1,null);
  assert(t.observe().closed);assert.notEqual(t.scope().rootEventProof.exit.code,0);
 }));
 run('root-visibility-signal-exit-can-prove-cleanup-but-not-success',()=>fake(({make,start,procs,handle})=>{
  const t=start(make());procs.get(root).denyEnvironment=true;t.observe();procs.delete(root);t.recordRootExit(handle(t),null,'SIGTERM');t.recordRootClose(handle(t),null,'SIGTERM');
  assert(t.observe().closed);assert.equal(t.scope().rootEventProof.exit.signal,'SIGTERM');
 }));
 run('ownership-unchanged-preexisting-other-uid-needs-no-environment',()=>fake(({make,start,procs,envReads})=>{
  procs.get(host).uid=uid+1;const t=start(make());assert.equal(t.holds.length,0);assert(!envReads.includes(host));
 }));
}

function main(){NSB_CHECK();
 assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1','Explicit test-lane marker; never real authority');
 assert(process.env.RUNNER_TEMP,'Owned RUNNER_TEMP required');const parent=fs.realpathSync(process.env.RUNNER_TEMP),root=fs.mkdtempSync(path.join(parent,'ns-normal613-focused-'));fs.chmodSync(root,0o700);let cleanup=false;
 try{runStaticInputBindings();clockTests();proofTests(root);dataTests();ownershipDomainTests();}finally{fs.rmSync(root,{recursive:true,force:false});cleanup=!fs.existsSync(root);assert(cleanup,'Owned focused test root not removed');}
 console.log(JSON.stringify({schemaVersion:'normal613-focused-helper-controls.v1',status:'PASS_FOCUSED_HELPER_SUBSET_ONLY',cases:rows,syntheticOwnershipDomainCases:20,syntheticRootVisibilityCases:23,newOwnershipKernelObservations:0,ownedRootClosed:cleanup,realAuthority:false,networkRequests:0,productReleaseAcceptance:false,notCovered:['actual intake Git/request timing','revalidation entry','engine entry','owned command closure','full seal','51-arm','four paired','Chromium','WebKit']}));
}
NSB_RUN(main,e=>{console.error(JSON.stringify({schemaVersion:'normal613-focused-helper-controls.v1',status:'FAIL_OR_UNKNOWN',cases:rows,error:String(e.stack||e).slice(0,4096),productReleaseAcceptance:false}));process.exitCode=1;});
