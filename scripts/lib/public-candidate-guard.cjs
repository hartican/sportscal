'use strict';
// Cooperative, source-hash-bound Node replay guard, not an OS sandbox. No live
// transport or managed credential is available in this first qualified slice.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),Module=require('node:module');
const original={};for(const name of ['readFileSync','writeFileSync','renameSync','mkdirSync','rmdirSync','realpathSync','existsSync','lstatSync'])original[name]=fs[name].bind(fs);
const config=process.env.NS_PUBLIC_CANDIDATE_CONFIG;
if(!config||!path.isAbsolute(config))throw Error('CANDIDATE_GUARD_CONFIG');
const cfg=JSON.parse(original.readFileSync(config,'utf8'));
const descriptors=new Map([[0,false],[1,true],[2,true]]);
const digest=file=>crypto.createHash('sha256').update(original.readFileSync(file)).digest('hex');
let internalIo=0;
function internal(operation){internalIo++;try{return operation();}finally{internalIo--;}}
function ledger(change){
 return internal(()=>{
 const lock=cfg.state+'.lock',until=Date.now()+500;
 for(;;){try{original.mkdirSync(lock);break;}catch(error){if(error.code!=='EEXIST'||Date.now()>until)throw Error('CANDIDATE_LEDGER_UNAVAILABLE');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}}
 try{const value=JSON.parse(original.readFileSync(cfg.state,'utf8'));const result=change(value);original.writeFileSync(cfg.state+'.'+process.pid,JSON.stringify(value),{mode:0o600});original.renameSync(cfg.state+'.'+process.pid,cfg.state);return result;}
 finally{original.rmdirSync(lock);}
 });
}
function fail(code){ledger(state=>{if(state.violations.length<16)state.violations.push(code);});throw Error(code);}
const within=(file,root)=>file===root||file.startsWith(root+path.sep);
function allowedFile(value,write=false){
 if(internalIo)return value;
 if(typeof value==='number'){if(!descriptors.has(value)||write&&!descriptors.get(value))return fail('CANDIDATE_FILE_DESCRIPTOR');return value;}
 let file;try{file=path.resolve(value instanceof URL?require('node:url').fileURLToPath(value):Buffer.isBuffer(value)?value.toString():value);}catch{return fail('CANDIDATE_FILE_PATH');}
 if(file.split(path.sep).some(piece=>piece==='.git'||/^\.env(?:\.|$)/.test(piece)))return fail('CANDIDATE_PRIVATE_FILE');
 if(!within(file,cfg.runtime)&&!within(file,cfg.workspace)&&!(!write&&within(file,cfg.dependencies)))return fail('CANDIDATE_PRIVATE_FILE');
 if(file===config||file===cfg.state||file.startsWith(cfg.state+'.')||write&&[config,cfg.state].some(control=>within(control,file)))return fail('CANDIDATE_CONTROL_FILE');
 let parent=file;while(!internal(()=>original.existsSync(parent))){const next=path.dirname(parent);if(next===parent)break;parent=next;}
 const resolved=internal(()=>original.realpathSync(parent))+(parent===file?'':path.sep+path.relative(parent,file));
 const runtime=within(resolved,cfg.runtime),workspace=within(resolved,cfg.workspace),dependency=within(resolved,cfg.dependencies);
 if(!runtime&&!workspace&&!(!write&&dependency))return fail('CANDIDATE_PRIVATE_FILE');
 if(write&&workspace){const relative=path.relative(cfg.workspace,resolved);if(!/^(?:data|feeds)(?:\/|$)/.test(relative)&&!/^assets\/js(?:\/|$)/.test(relative))return fail('CANDIDATE_IMMUTABLE_SOURCE_WRITE');}
 return file;
}
const entry=path.resolve(process.argv[1]||''),relative=path.relative(cfg.workspace,entry),args=process.argv.slice(2);
if(!cfg.frames.some(frame=>frame[0]===relative&&JSON.stringify(frame.slice(1))===JSON.stringify(args))||cfg.modules[entry]!==digest(entry))fail('CANDIDATE_COMMAND_UNQUALIFIED');
const admission=ledger(state=>{if(state.violations.length)return 'CANDIDATE_PREVIOUS_VIOLATION';if(state.frames.length>=64){state.violations.push('CANDIDATE_COMMAND_BUDGET');return 'CANDIDATE_COMMAND_BUDGET';}state.frames.push({file:relative,args});});
if(admission)throw Error(admission);
function outputBudget(bytes){const exceeded=ledger(state=>{state.outputBytes=(state.outputBytes||0)+bytes;if(state.outputBytes>2*1024*1024){if(!state.violations.includes('CANDIDATE_OUTPUT_BUDGET'))state.violations.push('CANDIDATE_OUTPUT_BUDGET');return true;}return false;});if(exceeded)throw Error('CANDIDATE_OUTPUT_BUDGET');}
for(const stream of [process.stdout,process.stderr]){const write=stream.write;stream.write=function(chunk,...rest){outputBudget(Buffer.byteLength(chunk,typeof rest[0]==='string'?rest[0]:undefined));return write.call(this,chunk,...rest);};}

// Reads can only reach public clone files, already pinned JS dependencies, or
// this invocation's private scratch. No original account/control/env path.
for(const name of ['readFileSync','readFile','readdirSync','readdir','statSync','stat','lstatSync','lstat','realpathSync','realpath','existsSync','accessSync','access','readlinkSync']){
 const fn=fs[name];if(fn)fs[name]=function(file,...rest){allowedFile(file);return fn.call(this,file,...rest);};
}
for(const name of ['writeFileSync','writeFile','appendFileSync','appendFile','mkdirSync','mkdir','mkdtempSync','mkdtemp','rmSync','rm','unlinkSync','unlink','rmdirSync','rmdir','chmodSync','chmod','utimesSync','utimes','createWriteStream']){
const fn=fs[name];if(fn)fs[name]=function(file,...rest){const existingDirectory=name.startsWith('mkdir')&&internal(()=>original.existsSync(file)&&original.lstatSync(file).isDirectory());allowedFile(file,!existingDirectory);if(name==='createWriteStream'&&rest[0]?.fd!==undefined)allowedFile(rest[0].fd,true);return fn.call(this,file,...rest);};
}
for(const name of ['renameSync','rename','copyFileSync','copyFile']){
 const fn=fs[name];fs[name]=function(from,to,...rest){allowedFile(from,name.startsWith('rename'));allowedFile(to,true);return fn.call(this,from,to,...rest);};
}
for(const name of ['symlinkSync','symlink','linkSync','link'])fs[name]=()=>fail('CANDIDATE_LINK_WRITE');
for(const name of ['cp','cpSync','watch','watchFile','opendir','opendirSync','openAsBlob','truncate','truncateSync','ftruncate','ftruncateSync','chown','chownSync','lchown','lchownSync','fchown','fchownSync','lchmod','lchmodSync','fchmod','fchmodSync'])if(fs[name])fs[name]=()=>fail('CANDIDATE_FILE_OPERATION_UNQUALIFIED');
for(const name of ['openSync','open']){
 const fn=fs[name];fs[name]=function(file,flags,...rest){const write=typeof flags==='number'?Boolean(flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT)):!/^r$/.test(flags);allowedFile(file,write);if(name==='openSync'){const fd=fn.call(this,file,flags,...rest);descriptors.set(fd,write);return fd;}const callback=rest.pop();return fn.call(this,file,flags,...rest,(error,fd)=>{if(!error)descriptors.set(fd,write);callback(error,fd);});};
}
const closeSync=fs.closeSync;fs.closeSync=function(fd){allowedFile(fd);const result=closeSync.call(this,fd);descriptors.delete(fd);return result;};
const close=fs.close;fs.close=function(fd,callback){allowedFile(fd);return close.call(this,fd,error=>{if(!error)descriptors.delete(fd);callback(error);});};
for(const name of ['read','readSync','readv','readvSync','fstat','fstatSync','fsync','fsyncSync','fdatasync','fdatasyncSync','futimes','futimesSync','write','writeSync','writev','writevSync']){const fn=fs[name];if(fn)fs[name]=function(fd,...rest){allowedFile(fd,/^(?:write|futimes)/.test(name));return fn.call(this,fd,...rest);};}
const createReadStream=fs.createReadStream;fs.createReadStream=function(file,options){if(options?.fd!==undefined)allowedFile(options.fd);else allowedFile(file);return createReadStream.call(this,file,options);};
for(const name of Object.keys(fs.promises)){
 const fn=fs.promises[name];if(typeof fn!=='function')continue;
 fs.promises[name]=async function(file,...rest){
  if(['readFile','readdir','stat','lstat','realpath','access','readlink'].includes(name))allowedFile(file);
  else return fail('CANDIDATE_ASYNC_FILE_OPERATION_UNQUALIFIED');
  return fn.call(this,file,...rest);
 };
}
if(process.loadEnvFile)process.loadEnvFile=()=>fail('CANDIDATE_PRIVATE_ENV');
globalThis.fetch=async(input,options={})=>{
 const url=typeof input==='string'||input instanceof URL?String(input):input?.url;
 if(url!==cfg.url||relative!=='scripts/refresh-nbl-schedule.js'){
  let parsed;try{parsed=new URL(url);}catch{}
  const rpc=parsed?.pathname.match(/^\/rest\/v1\/rpc\/(nothingsports_publish_(?:compact_scores|fixture_source(?:_report)?))$/)?.[1];
  if(rpc){ledger(state=>{state.blockedPublicationIntent={sourceScript:relative,rpc,disposition:'blocked-unqualified-public-payload-schema',payloadRetained:false,managedWrites:0};});return fail('CANDIDATE_SHARED_PUBLICATION_UNQUALIFIED@'+relative);}
  return fail('CANDIDATE_TRANSPORT_UNQUALIFIED@'+relative);
 }
 if((options.method||input?.method||'GET')!=='GET'||options.body||input?.body)return fail('CANDIDATE_MANAGED_MUTATION');
 for(const [key]of new Headers(options.headers||input?.headers||{}))if(!['accept'].includes(key))return fail('CANDIDATE_CREDENTIAL_HEADER');
 ledger(state=>{if(state.requests!==0||Date.now()>cfg.deadline){state.violations.push('CANDIDATE_REQUEST_BUDGET');return;}state.requests++;});
 const state=internal(()=>JSON.parse(original.readFileSync(cfg.state,'utf8')));if(state.violations.length)throw Error('CANDIDATE_REQUEST_BUDGET');
 return new Response(cfg.body,{status:200,headers:{'content-type':'application/json'}});
};
for(const name of ['node:http','node:https'])for(const method of ['get','request'])require(name)[method]=()=>fail('CANDIDATE_NATIVE_TRANSPORT_UNQUALIFIED');
require('node:net').Socket.prototype.connect=()=>fail('CANDIDATE_RAW_SOCKET');
require('node:net').Server.prototype.listen=()=>fail('CANDIDATE_RAW_SOCKET');
require('node:tls').connect=()=>fail('CANDIDATE_RAW_TLS');
for(const name of ['node:http2','node:dgram'])for(const key of Object.keys(require(name)))if(typeof require(name)[key]==='function')require(name)[key]=()=>fail('CANDIDATE_ALTERNATE_TRANSPORT');
require('node:worker_threads').Worker=class{constructor(){fail('CANDIDATE_WORKER');}};
process.kill=()=>fail('CANDIDATE_PROCESS_SIGNAL');
// No public process.binding entrypoint is qualified by this pure-JS slice.
process.binding=()=>fail('CANDIDATE_NATIVE_BINDING');

const load=Module._load;
const builtins=new Set(['assert','assert/strict','fs','fs/promises','path','os','crypto','util','util/types','vm','events','stream','stream/web','stream/promises','module','child_process','url','perf_hooks','buffer','querystring','zlib','http','https','http2','dgram','net','tls','worker_threads','diagnostics_channel','timers/promises']);
if(process.getBuiltinModule){const get=process.getBuiltinModule.bind(process);process.getBuiltinModule=name=>{if(!builtins.has(name.replace(/^node:/,'')))return fail('CANDIDATE_NATIVE_MODULE_UNQUALIFIED');return get(name);};}
process.dlopen=()=>fail('CANDIDATE_NATIVE_MODULE_UNQUALIFIED');
if(process._linkedBinding)process._linkedBinding=()=>fail('CANDIDATE_NATIVE_BINDING');
if(process.execve)process.execve=()=>fail('CANDIDATE_DESCENDANT_UNQUALIFIED');
Module._load=function(name,parent,...rest){
 const file=Module._resolveFilename(name,parent);
 if(typeof file==='string'&&!path.isAbsolute(file)&&!builtins.has(file.replace(/^node:/,'')))return fail('CANDIDATE_NATIVE_MODULE_UNQUALIFIED@'+file.replace(/[^a-z0-9:_/-]/gi,'').slice(0,80));
 if(typeof file==='string'&&path.isAbsolute(file)){
  allowedFile(file);
  if(/\.(?:js|cjs|mjs|node)$/.test(file)){
   const real=original.realpathSync(file),expected=cfg.modules[file]||cfg.dependencyHashes[real];
   if(!expected||/\.node$/.test(file)||digest(file)!==expected)return fail('CANDIDATE_MODULE_UNQUALIFIED');
  }
 }
 return load.call(this,name,parent,...rest);
};
// CJS alone cannot guard dynamic import(). Node24's synchronous resolution
// hook applies the same reviewed module boundary to both loader paths.
if(typeof Module.registerHooks!=='function')fail('CANDIDATE_NODE_RUNTIME_UNQUALIFIED');
Module.registerHooks({resolve(specifier,context,nextResolve){
 const resolved=nextResolve(specifier,context),url=resolved.url;
 if(url.startsWith('node:')){if(!builtins.has(url.slice(5)))fail('CANDIDATE_NATIVE_MODULE_UNQUALIFIED');}
 else if(url.startsWith('file:')){
  const file=require('node:url').fileURLToPath(url);allowedFile(file);
  if(/\.(?:js|cjs|mjs|node)$/.test(file)){const expected=cfg.modules[file]||cfg.dependencyHashes[original.realpathSync(file)];if(!expected||/\.node$/.test(file)||digest(file)!==expected)fail('CANDIDATE_MODULE_UNQUALIFIED');}
 }else fail('CANDIDATE_MODULE_UNQUALIFIED');
 return resolved;
}});
for(const name of ['exec','execSync','fork','spawn','execFile','execFileSync'])cp[name]=()=>fail('CANDIDATE_DESCENDANT_UNQUALIFIED');
const spawnSync=cp.spawnSync;
cp.spawnSync=function(command,argv,options={}){
 if(command!==process.execPath||!Array.isArray(argv)||argv[0]?.startsWith('-')||options.shell||options.detached)return fail('CANDIDATE_DESCENDANT_UNQUALIFIED');
 const file=path.resolve(options.cwd||process.cwd(),argv[0]),frame=[path.relative(cfg.workspace,file),...argv.slice(1)];
 if(!cfg.frames.some(allowed=>JSON.stringify(allowed)===JSON.stringify(frame))||cfg.modules[file]!==digest(file))return fail('CANDIDATE_COMMAND_UNQUALIFIED');
 for(const [key,value]of Object.entries(options.env||{}))if(value&&/SUPABASE|VERCEL|FOLLOW_SNAPSHOT|NS_EDITORIAL|NS_EPIC|TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ACCESS_KEY|SSH_AUTH|PROXY/i.test(key))return fail('CANDIDATE_DESCENDANT_CREDENTIAL');
 const remaining=cfg.deadline-Date.now();if(remaining<=0)return fail('CANDIDATE_PROCESS_DEADLINE');
 const env={PATH:process.env.PATH,LANG:process.env.LANG,TMPDIR:cfg.runtime,NS_PUBLIC_CANDIDATE_CONFIG:config,NODE_OPTIONS:'--require='+JSON.stringify(__filename)};
 for(const key of ['REFRESH_REPORT','QUICK_RESULTS_REPORT','FOOTBALL_DATA_RUN_DIR','GOLF_SOURCE_REPORT','GOLF_SOURCE_RUN_ID'])if(options.env?.[key]){if(key!=='GOLF_SOURCE_RUN_ID')allowedFile(options.env[key],true);env[key]=options.env[key];}
 return spawnSync.call(this,command,argv,{...options,cwd:cfg.workspace,env,shell:false,detached:false,timeout:Math.min(options.timeout||remaining,remaining),killSignal:'SIGKILL'});
};
// Record original observation time in this constructed replay; scheduling
// deadlines continue to use the real monotonic wall clock, not the replay date.
const RealDate=Date;global.Date=class extends RealDate{constructor(...values){super(...(values.length?values:[cfg.observedAt]));}};
Module.syncBuiltinESMExports();
