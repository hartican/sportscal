#!/usr/bin/env node
'use strict';
// Emits an inert, exact cloud afterimage packet. Never mutates the checkout or publishes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {POLICY,OUTPUTS,hash,blob,jsonBytes,verifyCloudRoute,planVersioning,boundedRegularRead}=require('./lib/forward-onboarding-ci');
const proof=verifyCloudRoute('canonical-producer'),root=proof.root,temp=fs.realpathSync(process.env.RUNNER_TEMP);
const canonical=path.join(temp,'ns-canonical-producer-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT,'public');
const target=path.join(temp,'ns-forward-package-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
const readLedger={used:proof.readBytes,limit:2*1024*1024*1024};
const read=(file,max=256*1024*1024)=>boundedRegularRead(file,max,readLedger);
function metadata(name){return jsonBytes(read(path.join(canonical,name),16*1024*1024),16*1024*1024);}
assert(canonical.startsWith(temp+path.sep)&&target.startsWith(temp+path.sep)&&!target.startsWith(root+path.sep));
const receipt=metadata('receipt.json'),restore=metadata('restore.json'),source=metadata('source.json'),dependencies=metadata('dependencies.json'),transform=metadata('transform.json');
assert.equal(receipt.schemaVersion,'canonical-ci-return.v1');assert.equal(receipt.complete,true);assert.equal(receipt.adoptable,true);assert.equal(receipt.releaseAcceptance,false);assert.equal(receipt.originalStatus,0);assert.equal(receipt.restorePassed,true);assert.equal(receipt.failure,null);
assert.equal(receipt.sourceSha,proof.observed.checkout);assert.equal(receipt.sourceTree,proof.observed.testedTree);assert.equal(receipt.runId,process.env.GITHUB_RUN_ID);assert.equal(receipt.runAttempt,process.env.GITHUB_RUN_ATTEMPT);
assert.deepEqual(receipt.requiredOutputs,OUTPUTS);assert.deepEqual(receipt.requiredEvidence,['source.json','dependencies.json','transform.json','restore.json','receipt.json']);
assert.equal(restore.schemaVersion,'canonical-ci-restoration.v1');assert.equal(restore.restorePassed,true);assert.deepEqual(restore.errors,[]);assert.deepEqual(restore.restored,OUTPUTS);
assert.equal(source.schemaVersion,'canonical-ci-source.v1');assert.equal(source.headSha,proof.binding.publisherHeadSha);assert.equal(source.baseSha,POLICY.acceptedMain);assert.equal(source.testedSha,proof.observed.checkout);assert.equal(source.testedTree,proof.observed.testedTree);assert.equal(source.runId,process.env.GITHUB_RUN_ID);assert.equal(source.runAttempt,process.env.GITHUB_RUN_ATTEMPT);assert.equal(source.producerPhase,'current-forward-canonical-producer-v1');
assert.equal(source.runtime.node,process.version);assert.equal(source.runtime.platform,process.platform);assert.equal(source.runtime.arch,process.arch);
assert.equal(source.runtime.nodeBinary.sha256,hash(read(fs.realpathSync(process.execPath))));
assert.equal(source.sourceMapSha256,hash(Buffer.from(JSON.stringify(source.source))));
assert.equal(source.source.length,proof.rows.length);
const before=new Map(source.source.map(r=>[r.path,r]));assert.equal(before.size,proof.rows.length);
for(const row of proof.rows){const r=before.get(row.path);assert(r);for(const k of ['bytes','mode','sha256','gitBlob'])assert.equal(r[k],row[k],'actual source join '+row.path+' '+k);}
assert.equal(dependencies.schemaVersion,'canonical-ci-dependencies.v1');assert.equal(dependencies.installCommand,'npm ci');assert.equal(dependencies.auditRemediation,false);assert.equal(dependencies.terser.package,'node_modules/terser');assert.equal(dependencies.terser.version,'5.44.0');assert.equal(dependencies.fileMapSha256,hash(Buffer.from(JSON.stringify(dependencies.files))));
assert.equal(dependencies.lockSha256,before.get('package-lock.json').sha256);assert.equal(dependencies.installedLockSha256,hash(read(path.join(root,'node_modules/.package-lock.json'))));
assert.equal(transform.schemaVersion,'canonical-ci-transform.v1');assert.equal(transform.testedSha,proof.observed.checkout);assert.equal(transform.testedTree,proof.observed.testedTree);assert.equal(transform.outputCount,9);assert.deepEqual(transform.files.map(r=>r.path),OUTPUTS);
const commands=['node scripts/build-app-shell-runtime.js','node scripts/build-app-shell-runtime.js --check','node scripts/build-fantasy-ui.js','node scripts/build-fantasy-ui.js --check'];
assert.equal(transform.commands.length,4);for(let i=0;i<4;i++){const c=transform.commands[i];assert.equal(c.command,commands[i]);assert.equal(c.ordinal,i+1);assert.equal(c.status,0);assert.equal(c.timeoutSeconds,45);assert.equal(c.killAfterSeconds,5);assert(Number.isFinite(Date.parse(c.startedAt))&&Date.parse(c.finishedAt)>=Date.parse(c.startedAt));}
const files=new Map();
for(const row of transform.files){assert.equal(row.mode,'100644');const b=read(path.join(canonical,'files',row.path));assert.equal(b.length,row.bytes);assert.equal(hash(b),row.sha256);assert.equal(blob(b),row.gitBlob);files.set(row.path,b);}
for(const [p,b]of planVersioning({index:read(path.join(root,'index.html')),worker:read(path.join(root,'service-worker.js')),appVersion:read(path.join(root,'app-version.json')),recoveryAsset:read(path.join(root,POLICY.versionPlanInputs.recoveryAsset.path))}))files.set(p,b);
const fixturePath='scripts/fixtures/sync-current-forward-20261107.json',fixture=jsonBytes(read(path.join(root,fixturePath)),1024*1024);
assert.equal(fixture.executionBinding.shellVersion,POLICY.version);assert.equal(fixture.combinedQualification.fullQualification.totalArms,51);assert.equal(fixture.executionBinding.requiredActualAdmission.admissionGranted,false);
for(const [k,v]of Object.entries(fixture.executionBinding.requiredActualAdmission))if(k!=='admissionGranted')assert.equal(v,null,'actual receipts remain external');
for(const p of Object.keys(fixture.sourceFiles)){assert(before.has(p),'tracked exact fixture input');fixture.sourceFiles[p]=hash(files.get(p)||read(path.join(root,p)));}
files.set(fixturePath,Buffer.from(JSON.stringify(fixture,null,2)+'\n'));
assert.equal(files.size,13,'nine generated outputs, exact three shell files and one source fixture only');
assert(Date.now()<proof.validUntil,'authority expired before output');
fs.mkdirSync(target,{mode:0o700});const written=[];
for(const [p,b]of files){
 const file=path.join(target,'files',p);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,b,{flag:'wx',mode:0o600});
 written.push({path:p,bytes:b.length,sha256:hash(b),gitBlob:blob(b),targetMode:'100644',artifactPermissions:'0600'});
}
const evidence={schemaVersion:'forward-onboarding-package.v1',state:'PREPARED_AFTERIMAGES_NOT_ADOPTED_NOT_RELEASE_READY',reservationId:POLICY.reservationId,reservationSha256:POLICY.reservationSha256,version:POLICY.version,previousAcceptedVersion:POLICY.previousVersion,productHead:POLICY.productHead,head:proof.binding.publisherHeadSha,tree:proof.observed.headTree,testedMerge:proof.observed.checkout,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,canonicalReceiptSha256:hash(read(path.join(canonical,'receipt.json'),16*1024*1024)),canonicalTransformSha256:hash(read(path.join(canonical,'transform.json'),16*1024*1024)),files:written,readBytes:readLedger.used,checkoutWrites:0,adoptable:false,releaseAcceptance:false,requires:['separately verified canonical and package upload artifact IDs and immutable digests','exact independent source/byte/mode review','sole PUBLISH assembly; no local builders','fresh main and named action binding','actual611 normal baseline capture receipt and bytes; never restamp609','full51 and paired controls, thirteen gates, both browsers','exact final SHA READY alias served-byte proof'],physicalIPhone:'UNTESTED; disclosure only'};
fs.writeFileSync(path.join(target,'receipt.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({schemaVersion:evidence.schemaVersion,state:evidence.state,files:written.length,version:POLICY.version,releaseAcceptance:false}));
