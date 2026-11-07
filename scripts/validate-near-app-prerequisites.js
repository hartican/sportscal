'use strict';
// Actual verifier CLI in disposable Git repositories. No configuration or live reads.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
function validate(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'near-prerequisites-')),repo=path.join(root,'repo'),source=path.join(__dirname,'..');
 fs.mkdirSync(repo);
 const environment={PATH:process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:os.devNull};
 const git=args=>cp.execFileSync('git',args,{cwd:repo,env:environment,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:5000});
 const files=['scripts/verify-near-app-adapter.js','scripts/lib/near-app-adapter-qualification.js','lib/supabase-server.js','config/event-action-identity.js'];
 const sentinel='PRIVATE_PATH_OR_PAYLOAD_MUST_NOT_ESCAPE',probe=path.join(repo,sentinel+'.txt');
 let checks=0,head;
 function invoke(name,change={}){
  const dir=path.join(root,name),result=cp.spawnSync(process.execPath,['--require',path.join(root,'deny-network.cjs'),path.join(repo,files[0]),'--live-read'],{
   cwd:repo,env:{...environment,GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_WORKFLOW:'Sportscal production',GITHUB_JOB:'deploy',GITHUB_RUN_ID:'123',GITHUB_SHA:head,NS_NEAR_APP_RELEASE_SHA:head,NS_DEPLOY_REPORT_DIR:dir,...change},encoding:'utf8',timeout:10000
  });
  assert.equal(result.error,undefined,'Verifier must complete');assert.equal(result.status,1,'Absent service configuration must always stop before reads');
  const output=result.stdout.trim().split('\n').map(line=>JSON.parse(line)),summary=output.find(row=>row.state),network=output.find(row=>Object.hasOwn(row,'networkCalls'));
  assert(summary);assert.equal(network?.networkCalls,0);assert.equal(summary.reads,0);
  const file=path.join(dir,'near-app-adapter.json'),receipt=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  for(const text of [result.stdout,result.stderr,receipt?JSON.stringify(receipt):'']){
   assert(!text.includes(sentinel)&&!text.includes(root)&&!text.includes('fatal:')&&!text.includes('SUPABASE_SECRET_KEY'),'No raw paths, stderr, payload or environment in diagnostics');
  }
  assert.equal(result.stderr,'');checks++;return {summary,receipt};
 }
 function admitted(result){assert.equal(result.summary.sha,head,'Unchanged tracked bytes must reach configuration gate');assert(result.receipt);assert.equal(result.summary.failure,'qualification_rejected');}
 function rejected(result,stage){assert.equal(result.summary.sha,null);assert.equal(result.receipt,null);assert.equal(result.summary.prerequisite.stage,stage);assert.equal(result.summary.prerequisite.gitExitStatus,1);}
 const reset=()=>git(['reset','--hard','HEAD']); // Disposable test repository only.
 try{
  for(const file of files){const target=path.join(repo,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,file),target);}
  fs.writeFileSync(probe,'accepted bytes\n');
  fs.writeFileSync(path.join(root,'deny-network.cjs'),"let calls=0;const deny=()=>{calls++;throw Error('Network forbidden');};global.fetch=deny;for(const name of ['http','https','net','tls']){const m=require('node:'+name);for(const key of ['request','get','connect','createConnection'])if(typeof m[key]==='function')m[key]=deny;}process.on('exit',()=>console.log(JSON.stringify({networkCalls:calls})));\n");
  git(['init','--quiet']);git(['config','user.name','Local test']);git(['config','user.email','test@example.invalid']);git(['config','core.filemode','true']);git(['add','.']);git(['commit','--quiet','-m','Disposable prerequisite fixture']);
  head=git(['rev-parse','HEAD']).trim();git(['update-ref','refs/remotes/origin/main',head]);
  admitted(invoke('clean'));
  const bytes=fs.readFileSync(probe),stat=fs.statSync(probe);
  fs.writeFileSync(probe,bytes);fs.utimesSync(probe,stat.atime,new Date(stat.mtimeMs+2000));
  assert(fs.readFileSync(probe).equals(bytes));
  admitted(invoke('stat-only')); // RED on diff-index's stale-stat false rejection.
  reset();fs.writeFileSync(probe,'real changed bytes\n');rejected(invoke('content'),'git_worktree');
  reset();fs.writeFileSync(probe,'staged private bytes\n');git(['add',path.basename(probe)]);fs.writeFileSync(probe,bytes);rejected(invoke('staged-content-restored-worktree'),'git_index');
  reset();fs.unlinkSync(probe);rejected(invoke('deleted'),'git_worktree');
  reset();git(['rm','--quiet',path.basename(probe)]);fs.writeFileSync(probe,bytes);rejected(invoke('staged-deletion-restored-worktree'),'git_index');
  reset();const added=path.join(repo,'private-new.txt');fs.writeFileSync(added,'private addition\n');git(['add','private-new.txt']);fs.unlinkSync(added);rejected(invoke('staged-addition-absent-worktree'),'git_index');
  reset();git(['config','core.filemode','false']);fs.chmodSync(probe,0o755);rejected(invoke('mode-with-filemode-disabled'),'git_worktree');
  fs.chmodSync(probe,0o644);git(['update-index','--chmod=+x',path.basename(probe)]);rejected(invoke('staged-mode-restored-worktree'),'git_index');
  reset();git(['config','core.filemode','true']);fs.chmodSync(probe,0o644);
  const wrong=invoke('wrong-sha',{NS_NEAR_APP_RELEASE_SHA:sentinel});assert.equal(wrong.summary.sha,null);assert.equal(wrong.summary.prerequisite.stage,'publication_context');assert.equal(wrong.receipt,null);
  git(['commit','--quiet','--allow-empty','-m','Different main snapshot']);const other=git(['rev-parse','HEAD']).trim();git(['update-ref','refs/remotes/origin/main',other]);git(['reset','--hard',head]);
  const mismatch=invoke('wrong-origin');assert.equal(mismatch.summary.sha,null);assert.equal(mismatch.summary.prerequisite.stage,'git_origin_main');assert.equal(mismatch.receipt,null);
  git(['update-ref','refs/remotes/origin/main',head]);
  const occupied=path.join(root,'occupied');fs.mkdirSync(occupied);const original=JSON.stringify({state:'ORIGINAL_EVIDENCE'})+'\n';fs.writeFileSync(path.join(occupied,'near-app-adapter.json'),original);
  const repeated=invoke('occupied');assert.equal(repeated.summary.sha,null);assert.equal(repeated.summary.prerequisite.stage,'receipt_claim');assert.equal(fs.readFileSync(path.join(occupied,'near-app-adapter.json'),'utf8'),original);
  const relative=invoke('relative',{NS_DEPLOY_REPORT_DIR:'PRIVATE_PATH_OR_PAYLOAD_MUST_NOT_ESCAPE'});assert.equal(relative.summary.sha,null);assert.equal(relative.summary.prerequisite.stage,'receipt_directory');assert.equal(relative.receipt,null);
  git(['update-ref','-d','refs/remotes/origin/main']);
  const missing=invoke('missing-ref');assert.equal(missing.summary.sha,null);assert.equal(missing.summary.prerequisite.stage,'git_origin_main');assert.equal(missing.summary.prerequisite.gitExitStatus,128);assert.equal(missing.receipt,null);assert.equal(missing.summary.failure,'adapter_failure');
  fs.renameSync(path.join(repo,'.git'),path.join(root,'git-hidden'));
  const noGit=invoke('not-a-repository');assert.equal(noGit.summary.sha,null);assert.equal(noGit.summary.prerequisite.stage,'git_head');assert.equal(noGit.summary.prerequisite.gitExitStatus,128);assert.equal(noGit.receipt,null);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 return {checks,networkCalls:0,serviceRequests:0};
}
module.exports={validate};
if(require.main===module){try{console.log(JSON.stringify(validate()));}catch(error){console.error(error);process.exitCode=1;}}
