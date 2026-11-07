'use strict';
// Actual project/atomicRefresh modules and owned files only. No updater main,
// supervisor/native guard, service/provider request, or runtime builder runs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
async function run(){
 const captured=require('./fixtures/rugby-retained-start-20261030.json'),quick=require('./quick-results'),project=require('./sync-live-coverage').project;
 const prior={events:[{...captured.retained,startTimeUtc:'2026-10-23T08:46:00.000Z'}],participants:[],competitions:[],sources:[]},final=captured.rows.filter(r=>r.fixture.status==='completed'),options={coverageSport:'rugby-union',strictSourceEvidence:true,now:new Date(captured.now)},before=JSON.stringify({prior,final});
 let conflict;try{project(prior,final,options);}catch(error){conflict=error;}
 assert.match(conflict?.message||'',/result conflicts with retained coverage start/);
 assert.equal(captured.retained.startTimeUtc,'2026-10-23T08:45:00.000Z');
 assert(final.every(r=>r.fixture.startTimeUtc==='2026-10-23T08:30:00.000Z'));
 assert.equal(captured.rows.find(r=>r.fixture.status==='scheduled').fixture.startTimeUtc,'2026-10-23T08:30:00.000Z');
 const cwd=process.cwd(),directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-rollback-scope-'))),write=fs.writeFileSync,readdir=fs.readdirSync,previous=Object.fromEntries(['REFRESH_REPORT','QUICK_RESULTS_REPORT'].map(k=>[k,process.env[k]])),runtime=require('./build-app-shell-runtime').generatedFiles();
 try{
  for(const key of Object.keys(previous))delete process.env[key];
  for(const scenario of ['unchanged','mutated','removed-baseline','new-runtime','late-diagnostic-refusal','restoration-failure','enumeration-failure']){
   const dir=path.join(directory,scenario);fs.mkdirSync(dir);process.chdir(dir);fs.mkdirSync('data');fs.mkdirSync('feeds');fs.mkdirSync('assets/js',{recursive:true});
   const baseline=new Map([['data/a-retained.json',Buffer.from('retained outside write scope\n')],['data/z-candidate.json',Buffer.from('accepted data\n')],['feeds/events.json',Buffer.from('accepted Feed\n')],...runtime.slice(0,4).map(f=>[f,Buffer.from('accepted '+f+'\n')])]);
   for(const [file,bytes]of baseline)write(file,bytes);
   const protectedPaths=new Set([path.resolve('data/a-retained.json'),...runtime.slice(0,['mutated','restoration-failure'].includes(scenario)?0:4).map(f=>path.resolve(f))]),attempted=[];
   fs.writeFileSync=function(file,...args){const f=path.resolve(String(file));attempted.push(f);if(scenario==='restoration-failure'&&f===path.resolve('data/z-candidate.json'))throw Object.assign(Error('OWNED_RESTORE_REFUSED'),{code:'EACCES'});if(protectedPaths.has(f))throw Object.assign(Error('GUARD_WRITE_SCOPE'),{code:'GUARD_WRITE_SCOPE'});return write.call(this,file,...args);};
   if(scenario==='late-diagnostic-refusal')process.env.REFRESH_REPORT=path.join(dir,'data/a-retained.json','unwritable.json');
   let caught,sourceError,enumerationFailed=false;
   fs.readdirSync=function(file,...args){if(enumerationFailed&&path.resolve(String(file))===path.resolve('data'))throw Error('OWNED_ENUMERATION_REFUSED');return readdir.call(this,file,...args);};
   if(['restoration-failure','enumeration-failure'].includes(scenario))process.env.QUICK_RESULTS_REPORT=path.join(dir,'quick-report.json');
   try{await quick.atomicRefresh({source:'live-coverage',coverageSport:'rugby-union'},{refreshOperation:async()=>{
    if(scenario==='mutated'||scenario==='restoration-failure'){write('data/z-candidate.json','candidate data');write('feeds/events.json','candidate Feed');for(const f of runtime)write(f,'candidate runtime');write('data/new-candidate.json','new candidate');}
    if(scenario==='removed-baseline')fs.unlinkSync('data/z-candidate.json');
    if(scenario==='enumeration-failure'){write('feeds/new-candidate.js','new Feed candidate');enumerationFailed=true;}
    if(scenario==='new-runtime')for(const f of runtime.slice(4))write(f,'new candidate runtime');
    // The actual project rejects this deliberately unsupported start; the reviewed exact08:45 case has its separate correction controls.
    try{project(prior,final,options);}catch(error){sourceError=error;throw error;}
   }});}catch(error){caught=error;}finally{fs.writeFileSync=write;fs.readdirSync=readdir;delete process.env.REFRESH_REPORT;}
   assert.equal(caught,sourceError,scenario+' preserves the exact exception');
   if(['restoration-failure','enumeration-failure'].includes(scenario)){const report=JSON.parse(fs.readFileSync(process.env.QUICK_RESULTS_REPORT));assert.equal(report.publicationState,'blocked-rollback-failed');assert.equal(report.blockingError,sourceError.message);assert.deepEqual(report.rollback.failures,[scenario==='restoration-failure'?'OWNED_RESTORE_REFUSED':'OWNED_ENUMERATION_REFUSED']);delete process.env.QUICK_RESULTS_REPORT;}
   assert.equal(caught?.message,conflict.message,scenario+' keeps the original source refusal');
   assert(!attempted.some(f=>protectedPaths.has(f)),scenario+' never rewrites protected unchanged bytes');
   assert.equal(caught.refreshRollback.status,['restoration-failure','enumeration-failure'].includes(scenario)?'failed':'restored');
   if(scenario==='restoration-failure')assert.deepEqual(caught.refreshRollback.failures,['OWNED_RESTORE_REFUSED']);
   for(const [file,bytes]of baseline)if(!(scenario==='restoration-failure'&&file==='data/z-candidate.json'))assert(fs.readFileSync(file).equals(bytes),scenario+' restores '+file);
   for(const file of [...runtime.slice(4),'data/new-candidate.json','feeds/new-candidate.js'])assert(!fs.existsSync(file),scenario+' removes absent-before '+file);
  }
  assert.equal(JSON.stringify({prior,final}),before,'No captured identity/date/result or observation is changed');
  console.log('Rollback write scope: seven actual quick-owner cases retain an unsupported start refusal and report failed restoration honestly, restore data/Feed/runtime bytes and absent files, skip protected unchanged files and preserve all captured facts. No live request or native execution.');
 }finally{
  fs.writeFileSync=write;fs.readdirSync=readdir;process.chdir(cwd);for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;fs.rmSync(directory,{recursive:true,force:true});
 }
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports=run;
