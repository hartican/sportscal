'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
async function run(){
 const quick=require('./quick-results'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-report-rollback-'));
 const cwd=process.cwd(),keys=['REFRESH_REPORT','QUICK_RESULTS_REPORT','FOOTBALL_DATA_RUN_DIR','GOLF_SOURCE_REPORT','GOLF_SOURCE_RUN_ID'],previous=new Map(keys.map(key=>[key,process.env[key]])),warnings=[],failures=[];
 const warn=console.warn;console.warn=(...args)=>warnings.push(args.join(' '));
 try{
  const file=path.join(__dirname,'update-cards.js'),source=fs.readFileSync(file,'utf8'),start=source.indexOf('async function main(){'),end=source.indexOf('\nif (require.main === module)',start);
  assert(start>=0&&end>start);
  // Execute the actual full entrypoint catch/finally and real atomicRefresh.
  // Only source work is replaced with the deliberately failing local operation.
  const full=operation=>{
   const context={require:createRequire(file),fs,path,os,crypto:require('node:crypto'),console:{...console,error(){},warn:console.warn},process:{env:process.env,argv:['node',file,'--offline','--local-only']},parseOptions(){},runMain:()=>quick.atomicRefresh({},{refreshOperation:operation})};
   vm.runInNewContext(source.slice(start,end)+';globalThis.invoke=main',context);
   return context.invoke();
  };
  for(const mode of ['quick','full','nhl','chl','nfl'])for(const [name,refreshKind,quickKind]of mode==='quick'||mode==='full'?[['malformed-canonical','malformed','valid'],['unwritable-canonical','blocked','valid'],['malformed-quick','valid','malformed'],['unwritable-quick','valid','blocked'],['both-unwritable','blocked','blocked']]:[['unwritable-quick','valid','blocked']]){
   const root=path.join(directory,mode+'-'+name);fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.mkdirSync(path.join(root,'feeds/incoming'),{recursive:true});fs.mkdirSync(path.join(root,'assets/js'),{recursive:true});
   const diagnostic=path.join(root,'diagnostics');fs.mkdirSync(diagnostic);
   const destination=(kind,name)=>{const result=path.join(diagnostic,name+'.json');if(kind==='blocked'){fs.writeFileSync(result,'This is a file, so no child report can be written here.');return path.join(result,'report.json');}fs.writeFileSync(result,kind==='malformed'?'{invalid-json':'{}');return result;};
   // main's initial report is valid; break it only inside the operation after
   // mutation, so this exercises failure handling rather than startup rejection.
   process.env.REFRESH_REPORT=path.join(diagnostic,'canonical.json');fs.writeFileSync(process.env.REFRESH_REPORT,'{}');
   process.env.QUICK_RESULTS_REPORT=destination(quickKind,'quick');
   for(const key of keys.slice(2))delete process.env[key];
   const baseline=new Map([['data/facts.json',Buffer.from('{"accepted":true}\n')],['feeds/incoming/events.json',Buffer.from('{"events":[]}\n')],['assets/js/app-shell-runtime.js',Buffer.from('accepted-runtime\n')]]);
   for(const [name,bytes]of baseline)fs.writeFileSync(path.join(root,name),bytes);
   const original=new Error('controlled inner source failure');original.refreshFailure={step:'scripts/controlled-source.js',detail:'fixture:tennis:espn:wta:185347: original verified-result guard'};
   const operation=async()=>{for(const name of baseline.keys())fs.writeFileSync(name,'mutated candidate');fs.writeFileSync('data/new-candidate.json','{}');fs.writeFileSync('feeds/new-candidate.js','candidate');process.env.REFRESH_REPORT=destination(refreshKind,'failed-canonical');throw original;};
   process.chdir(root);let caught,adapter,refreshFile;
   try{
    if(mode!=='full'&&mode!=='quick'){
     adapter=require('./lib/'+mode+'-results');refreshFile=adapter.refreshFile;adapter.refreshFile=operation;
     await quick.atomicRefresh({source:mode});
    }else await(mode==='full'?full(operation):quick.atomicRefresh({},{refreshOperation:operation}));
   }catch(error){caught=error;}finally{if(adapter)adapter.refreshFile=refreshFile;}
   const issues=[];
   if(caught!==original)issues.push('original error replaced by '+(caught?.code||caught?.name||'success'));
   for(const [name,bytes]of baseline)if(!fs.readFileSync(name).equals(bytes))issues.push('not restored: '+name);
   for(const name of ['data/new-candidate.json','feeds/new-candidate.js'])if(fs.existsSync(name))issues.push('new file retained: '+name);
   if(original.refreshFailure.detail!=='fixture:tennis:espn:wta:185347: original verified-result guard')issues.push('inner diagnostic changed');
   if(quickKind!=='blocked'){
    const report=JSON.parse(fs.readFileSync(process.env.QUICK_RESULTS_REPORT,'utf8'));
    if(report.publicationState!=='blocked-rolled-back'||report.blockingError!==original.message)issues.push('quick failure report missing original cause/rollback state');
   }
   process.chdir(cwd);
   const label=mode+'/'+name;console.log((issues.length?'FAIL ':'PASS ')+label+(issues.length?': '+issues.join('; '):': exact error and complete data/Feed/runtime rollback'));
   if(issues.length)failures.push({label,issues});
  }
  assert.equal(failures.length,0,JSON.stringify(failures));
  assert(warnings.length,'Unwritable diagnostics remain visible as warnings');
  console.log('Failure diagnostics: actual quick/full chains preserve the original inner error and complete rollback for malformed/unwritable canonical and quick reports.');
 }finally{
  process.chdir(cwd);console.warn=warn;
  for(const [key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;
  fs.rmSync(directory,{recursive:true,force:true});
 }
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports=run;
