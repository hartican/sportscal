'use strict';
// Actual pure policy and extracted guard predicates; never loads the preload.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),C=require('./epl-contract.cjs'),E=require('./epl-policy.cjs');
const profile=require('./epl-profile.json'),root='/owned/source',p={...profile,mode:'epl-canonical',root,sourceRoot:root,writeFiles:profile.writeFiles.map(f=>path.join(root,f)),writeCaps:Object.fromEntries(Object.entries(profile.writeCaps).map(([f,v])=>[path.join(root,f),v])),rollbackHashes:Object.fromEntries(Object.entries(profile.rollbackInventory).map(([f,v])=>[path.join(root,f),v.sha256]))};
const cases=[];function good(name,fn){fn();cases.push({name,status:'PASS'});}function denied(name,fn){good(name,()=>assert.throws(fn,/GUARD_EPL|EPL_/));}
good('exact source-complete finite policy',()=>assert.equal(E.validate(p),true));
for(const[key,value]of[['sourceGitSha','0'.repeat(40)],['credentialEnvironmentNames',['SUPABASE_SECRET_KEY']],['wholeSeconds',181],['entryArgv',['scripts/update-cards.js','--quick','--source=football','--local-only']]])denied('independent JS policy refuses '+key,()=>E.validate({...p,[key]:value}));
denied('same-count wildcard substitution refused',()=>E.validate({...p,writeFiles:[...p.writeFiles.slice(1),root+'/data/other.json']}));
denied('retained path cap expansion refused',()=>E.validate({...p,writeCaps:{...p.writeCaps,[p.writeFiles[0]]:33554432}}));
const ids=Object.fromEntries(C.KEYS.map(file=>[file,[p.surfaceIds[file][0]]])),pub=[...C.PUB,'--epl-updated-ids='+JSON.stringify(ids)],history=[...C.PREFIX,pub,['scripts/qa-storyline-spoilers.js',C.KEYS[0]],['scripts/qa-storyline-spoilers.js',C.KEYS[1]],['scripts/build-paged-feed.js'],...C.TAIL];
good('source DAG admits complete mandatory publication closure',()=>{const dag=E.dag(p,'source');history.forEach(dag.next);assert(dag.complete());});
denied('partial mandatory DAG cannot exit cleanly',()=>{const dag=E.dag(p,'source');dag.next(C.PREFIX[0]);dag.complete();});
denied('projection child cannot launch any grandchild',()=>E.dag(p,'projection').next(C.TAIL[0]));
denied('canonical entry cannot launch a second source',()=>{const dag=E.dag(p,'entry');dag.next(p.sourceArgv);dag.next(p.sourceArgv);});
denied('publisher cannot mix Rugby selector',()=>{const dag=E.dag(p,'source');C.PREFIX.forEach(dag.next);dag.next([...pub,'--coverage-sport=rugby-union']);});
denied('duplicate JSON selector key refused',()=>C.selector('--epl-updated-ids={"data/events.json":[],"data/events.json":[],"feeds/incoming/events.json":[]}',p));
const guard=fs.readFileSync(path.join(__dirname,'guard.cjs'),'utf8');
for(const code of['GUARD_NATIVE_NETWORK','GUARD_NATIVE_DNS','GUARD_NATIVE_SOCKET']){
 const marker="deny('"+code+"')",at=guard.indexOf(marker),start=guard.lastIndexOf('if(control||',at),end=guard.indexOf(';}',at);assert(start>=0&&end>at);
 const text=guard.slice(start,end+1);let delegated=0;const context={control:null,eplMode:true,scope:{getStore:()=>true},deny:code=>{throw Error(code);},original:()=>delegated++,connect:()=>delegated++,args:[]};
 const fn=vm.runInNewContext('(function(){'+text+'})',context);
 good('actual '+code+' predicate denies EPL even in a true legacy ALS context',()=>{assert.throws(()=>fn(),new RegExp(code));assert.equal(delegated,0);});
 context.eplMode=false;good('original Rugby ALS behavior retained for '+code,()=>{fn();assert.equal(delegated,1);});
}
const envStart=guard.indexOf('function eplEnvironment(env,command=argv){'),envEnd=guard.indexOf('\neplEnvironment(process.env);',envStart);assert(envStart>=0&&envEnd>envStart);
const envCheck=vm.runInNewContext('(function(){'+guard.slice(envStart,envEnd)+';return eplEnvironment;})()',{eplMode:true,root,argv:['scripts/quick-results.js'],tmp:'/owned/run/tmp',run:'/owned/run',path,deny:code=>{throw Error(code);}});
const environment={TMPDIR:'/owned/run/tmp',TZ:'Australia/Sydney',REFRESH_REPORT:'/owned/run/refresh-report.json',QUICK_RESULTS_REPORT:'/owned/run/quick-results-report.json',FOOTBALL_DATA_RUN_DIR:'/owned/run/tmp/football-backup',GOLF_SOURCE_REPORT:'/owned/run/tmp/football-backup/golf-source-report.json',GOLF_SOURCE_RUN_ID:'123e4567-e89b-12d3-a456-426614174000'};
good('canonical Golf metadata compatibility is private basename+UUID only',()=>envCheck(environment));
const stripped={...environment};for(const key of['FOOTBALL_DATA_RUN_DIR','GOLF_SOURCE_REPORT','GOLF_SOURCE_RUN_ID','REFRESH_REPORT'])delete stripped[key];good('existing validation children may omit deliberately stripped diagnostic variables',()=>envCheck(stripped,['scripts/validate-feed.js']));denied('source child cannot omit its pinned report or budget path',()=>envCheck(stripped));
for(const[key,value]of[['GOLF_SOURCE_REPORT','/owned/run/tmp/football-backup/other.json'],['GOLF_SOURCE_REPORT','/outside/golf-source-report.json'],['GOLF_SOURCE_RUN_ID','provider-secret'],['FOOTBALL_DATA_RUN_DIR','/owned/run/tmp/other'],['TMPDIR','/outside'],['REFRESH_REPORT','/outside/report.json']])denied('diagnostic environment rejects '+key+' substitution',()=>envCheck({...environment,[key]:value}));
denied('Golf source child not admitted by the EPL DAG',()=>E.dag(p,'source').next(['scripts/refresh-golf-sports.js']));
good('Golf metadata exception grants no canonical Golf write target',()=>assert(!profile.writeFiles.includes('data/canonical/golf-context-2026.json')));
console.log(JSON.stringify({status:'PASS',checks:cases.length,cases,actualProviderRequests:0,nativeConnections:0,guardPreloadExecutions:0,supervisorMainOrInspect:0,nativeChildren:0}));
