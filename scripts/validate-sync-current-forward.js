#!/usr/bin/env node
'use strict';
// Exact publisher-reserved forward612 cloud qualification only. Synthetic profiles never identify private phone state.
// External owner records and the later numeric-job join remain required for acceptance.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=fs.realpathSync(path.resolve(__dirname,'..')),clone=x=>JSON.parse(JSON.stringify(x)),read=p=>fs.readFileSync(path.join(root,p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const hex=(v,n)=>assert(typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v),'invalid '+n+'-hex identity');
const integer=(v,min=0)=>assert(Number.isSafeInteger(v)&&v>=min,'invalid bounded integer');
function keys(v,names){assert(v&&typeof v==='object'&&!Array.isArray(v),'object required');assert.deepEqual(Object.keys(v).sort(),names.split(' ').sort(),'closed object keys');}
function text(v){assert(typeof v==='string'&&v.length>0&&Buffer.from(v).toString('utf8')===v,'nonempty valid Unicode string required');return v;}
function utf8(bytes){const value=bytes.toString('utf8');assert(Buffer.from(value).equals(bytes),'invalid UTF-8');for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){assert(i+1<value.length&&value.charCodeAt(++i)>=0xdc00&&value.charCodeAt(i)<=0xdfff,'unpaired surrogate');}else assert(c<0xdc00||c>0xdfff,'unpaired surrogate');}return value;}
function safePath(v){text(v);assert(!v.includes('\\')&&!v.includes('\0')&&!path.posix.isAbsolute(v)&&path.posix.normalize(v)===v&&!v.split('/').some(x=>!x||x==='.'||x==='..'),'unsafe relative path');utf8(Buffer.from(v));return v;}
// Retain C13 read/count bounds; admission adds the selected smaller receipt/body caps.
const limits={sourceEntries:10000,dependencyEntries:40000,fileBytes:256*1024*1024,totalBytes:2*1024*1024*1024,jsonBytes:16*1024*1024,gitBytes:4*1024*1024,gitTimeoutMs:5000,receiptBytes:16384,bodyBytes:65536};
let readBytes=0;
const externalFiles=new Map(),sourceLeaves=new Map(),dependencyLeaves=new Map();
function stamp(s){return [s.dev,s.ino,s.uid,s.gid,s.mode,s.size,s.mtimeMs,s.ctimeMs];}
function rawIdentity(full,max=limits.fileBytes){
 if(normal613Deadline)normal613CheckDeadline();
 const first=fs.lstatSync(full);assert(fs.realpathSync(path.dirname(full))===path.dirname(full),'symlinked parent');
 assert(first.size<=max,'file exceeds finite bound');readBytes+=first.size;assert(readBytes<=limits.totalBytes,'metadata-phase cumulative read bound');
 let bytes;
 if(first.isSymbolicLink())bytes=fs.readlinkSync(full,{encoding:'buffer'});
 else{
  assert(first.isFile(),'regular file or raw link only');assert(first.size<=max,'file exceeds finite bound');
  const fd=fs.openSync(full,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{assert.deepEqual(stamp(fs.fstatSync(fd)),stamp(first),'file replaced before read');bytes=fs.readFileSync(fd);assert.deepEqual(stamp(fs.fstatSync(fd)),stamp(first),'file changed during read');}finally{fs.closeSync(fd);}
 }
 assert(bytes.length<=max);assert.deepEqual(stamp(fs.lstatSync(full)),stamp(first),'file identity drift');
 if(normal613Deadline)normal613CheckDeadline();
 return {bytes,stat:first,identity:{bytes:bytes.length,permissions:(first.mode&0o7777).toString(8).padStart(4,'0'),mode:first.isSymbolicLink()?'120000':first.mode&0o111?'100755':'100644',sha256:sha(bytes),gitBlob:blob(bytes)}};
}
let admissionRoot;
function ownedParents(file){let dir=path.dirname(file);for(;;){assert(dir===admissionRoot||dir.startsWith(admissionRoot+path.sep),'owned directory scope');const st=fs.lstatSync(dir);assert(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===process.geteuid()&&(st.mode&0o022)===0,'owned stable output directory');if(dir===admissionRoot)break;dir=path.dirname(dir);}}
function external(file,max,expected){
 text(file);assert(path.isAbsolute(file)&&path.resolve(file)===file,'absolute canonical output path');assert(file.startsWith(admissionRoot+path.sep),'output escapes admission root');
 ownedParents(file);const got=rawIdentity(file,max);assert(got.stat.isFile()&&got.stat.uid===process.geteuid()&&(got.stat.mode&0o022)===0,'owned immutable regular output required');
 if(expected){hex(expected,64);assert.equal(got.identity.sha256,expected,'external digest mismatch');}
 externalFiles.set(file,{max,digest:got.identity.sha256,stamp:stamp(got.stat)});return got.bytes;
}
function descriptor(d){keys(d,'path bytes sha256');integer(d.bytes);hex(d.sha256,64);const b=external(d.path,limits.jsonBytes,d.sha256);assert.equal(b.length,d.bytes);return b;}
function json(b){const value=JSON.parse(utf8(b));function strings(v){if(typeof v==='string')assert(Buffer.from(v).toString('utf8')===v,'unpaired JSON surrogate');else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){assert(Buffer.from(k).toString('utf8')===k,'unpaired JSON key surrogate');strings(x);}}strings(value);return value;}
function equalIdentity(got,expected){for(const k of ['bytes','mode','sha256','gitBlob'])assert.equal(got[k],expected[k],'raw identity '+k);if(Object.hasOwn(expected,'permissions'))assert.equal(got.permissions,expected.permissions);}
function time(value){text(value);assert(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value),'UTC timestamp required');const t=Date.parse(value);assert(Number.isFinite(t)&&new Date(t).toISOString().slice(0,19)===value.slice(0,19),'invalid UTC time');return t;}
function git(args){return execFileSync('git',args,{cwd:root,encoding:null,maxBuffer:limits.gitBytes,timeout:normal613Deadline?Math.max(1,Math.min(limits.gitTimeoutMs,Math.floor(normal613CheckDeadline()))):limits.gitTimeoutMs,stdio:['ignore','pipe','pipe']});}
function canonicalBase64(value){text(value);const b=Buffer.from(value,'base64');assert(b.length>0&&b.length<=limits.receiptBytes,'bounded base64 record');json(b);assert.equal(b.toString('base64'),value,'noncanonical base64');return b;}
function source(row){const full=path.join(root,safePath(row.path));const got=rawIdentity(full);equalIdentity(got.identity,row);sourceLeaves.set(row.path,{...row});return got.bytes;}
function verifyDeployment(receipt,assembled){
 const body=external(receipt.actualDeploymentSourceManifestPath,limits.jsonBytes,receipt.actualDeploymentSourceManifestSha256),d=json(body);keys(d,'revision bytes files');assert.equal(d.revision,receipt.publisherHeadSha);integer(d.bytes);assert(Array.isArray(d.files));
 const byPath=new Map(assembled.files.map(row=>[row.path,row])),policy=json(source(byPath.get('config/deployment-manifest.json')));
 const secret=name=>name.includes('supabase_keys.txt')||name.split('/').some(part=>part.startsWith('.env'));
 const selected=new Set(assembled.files.filter(row=>!secret(row.path)&&!policy.excludeDirectories.some(prefix=>row.path.startsWith(prefix))&&!policy.excludeFiles.includes(row.path)&&(policy.includeDirectories.some(prefix=>row.path.startsWith(prefix))||policy.includeFiles.includes(row.path)||(!row.path.includes('/')&&policy.rootExtensions.includes(path.extname(row.path))))).map(row=>row.path));
 for(const name of selected){
  if(!name.endsWith('.js'))continue;
  for(const match of utf8(source(byPath.get(name))).matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)){
   const base=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
   const dependency=[base,base+'.js',base+'.json',base+'/index.js'].find(v=>byPath.has(v));if(dependency){assert(!secret(dependency),'excluded dependency');selected.add(dependency);}
  }
 }
 assert.equal(d.files.length,selected.size,'complete deployment projection');const seen=new Set();let total=0;
 for(const row of d.files){
  keys(row,'path gitBlob sourceBytes bytes transform sha256');safePath(row.path);assert(selected.has(row.path)&&!seen.has(row.path),'unexpected/duplicate deployment path');seen.add(row.path);
  const src=byPath.get(row.path),raw=source(src);assert.equal(row.gitBlob,src.gitBlob);assert.equal(row.sourceBytes,raw.length);
  const compact=policy.compactJson&&row.path.endsWith('.json')&&!policy.preserveBytes.includes(row.path),expected=compact?Buffer.from(JSON.stringify(json(raw))+'\n'):raw;
  assert.equal(row.transform,compact?'json-compact':'identity');assert.equal(row.bytes,expected.length);assert.equal(row.sha256,sha(expected));
  const full=path.join(path.dirname(receipt.actualDeploymentSourceManifestPath),row.path);ownedParents(full);const out=rawIdentity(full);assert(out.stat.uid===process.geteuid()&&(out.stat.isSymbolicLink()||(out.stat.mode&0o022)===0),'owned projection output');assert(out.bytes.equals(expected),'materialized output mismatch');assert.equal(out.identity.mode,src.mode,'materialized mode');
  externalFiles.set(full,{max:limits.fileBytes,digest:out.identity.sha256,stamp:stamp(out.stat)});total+=row.bytes;assert(total<=limits.totalBytes);
 }
 assert.equal(d.bytes,total);
}
function verifyDependencies(receipt){
 const proof=receipt.runtime.dependencyProof;keys(proof,'path bytes sha256 schemaVersion');assert.equal(proof.schemaVersion,'canonical-ci-dependencies.v1');
 const bytes=descriptor({path:proof.path,bytes:proof.bytes,sha256:proof.sha256}),d=json(bytes);
 keys(d,'schemaVersion installCommand lockSha256 installedLockSha256 terser fileMapSha256 files auditRemediation');assert.equal(d.schemaVersion,proof.schemaVersion);assert.equal(d.installCommand,'npm ci');assert.equal(d.auditRemediation,false);
 const lockRow=sourceLeaves.get('package-lock.json');assert(lockRow,'tracked committed lock required');const lockBytes=source(lockRow),lock=json(lockBytes);assert.equal(d.lockSha256,sha(lockBytes));
 const installedLock=rawIdentity(path.join(root,'node_modules/.package-lock.json'));assert(installedLock.stat.isFile(),'regular installed lock required');assert.equal(d.installedLockSha256,installedLock.identity.sha256);
 assert(Array.isArray(d.files)&&d.files.length>0&&d.files.length<=limits.dependencyEntries,'finite complete dependency map');
 const seen=new Set();let total=0;
 for(const row of d.files){
  keys(row,row.mode==='120000'?'path bytes permissions mode sha256 gitBlob link':'path bytes permissions mode sha256 gitBlob');safePath(row.path);assert(row.path.startsWith('node_modules/')&&!seen.has(row.path),'dependency path scope/duplicate');seen.add(row.path);
  integer(row.bytes);hex(row.sha256,64);hex(row.gitBlob,40);assert(/^[0-7]{4}$/.test(row.permissions));
  const full=path.join(root,row.path),got=rawIdentity(full);equalIdentity(got.identity,row);assert(['100644','100755','120000'].includes(row.mode));if(row.mode==='120000'){assert.equal(utf8(got.bytes),row.link);assert(!path.isAbsolute(row.link),'absolute dependency link');const target=fs.realpathSync(full),folder=path.join(root,'node_modules');assert(target.startsWith(folder+path.sep),'dependency link escapes local install');}
  const canonical={path:row.path,bytes:row.bytes,permissions:row.permissions,mode:row.mode,sha256:row.sha256,gitBlob:row.gitBlob,...(row.mode==='120000'?{link:row.link}:{})};assert.equal(JSON.stringify(row),JSON.stringify(canonical),'C13 dependency field order');
  dependencyLeaves.set(row.path,{...row});total+=row.bytes;assert(total<=limits.totalBytes);
 }
 const actual=[];
 function walk(dir,depth=0){assert(depth<64,'bounded dependency nesting');for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const name=dir+'/'+entry.name;safePath(name);if(entry.isDirectory()){assert(fs.realpathSync(path.join(root,name))===path.join(root,name),'symlinked dependency directory');walk(name,depth+1);}else{assert(entry.isFile()||entry.isSymbolicLink());actual.push(name);assert(actual.length<=limits.dependencyEntries);}}}
 assert(fs.lstatSync(path.join(root,'node_modules')).isDirectory()&&fs.realpathSync(path.join(root,'node_modules'))===path.join(root,'node_modules'),'candidate-local dependency directory');
 walk('node_modules');assert.deepEqual([...seen],actual,'complete C13 depth-first dependency order');
 // Reviewed C13 algorithm: exact recursive depth-first array/property order.
 assert.equal(d.fileMapSha256,sha(Buffer.from(JSON.stringify(d.files))),'C13 dependency map digest');
 keys(d.terser,'main package version entryIdentity manifestIdentity');assert.equal(d.terser.package,'node_modules/terser');assert.equal(d.terser.version,'5.44.0');assert.equal(lock.packages['node_modules/terser'].version,d.terser.version);
 // The locked owner is explicit; nested entry directories do not select a package.
 const owner=path.join(root,'node_modules','terser');assert(fs.lstatSync(owner).isDirectory());assert.equal(fs.realpathSync(owner),owner,'candidate-local locked Terser owner');
 const manifestPath=path.join(owner,'package.json');assert(fs.lstatSync(manifestPath).isFile());assert.equal(fs.realpathSync(manifestPath),manifestPath,'explicit root package manifest');
 const ownerPackage=json(rawIdentity(manifestPath).bytes);assert.equal(ownerPackage.name,'terser');assert.equal(ownerPackage.version,d.terser.version);assert.equal(path.relative(root,owner),d.terser.package);
 const main=fs.realpathSync(require.resolve('terser'));assert(main.startsWith(owner+path.sep),'resolved entry remains inside locked owner');assert.equal(path.relative(root,main),d.terser.main);
 assert.deepEqual(d.terser.entryIdentity,dependencyLeaves.get(d.terser.main));assert.deepEqual(d.terser.manifestIdentity,dependencyLeaves.get(d.terser.package+'/package.json'));
 return {files:d.files.length,fileMapSha256:d.fileMapSha256,lockSha256:d.lockSha256,installedLockSha256:d.installedLockSha256};
}
function admitLegacy612(){
 const args=process.argv.slice(2);assert(args.length===5&&args[0]==='--full'&&args[1]==='--execution-receipt'&&args[3]==='--execution-receipt-sha256','Only explicit full mode and independently pinned external receipt are supported');hex(args[4],64);
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');assert.equal(process.env.GITHUB_REPOSITORY,'hartican/sportscal');assert.equal(process.env.GITHUB_JOB,'fixture-activation');
 assert(path.isAbsolute(text(process.env.RUNNER_TEMP)));const temp=fs.realpathSync(process.env.RUNNER_TEMP);admissionRoot=path.join(temp,'ns-forward-612-admission');assert.equal(fs.realpathSync(admissionRoot),admissionRoot);assert(!admissionRoot.startsWith(root+path.sep)&&admissionRoot!==root,'receipt root must be outside checkout');const rootStat=fs.lstatSync(admissionRoot);assert(rootStat.isDirectory()&&rootStat.uid===process.geteuid()&&(rootStat.mode&0o022)===0,'owned admission directory');
 const r=json(external(args[2],limits.receiptBytes,args[4]));
 keys(r,'schemaVersion publisherHeadSha publisherTreeSha actualAssembledSourceManifestPath actualAssembledSourceManifestSha256 actualDeploymentSourceManifestPath actualDeploymentSourceManifestSha256 releaseGitSha actualTestedMergeSha actualCloudRunId actualCloudRunAttempt actualCloudJobId namedAllocationId freshMainAndReservationBindingSha256 actualNodeBinarySha256 actualDependencyProofSha256 admissionGranted jobIdKind actualCloudJobKey actualCloudNumericJobId actualWorkflowPath observedAt eventBodySha256 headRole testedCommitRole releaseRole qualifier fixture approvedFinalMap runtime reservation freshMainAndReservationBinding git cloudContext');
 assert.equal(r.schemaVersion,'sync-current-forward-execution-receipt.v1');assert.equal(r.admissionGranted,true);assert.equal(r.jobIdKind,'github-job-key');assert.equal(r.actualCloudJobKey,'fixture-activation');assert.equal(r.actualCloudJobId,'github-job-key:fixture-activation');assert.equal(r.actualCloudNumericJobId,null,'numeric job ID belongs to mandatory later outer join');assert.equal(r.actualWorkflowPath,'.github/workflows/installed-upgrade-tests.yml');
 assert.equal(r.headRole,'pull_request.head.sha');assert.equal(r.testedCommitRole,'pull_request-merge-checkout');assert.equal(r.releaseRole,'source-qualification-candidate');assert(text(r.namedAllocationId).length<=256&&r.namedAllocationId.trim().length>0,'finite allocation ID');
 for(const key of ['publisherHeadSha','publisherTreeSha','releaseGitSha','actualTestedMergeSha'])hex(r[key],40);
 for(const key of ['actualAssembledSourceManifestSha256','actualDeploymentSourceManifestSha256','freshMainAndReservationBindingSha256','actualNodeBinarySha256','actualDependencyProofSha256','eventBodySha256'])hex(r[key],64);
 assert(/^[1-9][0-9]*$/.test(r.actualCloudRunId));integer(r.actualCloudRunAttempt,1);assert.equal(r.actualCloudRunId,process.env.GITHUB_RUN_ID);assert.equal(String(r.actualCloudRunAttempt),process.env.GITHUB_RUN_ATTEMPT);
 const eventFile=text(process.env.GITHUB_EVENT_PATH),eventRaw=rawIdentity(eventFile,4*1024*1024),event=json(eventRaw.bytes);externalFiles.set(eventFile,{max:4*1024*1024,digest:sha(eventRaw.bytes),stamp:stamp(eventRaw.stat)});
 assert.equal(event.repository.full_name,'hartican/sportscal');integer(event.number,1);assert.equal(event.pull_request.number,event.number);assert.equal(event.pull_request.draft,false);assert.equal(event.action,'ready_for_review');
 const bodyBytes=Buffer.from(text(event.pull_request.body),'utf8');assert(bodyBytes.length<=limits.bodyBytes);const body=json(bodyBytes);assert.equal(JSON.stringify(body),event.pull_request.body,'canonical PR body has no LF/whitespace or duplicate keys');assert.equal(sha(bodyBytes),r.eventBodySha256);
 keys(body,'schemaVersion scope commit testsAndResults dependencies databaseAndConfigChanges knownRisks rollback sourceQualificationBinding');assert.equal(body.schemaVersion,'ns-release-handover.forward.v1');assert.equal(body.commit,r.publisherHeadSha);
 for(const [name,max]of Object.entries({scope:4096,testsAndResults:8192,dependencies:4096,databaseAndConfigChanges:4096,knownRisks:4096,rollback:4096})){const value=text(body[name]);assert(value.length<=max&&value.trim().length>0,'typed handover text '+name);}
 const b=body.sourceQualificationBinding;keys(b,'schemaVersion phase repository publisherHeadSha expectedPublisherTreeSha reviewedFinalMapSha256 expectedAssembledManifestSha256 expectedAssembledEntryCount expectedBaseRelativePathCount qualifierSha256 fixtureSha256 namedAllocationId reservationReceiptSha256 freshMainAndReservationBindingSha256 reservationReceiptBase64 freshMainAndReservationBindingBase64');assert.equal(b.schemaVersion,'sync-current-forward-binding.v1');assert.equal(b.phase,'qualification');assert.equal(b.repository,'hartican/sportscal');
 assert.equal(b.publisherHeadSha,r.publisherHeadSha);assert.equal(b.expectedPublisherTreeSha,r.publisherTreeSha);assert.equal(b.namedAllocationId,r.namedAllocationId);assert.equal(b.expectedAssembledManifestSha256,r.actualAssembledSourceManifestSha256);assert.equal(b.freshMainAndReservationBindingSha256,r.freshMainAndReservationBindingSha256);
 for(const key of ['reviewedFinalMapSha256','expectedAssembledManifestSha256','qualifierSha256','fixtureSha256','reservationReceiptSha256','freshMainAndReservationBindingSha256'])hex(b[key],64);integer(b.expectedAssembledEntryCount,1);integer(b.expectedBaseRelativePathCount,1);assert(b.expectedAssembledEntryCount<=limits.sourceEntries&&b.expectedBaseRelativePathCount<=b.expectedAssembledEntryCount);
 keys(r.cloudContext,'repository eventName pullRequestNumber ref runId runAttempt jobKey');assert(/^[1-9][0-9]*$/.test(r.cloudContext.pullRequestNumber));
 assert.deepEqual(r.cloudContext,{repository:'hartican/sportscal',eventName:'pull_request',pullRequestNumber:String(event.number),ref:process.env.GITHUB_REF,runId:r.actualCloudRunId,runAttempt:r.actualCloudRunAttempt,jobKey:'fixture-activation'});assert.equal(r.cloudContext.ref,'refs/pull/'+event.number+'/merge');
 keys(r.git,'headSha headTree testedMergeSha testedTree baseSha testedMergeParents trackedSourceUnchanged');assert.equal(r.git.trackedSourceUnchanged,true);assert.equal(r.git.baseSha,'4bff7ada7d03c3bff52a262f58e630fe47848a74','accepted611 base, not historical M4');assert.equal(event.pull_request.head.sha,r.publisherHeadSha);assert.equal(r.releaseGitSha,r.publisherHeadSha);assert.equal(r.actualTestedMergeSha,process.env.GITHUB_SHA);
 const identities=utf8(git(['rev-parse','HEAD','HEAD^{tree}',r.publisherHeadSha+'^{tree}'])).trim().split('\n');assert.deepEqual(identities,[r.actualTestedMergeSha,r.publisherTreeSha,r.publisherTreeSha]);
 const parents=utf8(git(['show','-s','--format=%P',r.actualTestedMergeSha])).trim().split(' ');assert.deepEqual(parents,[event.pull_request.base.sha,r.publisherHeadSha]);
 assert.deepEqual(r.git,{headSha:r.publisherHeadSha,headTree:r.publisherTreeSha,testedMergeSha:r.actualTestedMergeSha,testedTree:r.publisherTreeSha,baseSha:event.pull_request.base.sha,testedMergeParents:parents,trackedSourceUnchanged:true});
 keys(r.approvedFinalMap,'reviewedMapSha256 expectedTree entryCount baseRelativePathCount assembledManifestSha256');assert.deepEqual(r.approvedFinalMap,{reviewedMapSha256:b.reviewedFinalMapSha256,expectedTree:r.publisherTreeSha,entryCount:b.expectedAssembledEntryCount,baseRelativePathCount:b.expectedBaseRelativePathCount,assembledManifestSha256:b.expectedAssembledManifestSha256});
 const assembledBytes=external(r.actualAssembledSourceManifestPath,limits.jsonBytes,r.actualAssembledSourceManifestSha256),a=json(assembledBytes);keys(a,'schemaVersion revision tree entryCount reviewedMapSha256 files');assert.equal(a.schemaVersion,'assembled-git-source-manifest.v1');assert.equal(a.revision,r.publisherHeadSha);assert.equal(a.tree,r.publisherTreeSha);assert.equal(a.reviewedMapSha256,b.reviewedFinalMapSha256);assert.equal(a.entryCount,b.expectedAssembledEntryCount);assert(Array.isArray(a.files)&&a.files.length===a.entryCount);
 const canonical={schemaVersion:a.schemaVersion,revision:a.revision,tree:a.tree,entryCount:a.entryCount,reviewedMapSha256:a.reviewedMapSha256,files:[]};let previous=null,total=0;
 for(const row of a.files){keys(row,'path mode type gitBlob bytes sha256');safePath(row.path);assert.equal(row.type,'blob');assert(['100644','100755','120000'].includes(row.mode));hex(row.gitBlob,40);hex(row.sha256,64);integer(row.bytes);assert(row.bytes<=limits.fileBytes);if(previous!==null)assert(Buffer.compare(Buffer.from(previous),Buffer.from(row.path))<0,'raw UTF-8 entry order');previous=row.path;total+=row.bytes;assert(total<=limits.totalBytes);source(row);canonical.files.push({path:row.path,mode:row.mode,type:row.type,gitBlob:row.gitBlob,bytes:row.bytes,sha256:row.sha256});}
 assert(assembledBytes.equals(Buffer.from(JSON.stringify(canonical)+'\n')),'canonical complete assembled bytes');
 const treeBytes=git(['ls-tree','-r','-z','--full-tree','HEAD']),records=utf8(treeBytes).split('\0');assert.equal(records.pop(),'');const actualTree=records.map(record=>{const split=record.indexOf('\t');assert(split>0);const [mode,type,gitBlob]=record.slice(0,split).split(' ');return {path:safePath(record.slice(split+1)),mode,type,gitBlob};}).sort((x,y)=>Buffer.compare(Buffer.from(x.path),Buffer.from(y.path)));
 assert.deepEqual(actualTree,a.files.map(row=>({path:row.path,mode:row.mode,type:row.type,gitBlob:row.gitBlob})),'actual entire Git tree');
 for(const [name,expected]of [['qualifier','scripts/validate-sync-current-forward.js'],['fixture','scripts/fixtures/sync-current-forward-20261107.json']]){const d=r[name];keys(d,'path bytes sha256 gitBlob mode');assert.equal(d.path,expected);const row=sourceLeaves.get(expected);assert(row);assert.deepEqual(d,{path:row.path,bytes:row.bytes,sha256:row.sha256,gitBlob:row.gitBlob,mode:row.mode});assert.equal(d.sha256,b[name+'Sha256']);}
 keys(r.reservation,'id version receipt');assert.equal(r.reservation.id,'NS-ONBOARDING-FORWARD-612-20261107');assert.equal(r.reservation.version,'612');const reservationBytes=descriptor(r.reservation.receipt);assert.equal(sha(reservationBytes),'40f49544cb207c3c1bf7c1da3cfd1c6c1e527ddb36003ee6067b0fb837a378ed');assert.equal(sha(reservationBytes),b.reservationReceiptSha256);assert(reservationBytes.equals(canonicalBase64(b.reservationReceiptBase64)));const reservation=json(reservationBytes);assert.equal(reservation.id,r.reservation.id);assert.equal(reservation.version,'612');
 keys(r.freshMainAndReservationBinding,'receipt');const freshBytes=descriptor(r.freshMainAndReservationBinding.receipt);assert.equal(sha(freshBytes),r.freshMainAndReservationBindingSha256);assert(freshBytes.equals(canonicalBase64(b.freshMainAndReservationBindingBase64)));const fresh=json(freshBytes);
 keys(fresh,'schemaVersion publisherThreadId repository candidateHeadSha candidateTreeSha reviewedFinalMapSha256 expectedAssembledManifestSha256 observedMainSha mainObservedAt mainRefEvidenceSha256 reservationId reservationVersion reservationReceiptSha256 reservationConflictCheckedAt knownConflictingReservation globalReservationAvailability namedAllocationId validUntil currentActionAuthority');assert.equal(fresh.schemaVersion,'publisher-fresh-main-reservation-binding.v1');assert.equal(fresh.publisherThreadId,'01a0d5ba-943d-74e0-af7f-dab4fb2bdda4');assert.equal(fresh.repository,'hartican/sportscal');assert.equal(fresh.candidateHeadSha,r.publisherHeadSha);assert.equal(fresh.candidateTreeSha,r.publisherTreeSha);assert.equal(fresh.reviewedFinalMapSha256,b.reviewedFinalMapSha256);assert.equal(fresh.expectedAssembledManifestSha256,b.expectedAssembledManifestSha256);assert.equal(fresh.observedMainSha,r.git.baseSha);hex(fresh.mainRefEvidenceSha256,64);assert.equal(fresh.reservationId,r.reservation.id);assert.equal(fresh.reservationVersion,'612');assert.equal(fresh.reservationReceiptSha256,b.reservationReceiptSha256);assert.equal(fresh.knownConflictingReservation,false);assert.equal(fresh.globalReservationAvailability,'UNKNOWN; no global availability claim');assert.equal(fresh.namedAllocationId,r.namedAllocationId);assert(text(fresh.currentActionAuthority)!=='SOURCE_TEMPLATE_ONLY_NOT_ALLOCATION');
 const now=Date.now(),observed=time(r.observedAt),main=time(fresh.mainObservedAt),conflict=time(fresh.reservationConflictCheckedAt),until=time(fresh.validUntil);assert(main<=observed&&conflict<=observed&&observed<=now&&now<until,'future/expired/inconsistent observation');
 keys(r.runtime,'node platform arch npm nodeBinary dependencyProof');assert.equal(r.runtime.node,'v24.21.0');assert.equal(r.runtime.platform,'linux');assert.equal(r.runtime.arch,'x64');assert.equal(process.version,r.runtime.node);assert.equal(process.platform,r.runtime.platform);assert.equal(process.arch,r.runtime.arch);assert(/^\d+\.\d+\.\d+$/.test(text(r.runtime.npm)));
 keys(r.runtime.nodeBinary,'path bytes mode permissions sha256 gitBlob');assert.equal(r.runtime.nodeBinary.path,fs.realpathSync(process.execPath));const node=rawIdentity(r.runtime.nodeBinary.path);equalIdentity(node.identity,r.runtime.nodeBinary);assert.equal(node.identity.sha256,r.actualNodeBinarySha256);assert(node.stat.isFile()&&(node.stat.mode&0o111)!==0);
 assert.equal(r.runtime.dependencyProof.sha256,r.actualDependencyProofSha256);const dependency=verifyDependencies(r);verifyDeployment(r,a);
 return {receipt:r,receiptPath:args[2],receiptSha256:args[4],validUntil:until,eventBodySha256:r.eventBodySha256,dependency,sourceEntryCount:a.entryCount,sourceReviewDigestIsOwnerMetadata:true,numericJobOuterJoinRequired:true,releaseAcceptance:false};
}
// Additive normal613 source proposal. External owner acknowledgement is not authenticated by these local checks.
const NORMAL613=Object.freeze({base:'2e92211c700c40b2b508fc636a002868c61a7579',product:'491d0ebcb2210b29a1ae6164c0c4deef1b04f2ec',productTree:'b69736ee739e7b31eebe58108c14889a333a756c',fixture:'scripts/fixtures/sync-normal-613-20261112.json',reservation:'ns-app-version-613-sportsyurt-20261112',reservationHash:'daa00a480a28b0cca1d2f9922c82fc9394a5460b0d45f87c3566e42b58a473d7'});
const NORMAL613_SOURCE_PINS=Object.freeze({"index.html":{"mode":"100644","bytes":997335,"gitBlob":"8880588632cb9590330a97b00a4b7167610614f7","sha256":"2dec08dca491fd65e6ab1b15f72bed2dd23f547558f1c27eb736ef45ae75ee02"},"config/preference-intent-reconcile.js":{"mode":"100644","bytes":29172,"gitBlob":"b0de06881c70ff23f3e233e0e642131bc6a9521a","sha256":"442a7cc7273b3296708daea0405709a1143e707695ca8912046848f78598fcda"},"config/profile-storage.js":{"mode":"100644","bytes":39704,"gitBlob":"673077fd7bea72c737dacedf088bfbe112288c50","sha256":"8fdd874dbf6a537cf3dbc6b0e7e1593323ee2aebf36799aa51d95e8818f25a08"},"config/server-sync.js":{"mode":"100644","bytes":51507,"gitBlob":"5998bc76c7b871c01783b71a2821384754905d41","sha256":"e3dde8f3d35b9fb1b4f66d317922124ffdb25b3cf71c6ad9df512adbbf148569"},"config/discovery-catalogue.js":{"mode":"100644","bytes":26964,"gitBlob":"70c55c606c67c8ede3c959fe6d2f025656e64cf2","sha256":"a51d1c71f00427dd8359b386d31312b4e251eaa5843db88543366cf05bffabf2"},"config/account-sync-diagnostic.js":{"mode":"100644","bytes":12709,"gitBlob":"4f7b8dc5d819de1d1586c4664657d6f8a02b7031","sha256":"3bf9d2657b16752260fb53f6cd29517f67ad1a5e88d7817bd71652e1d0ff68df"},"assets/js/account-awareness-runtime.js":{"mode":"100644","bytes":43800,"gitBlob":"2df38cbf45dc311a11d80d410e70954334481d11","sha256":"9e726a9887cdae8329a6ae15aace31a309a04722e5ab0f709a5a6b275f411274"},"assets/js/app-shell-runtime.js":{"mode":"100644","bytes":679697,"gitBlob":"83097c2d01e3b5b6d37dbbe0b9f4c50c723d062f","sha256":"896d2cbbd07946e04b415581a26c1dff9b51fdf918cda6bb23b00b808e3a1fb9"},"scripts/lib/user-state-selection-writer-tests.js":{"mode":"100644","bytes":19746,"gitBlob":"d943a31b1133df35fe7d65a16eae02d42c470364","sha256":"50ee77985890d68ba83bffac88f58691dd585de99a2e8a06719af95aa96482db"},"scripts/lib/user-state-selection-sdk-tests.cjs":{"mode":"100644","bytes":7697,"gitBlob":"0910be3039da757c824011b6f9150d84cbc16948","sha256":"5e6e0394a5454cadf137fb5e8de1cf67e878e542d4859c54b2e5ce6ca9dcec8e"},"scripts/lib/user-state-optional-view-tests.js":{"mode":"100644","bytes":8407,"gitBlob":"cf0c85be1ca1bb57b081576ce79073f9f9a05b9a","sha256":"1bd8e368efb764661c755f7613fef971d43c5ecc8c81ea2b84961b43c3441b71"},"config/rating-system.js":{"mode":"100644","bytes":5813,"gitBlob":"ec7b85bf6b9fbfd0fc673dcf255fed0875508d36","sha256":"1c55664fd383ff07e599e8ad31e1b87587aae86b52e909cc50fa1471611d00da"},"config/follow-first.js":{"mode":"100644","bytes":73598,"gitBlob":"cbe1efd7e7c349f6a20e96b0467f3a5090317e01","sha256":"e0f88352af459638e0a51d954bdc98efe723de5c5400478016dc9a16233dd543"},"config/competition-classification.js":{"mode":"100644","bytes":5008,"gitBlob":"c1291edba0a56d264dd1443e76aaa1ae14cceb8b","sha256":"2e0fd8ee374712192d56f31a895567ecade881694c4bb2f3782097fcf7f6acc7"},"config/user-state-sync.js":{"mode":"100644","bytes":13352,"gitBlob":"9ddf101ea9a73e6b3d24196631392a0d8d76a83e","sha256":"74cf255a546dcf3d5ab9797281991c8ec742ae07f5f5c69dbca08e4cfa72a7d1"},"scripts/validate-sync608-reported-hold.js":{"mode":"100644","bytes":71098,"gitBlob":"a08918680f1719abb2d899b3c000c5984a4abbd9","sha256":"818f96bbd68a6b6c2adda4bb2a46ba271273933b3a551e44edebbad66bfce562"},"config/fantasy-deadline-ui.js":{"mode":"100644","bytes":58297,"gitBlob":"bcaa8d837e52e0cc6645f4b434d0e9e0b1cb5091","sha256":"c17bcf87249d18ea922637bc3a9872ce4f843f6077d93e180e032bbce0f87d9c"},"scripts/validate-new-user-journey.js":{"mode":"100644","bytes":107749,"gitBlob":"565615aaf3aafdcb5ebe5b20aeca4a24795bfa3d","sha256":"c24ce31ad61a764117b311153356e70cbe988dee710405e1fabcc625f9cb57fd"}});
let normal613Deadline=null;
function normal613CheckDeadline(){
 if(!normal613Deadline)return limits.gitTimeoutMs;
 const d=normal613Deadline,wall=Date.now(),elapsed=Number(process.hrtime.bigint()-d.begin)/1e6;
 assert(Number.isSafeInteger(wall)&&wall>=d.lastWall&&Math.abs((wall-d.wall)-elapsed)<=1000,'normal613 clock integrity');
 d.lastWall=wall;assert(wall<d.until&&elapsed<d.remaining,'normal613 action expired');
 return d.remaining-elapsed;
}
function normal613ActualReference(value){
 const token=text(value).trim().toUpperCase();
 assert(token.length>0&&!["UNBOUND","UNKNOWN","SOURCE_TEMPLATE_ONLY_NOT_ALLOCATION","SOURCE_TEMPLATE_NOT_ADMISSION","RESERVED_WORKING_NOT_READY","FORWARD612_SOURCE_TEMPLATE_UNPARSED_UNRUN_NOT_ADMISSION","FORWARD612_SELECTED_SOURCE_ONLY_UNPARSED_UNRUN","FUTURE_FULL_QUALIFIER_SOURCE_PREPARATION_UNPARSED_UNRUN_UNREGISTERED","PROPOSED_UNBOUND_NOT_EXECUTION_AUTHORITY"].includes(token),'normal613 actual reference cannot be a source/preparation sentinel');
 return value;
}
function normal613Record(d){const bytes=descriptor(d),value=json(bytes);assert(bytes.equals(Buffer.from(JSON.stringify(value)+'\n')),'canonical owned normal613 record');return value;}
function normal613Reservation(value){
 assert.equal(typeof value,'string');assert.equal(value.length,1816);assert(/^[A-Za-z0-9+/]+$/.test(value),'canonical unpadded reservation encoding');
 const bytes=Buffer.from(value,'base64');assert.equal(bytes.length,1362);assert.equal(bytes.toString('base64'),value);assert.equal(sha(bytes),NORMAL613.reservationHash);
 const record=json(bytes);keys(record,'schemaVersion issuedAtUtc reservationId version status sourceOwner integrationOwner publisher queue commentId commentReadbackExact recordedBase candidateSha candidateTree pr testSlotAllocated testsDispatched published deployed constraints evidenceBoundary');
 assert.equal(record.schemaVersion,'ns-app-version-reservation.v1');assert.equal(record.reservationId,NORMAL613.reservation);assert.equal(record.version,'613');assert.equal(record.status,'RESERVED_WORKING_NOT_READY');
 assert.equal(record.sourceOwner,'syREBRAND');assert.equal(record.integrationOwner,'nsRELEASE');assert.equal(record.publisher,'nsPUBLISH');assert.equal(record.recordedBase,NORMAL613.base);assert.equal(record.queue,'https://github.com/hartican/sportscal/issues/28');assert.equal(record.commentId,6813306721);assert.equal(record.commentReadbackExact,true);
 for(const k of ['candidateSha','candidateTree','pr'])assert.equal(record[k],null);
 for(const k of ['testSlotAllocated','testsDispatched','published','deployed'])assert.equal(record[k],false);
 return bytes;
}
function normal613Action(a,b,r,fresh,now){
 keys(a,'schemaVersion phase purpose allocationId laneId ownedOperationId allocatedAt admittedAt startedAt observationAt validUntil maxWallMs monotonicElapsedMs hardTimeoutMs');
 const intent=b.actionIntent;assert.equal(a.schemaVersion,'normal613-owned-action-observation.v1');assert.equal(a.phase,'qualification');assert.equal(a.purpose,'normal613-qualification');
 for(const k of ['allocationId','laneId','ownedOperationId','validUntil','maxWallMs'])assert.equal(a[k],intent[k]);
 const allocated=time(a.allocatedAt),admitted=time(a.admittedAt),started=time(a.startedAt),observation=time(a.observationAt),until=time(a.validUntil);
 assert(allocated<=started&&started<=admitted&&admitted<=observation&&observation<=now,'ordered nonfuture owned observations');assert.equal(a.admittedAt,r.observedAt);
 for(const t of [allocated,admitted,started,observation])assert(t<until&&now-t<=86400000,'fresh observations and strictly future expiry at allocation/admission/start');
 assert(now<until);assert.equal(a.validUntil,fresh.validUntil);integer(a.maxWallMs,1);assert(a.maxWallMs<=900000,'unchanged15minute job cap');integer(a.monotonicElapsedMs);integer(a.hardTimeoutMs,1);assert(a.hardTimeoutMs<=120000,'unchanged qualifier command cap');
 assert(Math.abs(a.monotonicElapsedMs-(observation-started))<=1000,'owned monotonic/wall observation join');
 const elapsed=a.monotonicElapsedMs+(now-observation),remaining=Math.min(until-now,a.maxWallMs-elapsed,a.hardTimeoutMs,120000);
 assert(remaining>0&&a.hardTimeoutMs<=Math.min(until-observation,a.maxWallMs-a.monotonicElapsedMs),'caller must arm a hard owned timeout before invoking qualifier');
 // The reviewed existing workflow must enforce the hard process deadline and owned child cleanup.
 // This record is a consistency witness, not authentication that a caller actually enforced it.
 normal613Deadline={begin:process.hrtime.bigint(),wall:now,lastWall:now,until,remaining};
 const watchdog=setTimeout(()=>{console.error('normal613 owned deadline exceeded');process.exit(124);},Math.max(1,Math.floor(remaining)));watchdog.unref();
 normal613CheckDeadline();
}
function admitNormal613(){
 const args=process.argv.slice(2);assert(args.length===5&&args[0]==='--normal613-full'&&args[1]==='--execution-receipt'&&args[3]==='--execution-receipt-sha256','Only explicit full mode and independently pinned external receipt are supported');hex(args[4],64);
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');assert.equal(process.env.GITHUB_REPOSITORY,'hartican/sportscal');assert.equal(process.env.GITHUB_JOB,'fixture-activation');
 assert(path.isAbsolute(text(process.env.RUNNER_TEMP)));const temp=fs.realpathSync(process.env.RUNNER_TEMP);admissionRoot=path.join(temp,'ns-normal-613-admission');assert.equal(fs.realpathSync(admissionRoot),admissionRoot);assert(!admissionRoot.startsWith(root+path.sep)&&admissionRoot!==root,'receipt root must be outside checkout');const rootStat=fs.lstatSync(admissionRoot);assert(rootStat.isDirectory()&&rootStat.uid===process.geteuid()&&(rootStat.mode&0o022)===0,'owned admission directory');
 const receiptBytes=external(args[2],limits.receiptBytes,args[4]),r=json(receiptBytes);assert(receiptBytes.equals(Buffer.from(JSON.stringify(r)+'\n')),'canonical normal613 receipt');
 keys(r,'schemaVersion publisherHeadSha publisherTreeSha actualAssembledSourceManifestPath actualAssembledSourceManifestSha256 actualDeploymentSourceManifestPath actualDeploymentSourceManifestSha256 releaseGitSha actualTestedMergeSha actualCloudRunId actualCloudRunAttempt actualCloudJobId namedAllocationId freshMainAndReservationBindingSha256 actualNodeBinarySha256 actualDependencyProofSha256 admissionGranted jobIdKind actualCloudJobKey actualCloudNumericJobId actualWorkflowPath observedAt eventBodySha256 headRole testedCommitRole releaseRole qualifier fixture approvedFinalMap runtime reservation freshMainAndReservationBinding git cloudContext normal613Action normal613Intent normal613Ack');
 assert.equal(r.schemaVersion,'normal613-qualification-execution-receipt.v1');assert.equal(r.admissionGranted,true);assert.equal(r.jobIdKind,'github-job-key');assert.equal(r.actualCloudJobKey,'fixture-activation');assert.equal(r.actualCloudJobId,'github-job-key:fixture-activation');assert.equal(r.actualCloudNumericJobId,null,'numeric job ID belongs to mandatory later outer join');assert.equal(r.actualWorkflowPath,'.github/workflows/installed-upgrade-tests.yml');
 assert.equal(r.headRole,'pull_request.head.sha');assert.equal(r.testedCommitRole,'pull_request-merge-checkout');assert.equal(r.releaseRole,'source-qualification-candidate');assert(text(r.namedAllocationId).length<=256&&r.namedAllocationId.trim().length>0,'finite allocation ID');
 for(const key of ['publisherHeadSha','publisherTreeSha','releaseGitSha','actualTestedMergeSha'])hex(r[key],40);
 for(const key of ['actualAssembledSourceManifestSha256','actualDeploymentSourceManifestSha256','freshMainAndReservationBindingSha256','actualNodeBinarySha256','actualDependencyProofSha256','eventBodySha256'])hex(r[key],64);
 assert(/^[1-9][0-9]*$/.test(r.actualCloudRunId));integer(r.actualCloudRunAttempt,1);assert.equal(r.actualCloudRunId,process.env.GITHUB_RUN_ID);assert.equal(String(r.actualCloudRunAttempt),process.env.GITHUB_RUN_ATTEMPT);
 const eventFile=text(process.env.GITHUB_EVENT_PATH),eventRaw=rawIdentity(eventFile,4*1024*1024),event=json(eventRaw.bytes);externalFiles.set(eventFile,{max:4*1024*1024,digest:sha(eventRaw.bytes),stamp:stamp(eventRaw.stat)});
 assert.equal(event.repository.full_name,'hartican/sportscal');integer(event.number,1);assert.equal(event.pull_request.number,event.number);assert.equal(event.pull_request.draft,false);assert.equal(event.action,'ready_for_review');
 const bodyBytes=Buffer.from(text(event.pull_request.body),'utf8');assert(bodyBytes.length<=limits.bodyBytes);const body=json(bodyBytes);assert.equal(JSON.stringify(body),event.pull_request.body,'canonical PR body has no LF/whitespace or duplicate keys');assert.equal(sha(bodyBytes),r.eventBodySha256);
 keys(body,'schemaVersion scope commit testsAndResults dependencies databaseAndConfigChanges knownRisks rollback sourceQualificationBinding');assert.equal(body.schemaVersion,'ns-release-handover.normal613.v1');assert.equal(body.commit,r.publisherHeadSha);
 for(const [name,max]of Object.entries({scope:4096,testsAndResults:8192,dependencies:4096,databaseAndConfigChanges:4096,knownRisks:4096,rollback:4096})){const value=text(body[name]);assert(value.length<=max&&value.trim().length>0,'typed handover text '+name);}
 const b=body.sourceQualificationBinding;
 keys(b,'schemaVersion phase repository preparedForBaseSha productSourceSha productSourceTree publisherHeadSha expectedPublisherTreeSha reviewedFinalMapSha256 expectedAssembledManifestSha256 expectedSourceEntryCount expectedBaseRelativePathCount qualifier fixture reservation actionIntent reservationReceiptBase64');
 assert.equal(b.schemaVersion,'normal-ready-613-binding.v1');assert.equal(b.phase,'qualification');assert.equal(b.repository,'hartican/sportscal');assert.equal(b.preparedForBaseSha,NORMAL613.base);assert.equal(b.productSourceSha,NORMAL613.product);assert.equal(b.productSourceTree,NORMAL613.productTree);
 assert.equal(b.publisherHeadSha,r.publisherHeadSha);assert.equal(b.expectedPublisherTreeSha,r.publisherTreeSha);assert.equal(b.expectedAssembledManifestSha256,r.actualAssembledSourceManifestSha256);
 for(const k of ['reviewedFinalMapSha256','expectedAssembledManifestSha256'])hex(b[k],64);
 integer(b.expectedSourceEntryCount,1);integer(b.expectedBaseRelativePathCount,1);assert(b.expectedSourceEntryCount<=limits.sourceEntries&&b.expectedBaseRelativePathCount<=b.expectedSourceEntryCount);
 keys(b.actionIntent,'allocationId laneId ownedOperationId purpose intentSha256 sourceReviewId sourceReviewSha256 priorOwnedClosureReference validUntil maxWallMs resultContentDispositionSha256');
 assert.equal(b.actionIntent.purpose,'normal613-qualification');assert.equal(b.actionIntent.allocationId,r.namedAllocationId);
 for(const k of ['allocationId','laneId','ownedOperationId','sourceReviewId','priorOwnedClosureReference']){assert(text(b.actionIntent[k]).trim().length>0&&b.actionIntent[k].length<=256);normal613ActualReference(b.actionIntent[k]);}
 for(const k of ['intentSha256','sourceReviewSha256','resultContentDispositionSha256'])hex(b.actionIntent[k],64);
 assert.equal(b.actionIntent.intentSha256,r.normal613Intent.sha256);integer(b.actionIntent.maxWallMs,1);assert(b.actionIntent.maxWallMs<=900000);
 keys(b.reservation,'schemaVersion reservationId version rawBytes rawSha256 queue commentId');assert.deepEqual(b.reservation,{schemaVersion:'ns-app-version-reservation.v1',reservationId:NORMAL613.reservation,version:'613',rawBytes:1362,rawSha256:NORMAL613.reservationHash,queue:'https://github.com/hartican/sportscal/issues/28',commentId:6813306721});
 keys(r.reservation,'id version receipt');assert.equal(r.reservation.id,NORMAL613.reservation);assert.equal(r.reservation.version,'613');
 const reservationBytes=descriptor(r.reservation.receipt);assert.equal(reservationBytes.length,1362);assert.equal(sha(reservationBytes),NORMAL613.reservationHash);assert(reservationBytes.equals(normal613Reservation(b.reservationReceiptBase64)));
 keys(r.freshMainAndReservationBinding,'receipt');const freshBytes=descriptor(r.freshMainAndReservationBinding.receipt);assert.equal(sha(freshBytes),r.freshMainAndReservationBindingSha256);const fresh=json(freshBytes);assert(freshBytes.equals(Buffer.from(JSON.stringify(fresh)+'\n')),'canonical fresh normal613 record');
 keys(fresh,'schemaVersion phase purpose publisherThreadId repository candidateHeadSha candidateTreeSha reviewedFinalMapSha256 expectedAssembledManifestSha256 observedMainSha mainObservedAt mainRefEvidenceSha256 reservationId reservationVersion reservationReceiptSha256 reservationConflictCheckedAt knownConflictingReservation globalReservationAvailability namedAllocationId validUntil currentActionAuthority');
 assert.equal(fresh.schemaVersion,'normal613-fresh-main-reservation-binding.v1');assert.equal(fresh.phase,'qualification');assert.equal(fresh.purpose,'normal613-qualification');assert.equal(fresh.publisherThreadId,'01a0d5ba-943d-74e0-af7f-dab4fb2bdda4');assert.equal(fresh.repository,'hartican/sportscal');assert.equal(fresh.candidateHeadSha,r.publisherHeadSha);assert.equal(fresh.candidateTreeSha,r.publisherTreeSha);assert.equal(fresh.reviewedFinalMapSha256,b.reviewedFinalMapSha256);assert.equal(fresh.expectedAssembledManifestSha256,b.expectedAssembledManifestSha256);assert.equal(fresh.observedMainSha,NORMAL613.base);hex(fresh.mainRefEvidenceSha256,64);
 assert.equal(fresh.reservationId,NORMAL613.reservation);assert.equal(fresh.reservationVersion,'613');assert.equal(fresh.reservationReceiptSha256,NORMAL613.reservationHash);assert.equal(fresh.knownConflictingReservation,false);assert.equal(fresh.globalReservationAvailability,'UNKNOWN; no global availability claim');assert.equal(fresh.namedAllocationId,r.namedAllocationId);assert.equal(fresh.validUntil,b.actionIntent.validUntil);normal613ActualReference(fresh.currentActionAuthority);
 const now=Date.now(),observed=time(r.observedAt),main=time(fresh.mainObservedAt),conflict=time(fresh.reservationConflictCheckedAt),until=time(fresh.validUntil);assert(main<=observed&&conflict<=observed&&observed<=now&&now<until);for(const at of [main,conflict,observed])assert(now-at<=86400000,'nonfuture fresh observations');
 const intent=normal613Record(r.normal613Intent),expectedIntent={schemaVersion:'normal613-action-intent.v1',phase:'qualification',purpose:'normal613-qualification',repository:'hartican/sportscal',candidateHeadSha:r.publisherHeadSha,candidateTreeSha:r.publisherTreeSha,baseSha:NORMAL613.base,reviewedFinalMapSha256:b.reviewedFinalMapSha256,expectedAssembledManifestSha256:b.expectedAssembledManifestSha256,qualifierSha256:r.qualifier.sha256,fixtureSha256:r.fixture.sha256,reservationReceiptSha256:NORMAL613.reservationHash,allocationId:b.actionIntent.allocationId,laneId:b.actionIntent.laneId,ownedOperationId:b.actionIntent.ownedOperationId,sourceReviewId:b.actionIntent.sourceReviewId,sourceReviewSha256:b.actionIntent.sourceReviewSha256,priorOwnedClosureReference:b.actionIntent.priorOwnedClosureReference,validUntil:b.actionIntent.validUntil,maxWallMs:b.actionIntent.maxWallMs,resultContentDispositionSha256:b.actionIntent.resultContentDispositionSha256,freshMainAndReservationBindingSha256:r.freshMainAndReservationBindingSha256};
 keys(intent,Object.keys(expectedIntent).join(' '));assert.deepEqual(intent,expectedIntent);
 const ack=normal613Record(r.normal613Ack),expectedAck={...expectedIntent,schemaVersion:'normal613-action-ack.v1',intentSha256:r.normal613Intent.sha256,bodySha256:r.eventBodySha256,acknowledgedBy:'nsRELEASE+nsPUBLISH',acknowledgedAt:ack.acknowledgedAt};
 keys(ack,Object.keys(expectedAck).join(' '));assert.deepEqual(ack,expectedAck);const ackAt=time(ack.acknowledgedAt);assert(ackAt<=time(r.normal613Action.startedAt)&&ackAt<=now&&now-ackAt<=86400000&&ackAt<until);
 // Exact matching records are candidate-local consistency evidence, NOT authenticated external authority.
 normal613Action(r.normal613Action,b,r,fresh,now);
 keys(r.cloudContext,'repository eventName pullRequestNumber ref runId runAttempt jobKey');assert(/^[1-9][0-9]*$/.test(r.cloudContext.pullRequestNumber));
 assert.deepEqual(r.cloudContext,{repository:'hartican/sportscal',eventName:'pull_request',pullRequestNumber:String(event.number),ref:process.env.GITHUB_REF,runId:r.actualCloudRunId,runAttempt:r.actualCloudRunAttempt,jobKey:'fixture-activation'});assert.equal(r.cloudContext.ref,'refs/pull/'+event.number+'/merge');
 keys(r.git,'headSha headTree testedMergeSha testedTree baseSha testedMergeParents trackedSourceUnchanged');assert.equal(r.git.trackedSourceUnchanged,true);assert.equal(r.git.baseSha,NORMAL613.base,'exact prepared current base');assert.equal(event.pull_request.base.sha,NORMAL613.base);assert.equal(event.pull_request.head.repo.full_name,'hartican/sportscal');assert.equal(event.pull_request.base.repo.full_name,'hartican/sportscal');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');assert.equal(r.actualCloudRunAttempt,1);assert.equal(process.env.GITHUB_WORKFLOW_REF,'hartican/sportscal/.github/workflows/installed-upgrade-tests.yml@refs/pull/'+event.number+'/merge');git(['merge-base','--is-ancestor',NORMAL613.product,r.publisherHeadSha]);git(['merge-base','--is-ancestor',NORMAL613.base,r.publisherHeadSha]);assert.equal(event.pull_request.head.sha,r.publisherHeadSha);assert.equal(r.releaseGitSha,r.publisherHeadSha);assert.equal(r.actualTestedMergeSha,process.env.GITHUB_SHA);
 const identities=utf8(git(['rev-parse','HEAD','HEAD^{tree}',r.publisherHeadSha+'^{tree}'])).trim().split('\n');assert.deepEqual(identities,[r.actualTestedMergeSha,r.publisherTreeSha,r.publisherTreeSha]);
 const parents=utf8(git(['show','-s','--format=%P',r.actualTestedMergeSha])).trim().split(' ');assert.deepEqual(parents,[event.pull_request.base.sha,r.publisherHeadSha]);
 assert.deepEqual(r.git,{headSha:r.publisherHeadSha,headTree:r.publisherTreeSha,testedMergeSha:r.actualTestedMergeSha,testedTree:r.publisherTreeSha,baseSha:event.pull_request.base.sha,testedMergeParents:parents,trackedSourceUnchanged:true});
 keys(r.approvedFinalMap,'reviewedMapSha256 expectedTree entryCount baseRelativePathCount assembledManifestSha256');assert.deepEqual(r.approvedFinalMap,{reviewedMapSha256:b.reviewedFinalMapSha256,expectedTree:r.publisherTreeSha,entryCount:b.expectedSourceEntryCount,baseRelativePathCount:b.expectedBaseRelativePathCount,assembledManifestSha256:b.expectedAssembledManifestSha256});
 const assembledBytes=external(r.actualAssembledSourceManifestPath,limits.jsonBytes,r.actualAssembledSourceManifestSha256),a=json(assembledBytes);keys(a,'schemaVersion revision tree entryCount reviewedMapSha256 files');assert.equal(a.schemaVersion,'assembled-git-source-manifest.v1');assert.equal(a.revision,r.publisherHeadSha);assert.equal(a.tree,r.publisherTreeSha);assert.equal(a.reviewedMapSha256,b.reviewedFinalMapSha256);assert.equal(a.entryCount,b.expectedSourceEntryCount);assert(Array.isArray(a.files)&&a.files.length===a.entryCount);
 const canonical={schemaVersion:a.schemaVersion,revision:a.revision,tree:a.tree,entryCount:a.entryCount,reviewedMapSha256:a.reviewedMapSha256,files:[]};let previous=null,total=0;
 for(const row of a.files){keys(row,'path mode type gitBlob bytes sha256');safePath(row.path);assert.equal(row.type,'blob');assert(['100644','100755','120000'].includes(row.mode));hex(row.gitBlob,40);hex(row.sha256,64);integer(row.bytes);assert(row.bytes<=limits.fileBytes);if(previous!==null)assert(Buffer.compare(Buffer.from(previous),Buffer.from(row.path))<0,'raw UTF-8 entry order');previous=row.path;total+=row.bytes;assert(total<=limits.totalBytes);source(row);canonical.files.push({path:row.path,mode:row.mode,type:row.type,gitBlob:row.gitBlob,bytes:row.bytes,sha256:row.sha256});}
 assert(assembledBytes.equals(Buffer.from(JSON.stringify(canonical)+'\n')),'canonical complete assembled bytes');
 const treeBytes=git(['ls-tree','-r','-z','--full-tree','HEAD']),records=utf8(treeBytes).split('\0');assert.equal(records.pop(),'');const actualTree=records.map(record=>{const split=record.indexOf('\t');assert(split>0);const [mode,type,gitBlob]=record.slice(0,split).split(' ');return {path:safePath(record.slice(split+1)),mode,type,gitBlob};}).sort((x,y)=>Buffer.compare(Buffer.from(x.path),Buffer.from(y.path)));
 assert.deepEqual(actualTree,a.files.map(row=>({path:row.path,mode:row.mode,type:row.type,gitBlob:row.gitBlob})),'actual entire Git tree');
 for(const [name,expected]of [['qualifier','scripts/validate-sync-current-forward.js'],['fixture',NORMAL613.fixture]]){const d=r[name];keys(d,'path bytes sha256 gitBlob mode');assert.equal(d.path,expected);const row=sourceLeaves.get(expected);assert(row);assert.deepEqual(d,{path:row.path,bytes:row.bytes,sha256:row.sha256,gitBlob:row.gitBlob,mode:row.mode});keys(b[name],'path mode bytes sha256 gitBlob');assert.deepEqual(b[name],{path:d.path,mode:d.mode,bytes:d.bytes,sha256:d.sha256,gitBlob:d.gitBlob});}
 keys(r.runtime,'node platform arch npm nodeBinary dependencyProof');assert.equal(r.runtime.node,'v24.21.0');assert.equal(r.runtime.platform,'linux');assert.equal(r.runtime.arch,'x64');assert.equal(process.version,r.runtime.node);assert.equal(process.platform,r.runtime.platform);assert.equal(process.arch,r.runtime.arch);assert(/^\d+\.\d+\.\d+$/.test(text(r.runtime.npm)));
 keys(r.runtime.nodeBinary,'path bytes mode permissions sha256 gitBlob');assert.equal(r.runtime.nodeBinary.path,fs.realpathSync(process.execPath));const node=rawIdentity(r.runtime.nodeBinary.path);equalIdentity(node.identity,r.runtime.nodeBinary);assert.equal(node.identity.sha256,r.actualNodeBinarySha256);assert(node.stat.isFile()&&(node.stat.mode&0o111)!==0);
 assert.equal(r.runtime.dependencyProof.sha256,r.actualDependencyProofSha256);const dependency=verifyDependencies(r);verifyDeployment(r,a);
 return {normal613:true,externalAuthorityAuthenticated:false,callerHardDeadlineAndCleanupRemainExternal:true,receipt:r,receiptPath:args[2],receiptSha256:args[4],validUntil:until,eventBodySha256:r.eventBodySha256,dependency,sourceEntryCount:a.entryCount,sourceReviewDigestIsOwnerMetadata:true,numericJobOuterJoinRequired:true,releaseAcceptance:false};
}
function admit(){
 if(process.argv[2]==='--normal613-full')return admitNormal613();
 return admitLegacy612();
}
function inputsUnchanged(proof){
 if(proof.normal613)normal613CheckDeadline();
 assert(Date.now()<proof.validUntil,'admission expired during qualification');readBytes=0; // New finite post-qualification metadata phase.
 for(const [file,expected]of externalFiles){const got=rawIdentity(file,expected.max);assert.equal(got.identity.sha256,expected.digest,'external input changed');assert.deepEqual(stamp(got.stat),expected.stamp,'external identity changed');}
 for(const [file,row]of [...sourceLeaves,...dependencyLeaves])equalIdentity(rawIdentity(path.join(root,file)).identity,row);
 const r=proof.receipt;equalIdentity(rawIdentity(r.runtime.nodeBinary.path).identity,r.runtime.nodeBinary);assert.deepEqual(verifyDependencies(r),proof.dependency,'unchanged complete dependencies');assert.deepEqual(utf8(git(['rev-parse','HEAD','HEAD^{tree}'])).trim().split(String.fromCharCode(10)),[r.actualTestedMergeSha,r.publisherTreeSha],'unchanged checked-out commit/tree');return true;
}
let fullAdmission;
try{fullAdmission=admit();}catch(error){console.error(JSON.stringify({format:'sync-full-admission.v1',status:'ADMISSION_FAILED',matrixArmsStarted:0,pairedControlsStarted:0,message:error.message,releaseAcceptance:false}));throw error;}
const inputRow=sourceLeaves.get(fullAdmission.normal613?NORMAL613.fixture:'scripts/fixtures/sync-current-forward-20261107.json');assert(inputRow,'tracked fixture required');const inputBytes=source(inputRow),input=json(inputBytes);
assert.equal(sha(inputBytes),fullAdmission.receipt.fixture.sha256);
assert.equal(input.combinedQualification?.format,'combined-sync-qualification.v1');
const epoch=fullAdmission.normal613?input.normal613Binding?.shellVersion:input.executionBinding?.shellVersion;assert.equal(epoch,fullAdmission.normal613?'613':'612');assert.equal(input.executionBinding.requiredActualAdmission.admissionGranted,false);for(const [key,value]of Object.entries(input.executionBinding.requiredActualAdmission))if(key!=='admissionGranted')assert.equal(value,null,'source template must not embed actual identity '+key);
for(const [file,digest]of Object.entries(input.sourceFiles)){hex(digest,64);assert(sourceLeaves.has(file),'corrective input must be tracked');assert.equal(sha(source(sourceLeaves.get(file))),digest,'exact corrective input '+file);}
if(fullAdmission.normal613){
 const n=input.normal613Binding;
 keys(n,'schemaVersion state productSourceSha productSourceTree preparedForBaseSha shellVersion reservationOriginalSha256 reservationId phase purpose requiredActualAdmission historicalExecutionBindingIsNotAdmission originalFixtureSha256');
 assert.equal(n.schemaVersion,'normal613-fixture-source-binding.v1');assert.equal(n.state,'SOURCE_TEMPLATE_NOT_ADMISSION');assert.equal(n.productSourceSha,NORMAL613.product);assert.equal(n.productSourceTree,NORMAL613.productTree);assert.equal(n.preparedForBaseSha,NORMAL613.base);assert.equal(n.shellVersion,'613');assert.equal(n.phase,'qualification');assert.equal(n.purpose,'normal613-qualification');assert.equal(n.reservationOriginalSha256,NORMAL613.reservationHash);assert.equal(n.reservationId,NORMAL613.reservation);assert.equal(n.historicalExecutionBindingIsNotAdmission,true);assert.equal(n.originalFixtureSha256,'08809f457afccb8a6adbddc51c5b61231dcd3d9597f1ff398e91b16b5528abf3');
 assert.deepEqual(n.requiredActualAdmission,input.executionBinding.requiredActualAdmission);
 assert.deepEqual(Object.keys(input.sourceFiles).sort(),[...Object.keys(NORMAL613_SOURCE_PINS),'scripts/validate-sync-current-forward.js'].sort());
 for(const [name,pin]of Object.entries(NORMAL613_SOURCE_PINS)){const row=sourceLeaves.get(name);assert(row);for(const key of ['mode','bytes','gitBlob','sha256'])assert.equal(row[key],pin[key],'exact frozen S source '+name);assert.equal(input.sourceFiles[name],pin.sha256);}
 assert.equal(input.sourceFiles['scripts/validate-sync-current-forward.js'],fullAdmission.receipt.qualifier.sha256);assert(!Object.hasOwn(input.sourceFiles,NORMAL613.fixture));
 normal613CheckDeadline();
}
const sourceOnly=false;let sourceOnlyExpectedRed=null; // Historical arm bookkeeping only; no source-only entry point.

const fixture=require('./lib/user-state-selection-writer-tests'),profile=require('../config/profile-storage');
const transport=require('../config/server-sync'),systems=require('../config/preference-system'),localApi=require('./lib/local-user-state-api');
const repairedKinds=new Set(['canonical','raw-afl-marker-absent','raw-taxonomy-null','raw-taxonomy-null-same-selection','raw-taxonomy-null-R2',
 'new-grey-remote-prompt','raw-taxonomy-null-new-grey-remote-prompt','raw-taxonomy-null-new-grey-prompt-R2']);
const ratingSystem=require('../config/rating-system');
// Exact public accepted-planner bytes, not customer input or a rewritten model.
assert.deepEqual(input.priorityCases,['new-grey-remote-prompt','raw-taxonomy-null-new-grey-remote-prompt','raw-taxonomy-null-new-grey-prompt-R2','raw-taxonomy-null-new-grey-prompt-ACK-mismatch','new-grey-prompt-local-change','new-grey-prompt-unknown-remote','new-grey-prompt-selection-conflict'],'finite seven-case priority allocation');
const acceptedPlanner=Buffer.from(input.acceptedPlannerWitness.sourceText,'utf8');
assert.equal(acceptedPlanner.length,input.acceptedPlannerWitness.bytes);
assert.equal(crypto.createHash('sha256').update(acceptedPlanner).digest('hex'),input.acceptedPlannerWitness.sha256);
assert.equal(input.acceptedPlannerWitness.sha256,'8c826f82cd65795165c47a7fe418ecfccaa828acbc058d26ea458351880f8b3b');
const results=[],failures=[],html=read('index.html').toString(),generated=sourceOnly?null:read('assets/js/account-awareness-runtime.js').toString();
if(!sourceOnly){assert(html.includes('assets/js/app-shell-runtime.js?v='+epoch)&&html.includes('assets/js/account-awareness-runtime.js?v='+epoch),'exact allocated main/helper paths');}
for(const name of ['setDirectoryEntityFollow','buildDirectoryFollowButton','savePreferences','followDiscoverySport'])assert(html.includes('function '+name+'('),'actual shipped inline writer '+name);
function select(c,p,ids){p.selectedSelectorEntityIds=c.normalizeSelectorEntityIds(ids);p.followedSports=c.canonicalSportKeysForSelectorIds(ids);p.taxonomySelection=c.taxonomySelectionForSelectorIds(ids);}
function element(){return {dataset:{},attributes:{},handlers:{},classList:{toggle(){}},closest:()=>null,setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.handlers[k]=v;}};}
function selectionShape(p){return {selectedPresent:Object.hasOwn(p,'selectedSelectorEntityIds'),followedPresent:Object.hasOwn(p,'followedSports'),taxonomyPresent:Object.hasOwn(p,'taxonomySelection'),taxonomyObject:p.taxonomySelection!==null&&typeof p.taxonomySelection==='object'&&!Array.isArray(p.taxonomySelection),aflMigrationPresent:Object.hasOwn(p,'aflFamilyMigration'),aflMigrationNull:p.aflFamilyMigration===null};}
function probeCompatibleViewProjection(c,receipt,state,current,life){
 const planner=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE,patches=c.USER_STATE_SYNC;
 const before=JSON.stringify({receipt,state,current}),nextTheme=value=>value==='night'?'day':'night';
 const make=(r,s,p)=>planner.ownedPlan(r,s,life,p,()=>{});
 const r=clone(receipt),s=clone(state),p=clone(current);
 // This ordinary same-base preference is outside the disjoint entity/domain
 // planner's supported edits. View projection must not turn it into a hold.
 r.preferences.theme=nextTheme(s.preferences.theme);p.theme=r.preferences.theme;
 const plan=make(r,s,p);assert(plan,'compatible base with divergent device views needs a transient projection');
 assert.deepEqual(clone(plan.receipt.originalReceipt),r,'projection keeps the exact original receipt witness');
 assert.deepEqual(clone(plan.receipt.basePreferences),s.preferences,'projection binds raw fresh remote');
 const sourcePatch=patches.createPatch({preferences:s.preferences,ratings:{}},{preferences:p,ratings:{'fixture:synthetic-view-probe':4}});
 const patch=plan.patch(sourcePatch),applied=patches.applyPatch({preferences:s.preferences,ratings:{}},patch);
 assert(!patch.changes.some(change=>change.path[0]==='preferences'&&['followBrowse','feedCompact'].includes(change.path[1])));
 assert.equal(applied.preferences.theme,r.preferences.theme,'ordinary same-base theme edit remains eligible');
 assert.equal(applied.ratings['fixture:synthetic-view-probe'],4,'non-preference patch entry remains');
 for(const key of ['followBrowse','feedCompact'])assert.deepEqual(clone({value:applied.preferences[key]}),clone({value:s.preferences[key]}));
 assert(c.PROFILE_STORAGE.preferenceIntentMatches(plan.receipt,applied.preferences,patches),'matching projected ACK is accepted');
 const wrong=clone(applied.preferences);wrong.followBrowse.page+=1;
 assert.equal(c.PROFILE_STORAGE.preferenceIntentMatches(plan.receipt,wrong,patches),false,'different raw view ACK cannot clear receipt');
 const missing=clone(applied.preferences);delete missing.feedCompact;
 assert.equal(plan.receipt.acceptsAcknowledgement(missing),false,'remote boolean presence is part of ACK');
 assert.equal(plan.preserve(applied,p),applied,'ordinary in-flight apply stays with the existing owner');
 const newer=clone(r);newer.receiptId+=':synthetic-r3';newer.preferences.theme=nextTheme(r.preferences.theme);
 newer.preferences.followBrowse.page=3;newer.preferences.feedCompact=!s.preferences.feedCompact;
 const continued=plan.receipt.continue(newer,{preferences:applied.preferences,updatedAt:s.updatedAt});
 assert.equal(continued.theme,newer.preferences.theme,'newer ordinary intent survives generic ACK continuation');
 for(const key of ['followBrowse','feedCompact'])assert.deepEqual(clone({value:continued[key]}),clone({value:s.preferences[key]}),'continuation retains remote view');
 const malformedNewer=clone(newer);malformedNewer.preferences.followBrowse.futureView=true;
 assert.equal(plan.receipt.continue(malformedNewer,{preferences:applied.preferences,updatedAt:s.updatedAt}),null,'unknown newer view stays pending');
 const aligned=clone(p);aligned.followBrowse=clone(s.preferences.followBrowse);aligned.feedCompact=s.preferences.feedCompact;
 assert.equal(make(r,s,aligned),null,'aligned ordinary same-base writes keep the existing shortcut');
 for(const ownUndefined of [false,true]){
  const absentReceipt=clone(receipt),absentState=clone(state),local=clone(current);
  for(const value of [absentReceipt.basePreferences,absentReceipt.preferences,absentState.preferences])for(const key of ['followBrowse','feedCompact']){
   delete value[key];if(ownUndefined)value[key]=undefined;
  }
  const absentPlan=make(absentReceipt,absentState,local);assert(absentPlan);
  for(const key of ['followBrowse','feedCompact'])assert(!Object.hasOwn(absentPlan.receipt.preferences,key),'absent/undefined remote view is not defaulted');
  assert(absentPlan.receipt.acceptsAcknowledgement(absentPlan.receipt.preferences));
  const added=clone(absentPlan.receipt.preferences);added.feedCompact=false;
  assert.equal(absentPlan.receipt.acceptsAcknowledgement(added),false,'ACK cannot add an absent remote view');
  const delta=absentPlan.patch(patches.createPatch({preferences:absentState.preferences},{preferences:local}));
  const saved=patches.applyPatch({preferences:absentState.preferences},delta).preferences;
  for(const key of ['followBrowse','feedCompact'])assert.equal(saved[key],undefined,'local view cannot create a remote optional value');
 }
 for(const [label,mutate] of [
  ['null remote view',(r,s)=>{r.basePreferences.followBrowse=null;s.preferences.followBrowse=null;}],
  ['unknown remote view',(r,s)=>{r.basePreferences.followBrowse.futureView=true;s.preferences.followBrowse.futureView=true;}],
  ['malformed recorded view',r=>{r.preferences.followBrowse.page='2';}],
  ['null compact view',(r,s)=>{r.basePreferences.feedCompact=null;s.preferences.feedCompact=null;}]
 ]){
  const badReceipt=clone(receipt),badState=clone(state),local=clone(current);mutate(badReceipt,badState);
  assert.throws(()=>make(badReceipt,badState,local),error=>error.code==='preference_base_changed',label+' must hold');
 }
 const ordinary=clone(current);ordinary.theme=nextTheme(receipt.preferences.theme);
 assert.throws(()=>make(receipt,state,ordinary),error=>error.code==='preference_base_changed','unrecorded ordinary edit holds before projection');
 assert.equal(JSON.stringify({receipt,state,current}),before,'pure view probes leave their raw operands unchanged');
 return {constructedPureProbes:true,extraSdkCalls:0,ordinarySameBasePreserved:true,rawViewAckAndContinuationCovered:true,unknownAndUnrecordedHoldsCovered:true};
}
async function run(mode,kind){
 const {c,values,base}=fixture.setup(),api=localApi('A',{calendarHandler(){throw Error('Unexpected calendar route');}}),sdkCalls=[],authStore=new Map(),facts=[],stages=[];let newer=null,secondReceipt=null;
 const grey=(input.priorityCases||[]).includes(kind),acceptedControl=mode==='accepted-planner',r2=kind==='raw-taxonomy-null-R2'||kind==='raw-taxonomy-null-new-grey-prompt-R2';
 if(acceptedControl){
  const prepared=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE;
  vm.runInContext(acceptedPlanner.toString('utf8'),c);
  assert.notEqual(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE,prepared,'exact accepted M4 planner loaded in a separate fixture context');
 }
 if(mode==='generated'){
  const sourcePlanner=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE;
  vm.runInContext(generated,c);
  assert.notEqual(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE,sourcePlanner,'actual generated helper replaces source helper; no later source overlay');
 }
 for(const name of ['localPreferenceRecoveryBlocked','invalidateServerStateSyncScope','serverStateSyncScope','reconcileCurrentServerState','syncCurrentServerState','applyServerStatePreservingChanges','acknowledgePreferenceReceipt','advancePreferenceReceiptBase','verifyPreferenceIntentBase','syncDirectoryFollowButton','buildDirectoryFollowButton'])vm.runInContext(fixture.declaration(name),c);
 Object.assign(c,{serverSyncSequence:Promise.resolve(),serverSyncTimer:null,accountIndicatorJourney:null,startupSessionStateBaseline:null,setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_s,current)=>current,clearAcknowledgedFixturePinCommands(){},serverErrorEndsSession:e=>e.code==='invalid_refresh_token',followCollectionsById:()=>({}),NOTHINGSPORTS_CRICKET_COVERAGE:require('../config/cricket-coverage'),NOTHINGSPORTS_ACCOUNT_INDICATOR_APP:{beginDiagnostic:()=>({step:name=>stages.push(name),guard:fact=>facts.push(clone(fact)),fail(){},done(){}})}});
 const actualVerify=c.verifyPreferenceIntentBase;
 c.verifyPreferenceIntentBase=(receipt,state,life,current,observe)=>{
  const before=clone({receipt,state,current}),plan=actualVerify(receipt,state,life,current,observe);
  assert.deepEqual(clone({receipt,state,current}),before,'planner does not rewrite original receipt/base/current/remote');
  if(plan){assert.deepEqual(clone(plan.receipt.originalReceipt),before.receipt);assert.deepEqual(clone(plan.receipt.basePreferences),before.state.preferences,'conditional witness binds exact fresh raw remote');}
  return plan;
 };
 c.document.createElement=element;
 const storage={getItem:k=>authStore.get(k)??null,setItem:(k,v)=>authStore.set(k,String(v)),removeItem:k=>authStore.delete(k)};
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 const token='e30.'+Buffer.from(JSON.stringify({sub:'A'})).toString('base64url')+'.synthetic';
 const client=transport.createClient({storage,persistentStorage:storage,fetchImpl:async(url,opts={})=>{
  const method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):undefined;
  if(url==='/api/auth'){assert.equal(body.action,'password-sign-in');return response({session:{access_token:token,refresh_token:'owned-synthetic-refresh',expires_in:3600}});}
  assert.equal(url,'/api/user-state');assert.equal(opts.headers.Authorization,'Bearer '+token);
  const result=await api.handle({method,url,headers:{},body});sdkCalls.push({method,status:result.status});
  if(method==='PUT'&&result.status===200){
    if(grey&&r2&&secondReceipt)assert.deepEqual(clone(c.pendingPreferenceIntent('A')),secondReceipt,'compatible view plan must retain the exact original receipt until matching ACK');
   if(kind==='ACK-mismatch'||kind==='raw-taxonomy-null-ACK-mismatch')select(c,result.body.state.preferences,[]);
   if(kind==='raw-afl-marker-ACK-mismatch')result.body.state.preferences.aflFamilyMigration={status:'pending'};
   if(kind==='raw-taxonomy-null-new-grey-prompt-ACK-mismatch'){
    // Even a counter normally excluded by decision comparison must match the
    // exact fresh remote history retained by this conditional plan's ACK.
    result.body.state.preferences.ratingPromptState.sessionCount+=1;
   }
   if(r2&&!newer){c.saveFollowSport({selectorId:'sport:football'},false);newer=clone(c.pendingPreferenceIntent('A'));}
  }
  return response(result.body,result.status);
 }});
 try{
  await client.signIn('owned@example.invalid','owned-synthetic',{persist:false});c.serverSyncClient=client;c.serverPersistence={configured:true,state:'signedIn',user:{id:'A'}};
  const raw=clone(base);
  if(grey)raw.preferences.ratingPromptState=ratingSystem.emptyPromptState();
  if(kind.startsWith('raw-afl-marker-'))delete raw.preferences.aflFamilyMigration;
  if(kind==='raw-taxonomy-null-same-selection')select(c,raw.preferences,['sport:football']);
  if(kind.startsWith('raw-taxonomy-null'))raw.preferences.taxonomySelection=null;
  if(kind==='raw-taxonomy-missing')delete raw.preferences.taxonomySelection;
  api.seed(raw);const rawBase=api.state();c.setServerStateBaseline(rawBase);assert.equal(c.applyServerState(rawBase),true);
  if(kind.startsWith('raw-afl-marker-')){assert(!Object.hasOwn(rawBase.preferences,'aflFamilyMigration'));assert.equal(c.userPreferences.aflFamilyMigration,null,'actual discovery normalizer produces null from absent raw marker');}
  if(kind.startsWith('raw-taxonomy-null')){assert.equal(rawBase.preferences.taxonomySelection,null);assert(c.userPreferences.taxonomySelection&&typeof c.userPreferences.taxonomySelection==='object','actual merge derives taxonomy from raw null');}
  const view=clone(c.userPreferences);view.feedCompact=true;
  if(grey)view.followBrowse={sportId:'sport:football',categoryId:'',section:'teams-players',page:1,scheduleScope:null};
  assert(c.savePreferences(view,{viewOnly:true}));
  if(kind!=='raw-taxonomy-null-same-selection')assert.notEqual(c.followDiscoverySport('sport:football'),false,'actual sport writer');
  const button=c.buildDirectoryFollowButton('team:football:socceroos',{sportKey:'football',label:'Socceroos'});assert.equal(button.textContent,'Follow');button.handlers.click();assert.equal(button.textContent,'Following','actual card callback records local follow');
  if(kind==='unknown-outside'||kind==='raw-taxonomy-null-unknown-outside'){
   const next=clone(c.userPreferences);next.future608Choice={enabled:true};assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));
  }
  if(kind==='raw-afl-marker-pending'){const next=clone(c.userPreferences);next.aflFamilyMigration={status:'pending'};assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));}
  if(kind==='new-grey-prompt-local-change'){
   const next=clone(c.userPreferences),started=ratingSystem.startSession(next.ratingPromptState,'synthetic-local-prompt-session');
   next.ratingPromptState=ratingSystem.recordPrompt(started,'fixture:synthetic-local-prompt',{sessionId:'synthetic-local-prompt-session'});
   assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}),'actual recorder preserves genuine local prompt-history change');
  }
  const receipt=clone(c.pendingPreferenceIntent('A'));assert(receipt,'actual writer persisted original-base receipt');
  assert.deepEqual(receipt.basePreferences,rawBase.preferences,'raw accepted base is not pre-normalized to the current app');
  api.mutate(state=>{
   state.preferences.feedCompact=true;state.preferences.preferenceGraph=systems.setEntityFollow(state.preferences.preferenceGraph,'team:football:epl:2','follow');
   if(grey){
    const started=ratingSystem.startSession(state.preferences.ratingPromptState,'synthetic-remote-prompt-session');
    state.preferences.ratingPromptState=ratingSystem.recordPrompt(started,'fixture:synthetic-remote-prompt',{sessionId:'synthetic-remote-prompt-session'});
    state.preferences.followBrowse={sportId:'sport:football',categoryId:'',section:'teams-players',page:2,scheduleScope:null};
    if(kind==='new-grey-prompt-unknown-remote')state.preferences.ratingPromptState.futurePromptChoice={enabled:true};
   }
   if(kind==='selection-conflict'||kind==='raw-taxonomy-null-remote-conflict'||kind==='new-grey-prompt-selection-conflict'){
    select(c,state.preferences,['sport:tennis']);if(kind==='raw-taxonomy-null-remote-conflict')state.preferences.taxonomySelection=null;
   }
  });
  const remote=api.state();c.setServerStateBaseline(remote); // Constructed advanced accepted baseline, never a private account read.
  const differences=c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.preferenceDifferences(receipt,remote.preferences,(a,b)=>profile.preferenceBaseMatches({basePreferences:a},b),c.serverStateBaseline.state.preferences);
  if(['canonical','raw-afl-marker-absent','raw-taxonomy-null','ACK-mismatch'].includes(kind))assert.deepEqual(clone(differences),input.reportedDifferences,'same family-only report from distinct raw forms');
  if(grey&&!['new-grey-prompt-local-change','new-grey-prompt-selection-conflict'].includes(kind))assert.deepEqual(clone(differences),input.reportedGreyDifferences,'new human fixed-family envelope, never private raw values');
  if(kind==='derivation-unavailable')c.taxonomySelectionForSelectorIds=undefined;
  if(kind==='new-grey-prompt-unknown-remote'){
   // Accepted remote unknown fields survive settingsForServer's merge even
   // though the visible local preferences and original receipt lack them.
   assert(!Object.hasOwn(receipt.preferences.ratingPromptState,'futurePromptChoice'));
   assert(!Object.hasOwn(c.userPreferences.ratingPromptState,'futurePromptChoice'));
   const rawBeforeProjection=JSON.stringify({receipt,current:c.userPreferences,baseline:c.serverStateBaseline,remote});
   const projected=c.currentServerStatePayload().preferences.ratingPromptState;
   assert.deepEqual(clone(projected.futurePromptChoice),{enabled:true},'real outgoing projection retains the unknown accepted field');
   assert.deepEqual(clone(projected.futurePromptChoice),clone(remote.preferences.ratingPromptState.futurePromptChoice));
   assert.equal(JSON.stringify({receipt,current:c.userPreferences,baseline:c.serverStateBaseline,remote}),rawBeforeProjection,'observing the real projection does not rewrite its inputs');
   // The advanced-baseline primary case correctly stops at owned_current.
   // Also reach the pure planner's remote-shape boundary without changing any
   // live fixture baseline or authorising a save through that lower seam.
   const unknown=clone(remote),duplicate=clone(remote);
   delete duplicate.preferences.ratingPromptState.futurePromptChoice;
   duplicate.preferences.ratingPromptState.prompts.push(clone(duplicate.preferences.ratingPromptState.prompts[0]));
   for(const [label,probe]of [['unknown prompt field',unknown],['duplicate prompt history',duplicate]]){
    const candidate=clone(receipt),beforeProbe=JSON.stringify({candidate,probe}),probeFacts=[];
    const plan=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.plan(candidate,probe,profile,c.FOLLOW_FIRST,c.USER_STATE_SYNC,fact=>probeFacts.push(clone(fact)));
    assert.equal(plan,null,label+' cannot be normalized or ignored by planner');
    assert.equal(JSON.stringify({candidate,probe}),beforeProbe,label+' raw inputs remain unchanged');
    const first=probeFacts.find(f=>['held','exception','retained'].includes(f.decision));
    assert.equal(first?.site,'plan_scope');assert.equal(first.reason,'outside_supported_scope_changed');assert.equal(first.side,'remote');
   }

  }
  const before={storage:JSON.stringify([...values]),receipt:clone(c.pendingPreferenceIntent('A')),current:clone(c.userPreferences),baseline:clone(c.serverStateBaseline),remote:clone(api.state()),writes:api.metrics.rowWrites};
  console.log(JSON.stringify({mode,kind,stage:'prepared',complete:false,baseShape:selectionShape(receipt.basePreferences),intentShape:selectionShape(receipt.preferences),remoteShape:selectionShape(remote.preferences),differences,receiptOwnerMatches:receipt.ownerId===client.accountSnapshot().accountId,generationMatches:receipt.generation===client.accountSnapshot().generation}));
  let caught;try{await c.syncCurrentServerState();}catch(error){caught=error;}
  const status=sdkCalls.map(x=>x.method+':'+x.status).join(','),held=acceptedControl||!repairedKinds.has(kind),ackMismatch=!acceptedControl&&kind.endsWith('ACK-mismatch');
  console.log(JSON.stringify({mode,kind,stage:'observed',complete:false,errorCode:caught?.code||null,sdkCalls,stages,guardFacts:facts}));
  if(held){
   assert.equal(caught?.code,'preference_base_changed');assert.equal(status,ackMismatch?'GET:200,PUT:200':'GET:200','reported pre-save holds never start a save');
   assert.deepEqual(clone(c.pendingPreferenceIntent('A')),before.receipt);assert.equal(JSON.stringify([...values]),before.storage);assert.deepEqual(clone(c.userPreferences),before.current);assert.deepEqual(clone(c.serverStateBaseline),before.baseline);
   if(!ackMismatch){
    assert.deepEqual(api.state(),before.remote);assert.equal(api.metrics.rowWrites,before.writes);
    if(kind==='new-grey-prompt-unknown-remote'){
     const first=facts.find(f=>['held','exception','retained'].includes(f.decision));
     assert.equal(first?.site,'owned_current','unknown projected field refuses at the first current-intent boundary');
     assert.equal(first.reason,'current_differs_from_receipt');assert.equal(first.side,'current');
     assert.deepEqual(clone(first.currentToReceipt),['ratingPrompt'],'only the constructed unknown prompt family differs');
    }else{
     const side=grey&&!kind.startsWith('raw-taxonomy-null')&&!['new-grey-prompt-local-change','new-grey-prompt-selection-conflict'].includes(kind)?'remote':'intent';
     assert(facts.some(f=>f.site==='plan_scope'&&f.reason==='outside_supported_scope_changed'&&f.side===side),'exact expected pre-save scope refusal, not record/ACK rejection');
    }
   }
  }else{
   if(grey&&caught){
    assert.equal(status,'GET:200','a failed desired merge must retain the no-upload boundary');
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),before.receipt);assert.equal(JSON.stringify([...values]),before.storage);
    assert.deepEqual(clone(c.userPreferences),before.current);assert.deepEqual(clone(c.serverStateBaseline),before.baseline);
    assert.deepEqual(api.state(),before.remote);assert.equal(api.metrics.rowWrites,before.writes);
   }
   if(sourceOnly&&grey&&caught?.code==='preference_base_changed'&&facts.some(f=>f.site==='plan_scope'&&f.reason==='outside_supported_scope_changed'))sourceOnlyExpectedRed={mode,kind,errorCode:caught.code,sdkCalls:clone(sdkCalls),guardFacts:clone(facts),originalReceiptStorageCurrentBaselineAndRemotePreserved:true};
   assert.equal(caught,undefined,'desired qualified merge: observed refusal is retained RED, not a passing phone fix');assert.equal(status,'GET:200,PUT:200');if(r2){
    assert(newer);const pending=c.pendingPreferenceIntent('A');assert.equal(pending.receiptId,newer.receiptId);assert.deepEqual(clone(pending.preferences.selectedSelectorEntityIds),[]);assert.equal(pending.baseUpdatedAt,api.state().updatedAt);
     if(grey){
      const beforeProbes=JSON.stringify({storage:[...values],receipt:c.pendingPreferenceIntent('A'),current:c.userPreferences,baseline:c.serverStateBaseline,remote:api.state(),calls:sdkCalls});
      const probes=probeCompatibleViewProjection(c,clone(pending),clone(api.state()),clone(c.currentServerStatePayload().preferences),client.accountSnapshot());
      assert.equal(JSON.stringify({storage:[...values],receipt:c.pendingPreferenceIntent('A'),current:c.userPreferences,baseline:c.serverStateBaseline,remote:api.state(),calls:sdkCalls}),beforeProbes,'pure projection probes cannot reset or alter the live R2 fixture');
      console.log(JSON.stringify({mode,kind,stage:'compatible-view-probes',...probes}));
      // Existing local mock writeTime advances on every mutate, even a no-op.
      // This leaves raw preferences equal to R2's base but changes updatedAt,
      // reaching the real pre-ACK timestamp-advance seam without another call.
      secondReceipt=clone(pending);api.mutate(()=>{});
      assert.deepEqual(api.state().preferences,secondReceipt.basePreferences);
      assert.notEqual(api.state().updatedAt,secondReceipt.baseUpdatedAt);
     }
     await c.syncCurrentServerState();assert.equal(sdkCalls.map(x=>x.method+':'+x.status).join(','),'GET:200,PUT:200,GET:200,PUT:200');assert.deepEqual(api.state().preferences.selectedSelectorEntityIds,[]);
     if(grey){
      assert(facts.some(f=>f.site==='compatibility'&&f.reason==='compatible_base'&&f.decision==='planned'),'second sync uses the compatible-base view projection');
      console.log(JSON.stringify({mode,kind,stage:'second-sync-observed',complete:false,sdkCalls,guardFacts:facts}));
     }
   }
   if(kind==='raw-afl-marker-absent')assert(!Object.hasOwn(api.state().preferences,'aflFamilyMigration'),'fresh remote keeps its absent non-decision marker');
   if(kind==='raw-taxonomy-null-same-selection')assert.equal(api.state().preferences.taxonomySelection,null,'unchanged remote keeps raw null translation');
   if(grey){
    assert.deepEqual(api.state().preferences.ratingPromptState,remote.preferences.ratingPromptState,'fresh remote prompt history survives byte-for-value, never uploaded from old local history');
    assert.equal(api.state().preferences.followBrowse.page,2,'remote typed view stays remote');assert.equal(c.userPreferences.followBrowse.page,1,'current device retains its typed view');
   }
   assert.equal(c.pendingPreferenceIntent('A'),null,'only owned matching ACK clears accepted receipt');assert.equal(c.serverPersistence.state,'signedIn');
   for(const id of ['team:football:socceroos','team:football:epl:2'])assert(api.state().preferences.preferenceGraph.entityFollows.some(row=>row.participantId===id&&row.followLevel==='follow'));
  }
  const result={mode,kind,passed:true,held,acceptedPlannerControl:acceptedControl,desiredMergeQualified:grey?!held:null,sdkCalls,guardFacts:facts,differences,receiptPending:!!c.pendingPreferenceIntent('A'),baseShape:selectionShape(receipt.basePreferences),intentShape:selectionShape(receipt.preferences),constructedState:true,realNetwork:false,physicalCauseIdentified:false};results.push(result);console.log(JSON.stringify({complete:true,...result}));
 }finally{client.clearSession();}
}

// ONE paired ordinary-hydration control, in both actual source/generated modes.
// A retained receipt is never deleted/rebased to create the fresh arm.
async function runPairedOrdinaryHydration(){
 const paired=[];
 const syncNames=['localPreferenceRecoveryBlocked','invalidateServerStateSyncScope','serverStateSyncScope','reconcileCurrentServerState','syncCurrentServerState','applyServerStatePreservingChanges','acknowledgePreferenceReceipt','advancePreferenceReceiptBase','verifyPreferenceIntentBase','bootstrapServerPersistence'];
 function context(mode){
  const f=fixture.setup(),{c}=f;
  if(mode==='generated'){
   const source=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE;
   vm.runInContext(generated,c);
   assert.notEqual(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE,source,'paired control uses exact generated helper, no source overlay');
  }
  for(const name of syncNames)vm.runInContext(fixture.declaration(name),c);
  if(mode==='source'){
   const indicatorRow=sourceLeaves.get('assets/js/account-indicator-app.js');
   assert(indicatorRow,'tracked actual account indicator required');
   vm.runInContext(source(indicatorRow).toString(),c);
  }
  const indicator=c.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP;
  assert.equal(typeof indicator?.complete,'function','actual source/generated indicator exports lifecycle completion');
  f.facts=[];f.stages=[];f.plans=[];f.indicatorCompletions=[];
  Object.assign(c,{serverSyncSequence:Promise.resolve(),serverSyncTimer:null,accountIndicatorJourney:null,startupSessionStateBaseline:null,
   setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_state,current)=>current,clearAcknowledgedFixturePinCommands(){},serverErrorEndsSession:e=>e.code==='invalid_refresh_token',
   hydrateUserMetaSeed:async()=>{}, // Outside this profile hydration/receipt proof; no metadata route.
   NOTHINGSPORTS_ACCOUNT_INDICATOR_APP:{...indicator,beginDiagnostic:()=>({step:name=>f.stages.push(name),guard:fact=>f.facts.push(clone(fact)),fail(){},done(){}}),
    complete(journey,life){
     const result=indicator.complete(journey,life); // Delegate to the actual admitted lifecycle, never a no-op.
     f.indicatorCompletions.push({journey,life:clone(life)});
     return result;
    }}});
  const verify=c.verifyPreferenceIntentBase;
  c.verifyPreferenceIntentBase=(receipt,state,life,current,observe)=>{
   const raw=JSON.stringify({receipt,state,current}),plan=verify(receipt,state,life,current,observe);
   assert.equal(JSON.stringify({receipt,state,current}),raw,'paired planner retains every original raw input');
   if(plan){assert.deepEqual(clone(plan.receipt.originalReceipt),clone(receipt));assert.deepEqual(clone(plan.receipt.basePreferences),clone(state.preferences));f.plans.push(plan);}
   return plan;
  };
  return f;
 }
 const fixedNow=Date.parse('2026-11-05T00:00:00Z');
 const token='e30.'+Buffer.from(JSON.stringify({sub:'A'})).toString('base64url')+'.synthetic';
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 function client(authValues,onState){
  const store={getItem:key=>authValues.get(key)??null,setItem:(key,value)=>authValues.set(key,String(value)),removeItem:key=>authValues.delete(key)};
  return transport.createClient({storage:store,persistentStorage:store,now:()=>fixedNow,fetchImpl:async(url,options={})=>{
   if(url==='/api/auth'){
    const body=options.body?JSON.parse(options.body):null;
    assert.equal(options.method,'POST');assert.equal(body?.action,'password-sign-in','only synthetic setup sign-in is allowed');
    return response({session:{access_token:token,refresh_token:'paired-owned-synthetic-refresh',expires_in:3600}});
   }
   assert.equal(url,'/api/user-state','unexpected paired route');
   assert.equal(options.headers.Authorization,'Bearer '+token);
   assert(onState,'origin preparation cannot call profile endpoint');
   return onState(options);
  }});
 }
 for(const mode of ['source','generated']){
  const origin=context(mode),oldAuth=new Map(),oldClient=client(oldAuth);
  await oldClient.signIn('paired@example.invalid','owned-synthetic',{persist:true});
  origin.c.serverSyncClient=oldClient;origin.c.serverPersistence={configured:true,state:'signedIn',user:{id:'A'}};
  const raw=clone(origin.base);raw.preferences.taxonomySelection=null;
  origin.c.setServerStateBaseline(raw);origin.c.applyServerState(raw);
  assert(origin.c.followDiscoverySport('sport:football')!==false,'actual writer creates pending historical raw-base intent');
  const originalReceipt=clone(origin.c.pendingPreferenceIntent('A'));
  assert(originalReceipt);assert.equal(originalReceipt.basePreferences.taxonomySelection,null);
  assert(originalReceipt.preferences.taxonomySelection&&typeof originalReceipt.preferences.taxonomySelection==='object');
  assert.equal(originalReceipt.generation,oldClient.accountSnapshot().generation);
  const persisted=[...origin.values],originRaw=JSON.stringify(persisted),authSnapshot=[...oldAuth];
  const remote=clone(raw);remote.updatedAt='2026-11-05T00:01:00Z';
  remote.preferences.preferenceGraph=systems.setEntityFollow(remote.preferences.preferenceGraph,'team:football:epl:2','follow');
  const frozenRemote=JSON.stringify(remote),arms=[];
  for(const arm of ['retained-pending','fresh-no-receipt']){
   const f=context(mode),{c,storage,values}=f,api=localApi('A',{calendarHandler(){throw Error('Unexpected paired calendar route');}}),calls=[];
   if(arm==='retained-pending'){
    // A separate VM/profile lifetime reads a copy of prior durable profile bytes.
    for(const [key,value] of persisted)values.set(key,value);
    c.activeProfileBundle=profile.loadActiveProfile(storage);
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),originalReceipt,'ordinary profile loader retains original pending receipt');
   }else assert.equal(c.pendingPreferenceIntent('A'),null,'fresh arm starts independently without any receipt');
   api.seed(clone(remote));let r2=null;
   const authValues=new Map(authSnapshot);
   const sdk=client(authValues,async options=>{
    const method=options.method||'GET',body=options.body?JSON.parse(options.body):undefined;
    const result=await api.handle({method,url:'/api/user-state',headers:{},body});calls.push({method,status:result.status});
    if(arm==='retained-pending'&&method==='PUT'&&result.status===200&&!r2){
     assert(f.plans.length,'actual sync produced the owned R1 conditional witness');
     const witness=f.plans.at(-1).receipt;
     const unchanged=JSON.stringify([...values]);
     const bad=clone(witness);bad.originalReceipt.generation+=1;
     profile.acknowledgePreferenceIntent(storage,c.activeProfileBundle,bad,result.body.state.preferences,require('../config/user-state-sync'),{generation:sdk.accountSnapshot().generation,updatedAt:result.body.state.updatedAt});
     assert.equal(JSON.stringify([...values]),unchanged,'changed original generation witness cannot clear R1');
     c.saveFollowSport({selectorId:'sport:football'},false);r2=clone(c.pendingPreferenceIntent('A'));
     assert(r2&&r2.receiptId!==originalReceipt.receiptId,'actual in-flight writer records R2, never fakes receipt absence');
     const newerRaw=JSON.stringify([...values]);
     profile.acknowledgePreferenceIntent(storage,c.activeProfileBundle,witness,result.body.state.preferences,require('../config/user-state-sync'),{generation:sdk.accountSnapshot().generation+1,updatedAt:result.body.state.updatedAt});
     assert.equal(JSON.stringify([...values]),newerRaw,'wrong current generation cannot advance R2');
    }
    return response(result.body,result.status);
   });
   c.serverSyncClient=sdk;
   assert.equal(transport.sessionSubject(await sdk.restoreSession()),'A');
   assert.equal(sdk.accountSnapshot().generation,0,'new client restores same account without reusing old in-memory generation');
   if(arm==='retained-pending')assert.notEqual(originalReceipt.generation,sdk.accountSnapshot().generation,'stored receipt generation differs from stable new lifetime');
   c.startupSessionStateBaseline=clone(c.currentServerStatePayload());
   console.log(JSON.stringify({control:'paired-ordinary-hydration',mode,arm,stage:'prepared',pendingReceipt:!!c.pendingPreferenceIntent('A')}));
   const bootstrap=await c.bootstrapServerPersistence({checkStatus:false});
   const bootCalls=clone(calls);
   assert.equal(f.indicatorCompletions.length,arm==='fresh-no-receipt'?1:0,'fresh bootstrap completes lifecycle; guarded early return does not');
   if(arm==='fresh-no-receipt'){
    assert.equal(f.indicatorCompletions[0].journey,null,'ordinary hydration invents no sign-in journey');
    assert.deepEqual(f.indicatorCompletions[0].life,clone(sdk.accountSnapshot()),'completion observes the same owned account lifetime');
    assert.equal(c.accountIndicatorJourney,null,'actual completion preserves absent journey');
   }
   console.log(JSON.stringify({control:'paired-ordinary-hydration',mode,arm,stage:'hydrated',state:bootstrap.state,sdkCalls:bootCalls,pendingReceipt:!!c.pendingPreferenceIntent('A'),indicatorCompletionCalls:f.indicatorCompletions.length}));
   assert.equal(JSON.stringify(remote),frozenRemote,'source remote snapshot unchanged');
   assert(bootCalls.every(call=>call.method==='GET'),'ordinary hydration never sends a profile write here');
   assert.deepEqual(api.state().preferences,remote.preferences,'bootstrap cannot overwrite remote');
   if(arm==='retained-pending'){
    assert.equal(bootstrap.state,'error','ordinary hydration protects incompatible raw-base pending intent');
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),originalReceipt,'hydration cannot discard or rewrite receipt');
    const life=sdk.accountSnapshot(),current=c.currentServerStatePayload().preferences;
    const before=JSON.stringify({storage:[...values],receipt:c.pendingPreferenceIntent('A'),current,remote:api.state()});
    const negative=[];
    assert.equal(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan(originalReceipt,api.state(),{...life,generation:life.generation+1},current,fact=>negative.push(fact)),null);
    assert(negative.some(fact=>fact.reason==='generation_scope_rejected'),'actual stale current lifetime remains rejected');
    assert.equal(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan({...clone(originalReceipt),ownerId:'B'},api.state(),life,current),null,'different receipt owner remains rejected');
    assert.equal(JSON.stringify({storage:[...values],receipt:c.pendingPreferenceIntent('A'),current:c.currentServerStatePayload().preferences,remote:api.state()}),before,'negative scopes preserve exact stored/current/remote snapshots');
    await c.syncCurrentServerState();
    assert(r2);assert.equal(c.pendingPreferenceIntent('A').receiptId,r2.receiptId,'correct owned R1 ACK retains newer R2');
    assert.equal(c.pendingPreferenceIntent('A').generation,sdk.accountSnapshot().generation);
    assert(f.facts.some(fact=>fact.receiptGenerationMatches===false),'actual stored/current generation mismatch was observed');
    await c.syncCurrentServerState();
    assert.equal(c.pendingPreferenceIntent('A'),null,'only subsequent matching R2 ACK clears pending intent');
    assert.equal(c.serverPersistence.state,'signedIn');
    assert.equal(calls.slice(bootCalls.length).map(call=>call.method+':'+call.status).join(','),'GET:200,PUT:200,GET:200,PUT:200');
    assert.deepEqual(api.state().preferences.selectedSelectorEntityIds,[],'newer removal is preserved, not reverted by R1');
   }else{
    assert.equal(bootstrap.state,'signedIn','fresh arm ordinary hydration completes without inventing pending intent');
    assert.equal(c.pendingPreferenceIntent('A'),null);
    assert(calls.every(call=>call.method==='GET'),'fresh no-receipt success is not misreported as a save-response proof');
   }
   assert(api.state().preferences.preferenceGraph.entityFollows.some(row=>row.participantId==='team:football:epl:2'&&row.followLevel==='follow'),'independent remote choice retained');
   assert.equal(JSON.stringify([...origin.values]),originRaw,'original prior-lifetime durable profile untouched by either arm');
   assert.equal(JSON.stringify(remote),frozenRemote);
   arms.push({arm,bootstrapCalls:bootCalls,sdkCalls:clone(calls),pendingReceipt:!!c.pendingPreferenceIntent('A'),state:c.serverPersistence.state,indicatorCompletionCalls:f.indicatorCompletions.length,constructedState:true});
   sdk.clearSession(); // RAM-only synthetic auth fixture cleanup, no provider request.
  }
  oldClient.clearSession();
  paired.push({mode,arms});
 }
 return {name:'ordinary-hydration-retained-historical-intent-versus-independent-no-receipt',pairedControls:1,modes:paired,scope:'actual ordinary bootstrap/apply/profile reload and sync/SDK/local API owners; synthetic RAM only; no device/customer/remote acceptance'};
}

(async()=>{
 // One finite priority discriminator: exact accepted planner, proposed source, exact generated helper.
 // Known conservative holds are baseline observations; desired merges stay RED until proved.
 for(const mode of ['accepted-planner','source','generated'])for(const kind of input.priorityCases){
  if(fullAdmission.normal613)normal613CheckDeadline();
  try{await run(mode,kind);}catch(error){failures.push({mode,kind,message:error.message,stack:error.stack});console.error(JSON.stringify({mode,kind,status:'FAIL',message:error.message,stack:error.stack}));}
 }
 for(const mode of ['source','generated'])for(const kind of input.cases){
  if(fullAdmission.normal613)normal613CheckDeadline();
  try{await run(mode,kind);}catch(error){failures.push({mode,kind,message:error.message,stack:error.stack});console.error(JSON.stringify({mode,kind,status:'FAIL',message:error.message,stack:error.stack}));}
 }
 if(fullAdmission.normal613)normal613CheckDeadline();
 let pairedControl=null;try{pairedControl=await runPairedOrdinaryHydration();}catch(error){failures.push({control:'paired-ordinary-hydration',message:error.message,stack:error.stack});console.error(JSON.stringify({control:'paired-ordinary-hydration',status:'FAIL',message:error.message,stack:error.stack}));}
 let admittedInputsUnchanged=null;
 try{
  assert.equal(results.length,51,'all51 completed arms required');
  assert.equal(results.filter(row=>input.cases.includes(row.kind)).length,30);
  assert.equal(results.filter(row=>input.priorityCases.includes(row.kind)).length,21);
  assert(pairedControl,'all four required paired subarms must complete before paired acceptance');
  assert.deepEqual(pairedControl.modes.map(row=>({mode:row.mode,arms:row.arms.map(arm=>arm.arm)})),[{mode:'source',arms:['retained-pending','fresh-no-receipt']},{mode:'generated',arms:['retained-pending','fresh-no-receipt']}]);
 }catch(error){failures.push({control:'full-counts-and-paired-completion',message:error.message,stack:error.stack});console.error(JSON.stringify({control:'full-counts-and-paired-completion',status:'FAIL',message:error.message}));}
 // Final independent admission/input verification runs even after any case or paired failure.
 try{admittedInputsUnchanged=inputsUnchanged(fullAdmission);}
 catch(error){failures.push({control:'post-qualification-input-stability',message:error.message,stack:error.stack});console.error(JSON.stringify({control:'post-qualification-input-stability',status:'FAIL',message:error.message}));}
 console.log(JSON.stringify({format:'sync608-reported-hold-discriminator.v1',historicalSource:input.sourceCommit,actualBinding:{publisherHeadSha:fullAdmission.receipt.publisherHeadSha,publisherTreeSha:fullAdmission.receipt.publisherTreeSha,testedMergeSha:fullAdmission.receipt.actualTestedMergeSha,releaseGitSha:fullAdmission.receipt.releaseGitSha,runId:fullAdmission.receipt.actualCloudRunId,runAttempt:fullAdmission.receipt.actualCloudRunAttempt,jobIdKind:fullAdmission.receipt.jobIdKind,jobId:fullAdmission.receipt.actualCloudJobId,numericJobId:null,numericJobOuterJoinRequired:true,executionReceiptSha256:fullAdmission.receiptSha256,assembledManifestSha256:fullAdmission.receipt.actualAssembledSourceManifestSha256,deploymentManifestSha256:fullAdmission.receipt.actualDeploymentSourceManifestSha256,eventBodySha256:fullAdmission.eventBodySha256,admittedInputsUnchanged,sourceReviewDigestIsOwnerMetadata:true,releaseAcceptance:false},acceptedBase:input.acceptedBaseCommit,cases:results.length,originalCasesCompleted:results.filter(row=>input.cases.includes(row.kind)).length,priorityArmsCompleted:results.filter(row=>input.priorityCases.includes(row.kind)).length,pairedControl,failures,generatedHelperSha256:input.sourceFiles['assets/js/account-awareness-runtime.js'],scope:'actual shipped inline UI writer/normalizer/raw accepted base/receipt plus source and generated helper and actual SDK with owned local API/database doubles; no private account, browser, phone, live-data or release acceptance'}));
 assert.equal(failures.length,0,'discriminator failed: '+failures.map(row=>row.mode+'/'+row.kind+': '+row.message).join('; '));
})().catch(error=>{console.error(error);process.exitCode=1;});
