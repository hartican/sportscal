#!/usr/bin/env node
'use strict';
// Default inert. Live mode is confined to the existing exact-main publisher step.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const gate=require('./lib/near-app-adapter-qualification');
const ORIGIN='https://mkghopnkhcxtmfrcjdbc.supabase.co',MAX_BYTES=4194304;
function membership(now){
 const model=require('../config/match-centre'),published=require('../lib/calendar-catalogue').catalogue().filter(model.supported);
 const ids=[...new Set(published.filter(e=>model.eligible(e,now)).flatMap(e=>[model.id(e),e.id,e.eventId,...(e.sourceEventIds||[]),...(e.fixtureIdAliases||[])]).filter(Boolean))].sort();
 assert(ids.length<=5000&&ids.every(id=>typeof id==='string'&&id.length),'Invalid complete published membership');return ids;
}
function claimReceipt(directory,report){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'near-app-adapter.json');
 fs.writeFileSync(file,JSON.stringify(report)+'\n',{flag:'wx',mode:0o600});
 return file; // A failed exclusive claim must never overwrite earlier evidence.
}
async function main({argv=process.argv.slice(2),environment=process.env,log=console.log}={}){
 if(!argv.length){log(JSON.stringify({state:'INERT_NO_LIVE_READ',serviceCalls:0,releaseAcceptance:false}));return;}
 assert.deepEqual(argv,['--live-read']);
 const report={schemaVersion:'near-app-adapter-release.v1',state:'STOP_BEFORE_READ',prerequisite:{stage:'runtime'},reads:[],readOnly:true,releaseAcceptance:false,limitations:'First OWN adapter read at release preflight, after functional SQL touched buffers. Parsed-value hashes and complete text byte lengths only; no literal wire hash, dual-body download, same-backend or cold-server proof.'};
 let file,finished=false;
 const save=()=>{if(file){const body=JSON.stringify(report,null,2)+'\n';assert(Buffer.byteLength(body)<=MAX_BYTES,'Receipt too large');fs.writeFileSync(file,body,{mode:0o600});}};
 const at=(stage,operation,git=false)=>{
  report.prerequisite={stage};
  try{return operation();}catch(error){
   if(git&&Number.isInteger(error?.status)&&error.status>=0&&error.status<=255)report.prerequisite.gitExitStatus=error.status;
   throw error;
  }
 };
 try{
  assert.equal(process.versions.node.split('.')[0],'24');
  const cp=require('node:child_process'),options={cwd:path.join(__dirname,'..'),encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:2000,maxBuffer:4096};
  const head=at('git_head',()=>cp.execFileSync('git',['rev-parse','HEAD'],options).trim(),true);
  at('publication_context',()=>gate.validatePublication(environment,head));
  at('git_origin_main',()=>assert.equal(cp.execFileSync('git',['rev-parse','origin/main'],options).trim(),head),true);
  // diff-index can reject identical rewritten bytes using only stale stat metadata.
  // Compare actual worktree content/modes AND the staged index independently.
  const diff=['-c','core.filemode=true','diff','--no-ext-diff','--no-textconv','--quiet'];
  at('git_index',()=>cp.execFileSync('git',[...diff,'--cached','HEAD','--'],options),true);
  at('git_worktree',()=>cp.execFileSync('git',[...diff,'HEAD','--'],options),true);
  at('receipt_directory',()=>assert(path.isAbsolute(environment.NS_DEPLOY_REPORT_DIR||''),'Existing publisher report directory required'));
  file=at('receipt_claim',()=>claimReceipt(environment.NS_DEPLOY_REPORT_DIR,report));
  report.sha=head;report.startedAt=new Date().toISOString();report.runId=environment.GITHUB_RUN_ID;
  const transport=at('service_configuration',()=>{
   const transport=require('../lib/supabase-server'),config=transport.supabaseServiceRoleConfig(environment);
   assert.equal(config.url,ORIGIN);assert.equal(config.configured,true,'Existing publisher service configuration required');return transport;
  });
  const membershipIds=at('catalogue_membership',()=>membership(Date.now()));report.membershipCount=membershipIds.length;
  report.membershipSha256=crypto.createHash('sha256').update(JSON.stringify(membershipIds)).digest('hex');
  report.prerequisite={stage:'complete'};
  report.state='RUNNING';save();
  const storeFactory=require('../lib/live-fixtures').createSnapshotStore;
  await gate.qualify({read:signal=>gate.measure({storeFactory,request:transport.supabaseServiceRequest,environment,membershipIds,maxBytes:MAX_BYTES,signal,onReceipt:read=>{report.activeRead=read;}}),record:read=>{if(!finished){report.reads.push(read);delete report.activeRead;save();}}});
  report.state='PASS_BOUNDED_APP_ADAPTER_NOT_FULL_RELEASE_ACCEPTANCE';
 }catch(error){
  report.state='STOP_FIRST_FAILURE_NO_RETRY';report.failure={code:gate.failureCode(error)};
  if(!Object.hasOwn(report.prerequisite,'gitExitStatus')&&Number.isInteger(error?.status)&&error.status>=100&&error.status<=599)report.failure.status=error.status;
  if(error?.qualificationReceipt||report.activeRead)report.failure.read=error.qualificationReceipt||report.activeRead;
  delete report.activeRead;
  process.exitCode=1;
 }finally{finished=true;report.finishedAt=new Date().toISOString();save();}
 log(JSON.stringify({state:report.state,sha:report.sha||null,reads:report.reads.length,prerequisite:report.prerequisite,failure:report.failure?.code||null,releaseAcceptance:false}));
 return report;
}
if(require.main===module)main().catch(()=>{console.error('App-adapter gate stopped before deployment; inspect the bounded release receipt.');process.exitCode=1;});
module.exports={main,membership,claimReceipt};
