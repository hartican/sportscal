'use strict';
// Only update-cards --a-league dispatches this scores-only operation. No CLI.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
function createOwner({contract,source,label,mode,key,selector,validationSteps}){
const {createReader,LIMITS}=source;
const ROOT=path.resolve(__dirname,'../..');
const candidates=[contract.FILE+'.candidate',contract.FILE.replace('.json','.js')+'.candidate'];
function reserve(output,onReserved){
 if(!path.isAbsolute(output)||path.resolve(output)!==output||fs.existsSync(output))throw Error(label+' requires a new absolute evidence directory');
 const parent=path.dirname(output);if(fs.realpathSync(parent)!==parent)throw Error(label+' evidence parent cannot be symlinked');
 for(let dir=parent;;dir=path.dirname(dir)){if(path.basename(dir)==='.git'||fs.existsSync(path.join(dir,'.git')))throw Error(label+' evidence cannot be inside a repository');if(dir===path.dirname(dir))break;}
 fs.mkdirSync(output,{mode:0o700});const stat=fs.lstatSync(output);onReserved({dev:stat.dev,ino:stat.ino});if(fs.realpathSync(output)!==output||!stat.isDirectory())throw Error(label+' evidence identity changed');
}
function runChild(deadline,...args){
 const timeout=Math.floor(deadline-performance.now());if(timeout<=0)throw Error(label+' owner deadline before child');
 const env={...process.env};for(const key of ['FOOTBALL_DATA_API_TOKEN','FOOTBALL_DATA_RUN_DIR','FOOTBALL_DATA_REPORT','GOLF_SOURCE_RUN_ID','GOLF_SOURCE_REPORT','WRC_SOURCE_FAILURE_REPORT','REFRESH_REPORT'])delete env[key];
 const result=require('./refresh-child').run(process.execPath,args,{env,timeout,killSignal:'SIGKILL'});if(result.status!==0){const error=Error(label+' required child failed: '+args[0]);error.refreshFailure={step:args[0],detail:require('./refresh-report').diagnosticTail(result.error?.message||result.stderr?.toString()||error.message)};throw error;}
}
async function run({output,root=ROOT,began=performance.now(),clock=()=>performance.now(),now,acquire,runStep=runChild,emit=()=>{}}){
 if(path.resolve(root)!==process.cwd())throw Error(label+' owner requires its working root');
 const deadline=began+LIMITS.ownerMs,check=()=>{const at=clock();if(!Number.isFinite(began)||!Number.isFinite(at)||at<began||at>=deadline)throw Error(label+' owner deadline or invalid monotonic clock');};
 const snapshots=new Map();
 function inventory(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())inventory(file);else snapshots.set(file,contract.sha(fs.readFileSync(path.join(root,file))));}}
 const allowed=new Set([contract.FILE,contract.FILE.replace('.json','.js'),'data/code-inspector/football.json','data/follow-schedule/football.json']);
 let identity,reader,report={mode,changed:[],deferrals:[],sourceFailures:[],publicationState:'starting'};
 const owns=()=>{try{const stat=fs.lstatSync(output);return identity&&stat.isDirectory()&&!stat.isSymbolicLink()&&stat.dev===identity.dev&&stat.ino===identity.ino;}catch{return false;}};
 const save=(name,value,terminal=false)=>{if(!terminal)check();if(!owns())throw Error(label+' evidence ownership changed');fs.writeFileSync(path.join(output,name),Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});if(!terminal)check();};
 const capture=record=>{for(const item of record.captures||[record]){const prefix=item.round?'round-'+item.round+'-':'';save(prefix+'encoded-body.bin',item.encodedBody);save(prefix+'decoded-body.bin',item.decodedBody);save(prefix+'source-receipt.json',item.receipt);}};
 try{
  return await require('../quick-results').atomicRefresh({},{deadline:began+LIMITS.ownerMs+LIMITS.cleanupMs,clock,additionalFiles:[...candidates,'config/card-identities.js'],includeAllFiles:true,refreshOperation:async()=>{
   check();for(const file of candidates)if(fs.existsSync(file))throw Error(label+' existing candidate must be reviewed');
   const previous=contract.preflight(root,now||new Date()),projectionBefore=new Map(['data/code-inspector/football.json','data/follow-schedule/football.json'].map(file=>[file,JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))]));
   inventory('data');inventory('feeds');for(const file of [...require('../build-app-shell-runtime').generatedFiles(),'config/card-identities.js'])snapshots.set(file,contract.sha(fs.readFileSync(path.join(root,file))));
   check();reserve(output,value=>{identity=value;});check();
   save('retained-bindings.json',{sourceScope:contract.scope.base,targets:contract.scope.records.filter(row=>row.target),recordHashes:previous.events.map(row=>({id:row.id,sha256:contract.sha(row)}))});
   const consume=(payload,receipt)=>contract.evaluate(payload,previous,{...receipt,now:now||new Date()});
   let obtained;
   try{reader=acquire?null:createReader({clock,began});obtained=await(acquire?acquire(consume):reader.read(consume));}
   catch(error){if(error.sourceCapture||error.sourceCaptures){const captured=error.sourceCaptures?{captures:error.sourceCaptures}:error.sourceCapture;report.sourceFailures=(captured.captures||[captured]).map(item=>({reason:'official-resource-or-domain-refused',receipt:item.receipt}));try{capture(captured);}catch{report.evidenceFailure='capture-evidence-write-failed';}}throw error;}
   finally{reader?.close();}
   capture(obtained);check();const result=obtained.value;
   report={...report,changed:result.changed,deferrals:result.deferrals,supported:result.supported,sourceFailures:result.sourceFailures||[],receipt:obtained.receipt,resources:reader?.summary()||{requests:1,closed:true,active:0,ownedDouble:true}};
   if(result.changed.length){
    const contents=[[contract.FILE,JSON.stringify(result.document,null,2)+'\n'],[contract.FILE.replace('.json','.js'),'globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES = globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES || {}; globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES['+JSON.stringify(key)+'] = '+JSON.stringify(result.document)+';\n']];
    for(const [file,body]of contents){check();fs.writeFileSync(file+'.candidate',body);fs.renameSync(file+'.candidate',file);}
    runStep(deadline,'scripts/build-code-inspector.js','--codes=football',selector+JSON.stringify(result.changed));
   }
   for(const step of validationSteps){check();runStep(deadline,...step);check();}
   const final=contract.preflight(root,now||new Date());
   if(JSON.stringify(final)!==JSON.stringify(result.document))throw Error(label+' candidate facts changed after source evaluation');
   const expectedJs='globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES = globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES || {}; globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES['+JSON.stringify(key)+'] = '+JSON.stringify(final)+';\n';
   if(fs.readFileSync(contract.FILE.replace('.json','.js'),'utf8')!==expectedJs)throw Error(label+' JSON/JS projection disagreement');
   for(const [file,before]of projectionBefore){const expected={...before,fixtures:result.changed.length?contract.projectRows(before.fixtures,final,result.changed):before.fixtures};if(JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==JSON.stringify(expected))throw Error(label+' projection changed unrelated facts');}
   const beforeHashes=new Map(snapshots);snapshots.clear();inventory('data');inventory('feeds');for(const file of [...require('../build-app-shell-runtime').generatedFiles(),'config/card-identities.js'])if(fs.existsSync(file))snapshots.set(file,contract.sha(fs.readFileSync(file)));
   for(const file of new Set([...beforeHashes.keys(),...snapshots.keys()]))if(!allowed.has(file)&&beforeHashes.get(file)!==snapshots.get(file))throw Error(label+' changed an unrelated generated artifact');
   check();
   report.publicationState=result.changed.length?'validated-local-candidate':result.deferrals.length?'unchanged-with-deferrals':'unchanged';save('validation-summary.json',report);emit(report);check();return report;
  }});
 }catch(error){
  try{reader?.close();}catch{}
  report={...report,publicationState:!error.refreshRollback?'blocked-before-candidate':error.refreshRollback.status==='failed'?'blocked-rollback-failed':'blocked-rolled-back',failureCode:error.aLeagueCode||error.championshipCode||'source-or-owner-failure',rollback:error.refreshRollback||null,failedStep:error.refreshFailure?.step||null,failureDetail:error.refreshFailure?.detail||null};
  try{save('terminal-error.json',report,true);}catch{}
  try{emit({mode,publicationState:report.publicationState,failureCode:report.failureCode,changed:[],deferrals:report.deferrals});}catch{}
  try{if(clock()>=deadline)save('terminal-deadline.json',{publicationState:'failed',deadlineExceeded:true,originalErrorPreserved:true},true);}catch{}
  throw error;
 }
}
return {run,runChild};
}
module.exports={createOwner};
