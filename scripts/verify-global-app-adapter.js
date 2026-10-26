#!/usr/bin/env node
'use strict';
// Default inert. ROOT may wire explicit live mode into its existing publisher.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const gate=require('./lib/global-app-adapter-qualification');
const MAX_REPORT_BYTES=65536;
function claimReceipt(directory,report){
 assert(path.isAbsolute(directory),'Absolute publisher report directory required');
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const parent=fs.lstatSync(directory);
 assert(parent.isDirectory()&&!parent.isSymbolicLink()&&parent.uid===process.getuid()&&(parent.mode&0o022)===0,'Report directory is not exclusively owned');
 const file=path.join(directory,'global-app-adapter.json'),fd=fs.openSync(file,'wx',0o600),owned=fs.fstatSync(fd);
 const save=value=>{
  const current=fs.lstatSync(file),dir=fs.lstatSync(directory);
  assert(current.isFile()&&!current.isSymbolicLink()&&current.ino===owned.ino&&current.dev===owned.dev&&current.nlink===1&&current.uid===process.getuid()&&(current.mode&0o077)===0,'Report ownership changed');
  assert(dir.isDirectory()&&dir.ino===parent.ino&&dir.dev===parent.dev&&!dir.isSymbolicLink()&&(dir.mode&0o022)===0,'Report directory changed');
  const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');assert(bytes.length<=MAX_REPORT_BYTES,'Receipt too large');
  fs.ftruncateSync(fd,0);assert.equal(fs.writeSync(fd,bytes,0,bytes.length,0),bytes.length,'Incomplete receipt write');
 };
 try{save(report);}catch(error){fs.closeSync(fd);throw error;}
 return{file,save,close:()=>fs.closeSync(fd)};
}
async function main({argv=process.argv.slice(2),environment=process.env,log=console.log}={}){
 if(!argv.length){log(JSON.stringify({state:'INERT_NO_LIVE_READ',serviceCalls:0,releaseAcceptance:false}));return;}
 assert.deepEqual(argv,['--live-read']);
 const report={schemaVersion:'global-app-adapter-release.v1',state:'STOP_BEFORE_READ',prerequisite:{stage:'runtime'},reads:[],readOnly:true,releaseAcceptance:false,capacityContract:'fixture-source-groups.v1',allocationStartedAt:new Date().toISOString(),allocationLimitMs:gate.ALLOCATION_MS};
 let owner,finished=false;
 const save=()=>owner?.save(report);
 const at=(stage,operation,git=false)=>{report.prerequisite={stage};try{return operation();}catch(error){if(git&&Number.isInteger(error?.status)&&error.status>=0&&error.status<=255)report.prerequisite.gitExitStatus=error.status;throw error;}};
 try{
  await gate.qualify({
   prepare:()=>{
    assert.equal(process.versions.node.split('.')[0],'24');
    const cp=require('node:child_process'),options={cwd:path.join(__dirname,'..'),encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:2000,maxBuffer:4096};
    const head=at('git_head',()=>cp.execFileSync('git',['rev-parse','HEAD'],options).trim(),true);
    at('publication_context',()=>{gate.validatePublication(environment,head);assert((environment.GITHUB_RUN_ID||'').length<=32);});
    at('git_origin_main',()=>assert.equal(cp.execFileSync('git',['rev-parse','origin/main'],options).trim(),head),true);
    const diff=['-c','core.filemode=true','diff','--no-ext-diff','--no-textconv','--quiet'];
    at('git_index',()=>cp.execFileSync('git',[...diff,'--cached','HEAD','--'],options),true);
    at('git_worktree',()=>cp.execFileSync('git',[...diff,'HEAD','--'],options),true);
    at('receipt_directory',()=>assert(path.isAbsolute(environment.NS_DEPLOY_REPORT_DIR||'')));
    owner=at('receipt_claim',()=>claimReceipt(environment.NS_DEPLOY_REPORT_DIR,report));
    report.sha=head;report.runId=environment.GITHUB_RUN_ID;report.startedAt=new Date().toISOString();
    const transport=at('service_configuration',()=>{const sdk=require('../lib/supabase-server'),config=sdk.supabaseServiceRoleConfig(environment);assert.equal(config.url,gate.ORIGIN);assert.equal(config.configured,true,'Existing publisher service configuration required');return sdk;});
    report.prerequisite={stage:'complete'};report.state='RUNNING';save();
    return{request:transport.supabaseServiceRequest,environment};
   },
   onReceipt:read=>{if(!finished)report.activeRead=read;},
   record:read=>{if(!finished){report.reads.push(read);delete report.activeRead;save();}},
   complete:(_reads,allocation)=>{report.state='PASS_BOUNDED_GLOBAL_APP_ADAPTER_NOT_FULL_RELEASE_ACCEPTANCE';report.allocation=allocation;report.finishedAt=new Date().toISOString();report.reportSha256=gate.sha(JSON.stringify(report));save();},
  });
 }catch(error){
  report.state='STOP_FIRST_FAILURE_NO_RETRY';report.failure={code:gate.failureCode(error)};
  if(!Object.hasOwn(report.prerequisite,'gitExitStatus')&&Number.isInteger(error?.status)&&error.status>=100&&error.status<=599)report.failure.status=error.status;
  const read=gate.receiptFor(error)||report.activeRead;if(read)report.failure.read=read;
  delete report.activeRead;delete report.reportSha256;report.finishedAt=new Date().toISOString();process.exitCode=1;
  save();
 }finally{finished=true;owner?.close();}
 log(JSON.stringify({state:report.state,sha:report.sha||null,reads:report.reads.length,prerequisite:report.prerequisite,failure:report.failure?.code||null,releaseAcceptance:false}));
 return report;
}
if(require.main===module)main().catch(()=>{console.error('Global app-adapter gate stopped; inspect the owned bounded release receipt.');process.exitCode=1;});
module.exports={main,claimReceipt,MAX_REPORT_BYTES};
