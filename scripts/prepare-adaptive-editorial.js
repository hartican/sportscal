#!/usr/bin/env node
'use strict';
// Manual preparation, never publication or database mutation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const PIN='67b4c7c9f219fe21fa4083a9b374fd4edb79adc1f46afc1f0fa8a256346f1aa6';
const MAX=32*1024*1024,MAX_ENVELOPE=48*1024*1024;
const MEMBERS=['casReport','casSql','selection','shellIdentity','sourcePatch','newFiles','sourceChanges'];
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
 assert.equal(b.schema,'ns.editorial-private-review.v1');assert.equal(b.purpose,'editorial-private-review');
 for(const k of ['sourceSha','sourceTree','workflowImplementationSha'])assert(/^[a-f0-9]{40}$/.test(b[k]));
 for(const k of ['recipientFingerprint','sourceRevision','researchDigest'])assert(/^[a-f0-9]{64}$/.test(b[k]));
 assert(/^\d+$/.test(b.runId)&&/^[1-9]\d*$/.test(b.runAttempt));
 assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(b.capturedAt)&&Number.isFinite(Date.parse(b.capturedAt)));
 assert.deepEqual(b.payloadMembers,MEMBERS);assert(/^[a-z-]{1,48}$/.test(b.stage));
 assert(['prepared-review-required','failed-review-required'].includes(b.outcome));
}
function payloadValid(p,b){
 keys(p,MEMBERS);assert(p.casReport&&typeof p.casReport==='object'&&!Array.isArray(p.casReport));
 assert(Object.keys(p.casReport).every(k=>['sourceRevision','operations','runReadouts'].includes(k)));
 assert.equal(p.casReport.sourceRevision,b.sourceRevision);
 assert(Array.isArray(p.casReport.operations)&&p.casReport.operations.length<=1000);
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
 const b={schema:'ns.editorial-private-review.v1',recipientFingerprint:fingerprint(a.publicKey),sourceSha:'1'.repeat(40),
 sourceTree:'2'.repeat(40),sourceRevision:'3'.repeat(64),researchDigest:'4'.repeat(64),workflowImplementationSha:'1'.repeat(40),
 runId:'1',runAttempt:'1',purpose:'editorial-private-review',capturedAt:'2026-11-13T13:00:00.000Z',
 payloadMembers:MEMBERS,outcome:'prepared-review-required',stage:'capture-source'};
 const p={casReport:{sourceRevision:b.sourceRevision,operations:[]},casSql:'',selection:[],shellIdentity:{before:null,after:null},sourcePatch:'',newFiles:[],sourceChanges:[]};
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
function captured(command,args,env,dir,label){
 const r=spawnSync(command,args,{cwd:ROOT,env,encoding:'utf8',timeout:12*60*1000,maxBuffer:MAX,stdio:['ignore','pipe','pipe']});
 writePrivate(path.join(dir,label+'.stdout'),r.stdout||'');writePrivate(path.join(dir,label+'.stderr'),r.stderr||'');
 assert.equal(r.status,0,'Private child failed.');return r.stdout;
}
function git(args,env){
 const r=spawnSync('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],
 {cwd:ROOT,env,encoding:'utf8',timeout:30000,maxBuffer:MAX,stdio:['ignore','pipe','pipe']});
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
function sourceChanges(env){
 const rows=git(['status','--porcelain=v1','-z','--untracked-files=all'],env).split('\0').filter(Boolean);
 const sourceChanges=[],newFiles=[],tracked=[];
 for(const row of rows){
  assert([' M','??'].includes(row.slice(0,2)),'Unexpected staged, renamed or deleted source.');
  const file=row.slice(3);assert(allowed(file),'Changed source outside reviewed allowlist.');assert(sourceChanges.length<128);
  const bytes=readBounded(path.join(ROOT,file)),fresh=row.startsWith('??');
  sourceChanges.push({path:file,status:fresh?'new':'modified',beforeBlob:fresh?null:git(['rev-parse','HEAD:'+file],env).trim(),afterSha256:sha(bytes),bytes:bytes.length});
  if(fresh)newFiles.push({path:file,bodyBase64:bytes.toString('base64')});else tracked.push(file);
 }
 return {sourcePatch:tracked.length?git(['diff','--binary','--no-ext-diff','--no-textconv','--no-renames','HEAD','--',...tracked],env):'',newFiles,sourceChanges};
}
async function main(){
 if(process.argv.includes('--cleanup')){cleanupPrivate();return;}
 if(process.argv.includes('--transport-self-test')){selfTest();console.log('Editorial transport synthetic checks passed.');return;}
 let stage='validate-inputs',dir,out,binding,selection=[],reportPath,childEnv,failed=true;
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
  const tree=git(['rev-parse','HEAD^{tree}'],env).trim();
  const source=JSON.parse(readBounded(path.join(ROOT,'data/editorial-maintenance-sources.v1.json')));
  assert.equal(source.sourceRevision,research.sourceRevision);
  const location=privateLocation();
  fs.mkdirSync(location.dir,{mode:0o700});dir=location.dir;
  writePrivate(path.join(dir,'owner.json'),JSON.stringify(location.owner));
  out=path.join(location.base,'editorial-preparation-return');fs.mkdirSync(out,{mode:0o700});
  stage='transport-self-tests';selfTest();
  binding={schema:'ns.editorial-private-review.v1',recipientFingerprint:PIN,sourceSha,sourceTree:tree,
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
  stage='canonical-inventory';
  const listed=JSON.parse(captured(process.execPath,['scripts/update-cards.js','--adaptive-editorial','--list'],
  isolatedEnvironment(snapshotPath,path.join(dir,'list-check-report.json')),dir,'inventory'));
  assert.equal(listed.sourceRevision,source.sourceRevision);assert.deepEqual(listed.horizon,research.horizon);
  for(const e of research.entries){const c=listed.cards.find(c=>c.id===e.id);assert(c&&c.schedule?.held!==true&&c.schedule?.due===true,'Target unavailable in canonical inventory.');}
  selection=listed.cards.map(c=>({id:c.id,revision:c.revision,repairReason:c.repairReason||null,held:c.schedule?.held===true,pendingEdit:c.pendingEdit===true}));
  assert(Date.now()-Date.parse(snapshot.capturedAt)<=15*60*1000,'Refresh expired controls.');
  childEnv=isolatedEnvironment(snapshotPath,reportPath);stage='canonical-research';
  captured(process.execPath,['scripts/update-cards.js','--adaptive-editorial','--research',input],childEnv,dir,'research');
  stage='verify-shell-after';shellIdentity.after=readShellIdentity();assertShellIdentity(shellIdentity.after);
  assert.deepEqual(shellIdentity.after,shellIdentity.before,'Preparation changed the agreed shell bytes.');failed=false;
 }catch(_){failed=true;}finally{
  if(binding&&dir&&out){
   try{
    binding={...binding,capturedAt:new Date().toISOString(),outcome:failed?'failed-review-required':'prepared-review-required',stage};
    const casReport=reportPath&&fs.existsSync(reportPath)?JSON.parse(readBounded(reportPath)):{sourceRevision:binding.sourceRevision,operations:[]};
    const casSql=reportPath&&fs.existsSync(reportPath)?captured(process.execPath,['scripts/editorial-control-sql.js',reportPath],childEnv||isolatedEnvironment(),dir,'prepare-cas-sql'):'';
    if(shellIdentity.after===null)shellIdentity.after=readShellIdentity();
    const payload={casReport,casSql,selection,shellIdentity,...sourceChanges(isolatedEnvironment())};
    const text=JSON.stringify(seal(payload,binding,process.env.INPUT_RECIPIENT_PUBLIC_KEY))+'\n';assert(Buffer.byteLength(text)<=MAX_ENVELOPE);
    writePrivate(path.join(out,'private-return.encrypted.json'),text);
    writePrivate(path.join(out,'public-manifest.json'),JSON.stringify({schemaVersion:'ns.editorial-preparation-return.v1',binding,
    ciphertextBytes:Buffer.byteLength(text),ciphertextSha256:sha(text),outcome:binding.outcome,
    requiresFreshCanonicalControlsAndCASReview:true,databaseWrites:0,pushes:0,deployments:0},null,2)+'\n');
   }catch(_){failed=true;}
  }
  if(dir)cleanupPrivate();
 }
 if(failed){console.error('Editorial preparation failed at '+stage+'; no database write or release performed.');process.exitCode=1;}
 else console.log('Editorial preparation complete; encrypted private review required. No database write or release performed.');
}
if(require.main===module)main().catch(()=>{console.error('Editorial preparation failed safely.');process.exitCode=1;});
module.exports={seal,open,selfTest,privateLocation,cleanupPrivate};
