'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {AsyncLocalStorage}=require('node:async_hooks'),transport=require('./transport.cjs'),P=require('./protocol.cjs');
let privacy;
const raw=Object.fromEntries(['existsSync','lstatSync','readFileSync','writeFileSync','appendFileSync','openSync','closeSync','writeSync','mkdirSync','realpathSync'].map(k=>[k,fs[k].bind(fs)]));
const policyPath=process.env.NS_SCORE_GUARD_POLICY,policyBytes=raw.readFileSync(policyPath);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function writeAll(fd,data){const b=Buffer.isBuffer(data)?data:Buffer.from(String(data));for(let at=0;at<b.length;){const n=raw.writeSync(fd,b,at,b.length-at);if(!n)throw Error('GUARD_SHORT_WRITE');at+=n;}}
function internalWrite(file,data,flags='w'){if(privacy.contains(data))throw P.error('GUARD_SECRET_OUTPUT');const fd=raw.openSync(file,flags,0o600);try{writeAll(fd,data);}finally{raw.closeSync(fd);}}
if(hash(policyBytes)!==process.env.NS_SCORE_GUARD_POLICY_SHA256)throw Error('GUARD_POLICY_HASH');
const p=JSON.parse(policyBytes),eplMode=p.sourceProtocol==='epl',root=raw.realpathSync(p.root),run=raw.realpathSync(p.runDir),tmp=raw.realpathSync(p.tmpDir);
privacy=P.privacy(eplMode?(p.mode==='owned-control'?[process.env.NS_EPL_TEST_KEY].filter(Boolean):[]):P.credentials());
const failure=path.join(run,'first-error.json'),ledger=path.join(run,'guard-ledger.jsonl');
const control=p.mode==='owned-control'&&p.controlBoundary?require(p.controlBoundary):null;
if(!eplMode&&(!['owned-control','live-coverage-canonical'].includes(p.mode)||p.http.requests!==8||p.http.bodyDeadlineMs!==10000||p.http.maxCapturedBytes!==4194304||p.http.maxCumulativeBytes!==16777216||p.http.retries!==0||p.http.redirect!=='error'))throw P.error('GUARD_PROTOCOL_POLICY');
if(!eplMode&&(p.http.origin!==P.ORIGIN||p.http.rpc!==P.RPC||p.http.method!=='POST'||JSON.stringify(p.http.body)!=='{"p_fixture_ids":null}'||p.http.pageSize!==500))throw P.error('GUARD_PROTOCOL_POLICY');
if(p.mode==='live-coverage-canonical'&&(p.root!==p.sourceRoot||Object.keys(p).some(k=>k.startsWith('control'))||p.nodeOptions!=='--require='+__filename))throw P.error('GUARD_ACTUAL_PROFILE');
const eplPolicy=eplMode?require('./epl-policy.cjs'):null;
if(eplMode){eplPolicy.validate(p);if(p.mode==='epl-canonical'&&p.nodeOptions!=='--require='+__filename)throw P.error('GUARD_ACTUAL_PROFILE');for(const key of Object.keys(process.env))if(!p.environmentKeys.includes(key))throw P.error('GUARD_CHILD_ENVIRONMENT');}else P.validateActualScope(p);
if(p.mode==='live-coverage-canonical'&&p.publicFixtureShape!==path.join(__dirname,'public-fixture-shape.rugby.json'))throw P.error('GUARD_ACTUAL_SCHEMA');
function log(row){internalWrite(ledger,JSON.stringify({at:new Date().toISOString(),pid:process.pid,...row})+'\n','a');}
function mark(error){try{const diagnostic=P.shapeFailure(error),summary=P.shapeFailures(error);internalWrite(failure,JSON.stringify({at:new Date().toISOString(),pid:process.pid,name:'Error',code:/^(?:POST_GUARD|GUARD)_[A-Z0-9_]+$/.test(error.code||'')?error.code:'GUARD_PROCESS_FAILURE',message:/^(?:POST_GUARD|GUARD)_[A-Z0-9_]+$/.test(error.code||'')?error.code:'GUARD_PROCESS_FAILURE',...(diagnostic?{shapeFailure:diagnostic}:{}),...(summary?{shapeFailures:summary}:{})})+'\n','wx');}catch(e){if(e.code!=='EEXIST')process.stderr.write('Guard failure receipt unavailable\n');}}
function deny(code){const e=Error(code);e.code=code;mark(e);log({state:'denied',code});throw e;}
function canonical(file){let x=path.resolve(String(control?control.mapPath(file):file)),tail=[];for(;;){try{raw.lstatSync(x);break;}catch(error){if(error.code!=='ENOENT')throw error;tail.unshift(path.basename(x));const parent=path.dirname(x);if(parent===x)deny('GUARD_PATH');x=parent;}}try{return path.join(raw.realpathSync(x),...tail);}catch{deny('GUARD_BROKEN_LINK');}}
const writable=new Set(p.writeFiles.map(canonical)),directories=new Set(p.writeDirectories.map(canonical)),baseHashes=p.rollbackHashes||{},fds=new Map(),restoring=new Set();
const dependency=raw.existsSync(path.join(root,'node_modules'))?raw.realpathSync(path.join(root,'node_modules')):null;
function ordinary(file){const x=canonical(file);return writable.has(x)||x.startsWith(tmp+path.sep)||x.startsWith(run+path.sep)&&/^(?:refresh-report|quick-results-report)\.json(?:\.tmp-[a-zA-Z0-9.-]+)?$/.test(path.basename(x));}
function fileCap(file){return p.writeCaps?.[file]||p.maxFileBytes||33554432;}
function mutation(file,body,{remove=false,append=false}={}){if(typeof file==='number')deny('GUARD_FD_PATH');if(body!==undefined&&privacy.contains(body))deny('GUARD_SECRET_OUTPUT');const x=canonical(file);if(x===path.join(root,'.git')||dependency&&(x===dependency||x.startsWith(dependency+path.sep)))deny('GUARD_SHARED_WRITE');
 if(![root,run,tmp].some(base=>x===base||x.startsWith(base+path.sep)))deny('GUARD_SHARED_WRITE');
 if(raw.existsSync(x)){const stat=raw.lstatSync(x);if(stat.isFile()&&stat.nlink!==1)deny('GUARD_HARDLINK_WRITE');}
 if(eplMode&&p.mode==='epl-canonical'&&x===path.join(root,'data/canonical/football-delayed-results.v1.json')&&(body===undefined||hash(Buffer.from(body))!==baseHashes[x]))deny('GUARD_EPL_OVERLAY_BASELINE');
 if(body!==undefined&&Buffer.byteLength(body)>fileCap(x))deny('GUARD_WRITE_SIZE');
 if(raw.existsSync(failure)&&baseHashes[x]){if(!append&&(body!==undefined&&hash(Buffer.isBuffer(body)?body:Buffer.from(String(body)))===baseHashes[x]||restoring.has(x))){log({state:'rollback-permitted',path:path.relative(root,x)});return x;}deny('GUARD_NONRESTORING_WRITE_AFTER_FAILURE');}
 if(!ordinary(x))deny('GUARD_WRITE_SCOPE');
 if(raw.existsSync(failure)&&!x.startsWith(tmp+path.sep)&&!x.startsWith(run+path.sep)&&!(remove&&!baseHashes[x]))deny('GUARD_NONRESTORING_WRITE_AFTER_FAILURE');log({state:'write-permitted',path:path.relative(root,x)});return x;}
const norm=args=>[path.resolve(root,args[0]),...args.slice(1)];
const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));
const argv=process.argv.slice(1),entry=same(argv,p.entryArgv),child=eplMode?eplPolicy.child(argv,p):p.childArgvs.some(a=>same(argv,a));
if(raw.realpathSync(process.execPath)!==p.node||process.cwd()!==p.root||!entry&&!child)deny('GUARD_STARTUP_COMMAND');
for(const [file,digest] of Object.entries(p.sourcePins))if(hash(raw.readFileSync(file))!==digest)deny('GUARD_SOURCE_PIN');
if(process.env.NODE_OPTIONS!==p.nodeOptions)deny('GUARD_PRELOAD');
log({state:'start',role:entry?'entry':'child',argv});
const sourceRole=same(argv,p.sourceArgv),eplDag=eplMode?eplPolicy.dag(p,entry&&p.mode==='epl-canonical'?'entry':sourceRole?'source':'projection'):null,scope=new AsyncLocalStorage(),originalFetch=global.fetch;
if(sourceRole){try{internalWrite(path.join(run,'source-owner-claim'),JSON.stringify({pid:process.pid,at:new Date().toISOString()})+'\n','wx');}catch{deny('GUARD_SECOND_SOURCE_PROCESS');}}
const capture={
 start:row=>log({state:'request-start',...row}),
 commit:(ordinal,bytes)=>{const file=path.join(run,'page-'+String(ordinal).padStart(2,'0')+'.raw');internalWrite(file,bytes,'wx');return true;},
 finish:row=>{internalWrite(path.join(run,'page-'+String(row.ordinal).padStart(2,'0')+'.json'),JSON.stringify(row,null,2)+'\n');},
};
let tx;
if(eplMode){
 const https=require('node:https'),net=require('node:net'),tls=require('node:tls'),dns=require('node:dns');
 // Private raw capabilities are never exposed on the consumer's facades. No
 // ALS flag can grant EPL callers net/tls/dns access, even in callbacks.
 const rawGet=https.get.bind(https),Socket=net.Socket,connect=net.Socket.prototype.connect,lookup=dns.lookup.bind(dns),secure=tls.connect.bind(tls);
 const agent=new https.Agent({keepAlive:false,maxSockets:1,maxFreeSockets:0,maxCachedSessions:0});
 agent.createConnection=function(options){
  if(raw.existsSync(failure)||options.host!=='footballapi.pulselive.com'||Number(options.port)!==443)deny('GUARD_EPL_CONNECTION');
  const socket=new Socket();
  try{connect.call(socket,{host:'footballapi.pulselive.com',port:443,lookup});return secure({socket,servername:'footballapi.pulselive.com',rejectUnauthorized:true,ALPNProtocols:['http/1.1']});}
  catch(error){socket.destroy();throw error;}
 };
 const reader=require(path.join(p.sourceRoot,'scripts/lib/epl-source-json.js'));
 const primary=require(path.join(p.sourceRoot,'scripts/refresh-premier-league-cards.js'));
 const table=require(path.join(p.sourceRoot,'scripts/refresh-premier-league-context.js'));
 const identities=require(path.join(p.sourceRoot,'lib/epl-provider-identities.js'));
 tx=new(require('./epl-transport.cjs').Transport)({sourceOwner:sourceRole,reader:reader.readJson,rawGet,agent,primary:{...primary,binding:identities.binding},table,directory:JSON.parse(raw.readFileSync(path.join(p.sourceRoot,'data/canonical/football-directory.v1.json'))),capture:row=>{internalWrite(path.join(run,'page-'+String(row.resource).padStart(2,'0')+'.json'),JSON.stringify(row)+'\n');},values:p.mode==='owned-control'?[process.env.NS_EPL_TEST_KEY].filter(Boolean):[],blocked:()=>raw.existsSync(failure),deny});
 reader.readJson=tx.read;https.get=tx.get;
 global.fetch=()=>deny('GUARD_FETCH_SCOPE');
}else{
tx=new transport.Transport({schema:JSON.parse(raw.readFileSync(p.publicFixtureShape)),values:P.credentials(),capture,coverageSport:p.coverageSport});
global.fetch=async(input,options={})=>{if(!sourceRole||raw.existsSync(failure))deny('GUARD_FETCH_SCOPE');try{return await tx.fetch(input,options,(url,opts)=>scope.run(true,()=>originalFetch(url,opts)));}catch(error){if(tx.active)tx.active.first=error;mark(error);throw error;}};
const server=require(path.join(p.sourceRoot,'lib/supabase-server')),service=server.supabaseServiceRequest;
server.supabaseServiceRequest=async function(url,options={}){if(!sourceRole||raw.existsSync(failure))deny('GUARD_SERVICE_SCOPE');try{return await tx.service(url,options,()=>service.call(this,url,options));}catch(error){mark(error);throw error;}};
}
function protectStream(stream){const write=stream.write.bind(stream);let pending=Buffer.alloc(0),discard=false;
 const emit=line=>write(privacy.contains(line)?'[guarded credential output redacted]\n':line);
 stream.write=function(chunk,encoding,callback){if(typeof encoding==='function')callback=encoding;const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(String(chunk),typeof encoding==='string'?encoding:'utf8');pending=Buffer.concat([pending,bytes]);let at;
  while((at=pending.indexOf(10))>=0){const line=pending.subarray(0,at+1);if(!discard)line.length>65536?write('[guarded oversized diagnostic omitted]\n'):emit(line);pending=pending.subarray(at+1);discard=false;}
  if(pending.length>65536){write('[guarded oversized diagnostic omitted]\n');pending=Buffer.alloc(0);discard=true;}if(callback)queueMicrotask(callback);return true;};
 return()=>{if(pending.length&&!discard)emit(pending);pending=Buffer.alloc(0);};}
const flushStdout=protectStream(process.stdout),flushStderr=protectStream(process.stderr);
for(const name of ['http','https'])for(const key of ['request','get'])if(!(eplMode&&name==='https'&&key==='get'))require('node:'+name)[key]=()=>deny('GUARD_NATIVE_HTTP');
for(const [name,keys]of [['net',['connect','createConnection']],['tls',['connect']],['dns',['lookup','resolve','resolve4','resolve6']]])for(const key of keys){const mod=require('node:'+name),original=mod[key];if(original)mod[key]=function(...args){if(control||eplMode||!scope.getStore())deny('GUARD_NATIVE_NETWORK');return original.apply(this,args);};}
for(const key of ['lookup','resolve','resolve4','resolve6']){const mod=require('node:dns').promises,original=mod[key];if(original)mod[key]=function(...args){if(control||eplMode||!scope.getStore())deny('GUARD_NATIVE_DNS');return original.apply(this,args);};}
const net=require('node:net'),connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){if(control||eplMode||!scope.getStore())deny('GUARD_NATIVE_SOCKET');return connect.apply(this,args);};
net.Server.prototype.listen=()=>deny('GUARD_LISTENER');require('node:dgram').createSocket=()=>deny('GUARD_DATAGRAM');
require('node:worker_threads').Worker=class{constructor(){deny('GUARD_WORKER');}};process.dlopen=()=>deny('GUARD_NATIVE_ADDON');
const nodeOptions=p.nodeOptions,policyHash=process.env.NS_SCORE_GUARD_POLICY_SHA256;
function eplEnvironment(env,command=argv){if(!eplMode)return;const validation=/^scripts\/(?:validate-|audit-|qa-|verify-)/.test(path.relative(root,path.resolve(root,command[0])));if(env.TMPDIR!==tmp||env.QUICK_RESULTS_REPORT!==path.join(run,'quick-results-report.json')||env.TZ!=='Australia/Sydney'||env.REFRESH_REPORT!==path.join(run,'refresh-report.json')&&!(validation&&env.REFRESH_REPORT===undefined))deny('GUARD_EPL_DIAGNOSTIC_ENV');const dir=env.FOOTBALL_DATA_RUN_DIR;if(dir!==path.join(tmp,'football-backup')&&!(validation&&dir===undefined))deny('GUARD_EPL_DIAGNOSTIC_ENV');if(env.GOLF_SOURCE_REPORT&&(!dir||env.GOLF_SOURCE_REPORT!==path.join(dir,'golf-source-report.json')))deny('GUARD_EPL_DIAGNOSTIC_ENV');if(env.GOLF_SOURCE_RUN_ID&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(env.GOLF_SOURCE_RUN_ID))deny('GUARD_EPL_DIAGNOSTIC_ENV');}
eplEnvironment(process.env);
function childCheck(command,args,options={}){if(raw.existsSync(failure))deny('GUARD_CHILD_AFTER_FAILURE');if(canonical(command)!==p.node||!Array.isArray(args)||!(eplMode?eplPolicy.child(args,p):p.childArgvs.some(a=>same(args,a)))||options.shell||options.detached||options.cwd&&path.resolve(options.cwd)!==root)deny('GUARD_CHILD_SCOPE');const env=options.env||process.env;if(env.NODE_OPTIONS!==nodeOptions||env.NS_SCORE_GUARD_POLICY!==policyPath||env.NS_SCORE_GUARD_POLICY_SHA256!==policyHash)deny('GUARD_CHILD_FENCE');for(const key of Object.keys(env))if(!p.environmentKeys.includes(key))deny('GUARD_CHILD_ENVIRONMENT');eplEnvironment(env,args);if(eplMode)eplDag.next(args);log({state:'child',argv:args});}
for(const name of ['spawnSync','execFileSync','spawn','execFile']){const original=cp[name];cp[name]=function(command,args,options){childCheck(command,args,options);try{const result=original.apply(this,arguments);if(name.endsWith('Sync')&&result?.status!==undefined&&result.status!==0)mark(Error('Canonical child failed: '+args[0]));return result;}catch(error){mark(error);throw error;}};}
for(const name of ['exec','execSync','fork'])cp[name]=()=>deny('GUARD_CHILD_COMMAND');
for(const name of ['writeFileSync','appendFileSync']){const original=fs[name];fs[name]=function(file,data,...args){const x=mutation(file,data,{append:name==='appendFileSync'});restoring.add(x);try{return original.call(this,file,data,...args);}finally{restoring.delete(x);}};}
for(const name of ['openSync','open']){const original=fs[name];fs[name]=function(file,flags,...args){const writing=typeof flags==='number'?flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_APPEND):flags!=='r'&&flags!=='rs';if(writing)mutation(file);if(name==='open'&&writing)deny('GUARD_ASYNC_WRITE_OPEN');const value=original.call(this,file,flags,...args);if(name==='openSync'&&writing)fds.set(value,canonical(file));return value;};}
for(const name of ['writeSync','writevSync','fchmodSync','fchownSync','ftruncateSync','fsyncSync','fdatasyncSync'])if(fs[name]){const original=fs[name];fs[name]=function(fd,...args){
 if(fd!==1&&fd!==2&&!fds.has(fd))deny('GUARD_UNKNOWN_WRITE_FD');
 if(name==='writevSync')deny('GUARD_UNSUPPORTED_MUTATION');
 if(name==='writeSync'&&(fd===1||fd===2)){
  let body;if(typeof args[0]==='string')body=Buffer.from(args[0],typeof args[2]==='string'?args[2]:'utf8');
  else{const value=args[0],offset=args[1]??0,length=args[2]??value.byteLength;if(!Number.isInteger(offset)||!Number.isInteger(length)||offset<0||length<0||offset+length>value.byteLength)deny('GUARD_FD_WRITE_ARGUMENTS');body=Buffer.from(value.buffer,value.byteOffset,value.byteLength).subarray(offset,offset+length);}
  (fd===1?process.stdout:process.stderr).write(body);return body.length;
 }
 const file=fds.get(fd);if(file){
  // Whole-body checked writeFileSync remains admitted, including rollback.
  // Direct descriptors cannot stream an unchecked or fragmented secret.
  if(name==='writeSync'&&!restoring.has(file))deny('GUARD_DIRECT_WRITE_FD');
  if(raw.existsSync(failure)&&!restoring.has(file)&&!file.startsWith(tmp+path.sep)&&!file.startsWith(run+path.sep))deny('GUARD_OPEN_FD_AFTER_FAILURE');
  if(name==='writeSync'){const length=typeof args[0]==='string'?Buffer.byteLength(args[0]):(args[2]??args[0].byteLength);if(fs.fstatSync(fd).size+length>fileCap(file))deny('GUARD_WRITE_SIZE');}
  if(name==='ftruncateSync'&&args[0]>fileCap(file))deny('GUARD_WRITE_SIZE');
 }return original.call(this,fd,...args);
};}
const close=fs.closeSync;fs.closeSync=function(fd){try{return close(fd);}finally{fds.delete(fd);}};
const mkdir=fs.mkdirSync;fs.mkdirSync=function(file,...args){const x=canonical(file);if(!directories.has(x)&&x!==tmp&&!x.startsWith(tmp+path.sep))deny('GUARD_DIRECTORY_SCOPE');return mkdir.call(this,file,...args);};
for(const name of ['mkdtempSync','unlinkSync','rmSync','rmdirSync','chmodSync','chownSync','utimesSync','truncateSync','createWriteStream']){const original=fs[name];if(original)fs[name]=function(file,...args){mutation(file,undefined,{remove:['unlinkSync','rmSync','rmdirSync'].includes(name)});return original.call(this,file,...args);};}
for(const name of ['renameSync','copyFileSync']){const original=fs[name];fs[name]=function(a,b,...args){mutation(a);mutation(b);return original.call(this,a,b,...args);};}
for(const name of ['symlink','symlinkSync','link','linkSync','write','writev','writeFile','appendFile','mkdir','mkdtemp','unlink','rm','rmdir','rename','copyFile','chmod','chown','utimes','truncate','fchmod','fchown','ftruncate','fsync','fdatasync'])if(fs[name])fs[name]=()=>deny('GUARD_UNSUPPORTED_MUTATION');
for(const name of ['open','writeFile','appendFile','mkdir','mkdtemp','unlink','rm','rmdir','rename','copyFile','symlink','link','chmod','chown','utimes','truncate'])if(fs.promises[name])fs.promises[name]=async()=>deny('GUARD_ASYNC_MUTATION');
require('node:module').syncBuiltinESMExports();
process.on('exit',code=>{if(eplMode&&code===0)try{if(!eplDag.complete())mark(Error('GUARD_EPL_DAG_INCOMPLETE'));}catch{mark(Error('GUARD_EPL_DAG_INCOMPLETE'));}for(const fd of fds.keys())try{raw.closeSync(fd);fds.delete(fd);}catch{};try{internalWrite(path.join(run,'transport-'+process.pid+'.json'),JSON.stringify({...tx.summary(),sourceRole,...(eplMode&&sourceRole?{childArgvs:eplDag.history()}:{}),control:control?control.summary():null})+'\n');log({state:'exit',code,ownedWriteDescriptorsRemaining:fds.size,sourceRole,readersOpen:tx.summary().readersOpen});flushStdout();flushStderr();}catch{}});
