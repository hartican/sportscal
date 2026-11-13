#!/usr/bin/env node
'use strict';
// Manual preparation, never publication or database mutation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const PIN='67b4c7c9f219fe21fa4083a9b374fd4edb79adc1f46afc1f0fa8a256346f1aa6';
const MAX=32*1024*1024,MAX_ENVELOPE=48*1024*1024;
const MEMBERS=['casReport','casSql','selection','shellIdentity','sourcePatch','newFiles','sourceChanges','failure'];
const PATHS=new Set(['feeds/incoming/events.json','data/events.json','data/events.js','data/feed-meta.json',
'data/editorial-fixture-research.v1.json','data/editorial-knowledge.v1.json','data/editorial-maintenance-sources.v1.json',
'data/major-events.v1.json','data/marquee-candidates.v1.json','data/marquee-candidates.json','data/comms-sources.v1.json',
'assets/js/app-shell-runtime.js','data/code-inspector/manifest.json','data/code-inspector/f1.json',
'data/follow-schedule/f1.json','data/event-overviews.v1.json']);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const fingerprint=key=>sha(crypto.createPublicKey(key).export({type:'spki',format:'der'}));
const allowed=p=>PATHS.has(p)||/^data\/feed\/(?:manifest|page-\d+)\.json$/.test(p)||
/^data\/editorial-adaptive-report-\d{4}-\d{2}-\d{2}\.json$/.test(p);
function keys(v,want){assert(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...want].sort());}
function base64(s,max){
 assert(typeof s==='string'&&s.length<=Math.ceil(max/3)*4);
 assert(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s));
 const b=Buffer.from(s,'base64');assert(b.length<=max&&b.toString('base64')===s);return b;
}
function bindingValid(b){
 keys(b,['schema','recipientFingerprint','sourceSha','sourceTree','sourceRevision','researchDigest',
 'workflowImplementationSha','runId','runAttempt','purpose','capturedAt','payloadMembers','outcome','stage']);
 assert.equal(b.schema,'ns.editorial-private-review.v4');assert.equal(b.purpose,'editorial-private-review');
 for(const k of ['sourceSha','sourceTree','workflowImplementationSha'])assert(/^[a-f0-9]{40}$/.test(b[k]));
 for(const k of ['recipientFingerprint','sourceRevision','researchDigest'])assert(/^[a-f0-9]{64}$/.test(b[k]));
 assert(/^\d+$/.test(b.runId)&&/^[1-9]\d*$/.test(b.runAttempt));
 assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(b.capturedAt)&&Number.isFinite(Date.parse(b.capturedAt)));
 assert.deepEqual(b.payloadMembers,MEMBERS);assert(/^[a-z-]{1,48}$/.test(b.stage));
 assert(['prepared-review-required','failed-review-required'].includes(b.outcome));
}
const FAILURE_STAGES=['validate-inputs','transport-self-tests','verify-shell-before','canonical-prepare-control',
'read-authorised-controls','canonical-inventory','canonical-research','verify-shell-after','capture-source','capture-cas','return-packaging','verify-capacity-basis'];
const FAILURE_SUBSTAGES=['preparation-failure','list-child-failure','list-json-invalid','source-revision-mismatch',
'horizon-mismatch','target-absent','target-held','target-pending-edit','noncanonical-admission','source-capture-failure'];
const FAILURE_SIGNALS=['SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV','SIGPIPE','SIGBUS','SIGHUP','SIGQUIT'];
function validatePrivateFailure(value,binding){
 if(value===null){assert.equal(binding.outcome,'prepared-review-required');return;}
 keys(value,['stage','substage','reportMode','childExit','childSignal','listParsed','selectedCount',
 'sourceRevisionMatches','horizonMatches','targetId','targetPresent','listDiagnostic','returnCapture']);
 assert.equal(binding.outcome,'failed-review-required');assert.equal(value.stage,binding.stage);
 assert(FAILURE_STAGES.includes(value.stage)&&FAILURE_SUBSTAGES.includes(value.substage));
 assert(['none','list','research'].includes(value.reportMode));
 assert(value.childExit===null||Number.isInteger(value.childExit)&&value.childExit>=0&&value.childExit<=255);
 assert(value.childSignal===null||FAILURE_SIGNALS.includes(value.childSignal));
 assert(typeof value.listParsed==='boolean');
 assert(value.selectedCount===null||Number.isInteger(value.selectedCount)&&value.selectedCount>=0&&value.selectedCount<=1000);
 for(const field of ['sourceRevisionMatches','horizonMatches','targetPresent'])assert(value[field]===null||typeof value[field]==='boolean');
 assert(value.targetId===null||['evt_40','evt_41'].includes(value.targetId));
 if(value.returnCapture!==null){validateCaptureDiagnostic(value.returnCapture);assert.equal(value.reportMode,'none');assert.equal(value.listDiagnostic,null);}
 if(value.reportMode!=='list'){assert.equal(value.listDiagnostic,null);return;}
 const report=value.listDiagnostic;keys(report,['sourceRevision','operations','runReadouts']);
 assert(Array.isArray(report.operations)&&report.operations.length===0);
 assert(Array.isArray(report.runReadouts)&&report.runReadouts.length>0&&report.runReadouts.every(row=>row&&row.mode==='list'));
 assert(report.sourceRevision===null||typeof report.sourceRevision==='string'&&/^[a-f0-9]{64}$/.test(report.sourceRevision));
 assert(report.sourceRevision===binding.sourceRevision||report.sourceRevision===null||
  value.substage==='source-revision-mismatch'&&value.sourceRevisionMatches===false,
  'A differing LIST revision is private diagnostic evidence only.');
}
function privateFailure(error,stage,substage,flags){
 const safeBoolean=value=>typeof value==='boolean'?value:null;
 const exit=Number.isInteger(error?.preparationChildExit)?error.preparationChildExit:
 stage==='canonical-inventory'?flags.childExit:null;
 const signal=error?.preparationChildSignal??(stage==='canonical-inventory'?flags.childSignal:null);
 return {stage,substage,reportMode:'none',
 childExit:Number.isInteger(exit)&&exit>=0&&exit<=255?exit:null,
 childSignal:FAILURE_SIGNALS.includes(signal)?signal:null,
 listParsed:flags.listParsed===true,
 selectedCount:Number.isInteger(flags.selectedCount)&&flags.selectedCount>=0&&flags.selectedCount<=1000?flags.selectedCount:null,
 sourceRevisionMatches:safeBoolean(flags.sourceRevisionMatches),horizonMatches:safeBoolean(flags.horizonMatches),
 targetId:['evt_40','evt_41'].includes(flags.targetId)?flags.targetId:null,targetPresent:safeBoolean(flags.targetPresent),listDiagnostic:null,returnCapture:null};
}
function canonicalAdmissionIssue(card,eventId,expectedAliases,group){
 if(!card)return 'target-absent';
 if(card.schedule?.held===true)return 'target-held';
 if(card.pendingEdit===true)return 'target-pending-edit';
 if(card.id!==eventId||card.schedule?.held!==false||card.schedule?.protected!==false||
 card.schedule?.inWindow!==true||card.pendingEdit!==false||!group||group.event_id!==eventId||
 !Array.isArray(expectedAliases)||JSON.stringify(group.aliases)!==JSON.stringify(expectedAliases))return 'noncanonical-admission';
 // Membership came from the authenticated canonical --list invocation.
 // That owner admits required-copy/unpublished repairs independently of cadence.
 return null;
}
function payloadValid(p,b){
 keys(p,MEMBERS);validatePrivateFailure(p.failure,b);assert(p.casReport&&typeof p.casReport==='object'&&!Array.isArray(p.casReport));
 assert(Object.keys(p.casReport).every(k=>['sourceRevision','operations','runReadouts'].includes(k)));
 assert(Array.isArray(p.casReport.operations)&&p.casReport.operations.length<=1000);
 if(p.failure?.returnCapture){
  assert.equal(b.outcome,'failed-review-required');assert.equal(p.sourcePatch,'');assert.deepEqual(p.newFiles,[]);assert.deepEqual(p.sourceChanges,[]);
  assert.deepEqual(p.casReport,{sourceRevision:b.sourceRevision,operations:[]});assert.equal(p.casSql,'');
 }
 const listOnly=p.failure?.reportMode==='list';
 if(listOnly){assert.equal(p.casReport.operations.length,0);assert.equal(p.casSql,'');assert(!p.casReport.runReadouts,'LIST evidence belongs only in the private diagnostic.');}
 assert.equal(p.casReport.sourceRevision,b.sourceRevision,'Research/CAS reports must match the original binding.');
 for(const op of p.casReport.operations){
  keys(op,['eventId','expectedRevision','change']);
  assert(typeof op.eventId==='string'&&op.eventId.length<=240&&!['evt_84','major-match:nrl-finals-2026:grand-final'].includes(op.eventId));
  assert(Number.isInteger(op.expectedRevision)&&op.expectedRevision>=0);
  assert(op.change&&typeof op.change==='object'&&!Array.isArray(op.change));
  assert(Object.keys(op.change).every(k=>['last_error','last_checked_at','staged_copy','pending_copy','published_copy','published_git_sha'].includes(k)));
 }
 assert(typeof p.casSql==='string'&&typeof p.sourcePatch==='string');
 assert(Array.isArray(p.selection)&&p.selection.length<=1000);
 keys(p.shellIdentity,['before','after']);
 for(const identity of [p.shellIdentity.before,p.shellIdentity.after])if(identity!==null){
  keys(identity,['version','htmlVersion','workerVersion','cacheVersion','files']);
  assert(Array.isArray(identity.files)&&identity.files.length===3);
  for(const file of identity.files){keys(file,['path','bytes','sha256']);assert(['app-version.json','index.html','service-worker.js'].includes(file.path));assert(Number.isInteger(file.bytes)&&file.bytes>=0&&/^[a-f0-9]{64}$/.test(file.sha256));}
 }
 assert(Array.isArray(p.newFiles)&&p.newFiles.length<=128);
 assert(Array.isArray(p.sourceChanges)&&p.sourceChanges.length<=128);
 for(const f of p.newFiles){keys(f,['path','bodyBase64']);assert(allowed(f.path));base64(f.bodyBase64,MAX);}
 for(const f of p.sourceChanges){
  keys(f,['path','status','beforeBlob','afterSha256','bytes']);assert(allowed(f.path)&&['modified','new'].includes(f.status));
  assert(f.beforeBlob===null||/^[a-f0-9]{40}$/.test(f.beforeBlob));assert(/^[a-f0-9]{64}$/.test(f.afterSha256));
  assert(Number.isInteger(f.bytes)&&f.bytes>=0&&f.bytes<=MAX);
 }
}
const AAD_FIELDS=['schema','recipientFingerprint','sourceSha','sourceTree','sourceRevision','researchDigest',
'workflowImplementationSha','runId','runAttempt','purpose','capturedAt','payloadMembers','outcome','stage'];
function aadBytes(value){
 bindingValid(value);
 // Exact compact JSON array of ordered [field,value] pairs; UTF-8, no LF.
 return Buffer.from(JSON.stringify(AAD_FIELDS.map(field=>[field,value[field]])),'utf8');
}
function encryptBytes(bytes,b,pem){
 bindingValid(b);assert(bytes.length<=MAX);
 const pub=crypto.createPublicKey(pem);assert.equal(pub.asymmetricKeyType,'rsa');assert(pub.asymmetricKeyDetails.modulusLength>=3072);
 assert.equal(sha(pub.export({type:'spki',format:'der'})),b.recipientFingerprint);
 const key=crypto.randomBytes(32),nonce=crypto.randomBytes(12);
 try{
  const c=crypto.createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});
  c.setAAD(aadBytes(b));
  const ciphertext=Buffer.concat([c.update(bytes),c.final()]);
  return {schema:'ns.editorial-encrypted-return.v1',algorithm:'RSA-OAEP-SHA256+AES-256-GCM',aad:b,
   wrappedKey:crypto.publicEncrypt({key:pub,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64'),
   nonce:nonce.toString('base64'),tag:c.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
 }finally{key.fill(0);}
}
function seal(p,b,pem){payloadValid(p,b);const bytes=Buffer.from(JSON.stringify(p),'utf8');try{return encryptBytes(bytes,b,pem);}finally{bytes.fill(0);}}
// Synthetic CI receiver only. Root uses independent standard crypto with its own
// dispatch/expiry record and never executes this project helper on the Mac.
function open(text,privateKey,expected){
 assert(Buffer.byteLength(text)<=MAX_ENVELOPE);const e=JSON.parse(text);
 keys(e,['schema','algorithm','aad','wrappedKey','nonce','tag','ciphertext']);
 assert.equal(e.schema,'ns.editorial-encrypted-return.v1');assert.equal(e.algorithm,'RSA-OAEP-SHA256+AES-256-GCM');
 bindingValid(e.aad);assert.deepEqual(e.aad,expected);
 assert.equal(fingerprint(privateKey),e.aad.recipientFingerprint);
 const wrapped=base64(e.wrappedKey,1024),nonce=base64(e.nonce,12),tag=base64(e.tag,16),ciphertext=base64(e.ciphertext,MAX);
 assert.equal(nonce.length,12);assert.equal(tag.length,16);
 const key=crypto.privateDecrypt({key:privateKey,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},wrapped);
 let plain;
 try{
  assert.equal(key.length,32);const d=crypto.createDecipheriv('aes-256-gcm',key,nonce,{authTagLength:16});
  d.setAAD(aadBytes(e.aad));d.setAuthTag(tag);
  plain=Buffer.concat([d.update(ciphertext),d.final()]);const p=JSON.parse(plain.toString('utf8'));payloadValid(p,e.aad);return p;
 }finally{key.fill(0);if(plain)plain.fill(0);}
}
function selfTest(){
 const opts={modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}};
 const a=crypto.generateKeyPairSync('rsa',opts),other=crypto.generateKeyPairSync('rsa',opts);
 const b={schema:'ns.editorial-private-review.v4',recipientFingerprint:fingerprint(a.publicKey),sourceSha:'1'.repeat(40),
 sourceTree:'2'.repeat(40),sourceRevision:'3'.repeat(64),researchDigest:'4'.repeat(64),workflowImplementationSha:'1'.repeat(40),
 runId:'1',runAttempt:'1',purpose:'editorial-private-review',capturedAt:'2026-11-13T13:00:00.000Z',
 payloadMembers:MEMBERS,outcome:'prepared-review-required',stage:'capture-source'};
 const p={casReport:{sourceRevision:b.sourceRevision,operations:[]},casSql:'',selection:[],shellIdentity:{before:null,after:null},sourcePatch:'',newFiles:[],sourceChanges:[],failure:null};
 const e=seal(p,b,a.publicKey);assert.deepEqual(open(JSON.stringify(e),a.privateKey,b),p);
 const reordered={...e,aad:Object.fromEntries(Object.entries(e.aad).reverse())};
 assert.deepEqual(open(JSON.stringify(reordered),a.privateKey,b),p);
 for(const k of ['ciphertext','tag']){const bad=structuredClone(e),bytes=Buffer.from(bad[k],'base64');bytes[0]^=1;bad[k]=bytes.toString('base64');assert.throws(()=>open(JSON.stringify(bad),a.privateKey,b));}
 const aad=structuredClone(e);aad.aad.sourceSha='9'.repeat(40);assert.throws(()=>open(JSON.stringify(aad),a.privateKey,b));
 assert.throws(()=>open(JSON.stringify(e),other.privateKey,b));assert.throws(()=>open(JSON.stringify(e).slice(0,-1),a.privateKey,b));
 assert.throws(()=>open('x'.repeat(MAX_ENVELOPE+1),a.privateKey,b));
 assert.throws(()=>open(JSON.stringify({...e,unexpected:true}),a.privateKey,b));
 const unexpected=encryptBytes(Buffer.from(JSON.stringify({...p,unexpected:true})),b,a.publicKey);
 assert.throws(()=>open(JSON.stringify(unexpected),a.privateKey,b));
}
function writePrivate(file,bytes){
 const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 try{fs.writeFileSync(fd,bytes);}finally{fs.closeSync(fd);}
}
function readBounded(file,max=MAX){
 const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=max);
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const b=fs.readFileSync(fd);assert(b.length<=max);return b;}finally{fs.closeSync(fd);}
}
function readShellIdentity(){
 const files=['app-version.json','index.html','service-worker.js'].map(file=>{
  const bytes=readBounded(path.join(ROOT,file));return {path:file,bytes:bytes.length,sha256:sha(bytes),text:bytes.toString('utf8')};
 });
 let version=null;try{version=JSON.parse(files[0].text).version;}catch(_){}
 const html=[...files[1].text.matchAll(/<meta name="app-shell-version" content="(\d+)">/g)];
 const worker=[...files[2].text.matchAll(/^const SHELL_VERSION = "(\d+)";$/gm)];
 const cache=[...files[2].text.matchAll(/^const CACHE_NAME = "nothingsport-shell-v(\d+)";$/gm)];
 return {version,htmlVersion:html.length===1?html[0][1]:null,
 workerVersion:worker.length===1?worker[0][1]:null,cacheVersion:cache.length===1?cache[0][1]:null,
 files:files.map(({path,bytes,sha256})=>({path,bytes,sha256}))};
}
function assertShellIdentity(value){
 for(const field of ['version','htmlVersion','workerVersion','cacheVersion'])assert.equal(value[field],'613','Reserved shell identity changed; do not restamp.');
 assert.deepEqual(value.files,[
 {path:'app-version.json',bytes:18,sha256:'e166e53fb8bd478d7cb5437c8e54c3a984764cd430a36a863f6569365719357e'},
 {path:'index.html',bytes:997335,sha256:'2dec08dca491fd65e6ab1b15f72bed2dd23f547558f1c27eb736ef45ae75ee02'},
 {path:'service-worker.js',bytes:29224,sha256:'a5bf8f778c4450ebfe684947f3397ae59a6d140705c3ff2e66476defc8107957'},
 ],'Reviewed three-file shell bytes changed; preserve the conflict.');
}
function privateLocation(env=process.env){
 const base=fs.realpathSync(env.RUNNER_TEMP),runId=env.PREP_RUN_ID,runAttempt=env.PREP_RUN_ATTEMPT,sourceSha=env.INPUT_SOURCE_SHA;
 assert(path.isAbsolute(base)&&base!==ROOT&&!base.startsWith(ROOT+path.sep));
 assert(/^\d+$/.test(runId||'')&&/^[1-9]\d*$/.test(runAttempt||'')&&/^[a-f0-9]{40}$/.test(sourceSha||''));
 return {base,dir:path.join(base,'ns-editorial-private-'+runId+'-'+runAttempt),
 owner:{schema:'ns.editorial-job-owner.v1',runId,runAttempt,sourceSha}};
}
function cleanupPrivate(env=process.env){
 const location=privateLocation(env);
 let stat;try{stat=fs.lstatSync(location.dir);}catch(error){if(error.code==='ENOENT')return;throw error;}
 assert(stat.isDirectory()&&!stat.isSymbolicLink()&&(stat.mode&0o777)===0o700);
 assert(typeof process.getuid==='function'&&stat.uid===process.getuid());
 assert.equal(fs.realpathSync(location.dir),location.dir);assert.equal(path.dirname(location.dir),location.base);
 const marker=path.join(location.dir,'owner.json'),ownerStat=fs.lstatSync(marker);
 assert(ownerStat.isFile()&&!ownerStat.isSymbolicLink()&&(ownerStat.mode&0o777)===0o600&&ownerStat.uid===process.getuid());
 assert.deepEqual(JSON.parse(readBounded(marker,2048)),location.owner,'Only this exact run/attempt/source directory may be removed.');
 fs.rmSync(location.dir,{recursive:true,force:false});
}
function isolatedEnvironment(snapshot,report){
 const env={PATH:process.env.PATH,HOME:process.env.HOME,TZ:'Australia/Sydney',GIT_CONFIG_GLOBAL:'/dev/null',
 GIT_CONFIG_NOSYSTEM:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'};
 for(const k of ['TMPDIR','TMP','TEMP'])if(process.env[k])env[k]=process.env[k];
 if(snapshot)env.NS_EDITORIAL_CONTROL_SNAPSHOT=snapshot;if(report)env.NS_EDITORIAL_CHECK_REPORT=report;return env;
}
function captured(command,args,env,dir,label,observation){
 const r=spawnSync(command,args,{cwd:ROOT,env,encoding:'utf8',timeout:12*60*1000,maxBuffer:MAX,stdio:['ignore','pipe','pipe']});
 writePrivate(path.join(dir,label+'.stdout'),r.stdout||'');writePrivate(path.join(dir,label+'.stderr'),r.stderr||'');
 if(observation){observation.childExit=Number.isInteger(r.status)?r.status:null;observation.childSignal=FAILURE_SIGNALS.includes(r.signal)?r.signal:null;}
 if(r.status!==0){const error=Error('Private child failed.');error.preparationChildExit=Number.isInteger(r.status)?r.status:null;error.preparationChildSignal=FAILURE_SIGNALS.includes(r.signal)?r.signal:null;throw error;}return r.stdout;
}
function git(args,env,maxBuffer=MAX){
 const r=spawnSync('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],
 {cwd:ROOT,env,encoding:'utf8',timeout:30000,maxBuffer,stdio:['ignore','pipe','pipe']});
 assert.equal(r.status,0,'Read-only source inspection failed.');return r.stdout;
}
async function api(route,key,origin,body){
 assert(route==='/rest/v1/rpc/nothingsports_editorial_signals'||route==='/rest/v1/nothingsports_editorial_maintenance?select=*&order=event_id.asc&limit=1000');
 const r=await fetch(origin+route,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),
 headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',
 ...(body?{}:{Prefer:'count=exact',Range:'0-999','Range-Unit':'items'})},...(body?{body:JSON.stringify(body)}:{})});
 assert(r.ok,'Read-only control export unavailable.');
 const reader=r.body.getReader(),chunks=[];let size=0;
 for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>16*1024*1024){await reader.cancel();throw Error('Control export too large.');}chunks.push(Buffer.from(x.value));}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert(Array.isArray(value));return {value,range:r.headers.get('content-range')};
}

const CAPTURE_DIAGNOSTIC_LIMITS={entries:13418,pathCharacters:240,statusBytes:8*1024*1024,fileBytes:MAX,hashBudgetBytes:MAX,metadataBytes:16*1024*1024};
const DIAGNOSTIC_CAPACITY_BASIS={"schemaVersion":"ns.editorial-diagnostic-capacity-basis.v1","sourceCommit":"a43d2289e06ab8b3a372f6280e0ae23d51696956","sourceTree":"1918173fdcd07c68f429d84d6ec56963e5c77d81","cardinalities":{"trackedPaths":3833,"feedRows":1855,"finalsFixtures":20,"usOpenSubEvents":957,"majorEvents":8,"codeDefinitions":38,"postingSlotsPerEventUpper":2},"bound":{"sourceItemsUpper":4695,"newImagePathsUpper":9390,"feedPagePathsUpper":94,"fixedCompanionPathsUpper":25,"codeAndSchedulePathsUpper":76,"diagnosticEntries":13418},"pins":[{"path":"scripts/update-cards.js","mode":"100644","gitBlob":"42ff6b038156ad521f50cfb508654e7caf4d0464"},{"path":"scripts/adaptive-editorial.js","mode":"100644","gitBlob":"e180f4402cd5122a759f1b31c25bac81fa6b5c00"},{"path":"scripts/weekend-editorial.js","mode":"100644","gitBlob":"765ab9e47cae5ceca32574b43940401688e375dd"},{"path":"scripts/apply-fixture-research.js","mode":"100644","gitBlob":"621b644e680710e6957df06fabec668dee6ffd8b"},{"path":"scripts/apply-editorial-narratives.js","mode":"100644","gitBlob":"c5d49e67afb613127b7a57ec40fa9786647aa33b"},{"path":"scripts/build-app-shell-runtime.js","mode":"100644","gitBlob":"e8c47aadce5e83561b58b3cbdd9f7c26fbaabb07"},{"path":"scripts/build-deferred-sports-ui.js","mode":"100644","gitBlob":"ecb73b1375debf135c4e76fd2d4c4006b1d1ec7c"},{"path":"scripts/build-paged-feed.js","mode":"100644","gitBlob":"934278e3027dd7aeecc41dec1de1f17137172241"},{"path":"scripts/build-code-inspector.js","mode":"100644","gitBlob":"c650406967e94d88dbc133036582ba939a55cb02"},{"path":"scripts/build-chat-fixture-registry.js","mode":"100644","gitBlob":"5a3af75d3f04b297723b15d43431c22bee282353"},{"path":"scripts/qa-storyline-spoilers.js","mode":"100644","gitBlob":"6d185bf6ca3855f5d71bd8d0cc3d3e6352f4c0cf"},{"path":"scripts/validate-feed.js","mode":"100644","gitBlob":"b0a8dd803d27a018e5e7e740a36e415027da1b2d"},{"path":"scripts/build-marquee-candidates.js","mode":"100644","gitBlob":"c6e0e3e70c060cf522d0dfdf4ad6e7c70fa27116"},{"path":"lib/comms-content.js","mode":"100644","gitBlob":"eb8e23266e5a488e97429d4a8ce6dd78022b15f0"},{"path":"lib/competition-fixtures.js","mode":"100644","gitBlob":"b5537384ced31e8e46e2be8093df788ff41afb4e"},{"path":"config/fixture-identity.js","mode":"100644","gitBlob":"887d3ba504bcf4cedec1b45d3c4f27f67c087283"},{"path":"config/canonical-sports-taxonomy.js","mode":"100644","gitBlob":"6242b62a87999aa66d6d76eec7bbd68811b85b6b"},{"path":"data/events.json","mode":"100644","gitBlob":"21b741aa1729a6290bbb1a3c2e25a6560c464e41"},{"path":"data/major-events.v1.json","mode":"100644","gitBlob":"a0d735ff0adea0714a2d64ad87f3f025b7c7b069"},{"path":"data/canonical/afl-nrl-finals-2026.json","mode":"100644","gitBlob":"2537710a7e14b30fd06718d981e648f515d10a20"},{"path":"data/code-inspector/manifest.json","mode":"100644","gitBlob":"f6913e7778f7a7fb02d1dada6543256f6d26d6ad"}]};
const DIAGNOSTIC_CAPACITY_BASIS_SHA256=sha(JSON.stringify(DIAGNOSTIC_CAPACITY_BASIS));

function verifyDiagnosticBasisRows(rows){
 assert(Array.isArray(rows)&&rows.length===DIAGNOSTIC_CAPACITY_BASIS.cardinalities.trackedPaths,'Diagnostic basis changed; recompute the reviewed capacity.');
 const byPath=new Map();for(const row of rows){
  keys(row,['path','mode','gitBlob']);assert(typeof row.path==='string'&&row.path&&!byPath.has(row.path));
  assert(/^[0-7]{6}$/.test(row.mode)&&/^[a-f0-9]{40}$/.test(row.gitBlob));byPath.set(row.path,row);
 }
 for(const pin of DIAGNOSTIC_CAPACITY_BASIS.pins){const actual=byPath.get(pin.path);assert(actual&&actual.mode===pin.mode&&actual.gitBlob===pin.gitBlob,'Diagnostic source/data basis changed; recompute before external work.');}
 return DIAGNOSTIC_CAPACITY_BASIS_SHA256;
}
function verifyDiagnosticBasis(env){
 const raw=git(['ls-tree','-r','-z','--full-tree','HEAD'],env,2*1024*1024);assert(raw.endsWith('\0'));
 const rows=raw.slice(0,-1).split('\0').map(line=>{
  const tab=line.indexOf('\t'),match=/^([0-7]{6}) (?:blob|commit) ([a-f0-9]{40})$/.exec(line.slice(0,tab));
  assert(tab>0&&match,'Invalid capacity basis metadata.');return {path:line.slice(tab+1),mode:match[1],gitBlob:match[2]};
 });return verifyDiagnosticBasisRows(rows);
}

const DIAGNOSTIC_EXTRA_PATHS=new Set(['data/chat-fixtures.v1.json','app-version.json','index.html','service-worker.js',
'assets/js/calendar-sync-ui.js','assets/js/account-awareness-runtime.js','assets/js/match-centre-ui.js',
'assets/js/all-sports-ui.js','assets/js/milestone-alerts-ui.js','assets/js/app-update.js','assets/js/notifications-inbox.js']);
const safeRelative=file=>typeof file==='string'&&file.length<=CAPTURE_DIAGNOSTIC_LIMITS.pathCharacters&&
 /^[A-Za-z0-9_.\/-]+$/.test(file)&&!path.isAbsolute(file)&&file.split('/').every(part=>part&&part!=='.'&&part!=='..');
const diagnosticGenerated=file=>allowed(file)||DIAGNOSTIC_EXTRA_PATHS.has(file)||
 /^data\/(?:code-inspector|follow-schedule)\/[a-z0-9-]+\.json$/.test(file)||
 /^assets\/marquee\/marquee_[a-f0-9]{16}-[a-f0-9]{12}\.jpg$/.test(file);
function strictSourceEntry(row,count){
 assert([' M','??'].includes(row.slice(0,2)),'Unexpected staged, renamed or deleted source.');
 const file=row.slice(3);assert(allowed(file),'Changed source outside reviewed allowlist.');assert(count<128);return file;
}
function captureContext(readStatus,{entries=CAPTURE_DIAGNOSTIC_LIMITS.entries,statusBytes=CAPTURE_DIAGNOSTIC_LIMITS.statusBytes}={}){
 assert(Number.isInteger(entries)&&entries>=1&&entries<=CAPTURE_DIAGNOSTIC_LIMITS.entries);
 assert(Number.isInteger(statusBytes)&&statusBytes>=1&&statusBytes<=CAPTURE_DIAGNOSTIC_LIMITS.statusBytes);
 return {readStatus,limits:{entries,statusBytes},statusAttempted:false,statusReadComplete:false,totalChangedCount:null,
 truncated:false,failureCode:null,rows:[],entries:[],hashBudgetChargedBytes:0};
}
function captureRows(context){
 if(!context.statusAttempted){
  context.statusAttempted=true;
  try{
   const raw=context.readStatus();assert(typeof raw==='string'&&Buffer.byteLength(raw)<=context.limits.statusBytes);
   assert(raw===''||raw.endsWith('\0'));const tokens=raw.split('\0');tokens.pop();
   for(let index=0;index<tokens.length;index++){
    if(context.entries.length>=context.limits.entries){context.truncated=true;context.failureCode='status-limit';break;}
    const row=tokens[index],status=row.slice(0,2),file=row.slice(3);
    if(row[2]!==' '||!/^[ MADRCUTU?!]{2}$/.test(status)){context.failureCode='status-invalid';context.truncated=true;break;}
    let originalPath=null;
    if(/[RC]/.test(status)){originalPath=tokens[++index];}
    if(!safeRelative(file)||(originalPath!==null&&!safeRelative(originalPath))){context.failureCode='path-invalid';context.truncated=true;break;}
    context.rows.push(row);context.entries.push({path:file,originalPath,status,beforeBlob:null,afterKind:'unknown',
     afterBytes:null,afterSha256:null,hashStatus:'not-read'});
   }
   if(!context.truncated){context.statusReadComplete=true;context.totalChangedCount=context.entries.length;}
  }catch(_){context.failureCode='status-unavailable';context.truncated=true;}
 }
 assert(context.statusReadComplete,'Changed output status is incomplete.');return context.rows;
}
function observeDiagnosticEntry(entry,remaining,io=fs){
 assert(safeRelative(entry.path));const empty={afterKind:'unknown',afterBytes:null,afterSha256:null,hashStatus:'not-read',hashBudgetChargedBytes:0};
 if(!diagnosticGenerated(entry.path))return empty;
 const absolute=path.join(ROOT,entry.path);let stat;
 try{if(io.realpathSync(path.dirname(absolute))!==path.dirname(absolute))return empty;}catch(_){return {...empty,hashStatus:'read-failed'};}
 try{stat=io.lstatSync(absolute);}catch(error){return error.code==='ENOENT'?{...empty,afterKind:'absent',hashStatus:'deleted'}:{...empty,hashStatus:'read-failed'};}
 if(stat.isSymbolicLink())return {...empty,afterKind:'symlink'};
 if(!stat.isFile())return {...empty,afterKind:'other'};
 const bytes=Number.isSafeInteger(stat.size)&&stat.size>=0?stat.size:null;
 if(bytes===null||bytes>CAPTURE_DIAGNOSTIC_LIMITS.fileBytes||bytes>remaining)return {...empty,afterKind:'regular',afterBytes:bytes,hashStatus:'budget-exceeded'};
 let fd;
 try{
  assert.equal(io.realpathSync(absolute),absolute,'Diagnostic output escaped the exact checkout.');
  fd=io.openSync(absolute,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const opened=io.fstatSync(fd);assert(opened.isFile()&&opened.dev===stat.dev&&opened.ino===stat.ino&&opened.size===bytes);
  const hash=crypto.createHash('sha256'),buffer=Buffer.alloc(64*1024);let read=0,size;
  while((size=io.readSync(fd,buffer,0,Math.min(buffer.length,bytes-read+1),null))>0){read+=size;assert(read<=bytes);hash.update(buffer.subarray(0,size));}
  const after=io.fstatSync(fd);assert(read===bytes&&after.dev===opened.dev&&after.ino===opened.ino&&
   after.size===opened.size&&after.mtimeMs===opened.mtimeMs&&after.ctimeMs===opened.ctimeMs);
  return {afterKind:'regular',afterBytes:bytes,afterSha256:hash.digest('hex'),hashStatus:'verified',hashBudgetChargedBytes:bytes};
 }catch(_){return {...empty,afterKind:'regular',afterBytes:bytes,hashStatus:'read-failed',hashBudgetChargedBytes:fd===undefined?0:bytes};}
 finally{if(fd!==undefined)io.closeSync(fd);}
}
function captureInventory(context,observe=observeDiagnosticEntry){
 try{captureRows(context);}catch(_){}
 for(const entry of context.entries){
  if(entry.hashStatus==='verified')continue;
  try{
   const result=observe(entry,CAPTURE_DIAGNOSTIC_LIMITS.hashBudgetBytes-context.hashBudgetChargedBytes);
   assert(Number.isInteger(result.hashBudgetChargedBytes)&&result.hashBudgetChargedBytes>=0&&
    context.hashBudgetChargedBytes+result.hashBudgetChargedBytes<=CAPTURE_DIAGNOSTIC_LIMITS.hashBudgetBytes);
   context.hashBudgetChargedBytes+=result.hashBudgetChargedBytes;
   const {hashBudgetChargedBytes,...metadata}=result;Object.assign(entry,metadata);
  }catch(_){context.hashBudgetChargedBytes=CAPTURE_DIAGNOSTIC_LIMITS.hashBudgetBytes;Object.assign(entry,{afterKind:'unknown',afterBytes:null,afterSha256:null,hashStatus:'read-failed'});}
 }
 return {capacityBasisSha256:DIAGNOSTIC_CAPACITY_BASIS_SHA256,statusReadComplete:context.statusReadComplete,totalChangedCount:context.totalChangedCount,
  returnedEntryCount:context.entries.length,truncated:context.truncated,hashBudgetChargedBytes:context.hashBudgetChargedBytes,
  entries:context.entries.map(entry=>({...entry}))};
}
function validateCaptureDiagnostic(value){
 keys(value,['phase','failureCode','sourceDisposition','casDisposition','capacityBasisSha256','statusReadComplete','totalChangedCount',
 'returnedEntryCount','truncated','hashBudgetChargedBytes','entries','readout']);
 assert(['capture-source','capture-cas'].includes(value.phase));
 assert(['strict-source-rejection','cas-capture-rejection','status-limit','status-invalid','path-invalid','status-unavailable'].includes(value.failureCode));
 assert.equal(value.sourceDisposition,'omitted-on-capture-failure');assert.equal(value.casDisposition,'omitted-on-capture-failure');
 assert.equal(value.capacityBasisSha256,DIAGNOSTIC_CAPACITY_BASIS_SHA256);
 assert(typeof value.statusReadComplete==='boolean'&&typeof value.truncated==='boolean');
 assert(value.totalChangedCount===null||Number.isInteger(value.totalChangedCount)&&value.totalChangedCount>=0&&value.totalChangedCount<=CAPTURE_DIAGNOSTIC_LIMITS.entries);
 assert(Number.isInteger(value.returnedEntryCount)&&value.returnedEntryCount>=0&&value.returnedEntryCount<=CAPTURE_DIAGNOSTIC_LIMITS.entries);
 assert(Array.isArray(value.entries)&&value.entries.length===value.returnedEntryCount);
 assert(Number.isInteger(value.hashBudgetChargedBytes)&&value.hashBudgetChargedBytes>=0&&value.hashBudgetChargedBytes<=CAPTURE_DIAGNOSTIC_LIMITS.hashBudgetBytes);
 if(value.statusReadComplete){assert.equal(value.totalChangedCount,value.returnedEntryCount);assert.equal(value.truncated,false);}
 else {assert.equal(value.totalChangedCount,null);assert.equal(value.truncated,true);}
 const paths=new Set();for(const entry of value.entries){
  keys(entry,['path','originalPath','status','beforeBlob','afterKind','afterBytes','afterSha256','hashStatus']);
  assert(safeRelative(entry.path)&&!paths.has(entry.path));paths.add(entry.path);
  assert(entry.originalPath===null||safeRelative(entry.originalPath));assert(typeof entry.status==='string'&&/^[ MADRCUTU?!]{2}$/.test(entry.status));
  assert.equal(entry.originalPath!==null,/[RC]/.test(entry.status));
  assert(entry.beforeBlob===null||typeof entry.beforeBlob==='string'&&/^[a-f0-9]{40}$/.test(entry.beforeBlob));
  assert(['regular','absent','symlink','other','unknown'].includes(entry.afterKind));
  assert(entry.afterBytes===null||Number.isSafeInteger(entry.afterBytes)&&entry.afterBytes>=0);
  assert(['verified','not-read','deleted','read-failed','budget-exceeded'].includes(entry.hashStatus));
  if(entry.hashStatus==='verified'){assert.equal(entry.afterKind,'regular');assert(Number.isInteger(entry.afterBytes)&&entry.afterBytes<=MAX);assert(typeof entry.afterSha256==='string'&&/^[a-f0-9]{64}$/.test(entry.afterSha256));}
  else {assert.equal(entry.afterSha256,null);}
  if(entry.hashStatus==='deleted'){assert.equal(entry.afterKind,'absent');assert.equal(entry.afterBytes,null);}
  if(entry.afterKind!=='regular')assert.notEqual(entry.hashStatus,'verified');
 }
 validateReadoutDiagnostic(value.readout);assert(Buffer.byteLength(JSON.stringify(value))<=CAPTURE_DIAGNOSTIC_LIMITS.metadataBytes);
}

const READOUT_KEYS=['schemaVersion','mode','startedAt','stage','status','sourceRevision','windowCards','selectedCards',
'dueCards','changedCards','deferredCards','successfulChecks','preparedUpdates','directPersistedUpdates',
'connectorCommitObserved','controlMode','externalResearchRuntimeMs','externalModelTokens','cashCostAUD','finishedAt','cliElapsedMs'];
function validateReadoutDiagnostic(value){
 if(value===null)return;keys(value,['sourceRevision','mode','runReadouts','omittedOperationCount']);
 assert(value.sourceRevision===null||typeof value.sourceRevision==='string'&&/^[a-f0-9]{64}$/.test(value.sourceRevision));assert(['list','research'].includes(value.mode));
 assert(value.omittedOperationCount===null||Number.isInteger(value.omittedOperationCount)&&value.omittedOperationCount>=0&&value.omittedOperationCount<=1000);
 assert(Array.isArray(value.runReadouts)&&value.runReadouts.length>0&&value.runReadouts.length<=32);
 for(const row of value.runReadouts){
  keys(row,READOUT_KEYS);assert.equal(row.schemaVersion,'editorial-run-readout.v1');assert.equal(row.mode,value.mode);
  assert(['inventory','research','checks','build','complete'].includes(row.stage));assert(['failed','completed'].includes(row.status));
  for(const field of ['startedAt','finishedAt'])assert(typeof row[field]==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row[field])&&Number.isFinite(Date.parse(row[field])));
  assert(row.sourceRevision===null||typeof row.sourceRevision==='string'&&/^[a-f0-9]{64}$/.test(row.sourceRevision));
  for(const field of ['windowCards','selectedCards','dueCards','changedCards','deferredCards','successfulChecks','preparedUpdates','directPersistedUpdates'])assert(row[field]===null||Number.isInteger(row[field])&&row[field]>=0&&row[field]<=10000);
  assert(typeof row.connectorCommitObserved==='boolean'&&['snapshot-preparation','direct-service'].includes(row.controlMode));
  for(const field of ['externalResearchRuntimeMs','externalModelTokens','cashCostAUD'])assert.equal(row[field],null);
  assert(Number.isSafeInteger(row.cliElapsedMs)&&row.cliElapsedMs>=0);
 }
 assert(Buffer.byteLength(JSON.stringify(value))<=128*1024);
}
function readoutDiagnostic(report,mode){
 if(!report)return null;
 const value={sourceRevision:report.sourceRevision??null,mode,runReadouts:report.runReadouts,
  omittedOperationCount:Array.isArray(report.operations)?report.operations.length:null};
 try{validateReadoutDiagnostic(value);return value;}catch(_){return null;}
}


function composeReviewReturn(base,{primary,flags,context,captureSource,captureCAS,report,mode,observe=observeDiagnosticEntry}){
 let phase='capture-source';
 try{const source=captureSource();phase='capture-cas';const casSql=captureCAS();return {...base,...source,casSql,failure:primary};}
 catch(_){
  const failure=primary||privateFailure(null,phase,'source-capture-failure',flags);
  const inventory=captureInventory(context,observe);
  return {...base,casReport:{sourceRevision:base.casReport.sourceRevision,operations:[]},casSql:'',sourcePatch:'',newFiles:[],sourceChanges:[],
   failure:{...failure,reportMode:'none',listDiagnostic:null,returnCapture:{phase,
    failureCode:context.failureCode||(phase==='capture-source'?'strict-source-rejection':'cas-capture-rejection'),
    sourceDisposition:'omitted-on-capture-failure',casDisposition:'omitted-on-capture-failure',...inventory,
    readout:readoutDiagnostic(report,mode)}}};
 }
}

function sourceChanges(env,context){
 const rows=captureRows(context);
 const sourceChanges=[],newFiles=[],tracked=[];
 for(const row of rows){
  const file=strictSourceEntry(row,sourceChanges.length);
  const bytes=readBounded(path.join(ROOT,file)),fresh=row.startsWith('??');
  sourceChanges.push({path:file,status:fresh?'new':'modified',beforeBlob:fresh?null:git(['rev-parse','HEAD:'+file],env).trim(),afterSha256:sha(bytes),bytes:bytes.length});
  Object.assign(context.entries[sourceChanges.length-1],{beforeBlob:sourceChanges.at(-1).beforeBlob,afterKind:'regular',afterBytes:bytes.length,afterSha256:sourceChanges.at(-1).afterSha256,hashStatus:'verified'});
  if(fresh)newFiles.push({path:file,bodyBase64:bytes.toString('base64')});else tracked.push(file);
 }
 return {sourcePatch:tracked.length?git(['diff','--binary','--no-ext-diff','--no-textconv','--no-renames','HEAD','--',...tracked],env):'',newFiles,sourceChanges};
}
async function main(){
 if(process.argv.includes('--cleanup')){cleanupPrivate();return;}
 if(process.argv.includes('--transport-self-test')){selfTest();console.log('Editorial transport synthetic checks passed.');return;}
 let stage='validate-inputs',dir,out,binding,selection=[],reportPath,childEnv,failed=true;
 let failure=null,privateSubstage='preparation-failure',listReportPath;
 const failureFlags={listParsed:false,selectedCount:null,sourceRevisionMatches:null,horizonMatches:null,targetId:null,targetPresent:null,childExit:null,childSignal:null};
 const shellIdentity={before:null,after:null};
 try{
  assert.equal(fs.realpathSync(process.cwd()),fs.realpathSync(ROOT));
  const sourceSha=process.env.INPUT_SOURCE_SHA,digest=process.env.INPUT_RESEARCH_SHA256;
  assert(/^[a-f0-9]{40}$/.test(sourceSha||'')&&/^[a-f0-9]{64}$/.test(digest||''));
  assert.equal(process.env.EXPECTED_WORKFLOW_SHA,sourceSha);assert.equal(process.env.INPUT_QUICK,'false');
  const bytes=base64((process.env.INPUT_RESEARCH_B64||'').trim(),48*1024);assert.equal(sha(bytes),digest);
  const research=JSON.parse(bytes.toString('utf8'));assert(Array.isArray(research.entries)&&research.entries.length===2);
  assert.deepEqual(research.entries.map(e=>e.id).sort(),['evt_40','evt_41']);assert.deepEqual(research.deferred||[],[]);
  const pem=process.env.INPUT_RECIPIENT_PUBLIC_KEY;assert.equal(fingerprint(pem),PIN);
  const pub=crypto.createPublicKey(pem);assert.equal(pub.asymmetricKeyType,'rsa');assert(pub.asymmetricKeyDetails.modulusLength>=3072);
  const env=isolatedEnvironment();assert.equal(git(['rev-parse','HEAD'],env).trim(),sourceSha);
  assert.equal(git(['status','--porcelain=v1','--untracked-files=all'],env),'');assert(!fs.existsSync(path.join(ROOT,'.vercel')));
  stage='verify-capacity-basis';verifyDiagnosticBasis(env);stage='validate-inputs';
  const tree=git(['rev-parse','HEAD^{tree}'],env).trim();
  const source=JSON.parse(readBounded(path.join(ROOT,'data/editorial-maintenance-sources.v1.json')));
  assert.equal(source.sourceRevision,research.sourceRevision);
  const location=privateLocation();
  fs.mkdirSync(location.dir,{mode:0o700});dir=location.dir;
  writePrivate(path.join(dir,'owner.json'),JSON.stringify(location.owner));
  out=path.join(location.base,'editorial-preparation-return');fs.mkdirSync(out,{mode:0o700});
  stage='transport-self-tests';selfTest();
  binding={schema:'ns.editorial-private-review.v4',recipientFingerprint:PIN,sourceSha,sourceTree:tree,
  sourceRevision:source.sourceRevision,researchDigest:digest,workflowImplementationSha:process.env.EXPECTED_WORKFLOW_SHA,
  runId:process.env.PREP_RUN_ID,runAttempt:process.env.PREP_RUN_ATTEMPT,purpose:'editorial-private-review',
  capturedAt:new Date().toISOString(),payloadMembers:MEMBERS,outcome:'failed-review-required',stage};bindingValid(binding);
  stage='verify-shell-before';shellIdentity.before=readShellIdentity();assertShellIdentity(shellIdentity.before);
  const input=path.join(dir,'research.json');writePrivate(input,bytes);
  stage='canonical-prepare-control';
  const prepared=JSON.parse(captured(process.execPath,['scripts/update-cards.js','--adaptive-editorial','--prepare-control'],env,dir,'prepare-control'));
  assert.equal(prepared.sourceRevision,source.sourceRevision);assert(Array.isArray(prepared.groups)&&prepared.groups.length<=10000);
  assert(new Set(prepared.groups.map(g=>g.event_id)).size===prepared.groups.length);
  for(const g of prepared.groups)assert(g.event_id&&Array.isArray(g.aliases)&&g.aliases.length<=100);
  stage='read-authorised-controls';
  const url=new URL(process.env.SUPABASE_URL);assert.equal(url.origin,'https://mkghopnkhcxtmfrcjdbc.supabase.co');
  assert(!url.username&&!url.password&&!url.search&&!url.hash&&['/',''].includes(url.pathname));
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;assert(key&&!/^\*+$/.test(key));
  const signals=[];
  for(let i=0;i<prepared.groups.length;i+=100){
   const batch=prepared.groups.slice(i,i+100),r=await api('/rest/v1/rpc/nothingsports_editorial_signals',key,url.origin,{target_groups:batch});
   assert(r.value.length<=batch.length);for(const s of r.value)assert(batch.some(g=>g.event_id===s.event_id));signals.push(...r.value);
  }
  assert(new Set(signals.map(s=>s.event_id)).size===signals.length);
  const r=await api('/rest/v1/nothingsports_editorial_maintenance?select=*&order=event_id.asc&limit=1000',key,url.origin);
  const count=/^(?:\d+-\d+|\*)\/(\d+)$/.exec(r.range||''),states=r.value;
  assert(count&&Number(count[1])===states.length&&states.length<1000,'Partial control snapshot rejected.');
  assert(new Set(states.map(s=>s.event_id)).size===states.length);
  const snapshot={capturedAt:new Date().toISOString(),sourceRevision:source.sourceRevision,complete:true,groups:prepared.groups,signals,states};
  const snapshotPath=path.join(dir,'controls.json');writePrivate(snapshotPath,JSON.stringify(snapshot)+'\n');
  reportPath=path.join(dir,'research-check-report.json');
  stage='canonical-inventory';privateSubstage='list-child-failure';
  listReportPath=path.join(dir,'list-check-report.json');
  const listText=captured(process.execPath,['scripts/update-cards.js','--adaptive-editorial','--list'],
  isolatedEnvironment(snapshotPath,listReportPath),dir,'inventory',failureFlags);
  privateSubstage='list-json-invalid';
  const listed=JSON.parse(listText);failureFlags.listParsed=true;
  privateSubstage='noncanonical-admission';
  assert(listed&&typeof listed==='object'&&Array.isArray(listed.cards)&&listed.cards.length<=1000);
  selection=listed.cards.map(c=>({id:c.id,revision:c.revision,repairReason:c.repairReason||null,
   held:c.schedule?.held===true,pendingEdit:c.pendingEdit===true,inWindow:c.schedule?.inWindow===true,
   protected:c.schedule?.protected===true,due:c.schedule?.due===true}));
  failureFlags.selectedCount=selection.length;
  privateSubstage='source-revision-mismatch';
  failureFlags.sourceRevisionMatches=listed.sourceRevision===source.sourceRevision;
  assert.equal(listed.sourceRevision,source.sourceRevision);
  privateSubstage='horizon-mismatch';
  failureFlags.horizonMatches=listed.horizon?.from===research.horizon.from&&
   listed.horizon?.to===research.horizon.to&&Object.keys(listed.horizon||{}).length===2;
  assert.deepEqual(listed.horizon,research.horizon);
  for(const entry of research.entries){
   const card=listed.cards.find(c=>c.id===entry.id),sourceEvent=source.events.find(e=>e.id===entry.id);
   const expectedAliases=sourceEvent?[...new Set([sourceEvent.id,sourceEvent.eventId,sourceEvent.canonicalEventId,
    ...(sourceEvent.sourceEventIds||[])].filter(Boolean))]:null;
   const group=prepared.groups.find(g=>g.event_id===entry.id);
   failureFlags.targetId=entry.id;failureFlags.targetPresent=!!card;
   const issue=canonicalAdmissionIssue(card,entry.id,expectedAliases,group);
   if(issue){privateSubstage=issue;throw Error('Canonical target requires private reconciliation.');}
  }
  privateSubstage='preparation-failure';
  assert(Date.now()-Date.parse(snapshot.capturedAt)<=15*60*1000,'Refresh expired controls.');
  childEnv=isolatedEnvironment(snapshotPath,reportPath);stage='canonical-research';
  captured(process.execPath,['scripts/update-cards.js','--adaptive-editorial','--research',input],childEnv,dir,'research');
  stage='verify-shell-after';shellIdentity.after=readShellIdentity();assertShellIdentity(shellIdentity.after);
  assert.deepEqual(shellIdentity.after,shellIdentity.before,'Preparation changed the agreed shell bytes.');failed=false;
 }catch(error){failed=true;failure=privateFailure(error,stage,privateSubstage,failureFlags);}finally{
  if(binding&&dir&&out){
   try{
    binding={...binding,capturedAt:new Date().toISOString(),outcome:failed?'failed-review-required':'prepared-review-required',stage};
    const researchReport=reportPath&&fs.existsSync(reportPath)?reportPath:null;
    const activeReport=researchReport||(listReportPath&&fs.existsSync(listReportPath)?listReportPath:null);
    if(failure)failure.reportMode=researchReport?'research':activeReport?'list':'none';
    if(failure&&activeReport&&!researchReport)failure.listDiagnostic=JSON.parse(readBounded(activeReport));
    const casReport=researchReport?JSON.parse(readBounded(researchReport)):{sourceRevision:binding.sourceRevision,operations:[]};
    if(shellIdentity.after===null)shellIdentity.after=readShellIdentity();
    if(!failure)stage='capture-source';
    const captureEnv=isolatedEnvironment(),context=captureContext(()=>git(['status','--porcelain=v1','-z','--untracked-files=all'],captureEnv,CAPTURE_DIAGNOSTIC_LIMITS.statusBytes));
    const payload=composeReviewReturn({casReport,casSql:'',selection,shellIdentity},{primary:failure,flags:failureFlags,context,
     captureSource:()=>sourceChanges(captureEnv,context),
     captureCAS:()=>researchReport?captured(process.execPath,['scripts/editorial-control-sql.js',researchReport],childEnv||isolatedEnvironment(),dir,'prepare-cas-sql'):'',
     report:researchReport?casReport:failure?.listDiagnostic,mode:researchReport?'research':'list'});
    if(payload.failure){failed=true;failure=payload.failure;stage=failure.stage;}
    binding={...binding,outcome:failed?'failed-review-required':'prepared-review-required',stage};
    const text=JSON.stringify(seal(payload,binding,process.env.INPUT_RECIPIENT_PUBLIC_KEY))+'\n';assert(Buffer.byteLength(text)<=MAX_ENVELOPE);
    writePrivate(path.join(out,'private-return.encrypted.json'),text);
    writePrivate(path.join(out,'public-manifest.json'),JSON.stringify({schemaVersion:'ns.editorial-preparation-return.v1',binding,
    ciphertextBytes:Buffer.byteLength(text),ciphertextSha256:sha(text),outcome:binding.outcome,
    requiresFreshCanonicalControlsAndCASReview:true,databaseWrites:0,pushes:0,deployments:0},null,2)+'\n');
   }catch(_){failed=true;if(!failure)stage='return-packaging';console.error('Editorial private return unavailable; no database write or release performed.');}
  }
  if(dir)cleanupPrivate();
 }
 if(failed){console.error('Editorial preparation failed at '+stage+'; no database write or release performed.');process.exitCode=1;}
 else console.log('Editorial preparation complete; encrypted private review required. No database write or release performed.');
}
if(require.main===module)main().catch(()=>{console.error('Editorial preparation failed safely.');process.exitCode=1;});
module.exports={seal,open,selfTest,privateLocation,cleanupPrivate,canonicalAdmissionIssue,privateFailure,validatePrivateFailure,validatePrivatePayload:payloadValid,strictSourceEntry,captureContext,captureRows,captureInventory,observeDiagnosticEntry,composeReviewReturn,diagnosticCapacityBasis:DIAGNOSTIC_CAPACITY_BASIS,diagnosticCapacityLimits:CAPTURE_DIAGNOSTIC_LIMITS,verifyDiagnosticBasisRows};
