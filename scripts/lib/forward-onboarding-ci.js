'use strict';
// Source-only until exact source review and a separately admitted cloud action.
// This fixed policy is the publisher's reservation, NOT action authority.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const POLICY=Object.freeze({"schemaVersion":"onboarding-forward-ci-policy.v1","allocation":"ONBOARDING-POST611-FORWARD-REPAIR-20261107-01","reservationId":"NS-ONBOARDING-FORWARD-612-20261107","reservationSha256":"40f49544cb207c3c1bf7c1da3cfd1c6c1e527ddb36003ee6067b0fb837a378ed","reservationBytes":4142,"previousVersion":"611","version":"612","acceptedMain":"4bff7ada7d03c3bff52a262f58e630fe47848a74","acceptedMainTree":"5e6eff7d4307fb97e725f57469d9ecabcb78c7a2","productHead":"7a194390c70d9ae5201ac64f202ce8547155a2c6","productTree":"99a7f024302c8660564e538bec591a4ae4113e10","publisher":"01a0d5ba-943d-74e0-af7f-dab4fb2bdda4","repository":"hartican/sportscal","baselineReceiptSha256":"ba4d0980919e1992e7531dfcc330d3a4344341cfd6837900de6388b39cdb37dc","baselineReceiptBytes":707,"productFiles":{"assets/js/settings-optional-ui.js":"fa460327cdff179b7d03b4e692dc07ae7a79a1390830c8cd0ed511b13ff725de","config/fantasy-deadline-ui.js":"0f7c838a3772a075c9bc8aecc6d4679e5d93440d2ab10b93ad0c4dd3b17f4ba3","docs/verification/onboarding-directories-20261107.md":"4c481356fe9a4a4dead83d7a234812deb3894d8b25b67c535e7bcb635ad318b5","index.html":"4ea88310ec70354546156e282c8cc3d5564786fbf4d43583b0ba937a371ec4e2","scripts/validate-new-user-journey.js":"c24ce31ad61a764117b311153356e70cbe988dee710405e1fabcc625f9cb57fd","scripts/validate-onboarding-directories-browser.js":"b96a773195d1557fbf991e2b9d3a6a24fc33c5784e9f5a9c271ad1609945c8f6"},"versionPlanInputs":{"worker":{"path":"service-worker.js","bytes":28941,"sha256":"4261bbb171cd1275e1896952072c3035fd63035993ba879e0154332f1350cbeb"},"recoveryAsset":{"path":"config/local-preference-recovery.js","bytes":4120,"sha256":"3f2ae09fdb057113603c0d70a19a57025f5d559151d67bf4230d3a0728fd39af","mode":"100644"},"cacheAction":"ADD_EXACT_APP_SHELL_MEMBER","additionalRequiredAssetBytes":4120}});
const OUTPUTS=Object.freeze(['assets/js/app-shell-runtime.js','assets/js/calendar-sync-ui.js','assets/js/account-awareness-runtime.js','assets/js/match-centre-ui.js','assets/js/all-sports-ui.js','assets/js/milestone-alerts-ui.js','assets/js/app-update.js','assets/js/notifications-inbox.js','assets/js/settings-optional-ui.js']);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const exact=(v,k)=>{assert(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),k.split(' ').sort(),'closed keys');};
const hex=(v,n)=>assert(typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v),'finite lowercase identity');
const utc=v=>{assert(typeof v==='string');const n=Date.parse(v);assert(Number.isFinite(n)&&new Date(n).toISOString()===v,'strict UTC');return n;};
function jsonBytes(bytes,max=16384){
 assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=max,'finite raw JSON');
 const text=bytes.toString('utf8');assert(Buffer.from(text).equals(bytes),'exact UTF8');
 const value=JSON.parse(text);
 function unicode(v){if(typeof v==='string'){assert(!/[\u0000]/.test(v),'NUL');for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){assert(i+1<v.length&&v.charCodeAt(++i)>=0xdc00&&v.charCodeAt(i)<=0xdfff,'unpaired surrogate');}else assert(c<0xdc00||c>0xdfff,'unpaired surrogate');}}else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){unicode(k);unicode(x);}}
 unicode(value);return value;
}
function decode(value,digest){
 assert(typeof value==='string'&&value.length>0&&value.length<=21848,'bounded base64');
 const bytes=Buffer.from(value,'base64');assert.equal(bytes.toString('base64'),value,'canonical base64');jsonBytes(bytes);assert.equal(hash(bytes),digest);return bytes;
}
function validateEnvelope({event,env,observed,now=Date.now(),phase}){
 assert(['canonical-producer','qualification'].includes(phase),'explicit existing route');
 assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.GITHUB_EVENT_NAME,'pull_request');assert.equal(env.GITHUB_REPOSITORY,POLICY.repository);assert.equal(env.GITHUB_JOB,'fixture-activation');
 assert.equal(env.GITHUB_WORKFLOW_REF.split('@')[0],POLICY.repository+'/.github/workflows/installed-upgrade-tests.yml');
 assert(/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID)&&/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT));
 assert.equal(event.repository.full_name,POLICY.repository);const p=event.pull_request;
 assert(Number.isSafeInteger(event.number)&&event.number>0);assert.equal(p.number,event.number);assert.equal(p.head.repo.full_name,POLICY.repository);assert.equal(p.base.repo.full_name,POLICY.repository);
 assert.equal(env.GITHUB_REF,'refs/pull/'+event.number+'/merge');
 assert.equal(p.draft,phase==='canonical-producer');
 assert.equal(event.action,phase==='canonical-producer'?'opened':'ready_for_review','one selected existing event; other events are not retries');
 if(phase==='canonical-producer')assert(p.head.ref.startsWith('codex/source-qualification-'),'same-repository producer branch');
 const bodyRaw=Buffer.from(p.body||''),body=jsonBytes(bodyRaw,65536);assert.equal(JSON.stringify(body),p.body,'canonical compact typed body; no LF or duplicate keys');
 exact(body,'schemaVersion scope commit testsAndResults dependencies databaseAndConfigChanges knownRisks rollback sourceQualificationBinding');
 assert.equal(body.schemaVersion,'ns-release-handover.forward.v1');
 for(const k of ['scope','testsAndResults','dependencies','databaseAndConfigChanges','knownRisks','rollback'])assert(typeof body[k]==='string'&&body[k].trim()&&body[k].length<=(k==='testsAndResults'?8192:4096));
 const b=body.sourceQualificationBinding;
 exact(b,'schemaVersion phase repository publisherHeadSha expectedPublisherTreeSha reviewedFinalMapSha256 expectedAssembledManifestSha256 expectedAssembledEntryCount expectedBaseRelativePathCount qualifierSha256 fixtureSha256 namedAllocationId reservationReceiptSha256 freshMainAndReservationBindingSha256 reservationReceiptBase64 freshMainAndReservationBindingBase64');
 assert.equal(b.schemaVersion,'sync-current-forward-binding.v1');assert.equal(b.phase,phase);assert.equal(b.repository,POLICY.repository);
 for(const k of ['publisherHeadSha','expectedPublisherTreeSha'])hex(b[k],40);
 for(const k of ['reviewedFinalMapSha256','expectedAssembledManifestSha256','qualifierSha256','fixtureSha256','reservationReceiptSha256','freshMainAndReservationBindingSha256'])hex(b[k],64);
 for(const k of ['expectedAssembledEntryCount','expectedBaseRelativePathCount'])assert(Number.isSafeInteger(b[k])&&b[k]>0&&b[k]<=10000);
 assert(b.expectedBaseRelativePathCount<=b.expectedAssembledEntryCount);
 assert(typeof b.namedAllocationId==='string'&&b.namedAllocationId.trim()&&b.namedAllocationId.length<=256&&!/SOURCE_TEMPLATE|NOT_ALLOCATION/.test(b.namedAllocationId));
 assert.equal(body.commit,b.publisherHeadSha);assert.equal(p.head.sha,b.publisherHeadSha);assert.equal(p.base.sha,POLICY.acceptedMain,'main advanced: rebind, never silently renumber');
 assert.deepEqual(observed.parents,[p.base.sha,p.head.sha]);assert.equal(observed.checkout,env.GITHUB_SHA);
 assert.equal(observed.headTree,b.expectedPublisherTreeSha);assert.equal(observed.testedTree,b.expectedPublisherTreeSha);assert.equal(observed.clean,true);
 const reservationBytes=decode(b.reservationReceiptBase64,b.reservationReceiptSha256);
 assert.equal(reservationBytes.length,POLICY.reservationBytes);assert.equal(hash(reservationBytes),POLICY.reservationSha256,'independently fixed actual publisher record');
 const r=jsonBytes(reservationBytes);
 assert.equal(r.schemaVersion,'publisher-forward-version-reservation.v1');assert.equal(r.id,POLICY.reservationId);assert.equal(r.version,POLICY.version);assert.equal(r.previousAcceptedVersion,POLICY.previousVersion);assert.equal(r.solePublisher,POLICY.publisher);
 assert.equal(r.acceptedMain,POLICY.acceptedMain);assert.equal(r.acceptedMainTree,POLICY.acceptedMainTree);assert.equal(r.sourceHead,POLICY.productHead);assert.equal(r.sourceTree,POLICY.productTree);assert.equal(r.sourceParent,POLICY.acceptedMain);assert.equal(r.allocation,POLICY.allocation);assert.equal(r.cloudOnly,true);assert.equal(r.speedOverrideAllowed,false);
 assert.deepEqual(Object.values(r.futureBindings),[null,null,null,null,null,null],'prospective record is not completed execution evidence');
 const freshBytes=decode(b.freshMainAndReservationBindingBase64,b.freshMainAndReservationBindingSha256),f=jsonBytes(freshBytes);
 exact(f,'schemaVersion publisherThreadId repository candidateHeadSha candidateTreeSha reviewedFinalMapSha256 expectedAssembledManifestSha256 observedMainSha mainObservedAt mainRefEvidenceSha256 reservationId reservationVersion reservationReceiptSha256 reservationConflictCheckedAt knownConflictingReservation globalReservationAvailability namedAllocationId validUntil currentActionAuthority');
 assert.equal(f.schemaVersion,'publisher-fresh-main-reservation-binding.v1');assert.equal(f.publisherThreadId,POLICY.publisher);assert.equal(f.repository,POLICY.repository);
 for(const [k,w]of Object.entries({candidateHeadSha:b.publisherHeadSha,candidateTreeSha:b.expectedPublisherTreeSha,reviewedFinalMapSha256:b.reviewedFinalMapSha256,expectedAssembledManifestSha256:b.expectedAssembledManifestSha256,observedMainSha:POLICY.acceptedMain,reservationId:POLICY.reservationId,reservationVersion:POLICY.version,reservationReceiptSha256:POLICY.reservationSha256,namedAllocationId:b.namedAllocationId}))assert.equal(f[k],w,'fresh join '+k);
 hex(f.mainRefEvidenceSha256,64);assert.equal(f.knownConflictingReservation,false);assert.equal(f.globalReservationAvailability,'UNKNOWN; no global availability claim');
 assert(typeof f.currentActionAuthority==='string'&&f.currentActionAuthority.trim()&&f.currentActionAuthority.length<=4096&&!/SOURCE_TEMPLATE|NOT_ALLOCATION/.test(f.currentActionAuthority),'separate current action authority');
 const m=utc(f.mainObservedAt),c=utc(f.reservationConflictCheckedAt),until=utc(f.validUntil);assert(m<=now&&c<=now&&now<until&&until>=m&&until>=c,'fresh unexpired observations');
 return {body,binding:b,reservation:r,reservationBytes,fresh:f,freshBytes,eventBodySha256:hash(bodyRaw),validUntil:until,releaseAcceptance:false};
}
// New forward readers only; legacy readers remain byte-identical.
// Probe headroom is reserved INSIDE the existing limits, never in addition.
function boundedRegularRead(file,maximum,ledger,io=fs){
 assert(path.isAbsolute(file)&&path.resolve(file)===file,'canonical absolute input');
 assert(Number.isSafeInteger(maximum)&&maximum>0&&maximum<=256*1024*1024,'unchanged per-file maximum');
 assert(ledger&&Number.isSafeInteger(ledger.used)&&ledger.used>=0&&Number.isSafeInteger(ledger.limit)&&ledger.limit>0&&ledger.limit<=2*1024*1024*1024&&ledger.used<=ledger.limit,'unchanged cumulative maximum');
 assert.equal(io.realpathSync(path.dirname(file)),path.dirname(file),'no symlinked parent');
 const stamp=s=>[s.dev,s.ino,s.mode,s.uid,s.gid,s.size,s.mtimeMs,s.ctimeMs];
 const before=io.lstatSync(file);
 assert(before.isFile()&&!before.isSymbolicLink()&&Number.isSafeInteger(before.size)&&before.size>=0,'regular no-follow source');
 const expected=before.size;
 assert(expected<maximum,'file and one-byte overrun probe must fit unchanged per-file cap');
 assert(expected+1<=ledger.limit-ledger.used,'reserve content and overrun probe within cumulative cap before open/allocation');
 const fd=io.openSync(file,io.constants.O_RDONLY|io.constants.O_NOFOLLOW);
 try{
  assert.deepEqual(stamp(io.fstatSync(fd)),stamp(before),'stable descriptor before bounded read');
  const output=Buffer.alloc(expected),chunk=Buffer.alloc(Math.min(65536,Math.max(1,expected)));let offset=0;
  function take(length,position){
   assert(length>0&&length<=chunk.length&&length<=ledger.limit-ledger.used,'bounded requested read');
   const count=io.readSync(fd,chunk,0,length,position);
   assert(Number.isSafeInteger(count)&&count>=0&&count<=length,'bounded read result');
   ledger.used+=count;return count;
  }
  while(offset<expected){
   const count=take(Math.min(chunk.length,expected-offset),offset);
   assert(count>0,'file shrank during bounded read');chunk.copy(output,offset,0,count);offset+=count;
  }
  // At most one further byte can be consumed. It was reserved before open.
  const overrun=take(1,offset);assert.equal(overrun,0,'file grew during bounded read');
  assert.deepEqual(stamp(io.fstatSync(fd)),stamp(before),'stable descriptor after bounded read');
  assert.deepEqual(stamp(io.lstatSync(file)),stamp(before),'stable pathname after bounded read');
  return output;
 }finally{io.closeSync(fd);}
}
function verifyCloudRoute(phase){
 assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
 const root=fs.realpathSync(path.resolve(__dirname,'../..')),env=process.env,readLedger={used:0,limit:2*1024*1024*1024};
 const read=(file,maximum=256*1024*1024)=>boundedRegularRead(file,maximum,readLedger);
 const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
 const event=jsonBytes(read(fs.realpathSync(env.GITHUB_EVENT_PATH),4*1024*1024),4*1024*1024),H=event.pull_request.head.sha,T=env.GITHUB_SHA;
 hex(H,40);hex(T,40);
 const observed={checkout:git('rev-parse','HEAD').trim(),parents:git('show','-s','--format=%P',T).trim().split(' '),headTree:git('rev-parse',H+'^{tree}').trim(),testedTree:git('rev-parse',T+'^{tree}').trim(),clean:git('status','--porcelain=v1','--untracked-files=all')===''&&git('ls-files','--others','--exclude-standard','-z')===''};
 const admitted=validateEnvelope({event,env,observed,phase});
 cp.execFileSync('git',['merge-base','--is-ancestor',POLICY.productHead,H],{cwd:root,timeout:5000,stdio:'pipe'});
 assert.equal(git('rev-parse',POLICY.productHead+'^{tree}').trim(),POLICY.productTree);
 assert.equal(git('show','-s','--format=%P',POLICY.productHead).trim(),POLICY.acceptedMain);
 assert.equal(git('rev-parse',POLICY.acceptedMain+'^{tree}').trim(),POLICY.acceptedMainTree);
 const allowed=new Set(['.github/workflows/installed-upgrade-tests.yml','.github/installed-production-baseline.json','scripts/validate-production-sql-batches.js','scripts/validate-sync-current-forward.js','scripts/fixtures/sync-current-forward-20261107.json','scripts/fixtures/onboarding-forward-version-plan-20261107.json','scripts/lib/forward-onboarding-ci.js','scripts/lib/forward-onboarding-workflow-overlay.json','scripts/validate-forward-onboarding-ci.js','scripts/package-forward-onboarding.js','docs/verification/onboarding-forward-ci-20261107.md','app-version.json','index.html','service-worker.js',...OUTPUTS]);
 const changed=git('diff','--no-renames','--name-only','-z',POLICY.productHead,H).split('\0').filter(Boolean);
 for(const p of changed)assert(allowed.has(p),'outside scoped maintenance delta: '+p);
 for(const [p,wanted]of Object.entries(POLICY.productFiles)){
  const bytes=cp.execFileSync('git',['show',POLICY.productHead+':'+p],{cwd:root,timeout:5000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});assert.equal(hash(bytes),wanted,'reviewed product source witness '+p);
  if(!OUTPUTS.includes(p)&&p!=='index.html')assert.equal(hash(read(path.join(root,p))),wanted,'preserve reviewed product repair '+p);
 }
 const rows=[];
 for(const record of git('ls-tree','-r','-z','--full-tree',H).split('\0').filter(Boolean)){
  assert(rows.length<10000);const m=/^(100644|100755|120000) blob ([a-f0-9]{40})\t([^\0]+)$/.exec(record);assert(m);const p=m[3];assert(!path.posix.isAbsolute(p)&&!p.includes('\\')&&!p.split('/').some(x=>!x||x==='.'||x==='..'));
  const full=path.join(root,p),st=fs.lstatSync(full);let bytes;
  if(m[1]==='120000'){assert(st.isSymbolicLink()&&st.size<=256*1024*1024);assert(readLedger.used+st.size<=2*1024*1024*1024);readLedger.used+=st.size;bytes=fs.readlinkSync(full,{encoding:'buffer'});assert(!path.isAbsolute(bytes.toString())&&fs.realpathSync(full).startsWith(root+path.sep),'source link scope');}
  else{assert.equal(st.mode&0o111?'100755':'100644',m[1]);bytes=read(full);}
  assert.equal(blob(bytes),m[2],'committed raw bytes '+p);rows.push({path:p,mode:m[1],type:'blob',gitBlob:m[2],bytes:bytes.length,sha256:hash(bytes)});
 }
 rows.sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
 const b=admitted.binding;assert.equal(rows.length,b.expectedAssembledEntryCount);
 const assembled=Buffer.from(JSON.stringify({schemaVersion:'assembled-git-source-manifest.v1',revision:H,tree:observed.headTree,entryCount:rows.length,reviewedMapSha256:b.reviewedFinalMapSha256,files:rows})+'\n');
 assert(assembled.length<=16*1024*1024);assert.equal(hash(assembled),b.expectedAssembledManifestSha256,'complete raw current source map');
 assert.equal(git('diff','--no-renames','--name-only','-z',POLICY.acceptedMain,H).split('\0').filter(Boolean).length,b.expectedBaseRelativePathCount);
 const byPath=new Map(rows.map(r=>[r.path,r]));
 const recovery=byPath.get(POLICY.versionPlanInputs.recoveryAsset.path);assert(recovery,'bound deployed recovery dependency');
 for(const k of ['bytes','sha256','mode'])assert.equal(recovery[k],POLICY.versionPlanInputs.recoveryAsset[k],'unchanged recovery asset '+k);
 assert.equal(byPath.get('scripts/validate-sync-current-forward.js').sha256,b.qualifierSha256);assert.equal(byPath.get('scripts/fixtures/sync-current-forward-20261107.json').sha256,b.fixtureSha256);
 const app=jsonBytes(read(path.join(root,'app-version.json')));assert.equal(app.version,phase==='canonical-producer'?POLICY.previousVersion:POLICY.version);
 if(phase==='canonical-producer')assert.equal(byPath.get('index.html').sha256,POLICY.productFiles['index.html'],'producer input is reviewed pending product shell');
 assert(Date.now()<admitted.validUntil);assert.equal(git('status','--porcelain=v1','--untracked-files=all'),'');assert.equal(git('rev-parse','HEAD').trim(),T);
 return {...admitted,root,event,observed,rows,readBytes:readLedger.used};
}
function replaceExact(text,needle,replacement,count){
 assert.equal(text.split(needle).length-1,count,'exact targeted replacement '+needle);return text.split(needle).join(replacement);
}
function planVersioning({index,worker,appVersion,recoveryAsset}){
 assert(Buffer.isBuffer(index)&&Buffer.isBuffer(worker)&&Buffer.isBuffer(appVersion)&&Buffer.isBuffer(recoveryAsset));
 assert.equal(worker.length,POLICY.versionPlanInputs.worker.bytes);assert.equal(hash(worker),POLICY.versionPlanInputs.worker.sha256,'exact accepted611 worker input');
 assert.equal(recoveryAsset.length,POLICY.versionPlanInputs.recoveryAsset.bytes);assert.equal(hash(recoveryAsset),POLICY.versionPlanInputs.recoveryAsset.sha256,'exact existing recovery dependency');assert.equal(hash(index),POLICY.productFiles['index.html'],'preserve the reviewed pending index, not accepted-main index');
 assert.equal(appVersion.toString(),'{"version":"611"}\n');
 let html=index.toString('utf8'),sw=worker.toString('utf8');assert(Buffer.from(html).equals(index)&&Buffer.from(sw).equals(worker));
 html=replaceExact(html,'name="app-shell-version" content="611"','name="app-shell-version" content="612"',1);
 for(const [name,n]of [['app-shell-runtime',2],['account-awareness-runtime',1],['settings-optional-ui',1]]){
  html=replaceExact(html,'assets/js/'+name+'.js?v=611','assets/js/'+name+'.js?v=612',n);
  sw=replaceExact(sw,'"/assets/js/'+name+'.js?v=611"','"/assets/js/'+name+'.js?v=612"',1);
 }
 sw=replaceExact(sw,'const CACHE_NAME = "nothingsport-shell-v611";','const CACHE_NAME = "nothingsport-shell-v612";',1);
 sw=replaceExact(sw,'const SHELL_VERSION = "611";','const SHELL_VERSION = "612";',1);
 // Accepted611 has reset-ui cached, but has no local-preference-recovery entry.
 // Bind that exact preimage and unchanged4120-byte dependency before adding it.
 sw=replaceExact(sw,'"/config/preference-reset-ui.js?v=611"','"/config/preference-reset-ui.js?v=612"',1);
 assert.equal(worker.toString('utf8').split('/config/local-preference-recovery.js').length-1,0,'bound611 absence, not an inferred existing cache member');
 sw=replaceExact(sw,'  "/config/preference-reset-ui.js?v=612",\n','  "/config/preference-reset-ui.js?v=612",\n  "/config/local-preference-recovery.js?v=612",\n',1);
 // The existing REQUIRED_SHELL predicate includes js entries; do not weaken or replace it.
 const shell=sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);assert(shell&&shell[1].split('"/config/local-preference-recovery.js?v=612"').length-1===1,'one new required install/cache entry');

 return new Map([['index.html',Buffer.from(html)],['service-worker.js',Buffer.from(sw)],['app-version.json',Buffer.from('{"version":"612"}\n')]]);
}
module.exports={POLICY,OUTPUTS,hash,blob,jsonBytes,decode,validateEnvelope,verifyCloudRoute,planVersioning,replaceExact,boundedRegularRead};
