'use strict';
// First qualified slice: credential-free, explicitly constructed public replay.
// This is not a live collector, managed publisher, or scheduler activation.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const URL='https://schedule.nbl.com.au/api/calendar/schedule?league=nbl&limit=500&offset=0&year=2026';
const MAX_BODY=2*1024*1024,MAX_ARTIFACT=32*1024*1024;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function refuse(code,detail=''){throw Error(code+(detail?': '+detail:''));}
function fields(value,allowed,label){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))refuse('CANDIDATE_INPUT_SCHEMA',label);
}
function credentials(env){
 for(const [key,value]of Object.entries(env))if(value&&(/SUPABASE|VERCEL|FOLLOW_SNAPSHOT|NS_EDITORIAL|NS_EPIC|NS_PUBLIC_CANDIDATE|TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ACCESS_KEY|SSH_AUTH|NODE_OPTIONS|NODE_PATH|PROXY/i.test(key)))refuse('CANDIDATE_CREDENTIAL',key);
}
function options(argv,env){
 credentials(env);
 const inputs=argv.filter(arg=>arg.startsWith('--candidate-input=')),outputs=argv.filter(arg=>arg.startsWith('--candidate-output='));
 if(!argv.includes('--public-candidate')||inputs.length!==1||outputs.length!==1||new Set(argv).size!==argv.length||argv.some(arg=>arg!=='--public-candidate'&&!arg.startsWith('--candidate-input=')&&!arg.startsWith('--candidate-output=')))refuse('CANDIDATE_ARGUMENTS','Only explicit public input/output preparation is qualified; no default/full/live/release route');
 const input=inputs[0].slice('--candidate-input='.length),output=outputs[0].slice('--candidate-output='.length);
 if(!path.isAbsolute(input)||path.basename(input)!=='public-candidate.json'||!path.isAbsolute(output))refuse('CANDIDATE_INPUT_PATH','public-candidate.json and absolute output required');
 if(output===ROOT||output.startsWith(ROOT+path.sep)||output===path.dirname(input)||output.startsWith(path.dirname(input)+path.sep))refuse('CANDIDATE_OUTPUT_PATH');
 return {localOnly:true,publicCandidate:{input,output}};
}
function readFile(file,maximum){
 const stat=fs.lstatSync(file);
 if(!stat.isFile()||fs.realpathSync(file)!==file||stat.size>maximum)refuse('CANDIDATE_INPUT_PATH','Regular bounded file without symlinks required');
 return fs.readFileSync(file);
}
function capability(file){
 const value=JSON.parse(readFile(file,16384));
 fields(value,['schemaVersion','target','sourceRevision','observedAt','provenance','response','processMs','maxArtifactBytes'],'capability');
 if(value.schemaVersion!=='canonical-public-candidate.v1')refuse('CANDIDATE_INPUT_SCHEMA','schemaVersion');
 if(value.target!=='quick:nbl')refuse('CANDIDATE_UNQUALIFIED_TARGET',value.target==='full'?'full: private Follow snapshot, ranking PDFKit and shared aggregate/export closure unqualified':'quick: sync-live-coverage source-scoped export and complete provider closure unqualified');
 if(value.provenance!=='constructed-fixture')refuse('CANDIDATE_UNQUALIFIED_PROVENANCE','Live/current producer evidence needs DEPLOY qualification');
 if(!/^[a-f0-9]{40}$/.test(value.sourceRevision)||!Number.isFinite(Date.parse(value.observedAt)))refuse('CANDIDATE_INPUT_SCHEMA','source revision/observation');
 if(!Number.isInteger(value.processMs)||value.processMs<1000||value.processMs>60000||!Number.isInteger(value.maxArtifactBytes)||value.maxArtifactBytes<1024||value.maxArtifactBytes>MAX_ARTIFACT)refuse('CANDIDATE_BUDGET');
 fields(value.response,['url','path','sha256','bytes'],'response');
 const r=value.response;
 if(r.url!==URL||r.path!=='nbl-public-input.json'||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isInteger(r.bytes)||r.bytes<1||r.bytes>MAX_BODY)refuse('CANDIDATE_PUBLIC_INPUT','Only bounded exact NBL public projection input is qualified');
 const body=readFile(path.join(path.dirname(file),r.path),MAX_BODY);
 if(body.length!==r.bytes||sha(body)!==r.sha256)refuse('CANDIDATE_INPUT_HASH');
 const payload=JSON.parse(body);
 fields(payload,['leaguePath','year','fallback','offset','total','seasons_meta','matches'],'NBL public projection');
 if(!Array.isArray(payload.seasons_meta)||!Array.isArray(payload.matches))refuse('CANDIDATE_INPUT_SCHEMA','NBL arrays');
 for(const season of payload.seasons_meta)fields(season,['id','name','season_type','match_count'],'NBL season');
 for(const match of payload.matches){
  fields(match,['id','season_id','season_type','starts_at_ms','round_label','phase','venue_name','home','away','home_score','away_score','primary_broadcaster','secondary_broadcaster'],'NBL public fixture');
  for(const team of [match.home,match.away])fields(team,['name','position','wins','losses'],'NBL public team');
  for(const broadcaster of [match.primary_broadcaster,match.secondary_broadcaster].filter(Boolean))fields(broadcaster,['label'],'NBL broadcaster');
 }
 // Reuse actual source identity/completeness/result validation before writes.
 require('../refresh-nbl-schedule').build(payload,value.observedAt,[]);
 return {...value,body:body.toString('utf8')};
}
function git(args,options={}){
 const result=cp.spawnSync('git',args,{cwd:ROOT,encoding:'utf8',env:{PATH:process.env.PATH,LANG:process.env.LANG,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'},...options});
 if(result.status!==0)refuse('CANDIDATE_GIT',String(result.stderr||'Local Git failed').slice(-300));
 return result.stdout.trim();
}
function frames(){
 const projections=require('../quick-results').nblProjectionSteps;
 return [...new Map([
  ['scripts/update-cards.js','--quick','--source=nbl','--local-only'],
  ['scripts/validate-fixture-history-retention.js'],['scripts/quick-results.js','--source=nbl'],['scripts/refresh-nbl-schedule.js'],
  ...projections([]),...projections(['NBL 1']),...projections(['NBL standings']),
 ].map(frame=>[JSON.stringify(frame),frame])).values()];
}
const publicPath=name=>/^(?:api|assets|config|data|feeds|lib|scripts|styles)\//.test(name)||['index.html','service-worker.js','app-version.json','package.json','package-lock.json'].includes(name);
const generatedPath=name=>/^(?:data|feeds)\//.test(name)||/^assets\/js\/(?:app-shell-runtime|deferred-[a-z-]+|optional-calendar-sync)\.js$/.test(name);
function prepare({input,output}){
 credentials(process.env);
 const cap=capability(input),head=git(['rev-parse','HEAD']);
 if(head!==cap.sourceRevision)refuse('CANDIDATE_SOURCE_REVISION');
 if(git(['status','--porcelain','--untracked-files=no']))refuse('CANDIDATE_SOURCE_DIRTY');
 if(fs.existsSync(output))refuse('CANDIDATE_OUTPUT_EXISTS');
 if(fs.realpathSync(path.dirname(output))!==path.dirname(output))refuse('CANDIDATE_OUTPUT_PATH','No symlinked output parent');
 // Use only already installed, pinned pure JS dependencies; never install here.
 require('terser');
 const dependencyFiles=Object.keys(require.cache).filter(file=>file.includes(path.sep+'node_modules'+path.sep));
 const dependencyHashes=Object.fromEntries(dependencyFiles.map(file=>[fs.realpathSync(file),sha(fs.readFileSync(file))]));
 const dependencies=fs.realpathSync(path.join(ROOT,'node_modules'));
 if(require(path.join(dependencies,'terser/package.json')).version!=='5.44.0')refuse('CANDIDATE_DEPENDENCY','Pinned Terser required');
 const files=git(['ls-files','-z']).split('\0').filter(publicPath),baseline=new Map();
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'ns-public-candidate-'));fs.chmodSync(scratch,0o700);
 const workspace=path.join(scratch,'workspace'),runtime=path.join(scratch,'runtime');
 fs.mkdirSync(workspace);fs.mkdirSync(runtime);fs.mkdirSync(output,{mode:0o700});
 let child,blocked,ledger,artifact;
 try{
  const modules={};
  for(const name of files){
   const file=path.join(ROOT,name),s=fs.lstatSync(file);
   if(!s.isFile()||fs.realpathSync(file)!==file)refuse('CANDIDATE_SOURCE_PATH',name);
   const bytes=fs.readFileSync(file),dest=path.join(workspace,name);baseline.set(name,sha(bytes));
   fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest,fs.constants.COPYFILE_FICLONE);
   if(/\.(?:js|cjs|mjs)$/.test(name))modules[dest]=sha(bytes);
  }
  fs.symlinkSync(dependencies,path.join(workspace,'node_modules'));
  const state=path.join(runtime,'ledger.json'),config=path.join(runtime,'capability.json'),guard=path.join(workspace,'scripts/lib/public-candidate-guard.cjs');
  fs.writeFileSync(state,JSON.stringify({requests:0,frames:[],violations:[]}),{mode:0o600});
  fs.writeFileSync(config,JSON.stringify({workspace,runtime,state,modules,dependencyHashes,dependencies,frames:frames(),url:URL,body:cap.body,observedAt:cap.observedAt,deadline:Date.now()+cap.processMs}),{mode:0o600});
  const env={PATH:process.env.PATH,LANG:process.env.LANG,TMPDIR:runtime,NS_PUBLIC_CANDIDATE_CONFIG:config,NODE_OPTIONS:'--require='+JSON.stringify(guard),REFRESH_REPORT:path.join(runtime,'refresh.json'),QUICK_RESULTS_REPORT:path.join(runtime,'quick.json')};
  const stdout=fs.openSync(path.join(runtime,'stdout'),'w',0o600),stderr=fs.openSync(path.join(runtime,'stderr'),'w',0o600);
  try{child=cp.spawnSync(process.execPath,[path.join(workspace,'scripts/update-cards.js'),'--quick','--source=nbl','--local-only'],{cwd:workspace,env,stdio:['ignore',stdout,stderr],timeout:cap.processMs,killSignal:'SIGKILL',detached:true});}
  finally{fs.closeSync(stdout);fs.closeSync(stderr);if(child?.pid)try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
  ledger=JSON.parse(fs.readFileSync(state,'utf8'));
  if(child.error||child.status!==0||ledger.violations.length)refuse('CANDIDATE_CHILD_BLOCKED',ledger.violations[0]||child.error?.code||'Source/validation failed; original status '+child.status);
  const changed=[];
  function visit(directory){for(const name of fs.readdirSync(directory)){
   if(directory===workspace&&name==='node_modules')continue;
   const file=path.join(directory,name),s=fs.lstatSync(file),relative=path.relative(workspace,file);
   if(s.isDirectory())visit(file);
   else if(!s.isFile())refuse('CANDIDATE_OUTPUT_TYPE',relative);
   else if(sha(fs.readFileSync(file))!==baseline.get(relative)){
    if(!generatedPath(relative))refuse('CANDIDATE_IMMUTABLE_SOURCE_CHANGED',relative);
    changed.push({path:relative,sha256:sha(fs.readFileSync(file)),bytes:s.size});
   }
  }}visit(workspace);
  for(const name of baseline.keys())if(!fs.existsSync(path.join(workspace,name)))refuse('CANDIDATE_REMOVAL_UNQUALIFIED',name);
  if(changed.reduce((n,f)=>n+f.bytes,0)>cap.maxArtifactBytes)refuse('CANDIDATE_ARTIFACT_BUDGET');
  const branch='codex/canonical-candidate-'+sha(JSON.stringify({head,receipt:cap.response.sha256,changes:changed})).slice(0,16);
  artifact={branch,baseSha:head,changed,publication:{state:'local-staging-intent-only',managedWrites:0,requires:'DEPLOY review and separately allocated intake; no fake publication ACK'}};
  fs.writeFileSync(path.join(output,'staging-intent.json'),JSON.stringify(artifact,null,2)+'\n',{mode:0o600});
  // Actual local review branch; isolated object store reads the existing base
  // through alternates. Never update source refs, main, remotes or credentials.
  const gitdir=path.join(runtime,'review.git');git(['init','--bare',gitdir]);
  fs.writeFileSync(path.join(gitdir,'objects/info/alternates'),path.resolve(ROOT,git(['rev-parse','--git-path','objects']))+'\n');
  const g=args=>git(['--git-dir='+gitdir,'--work-tree='+workspace,...args]);
  g(['read-tree',head]);if(changed.length)g(['add','--',...changed.map(row=>row.path)]);
  const tree=g(['write-tree']),revision=git(['--git-dir='+gitdir,'-c','user.name=Canonical candidate','-c','user.email=canonical-candidate@invalid','-c','commit.gpgsign=false','commit-tree',tree,'-p',head],{input:'Constructed public replay candidate; not current source acceptance\n'});
  g(['update-ref','refs/heads/'+branch,revision]);
  const bundle=path.join(output,'candidate.bundle');g(['bundle','create',bundle,'refs/heads/'+branch,'^'+head]);
  if(fs.statSync(bundle).size>cap.maxArtifactBytes)refuse('CANDIDATE_ARTIFACT_BUDGET');
  artifact={...artifact,revision,bundleSha256:sha(fs.readFileSync(bundle))};
 }catch(error){blocked=error;}
 finally{
  try{
   const tail=file=>{if(!fs.existsSync(file))return '';const fd=fs.openSync(file,'r');try{const size=fs.fstatSync(fd).size,bytes=Buffer.alloc(Math.min(size,65536));fs.readSync(fd,bytes,0,bytes.length,Math.max(0,size-bytes.length));return require('./refresh-report').diagnosticTail(bytes.toString());}finally{fs.closeSync(fd);}};
   const handover={schemaVersion:'canonical-candidate-handover.v1',sourceRevision:head,inputSha256:sha(fs.readFileSync(input)),sourceReceipt:{url:cap.response.url,sha256:cap.response.sha256,observedAt:cap.observedAt,provenance:cap.provenance},state:blocked?'blocked':'prepared-fixture-replay',currentSourceAcceptance:false,managedWrites:0,remotePushes:0,deployment:false,scheduleChanged:false,childStatus:child?.status??null,childSignal:child?.signal||null,ledger:ledger||null,artifact:blocked?null:artifact,blocker:blocked?.message||null,diagnostic:tail(path.join(runtime,'stderr')),nextOwner:'DEPLOY existing-client intake; no worker PR scope or automatic promotion'};
   if(blocked&&fs.existsSync(path.join(output,'candidate.bundle')))fs.unlinkSync(path.join(output,'candidate.bundle'));
   fs.writeFileSync(path.join(output,'handover.json'),JSON.stringify(handover,null,2)+'\n',{mode:0o600});
  }catch(error){if(!blocked)blocked=error;}
  finally{fs.rmSync(scratch,{recursive:true,force:true});}
 }
 if(blocked)throw blocked;
 console.log(JSON.stringify({state:'prepared-fixture-replay',output,currentSourceAcceptance:false}));
 return artifact;
}
module.exports={options,credentials,capability,prepare,frames,URL,MAX_BODY,generatedPath,sha};
