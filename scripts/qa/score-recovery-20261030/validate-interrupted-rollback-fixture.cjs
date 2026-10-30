'use strict';
// Source/model rehearsal only: actual atomicRefresh + actual projection branch,
// with owned FS, exit and fault boundaries. No guard preload, child, supervisor,
// timer, hang or process-group execution. Linux qualification remains required.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const arg=(name,fallback)=>{const n=process.argv.indexOf(name);return n<0?fallback:process.argv[n+1];},sourceRoot=arg('--source-root'),baselineRoot=arg('--baseline-source-root'),priorProjection=arg('--prior-projection');assert(sourceRoot);
const boundary=fs.readFileSync(path.join(__dirname,'control-boundary.cjs'),'utf8'),current=fs.readFileSync(path.join(__dirname,'control-projection.cjs'),'utf8'),start=boundary.indexOf('function dirtyInterruptedRollback(){'),end=boundary.indexOf('\n}\n',start)+3;assert(start>=0&&end>start);
const predicate=boundary.match(/if\((caseName==='interrupted-rollback'[\s\S]*?)\)\{native\.write/)[1],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=[],native={write:fs.writeFileSync.bind(fs),read:fs.readFileSync.bind(fs),exists:fs.existsSync.bind(fs)},originalWrite=fs.writeFileSync,cwd=process.cwd(),oldEnv=Object.fromEntries(['REFRESH_REPORT','QUICK_RESULTS_REPORT'].map(k=>[k,process.env[k]])),oldWarn=console.warn;
const parent=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-interrupted-model-')));for(const key of Object.keys(oldEnv))delete process.env[key];console.warn=()=>{};
async function exercise(name,root,projection,dirtyAllowed,expect){
 const quick=require(path.join(root,'scripts/quick-results.js')),dir=path.join(parent,name);fs.mkdirSync(dir);fs.mkdirSync(dir+'/data');fs.mkdirSync(dir+'/feeds');fs.mkdirSync(dir+'/run');const retained=dir+'/data/retained-only.json',baseline=Buffer.from('accepted rollback-only bytes\n');native.write(retained,baseline);
 const p={mode:'owned-control',root:dir,sourceRoot:root,controlBoundary:'owned-boundary',controlCase:'interrupted-rollback',controlRuntimeOutputs:[],rollbackHashes:{[retained]:sha(baseline)},writeFiles:[],runDir:dir+'/run'},context={p,root:dir,caseName:'interrupted-rollback',path,crypto,native};
 vm.runInNewContext(boundary.slice(start,end)+';globalThis.dirty=dirtyInterruptedRollback',context);const gate=vm.runInNewContext('(file,key)=>'+predicate,{...context,map:file=>path.resolve(String(file))});let intercepted=false,dirtied=false,original;
 fs.writeFileSync=function(file,...args){if(gate(file,'writeFileSync')){intercepted=true;native.write(path.resolve(String(file)),'truncated rollback');throw Error('OWNED_INTERRUPTION_PROBE');}return originalWrite.call(this,file,...args);};process.chdir(dir);
 try{
  await quick.atomicRefresh({source:'live-coverage'},{refreshOperation:async()=>{
   const exit=Object.assign(Error('OWNED_CHILD_EXIT'),{status:1});
   try{vm.runInNewContext(projection,{require:key=>key==='node:fs'?{readFileSync:()=>JSON.stringify(p)}:key==='node:path'?path:key===p.controlBoundary?{dirtyInterruptedRollback:()=>{assert(dirtyAllowed);context.dirty();dirtied=!native.read(retained).equals(baseline);}}:(()=>{throw Error('UNEXPECTED_MODEL_REQUIRE')})(),process:{env:{NS_SCORE_GUARD_POLICY:'owned-policy'},argv:['node','scripts/publish-feed.js'],exit:code=>{assert.equal(code,1);throw exit;}}});}
   catch(error){assert.equal(error,exit);original=error;native.write(p.runDir+'/first-error.json','{}');throw error;}
  }});
 }catch(error){if(root===sourceRoot||!intercepted)assert.equal(error,original);else assert.equal(error.message,'OWNED_INTERRUPTION_PROBE');}
 finally{fs.writeFileSync=originalWrite;process.chdir(cwd);}
 assert.equal(intercepted,expect,name+' must model the intended necessary-rollback hook');if(dirtyAllowed)assert(dirtied,'Changed fixture must be real before rollback');
 results.push({case:name,requiredInterruptionReached:intercepted,baselineDirtied:dirtied,productionSourceUnchanged:true,meaning:expect?'HOOK_REACHED_MODEL_ONLY':'OLD_CONTROL_ASSUMPTION_RED'});
}
(async()=>{
 try{
  if(priorProjection){const prior=fs.readFileSync(priorProjection,'utf8');if(baselineRoot)await exercise('old-source-old-control',baselineRoot,prior,false,true);await exercise('new-source-old-control',sourceRoot,prior,false,false);}
  await exercise('new-source-changed-control',sourceRoot,current,true,true);
  const dir=path.join(parent,'guards');fs.mkdirSync(dir);fs.mkdirSync(dir+'/data');const file=dir+'/data/retained-only.json';native.write(file,'baseline');
  const p={mode:'owned-control',root:dir,sourceRoot,writeFiles:[],rollbackHashes:{[file]:sha(Buffer.from('baseline'))}},base={p,root:dir,caseName:'interrupted-rollback',path,crypto,native};
  for(const[name,change]of [['actual-mode',v=>v.p.mode='live-coverage-canonical'],['same-source-root',v=>v.p.sourceRoot=dir],['wrong-case',v=>v.caseName='good'],['ordinary-write',v=>v.p.writeFiles=[file]],['wrong-baseline',v=>v.p.rollbackHashes[file]='0'.repeat(64)]]){
   const c={...base,p:structuredClone(p)};change(c);vm.runInNewContext(boundary.slice(start,end)+';globalThis.dirty=dirtyInterruptedRollback',c);assert.throws(()=>c.dirty(),/CONTROL_ROLLBACK_FIXTURE_REQUIRED/);assert.equal(native.read(file).toString(),'baseline');results.push({case:name,status:'REFUSED'});
  }
  console.log(JSON.stringify({status:'PASS_MODEL_ONLY',results,sourceRoot,realRequests:0,realKeys:0,nativeGuardOrSupervisorRuns:0,clockKillOrGroupCloseProof:'PENDING_ROOT_LINUX_QUALIFICATION',exactOriginalLinuxAssertion:'UNKNOWN'}));
 }finally{fs.writeFileSync=originalWrite;process.chdir(cwd);console.warn=oldWarn;for(const[k,v]of Object.entries(oldEnv))if(v===undefined)delete process.env[k];else process.env[k]=v;fs.rmSync(parent,{recursive:true,force:true});}
})().catch(()=>{console.error('INTERRUPTED_FIXTURE_MODEL_FAILED');process.exitCode=1;});
