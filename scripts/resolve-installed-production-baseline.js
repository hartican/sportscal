#!/usr/bin/env node
'use strict';
// Local, committed evidence only. DEPLOY still owns all actual cloud verification.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const RECORD='.github/installed-production-baseline.json',ORIGIN='https://nothingsport.app';
const FILES=Object.freeze(['index.html','service-worker.js','app-version.json']);
const SHA=/^[a-f0-9]{40}$/,HASH=/^[a-f0-9]{64}$/,VERSION=/^(0|[1-9]\d{0,15})$/,MAX_AGE_MS=86400000;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fail(code){const error=Error(code);error.baselineCode=code;throw error;}
function requireValue(value,code){if(!value)fail(code);}
function keys(value,expected,code){
 requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),code);
 requireValue(JSON.stringify(Object.keys(value).sort())===JSON.stringify([...expected].sort()),code);
}
function fresh(value,now){
 requireValue(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value),'evidence_timestamp');
 const ms=Date.parse(value);requireValue(Number.isFinite(ms)&&new Date(ms).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z'),'evidence_timestamp');
 requireValue(ms<=now&&now-ms<=MAX_AGE_MS,'evidence_not_fresh');
}
function validateShape(record,prBaseSha,now){
 requireValue(typeof prBaseSha==='string'&&SHA.test(prBaseSha),'pr_base_missing');
 requireValue(Number.isFinite(now),'evidence_timestamp');
 keys(record,['schemaVersion','preparedForBaseSha','baselineSha','baselineVersion','deployment','files'],'record_shape');
 requireValue(record.schemaVersion==='installed-production-baseline.v1','record_schema');
 requireValue(typeof record.preparedForBaseSha==='string'&&SHA.test(record.preparedForBaseSha)&&typeof record.baselineSha==='string'&&SHA.test(record.baselineSha),'record_sha');
 requireValue(record.preparedForBaseSha===prBaseSha,'record_base_mismatch');
 requireValue(typeof record.baselineVersion==='string'&&VERSION.test(record.baselineVersion),'baseline_version');
 keys(record.deployment,['id','state','releaseGitSha','origin','checkedAt'],'deployment_shape');
 const deployment=record.deployment;
 requireValue(typeof deployment.id==='string'&&/^dpl_[A-Za-z0-9]{1,80}$/.test(deployment.id)&&deployment.state==='READY'&&deployment.releaseGitSha===record.baselineSha&&deployment.origin===ORIGIN,'deployment_binding');
 fresh(deployment.checkedAt,now);keys(record.files,FILES,'file_set');
 for(const name of FILES){const proof=record.files[name];keys(proof,['gitSha256','servedSha256','servedBytes','status','checkedAt'],'file_proof');
  requireValue(typeof proof.gitSha256==='string'&&HASH.test(proof.gitSha256)&&typeof proof.servedSha256==='string'&&HASH.test(proof.servedSha256)&&Number.isSafeInteger(proof.servedBytes)&&proof.servedBytes>0&&proof.servedBytes<=4194304&&proof.status===200,'file_proof');fresh(proof.checkedAt,now);
 }
}
function localGit(root){
 return args=>{try{return cp.execFileSync('git',args,{cwd:root,encoding:null,stdio:['ignore','pipe','pipe'],timeout:2000,maxBuffer:4194304,
  env:{PATH:process.env.PATH,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:os.devNull,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}});}catch{fail('git_read_failed');}};
}
function json(bytes,code){try{return JSON.parse(bytes.toString('utf8'));}catch{fail(code);}}
function gitVersion(read,sha,code){const value=json(read(['show',sha+':app-version.json']),code);requireValue(value&&typeof value.version==='string'&&VERSION.test(value.version),code);return value.version;}
function deploymentPolicy(read,sha){
 let policy;try{policy=json(read(['show',sha+':config/deployment-manifest.json']),'deployment_policy');}catch{fail('deployment_policy');}
 requireValue(policy&&policy.schemaVersion==='deployment-manifest.v1'&&typeof policy.compactJson==='boolean'&&Array.isArray(policy.preserveBytes)&&policy.preserveBytes.every(v=>typeof v==='string')&&new Set(policy.preserveBytes).size===policy.preserveBytes.length,'deployment_policy');
 return policy;
}
function materializedBytes(policy,name,bytes){
 // Exactly the baseline materializer's JSON rule, including preserved app-version.
 return policy.compactJson&&name.endsWith('.json')&&!policy.preserveBytes.includes(name)?Buffer.from(JSON.stringify(json(bytes,'deployment_policy'))+'\n'):bytes;
}
function resolve({record,prBaseSha,root=path.join(__dirname,'..'),now=Date.now(),read=localGit(root)}){
 validateShape(record,prBaseSha,now);
 const head=read(['rev-parse','--verify','HEAD^{commit}']).toString('utf8').trim();requireValue(SHA.test(head),'git_read_failed');
 for(const sha of [record.baselineSha,prBaseSha])requireValue(read(['rev-parse','--verify',sha+'^{commit}']).toString('utf8').trim()===sha,'git_commit_required');
 try{read(['merge-base','--is-ancestor',record.baselineSha,prBaseSha]);}catch{fail('baseline_not_ancestor');}
 try{read(['merge-base','--is-ancestor',prBaseSha,head]);}catch{fail('base_not_ancestor');}
 const baseline=gitVersion(read,record.baselineSha,'baseline_version'),candidate=gitVersion(read,head,'candidate_version');
 requireValue(baseline===record.baselineVersion,'baseline_version');requireValue(BigInt(baseline)<BigInt(candidate),'strict_upgrade_required');
 const policy=deploymentPolicy(read,record.baselineSha);
 for(const name of FILES){const bytes=read(['show',record.baselineSha+':'+name]),proof=record.files[name];
  requireValue(hash(bytes)===proof.gitSha256,'source_hash_mismatch');const deployed=materializedBytes(policy,name,bytes);
  requireValue(hash(deployed)===proof.servedSha256&&deployed.length===proof.servedBytes,'served_hash_mismatch');
 }
 return record.baselineSha;
}
function appendOutput(file,sha){
 requireValue(typeof file==='string'&&path.isAbsolute(file)&&!/[\0\r\n]/.test(file),'output_unavailable');let fd;
 try{const before=fs.lstatSync(file);requireValue(before.isFile()&&!before.isSymbolicLink(),'output_unavailable');
  fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_NOFOLLOW);const after=fs.fstatSync(fd);
  requireValue(after.isFile()&&before.ino===after.ino&&before.dev===after.dev,'output_unavailable');
  const line='baseline_sha='+sha+'\n';requireValue(fs.writeSync(fd,line)===Buffer.byteLength(line),'output_unavailable');
 }catch{fail('output_unavailable');}finally{if(fd!==undefined)try{fs.closeSync(fd);}catch{}}
}
function main({argv=process.argv.slice(2),environment=process.env,root=path.join(__dirname,'..'),log=console.log}={}){
 if(!argv.length){log(JSON.stringify({state:'INERT_NO_BASELINE_READ',gitCalls:0,networkCalls:0}));return;}
 requireValue(argv.length===1&&argv[0]==='--resolve','invalid_arguments');
 const prBaseSha=environment.NS_INSTALLED_PR_BASE_SHA;requireValue(typeof prBaseSha==='string'&&SHA.test(prBaseSha),'pr_base_missing');
 const read=localGit(root),head=read(['rev-parse','--verify','HEAD^{commit}']).toString('utf8').trim();requireValue(SHA.test(head),'git_read_failed');
 let listing;try{listing=read(['ls-tree','-z',head,'--',RECORD]).toString('utf8');}catch{fail('record_unavailable');}
 requireValue(/^100644 blob [a-f0-9]{40}\t\.github\/installed-production-baseline\.json\0$/.test(listing),'record_unavailable');
 const bytes=read(['show',head+':'+RECORD]);requireValue(bytes.length<=16384,'record_too_large');
 const sha=resolve({record:json(bytes,'record_json'),prBaseSha,root,read});appendOutput(environment.GITHUB_OUTPUT,sha);
 log(JSON.stringify({state:'VALIDATED_COMMITTED_INSTALLED_BASELINE',files:3,strictUpgrade:true,cloudVerification:false,releaseAcceptance:false}));
 return sha;
}
const FAILURE_CODES=new Set(['record_shape','record_schema','record_sha','pr_base_missing','record_base_mismatch','baseline_version','candidate_version','deployment_shape','deployment_binding','file_set','file_proof','evidence_timestamp','evidence_not_fresh','git_read_failed','git_commit_required','baseline_not_ancestor','base_not_ancestor','strict_upgrade_required','source_hash_mismatch','served_hash_mismatch','deployment_policy','output_unavailable','invalid_arguments','record_unavailable','record_too_large','record_json']);
function failureCode(error){try{return FAILURE_CODES.has(error?.baselineCode)?error.baselineCode:'resolution_failed';}catch{return'resolution_failed';}}
module.exports={RECORD,FILES,ORIGIN,validateShape,resolve,main,failureCode};
if(require.main===module){try{main();}catch(error){console.error('Installed baseline resolver: '+failureCode(error));process.exitCode=1;}}
