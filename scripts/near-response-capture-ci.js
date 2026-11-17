'use strict';
// One manually allocated diagnostic. Never imported by application code.
const fs=require('node:fs/promises'),C=require('node:fs').constants,path=require('node:path');
const crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const APP=Object.freeze({sha:'96bcdd8e4177496f4a6866b59ff1ec1182468815',tree:'493fb6a7b139aaaca1f7e1068ea65b39c6a199fd',transport:'4c4ddccee6a6d1da578f714c0a9b4901c91fe304ac8bbaa306dd72875f56017f',validator:'3d2f46199646b166deea850dabcb1826cfce5d187a84025c55c76de00b25fc7d'});
const BRANCH='refs/heads/codex/near-capture-only-20261117';
const PURPOSE='ns.near-current-response-capture.v1',ACTION='one-near-bundle-no-health';
const RPC='/rest/v1/rpc/nothingsports_read_match_centre_fixture_bundle';
const LIMIT=8388608,REQUEST_MS=5000,STAGE_MS=10000,ENCRYPTED_MAX=12000000;
const MAGIC=Buffer.from('NSNEAR1\n');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
function publicKey(pem){const key=crypto.createPublicKey(pem);assert(key.asymmetricKeyType==='rsa'&&key.asymmetricKeyDetails.modulusLength>=2048&&key.asymmetricKeyDetails.modulusLength<=8192);return key;}
const fingerprint=k=>hash((k?.type==='public'?k:crypto.createPublicKey(k)).export({format:'der',type:'spki'}));
function context(env,driverSha){
 assert.equal(env.GITHUB_REPOSITORY,'hartican/sportscal');assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch');
 assert.equal(env.GITHUB_WORKFLOW,'Canonical card refresh');assert.equal(env.GITHUB_JOB,'refresh');assert.equal(env.GITHUB_REF,BRANCH);
 assert.equal(env.GITHUB_RUN_ATTEMPT,'1');assert(/^\d+$/.test(env.GITHUB_RUN_ID||''));assert(uuid(env.NS_NEAR_CAPTURE_ID));
 assert.equal(env.NS_NEAR_APP_SHA,APP.sha);assert.equal(env.NS_NEAR_DRIVER_SHA,driverSha);assert(/^[a-f0-9]{64}$/.test(driverSha));
 assert(/^[a-f0-9]{40}$/.test(env.NS_NEAR_CONTROL_SHA||''));assert.equal(env.GITHUB_SHA,env.NS_NEAR_CONTROL_SHA);assert.equal(env.NS_NEAR_WORKFLOW_SHA,env.NS_NEAR_CONTROL_SHA);
 assert.equal(env.GITHUB_WORKFLOW_REF,`hartican/sportscal/.github/workflows/canonical-card-refresh.yml@${BRANCH}`);
 const key=publicKey(env.NS_NEAR_RECIPIENT_PUBLIC_KEY);return {purpose:PURPOSE,action:ACTION,captureId:env.NS_NEAR_CAPTURE_ID,sourceSha:APP.sha,sourceTree:APP.tree,transportSha256:APP.transport,validatorSha256:APP.validator,controlSha:env.NS_NEAR_CONTROL_SHA,driverSha256:driverSha,runId:env.GITHUB_RUN_ID,runAttempt:1,recipientFingerprint:fingerprint(key)};
}
function validateBinding(b,expected){
 assert(b&&b.purpose===PURPOSE&&b.action===ACTION&&uuid(b.captureId));assert.equal(b.sourceSha,APP.sha);assert.equal(b.sourceTree,APP.tree);
 assert.equal(b.transportSha256,APP.transport);assert.equal(b.validatorSha256,APP.validator);
 for(const k of ['controlSha','driverSha256','captureId','recipientFingerprint','sourceSha','runId'])if(expected?.[k]!==undefined)assert.equal(b[k],expected[k]);
 assert(['CAPTURE_COMPLETE','CAPTURE_INCOMPLETE'].includes(b.state));assert(Number.isSafeInteger(b.bodyBytes)&&b.bodyBytes>=0&&b.bodyBytes<=LIMIT);assert(/^[a-f0-9]{64}$/.test(b.bodySha256));assert(/^[a-f0-9]{40}$/.test(b.bodyGitBlob));
}
function encrypt(body,receipt,recipient){
 assert(Buffer.isBuffer(body)&&body.length<=LIMIT);const key=publicKey(recipient);
 const binding={...receipt.binding,state:receipt.state,bodyBytes:body.length,bodySha256:hash(body),bodyGitBlob:blob(body)};
 validateBinding(binding);assert.equal(binding.recipientFingerprint,fingerprint(key));
 const meta=Buffer.from(JSON.stringify(receipt));assert(meta.length<=65536);const length=Buffer.alloc(4);length.writeUInt32BE(meta.length);
 const plain=Buffer.concat([MAGIC,length,meta,body]),aes=crypto.randomBytes(32),iv=crypto.randomBytes(12);
 try{const cipher=crypto.createCipheriv('aes-256-gcm',aes,iv);cipher.setAAD(Buffer.from(JSON.stringify(binding)));
  const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
  const envelope={schema:'ns.near-capture.encrypted.v1',binding,wrappedKey:crypto.publicEncrypt({key,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},aes).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
  const encoded=Buffer.from(JSON.stringify(envelope)+'\n');assert(encoded.length<=ENCRYPTED_MAX);return {encoded,binding};
 }finally{aes.fill(0);}
}
function unbase64(s,max){assert(typeof s==='string'&&s.length<=Math.ceil(max/3)*4&&/^[A-Za-z0-9+/]*={0,2}$/.test(s));const b=Buffer.from(s,'base64');assert(b.length<=max&&b.toString('base64')===s);return b;}
function decrypt(encoded,privatePem,expected){
 assert(Buffer.isBuffer(encoded)&&encoded.length<=ENCRYPTED_MAX);const e=JSON.parse(encoded.toString('utf8'));
 assert.deepEqual(Object.keys(e).sort(),['binding','ciphertext','iv','schema','tag','wrappedKey']);assert.equal(e.schema,'ns.near-capture.encrypted.v1');validateBinding(e.binding,expected);
 assert.equal(e.binding.recipientFingerprint,fingerprint(privatePem));
 const aes=crypto.privateDecrypt({key:privatePem,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},unbase64(e.wrappedKey,1024));assert.equal(aes.length,32);
 try{const iv=unbase64(e.iv,12),tag=unbase64(e.tag,16);assert.equal(iv.length,12);assert.equal(tag.length,16);
  const d=crypto.createDecipheriv('aes-256-gcm',aes,iv);d.setAAD(Buffer.from(JSON.stringify(e.binding)));d.setAuthTag(tag);
  const plain=Buffer.concat([d.update(unbase64(e.ciphertext,LIMIT+65536+12)),d.final()]);assert(plain.subarray(0,MAGIC.length).equals(MAGIC));
  const n=plain.readUInt32BE(MAGIC.length);assert(n<=65536&&plain.length>=MAGIC.length+4+n);
  const receipt=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain.subarray(MAGIC.length+4,MAGIC.length+4+n))),body=plain.subarray(MAGIC.length+4+n);
  assert.deepEqual(receipt.binding,Object.fromEntries(Object.entries(e.binding).filter(([k])=>!['state','bodyBytes','bodySha256','bodyGitBlob'].includes(k))));
  assert.equal(receipt.state,e.binding.state);assert.equal(body.length,e.binding.bodyBytes);assert.equal(hash(body),e.binding.bodySha256);assert.equal(blob(body),e.binding.bodyGitBlob);
  if(receipt.state==='CAPTURE_COMPLETE'){const text=new TextDecoder('utf-8',{fatal:true}).decode(body),value=JSON.parse(text);assert.equal(value.schemaVersion,'current-fixture-bundle.v1');assert.equal(value.scope,'match-centre');assert.equal(value.complete,true);assert(Array.isArray(value.rows));assert.equal(value.rows.length,receipt.rowCount);}
  return {binding:e.binding,receipt,body};
 }finally{aes.fill(0);}
}
async function exclusive(file,bytes){const h=await fs.open(file,C.O_CREAT|C.O_EXCL|C.O_WRONLY|C.O_NOFOLLOW,0o600);try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}}
async function regular(file,max){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.size<=max);return fs.readFile(file);}
function git(root,args){return cp.execFileSync('/usr/bin/git',['-c','core.fsmonitor=false',...args],{cwd:root,encoding:'utf8',timeout:2000,maxBuffer:4096,env:{...process.env,GIT_NO_LAZY_FETCH:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}}).trim();}
async function source(root){
 assert.equal(git(root,['rev-parse','HEAD']),APP.sha);assert.equal(git(root,['rev-parse','HEAD^{tree}']),APP.tree);
 assert.equal(git(root,['diff','--name-only','HEAD','--']),'');assert.equal(git(root,['diff','--cached','--name-only','HEAD','--']),'');
 assert.equal(hash(await regular(path.join(root,'lib/supabase-server.js'),25000)),APP.transport);
 assert.equal(hash(await regular(path.join(root,'scripts/validate-supabase-response-deadline.js'),25000)),APP.validator);
}
function safeCode(error){const c=error?.payload?.code;return ['supabase_timeout','supabase_capture_too_large','supabase_capture_sink_failed','supabase_capture_invalid_utf8','supabase_capture_invalid_json','supabase_capture_not_authorised','supabase_capture_stream_unavailable','supabase_capture_read_failed'].includes(c)?c:'capture_or_closure_failed';}
async function capture({directory,binding,ids,transport,environment,membershipClock=new Date().toISOString(),clock=()=>performance.now()}){
 const receipt={binding,state:'CAPTURE_INCOMPLETE',evidence:'original-fetch-decoded-body-bytes-not-compressed-wire',captureClock:membershipClock,membershipIds:ids,membershipCount:ids.length,membershipSha256:hash(JSON.stringify(ids)),request:{method:'POST',path:RPC,bundleCalls:0,healthCalls:0,retries:0},limits:{bodyBytes:LIMIT,requestMs:REQUEST_MS,networkStageMs:STAGE_MS},timings:[],sink:'NOT_STARTED',closure:'NOT_PROVED'};
 assert(Array.isArray(ids)&&ids.length<=5000&&ids.every(x=>typeof x==='string'&&x.length)&&new Set(ids).size===ids.length);
 const admission=Buffer.from(JSON.stringify(receipt));assert(admission.length<=49152,'Private metadata exceeds capture budget before request');
 await exclusive(path.join(directory,'admission.private.json'),admission);
 const bodyPath=path.join(directory,'response.body'),h=await fs.open(bodyPath,C.O_CREAT|C.O_EXCL|C.O_WRONLY|C.O_NOFOLLOW,0o600);
 const began=clock(),controller=new AbortController(),pending=new Set();let accepted=0,meta,result,failed=false;
 const timer=setTimeout(()=>controller.abort(),STAGE_MS);const check=signal=>{assert(!controller.signal.aborted&&!signal?.aborted&&clock()-began<STAGE_MS);};
 const cap=transport.createResponseCapture({maxBytes:LIMIT,onChunk({bytes,offset,signal}){
  const operation=(async()=>{check(signal);assert.equal(offset,accepted);assert(bytes.length<=LIMIT-accepted);let n=0;
   while(n<bytes.length){check(signal);const wrote=await h.write(bytes,n,bytes.length-n,offset+n);assert(wrote.bytesWritten>0);n+=wrote.bytesWritten;}
   check(signal);accepted+=bytes.length;
  })();pending.add(operation);operation.then(()=>pending.delete(operation),()=>pending.delete(operation));return operation;
 },onComplete(value){check(value.signal);meta={bytes:value.bytes,textBytes:value.textBytes,sha256:value.sha256,gitBlob:value.gitBlobSha1,evidence:value.evidence};receipt.sink='BODY_VALIDATED_REQUEST_PENDING';}});
 try{
  await exclusive(path.join(directory,'ATTEMPT.private.json'),Buffer.from(JSON.stringify({binding,attempt:1,bundleCallsMax:1,healthCalls:0,retries:0,startedAt:new Date().toISOString()})));
  check();receipt.request.bundleCalls=1;
  result=await transport.supabaseServiceRequest(RPC,{method:'POST',body:{p_membership_ids:ids},environment,timeoutMs:REQUEST_MS,signal:controller.signal,captureResponse:cap,onTiming:e=>{
   if(receipt.timings.length<64)receipt.timings.push({phase:e.phase,elapsedMs:e.elapsedMs,status:e.status??null,bytes:e.bytes??null,...(e.outcome?{outcome:e.outcome}:{})});
  }});
  check();assert(meta&&pending.size===0);await h.sync();check();await h.close();check();receipt.closure='CLOSED_AND_VERIFIED';
  const body=await regular(bodyPath,LIMIT);check();assert.equal(body.length,accepted);assert.equal(body.length,meta.bytes);assert.equal(hash(body),meta.sha256);assert.equal(blob(body),meta.gitBlob);
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));assert.deepEqual(value,result);
  assert.equal(value.schemaVersion,'current-fixture-bundle.v1');assert.equal(value.scope,'match-centre');assert.equal(value.complete,true);assert(Array.isArray(value.rows)&&value.rows.length<=5000);
  check();clearTimeout(timer); // Request, sink closure and body verification are now complete within the stage.
  receipt.rowCount=value.rows.length;receipt.body=meta;receipt.elapsedMs=clock()-began;receipt.state='CAPTURE_COMPLETE';receipt.finishedAt=new Date().toISOString();
  await exclusive(path.join(directory,'CAPTURE_COMPLETE.private.json'),Buffer.from(JSON.stringify(receipt)));return {body,receipt};
 }catch(error){failed=true;controller.abort();receipt.state='CAPTURE_INCOMPLETE';receipt.code=safeCode(error);receipt.elapsedMs=clock()-began;receipt.finishedAt=new Date().toISOString();
  // Never promote a timed-out/late filesystem callback to complete evidence.
  if(pending.size===0){try{await h.close();receipt.closure='CLOSED_AFTER_FAILURE';}catch{}}
  else receipt.closure='UNCERTAIN_PENDING_SINK';
  let body=Buffer.alloc(0);if(receipt.closure!=='UNCERTAIN_PENDING_SINK')try{body=await regular(bodyPath,LIMIT);}catch{}
  return {body,receipt};
 }finally{clearTimeout(timer);if(failed)controller.abort();}
}
async function live(env=process.env){
 const control=await fs.realpath(path.join(__dirname,'..')),driverSha=hash(await regular(__filename,65536)),binding=context(env,driverSha);
 assert(typeof env.GITHUB_OUTPUT==='string'&&env.GITHUB_OUTPUT&&!/[\r\n]/.test(env.GITHUB_OUTPUT));
 const outputStat=await fs.lstat(env.GITHUB_OUTPUT);assert(outputStat.isFile()&&!outputStat.isSymbolicLink());
 assert.equal(git(control,['rev-parse','HEAD']),binding.controlSha);const app=path.join(control,'application96');await source(app);
 const transport=require(path.join(app,'lib/supabase-server.js')),config=transport.supabaseServiceRoleConfig(env);
 assert(config.configured&&config.url==='https://mkghopnkhcxtmfrcjdbc.supabase.co');
 const root=await fs.realpath(env.RUNNER_TEMP);assert(path.isAbsolute(root)&&root!==control&&!root.startsWith(control+path.sep));
 const directory=path.join(root,'ns-near-capture-'+binding.captureId);await fs.mkdir(directory,{mode:0o700});await fs.chmod(directory,0o700);
 const out=path.join(directory,'return');await fs.mkdir(out,{mode:0o700});
 const captureClock=Date.now(),ids=require(path.join(app,'scripts/verify-near-app-adapter.js')).membership(captureClock);
 // Hard stop is not a new request/retry; no plaintext path is ever an artifact.
 const watchdog=setTimeout(()=>process.exit(1),15000);
 try{const result=await capture({directory,binding,ids,transport,environment:env,membershipClock:new Date(captureClock).toISOString()});const sealed=encrypt(result.body,result.receipt,env.NS_NEAR_RECIPIENT_PUBLIC_KEY);
  const manifest={schema:'ns.near-capture.public.v1',binding:sealed.binding,ciphertextBytes:sealed.encoded.length,ciphertextSha256:hash(sealed.encoded),rawPublished:false};
  await exclusive(path.join(out,'encrypted.json'),sealed.encoded);await exclusive(path.join(out,'manifest.json'),Buffer.from(JSON.stringify(manifest)+'\n'));
  assert(typeof env.GITHUB_OUTPUT==='string'&&env.GITHUB_OUTPUT&&!/[\r\n]/.test(out));
  await fs.appendFile(env.GITHUB_OUTPUT,`return_ready=true\nreturn_dir=${out}\n`);
  console.log(JSON.stringify({state:result.receipt.state,captureId:binding.captureId,bundleCalls:result.receipt.request.bundleCalls,healthCalls:0,retries:0,encryptedReturn:true}));
  if(result.receipt.state!=='CAPTURE_COMPLETE')process.exitCode=1;
 }finally{clearTimeout(watchdog);}
}
async function recover({encryptedPath,manifestPath,keyPath,expected,destination}){
 const encoded=await regular(encryptedPath,ENCRYPTED_MAX),m=JSON.parse(await regular(manifestPath,16384));assert.equal(m.schema,'ns.near-capture.public.v1');assert.equal(m.ciphertextBytes,encoded.length);assert.equal(m.ciphertextSha256,hash(encoded));
 const opened=decrypt(encoded,await regular(keyPath,16384),expected);assert.deepEqual(m.binding,opened.binding);assert.equal(m.rawPublished,false);
 await fs.mkdir(destination,{mode:0o700});await fs.chmod(destination,0o700);await exclusive(path.join(destination,'response.body'),opened.body);await exclusive(path.join(destination,'receipt.private.json'),Buffer.from(JSON.stringify(opened.receipt,null,2)+'\n'));
 assert((await regular(path.join(destination,'response.body'),LIMIT)).equals(opened.body));
 return {state:opened.receipt.state,bodyBytes:opened.body.length,bodySha256:hash(opened.body),bodyGitBlob:blob(opened.body),rowCount:opened.receipt.rowCount??null,membershipCount:opened.receipt.membershipCount,binding:opened.binding};
}
async function cleanup(env=process.env){
 assert(uuid(env.NS_NEAR_CAPTURE_ID));const root=await fs.realpath(env.RUNNER_TEMP),d=path.join(root,'ns-near-capture-'+env.NS_NEAR_CAPTURE_ID),s=await fs.lstat(d);assert(s.isDirectory()&&!s.isSymbolicLink());
 // Only exact job-owned plaintext members, after the encrypted artifact upload.
 for(const n of ['admission.private.json','ATTEMPT.private.json','response.body','CAPTURE_COMPLETE.private.json']){const f=path.join(d,n);try{const st=await fs.lstat(f);assert(st.isFile()&&!st.isSymbolicLink());await fs.unlink(f);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
if(require.main===module){const cmd=process.argv[2];(cmd==='--cleanup'?cleanup():cmd==='--capture'&&process.argv.length===3?live():Promise.reject(Error('Invalid capture command'))).catch(()=>{console.error('NS_NEAR_CAPTURE_STOP: bounded diagnostic failed; no automatic retry.');process.exitCode=1;});}
module.exports={APP,BRANCH,PURPOSE,ACTION,RPC,LIMIT,REQUEST_MS,STAGE_MS,hash,blob,context,encrypt,decrypt,exclusive,capture,recover};
