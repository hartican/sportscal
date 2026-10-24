'use strict';
// Temporary isolated-branch adapter for the existing installed-upgrade workflow.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const {mode}=require('./lib/installed-offline-diagnostic');
const CAPS=Object.freeze({stdout:65536,stderr:262144,maximumMs:360000});
function boundedSink(file,limit,{tail=false}={}){
 let received=0,written=0,retainedTail=Buffer.alloc(0);fs.writeFileSync(file,'');
 return{write(chunk){const bytes=Buffer.from(chunk);received+=bytes.length;
  if(tail){retainedTail=Buffer.concat([retainedTail,bytes.subarray(-limit)]).subarray(-limit);written=retainedTail.length;fs.writeFileSync(file,retainedTail);return;}
  const retained=bytes.subarray(0,Math.max(0,limit-written));if(retained.length){fs.appendFileSync(file,retained);written+=retained.length;}
 },snapshot:()=>({received,written,dropped:received-written,limit})};
}
function runtimeMetadata(modulePath){
 const packageFile=require.resolve(modulePath+'/package.json'),packageDir=path.dirname(packageFile),api=require(modulePath);
 const executable=api.webkit.executablePath(),webkitRoot=path.dirname(executable),libraries=[],visited=new Set();let entries=0;
 function scan(directory,depth){
  if(depth>6||entries>=768)return;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(entries>=768)break;entries++;const file=path.join(directory,entry.name);
   if(entry.isDirectory())scan(file,depth+1);
   else if(/^libsoup.*\.so(?:\.|$)/.test(entry.name)&&libraries.length<4){
    const real=fs.realpathSync(file);if(visited.has(real))continue;visited.add(real);const stat=fs.statSync(real);
    if(stat.size>33554432){libraries.push({file:real,bytes:stat.size,notRead:'over32MiB'});continue;}
    const bytes=fs.readFileSync(real);libraries.push({file:real,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),versionStrings:[...new Set([...bytes.toString('latin1').matchAll(/libsoup\/([0-9]+\.[0-9]+\.[0-9]+)/g)].map(match=>match[1]))].slice(0,8)});
   }
  }
 }
 if(fs.existsSync(webkitRoot))scan(webkitRoot,0);
 let browserMetadata=null;const manifest=path.join(packageDir,'../playwright-core/browsers.json');
 if(fs.existsSync(manifest))browserMetadata=JSON.parse(fs.readFileSync(manifest,'utf8')).browsers.find(browser=>browser.name==='webkit');
 return{node:process.version,platform:process.platform,arch:process.arch,playwright:JSON.parse(fs.readFileSync(packageFile,'utf8')).version,webkitExecutable:executable,browserMetadata,bundledSoup:libraries,librarySearch:{entries,maxEntries:768,maxDepth:6,limit:'Missing/version-unavailable is unknown, not proof of absent or fixed libsoup.'}};
}
function validateRuntime(runtime,env={}){
 if(runtime.platform!=='linux'||runtime.node!=='v24.21.0'||runtime.playwright!=='1.62.1'||runtime.browserMetadata?.revision!=='2336')throw Error('First diagnostic requires Linux, Node24.21.0, Playwright1.62.1 and WebKit2336; no runtime substitution');
 if(env.PWA_EXECUTABLE_PATH||env.PWA_KEEP_OPEN==='1')throw Error('Require original cold-upgrade/default executable configuration');
}
async function run(){
 if(!mode())throw Error('Adapter requires explicit diagnostic mode; never a release gate');
 const root=path.resolve(__dirname,'..'),directory=process.env.PWA_OFFLINE_DIAGNOSTIC_DIR;fs.mkdirSync(directory,{recursive:true});
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const files=['index.html','service-worker.js','assets/js/app-update.js','assets/js/app-shell-runtime.js','assets/js/account-awareness-runtime.js','scripts/validate-installed-pwa-upgrade-browser.js','scripts/lib/installed-offline-diagnostic.js',path.relative(root,__filename)];
 const runtime=runtimeMetadata(process.env.PLAYWRIGHT_MODULE||'playwright');validateRuntime(runtime,process.env);
 if(process.env.PWA_BASELINE_SHA!=='6aa5979ab440b38765fe1038ab3b1203e354fe40')throw Error('Require the original failed592 baseline');
 const context={diagnosticOnly:true,releaseAcceptance:false,head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),baseline:process.env.PWA_BASELINE_SHA,
  runtime,caps:CAPS,files:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))};
 fs.writeFileSync(path.join(directory,'frozen-runtime.json'),JSON.stringify(context,null,2)+'\n');
 const stdout=boundedSink(path.join(directory,'stdout.log'),CAPS.stdout),stderr=boundedSink(path.join(directory,'pw-browser-stderr.log'),CAPS.stderr,{tail:true});
 const child=spawn(process.execPath,[path.join(__dirname,'validate-installed-pwa-upgrade-browser.js')],{cwd:root,detached:process.platform!=='win32',env:{...process.env,DEBUG:'pw:browser'},stdio:['ignore','pipe','pipe']});
 const pids=new Set(),started=Date.now();let carry='',timedOut=false;
 child.stdout.on('data',chunk=>stdout.write(chunk));
 child.stderr.on('data',chunk=>{stderr.write(chunk);carry=(carry+chunk.toString()).slice(-8192);for(const match of carry.matchAll(/<launched> pid=(\d+)/g))if(pids.size<4)pids.add(Number(match[1]));});
 const killGroup=(pid,signal='SIGTERM')=>{try{process.kill(process.platform==='win32'?pid:-pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
 let escalation;
 const timer=setTimeout(()=>{timedOut=true;killGroup(child.pid);for(const pid of pids)killGroup(pid);
  escalation=setTimeout(()=>{killGroup(child.pid,'SIGKILL');for(const pid of pids)killGroup(pid,'SIGKILL');},2000);
 },CAPS.maximumMs);
 const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));}).finally(()=>{clearTimeout(timer);clearTimeout(escalation);});
 const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
 const remaining=[child.pid,...pids].filter(alive);for(const pid of remaining)killGroup(pid);
 if(remaining.length)await new Promise(resolve=>setTimeout(resolve,250));
 const afterTerm=remaining.filter(alive);for(const pid of afterTerm)killGroup(pid,'SIGKILL');
 if(afterTerm.length)await new Promise(resolve=>setTimeout(resolve,250));
 const afterCleanup=remaining.filter(alive);
 const summary={diagnosticOnly:true,releaseAcceptance:false,...result,timedOut,elapsedMs:Date.now()-started,nodePid:child.pid,launchedBrowserPids:[...pids],remainingAtChildClose:remaining,remainingAfterCleanup:afterCleanup,stdout:stdout.snapshot(),stderr:stderr.snapshot()};
 fs.writeFileSync(path.join(directory,'runner-lifecycle.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary));
 process.exitCode=timedOut?124:remaining.length?1:result.code??1;
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={boundedSink,runtimeMetadata,validateRuntime,CAPS};
