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
function run(){
 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-candidate-tests-')));
 try{
  const preflightCases=preflight(directory),dispatch=guardedDispatch(directory);
  const proof={schemaVersion:'canonical-candidate-boundaries.v1',preflightCases,dispatch,networkRequests:0,managedWrites:0};
  console.log(JSON.stringify(proof,null,2));return proof;
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)run();
module.exports={run};
