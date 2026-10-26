'use strict';
// Actual SDK/store/parser with fake HTTP only; disposable local Git/receipt tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const gate=require('./lib/global-app-adapter-qualification'),cli=require('./verify-global-app-adapter');
const sdk=require('../lib/supabase-server'),{groupWire,sampleRows}=require('./lib/grouped-fixture-test-wire');
const tests=[],test=(name,run)=>tests.push({name,run});
const environment={SUPABASE_URL:gate.ORIGIN,SUPABASE_SECRET_KEY:'sb_secret_constructed_not_a_credential'};
const row={source_id:'qa-source',fixture_id:'qa-storage',identity_keys:['qa-storage','qa-alias'],fixture:{id:'qa-storage',sourceEventIds:['qa-alias'],status:'completed',homeScore:0,awayScore:1,scoreCheckedAt:'2026-10-01T00:00:00.123456Z'}};
const manifest=[{source_id:'qa-source',revision:1,checked_at:'2026-10-01T00:00:01Z'},{source_id:'qa-empty',revision:0}];
function fixture(options={}){
 const state={wire:groupWire([row]),manifest,...options},calls=[];
 const request=(route,opts)=>{
  calls.push({route,opts});
  const originalTiming=opts.onTiming;
  return sdk.supabaseServiceRequest(route,{...opts,onTiming:event=>{
   if(state.dropTiming&&event.phase===state.dropTiming)return;
   originalTiming?.(state.badTiming?{...event,elapsedMs:'PRIVATE_TIMING'}:event);
  },fetchImpl:async(url,fetchOptions)=>{
   assert(url===gate.ORIGIN+route);const health=route.includes('source_health');
   state.onFetch?.(calls.length,route,opts);
   if(state.rawFailure)throw Error('PRIVATE_RAW_ERROR_AND_ID');
   const status=!health&&state.failBundle?503:200;
   return {ok:status===200,status,text:async()=>{
    state.onBody?.(route);
    if(state.hangBody&&!health)return new Promise(resolve=>{state.releaseBody=resolve;});
    return health?(state.healthText??JSON.stringify(state.manifest)):(state.bundleText??JSON.stringify([{bundle:state.wire}]));
   }};
  }});
 };
 return{state,calls,request,run:extra=>gate.measure({request,environment,...extra})};
}
test('actual parser/store/SDK produces complete edge closure and bounded safe hashes',async()=>{
 const f=fixture(),value=await f.run();assert.equal(f.calls.length,2);assert.equal(value.edges,1);assert.equal(value.groups,1);assert.equal(value.projectedEdges,1);assert.equal(value.projectedSources,2);
 assert(value.calls.every(c=>c.timings.some(t=>t.phase==='parse-ready'&&t.format==='json')));assert.match(value.evidenceSha256,/^[0-9a-f]{64}$/);assert(value.elapsedMs<6000);assert(!JSON.stringify(value).includes('qa-source'));assert(f.calls.every(c=>c.opts.signal.aborted),'Actual SDK closes both original read signals');
 const evidence={...value};for(const k of ['evidenceSha256','elapsedMs','readLimitMs','limitations'])delete evidence[k];assert.equal(gate.sha(JSON.stringify(evidence)),value.evidenceSha256);
});
test('two sequential forced-fresh reads issue exactly two existing resources each',async()=>{
 const f=fixture(),records=[];await gate.qualify({request:f.request,environment,record:r=>records.push(r)});assert.equal(f.calls.length,4);assert.equal(records.length,2);assert(records.every(r=>r.projectedEdges===1));
 assert.deepEqual(f.calls.map(c=>c.route),['/rest/v1/rpc/nothingsports_read_fixture_source_health','/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle','/rest/v1/rpc/nothingsports_read_fixture_source_health','/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle']);
});
test('complete5145-edge grouped tail survives the actual SDK projection and gate',async()=>{
 const rows=sampleRows(),health=[...new Set(rows.map(r=>r.source_id))].map(source_id=>({source_id,revision:1}));
 const f=fixture({wire:groupWire(rows),manifest:health}),result=await f.run();assert.equal(result.groups,2586);assert.equal(result.edges,5145);assert.equal(result.projectedEdges,5145);assert.equal(f.calls.length,2);assert(!JSON.stringify(result).includes('source:000'));
});
for(const[name,change]of[
 ['malformed JSON',{bundleText:'[{'}],['partial grouped wire',{wire:{...groupWire([row]),complete:false}}],
 ['old legacy reply',{wire:{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[row]}}],
 ['missing manifest source',{manifest:[]}],['duplicate manifest source',{manifest:[manifest[0],manifest[0]]}],
 ['non-array manifest',{manifest:{}}],['failed body response',{failBundle:true}],['missing SDK byte callback',{dropTiming:'text-ready'}],['unsafe timing metadata',{badTiming:true}],
])test(name+' stops without retry or second read',async()=>{
 const f=fixture(change),records=[];await assert.rejects(gate.qualify({request:f.request,environment,record:r=>records.push(r)}));assert.equal(f.calls.length,2);assert.equal(records.length,0);
});
test('valid empty wire and manifest qualify through the actual SDK',async()=>{const f=fixture({wire:groupWire([]),manifest:[]}),r=await f.run();assert.equal(r.groups,0);assert.equal(r.edges,0);assert.equal(r.projectedSources,0);});
test('late body work is rejected by the unchanged global6000ms policy',async()=>{
 let clock=0;const f=fixture({onBody:route=>{if(!route.includes('source_health'))clock=6001;}});await assert.rejects(f.run({timer:()=>clock}));assert.equal(f.calls.length,2);
});
test('combined actual body bytes cannot exceed16MiB even with individually smaller legs',async()=>{
 const f=fixture(),bundleBytes=Buffer.byteLength(JSON.stringify([{bundle:f.state.wire}])),health=JSON.stringify(manifest);
 f.state.healthText=' '.repeat(gate.MAX_BYTES-bundleBytes-Buffer.byteLength(health)+1)+health;
 await assert.rejects(f.run());assert.equal(f.calls.length,2);
});
test('last-good fallback on the second actual read stays stale and stops qualification',async()=>{
 const f=fixture({onFetch:n=>{if(n>2)f.state.failBundle=true;}}),records=[];await assert.rejects(gate.qualify({request:f.request,environment,record:r=>records.push(r)}));assert.equal(f.calls.length,4);assert.equal(records.length,1);
});
test('report hash work must also complete inside6000ms',async()=>{
 const crypto=require('node:crypto'),original=crypto.createHash;let clock=0;
 crypto.createHash=(...args)=>{const hash=original(...args),update=hash.update;hash.update=function(value,...rest){if(typeof value==='string'&&value.includes('consumerParsedValueSha256'))clock=6001;return update.call(this,value,...rest);};return hash;};
 try{await assert.rejects(fixture().run({timer:()=>clock}));}finally{crypto.createHash=original;}
});
test('absolute allocation cancels real SDK requests and never records late success',async()=>{
 let fire,clock=0;const f=fixture({hangBody:true}),records=[];
 const result=gate.qualify({request:f.request,environment,timer:()=>clock,record:r=>records.push(r),schedule:fn=>{fire=fn;return 9;},cancel:id=>assert.equal(id,9)});
 for(let i=0;i<10&&!f.state.releaseBody;i++)await new Promise(resolve=>setImmediate(resolve));assert(f.state.releaseBody);clock=30001;fire();
 await assert.rejects(result,e=>gate.failureCode(e)==='allocation_expired');assert(f.calls.every(c=>c.opts.signal.aborted));f.state.releaseBody(JSON.stringify([{bundle:f.state.wire}]));await new Promise(resolve=>setImmediate(resolve));assert.equal(records.length,0);assert.equal(f.calls.length,2);
});
test('record and final receipt callbacks cannot turn expiry into success',async()=>{
 for(const where of ['record','complete']){let clock=0;const f=fixture();await assert.rejects(gate.qualify({request:f.request,environment,timer:()=>clock,[where]:()=>{clock=30001;}}));assert.equal(f.calls.length,where==='record'?2:4);}
});
test('an asynchronous receipt callback must settle before admitting the next read',async()=>{
 let clock=0;const f=fixture();await assert.rejects(gate.qualify({request:f.request,environment,timer:()=>clock,record:async()=>{await Promise.resolve();clock=30001;}}));assert.equal(f.calls.length,2,'Do not start a second read before the receipt callback settles');
});
test('preflight work consumes the same absolute allocation',async()=>{
 let clock=0;const f=fixture();await assert.rejects(gate.qualify({timer:()=>clock,prepare:()=>{clock=30001;return{request:f.request,environment};}}));assert.equal(f.calls.length,0);
});
test('an already-cancelled allocation starts no SDK service request',async()=>{
 const controller=new AbortController();controller.abort();const f=fixture();await assert.rejects(f.run({signal:controller.signal}));assert.equal(f.calls.length,0);
});
test('receipt and failure allowlists cannot persist arbitrary fields or spoofed errors',async()=>{
 const safe=gate.observe({phase:'complete',elapsedMs:1,status:200,bytes:4,format:'json',outcome:'success',secret:'PRIVATE_VALUE'});assert(!JSON.stringify(safe).includes('PRIVATE_VALUE'));
 assert.equal(gate.failureCode({message:'PRIVATE_RAW_ERROR',qualificationReceipt:{secret:'PRIVATE'},payload:{code:'PRIVATE'}}),'adapter_failure');assert.equal(gate.receiptFor({qualificationReceipt:{secret:'PRIVATE'}}),undefined);
 const f=fixture({rawFailure:true});await assert.rejects(f.run(),error=>{assert(!JSON.stringify(gate.receiptFor(error)).includes('PRIVATE'));return true;});
});
test('default verifier is inert without touching environment or filesystem',async()=>{
 const messages=[];await cli.main({argv:[],environment:new Proxy({},{get(){throw Error('Environment touched');}}),log:t=>messages.push(JSON.parse(t))});assert.deepEqual(messages,[{state:'INERT_NO_LIVE_READ',serviceCalls:0,releaseAcceptance:false}]);
});
test('publication context reuses the existing exact-main publisher binding',()=>{
 const head='a'.repeat(40),env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_WORKFLOW:'Sportscal production',GITHUB_JOB:'deploy',GITHUB_RUN_ID:'123',GITHUB_SHA:head,NS_NEAR_APP_RELEASE_SHA:head};
 assert.equal(gate.validatePublication(env,head),head);
 for(const patch of [{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REF:'refs/heads/codex/draft'},{GITHUB_SHA:'b'.repeat(40)},{NS_NEAR_APP_RELEASE_SHA:'b'.repeat(40)},{GITHUB_JOB:'test'},{GITHUB_WORKFLOW:'other'},{GITHUB_REPOSITORY:'fork/sportscal'}])assert.throws(()=>gate.validatePublication({...env,...patch},head));
});
test('exclusive owned receipt refuses existing files, symlinks and oversized replacement',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'global-owned-receipt-'));let owner;
 try{
  const dir=path.join(root,'owned');owner=cli.claimReceipt(dir,{state:'ORIGINAL'});const first=fs.readFileSync(owner.file);
  assert.throws(()=>cli.claimReceipt(dir,{state:'REPEAT'}),e=>e.code==='EEXIST');assert(fs.readFileSync(owner.file).equals(first));
  assert.throws(()=>owner.save({large:'x'.repeat(cli.MAX_REPORT_BYTES)}));assert(fs.readFileSync(owner.file).equals(first));
  const elsewhere=path.join(root,'elsewhere');fs.writeFileSync(elsewhere,'KEEP');fs.unlinkSync(owner.file);fs.symlinkSync(elsewhere,owner.file);assert.throws(()=>owner.save({state:'CHANGED'}));assert.equal(fs.readFileSync(elsewhere,'utf8'),'KEEP');
  const linked=path.join(root,'linked');fs.symlinkSync(dir,linked);assert.throws(()=>cli.claimReceipt(linked,{}));
 }finally{owner?.close();fs.rmSync(root,{recursive:true,force:true});}
});
function prerequisites(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'global-prerequisites-')),repo=path.join(root,'repo'),source=path.join(__dirname,'..');fs.mkdirSync(repo);
 const env={PATH:process.env.PATH,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:os.devNull},git=args=>cp.execFileSync('git',args,{cwd:repo,env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:5000});
 const files=['scripts/verify-global-app-adapter.js','scripts/lib/global-app-adapter-qualification.js','scripts/lib/near-app-adapter-qualification.js','lib/supabase-server.js','config/event-action-identity.js'];let head,count=0;
 const probe=path.join(repo,'PRIVATE_PROBE_NAME.txt');
 function invoke(name,change={}){
  const dir=path.join(root,name),result=cp.spawnSync(process.execPath,['--require',path.join(root,'deny.cjs'),path.join(repo,files[0]),'--live-read'],{cwd:repo,env:{...env,GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_WORKFLOW:'Sportscal production',GITHUB_JOB:'deploy',GITHUB_RUN_ID:'123',GITHUB_SHA:head,NS_NEAR_APP_RELEASE_SHA:head,NS_DEPLOY_REPORT_DIR:dir,...change},encoding:'utf8',timeout:10000});
  assert(!result.error);assert.equal(result.status,1);assert.equal(result.stderr,'');const lines=result.stdout.trim().split('\n').map(s=>JSON.parse(s)),summary=lines.find(x=>x.state);assert.equal(lines.find(x=>Object.hasOwn(x,'networkCalls')).networkCalls,0);assert.equal(summary.reads,0);
  const file=path.join(dir,'global-app-adapter.json'),receipt=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  assert(!JSON.stringify([summary,receipt]).includes('PRIVATE_PROBE_NAME'));assert(!result.stdout.includes(root));count++;return{summary,receipt};
 }
 const reset=()=>git(['reset','--hard','HEAD']); // This fixture's disposable repository only.
 const rejected=(r,stage)=>{assert.equal(r.summary.sha,null);assert.equal(r.receipt,null);assert.equal(r.summary.prerequisite.stage,stage);};
 try{
  for(const file of files){const target=path.join(repo,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,file),target);}
  fs.writeFileSync(probe,'accepted\n');fs.writeFileSync(path.join(root,'deny.cjs'),"let n=0;const deny=()=>{n++;throw Error('NETWORK_FORBIDDEN');};global.fetch=deny;for(const name of ['http','https','net','tls']){const m=require('node:'+name);for(const k of ['request','get','connect','createConnection'])if(typeof m[k]==='function')m[k]=deny;}process.on('exit',()=>console.log(JSON.stringify({networkCalls:n})));\n");
  git(['init','--quiet']);git(['config','user.name','Local test']);git(['config','user.email','test@example.invalid']);git(['config','core.filemode','true']);git(['add','.']);git(['commit','--quiet','-m','Disposable global gate fixture']);head=git(['rev-parse','HEAD']).trim();git(['update-ref','refs/remotes/origin/main',head]);
  let r=invoke('clean');assert.equal(r.summary.sha,head);assert.equal(r.summary.prerequisite.stage,'service_configuration');assert(r.receipt);
  const bytes=fs.readFileSync(probe),stat=fs.statSync(probe);fs.writeFileSync(probe,bytes);fs.utimesSync(probe,stat.atime,new Date(stat.mtimeMs+2000));r=invoke('stat-only');assert.equal(r.summary.sha,head);
  reset();fs.writeFileSync(probe,'changed');rejected(invoke('changed'),'git_worktree');
  reset();fs.writeFileSync(probe,'staged');git(['add',path.basename(probe)]);fs.writeFileSync(probe,bytes);rejected(invoke('staged-restored'),'git_index');
  reset();fs.unlinkSync(probe);rejected(invoke('deleted'),'git_worktree');
  reset();git(['config','core.filemode','false']);fs.chmodSync(probe,0o755);rejected(invoke('mode'),'git_worktree');fs.chmodSync(probe,0o644);git(['update-index','--chmod=+x',path.basename(probe)]);rejected(invoke('staged-mode'),'git_index');reset();git(['config','core.filemode','true']);
  rejected(invoke('wrong-context',{GITHUB_REF:'refs/heads/codex/draft'}),'publication_context');
  rejected(invoke('wrong-sha',{NS_NEAR_APP_RELEASE_SHA:'b'.repeat(40)}),'publication_context');
  git(['commit','--quiet','--allow-empty','-m','Other snapshot']);const other=git(['rev-parse','HEAD']).trim();git(['update-ref','refs/remotes/origin/main',other]);git(['reset','--hard',head]);rejected(invoke('wrong-origin'),'git_origin_main');git(['update-ref','refs/remotes/origin/main',head]);
  const occupied=path.join(root,'occupied');fs.mkdirSync(occupied);const first=JSON.stringify({state:'ORIGINAL_EVIDENCE'})+'\n';fs.writeFileSync(path.join(occupied,'global-app-adapter.json'),first);r=invoke('occupied');assert.equal(r.summary.sha,null);assert.equal(r.summary.prerequisite.stage,'receipt_claim');assert.equal(fs.readFileSync(path.join(occupied,'global-app-adapter.json'),'utf8'),first);
  rejected(invoke('relative',{NS_DEPLOY_REPORT_DIR:'PRIVATE_PROBE_NAME'}),'receipt_directory');
  r=invoke('wrong-project',{SUPABASE_URL:'https://wrong.invalid',SUPABASE_SECRET_KEY:'sb_secret_not_real'});assert.equal(r.summary.prerequisite.stage,'service_configuration');assert.equal(r.summary.sha,head);
  git(['update-ref','-d','refs/remotes/origin/main']);rejected(invoke('missing-origin'),'git_origin_main');
  fs.renameSync(path.join(repo,'.git'),path.join(root,'git-hidden'));rejected(invoke('no-git'),'git_head');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 return count;
}
test('actual CLI prerequisite failures stay read-free and preserve exclusive evidence',()=>{assert(prerequisites()>=15);});
(async()=>{for(const item of tests)await item.run();console.log(JSON.stringify({schemaVersion:'global-app-adapter-source-tests.v1',checks:tests.length,passed:true,networkCalls:0,serviceCalls:0,scope:'Actual SDK/parser/CANDIDATE with fake HTTP, allocation and disposable Git/receipt controls'}));})().catch(error=>{console.error(error.stack);process.exitCode=1;});
