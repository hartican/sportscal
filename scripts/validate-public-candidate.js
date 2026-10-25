'use strict';
// Boundary tests use real Node dispatch and the production guard. All inputs
// and attempted private values are constructed; no provider or service runs.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const candidate=require('./lib/public-candidate');
const ROOT=path.resolve(__dirname,'..');
const cleanEnv={PATH:path.dirname(process.execPath)+':/usr/bin:/bin',LANG:'en_AU.UTF-8'};
function invoke(args,env={}){
 return cp.spawnSync(process.execPath,['scripts/update-cards.js',...args],{cwd:ROOT,env:{...cleanEnv,...env},encoding:'utf8',timeout:5000});
}
function preflight(directory){
 fs.mkdirSync(path.join(directory,'inputs'));
 const input=path.join(directory,'inputs/public-candidate.json'),output=path.join(directory,'not-created');
 const args=['--public-candidate','--candidate-input='+input,'--candidate-output='+output];
 let count=0;
 for(const key of ['SUPABASE_SECRET_KEY','VERCEL_TOKEN','GITHUB_TOKEN','FOLLOW_SNAPSHOT_PATH','AWS_ACCESS_KEY_ID','NODE_OPTIONS','NODE_PATH','NS_PUBLIC_CANDIDATE_CONFIG','HTTPS_PROXY']){
  // Node interprets these two keys before dispatch, so use the public parser.
  if(key==='NODE_OPTIONS'||key==='NODE_PATH')assert.throws(()=>require('./update-cards').parseOptions(args,{[key]:'synthetic-only'}),/CANDIDATE_CREDENTIAL/);
  else {const result=invoke(args,{[key]:'synthetic-only'});assert.notEqual(result.status,0);assert.match(result.stderr,/CANDIDATE_CREDENTIAL/);}
  assert.equal(fs.existsSync(output),false);count++;
 }
 for(const extra of ['--local-only','--quick','--full','--live','--resume-from','--candidate-bypass=1','--public-candidate=1']){
  const result=invoke([...args,extra]);assert.notEqual(result.status,0);assert.match(result.stderr,/CANDIDATE_ARGUMENTS/);assert.equal(fs.existsSync(output),false);count++;
 }
 const duplicate=invoke([...args,args[1]]);assert.match(duplicate.stderr,/CANDIDATE_ARGUMENTS/);count++;
 for(const target of ['full','quick']){
  fs.writeFileSync(input,JSON.stringify({schemaVersion:'canonical-public-candidate.v1',target}));
  const result=invoke(args);assert.match(result.stderr,/CANDIDATE_UNQUALIFIED_TARGET/);assert.equal(fs.existsSync(output),false);count++;
 }
 // Inspect real default/DEPLOY builders without running their live steps.
 const owner=require('./update-cards');
 assert.equal(owner.parseOptions([],{}).localOnly,false);
 assert.equal(owner.parseOptions(['--local-only'],{}).localOnly,true);
 assert.equal(owner.parseOptions([],{SKIP_RELEASE:'1'}).localOnly,true);
 assert(owner.buildSteps(owner.parseOptions([],{})).some(step=>step[0]==='scripts/redeploy-and-release.sh'));
 assert.equal(owner.buildSteps(owner.parseOptions(['--local-only'],{})).some(step=>step[0]==='scripts/redeploy-and-release.sh'),false);
 assert.equal(owner.parseOptions([],{}).publicCandidate,undefined);
 return count+1;
}
function guardedDispatch(directory){
 const workspace=path.join(directory,'guard-workspace'),runtime=path.join(directory,'guard-runtime');
 fs.mkdirSync(workspace);fs.mkdirSync(runtime);
 const privateFile=path.join(directory,'private-canary.txt'),privateBytes='constructed-private-canary';
 fs.writeFileSync(privateFile,privateBytes);
 fs.mkdirSync(path.join(workspace,'scripts'));fs.mkdirSync(path.join(workspace,'data'));
 const entry=path.join(workspace,'scripts/update-cards.js');
 // Exact real entry source. The hash-bound probe runs after the guard and
 // exits before refresh, so these negatives cannot accidentally go live.
 fs.copyFileSync(path.join(ROOT,'scripts/update-cards.js'),entry);
 const probe=path.join(workspace,'scripts/probe.cjs'),state=path.join(runtime,'ledger.json'),config=path.join(runtime,'capability.json');
 const guard=path.join(ROOT,'scripts/lib/public-candidate-guard.cjs');
 const results=[];
 const cases=[
  ['private file',`require('node:fs').readFileSync(${JSON.stringify(privateFile)})`,'CANDIDATE_PRIVATE_FILE'],
  ['private URL',`require('node:fs').readFileSync(new URL(${JSON.stringify('file://'+privateFile)}))`,'CANDIDATE_PRIVATE_FILE'],
  ['private snapshot command',`require('node:child_process').spawnSync(process.execPath,['scripts/snapshot-active-follows.js'])`,'CANDIDATE_COMMAND_UNQUALIFIED'],
  ['private managed read',`await fetch('https://synthetic.invalid/rest/v1/user_state')`,'CANDIDATE_TRANSPORT_UNQUALIFIED'],
  ['managed publication',`await fetch('https://synthetic.invalid/rest/v1/rpc/nothingsports_publish_fixture_source',{method:'POST',body:'synthetic-only'})`,'CANDIDATE_SHARED_PUBLICATION_UNQUALIFIED'],
  ['native HTTP',`require('node:https').request('https://synthetic.invalid/')`,'CANDIDATE_NATIVE_TRANSPORT_UNQUALIFIED'],
  ['raw socket',`require('node:net').connect(443,'synthetic.invalid')`,'CANDIDATE_RAW_SOCKET'],
  ['raw TLS',`require('node:tls').connect(443,'synthetic.invalid')`,'CANDIDATE_RAW_TLS'],
  ['DNS',`require('node:dns')`,'CANDIDATE_NATIVE_MODULE_UNQUALIFIED'],
  ['native binding',`process.binding('fs')`,'CANDIDATE_NATIVE_BINDING'],
  ['inspector',`require('node:inspector')`,'CANDIDATE_NATIVE_MODULE_UNQUALIFIED'],
  ['native module',`process.dlopen({},'/synthetic.node')`,'CANDIDATE_NATIVE_MODULE_UNQUALIFIED'],
  ['native command',`require('node:child_process').execFileSync('/usr/bin/osascript',[])`,'CANDIDATE_DESCENDANT_UNQUALIFIED'],
  ['legacy default',`require('node:child_process').spawnSync(process.execPath,['scripts/update-cards.js'])`,'CANDIDATE_COMMAND_UNQUALIFIED'],
  ['deploy shell',`require('node:child_process').spawnSync('scripts/redeploy-and-release.sh',[])`,'CANDIDATE_DESCENDANT_UNQUALIFIED'],
  ['avatar cleanup',`require('node:child_process').spawnSync(process.execPath,['scripts/cleanup-avatars.js'])`,'CANDIDATE_COMMAND_UNQUALIFIED'],
  ['control read',`require('node:fs').readFileSync(process.env.NS_PUBLIC_CANDIDATE_CONFIG)`,'CANDIDATE_CONTROL_FILE'],
  ['control overwrite',`require('node:fs').writeFileSync(process.env.NS_PUBLIC_CANDIDATE_CONFIG,'{}')`,'CANDIDATE_CONTROL_FILE'],
  ['ledger reset',`require('node:fs').writeFileSync(${JSON.stringify(state)},'{}')`,'CANDIDATE_CONTROL_FILE'],
  ['runtime erase',`require('node:fs').rmSync(${JSON.stringify(runtime)},{recursive:true})`,'CANDIDATE_CONTROL_FILE'],
  ['source rewrite',`require('node:fs').writeFileSync(${JSON.stringify(entry)},'')`,'CANDIDATE_IMMUTABLE_SOURCE_WRITE'],
  ['unknown descriptor',`require('node:fs').readFileSync(42)`,'CANDIDATE_FILE_DESCRIPTOR'],
  ['stream descriptor',`require('node:fs').createReadStream(null,{fd:42})`,'CANDIDATE_FILE_DESCRIPTOR'],
  ['builtin alias',`process.getBuiltinModule('fs').readFileSync(${JSON.stringify(privateFile)})`,'CANDIDATE_PRIVATE_FILE'],
  ['ESM alias',`(await import('node:fs')).readFileSync(${JSON.stringify(privateFile)})`,'CANDIDATE_PRIVATE_FILE'],
 ];
 for(const [name,operation,reason]of cases){
  // Catching a refusal and exiting zero must not erase its sticky ledger.
  const source=`(async()=>{try{${operation};throw Error('unexpectedly allowed');}catch(error){if(!error.message.startsWith('CANDIDATE_'))throw error;}process.exit(0);})().catch(error=>{console.error(error.message);process.exit(1);});`;
  fs.writeFileSync(probe,source);fs.writeFileSync(state,JSON.stringify({requests:0,frames:[],violations:[]}));
  fs.writeFileSync(config,JSON.stringify({workspace,runtime,state,modules:{[entry]:candidate.sha(fs.readFileSync(entry)),[probe]:candidate.sha(source)},dependencyHashes:{},dependencies:path.join(workspace,'absent-dependencies'),frames:[['scripts/update-cards.js','--quick','--source=nbl','--local-only']],url:candidate.URL,body:'{}',observedAt:'2026-10-22T16:43:40.438Z',deadline:Date.now()+3000}));
  const result=cp.spawnSync(process.execPath,['--require',guard,'--require',probe,entry,'--quick','--source=nbl','--local-only'],{cwd:workspace,env:{...cleanEnv,TMPDIR:runtime,NS_PUBLIC_CANDIDATE_CONFIG:config},encoding:'utf8',timeout:4000});
  const receipt=JSON.parse(fs.readFileSync(state));
  assert.equal(result.status,0,name+': probe must catch the refusal '+result.stderr);
  assert(receipt.violations.some(code=>code.startsWith(reason)),name+': missing sticky refusal');
  assert.equal(receipt.requests,0,name+': no allowed replay request');
  if(name==='managed publication')assert.deepEqual(receipt.blockedPublicationIntent,{sourceScript:'scripts/update-cards.js',rpc:'nothingsports_publish_fixture_source',disposition:'blocked-unqualified-public-payload-schema',payloadRetained:false,managedWrites:0});
  assert.equal(fs.readFileSync(privateFile,'utf8'),privateBytes);
  assert(!result.stdout.includes(privateBytes)&&!result.stderr.includes(privateBytes));
  results.push({name,reason:receipt.violations[0],caughtExitStatus:result.status});
 }
 return results;
}
function replay(directory){
 const inputs=path.join(directory,'replay-inputs');fs.mkdirSync(inputs);
 const source=path.join(ROOT,'scripts/fixtures/public-candidate/nbl-public-input.json'),body=fs.readFileSync(source);
 assert.equal(candidate.sha(body),'205da7e9c1a7ac5c61834a327987606d6ef3623c49c1df041443bc6bc9784563');
 fs.copyFileSync(source,path.join(inputs,'nbl-public-input.json'));
 const receipt={schemaVersion:'canonical-public-candidate.v1',target:'quick:nbl',sourceRevision:'',observedAt:'2026-10-22T16:43:40.438Z',provenance:'constructed-fixture',response:{url:candidate.URL,path:'nbl-public-input.json',sha256:candidate.sha(body),bytes:body.length},processMs:60000,maxGeneratedBytes:128*1024*1024,maxArtifactBytes:32*1024*1024};
 const input=path.join(inputs,'public-candidate.json');
 const git=(cwd,args)=>{const r=cp.spawnSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],{cwd,env:{...cleanEnv,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const before=git(ROOT,['status','--porcelain','--untracked-files=no']),base=git(ROOT,['rev-parse','HEAD']);assert.equal(before,'','Replay requires a committed source');
 const execute=(root,name,patch={})=>{
  const output=path.join(directory,name);fs.writeFileSync(input,JSON.stringify({...receipt,sourceRevision:git(root,['rev-parse','HEAD']),...patch}));
  const result=cp.spawnSync(process.execPath,[path.join(root,'scripts/update-cards.js'),'--public-candidate','--candidate-input='+input,'--candidate-output='+output],{cwd:root,env:cleanEnv,encoding:'utf8',timeout:75000});
  const handover=JSON.parse(fs.readFileSync(path.join(output,'handover.json')));
  assert.equal(handover.managedWrites,0);assert.equal(handover.remotePushes,0);assert.equal(handover.currentSourceAcceptance,false);
  return {output,result,handover};
 };
 const first=execute(ROOT,'first');assert.equal(first.result.status,0,first.handover.blocker);assert.equal(first.handover.state,'prepared-fixture-replay');
 assert.equal(first.handover.ledger.requests,1);assert.deepEqual(first.handover.ledger.violations,[]);
 assert(first.handover.artifact.changed.some(row=>row.path==='data/canonical/nbl-2026-27.json'));
 assert.equal(first.handover.sourceReceipt.observedAt,receipt.observedAt);
 const bundle=path.join(first.output,'candidate.bundle');git(ROOT,['bundle','verify',bundle]);
 const repeat=execute(ROOT,'repeat');assert.equal(repeat.result.status,0,repeat.handover.blocker);
 assert.deepEqual(repeat.handover.artifact.changed,first.handover.artifact.changed,'Repeated facts and generated bytes must agree');
 assert.equal(repeat.handover.artifact.revision,first.handover.artifact.revision,'Same input must not create another candidate revision');
 assert.equal(repeat.handover.artifact.bundleSha256,first.handover.artifact.bundleSha256);
 // Import only into an owned throwaway local clone, never the source refs.
 const staged=path.join(directory,'accepted-local-replay');
 git(directory,['clone','--shared','--no-checkout',ROOT,staged]);
 git(staged,['fetch',bundle,first.handover.artifact.branch]);git(staged,['checkout','--detach','FETCH_HEAD']);
 fs.symlinkSync(fs.realpathSync(path.join(ROOT,'node_modules')),path.join(staged,'node_modules'));
 const unchanged=execute(staged,'unchanged');assert.equal(unchanged.result.status,0,unchanged.handover.blocker);
 assert.equal(unchanged.handover.state,'unchanged-fixture-replay');assert.equal(unchanged.handover.artifact.changed.length,0);assert.equal(fs.existsSync(path.join(unchanged.output,'candidate.bundle')),false);
 const failed=execute(ROOT,'budget-failure',{maxGeneratedBytes:1024});assert.notEqual(failed.result.status,0);assert.equal(failed.handover.blocker,'CANDIDATE_GENERATED_BUDGET');assert.equal(failed.handover.artifact,null);assert.equal(fs.existsSync(path.join(failed.output,'candidate.bundle')),false);
 const faultFile=path.join(staged,'scripts/quick-results.js'),original=fs.readFileSync(faultFile,'utf8');
 const faults=[['private',`require('node:fs').readFileSync(${JSON.stringify(path.join(directory,'private-not-in-candidate'))})`,'CANDIDATE_PRIVATE_FILE'],['publication',`await fetch('https://synthetic.invalid/rest/v1/rpc/nothingsports_publish_fixture_source',{method:'POST',body:'synthetic-only'})`,'CANDIDATE_SHARED_PUBLICATION_UNQUALIFIED']];
 const failures=[];
 for(const [name,operation,reason]of faults){
  // A reviewed source fault fixture deliberately swallows an attempted effect
  // and returns zero. The real controller must still reject its candidate.
  const fault=`if(process.env.NS_PUBLIC_CANDIDATE_CONFIG){(async()=>{try{${operation}}catch{}process.exit(0);})();return;}\n`;
  fs.writeFileSync(faultFile,original.replace("'use strict';","'use strict';\n"+fault));
  git(staged,['add','scripts/quick-results.js']);git(staged,['-c','user.name=Fixture','-c','user.email=fixture@invalid','-c','commit.gpgsign=false','commit','-m','Constructed swallowed effect '+name]);
  const outcome=execute(staged,'swallowed-'+name);assert.notEqual(outcome.result.status,0);assert.equal(outcome.handover.childStatus,0);assert(outcome.handover.ledger.violations.some(value=>value.startsWith(reason)));assert.equal(fs.existsSync(path.join(outcome.output,'candidate.bundle')),false);
  failures.push({name,childStatus:outcome.handover.childStatus,blocker:outcome.handover.blocker});
 }
 assert.equal(git(ROOT,['rev-parse','HEAD']),base);assert.equal(git(ROOT,['status','--porcelain','--untracked-files=no']),before);
 return {state:first.handover.state,sourceRevision:base,changedFiles:first.handover.artifact.changed.length,generatedBytes:first.handover.outputSummary.generatedBytes,revision:first.handover.artifact.revision,bundleSha256:first.handover.artifact.bundleSha256,repeatIdentical:true,unchanged:unchanged.handover.state,generatedBudgetFailure:failed.handover.blocker,swallowedFailures:failures,sourceUnchanged:true};
}
function run(){
 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-candidate-tests-')));
 try{
  const preflightCases=preflight(directory),dispatch=guardedDispatch(directory);
  const proof={schemaVersion:'canonical-candidate-boundaries.v1',preflightCases,dispatch,...(process.argv.includes('--replay')?{replay:replay(directory)}:{}),networkRequests:0,managedWrites:0};
  console.log(JSON.stringify(proof,null,2));return proof;
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)run();
module.exports={run};
