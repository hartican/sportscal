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

// PRIVATE SOURCE PROPOSAL — UNPARSED AND UNRUN. Only for a separately allocated Linux CI job.
// Imports actual reviewed guard functions via the proposed export-only seam, not reimplementations.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(fs.readFileSync(path.join(__dirname,'validate-forward-onboarding-ci.js'))),'a2e3389d3d34897e63ed8fc9b903652cb9552aef92618a2287db71805425c6c3','Exact reviewed R3 with proposed export-only seam');
assert.equal(sha(fs.readFileSync(path.resolve('.github/workflows/installed-upgrade-tests.yml'))),'3cf1ddd91e1ad8c783be68ea8e011585bdbf03c8cd988e1e5f8c7fdd70b4b360','Exact R3 workflow');
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
function main(){NSB_CHECK();
 assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1','Explicit test-lane marker; never real authority');
 assert(process.env.RUNNER_TEMP,'Owned RUNNER_TEMP required');const parent=fs.realpathSync(process.env.RUNNER_TEMP),root=fs.mkdtempSync(path.join(parent,'ns-normal613-focused-'));fs.chmodSync(root,0o700);let cleanup=false;
 try{runStaticInputBindings();clockTests();proofTests(root);dataTests();}finally{fs.rmSync(root,{recursive:true,force:false});cleanup=!fs.existsSync(root);assert(cleanup,'Owned focused test root not removed');}
 console.log(JSON.stringify({schemaVersion:'normal613-focused-helper-controls.v1',status:'PASS_FOCUSED_HELPER_SUBSET_ONLY',cases:rows,ownedRootClosed:cleanup,realAuthority:false,networkRequests:0,productReleaseAcceptance:false,notCovered:['actual intake Git/request timing','revalidation entry','engine entry','owned command closure','full seal','51-arm','four paired','Chromium','WebKit']}));
}
NSB_RUN(main,e=>{console.error(JSON.stringify({schemaVersion:'normal613-focused-helper-controls.v1',status:'FAIL_OR_UNKNOWN',cases:rows,error:String(e.stack||e).slice(0,4096),productReleaseAcceptance:false}));process.exitCode=1;});
