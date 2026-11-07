#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function verifyProductionRelease(){
  const v=require('./lib/vercel-project');
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const live=v.project().targets?.production;
  if(live?.readyState!=='READY'||v.sha(live)!==sha)throw new Error('Production READY/SHA mismatch');
  const aliases=require('./lib/production-aliases').ensureProductionAliases(live);
  const checks=[];
  for(const file of ['index.html','service-worker.js','data/feed-meta.json','data/events.json','app-version.json']){
    const response=await fetch(`https://nothingsport.vercel.app/${file==='index.html'?'':file}?verify=${sha}-${Date.now()}`);
    if(!response.ok)throw new Error(`Production ${file}: ${response.status}`);
    const digest=hash(Buffer.from(await response.arrayBuffer()));
    if(digest!==hash(fs.readFileSync(file)))throw new Error(`Production bytes mismatch: ${file}`);
    checks.push({file,sha256:digest});
  }
  const unauthenticated=await fetch('https://nothingsport.vercel.app/api/feed');
  if(unauthenticated.status!==401)throw new Error(`Unauthenticated feed must reject: ${unauthenticated.status}`);
  const internalSources=[];
  for(const file of require('./seal-deployment-output').internalSources.map(source=>source.slice('data/'.length))){
    const response=await fetch(`https://nothingsport.vercel.app/data/${file}?verify=${sha}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(response.status!==404||!response.headers.get('cache-control')?.includes('no-store'))throw new Error(`Owner source must be closed: ${file} (${response.status})`);
    const body=await response.json();if(body.code!=='internal_artifact_unavailable'||Object.keys(body).some(key=>!['error','code'].includes(key)))throw new Error(`Owner source rejection disclosed unexpected content: ${file}`);
    const encoded='%'+file.charCodeAt(0).toString(16)+file.slice(1);
    const encodedResponse=await fetch(`https://nothingsport.vercel.app/data/${encoded}?verify=${sha}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(encodedResponse.status!==404)throw new Error(`Encoded owner source must be absent: ${file} (${encodedResponse.status})`);
    await encodedResponse.body?.cancel();
    internalSources.push({file,status:response.status,code:body.code,cacheControl:response.headers.get('cache-control'),encodedStatus:encodedResponse.status});
  }
  const runtimeEvidence=[];
  for(const file of require('./seal-deployment-output').runtimeEvidenceFiles){
    for(const pathname of [file,'%73'+file.slice(1)]){
      const response=await fetch(`https://nothingsport.vercel.app/${pathname}?verify=${sha}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(response.status!==404)throw new Error(`Frozen runtime evidence must remain server-only: ${file} (${response.status})`);
      await response.body?.cancel();
    }
    runtimeEvidence.push({file,status:404,encodedStatus:404});
  }
  const report={checkedAt:new Date().toISOString(),sha,deployment:v.summary(live),aliases,checks,unauthenticated:401,internalSources,runtimeEvidence};
  if(process.env.NS_DEPLOY_REPORT_DIR){fs.mkdirSync(process.env.NS_DEPLOY_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.NS_DEPLOY_REPORT_DIR,'production-verification.json'),JSON.stringify(report,null,2));}
  console.log(JSON.stringify(report,null,2));
}
const PRIMARY='https://nothingsport.app';
const BASELINE='037a6214c1a573b57298d3ea504de0b89e31d473';
const DEPLOYMENT='dpl_iMQryy8NccQZSzJnUc9i1HLdLYhB';
const PROJECT='prj_NAMl47QVLbPUfsMmap59JIpchOPD',TEAM='team_7deI3EHsjeMpMdPiaLSQZBwW';
const POLICY_HASH='78f7a1c46accaf56fb83ec1f4d8f5ecf98621a620807658c805870191297b103';
const FILES=Object.freeze(['index.html','service-worker.js','app-version.json']);
const FILE_MS=15000,CAPTURE_MS=60000,MAX_BODY=4194304,MAX_RECEIPT=16384,MAX_AGE=86400000;
class CaptureError extends Error{constructor(code){super(code);this.code=code;}}
function requireCapture(value,code){if(!value)throw new CaptureError(code);}
function exactKeys(value,keys){
  requireCapture(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),'binding_shape');
  requireCapture(JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort()),'binding_shape');
}
function checkedClock(value,now){
  requireCapture(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value),'binding_clock');
  const ms=Date.parse(value);requireCapture(Number.isFinite(ms)&&new Date(ms).toISOString()===value&&ms<=now&&now-ms<=MAX_AGE,'binding_clock');
}
function validateCaptureBinding(binding,wall){
  exactKeys(binding,['schemaVersion','baselineSha','baselineVersion','preparedForBaseSha','collectorSha','collectorTree','deployment','alias','publisherWindow']);
  requireCapture(binding.schemaVersion==='primary-baseline-capture-binding.v1'&&binding.baselineSha===BASELINE&&binding.baselineVersion==='609','binding_identity');
  for(const key of ['preparedForBaseSha','collectorSha','collectorTree'])requireCapture(typeof binding[key]==='string'&&/^[a-f0-9]{40}$/.test(binding[key]),'source_binding');
  exactKeys(binding.deployment,['id','state','releaseGitSha','origin','checkedAt']);
  requireCapture(binding.deployment.id===DEPLOYMENT&&binding.deployment.state==='READY'&&binding.deployment.releaseGitSha===BASELINE&&binding.deployment.origin===PRIMARY,'binding_identity');
  checkedClock(binding.deployment.checkedAt,wall);
  exactKeys(binding.alias,['domain','deploymentId','projectId','teamId','redirect','checkedAt']);
  requireCapture(binding.alias.domain==='nothingsport.app'&&binding.alias.deploymentId===DEPLOYMENT&&binding.alias.projectId===PROJECT&&binding.alias.teamId===TEAM&&binding.alias.redirect===null,'binding_identity');
  checkedClock(binding.alias.checkedAt,wall);
  exactKeys(binding.publisherWindow,['owner','held']);
  requireCapture(binding.publisherWindow.owner==='nsPUBLISH'&&binding.publisherWindow.held===true,'binding_identity');
}
function sourceRead(args){
  try{return execFileSync('git',args,{cwd:path.join(__dirname,'..'),encoding:null,stdio:['ignore','pipe','pipe'],timeout:2000,maxBuffer:MAX_BODY,env:{PATH:process.env.PATH,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}});}
  catch{throw new CaptureError('source_binding');}
}
function captureSources(binding,read,check){
  const text=args=>{const bytes=read(args);requireCapture(Buffer.isBuffer(bytes),'source_binding');return bytes.toString('utf8').trim();};
  requireCapture(text(['rev-parse','--verify','HEAD^{commit}'])===binding.collectorSha&&text(['rev-parse','--verify','HEAD^{tree}'])===binding.collectorTree,'source_binding');check();
  for(const sha of [BASELINE,binding.preparedForBaseSha])requireCapture(text(['rev-parse','--verify',sha+'^{commit}'])===sha,'source_binding');
  read(['merge-base','--is-ancestor',BASELINE,binding.preparedForBaseSha]);read(['merge-base','--is-ancestor',binding.preparedForBaseSha,binding.collectorSha]);check();
  const policyBytes=read(['show',BASELINE+':config/deployment-manifest.json']);
  requireCapture(Buffer.isBuffer(policyBytes)&&hash(policyBytes)===POLICY_HASH,'source_policy');
  let policy;try{policy=JSON.parse(policyBytes.toString('utf8'));}catch{throw new CaptureError('source_policy');}
  requireCapture(policy.schemaVersion==='deployment-manifest.v1'&&policy.compactJson===true&&Array.isArray(policy.preserveBytes)&&FILES.every(file=>policy.preserveBytes.includes(file)),'source_policy');
  let version;
  const sources=FILES.map(file=>{const bytes=read(['show',BASELINE+':'+file]);check();requireCapture(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=MAX_BODY,'source_binding');if(file==='app-version.json'){try{version=JSON.parse(bytes.toString('utf8'));}catch{throw new CaptureError('source_binding');}}return{file,bytes:bytes.length,sha256:hash(bytes)};});
  requireCapture(version&&version.version==='609','source_binding');check();return sources;
}
function stopCode(error){
  if(error instanceof CaptureError)return error.code;
  const code=error?.cause?.code||error?.code;
  if(['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(code))return'tls_verification_failed';
  return'transport_or_capture_failed';
}
function boundedDeadline(ms,controller,code,schedule,cancel){
  let reject;const promise=new Promise((_,fail)=>{reject=fail;});promise.catch(()=>{});
  const handle=schedule(()=>{const error=new CaptureError(code);controller.abort(error);reject(error);},ms);
  return{promise,close:()=>cancel(handle)};
}
function safeHeaders(response){
  const headers={};
  for(const key of ['content-type','content-encoding','cache-control','etag','age','x-vercel-id']){
    const value=response.headers?.get?.(key);
    headers[key]=typeof value==='string'&&value.length<=256&&/^[\x20-\x7e]*$/.test(value)?value:null;
  }
  return headers;
}
async function captureInstalledPrimaryBaseline({binding,read=sourceRead,request=(url,options)=>fetch(url,options),environment=process.env,now=Date.now,timer=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,captureId=crypto.randomUUID()}={}){
  const report={schemaVersion:'installed-primary-body-capture.v1',state:'STOP_BEFORE_READ',origin:PRIMARY,baselineSha:BASELINE,baselineVersion:'609',files:[],attempted:0,completeBodies:0,matchedFiles:0,remaining:[...FILES],readyForBaselineRecord:false,bodyEncoding:'Decoded entity bytes, not raw compressed/TLS wire bytes',contextTrust:'Publisher-supplied READY/alias/window binding, not independently queried or authenticated by this capture',releaseAcceptance:false};
  let whole,active,reader,wholeController;let began,wall,lastMono,lastWall;
  const clock=()=>{
    const mono=timer(),at=now();
    requireCapture(Number.isFinite(mono)&&Number.isSafeInteger(at)&&at>=0&&mono>=lastMono&&at>=lastWall&&Math.abs((at-wall)-(mono-began))<=1000,'capture_clock');
    lastMono=mono;lastWall=at;return{mono,at,iso:new Date(at).toISOString()};
  };
  const check=()=>{const value=clock();requireCapture(value.mono-began<CAPTURE_MS&&!wholeController.signal.aborted,'capture_timeout');return value;};
  try{
    began=lastMono=timer();wall=lastWall=now();requireCapture(Number.isFinite(began)&&Number.isSafeInteger(wall)&&wall>=0,'capture_clock');
    report.startedAt=new Date(wall).toISOString();
    requireCapture(environment.NODE_TLS_REJECT_UNAUTHORIZED!=='0'&&!environment.NODE_EXTRA_CA_CERTS&&!environment.SSL_CERT_FILE&&!environment.SSL_CERT_DIR&&!environment.NODE_OPTIONS,'tls_configuration');
    requireCapture(typeof request==='function'&&typeof read==='function'&&typeof captureId==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(captureId),'capture_configuration');
    validateCaptureBinding(binding,wall);
    wholeController=new AbortController();whole=boundedDeadline(CAPTURE_MS,wholeController,'capture_timeout',schedule,cancel);
    const sources=captureSources(binding,read,check);
    report.source={collectorSha:binding.collectorSha,collectorTree:binding.collectorTree,preparedForBaseSha:binding.preparedForBaseSha,policySha256:POLICY_HASH};
    report.binding={deployment:{...binding.deployment},alias:{...binding.alias},publisherWindow:{...binding.publisherWindow},normalizedSha256:hash(Buffer.from(JSON.stringify(binding)))};
    report.state='RUNNING';
    for(const source of sources){
      check();const started=clock();const urlPath=source.file==='index.html'?'/':'/'+source.file;
      const entry={file:source.file,urlPath,requestStartedAt:started.iso,headersObservedAt:null,bodyCompletedAt:null,status:null,servedBytes:null,servedSha256:null,gitSha256:source.sha256,expectedServedBytes:source.bytes,expectedServedSha256:source.sha256,partialEntityBytes:0,outcome:'started'};
      report.files.push(entry);report.attempted++;report.remaining=FILES.slice(report.attempted);
      const controller=new AbortController();active={controller,deadline:boundedDeadline(FILE_MS,controller,'file_timeout',schedule,cancel)};
      const signal=AbortSignal.any([wholeController.signal,controller.signal]);
      const fileCheck=()=>{const value=check();requireCapture(value.mono-started.mono<FILE_MS&&!controller.signal.aborted,'file_timeout');return value;};
      const wait=operation=>Promise.race([Promise.resolve().then(operation),active.deadline.promise,whole.promise]);
      const url=new URL(urlPath,PRIMARY);url.searchParams.set('baselineProof',BASELINE+'-'+captureId);
      const response=await wait(()=>request(url.href,{method:'GET',redirect:'manual',credentials:'omit',referrer:'',referrerPolicy:'no-referrer',cache:'no-store',headers:{Accept:source.file==='index.html'?'text/html':source.file==='app-version.json'?'application/json':'application/javascript','Cache-Control':'no-cache','Accept-Encoding':'identity'},signal}));
      requireCapture(Number.isInteger(response?.status)&&response.status>=100&&response.status<=599,'response_shape');entry.status=response.status;
      const headersAt=fileCheck();entry.headersObservedAt=headersAt.iso;entry.headers=safeHeaders(response);
      if(response.status!==200){try{Promise.resolve(response.body?.cancel?.()).catch(()=>{});}catch{}throw new CaptureError('http_status');}
      requireCapture(response.body&&typeof response.body.getReader==='function','response_shape');reader=response.body.getReader();const digest=crypto.createHash('sha256');
      for(;;){
        const part=await wait(()=>reader.read());fileCheck();requireCapture(part&&typeof part.done==='boolean','response_shape');if(part.done)break;
        requireCapture(part.value instanceof Uint8Array,'response_shape');
        requireCapture(part.value.byteLength<=MAX_BODY-entry.partialEntityBytes,'body_too_large');entry.partialEntityBytes+=part.value.byteLength;digest.update(part.value);
      }
      const bodyAt=fileCheck();entry.bodyCompletedAt=bodyAt.iso;entry.servedBytes=entry.partialEntityBytes;entry.servedSha256=digest.digest('hex');report.completeBodies++;
      requireCapture(entry.servedBytes===source.bytes,'body_length_mismatch');requireCapture(entry.servedSha256===source.sha256,'body_hash_mismatch');
      const finished=fileCheck();entry.elapsedMs=finished.mono-started.mono;entry.outcome='matched';report.matchedFiles++;
      reader.releaseLock?.();reader=null;active.deadline.close();controller.abort();active=null;
    }
    const finished=check();report.finishedAt=finished.iso;report.elapsedMs=finished.mono-began;report.state='PASS_THREE_PRIMARY_BODIES_NOT_RELEASE_ACCEPTANCE';report.readyForBaselineRecord=true;
  }catch(error){
    report.state='STOP_FIRST_FAILURE_NO_RETRY';report.readyForBaselineRecord=false;report.failure={code:stopCode(error),file:report.files.at(-1)?.file||null};
    if(report.files.length&&report.files.at(-1).outcome!=='matched')report.files.at(-1).outcome='failed';
    try{const ended=clock();report.finishedAt=ended.iso;report.elapsedMs=ended.mono-began;}catch{report.clockInvalid=true;}
  }finally{
    active?.controller.abort();active?.deadline.close();wholeController?.abort();whole?.close();
    if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}try{reader.releaseLock?.();}catch{}}
  }
  requireCapture(Buffer.byteLength(JSON.stringify(report))<=MAX_RECEIPT,'receipt_too_large');return report;
}
function readCaptureBinding(file){
  requireCapture(typeof file==='string'&&path.isAbsolute(file)&&!/[\0\r\n]/.test(file),'binding_input');let fd;
  try{
    const before=fs.lstatSync(file);requireCapture(before.isFile()&&!before.isSymbolicLink()&&before.size>0&&before.size<=MAX_RECEIPT&&before.nlink===1&&before.uid===process.getuid()&&(before.mode&0o022)===0,'binding_input');
    fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const after=fs.fstatSync(fd);requireCapture(after.ino===before.ino&&after.dev===before.dev&&after.size===before.size,'binding_input');
    const bytes=fs.readFileSync(fd),ended=fs.fstatSync(fd);requireCapture(bytes.length===before.size&&ended.ino===before.ino&&ended.dev===before.dev&&ended.size===before.size&&ended.mtimeMs===before.mtimeMs&&ended.ctimeMs===before.ctimeMs,'binding_input');return JSON.parse(bytes.toString('utf8'));
  }catch{throw new CaptureError('binding_input');}finally{if(fd!==undefined)fs.closeSync(fd);}
}
async function main({argv=process.argv.slice(2),environment=process.env,normal=verifyProductionRelease,capture=captureInstalledPrimaryBaseline,readBinding=readCaptureBinding,log=console.log}={}){
  if(argv.length===0)return normal();
  requireCapture(argv.length===1&&argv[0]==='--capture-installed-primary-baseline','invalid_arguments');
  const binding=readBinding(environment.NS_PRIMARY_BASELINE_BINDING);
  const report=await capture({binding,environment});log(JSON.stringify(report));
  if(report.state!=='PASS_THREE_PRIMARY_BODIES_NOT_RELEASE_ACCEPTANCE')process.exitCode=1;
  return report;
}
module.exports={main,verifyProductionRelease,captureInstalledPrimaryBaseline,validateCaptureBinding,readCaptureBinding,PRIMARY,BASELINE,DEPLOYMENT,PROJECT,TEAM,POLICY_HASH,FILES,FILE_MS,CAPTURE_MS,MAX_BODY,MAX_RECEIPT};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
