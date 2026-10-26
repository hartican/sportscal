'use strict';
// Synthetic local Git/file fixtures only: no deployed facts or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const resolver=require('./resolve-installed-production-baseline'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const SECRET='PRIVATE_INPUT_PATH_URL_OR_ERROR',NOW=Date.now(),stamp=new Date(NOW).toISOString(),clone=v=>JSON.parse(JSON.stringify(v));
async function run(){
 let checks=0;
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'installed-baseline-'));
 function fixture({preserve=true,policy}={}){
  const repo=fs.mkdtempSync(path.join(root,'git-')),git=args=>cp.execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:os.devNull},timeout:5000});
  const write=(file,value)=>{const target=path.join(repo,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
  const commit=message=>{git(['add','.']);git(['commit','--quiet','-m',message]);return git(['rev-parse','HEAD']).trim();};
  git(['init','--quiet']);git(['config','user.name','Synthetic test']);git(['config','user.email','test@example.invalid']);
  write('index.html','<meta name="app-shell-version" content="594">\n');write('service-worker.js','const SHELL_VERSION="594";\n');write('app-version.json','{\n  "version": "594"\n}\n');
  if(policy!==null)write('config/deployment-manifest.json',JSON.stringify(policy||{schemaVersion:'deployment-manifest.v1',compactJson:true,preserveBytes:preserve?resolver.FILES:[]}));
  const baseline=commit('Synthetic live594 source');
  write('index.html','<meta name="app-shell-version" content="595">\n');write('service-worker.js','const SHELL_VERSION="595";\n');write('app-version.json','{"version":"595"}\n');
  const base=commit('Synthetic unshipped main595');
  const record={schemaVersion:'installed-production-baseline.v1',preparedForBaseSha:base,baselineSha:baseline,baselineVersion:'594',deployment:{id:'dpl_LOCALTEST',state:'READY',releaseGitSha:baseline,origin:resolver.ORIGIN,checkedAt:stamp},files:{}};
  for(const file of resolver.FILES){const raw=Buffer.from(git(['show',baseline+':'+file])),served=file==='app-version.json'&&!preserve?Buffer.from(JSON.stringify(JSON.parse(raw))+'\n'):raw;record.files[file]={gitSha256:hash(raw),servedSha256:hash(served),servedBytes:served.length,status:200,checkedAt:stamp};}
  const source=fs.readFileSync(path.join(__dirname,'resolve-installed-production-baseline.js'));write('scripts/resolve-installed-production-baseline.js',source);
  const recordCommit=value=>{write(resolver.RECORD,typeof value==='string'?value:JSON.stringify(value));return commit('Synthetic committed baseline record');};recordCommit(record);
  return{repo,git,write,commit,baseline,base,record,recordCommit};
 }
 try{
  const f=fixture(),resolve=record=>resolver.resolve({record,prBaseSha:f.base,root:f.repo,now:NOW});
  assert.equal(resolve(f.record),f.baseline,'Live594 wins over unshippedmain595, with candidate595');checks++;
  const mutations=[
   ['record_schema',r=>r.schemaVersion='unknown'],['record_shape',r=>r.url='https://'+SECRET],['file_set',r=>r.files=[]],
   ['record_sha',r=>r.baselineSha='--'+SECRET],['record_sha',r=>r.preparedForBaseSha='A'.repeat(40)],['record_base_mismatch',r=>r.preparedForBaseSha='a'.repeat(40)],
   ['baseline_version',r=>r.baselineVersion=594],['baseline_version',r=>r.baselineVersion='0594'],['baseline_version',r=>r.baselineVersion='9'.repeat(17)],
   ['deployment_shape',r=>r.deployment.headers=SECRET],['deployment_binding',r=>r.deployment.state='BUILDING'],['deployment_binding',r=>r.deployment.id=SECRET],
   ['deployment_binding',r=>r.deployment.releaseGitSha=f.base],['deployment_binding',r=>r.deployment.origin='https://outside.invalid/'+SECRET],
   ['evidence_timestamp',r=>r.deployment.checkedAt='2026-02-30T00:00:00Z'],['evidence_not_fresh',r=>r.deployment.checkedAt=new Date(NOW+1).toISOString()],
   ['evidence_not_fresh',r=>r.deployment.checkedAt=new Date(NOW-86400001).toISOString()],['file_set',r=>delete r.files['service-worker.js']],
   ['file_set',r=>r.files['../'+SECRET]=r.files['index.html']],['file_proof',r=>r.files['index.html'].url=SECRET],['file_proof',r=>r.files['index.html'].status=304],
   ['file_proof',r=>r.files['index.html'].servedBytes=0],['file_proof',r=>r.files['index.html'].servedBytes=4194305],['file_proof',r=>r.files['index.html'].gitSha256=SECRET],
   ['file_proof',r=>r.files['index.html'].servedSha256=SECRET],['evidence_not_fresh',r=>r.files['index.html'].checkedAt=new Date(NOW-86400001).toISOString()],
   ['source_hash_mismatch',r=>r.files['index.html'].gitSha256='0'.repeat(64)],['served_hash_mismatch',r=>r.files['index.html'].servedSha256='0'.repeat(64)],
   ['served_hash_mismatch',r=>r.files['index.html'].servedBytes++],['baseline_version',r=>r.baselineVersion='593'],
   ['strict_upgrade_required',r=>{r.baselineSha=f.base;r.baselineVersion='595';r.deployment.releaseGitSha=f.base;}],
   ['git_read_failed',r=>{r.baselineSha='0'.repeat(40);r.deployment.releaseGitSha=r.baselineSha;}]
  ];
  for(const[code,change]of mutations){const r=clone(f.record);change(r);assert.throws(()=>resolve(r),e=>resolver.failureCode(e)===code,code);checks++;}
  assert.throws(()=>resolver.resolve({record:f.record,prBaseSha:SECRET,root:f.repo,now:NOW}),e=>resolver.failureCode(e)==='pr_base_missing');checks++;
  const unrelated=f.git(['commit-tree',f.baseline+'^{tree}','-m','Synthetic unrelated history']).trim(),foreign=clone(f.record);foreign.baselineSha=unrelated;foreign.deployment.releaseGitSha=unrelated;
  assert.throws(()=>resolve(foreign),e=>resolver.failureCode(e)==='baseline_not_ancestor');checks++;
  foreign.preparedForBaseSha=unrelated;assert.throws(()=>resolver.resolve({record:foreign,prBaseSha:unrelated,root:f.repo,now:NOW}),e=>resolver.failureCode(e)==='base_not_ancestor');checks++;
  const compact=fixture({preserve:false});assert.equal(resolver.resolve({record:compact.record,prBaseSha:compact.base,root:compact.repo,now:NOW}),compact.baseline);assert.notEqual(compact.record.files['app-version.json'].gitSha256,compact.record.files['app-version.json'].servedSha256);checks++;
  for(const policy of [null,{schemaVersion:'unknown',compactJson:true,preserveBytes:[]},{schemaVersion:'deployment-manifest.v1',compactJson:'yes',preserveBytes:[]}]){
   const bad=fixture({policy});assert.throws(()=>resolver.resolve({record:bad.record,prBaseSha:bad.base,root:bad.repo,now:NOW}),e=>resolver.failureCode(e)==='deployment_policy');checks++;
  }
  const boundary=clone(f.record);boundary.deployment.checkedAt=new Date(NOW-86400000).toISOString();assert.equal(resolve(boundary),f.baseline);checks++;
  const tagged=clone(f.record);f.git(['tag','-a','synthetic-baseline-tag',f.baseline,'-m','Test tag is not a commit id']);tagged.baselineSha=f.git(['rev-parse','synthetic-baseline-tag']).trim();tagged.deployment.releaseGitSha=tagged.baselineSha;assert.throws(()=>resolve(tagged),e=>resolver.failureCode(e)==='git_commit_required');checks++;
  const logs=[],deniedEnvironment=new Proxy({},{get(){throw Error(SECRET);}});resolver.main({argv:[],environment:deniedEnvironment,root:path.join(root,'missing'),log:line=>logs.push(line)});assert.deepEqual(JSON.parse(logs[0]),{state:'INERT_NO_BASELINE_READ',gitCalls:0,networkCalls:0});checks++;
  assert.equal(resolver.failureCode({baselineCode:SECRET,message:SECRET}),'resolution_failed');checks++;
  const preload=path.join(root,'deny.cjs');fs.writeFileSync(preload,"let n=0;const deny=()=>{n++;throw Error('Network forbidden');};global.fetch=deny;for(const name of ['http','https','net','tls']){const m=require('node:'+name);for(const k of ['request','get','connect','createConnection'])if(typeof m[k]==='function')m[k]=deny;}process.on('exit',()=>console.log(JSON.stringify({networkCalls:n})));\n");
  function cli({args=['--resolve'],output=path.join(root,'output-'+checks),base=f.base}={}){
   const p=cp.spawnSync(process.execPath,['--require',preload,path.join(f.repo,'scripts/resolve-installed-production-baseline.js'),...args],{cwd:f.repo,encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH,NS_INSTALLED_PR_BASE_SHA:base,GITHUB_OUTPUT:output}});
   assert(!p.error);assert(!p.stdout.includes(SECRET)&&!p.stderr.includes(SECRET)&&!p.stderr.includes(f.repo));assert(p.stdout.includes('"networkCalls":0'));return{...p,output};
  }
  const output=path.join(root,'valid-output');fs.writeFileSync(output,'');let result=cli({output});assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(output,'utf8'),'baseline_sha='+f.baseline+'\n');assert(!result.stdout.includes(f.baseline)&&!result.stdout.includes(f.base));checks++;
  f.write(resolver.RECORD,JSON.stringify({url:SECRET}));fs.writeFileSync(output,'');result=cli({output});assert.equal(result.status,0,'Uncommitted working copy cannot replace HEAD record');assert.equal(fs.readFileSync(output,'utf8'),'baseline_sha='+f.baseline+'\n');checks++;
  f.recordCommit('{'+SECRET);fs.writeFileSync(output,'prior\n');result=cli({output});assert.equal(result.status,1);assert(result.stderr.includes('record_json'));assert.equal(fs.readFileSync(output,'utf8'),'prior\n');checks++;
  f.recordCommit(f.record);result=cli({output:path.join(root,SECRET)});assert.equal(result.status,1);assert(result.stderr.includes('output_unavailable'));assert(!fs.existsSync(path.join(root,SECRET)));checks++;
  const symlink=path.join(root,'output-symlink');fs.symlinkSync(output,symlink);result=cli({output:symlink});assert.equal(result.status,1);assert(result.stderr.includes('output_unavailable'));assert.equal(fs.readFileSync(output,'utf8'),'prior\n');checks++;
  result=cli({output:root});assert.equal(result.status,1);assert(result.stderr.includes('output_unavailable'));checks++;
  result=cli({args:['--resolve','--record',SECRET],output});assert.equal(result.status,1);assert(result.stderr.includes('invalid_arguments'));checks++;
  fs.unlinkSync(path.join(f.repo,resolver.RECORD));fs.symlinkSync(SECRET,path.join(f.repo,resolver.RECORD));f.commit('Synthetic symlink record');result=cli({output});assert.equal(result.status,1);assert(result.stderr.includes('record_unavailable'));assert.equal(fs.readFileSync(output,'utf8'),'prior\n');checks++;
  fs.renameSync(path.join(f.repo,'.git'),path.join(f.repo,'hidden-git'));result=cli({output});assert.equal(result.status,1);assert.equal(result.stderr.trim(),'Installed baseline resolver: git_read_failed');assert.equal(fs.readFileSync(output,'utf8'),'prior\n');checks++;
  return{checks,networkCalls:0,browserRuns:0,cloudVerification:false,releaseAcceptance:false};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
module.exports=run;
if(require.main===module)run().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
