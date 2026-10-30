#!/usr/bin/env node
'use strict';
// TEST ONLY. No execution on import. Requires a separately allocated Linux CI run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process');
const SOURCE='98af9164d15cddfb198fd35cd9e226b267723216',REPO='hartican/sportscal',SIG='public.nothingsports_read_match_centre_fixture_bundle(text[])';
const NS='nothingsports_fixture_read_private.',ORIGINAL='efc32656d8c100d80543001a2c5e6b48',BODY_A='3e1d234315b0eae31e2fc4ec491de3dd',BODY_B='402458f178989eed547f96e2ce2995c1';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),md5=v=>crypto.createHash('md5').update(v).digest('hex');
const literal=v=>v===null||v===undefined?'NULL':Array.isArray(v)?(assert(v.every(x=>typeof x==='string')),'ARRAY['+v.map(literal).join(',')+']::text[]'):typeof v==='boolean'?(v?'true':'false'):typeof v==='number'?(assert(Number.isFinite(v)),String(v)):(assert.equal(typeof v,'string'),'\''+v.replace(/'/g,"''")+'\'');
// Parameters only outside strings, identifiers, comments and dollar bodies.
function bind(sql,values=[]){
 let out='',i=0,state='plain',tag='',depth=0;const seen=new Set();
 while(i<sql.length){let s=sql.slice(i),c=sql[i];
  if(state==='plain'){
   if(s.startsWith('--')){state='line';out+='--';i+=2;continue;}
   if(s.startsWith('/*')){state='block';depth=1;out+='/*';i+=2;continue;}
   if(c==="'"||c==='"'){state=c;out+=c;i++;continue;}
   const d=s.match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);if(d){tag=d[0];state='dollar';out+=tag;i+=tag.length;continue;}
   const p=s.match(/^\$([1-9][0-9]*)\b/);if(p){const n=Number(p[1]);assert(n<=values.length,'Unbound parameter');seen.add(n);out+=literal(values[n-1]);i+=p[0].length;continue;}
  }else if(state==='line'){if(c==='\n')state='plain';}
  else if(state==='block'){if(s.startsWith('/*')){depth++;out+='/*';i+=2;continue;}if(s.startsWith('*/')){out+='*/';i+=2;if(!--depth)state='plain';continue;}}
  else if(state==='dollar'){if(s.startsWith(tag)){out+=tag;i+=tag.length;state='plain';continue;}}
  else if(c===state){if(sql[i+1]===state){out+=c+c;i+=2;continue;}state='plain';}
  out+=c;i++;
 }
 assert(['plain','line'].includes(state),'Unclosed SQL token');for(let n=1;n<=values.length;n++)assert(seen.has(n),'Unused parameter '+n);return out;
}
const stripTx=s=>s.replace(/^BEGIN(?: READ ONLY)?;\s*$/m,'').replace(/^ROLLBACK;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
function planWork(plan){const scans=[],stages={};function walk(n,stage='main'){
 const name=n['Subplan Name'];if(name?.startsWith('CTE ')){stage=name.slice(4);stages[stage]={rows:n['Actual Rows'],loops:n['Actual Loops']};}
 if(n['CTE Name']==='receipts')scans.push({node:n['Node Type'],rows:n['Actual Rows'],loops:n['Actual Loops'],visits:(n['Actual Rows']||0)*(n['Actual Loops']||0)});
 for(const p of n.Plans||[])walk(p,stage);
 }walk(plan.Plan);return {stages,receiptScans:scans,receiptVisits:scans.reduce((a,b)=>a+b.visits,0),tempRead:plan.Plan['Temp Read Blocks']||0,tempWritten:plan.Plan['Temp Written Blocks']||0};}
function assertOriginalRepro(work){
 const scan=work.receiptScans[0];
 if(work.receiptScans.length!==1||scan.node!=='CTE Scan'||scan.rows!==4831||scan.loops!==985||scan.visits!==4758535||work.receiptVisits!==4758535){const e=Error('NO_REPRO: exact original 4831-row receipt scan at 985 loops absent');e.code='NO_REPRO';throw e;}
}
function selfTest(){
 assert.equal(bind("select $1,$1,'$2',\"$2\",$$ $2 $$ /* $2 /*x*/ */ --$2\n,$2",["O'Brien",['a','b']]),"select 'O''Brien','O''Brien','$2',\"$2\",$$ $2 $$ /* $2 /*x*/ */ --$2\n,ARRAY['a','b']::text[]");
 assert.equal(literal([]),'ARRAY[]::text[]');assert.throws(()=>bind('select $2',[1]));assert.throws(()=>bind('select 1',[1]));assert.throws(()=>bind("select '$1",[]));
 const p=planWork({Plan:{Plans:[{'CTE Name':'receipts','Actual Rows':4831,'Actual Loops':985}]}});assert.equal(p.receiptVisits,4758535);
 return {state:'PURE_ADAPTER_CHECKS_ONLY',checks:6,nativeCalls:0,containers:0,networkCalls:0};
}
async function run(){
 assert.equal(process.platform,'linux','Linux CI only; never Mac');assert.equal(process.arch,'x64');require('./push-binding.cjs').assertPushBinding(process.env);
 assert.equal(process.env.NEAR_ALLOCATION,'receipt-join-native-pg17-pg18-once');assert.match(process.env.NEAR_NONCE||'',/^[a-f0-9]{32}$/);
 const nonce=process.env.NEAR_NONCE,root=fs.realpathSync(process.env.NEAR_SOURCE||''),out=path.resolve(process.env.NEAR_OUTPUT||''),packet=__dirname;
 assert(out&&out!==root&&out.startsWith(path.resolve(process.env.RUNNER_TEMP||'/nonexistent')+'/'));
 fs.mkdirSync(out,{recursive:false});fs.mkdirSync(path.join(out,'docker-config'));process.chdir(root);
 const safeEnv={PATH:'/usr/bin:/bin',HOME:out,TMPDIR:out,LANG:'C.UTF-8',DOCKER_CONFIG:path.join(out,'docker-config')};
 const started=Number(process.env.NEAR_STARTED_MS);assert(Number.isSafeInteger(started)&&Date.now()-started>=0&&Date.now()-started<120000,'Allocation includes checkout/startup');
 const deadline=started+600000,stop=deadline-60000,children=new Set(),ledger=[],engines=[];
 let cleaning=false,cleanupFinished=false;const runState={finished:false,signalFailure:null};
 const report={schemaVersion:1,state:'RUNNING_TEST_ONLY',sourceSha:SOURCE,nonce,startedAt:new Date(started).toISOString(),wholeLimitMs:600000,cleanupReserveMs:60000,productionCalls:0,providerCalls:0,engines,resources:ledger};
 const save=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
 const {interruptRun,createOwnedProcessController}=require('./owned-process.cjs');
 const processControl=createOwnedProcessController({children,remainingMs:()=>deadline-Date.now(),onEmpty:()=>{if(cleanupFinished)clearTimeout(hard);}});
 const limits={children,processControl,check(cleanup=false){cleanup=cleanup||cleaning;if(runState.signalFailure&&!cleanup)throw Error(runState.signalFailure);assert(Date.now()<(cleanup?deadline:stop),'Allocation exhausted; stop without retry');if(!cleanup){const stat=fs.statfsSync(out);assert(stat.bavail*stat.bsize>8*1024**3,'Runner disk floor below 8GiB');}},binding(database){limits.check(cleaning);assert(current?.verified&&current.databases.some(d=>d.name===database&&d.created&&!d.dropped)||database==='postgres'&&current?.verified,'Unowned database refused');return {...current,env:safeEnv};}};
 const hard=setTimeout(()=>{report.state='FAIL_CLEANUP_UNCONFIRMED';report.failure='600s allocation exhausted';try{save();}finally{for(const c of children)c.kill('SIGKILL');process.exit(1);}},Math.max(1,deadline-Date.now()));
 for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{process.exitCode=interruptRun(runState,report,sig).exitCode;try{save();}catch{}for(const c of children)try{c.kill('SIGTERM');}catch{}});
 let current=null,client=null,bridge=null;const {Client,EMPTY_PASSFILE,parseJsonStrict}=require('./native-client.cjs');
 async function docker(args,{cleanup=false,maxMs=30000}={}){
  limits.check(cleanup);assert(args.every(v=>typeof v==='string'));const remaining=(cleanup?deadline:stop)-Date.now();
  return await new Promise((resolve,reject)=>{const c=spawn('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{env:safeEnv,stdio:['ignore','pipe','pipe']});processControl.track(c);let stdout='',stderr='',over=false;
   const timer=setTimeout(()=>{over=true;c.kill('SIGKILL');},Math.max(1,Math.min(maxMs,remaining)));
   c.stdout.on('data',b=>{stdout+=b;if(stdout.length>1024*1024){over=true;c.kill('SIGKILL');}});c.stderr.on('data',b=>{stderr+=b;if(stderr.length>1024*1024){over=true;c.kill('SIGKILL');}});
   c.on('error',e=>{clearTimeout(timer);reject(e);});c.on('exit',code=>{clearTimeout(timer);code===0&&!over?resolve(stdout.trim()):reject(Error('Bounded Docker command failed: '+args[0]+'; code='+code+'; timed/output cap='+over));});
  });
 }
 async function inspectOwned(item,cleanup=false){
  const values=JSON.parse(await docker(['inspect',item.cid],{cleanup,maxMs:5000}));assert.equal(values.length,1);const c=values[0];assert.equal(c.Id,item.cid);assert.equal(c.Name,'/'+item.name);assert.equal(c.Config.Labels['ns.qa.nonce'],nonce);assert.equal(c.Config.Labels['ns.qa.owner'],'LOADING');assert.equal(c.Config.Labels['ns.qa.source'],SOURCE);assert.equal(c.Image,item.imageId);assert.equal(c.HostConfig.NetworkMode,'none');assert.deepEqual(c.HostConfig.PortBindings,{});assert.equal((c.HostConfig.Binds||[]).length,0);assert((c.Mounts||[]).every(m=>m.Type==='tmpfs'));assert.deepEqual(Object.keys(c.HostConfig.Tmpfs||{}).sort(),['/var/lib/postgresql','/var/lib/postgresql/data']);assert.equal(Object.keys(c.NetworkSettings.Ports||{}).filter(k=>c.NetworkSettings.Ports[k]).length,0);return c;
 }
 function makeBridge(native){
  return {async exec(sql){return native.exec(sql);},async query(sql,params=[]){const s=bind(sql,params);if(/^\s*explain\b/i.test(s)){const t=await native.command(s);return {rows:[{'QUERY PLAN':parseJsonStrict(t.trim(),t)}]};}if(/^\s*(insert|update|delete)\b/i.test(s)&&!/\breturning\b/i.test(s)){await native.exec(s);return {rows:[]};}return {rows:await native.query(s)};},async close(){await native.close();}};
 }
 async function database(label){
  const name='ns_near_receipt_'+current.major+'_'+nonce.slice(0,12)+'_'+label;assert.match(name,/^ns_near_receipt_(17|18)_[a-f0-9]{12}_(perf|checks)$/);
  const admin=new Client('postgres',limits);try{const found=await admin.query('select oid from pg_database where datname='+literal(name));assert.equal(found.length,0,'Pre-existing database refused');const d={name,created:false,dropped:false};current.databases.push(d);save();await admin.exec('create database '+name+' owner postgres');d.created=true;const r=(await admin.query('select oid,pg_get_userbyid(datdba) owner from pg_database where datname='+literal(name)))[0];assert.equal(r.owner,'postgres');d.oid=r.oid;save();}finally{await admin.close();}
  client=new Client(name,limits);bridge=makeBridge(client);
  const identity=(await bridge.query("select current_database() db,current_user role,session_user session,current_setting('server_version_num')::int version,current_setting('data_directory') data,current_setting('standard_conforming_strings') strings,current_setting('statement_timeout') statement_timeout,current_setting('lock_timeout') lock_timeout,inet_client_addr() client_addr,inet_server_addr() server_addr")).rows[0];assert.equal(identity.db,name);assert.equal(identity.role,'postgres');assert.equal(identity.session,'postgres');assert.equal(identity.version,current.major===17?170006:180003);assert.equal(identity.data,'/var/lib/postgresql/data/qa');assert.equal(identity.strings,'on');assert.equal(identity.statement_timeout,'5s');assert.equal(identity.lock_timeout,'1s');assert.equal(identity.client_addr,null);assert.equal(identity.server_addr,null);current.backend=identity;
  assert.equal((await bridge.query("select count(*)::int n from pg_roles where rolname in('anon','authenticated','service_role')")).rows[0].n,0,'Factory roles must not pre-exist');current.roleCreationIntent=true;save();
  process.env.PGLITE_MODULE=current.major===17?'pglite-pg17':'@electric-sql/pglite';
  const Module=require('node:module'),load=Module._load;let constructors=0;
  Module._load=function(id,parent,...rest){if((id==='pglite-pg17'||id==='@electric-sql/pglite')&&parent?.filename===path.join(root,'scripts/validate-profile-fixture-scope.js'))return {PGlite:class{constructor(){assert.equal(++constructors,1);return bridge;}}};return load.call(this,id,parent,...rest);};
  try{const actual=await require(path.join(root,'scripts/lib/near-selection-test-database.js')).database();assert.equal(actual,bridge);assert.equal(constructors,1);current.qaRoles=(await bridge.query("select oid,rolname from pg_roles where rolname in('anon','authenticated','service_role') order by rolname")).rows;assert.deepEqual(current.qaRoles.map(r=>r.rolname),['anon','authenticated','service_role']);save();}finally{Module._load=load;}
  await bridge.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261024115500_index_match_centre_selection.sql'),'utf8'));
  assert.equal((await bridge.query('select md5(pg_get_functiondef($1::regprocedure)) h',[SIG])).rows[0].h,ORIGINAL);
  return bridge;
 }
 async function dropCurrentDatabase(){if(client){await client.close();client=null;bridge=null;}const admin=new Client('postgres',limits);try{for(const d of current.databases.filter(d=>d.created&&!d.dropped)){const rows=await admin.query('select oid,pg_get_userbyid(datdba) owner from pg_database where datname='+literal(d.name));assert.equal(rows.length,1);assert.equal(rows[0].oid,d.oid);assert.equal(rows[0].owner,'postgres');await admin.exec('drop database '+d.name,{cleanup:cleaning});d.dropped=true;save();}if(current.qaRoles?.length){const roles=await admin.query("select oid,rolname from pg_roles where rolname in('anon','authenticated','service_role') order by rolname");assert.deepEqual(roles,current.qaRoles,'Only factory-created role OIDs may be removed');await admin.exec('drop role anon,authenticated,service_role',{cleanup:cleaning});current.removedRoleOids=(current.removedRoleOids||[]).concat(current.qaRoles);current.qaRoles=[];save();}}finally{await admin.close();}}
 async function bootstrapWorkload(db){
  const old=new Date(started-2*86400000).toISOString(),future=new Date(started+10*86400000).toISOString(),sources=Array.from({length:45},(_,i)=>({source:'qa-receipt-'+String(i).padStart(2,'0'),observations:{}}));
  const fixtures=Array.from({length:985},(_,i)=>{const group=i%143,id='qa-receipt-fixture-'+i,live=i<143;return {source:sources[i%45].source,id,keys:[id,'qa-receipt-alias-'+group],fixture:{id,key:'nbl',status:live?'live':'completed',startTimeUtc:live?future:old,completedAt:live?null:old,statusCheckedAt:old,sourceCheckedAt:old,sourceStale:true,sourceEventIds:['qa-receipt-alias-'+group],homeParticipantId:'qa-home-'+group,awayParticipantId:'qa-away-'+group,opaque:null,homeScore:0,awayScore:0,retainedWideFact:'x'.repeat(1800)}};});
  for(let i=0;i<4831;i++){const s=sources[i%45],key=i<985?fixtures[i].id:'qa-unused-receipt-'+i;s.observations[key]=i%41===0?null:{s:old,t:old,p:null};}
  current.workload={sources:45,seedRows:143,linkedOldRows:842,contexts:985,receipts:4831,wideFieldBytes:1800,old,future,sha256:sha(JSON.stringify({sources,fixtures})),constructed:true};save();
  await db.exec('begin');try{
   for(const s of sources)await db.query('insert into public.nothingsports_fixture_sources(source_id,discovery_report) values($1,$2::jsonb)',[s.source,JSON.stringify({_fixtureObservations:s.observations})]);
   for(let i=0;i<fixtures.length;i+=64)await db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)select e->>\'source\',e->>\'id\',array(select jsonb_array_elements_text(e->\'keys\')),e->\'fixture\',md5((e->\'fixture\')::text) from jsonb_array_elements($1::jsonb)e',[JSON.stringify(fixtures.slice(i,i+64))]);
   await db.exec('commit');
  }catch(e){await db.exec('rollback');throw e;}
  await db.exec('analyze public.nothingsports_fixture_current;analyze public.nothingsports_live_scores;analyze public.nothingsports_fixture_sources;analyze '+NS+'fixture_context;analyze '+NS+'fixture_tokens;analyze '+NS+'near_selection;');
  assert.equal((await db.query('select '+NS+'near_index_ready() ready')).rows[0].ready,true);
  assert.equal((await db.query('select count(*)::int n from public.nothingsports_fixture_current')).rows[0].n,985);
 }
 async function readonly(fn){await bridge.exec("begin read only;set local statement_timeout='5s';set local lock_timeout='1s';set local search_path='';set local role service_role");try{return await fn();}finally{await bridge.exec('rollback');}}
 async function plans(er){
  for(const [label,file]of [['A','receipt-join-original-body.sql'],['B','receipt-join-candidate-body.sql']]){
   const body=fs.readFileSync(path.join(packet,file),'utf8');const plan=await readonly(async()=>{const p=await bridge.query("EXPLAIN(ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) "+body.replaceAll('p_membership_ids',"'{}'::text[]"));return p.rows[0]['QUERY PLAN'][0];});
   const work=planWork(plan);er.plans??={};er.plans[label]={...work,planningMs:plan['Planning Time'],executionMs:plan['Execution Time'],actualNativePlan:plan};save();
   assert.equal(work.stages.candidates?.rows,985);assert.equal(work.stages.receipts?.rows,4831);assert.equal(work.stages.near_seed_keys?.rows,143);
   if(label==='A')assertOriginalRepro(work);
   if(label==='B'){assert(work.receiptVisits<=4831*2+985*2,'Candidate receipt work remains nonlinear');assert(work.receiptVisits<=er.plans.A.receiptVisits/10);assert(work.tempRead<=er.plans.A.tempRead&&work.tempWritten<=er.plans.A.tempWritten,'Temporary-work regression');}
  }
 }
 async function equality(ids=[]){return await readonly(async()=>{const row=(await bridge.query("with a as materialized(select qa_receipt_join.original_reader($1)::text t),b as materialized(select public.nothingsports_read_match_centre_fixture_bundle($1)::text t from a)select a.t as original_text,b.t as candidate_text from a cross join b",[ids])).rows[0];assert.equal(row.original_text,row.candidate_text,'Full ordered reader output differs');const parsed=JSON.parse(row.original_text);return {rows:parsed.rows.length,complete:parsed.complete,bytes:Buffer.byteLength(row.original_text),sha256:sha(row.original_text),fullOrderedTextEqual:true};});}
 async function sample(which){return await readonly(async()=>{const fn=which==='A'?'qa_receipt_join.original_reader':'public.nothingsports_read_match_centre_fixture_bundle',start=performance.now();const r=(await bridge.query('select '+fn+"('{}'::text[])::text body")).rows[0];const v=JSON.parse(r.body),elapsed=performance.now()-start;assert.equal(v.complete,true);assert.equal(v.rows.length,985);assert(elapsed<5000,'Whole reader including delivery/parse exceeds 5s');return {which,elapsedMs:elapsed,rows:v.rows.length,bytes:Buffer.byteLength(r.body),sha256:sha(r.body),complete:true};});}
 async function expectRefusal(sql,pattern,label){report.phase=label+':begin';await bridge.exec('begin;savepoint guard_negative');let error;try{report.phase=label+':statement';await bridge.exec(stripTx(sql));}catch(e){error=e;}finally{report.phase=label+':rollback';await bridge.exec('rollback');}report.phase=label+':assert-refusal';try{assert(error,'Negative control did not refuse');assert.match(error.message,pattern);}catch(e){if(error?.nativeDiagnostic)e.nativeDiagnostic=error.nativeDiagnostic;if(error?.nativeStatementStatus)e.nativeStatementStatus=error.nativeStatementStatus;throw e;}return {refused:true,sqlstate:error.code||null,phase:label};}
 async function nativeGuards(er){
  const forward=fs.readFileSync(path.join(packet,'receipt-join-native-forward.sql'),'utf8'),inverse=fs.readFileSync(path.join(packet,'receipt-join-native-inverse.sql'),'utf8');
  er.negative=[];
  er.negative.push(await expectRefusal(forward,/Input body differs/,'guard:forward-replay'));
  for(const [index,drift]of ['grant execute on function '+SIG+' to anon','alter function '+SIG+' cost 101','alter function '+NS+'near_index_ready() cost 101'].entries())er.negative.push(await expectRefusal(drift+';'+stripTx(inverse),/differs|changed/,'guard:inverse-drift-'+index));
  for(const role of ['anon','authenticated']){
   report.phase='guard:'+role+':schema-privacy';
   assert.equal((await bridge.query('select has_schema_privilege($1,$2,\'usage\') allowed',[role,'qa_receipt_join'])).rows[0].allowed,false);
   er.negative.push(await expectRefusal('set local role '+role+";select public.nothingsports_read_match_centre_fixture_bundle('{}')",/permission denied/,'guard:'+role+':reader-denial'));
  }
  report.phase='guard:post-forward-fact';
  await bridge.query("update public.nothingsports_fixture_current set fixture=fixture||$1::jsonb where fixture_id=$2",[JSON.stringify({qaPostForwardFact:'preserve-after-inverse',statusCheckedAt:current.workload.old}),'qa-receipt-fixture-0']);
  const facts=(await bridge.query("select md5(string_agg(source_id||fixture_id||fixture::text,'' order by source_id,fixture_id)) h from public.nothingsports_fixture_current")).rows[0].h;
  report.phase='guard:inverse';await bridge.exec(inverse);assert.equal((await bridge.query('select md5(pg_get_functiondef($1::regprocedure))h',[SIG])).rows[0].h,ORIGINAL);
  assert.equal((await bridge.query("select md5(string_agg(source_id||fixture_id||fixture::text,'' order by source_id,fixture_id))h from public.nothingsports_fixture_current")).rows[0].h,facts);
  er.inverse={originalDefinitionRestored:true,interveningFactsPreserved:true,factsMd5:facts};
  report.phase='guard:reapply';await bridge.exec(forward);er.reapply=true;
 }
 async function functional(er){
  const db=await database('checks'),future=new Date(Date.now()+300*86400000).toISOString(),old=new Date(Date.now()-86400000).toISOString();
  await db.query("insert into public.nothingsports_fixture_sources(source_id)values('near-selection-local')");
  for(let i=0;i<20;i++){const id='admitted:'+i,keys=i===19?[id,'preserved:late']:[id];await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values('near-selection-local',$1,$2,$3::jsonb,md5($3::text))",[id,keys,JSON.stringify({id,status:i<19?'live':'scheduled',startTimeUtc:future,statusCheckedAt:old,homeParticipantId:'home:'+i,awayParticipantId:'away:'+i,fixtureIdAliases:i===19?['preserved:late']:[]})]);}
  await db.exec(fs.readFileSync(path.join(packet,'receipt-join-native-reference.sql'),'utf8'));
  const originalDef=(await db.query('select pg_get_functiondef($1::regprocedure)d',[SIG])).rows[0].d;
  await db.exec(fs.readFileSync(path.join(packet,'receipt-join-native-forward.sql'),'utf8'));
  const candidateDef=(await db.query('select pg_get_functiondef($1::regprocedure)d',[SIG])).rows[0].d;assert.equal(md5(originalDef),ORIGINAL);assert.equal(md5((await db.query('select prosrc from pg_proc where oid=$1::regprocedure',[SIG])).rows[0].prosrc),BODY_B);
  // Only the exact reader definition expectation changes in the existing suite.
  // Derive expected full canonical definition by the same frozen two-fragment delta.
  const oldHead='  from candidates selected\n  cross join lateral (\n',newHead='  from candidates selected\n  left join receipts r on r.source_id=selected.source_id and r.fixture_id=selected.fixture_id\n  cross join lateral (\n';
  const oldTail='  ) c\n  left join receipts r on r.source_id=c.source_id and r.fixture_id=c.fixture_id\n )\n select jsonb_build_object',newTail='  ) c\n )\n select jsonb_build_object';
  assert.equal(candidateDef,originalDef.replace(oldHead,newHead).replace(oldTail,newTail));
  const contractsPath=path.join(root,'scripts/fixtures/near-selection-contracts.json'),cached=require(contractsPath),overlay=structuredClone(cached);const target=overlay.candidate.find(v=>v.signature===SIG);assert.equal(target.contract.definition,ORIGINAL);target.contract.definition=md5(candidateDef);
  const Module=require('node:module'),load=Module._load;Module._load=function(id,parent,...rest){if(parent?.filename===path.join(root,'scripts/lib/near-selection-regression.js')&&id==='../fixtures/near-selection-contracts.json')return overlay;return load.call(this,id,parent,...rest);};
  const r={checks:0,padding:0};try{await require(path.join(root,'scripts/lib/near-selection-regression.js')).regression(db,r);}finally{Module._load=load;}
  er.existingRegression={checks:r.checks,cases:r.regressions,onlyExpectedDefinitionChanged:md5(candidateDef),sourceFileUnchanged:true};
  // Independent full original/candidate comparison after the original regression.
  er.afterRegressions=await equality(['preserved:late']);assert.equal(er.afterRegressions.complete,true);
  er.sourceReceiptShapes=[];
  for(const value of [null,[],17,'unavailable',{}]){await db.exec('begin');try{await db.query("update public.nothingsports_fixture_sources set discovery_report=$1::jsonb where source_id='near-selection-local'",[JSON.stringify({_fixtureObservations:value})]);await db.exec("set local role service_role;set local search_path=''");const pair=(await db.query("select qa_receipt_join.original_reader('{preserved:late}')::text a,public.nothingsports_read_match_centre_fixture_bundle('{preserved:late}')::text b")).rows[0];assert.equal(pair.a,pair.b);er.sourceReceiptShapes.push({kind:value===null?'null':Array.isArray(value)?'array':typeof value,fullOrderedTextEqual:true});}finally{await db.exec('rollback');}}
  await db.exec('begin');try{
   await db.query("insert into public.nothingsports_fixture_sources(source_id)values('qa-receipt-overflow')");
   for(let start=0;start<5001;start+=128){const rows=Array.from({length:Math.min(128,5001-start)},(_,offset)=>({id:'qa-overflow-'+(start+offset),status:'live',statusCheckedAt:old,homeParticipantId:'qa-overflow-home-'+(start+offset),awayParticipantId:'qa-overflow-away-'+(start+offset)}));await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)select 'qa-receipt-overflow',e->>'id',array[e->>'id'],e,md5(e::text) from jsonb_array_elements($1::jsonb)e",[JSON.stringify(rows)]);}
   await db.exec("set constraints all immediate;set constraints all deferred;set local role service_role;set local search_path=''");
   const values=(await db.query("with a as materialized(select qa_receipt_join.original_reader('{}')::text t),b as materialized(select public.nothingsports_read_match_centre_fixture_bundle('{}')::text t from a)select a.t as original_text,b.t as candidate_text from a cross join b")).rows[0];assert.equal(values.original_text,values.candidate_text);const parsed=JSON.parse(values.original_text);assert.equal(parsed.complete,false);assert.equal(parsed.rows.length,5001);er.overflow={actualRows:5001,complete:false,fullOrderedTextEqual:true};
  }finally{await db.exec('rollback');}
  await db.exec(fs.readFileSync(path.join(packet,'receipt-join-native-inverse.sql'),'utf8'));assert.equal((await db.query('select md5(pg_get_functiondef($1::regprocedure))h',[SIG])).rows[0].h,ORIGINAL);
  await dropCurrentDatabase();
 }
 try{
  const commit=execFileSync('/usr/bin/git',['rev-parse','HEAD'],{cwd:root,env:safeEnv,encoding:'utf8'}).trim();assert.equal(commit,SOURCE);assert.equal(execFileSync('/usr/bin/git',['status','--porcelain'],{cwd:root,env:safeEnv,encoding:'utf8'}).trim(),'');
  const manifest=JSON.parse(fs.readFileSync(path.join(packet,'manifest.json'),'utf8'));
  for(const f of manifest.files)assert.equal(sha(fs.readFileSync(path.join(packet,f.file))),f.sha256,'Packet asset drift '+f.file);
  assert.equal(manifest.sourceSha,SOURCE);report.packetSha256=sha(fs.readFileSync(path.join(packet,'manifest.json')));report.sourceAssetHashes={};
  for(const file of execFileSync('/usr/bin/git',['ls-files','scripts','supabase/migrations','supabase/rollbacks','lib','config'],{cwd:root,env:safeEnv,encoding:'utf8'}).trim().split('\n'))report.sourceAssetHashes[file]=sha(fs.readFileSync(path.join(root,file)));
  // No credentials or network access is available to factory/module code.
  global.fetch=()=>{throw Error('Network forbidden in native QA');};for(const mod of ['node:http','node:https','node:net','node:tls']){const m=require(mod);for(const k of ['request','get','connect','createConnection'])if(k in m)m[k]=()=>{throw Error('Network forbidden in native QA');};}
  const pins=JSON.parse(fs.readFileSync(path.join(packet,'official-native-image-digests.json'),'utf8')).images;
  assert.deepEqual(pins.map(p=>p.tag),['17.6-bookworm','18.3-bookworm']);
  for(const [index,pin]of pins.entries()){
   const major=index===0?17:18;current={major,name:'ns-near-receipt-'+major+'-'+nonce,databases:[],cid:null,verified:false,imageId:pin.configDigest};ledger.push(current);const er={major,image:pin.immutableRef,claim:'Local constructed workload; not HTTP/cold/phone/release proof'};engines.push(er);save();limits.check();
   assert.match(pin.immutableRef,/^docker\.io\/library\/postgres@sha256:[a-f0-9]{64}$/);assert.equal(pin.platform,'linux/amd64');assert.equal(pin.manifestBytesVerified,true);
   // No retry. Image layers may only be fetched by this future allocated Linux run.
   await docker(['pull','--platform','linux/amd64',pin.immutableRef],{maxMs:120000});
   const image=JSON.parse(await docker(['image','inspect',pin.immutableRef]))[0];assert.equal(image.Id,pin.configDigest);assert.equal(image.Os,'linux');assert.equal(image.Architecture,'amd64');
   const existing=await docker(['ps','-aq','--filter','name=^/'+current.name+'$']);assert.equal(existing,'','Pre-existing container refused');
   current.createIntent=true;save();
   current.cid=await docker(['create','--name',current.name,'--label','ns.qa.nonce='+nonce,'--label','ns.qa.owner=LOADING','--label','ns.qa.source='+SOURCE,'--network','none','--cpus','2','--memory','1536m','--pids-limit','128','--tmpfs','/var/lib/postgresql:rw,size=256m','--tmpfs','/var/lib/postgresql/data:rw,size=768m','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','PGDATA=/var/lib/postgresql/data/qa',pin.immutableRef,'postgres','-c','listen_addresses=','-c','unix_socket_directories=/var/run/postgresql','-c','statement_timeout=5000','-c','lock_timeout=1000']);
   assert.match(current.cid,/^[a-f0-9]{64}$/);current.created=true;save();await inspectOwned(current);await docker(['start',current.cid]);
   // One startup command waits only for the NEW isolated server, not a data warm-up.
   await docker(['exec',current.cid,'/bin/sh','-c','for n in $(seq 1 30); do /usr/lib/postgresql/'+major+'/bin/pg_isready -h /var/run/postgresql -U postgres >/dev/null 2>&1 && exit 0; sleep 0.5; done; exit 1'],{maxMs:18000});await inspectOwned(current);
   await docker(['exec','-u','postgres',current.cid,'/bin/sh','-ceu','umask 077; set -C; : > "$1"; test -f "$1"; test ! -L "$1"; test ! -s "$1"; test "$(stat -c %u:%a:%s "$1")" = "$(id -u):600:0"','ns-owned-empty-passfile',EMPTY_PASSFILE],{maxMs:5000});
   current.emptyPasswordFilePath=EMPTY_PASSFILE;current.emptyPasswordFileVerified=true;current.verified=true;save();
   report.phase='setup:perf-database';await database('perf');report.phase='setup:workload';await bootstrapWorkload(bridge);report.phase='setup:reference';await bridge.exec(fs.readFileSync(path.join(packet,'receipt-join-native-reference.sql'),'utf8'));
   const boundaryText=stripTx(fs.readFileSync(path.join(packet,'receipt-join-native-boundary.sql'),'utf8')).replace(/^SET LOCAL[^;]+;\s*$/gm,'').replace(/^--[^\n]*(?:\n|$)/gm,'').trim().replace(/;\s*$/,'');
   report.phase='boundary';er.boundary=(await bridge.query(boundaryText)).rows[0];assert.deepEqual([er.boundary.original_rows,er.boundary.candidate_rows,er.boundary.full_value_bag_differences,er.boundary.unsafe_inner_join_negative_differences,er.boundary.multiple_payload_receipt_rows,er.boundary.preserved_missing_receipt,er.boundary.missing_payload_rows,er.boundary.preserved_json_null,er.boundary.preserved_sql_null].map(Number),[11,11,0,1,6,1,0,1,1]);
   report.phase='plans';await plans(er);report.phase='candidate:forward';await bridge.exec(fs.readFileSync(path.join(packet,'receipt-join-native-forward.sql'),'utf8'));
   report.phase='complete-equality';er.equality=await equality([]);assert.equal(er.equality.rows,985);assert.equal(er.equality.complete,true);
   er.samples=[];for(const which of ['A','B','B','A']){report.phase='ABBA:'+er.samples.length+':'+which;er.samples.push(await sample(which));save();}
   const a=er.samples.filter(x=>x.which==='A'),b=er.samples.filter(x=>x.which==='B');for(const s of er.samples){assert.equal(s.sha256,er.equality.sha256);assert.equal(s.bytes,er.equality.bytes);}
   er.originalMedianMs=(a[0].elapsedMs+a[1].elapsedMs)/2;er.candidateMedianMs=(b[0].elapsedMs+b[1].elapsedMs)/2;er.improvement=1-er.candidateMedianMs/er.originalMedianMs;assert(er.improvement>=0.20,'Less than 20 percent whole-reader median improvement');
   report.phase='guards';await nativeGuards(er);report.phase='perf-database:cleanup';await dropCurrentDatabase();report.phase='functional';await functional(er);report.phase='functional:cleanup';await inspectOwned(current);await docker(['rm','-f','-v',current.cid]);current.removed=true;save();current=null;
  }
  if(runState.signalFailure)throw Error('Interrupted: '+runState.signalFailure);report.state='PASS_LOCAL_NATIVE_QUALIFICATION_ONLY';report.requiredEngines=[17,18];report.noReleaseOrHTTPClaim=true;runState.finished=true;
 }catch(e){if(!report.failure){report.state=e.code==='NO_REPRO'?'NO_REPRO':'FAIL';report.failure={message:String(e.message).slice(0,400),code:e.code||null,phase:report.phase||'unlabelled'};if(e.nativeDiagnostic)report.failure.nativeDiagnostic=e.nativeDiagnostic;if(e.nativeStatementStatus)report.failure.nativeStatementStatus=e.nativeStatementStatus;}runState.finished=false;}
 finally{
  cleaning=true;report.cleanup={confirmed:false};save();
  try{if(client){try{await client.close();}catch(e){report.cleanup.clientExitError=String(e.message).slice(0,200);runState.finished=false;if(String(report.state).startsWith('PASS'))report.state='FAIL_CHILD_EXIT_UNCONFIRMED';report.failure=report.failure||{message:String(e.message).slice(0,200),code:e.code||null};}client=null;}
   if(current?.createIntent&&!current.cid){const found=JSON.parse(await docker(['inspect',current.name],{cleanup:true,maxMs:5000}))[0];assert.equal(found.Config.Labels['ns.qa.nonce'],nonce);current.cid=found.Id;current.created=true;save();}
   if(current?.created&&!current.removed){await inspectOwned(current,true);try{if(current.verified)await dropCurrentDatabase();}catch(e){report.cleanup.databaseDropError=String(e.message).slice(0,200);}await inspectOwned(current,true);await docker(['rm','-f','-v',current.cid],{cleanup:true,maxMs:10000});current.removed=true;for(const d of current.databases)if(!d.dropped)d.destroyedWithOwnedTmpfsContainer=true;}
   assert(ledger.every(c=>!c.created||c.removed));assert(ledger.flatMap(c=>c.databases).every(d=>!d.created||d.dropped||d.destroyedWithOwnedTmpfsContainer));assert.equal(await docker(['ps','-aq','--filter','label=ns.qa.nonce='+nonce],{cleanup:true,maxMs:5000}),'','Owned resources remain');report.cleanup.containerAndDatabaseConfirmed=true;}
  catch(e){report.cleanup.error=String(e.message).slice(0,300);if(!report.failure){report.state='FAIL_CLEANUP_UNCONFIRMED';report.failure={message:String(e.message).slice(0,300),code:e.code||null};}runState.finished=false;}
  try{await processControl.settleAll({graceMs:0,forceMs:1500});assert.equal(children.size,0);const count=processControl.inventory();assert.equal(count.tracked,count.confirmed);report.cleanup.hostChildrenConfirmed=true;}catch(e){report.cleanup.childExitError=String(e.message).slice(0,200);if(!report.failure){report.state='FAIL_CHILD_EXIT_UNCONFIRMED';report.failure={message:String(e.message).slice(0,200),code:e.code||null};}runState.finished=false;}
  report.cleanup.childExits=processControl.outcomes;report.cleanup.childCounts=processControl.inventory();report.cleanup.childrenRemaining=children.size;report.cleanup.confirmed=report.cleanup.containerAndDatabaseConfirmed===true&&report.cleanup.hostChildrenConfirmed===true;
  if(runState.signalFailure){runState.finished=false;if(String(report.state).startsWith('PASS'))report.state='FAIL_INTERRUPTED';}
  cleanupFinished=true;report.elapsedMs=Date.now()-started;save();if(children.size===0)clearTimeout(hard);if(!runState.finished||runState.signalFailure||!report.cleanup.confirmed||children.size!==0)process.exitCode=1;
 }
 return report;
}
if(require.main===module){if(process.argv.includes('--self-test'))console.log(JSON.stringify(selfTest()));else run().then(r=>console.log(JSON.stringify({state:r.state,cleanup:r.cleanup,elapsedMs:r.elapsedMs}))).catch(e=>{console.error(String(e.message).slice(0,300));process.exitCode=1;});}
module.exports={run,bind,literal,planWork,selfTest,assertOriginalRepro};
