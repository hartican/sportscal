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

const assert=NSB_ASSERT,fs=NSB_FS,path=NSB_PATH,crypto=require('node:crypto'),cp=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),guard=NSB_GUARD_PATH,NS=NSB_S;
const entry=NSB_ENTRY,aggregate=NSB_AGG,soft=NSB_SOFT,hard=NSB_HARD,token=NSB_TOKEN,clock=NSB_CLOCK;
const ms=n=>BigInt(n)*1000000n,mono=clock.nowNs,iso=n=>new Date(n).toISOString();
const pause=n=>new Promise(r=>setTimeout(r,n));
let interrupted=false;for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{interrupted=true});
let currentCase=-1;const results=[],caseNames=['success','nonzero','overflow','timeout','synthetic-unresolved','chromium','webkit'];
function durable(file,value,end){clock.remaining(end);fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
async function one(parent,name,script,kind,engine,index){
 // The unresolved synthetic guard needs its own closure window; the seven
 // case maxima total 28 seconds and leave up to four seconds for setup/report.
 const windows=[3000,3000,3000,4000,9000,3000,3000];
 const future=windows.slice(index).reduce((n,v)=>n+v,0);clock.remaining(soft,future+100);const end=clock.nowNs()+ms(windows[index]);NSB_ACTIVE_END=end;
 let root=null,tracker=null,child=null,closed=false,exit=null,reason=null,receipt=null,observed=false,passed=false,done=Promise.resolve(),outputBytes=0;const logs=[];
 const fail=e=>{if(!reason)reason=String(e)};
 try{
  clock.remaining(end,300);root=fs.mkdtempSync(path.join(parent,'ns613-owned-negative-'));fs.chmodSync(root,0o700);
  const admission=path.join(root,engine?'ns-normal-613-engine':'ns-normal-613-admission');fs.mkdirSync(admission,{mode:0o700});const pidFile=path.join(root,'inner.pid');
  const now=clock.nowMs(),budget=(kind==='timeout'||kind==='unresolved')?6800:8000,deadline=now+budget;
  const context={repository:'hartican/sportscal',headSha:'a'.repeat(40),baseSha:'b'.repeat(40),testedMergeSha:'c'.repeat(40),bodySha256:'d'.repeat(64),intentSha256:'e'.repeat(64),allocationId:'SYNTHETIC_TEST_ONLY',laneId:'SYNTHETIC_TEST_ONLY',ownedOperationId:'SYNTHETIC_TEST_ONLY',startedAt:iso(now),clockObservedAt:iso(now),startMonotonicNs:String(clock.nowNs()),validUntil:iso(deadline+1000),actionDeadlineAt:iso(deadline),maxWallMs:budget,...(engine?{engine}:{})};durable(path.join(admission,'normal613-context.json'),context,end);
  let preload=null;if(kind==='unresolved'){preload=path.join(root,'synthetic-preload.cjs');clock.remaining(end);fs.writeFileSync(preload,`const cp=require('node:child_process'),{EventEmitter}=require('node:events'),{PassThrough,Writable}=require('node:stream');cp.spawn=()=>{const c=new EventEmitter();c.pid=987654321;c.stdin=new Writable({write(_b,_e,cb){cb()}});c.stdout=new PassThrough();c.stderr=new PassThrough();c.unref=()=>{};return c};process.kill=(id)=>{if(id!==-987654321)throw Error('refuse non-synthetic pid');return true};`,{flag:'wx',mode:0o600});}
  tracker=NS.normal613FocusedOwnedProcesses(token,clock,end);
  clock.remaining(end,300);logs.push(fs.openSync(path.join(root,'wrapper.stdout.log'),'wx',0o600));logs.push(fs.openSync(path.join(root,'wrapper.stderr.log'),'wx',0o600));
  const id=engine?'pwa':'journey';child=cp.spawn(process.execPath,[guard,'--normal613-run',id,'--','bash','-Eeuo','pipefail'],{env:{...process.env,NS_FOCUSED_OWNER_TOKEN:token,RUNNER_TEMP:root,GITHUB_JOB:engine?'installed-upgrade':'fixture-activation',GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',...(preload?{NODE_OPTIONS:'--require='+preload}:{})},stdio:['pipe','pipe','pipe']});
  done=new Promise(resolve=>{child.once('error',e=>{fail(e);resolve()});child.once('close',(code,signal)=>{closed=true;exit={code,signal};resolve()})});
  for(const [i,stream] of [child.stdout,child.stderr].entries())stream.on('error',fail).on('data',b=>{try{clock.remaining(end);outputBytes+=b.length;if(outputBytes>6*1024*1024)throw Error('test wrapper output limit');fs.writeSync(logs[i],b)}catch(e){fail(e)}});
  child.stdin.on('error',fail);tracker.setRoot(child.pid);durable(path.join(root,'wrapper-start.json'),{pid:child.pid,case:name,synthetic:!!preload},end);
  const quoted="'"+pidFile.replace(/'/g,"'\\''")+"'";child.stdin.end('printf "%s\\n" "$$" > '+quoted+'\n'+script);
  while(!closed&&!reason&&!interrupted){clock.remaining(end,300);tracker.observe();await Promise.race([done,pause(Math.min(10,clock.remaining(end)))])}if(interrupted)fail('interrupted');
 }catch(e){fail(e)}finally{
  NSB_CLEANUP=true;
  if(child&&tracker){try{const termUntil=clock.nowNs()+ms(100);for(;;){clock.remaining(end);const snap=tracker.observe();if(closed&&snap.closed){observed=true;break}tracker.signalOwned(clock.nowNs()<termUntil?'SIGTERM':'SIGKILL');await pause(Math.min(10,clock.remaining(end)))}}catch(e){fail('CLEANUP_HOLD '+String(e))}}
  if(child&&!observed)fail('CLEANUP_HOLD owned closure unobserved');
  for(const stream of [child?.stdin,child?.stdout,child?.stderr])try{stream?.destroy()}catch(e){fail('descriptor close '+String(e))}
  for(const fd of logs)try{fs.closeSync(fd)}catch(e){fail('log close '+String(e))}
  NSB_CLEANUP=false;
 }
 try{
  assert(!reason&&closed&&observed&&!interrupted,'Owned wrapper/group or descriptors unresolved');clock.remaining(end);
  const id=engine?'pwa':'journey',admission=path.join(root,engine?'ns-normal-613-engine':'ns-normal-613-admission'),receiptFile=path.join(admission,'command-'+id+'.json');receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  const fakeOnly=kind==='unresolved',proved=receipt.childClosed===true&&receipt.ownedGroupClosed===true,fakeOnlyProved=fakeOnly&&receipt.childPid===987654321&&receipt.childClosed===false&&receipt.ownedGroupClosed===false;
  if(kind==='success'){assert.equal(exit.code,0);assert.equal(receipt.status,0);assert(proved)}else{assert.notEqual(exit.code,0);assert(receipt.failure||receipt.status!==0||receipt.cleanupStatus==='FAILED_OR_UNKNOWN');if(kind==='overflow')assert(receipt.outputOverflow);if(kind==='timeout')assert(receipt.failure&&/deadline|closure|descendant/i.test(receipt.failure));if(fakeOnly){assert(fakeOnlyProved);assert.equal(receipt.cleanupStatus,'FAILED_OR_UNKNOWN')}}
  assert(proved||fakeOnlyProved);const disposition={name,wrapperClosed:closed,actualOwnedClosure:observed,syntheticOnly:fakeOnly,exit,status:'PASS_SYNTHETIC_ONLY'};durable(path.join(root,'test-disposition.json'),disposition,end);clock.remaining(end);fs.rmSync(root,{recursive:true,force:false});results.push(disposition);passed=true;
 }catch(e){fail(e)}finally{if(!passed&&root)console.error(JSON.stringify({status:'CLEANUP_HOLD',ownedRoot:root,name,reason,wrapperClosed:closed,actualOwnedClosure:observed}));}
 if(reason||!passed)throw Error(reason||'FAIL_OR_UNKNOWN');
 NSB_ACTIVE_END=soft;
}
async function main(){assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');assert.equal(process.env.NS_FOCUSED_CLOUD_ONLY,'1');assert(process.env.RUNNER_TEMP);const root=fs.realpathSync(process.env.RUNNER_TEMP),cases=[['success','printf ok\\n','success',null],['nonzero','exit 13\n','failure',null],['overflow','head -c 4194305 /dev/zero\n','overflow',null],['timeout','sleep 60\n','timeout',null],['synthetic-unresolved','printf ignored\n','unresolved',null],['chromium','printf ok\n','success','chromium'],['webkit','printf ok\n','success','webkit']];for(let i=0;i<cases.length;i++){currentCase=i;await one(root,...cases[i],i);}clock.remaining(soft);console.log(JSON.stringify({schemaVersion:'normal613-owned-negative-controls.v1',status:'PASS_SYNTHETIC_WRAPPER_SUBSET_ONLY',results,realAuthority:false,providerRequests:0,releaseAcceptance:false}));}
NSB_RUN(main,e=>{console.error(JSON.stringify({status:'FAIL_OR_UNKNOWN',results,failedCase:currentCase<0?null:caseNames[currentCase],unrun:caseNames.slice(currentCase+1),error:String(e.stack||e).slice(0,4096),releaseAcceptance:false}));process.exitCode=1});
