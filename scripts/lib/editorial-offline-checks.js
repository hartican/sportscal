'use strict';
const path=require('node:path'),cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),crypto=require('node:crypto');
const CHECKS=Object.freeze([
  "scripts/validate-cancelled-preview-audit.js",
  "scripts/validate-mlb-quick-editorial.js"
]);
const OWNED_GUARD="'use strict';globalThis.NS_EDITORIAL_OFFLINE_GUARD=true;const deny=()=>{throw Error('NETWORK_FORBIDDEN: required offline editorial regression');};global.fetch=deny;for(const name of ['node:http','node:https']){const api=require(name);api.request=api.get=deny;}require('node:net').Socket.prototype.connect=deny;require('node:tls').connect=deny;\n";
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const APPROVED_GUARDS=new Set([
 digest(OWNED_GUARD),
 '42759c73c345314d4e8a49db86ecdb40c537e9a6587392898b106b2351c88480'
]);
function admit(options){
 if(!options.trim())return null;
 const match=options.match(/^--require(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s"']+))$/);
 const file=match&&(match[1]||match[2]||match[3]);
 if(!file||!path.isAbsolute(file))throw Error('Unapproved Node startup option or preload admission');
 let bytes,sourcePath;
 try{
  if(fs.lstatSync(file).isSymbolicLink())throw Error('symbolic preload');
  sourcePath=fs.realpathSync(file);
  const fd=fs.openSync(sourcePath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.size>65536)throw Error('preload size/type');bytes=fs.readFileSync(fd);}finally{fs.closeSync(fd);}
 }catch{throw Error('Unapproved preload path admission');}
 const sha256=digest(bytes);
 if(!APPROVED_GUARDS.has(sha256))throw Error('Unapproved preload hash admission');
 return {sourcePath,sha256,bytes};
}
function run(){
 // Authenticate bytes before dispatch; environment strings confer no authority.
 const admitted=admit(process.env.NODE_OPTIONS||'');
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-editorial-guards-'));
 try{
  fs.chmodSync(temporary,0o700);
  const capture=(name,bytes)=>{const file=path.join(temporary,name);fs.writeFileSync(file,bytes,{flag:'wx',mode:0o400});if(digest(fs.readFileSync(file))!==digest(bytes))throw Error('Preload capture mismatch');return file;};
  const preloads=[capture('owned.cjs',OWNED_GUARD)];
  if(admitted)preloads.push(capture('admitted.cjs',admitted.bytes));
  const env={};
  for(const key of ['PATH','HOME','TMPDIR','NODE_PATH','NS_MLB_TERSER_ENTRY'])if(process.env[key])env[key]=process.env[key];
  env.NS_EDITORIAL_OFFLINE_CHILD='1';
  env.NODE_OPTIONS=preloads.map(file=>'--require '+JSON.stringify(file)).join(' ');
  const reports=[];
  for(const script of CHECKS){
   const started=process.hrtime.bigint();
   const result=cp.spawnSync(process.execPath,[script],{cwd:path.resolve(__dirname,'../..'),env,encoding:'utf8',timeout:25000});
   if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
   reports.push({script,exit:result.status,elapsedSeconds:Number(process.hrtime.bigint()-started)/1e9,guardAdmission:admitted?{sourcePath:admitted.sourcePath,sha256:admitted.sha256}:null});
   if(result.error||result.status!==0)throw Error('Required offline editorial check failed: '+script+' '+(result.error?.message||result.status));
  }
  return reports;
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
module.exports={CHECKS,run,admit,OWNED_GUARD};
