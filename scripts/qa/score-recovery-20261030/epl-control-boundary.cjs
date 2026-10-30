'use strict';
// Linux-owned HTTP/FS/process fixtures only. Actual mode cannot load this file.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https'),zlib=require('node:zlib'),{EventEmitter}=require('node:events');
const raw={read:fs.readFileSync.bind(fs),write:fs.writeFileSync.bind(fs),exists:fs.existsSync.bind(fs),readdir:fs.readdirSync.bind(fs)};
const p=JSON.parse(raw.read(process.env.NS_SCORE_GUARD_POLICY)),marker=process.env.NS_EPL_TEST_KEY;
if(p.mode!=='owned-control'||p.sourceProtocol!=='epl'||p.root===p.sourceRoot||p.controlBoundary!==__filename||!marker||marker.length<32)throw Error('EPL_OWNED_BOUNDARY_ONLY');
const source=path.resolve(p.sourceRoot),root=path.resolve(p.root),scenario=p.controlCase;
// Observe only this owned source process, before the guard loads. The monitor
// never handles an exception, reads its text/stack/getters, or changes its exit.
try{
 const expected=[path.join(source,'scripts/quick-results.js'),'--source=epl'];
 if(root!==source&&JSON.stringify(p.sourceArgv)===JSON.stringify(expected)&&JSON.stringify(process.argv.slice(1))===JSON.stringify(expected)&&path.isAbsolute(p.runDir)&&p.runDir===path.join(path.dirname(root),'run')){
  const open=fs.openSync.bind(fs),write=fs.writeSync.bind(fs),close=fs.closeSync.bind(fs),descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
  const nativeError=require('node:util').types.isNativeError;
  const file=path.join(p.runDir,'owned-source-exit.json'),guardCodes=JSON.parse(raw.read(path.join(__dirname,'epl-profile.json'))).exportGuardCodes;
  const codes=new Set(['MODULE_NOT_FOUND','ERR_REQUIRE_ESM','ERR_INVALID_ARG_TYPE','ENOENT','ENOTDIR','EISDIR','EACCES','EPERM','EBADF','ERR_MODULE_NOT_FOUND','ERR_PACKAGE_PATH_NOT_EXPORTED',...guardCodes]);
  const classes=[[TypeError.prototype,'TYPE_ERROR'],[ReferenceError.prototype,'REFERENCE_ERROR'],[SyntaxError.prototype,'SYNTAX_ERROR'],[RangeError.prototype,'RANGE_ERROR'],[Error.prototype,'ERROR']];
  let observed=false,errorClass='NONE',errorCode='NONE',attempted=false;
  process.on('uncaughtExceptionMonitor',error=>{
   if(observed)return;observed=true;errorClass='OTHER_ERROR_CLASS';errorCode='OTHER_ERROR_CODE';
   try{if(!nativeError(error))return;}catch{return;}
   try{const proto=prototype(error);errorClass=classes.find(([value])=>value===proto)?.[1]||'OTHER_ERROR_CLASS';}catch{}
   try{const code=descriptor(error,'code');errorCode=!code?'NONE':Object.hasOwn(code,'value')&&typeof code.value==='string'&&codes.has(code.value)?code.value:'OTHER_ERROR_CODE';}catch{}
  });
  process.on('exit',exitCode=>{
   if(attempted)return;attempted=true;let fd;
   try{
    if(!Number.isInteger(exitCode)||exitCode< -128||exitCode>255)return;
    const body=Buffer.from(JSON.stringify({schemaVersion:'owned-epl-source-exit.v1',exitCode,uncaughtExceptionObserved:observed,errorClass,errorCode})+'\n');
    if(body.length>1024)return;fd=open(file,'wx',0o600);
    for(let at=0;at<body.length;){const n=write(fd,body,at,body.length-at);if(!Number.isInteger(n)||n<=0||n>body.length-at)break;at+=n;}
   }catch{}finally{try{if(fd!==undefined)close(fd);}catch{}}
  });
 }
}catch{}
const map=file=>{const f=path.resolve(String(file));return ['data','feeds','assets/js'].some(dir=>f===source+'/'+dir||f.startsWith(source+'/'+dir+'/'))?root+f.slice(source.length):f;};
fs.readFileSync=function(file,...args){const f=map(file);return raw.read(f!==path.resolve(String(file))&&raw.exists(f)?f:file,...args);};
fs.readdirSync=function(file,...args){const f=map(file);return raw.readdir(f!==path.resolve(String(file))&&raw.exists(f)?f:file,...args);};
for(const key of['writeFileSync','appendFileSync','mkdirSync','mkdtempSync','unlinkSync','rmSync','rmdirSync','chmodSync','chownSync','utimesSync','truncateSync','openSync']){const original=fs[key];fs[key]=function(file,...args){if(scenario==='interrupted-rollback'&&key==='writeFileSync'&&map(file)===root+'/data/retained-only.json'&&raw.exists(path.join(p.runDir,'first-error.json'))){raw.write(map(file),'truncated necessary owned restore');for(;;){}}return original.call(this,map(file),...args);};}
for(const key of['renameSync','copyFileSync']){const original=fs[key];fs[key]=function(a,b,...args){return original.call(this,map(a),map(b),...args);};}
const fixture=JSON.parse(raw.read(path.join(__dirname,'epl-control-fixture.json'))),C=require('./epl-contract.cjs');let calls=0;const resources=[];
let nativeConnections=0;
for(const name of['http','net','tls','dns'])for(const key of['get','request','connect','createConnection','lookup','resolve'])if(require('node:'+name)[key])require('node:'+name)[key]=()=>{nativeConnections++;throw Error('OWNED_NETWORK_ESCAPE_REACHED');};
require('node:net').Socket.prototype.connect=()=>{nativeConnections++;throw Error('OWNED_SOCKET_ESCAPE_REACHED');};
require('node:https').request=()=>{nativeConnections++;throw Error('OWNED_REQUEST_ESCAPE_REACHED');};
global.fetch=()=>{nativeConnections++;throw Error('OWNED_FETCH_ESCAPE_REACHED');};

https.get=(url,options,callback)=>{
 calls++;const index=C.URLS.indexOf(url),req=new EventEmitter();let closed=false,hold=null;
 req.destroy=()=>{if(hold){clearInterval(hold);hold=null;}if(!closed){closed=true;queueMicrotask(()=>req.emit('close'));}return req;};
 if(scenario==='headers-timeout'&&index===0){hold=setInterval(()=>{},1000);return req;}
 queueMicrotask(()=>{
  const res=new EventEmitter();let responseClosed=false;res.destroy=()=>{if(!responseClosed){responseClosed=true;queueMicrotask(()=>res.emit('close'));}return res;};res.complete=true;
  let payload=index===4?structuredClone(fixture.table):{pageInfo:{page:index,numPages:4,pageSize:100,numEntries:380},content:structuredClone(fixture.rawFixtures.slice(index*100,index*100+100))};
  if(index===0){payload.content[0].status='C';payload.content[0].teams.forEach(row=>{row.score=0;});}
  if(scenario==='partial-collection'&&index===0)payload.content.pop();
  if(scenario==='wrong-identity'&&index===0)payload.content[1].id=999999;
  if(scenario==='reopened-final'&&index===0)payload.content[0].status='U';
  if(scenario==='both-resources-fail'&&index===0)payload.content.pop();
  if(scenario==='deferred-label'&&index===0){delete payload.content[0].teams[0].team.name;payload.content[1].status='C';payload.content[1].teams.forEach(row=>{row.score=0;});}
  if(scenario==='privacy'&&index===0)payload.unknown=Buffer.from(marker).toString('hex').toUpperCase();
  let body=Buffer.from(JSON.stringify(payload));
  if(scenario==='wire-overflow'&&index===0)body=Buffer.alloc(C.FIXTURE+1,32);
  if(scenario==='decoded-overflow'&&index===0)body=Buffer.alloc(C.FIXTURE+1,32);
  if(scenario==='invalid-json'&&index===0)body=Buffer.from('{invalid');
  if(scenario==='invalid-utf8'&&index===0)body=Buffer.from([255]);
  const encoding=['gzip','deflate','br'].includes(scenario)?scenario:scenario==='decoded-overflow'?'gzip':'identity';
  if(encoding==='gzip')body=zlib.gzipSync(body);if(encoding==='deflate')body=zlib.deflateSync(body);if(encoding==='br')body=zlib.brotliCompressSync(body);
  res.statusCode=(scenario==='table-failure'||scenario==='both-resources-fail')&&index===4?503:scenario==='redirect'&&index===0?302:200;
  res.headers={'content-type':'application/json','content-encoding':encoding,'content-length':String(body.length+(scenario==='partial-length'&&index===0?1:0))};
  resources.push(index);if(scenario==='body-timeout'&&index===0)hold=setInterval(()=>{},1000);callback(res);res.emit('data',body);if(scenario!=='body-timeout'||index!==0)res.emit('end');
 });return req;
};
function dirtyInterruptedRollback(){const file=root+'/data/retained-only.json';if(scenario!=='interrupted-rollback'||p.writeFiles.includes(file)||!p.rollbackHashes[file]||crypto.createHash('sha256').update(raw.read(file)).digest('hex')!==p.rollbackHashes[file])throw Error('OWNED_ROLLBACK_WITNESS_REQUIRED');raw.write(file,'necessary interrupted rollback witness');}
module.exports={mapPath:map,dirtyInterruptedRollback,summary:()=>({constructedHttpsRequests:calls,resources,nativeConnections})};

if(scenario==='forged-selector'){const cp=require('node:child_process'),spawn=cp.spawnSync;cp.spawnSync=function(command,args,options){if(args[0]==='scripts/publish-feed.js'){args=[...args.slice(0,-1),'--epl-updated-ids='+JSON.stringify({'feeds/incoming/events.json':['epl-2026-27-999999999'],'data/events.json':[]})];}return spawn.call(this,command,args,options);};}

if(scenario==='callback-escape'){const reader=require(path.join(source,'scripts/lib/epl-source-json.js')),original=reader.readJson;reader.readJson=(url,options={})=>original(url,{onObservation:row=>{require('node:net').connect(443,'outside.invalid');options.onObservation?.(row);}});}
