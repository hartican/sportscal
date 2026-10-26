'use strict';
// SOURCE ONLY. Thin adaptation of the already qualified native transport packet.
// This module never imports/constructs a native client or executes its outputs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const source=require('./lib/generated-calendar-source');
const OLD='/Users/jackhartican/Documents/AI/Codex/loading-index-native-transport-20261027';
const BASE='/Users/jackhartican/Documents/AI/Codex/loading-narrow-native-prep-20261027';
const OUT='/Users/jackhartican/Documents/AI/Codex/loading-generated-calendar-native-screen-20261027/fresh-control';
const ORIGINAL_FREEZE='/Users/jackhartican/Documents/AI/Codex/loading-generated-calendar-source-20261027/matcher-correction/freeze.json';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>fs.readFileSync(p,'utf8');
function replace(s,a,b){assert.equal(s.split(a).length,2,'Unique reviewed adaptation anchor: '+a.slice(0,80));return s.replace(a,b);}
function section(s,a,b,replacement){const start=s.indexOf(a),end=s.indexOf(b,start);assert(start>=0&&end>start);return s.slice(0,start)+replacement+s.slice(end);}
function render(){
 assert.equal(sha(read(OLD+'/worker.cjs')),'3805198398e161df38dca80216dd55479417e368fb32d294061a9ddc327ffb74');
 assert.equal(sha(read(OLD+'/allocation.cjs')),'54c8e3ce6e6a6977989b04a8204b52bb2eceda6bf11ec9d8b40b5127eef25bae');
 assert.equal(sha(read(OLD+'/launch.cjs')),'57a2aeaf0e4af98be9789773d3ba08cf8fc815a1b9b2d1cf37e0c9a27bcd1eb0');
 const frozen=JSON.parse(read(ORIGINAL_FREEZE));assert.equal(frozen.commit,'8cb3a43dcf809833ed6e1e38a71e53ad1ef78acc');
 for(const f of [...frozen.sourceFiles,...frozen.dependencyPins])assert.equal(sha(fs.readFileSync(path.join(source.ROOT,f.path))),f.sha256,f.path);
 const graph=JSON.parse(read(BASE+'/public-graph-basis.json'));
 const model=select=>{assert.equal(select.split('statement_timestamp()').length,3);return select.replace('statement_timestamp()',"'"+graph.logicalClock+"'::timestamptz")+';\n';};
 const inputs={sourceCommit:frozen.commit,files:[...frozen.sourceFiles,...frozen.dependencyPins].map(f=>({...f,path:path.join(source.ROOT,f.path)})),
  install:path.join(source.ROOT,'supabase/migrations',source.NAME),undo:path.join(source.ROOT,'supabase/rollbacks',source.NAME),
  near:path.join(source.ROOT,'supabase/migrations/20261024115500_index_match_centre_selection.sql'),d3d:path.join(source.ROOT,'supabase/migrations',source.ORIGINAL),
  nearContracts:path.join(source.ROOT,'scripts/fixtures/near-selection-contracts.json'),batchContracts:path.join(source.ROOT,'scripts/fixtures/canonical-context-batch-contracts.json'),
  columns:source.COLUMNS,installSha256:sha(source.render().install),undoSha256:sha(source.render().undo),
  candidateViewSha256:sha(source.candidate),controlSha256:sha(model(source.original)),candidateFullSha256:sha(model(source.candidate)),logicalClock:graph.logicalClock};
 let allocation=read(OLD+'/allocation.cjs').replaceAll('NS_INDEX_NATIVE_ALLOCATION','NS_GENERATED_CALENDAR_NATIVE_ALLOCATION').replaceAll('ROOT_ALLOCATED_ONE_NATIVE_INDEX_ABBA','ROOT_ALLOCATED_ONE_NATIVE_GENERATED_CALENDAR_ABBA').replaceAll('ONE_NATIVE_PG17_FROZEN_INDEX_ABBA_ONLY','ONE_NATIVE_PG17_GENERATED_CALENDAR_ABBA_ONLY');
 allocation=replace(allocation,"assert.equal(a.minimumWholeGainFraction,0.20);","assert.equal(a.physicalClones,2);assert.equal(a.allowOwnedControlCompaction,true);assert.equal(a.candidateHeadroomMs,500);assert.equal(a.minimumWholeGainFraction,0.20);");
 let launch=read(OLD+'/launch.cjs').replaceAll('NS_INDEX_NATIVE_ALLOCATION','NS_GENERATED_CALENDAR_NATIVE_ALLOCATION');
 launch=replace(launch,"ownedClone:'ns_ne_f6c9_'+a.nonce,", "ownedClones:['ns_ne_f6c9_'+a.nonce,'ns_ne_f6c9_'+(BigInt('0x'+a.nonce)^0x80000000n).toString(16).padStart(8,'0')],");
 let worker=read(OLD+'/worker.cjs');
 worker=worker.replaceAll('qa_index_full_original','qa_generated_control').replaceAll('qa_index_full_candidate','qa_generated_candidate');
 worker=section(worker," const seal=JSON.parse(read('source-seal.json'));"," const graph=",` const input=JSON.parse(read('generated-inputs.json'));
 for(const f of input.files)assert.equal(sha(fs.readFileSync(f.path)),f.sha256,'Frozen generated candidate '+f.path);
 const seal={installSha256:input.installSha256,undoSha256:input.undoSha256,candidateViewSha256:input.candidateViewSha256};
 assert.equal(sha(read('control-full.sql')),input.controlSha256);assert.equal(sha(read('candidate-full.sql')),input.candidateFullSha256);
`);
 worker=replace(worker,"'nothingsports_fixture_read_private.integrity_pending'];","'nothingsports_fixture_read_private.integrity_pending','nothingsports_fixture_read_private.near_selection'];");
 worker=replace(worker,"const DB='ns_ne_f6c9_'+approval.nonce,children=new Set(),clients=[],pids=new Set();let admin,db,data,health,creationAttempted=false,stopping=false;",`const DBS={A:'ns_ne_f6c9_'+approval.nonce,B:'ns_ne_f6c9_'+(BigInt('0x'+approval.nonce)^0x80000000n).toString(16).padStart(8,'0')};
 const children=new Set(),clients=[],pids=new Set(),created=new Set(),ownedOids={},originals={},readers={},baselineFacts={},baselineContracts={};
 let admin,db,data,health,stopping=false,cleanupPhase=false;`);
 worker=replace(worker,'ownedDatabase:DB,','ownedDatabases:DBS,');
 worker=replace(worker,"ownedNameNote:'f6c9 prefix retained only for unchanged bounded native-client allowlist; actual candidate is frozen 92d81d7e',", "ownedNameNote:'f6c9 prefix is unchanged client allowlist only; two physical clones compare D3d versus frozen generated metadata8cb',");
 worker=replace(worker,"priorWasm:{state:'NO_GO',wholeGainFraction:0.09778783977352106,requiredGainFraction:0.20,notSupersededByNative:true},", "priorIndex:{state:'CLOSED_NO_GO',nativeGainPercent:6.593151668284265,notRetriedOrSuperseded:true},");
 worker=replace(worker,"'Clone fidelity/current22 setup touches buffers; no cold-cache claim and no extra warm-up complete reads',", "'Two physical clones: same dated facts, exact current27/D3d baseline; B owns new stored metadata. Fidelity/prep/install touch buffers; first-owned-read and warm-repeat labels only, no cold-cache claim or extra warm-up',");
 worker=replace(worker,"const limits={children,check};", "const limits={children,check:cleanup=>check(cleanup||cleanupPhase)};");
 worker=replace(worker,'function open(database){check();','function open(database){check(cleanupPhase);');
 worker=worker.replaceAll('index92_','gcal8cb_');
 worker=replace(worker,"const total=Number(r.bytes)+directoryBytes(OUT);", "const sizes=await admin.query('SELECT datname,pg_database_size(datname)bytes FROM pg_database WHERE datname IN('+Object.values(DBS).map(L).join(',')+')');const total=sizes.reduce((n,x)=>n+Number(x.bytes),0)+directoryBytes(OUT);");
 worker=replace(worker,"const [r]=await db.query('SELECT pg_database_size(current_database())bytes');", '');
 worker=section(worker,' async function facts(client){',' async function contracts(client)',` async function facts(client){const out={};for(const table of TABLES){
  if(table.endsWith('.near_selection')&&!client.hasNear)continue;check();
  const row=table.endsWith('.fixture_context')?"(to_jsonb(t)-ARRAY['global_base_window','global_score_window','global_window_valid']::text[])":'to_jsonb(t)';
  out[table]=(await client.query("SELECT count(*)n,md5(coalesce(string_agg(md5("+row+"::text),'' ORDER BY md5("+row+"::text)),''))h FROM "+table+' t'))[0];
 }return out;}
`);
 worker=section(worker,' async function installViews(){',' async function wire(',` async function installView(arm){await db.exec('CREATE VIEW '+VIEW[arm]+' WITH(security_invoker=true)AS '+sql[arm]+" REVOKE ALL ON "+VIEW[arm]+" FROM PUBLIC,anon,authenticated;GRANT SELECT ON "+VIEW[arm]+' TO service_role');}
 async function current27(){
  const items=JSON.parse(fs.readFileSync(input.nearContracts,'utf8')).candidate;assert.equal(items.length,27);
  for(const item of items){const [r]=await db.query("SELECT jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig)contract FROM pg_proc p WHERE p.oid=to_regprocedure("+L(item.signature)+')');assert.deepEqual(r?.contract,item.contract,item.signature);}
  const triggers=JSON.parse(fs.readFileSync(input.batchContracts,'utf8')).triggers;assert.equal(triggers.length,8);
  for(const t of triggers){const [r]=await db.query('SELECT md5(pg_get_triggerdef(oid))digest,tgenabled::text enabled FROM pg_trigger WHERE tgrelid='+L(t.relation)+'::regclass AND tgname='+L(t.name));assert.equal(r?.digest,t.digest);assert.equal(r?.enabled,t.enabled);}
 }
 const withoutGenerated=x=>{const out=structuredClone(x);for(const t of out[0].contract.tables)if(t.relation.endsWith('fixture_context'))t.columns=t.columns.filter(c=>!input.columns.includes(c.name));return out;};
 async function footprint(){return(await db.query("SELECT pg_database_size(current_database())database_bytes,pg_relation_size(c.oid)heap_bytes,pg_indexes_size(c.oid)index_bytes,pg_total_relation_size(c.oid)total_bytes,c.relfilenode::text heap_file,c.relpages,c.reltuples::float8 estimated_tuples,s.n_live_tup estimated_live,s.n_dead_tup estimated_dead,pg_current_wal_insert_lsn()::text cluster_wal_lsn,current_setting('lock_timeout')lock_timeout FROM pg_class c LEFT JOIN pg_stat_all_tables s ON s.relid=c.oid WHERE c.oid='nothingsports_fixture_read_private.fixture_context'::regclass"))[0];}
 async function prepare(arm){
  const name=DBS[arm];assert(!(await admin.query('SELECT datname FROM pg_database WHERE datname='+L(name))).length,'Owned clone name collision');
  created.add(name);await admin.exec('CREATE DATABASE '+name+' TEMPLATE ns_replay_20261021');ownedOids[name]=(await admin.query('SELECT oid FROM pg_database WHERE datname='+L(name)))[0].oid;
  db=open(name);await setup(db);const [pre]=await db.query("SELECT md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))view,(SELECT count(*)FROM public.nothingsports_fixture_current)fixtures,(SELECT count(*)FROM public.nothingsports_live_scores)scores,(SELECT count(*)FROM public.nothingsports_fixture_sources)source_count,(SELECT count(*)FROM nothingsports_fixture_read_private.integrity_pending)pending");
  assert.equal(pre.view,'fbc28299a5bf25428b286adc5ee2e0da');assert.equal(pre.fixtures,7670);assert.equal(pre.scores,7661);assert.equal(pre.source_count,40);assert.equal(pre.pending,0);
  await db.exec('CREATE TEMPORARY TABLE qa_ne_capture(doc jsonb)');for(const f of graph.files)await db.exec('INSERT INTO qa_ne_capture SELECT value FROM jsonb_array_elements('+L(fs.readFileSync(f.path,'utf8'))+'::jsonb)');
  const fidelity=(await db.query(fs.readFileSync(BASE+'/fidelity.sql','utf8')))[0];for(const k of ['raw_differences','d7_differences','score_differences','identity_differences','receipt_differences','content_hash_differences','updated_at_differences','score_hash_differences','first_completed_differences'])assert.equal(fidelity[k],0,k);
  assert.equal(fidelity.rows,7670);assert.equal(fidelity.scores,7661);assert.equal(fidelity.identity_set,'33b92895510ab9b72e7da9d697b4e6dd');await db.exec('DROP TABLE pg_temp.qa_ne_capture');
  await expectedContracts('original');const initial=await facts(db),timings={};
  let t=performance.now();await db.exec(fs.readFileSync(BASE+'/source/supabase/migrations/20261022234325_coalesce_canonical_fixture_context.sql','utf8'));timings.current22Ms=performance.now()-t;assert(timings.current22Ms<=3000);await expectedContracts('candidate');assert.deepEqual(await facts(db),initial);
  t=performance.now();await db.exec(fs.readFileSync(input.near,'utf8'));timings.near27Ms=performance.now()-t;assert(timings.near27Ms<=3000);db.hasNear=true;await current27();
  const nearFacts=await facts(db),originalOnly={...nearFacts};delete originalOnly['nothingsports_fixture_read_private.near_selection'];assert.deepEqual(originalOnly,initial);
  t=performance.now();await db.exec('BEGIN;'+fs.readFileSync(input.d3d,'utf8')+'COMMIT;');timings.d3dMs=performance.now()-t;assert(timings.d3dMs<=3000);
  assert.equal((await db.query("SELECT md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h"))[0].h,'d3d5341fcf5dc901c3e1240145b3acd7');
  await setup(db);baselineFacts[arm]=await facts(db);baselineContracts[arm]=await contracts(db);originals[arm]=await footprint();
  if(arm==='B'){assert.deepEqual(baselineFacts.B,baselineFacts.A,'Independent cloned canonical/near facts match');assert.deepEqual(baselineContracts.B,baselineContracts.A,'Exact27/8 baseline physical schemas match');}
  await db.exec('ANALYZE public.nothingsports_fixture_current;ANALYZE public.nothingsports_live_scores;ANALYZE public.nothingsports_fixture_sources');
  if(arm==='A'){
   assert.equal(db.database,DBS.A,'Compaction is owned control clone only');report.phase='owned-A-physical-compaction-control';save();
   await db.exec("SET statement_timeout='3s';SET lock_timeout='1s'");t=performance.now();await db.exec('VACUUM (FULL) nothingsports_fixture_read_private.fixture_context');timings.controlCompactionMs=performance.now()-t;assert(timings.controlCompactionMs<=3000,'Owned A compaction <=3s');
   await db.exec("SET statement_timeout='6s'");report.controlCompaction={before:originals.A,after:await footprint(),scope:'Owned A clone only; no logical data writes; successful FULL with no concurrent clone writer removes dead physical tuples. Stats are estimates, not exact dead-row counts.'};
   assert.notEqual(originals.A.heap_file,report.controlCompaction.after.heap_file);assert.deepEqual(await facts(db),baselineFacts.A);assert.deepEqual(await contracts(db),baselineContracts.A);await current27();
  }
  if(arm==='B'){
   report.phase='exact3s-stored-rewrite-and-Boolean-analyze';save();t=performance.now();await db.exec(fs.readFileSync(input.install,'utf8'));timings.generatedInstallMs=performance.now()-t;assert(timings.generatedInstallMs<=3000,'Exact complete install <=3s');
   report.generatedFootprint={before:originals.B,after:await footprint(),lockClaim:'Existing1s lock timeout passed as part of exact module; no isolated wait/contention measurement',walClaim:'Cluster LSN delta includes background WAL; not isolated candidate WAL'};
   assert.notEqual(report.generatedFootprint.before.heap_file,report.generatedFootprint.after.heap_file,'STORED ADD rewrites actual context heap');
   assert.deepEqual(await facts(db),baselineFacts.B,'Install preserves all original9-table facts');assert.deepEqual(withoutGenerated(await contracts(db)),baselineContracts.B,'Only three derived columns change contracts');await current27();
  }
  await installView(arm);report.preparation??={};report.preparation[arm]={pre,fidelity,timings,footprint:await footprint()};save();await workingBound();await db.close();
 }
`);
 worker=replace(worker,'  check();let captured,healthReceipt,requestCount=0;', '  check();data=readers[arm].data;health=readers[arm].health;let captured,healthReceipt,requestCount=0;');
 worker=replace(worker,"assert(completeMs<=6000,'Complete actual Node consumption + full evidence hashes exceeded 6s');", "assert(completeMs<=6000,'Complete actual Node consumption + evidence hashes exceeded6s');if(arm==='B')assert(completeMs<=5500,'Candidate needs500ms headroom within existing6s GLOBAL deadline');");
 worker=section(worker,"  const [origin]=await admin.query(","  report.phase='ONE-ABBA-whole-actual-consumer-no-warmup'",`  const [origin]=await admin.query("SELECT pg_database_size('ns_replay_20261021')template_bytes,(SELECT oid FROM pg_database WHERE datname='ns_replay_20261021')template_oid,(SELECT oid FROM pg_database WHERE datname='ns_r11b_20261021')protected_oid,(SELECT count(*)FROM pg_stat_activity WHERE datname='ns_replay_20261021')template_sessions");
  assert.equal(origin.template_sessions,0,'Do not overlap/terminate protected template users');assert(origin.template_oid&&origin.protected_oid);assert(2*Number(origin.template_bytes)+directoryBytes(OUT)<=approval.maxOutputWorkingBytes,'Two-clone initial size bound');report.templateOrigin=origin;
  await prepare('A');await prepare('B');await admin.close();
  for(const arm of ['A','B']){const d=open(DBS[arm]),h=open(DBS[arm]);readers[arm]={data:d,health:h};await setup(d,true);await setup(h,true);assert.notEqual(d.child.pid,h.child.pid);}
`);
 worker=section(worker,"  assert(report.wholeGainFraction>=0.20,", "  report.state='PASS_NATIVE_BENEFIT_ONLY_FULL_GATES_STILL_REQUIRED';",`  // Close read transactions before own DDL; no fifth native client or extra complete read.
  for(const arm of ['A','B']){await readers[arm].data.close();await readers[arm].health.close();}
  admin=open('postgres');await setup(admin);
  for(const arm of ['A','B']){db=open(DBS[arm]);db.hasNear=true;await setup(db);assert.deepEqual(await facts(db),baselineFacts[arm]);await current27();
   if(arm==='B'){
    assert.deepEqual(withoutGenerated(await contracts(db)),baselineContracts.B);await db.exec('DROP VIEW '+VIEW.B+' RESTRICT');
    const t=performance.now();await db.exec(fs.readFileSync(input.undo,'utf8'));report.ownUndoMs=performance.now()-t;assert(report.ownUndoMs<=3000,'Own exact inverse <=3s');report.inverseFootprint=await footprint();
    assert.equal((await db.query("SELECT md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h"))[0].h,'d3d5341fcf5dc901c3e1240145b3acd7');
    assert.equal((await db.query("SELECT count(*)n FROM pg_attribute WHERE attrelid='nothingsports_fixture_read_private.fixture_context'::regclass AND attname=ANY(ARRAY["+input.columns.map(L).join(',')+"])AND NOT attisdropped"))[0].n,0);
   }
   assert.deepEqual(await facts(db),baselineFacts[arm]);assert.deepEqual(await contracts(db),baselineContracts[arm]);assertOrdinary(await db.query(settingsSQL));await workingBound();await db.close();
  }
  report.ownUndoConfirmed=true;assert.equal(report.networkCalls,0);
  assert(report.wholeGainFraction>=0.20,'Native complete-consumer gain below unchanged20% target; no variant/retry');
`);
 worker=section(worker,'   if(creationAttempted){', '   report.cleanup.complete=true;',`   cleanupPhase=true;
   if(!admin||admin.closed){admin=open('postgres');await setup(admin);}
   assert(!admin.active,'Cleanup admin unavailable; retain exact owned names');
   for(const name of created){
    const rows=await admin.query('SELECT oid FROM pg_database WHERE datname='+L(name),{cleanup:true});
    if(rows.length){assert(ownedOids[name]&&rows[0].oid===ownedOids[name],'Owned clone OID unknown/changed; ROOT must inspect exact name');
     const ownedPids=[...pids];if(ownedPids.length)await admin.query('SELECT pid,pg_terminate_backend(pid)terminated FROM pg_stat_activity WHERE datname='+L(name)+' AND application_name='+L('gcal8cb_'+approval.nonce)+' AND pid IN('+ownedPids.join(',')+')',{cleanup:true});
     await admin.exec('DROP DATABASE '+name,{cleanup:true});
    }
    assert.equal((await admin.query('SELECT datname FROM pg_database WHERE datname='+L(name),{cleanup:true})).length,0);
   }
   const [protectedDbs]=await admin.query("SELECT (SELECT oid FROM pg_database WHERE datname='ns_replay_20261021')template_oid,(SELECT oid FROM pg_database WHERE datname='ns_r11b_20261021')protected_oid",{cleanup:true});
   assert.equal(protectedDbs.template_oid,report.templateOrigin.template_oid);assert.equal(protectedDbs.protected_oid,report.templateOrigin.protected_oid);
   report.cleanup.remainingOwned=[];
`);
 const oldWorker=read(OLD+'/worker.cjs');
 const fragment=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
 assert.equal(fragment(worker,' async function wire(',' async function consume('),fragment(oldWorker,' async function wire(',' async function consume('),'Native full text/JSON transport unchanged');
 let consumer=fragment(oldWorker,' async function consume(',' function same(');
 consumer=replace(consumer,'  check();let captured,healthReceipt,requestCount=0;','  check();data=readers[arm].data;health=readers[arm].health;let captured,healthReceipt,requestCount=0;');
 consumer=replace(consumer,"assert(completeMs<=6000,'Complete actual Node consumption + full evidence hashes exceeded 6s');","assert(completeMs<=6000,'Complete actual Node consumption + evidence hashes exceeded6s');if(arm==='B')assert(completeMs<=5500,'Candidate needs500ms headroom within existing6s GLOBAL deadline');");
 assert.equal(fragment(worker,' async function consume(',' function same('),consumer,'Actual a6 consumer reused apart from physical-arm binding and stricter candidate headroom');
 assert.equal(fragment(worker,' function same(','\n\n try{'),fragment(oldWorker,' function same(','\n\n try{'),'Full raw/decoded/consumer equality unchanged');
 assert(!/helpers-index|qa_gcal_|CREATE INDEX|creationAttempted/.test(worker),'Old index implementation is not reused');
 const control=model(source.original),candidate=model(source.candidate),legacy='ELSE(SELECT value AS bundle';
 assert.equal(control.slice(control.indexOf(legacy)),source.original.slice(source.original.indexOf(legacy))+';\n');
 assert.equal(candidate.slice(candidate.indexOf(legacy)),control.slice(control.indexOf(legacy)),'Full dynamic default legacy branch unchanged');
 assert.equal(sha(read(BASE+'/native-client.cjs')),'9c1a6d837cc37072d5228c6492db4c1254f6799a75282bd5b01599e8556b7232');
 return {allocation,launch,worker,inputs,control,candidate};
}

function prepare(){
 assert.deepEqual(process.argv.slice(2),['--source-only'],'Only explicit source preparation is supported');
 assert(!fs.existsSync(OUT),'Never overwrite an allocated/frozen packet');
 const r=render();for(const [name,s]of [['allocation.cjs',r.allocation],['launch.cjs',r.launch],['worker.cjs',r.worker]])new vm.Script(s,{filename:name});
 const example=JSON.parse(read(OLD+'/allocation-example.json'));
 example.scope='ONE_NATIVE_PG17_GENERATED_CALENDAR_ABBA_ONLY';example.freezeSha256='ROOT_REPLACE_WITH_THIS_PACKET_FREEZE_SHA256';example.physicalClones=2;example.allowOwnedControlCompaction=false;example.candidateHeadroomMs=500;assert.equal(example.allowNativeExecution,false);
 fs.mkdirSync(OUT);const outputs={'allocation.cjs':r.allocation,'launch.cjs':r.launch,'worker.cjs':r.worker,'generated-inputs.json':JSON.stringify(r.inputs,null,2)+'\n','control-full.sql':r.control,'candidate-full.sql':r.candidate,'allocation-example.json':JSON.stringify(example,null,2)+'\n'};
 for(const [name,s]of Object.entries(outputs))fs.writeFileSync(path.join(OUT,name),s,{flag:'wx'});
 const oldFreeze=JSON.parse(read(OLD+'/freeze.json'));
 const refs=[...oldFreeze.externalRefs.filter(f=>f.path.startsWith(BASE+'/')),...['worker.cjs','allocation.cjs','launch.cjs','ROOT-result-summary.json','ROOT-runtime-closeout.json'].map(n=>({path:path.join(OLD,n)})),{path:ORIGINAL_FREEZE},{path:__filename},...r.inputs.files.map(f=>({path:f.path}))];
 const externalRefs=[...new Map(refs.map(f=>[f.path,{path:f.path,sha256:sha(fs.readFileSync(f.path))}])).values()];
 const frozen={state:'SOURCE_ONLY_NATIVE_GENERATED_SCREEN_UNRUN',sourceParent:'8cb3a43dcf809833ed6e1e38a71e53ad1ef78acc',ownerThreadId:'01a0d5ba-943d-74e0-af7f-dab4fb2bdda4',files:Object.keys(outputs).map(file=>({file,bytes:fs.statSync(path.join(OUT,file)).size,sha256:sha(read(path.join(OUT,file)))})),externalRefs,
  gates:{wholeConsumerGainFraction:0.20,order:'ABBA',completeReads:4,wireGrowth:0,globalDeadlineMs:6000,candidateHeadroomMs:500,installMs:3000,lockMs:1000,ownedControlCompactionMs:3000,wholeWindowMs:600000,cleanupReserveMs:60000,maxLiveNativeClients:4,ownedPhysicalClones:2,workingBytes:512*1024**2,minimumHostFreeBytes:8*1024**3,minimumGuestFreeBytes:2*1024**3},
  claim:'Historical21October saved graph only, not current MVCC/managedHTTP/real-world/cold/phone proof. Old index NO_GO stays closed. No native/runtime/SQL execution during preparation.',runtime:'ROOT alone starts/stops existing ns-wire-test/ns-wire-mvcc, verifies fresh transport/disk/no-overlap, restores stopped state and default context. Worker only owns two nonce clones via unchanged native-client.',
  proposedCommand:'NS_GENERATED_CALENDAR_NATIVE_ALLOCATION=ROOT_ALLOCATED_ONE_NATIVE_GENERATED_CALENDAR_ABBA /Users/jackhartican/.npm/_npx/387698761821791d/node_modules/node/bin/node '+OUT+'/launch.cjs '+OUT+'/ROOT-allocation.json',
  sequence:['ROOT supplies fresh existing runtime/context/disk/no-overlap receipt. Disabled example cannot execute. No new VM/image/container/download/context switch.',
   'Two owned nonce clones of protected historical template; original20 then exact22/27/D3d prep, nine-zero fidelity per arm, matching original facts/clocks and27/8 contracts. Never repair canonical rows.',
   'A original-column context is compacted once within3s/1s using FULL on its owned clone ONLY; no extra arm or complete read. Future allocation must explicitly permit it. Facts/contracts identical before/after; heap-file change and pages/bytes/dead estimates recorded. B exact frozen module within3s/1s rewrites its heap. Both physical inputs fresh; no credit from hidden old A bloat. Cluster WAL LSN is observational, not isolated attribution; no peak/temp or lock-contention proof.',
   'Comparison-only views model first grouped21Oct statement clock matched to actual a6 consumer now. Actual canonical view keeps original clocks/source hashes for install/inverse guards; full dynamic default branch unchanged.',
   'Close setup/admin before four A/B data+health read-only clients. Exactly one ABBA; no keyset warm-up/plans/retries/favourable variants. First-owned/repeat reads after prep are not cold.',
   'Close all read transactions before own inverse. Reopen owned admin; verify facts/contracts, drop only B comparison view, exact3s/1s inverse restores D3d/removes three fields. No extra complete reads. Require equality, zero growth,20% gain,B500ms headroom.',
   'Close only owned clients; terminate only recorded matching owned-name/application PIDs if needed. Drop only created clones with recorded matching OIDs; protected OIDs unchanged. Uncertain cleanup fails with exact names/PIDs retained.',
   'ROOT verifies no owned backend/client/clone survivors and restores stopped container/profile/default context. Native5000-writer/220/PG18/currentHTTP/release remain separate gates.']};
 fs.writeFileSync(path.join(OUT,'freeze.json'),JSON.stringify(frozen,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({state:frozen.state,output:OUT,freezeSha256:sha(read(path.join(OUT,'freeze.json'))),nativeCalls:0}));
}
if(require.main===module)prepare();
module.exports={render,OLD,BASE,OUT};
