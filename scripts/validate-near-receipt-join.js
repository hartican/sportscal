'use strict';
// Disposable local PostgreSQL only. Native speed qualification is a separate retained receipt.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const expected=require('./fixtures/near-receipt-join-contracts.json');
const {contracts}=require('./lib/near-selection-regression');
const signature='public.nothingsports_read_match_centre_fixture_bundle(text[])';
const reader='public.nothingsports_read_match_centre_fixture_bundle',ns='nothingsports_fixture_read_private.';
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const body=sql=>sql.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,'');
async function run(){
 if(process.env.NS_NEAR_KEYS_QUALIFY==='1')return qualifyNearKeys();
 const output=process.env.NEAR_EVIDENCE_DIR;assert(output&&path.isAbsolute(output));fs.mkdirSync(output,{recursive:true});
 const report={schemaVersion:1,padding:0,checks:0,productionCalls:0,providerCalls:0,nativeSpeedClaim:false,releaseAcceptance:false,checksPassed:[]};
 const mark=name=>{report.checksPassed.push(name);report.checks++;};
 const install=fs.readFileSync('supabase/migrations/'+expected.migration,'utf8'),undo=fs.readFileSync('supabase/rollbacks/'+expected.migration,'utf8');
 assert.equal(sha(install),expected.installSha256);assert.equal(sha(undo),expected.inverseSha256);
 assert.equal(expected.original.length,27);assert.equal(expected.candidate.length,27);
 const changed=expected.original.filter((item,i)=>JSON.stringify(item)!==JSON.stringify(expected.candidate[i]));
 assert.deepEqual(changed.map(x=>x.signature),[signature]);
 const restored=structuredClone(expected.candidate);restored.find(x=>x.signature===signature).contract.definition=changed[0].contract.definition;
 assert.deepEqual(restored,expected.original,'Only the reader definition changes; all other function attributes stay exact');
 mark('sealed migrations and all27 input/output contracts differ only in the reader definition');
 const db=await require('./lib/near-receipt-join-test-database').database();
 try{
  report.engine=(await db.query('select version() v')).rows[0].v;
  async function snapshot(){return (await db.query('select '+reader+"('{preserved:late}')::text body")).rows[0].body;}
  async function table(){assert.deepEqual((await db.query(expected.structureSql)).rows[0].contract,expected.table);}
  async function transaction(fn){await db.exec('begin');try{return await fn();}finally{await db.exec('rollback');}}
  const now=Date.now(),future=new Date(now+300*86400000).toISOString(),old='2001-01-01T00:00:00Z';
  const values=Array.from({length:20},(_,i)=>({id:'admitted:'+i,status:i<19?'live':'scheduled',startTimeUtc:future,statusCheckedAt:old,homeParticipantId:'home:'+i,awayParticipantId:'away:'+i,fixtureIdAliases:i===19?['preserved:late']:[],retainedWideFact:sha(String(i)).repeat(16)}));
  await db.exec("begin;insert into public.nothingsports_fixture_sources(source_id)values('near-selection-local');");
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)select 'near-selection-local',e->>'id',array[e->>'id']||array(select jsonb_array_elements_text(e->'fixtureIdAliases')),e,md5(e::text)from jsonb_array_elements($1::jsonb)e",[JSON.stringify(values)]);
  await db.exec('commit');
  assert.equal((await db.query('select '+ns+'near_index_ready()ready')).rows[0].ready,true);
  const definition=(await db.query('select pg_get_functiondef($1::regprocedure)definition',[signature])).rows[0].definition;
  const ref=definition.replace('public.nothingsports_read_match_centre_fixture_bundle(','qa_near_receipt.original_reader(');
  assert.notEqual(ref,definition);
  await db.exec("create schema qa_near_receipt;revoke all on schema qa_near_receipt from public,anon,authenticated;grant usage on schema qa_near_receipt to service_role;"+ref+";revoke all on function qa_near_receipt.original_reader(text[])from public,anon,authenticated;grant execute on function qa_near_receipt.original_reader(text[])to service_role;");
  async function same(label,ids=['preserved:late']){
   const row=(await db.query('select '+reader+'($1)::text actual,qa_near_receipt.original_reader($1)::text original',[ids])).rows[0];
   assert.equal(row.actual,row.original,label+' full ordered values');mark(label);return JSON.parse(row.actual);
  }
  async function negative(sql,label,change,list){
   const before=await snapshot();
   await transaction(async()=>{
    if(change)await db.exec(change);
    let caught;try{await db.exec(body(sql));}catch(error){caught=error;}
    assert.equal(caught?.code,'P0001',label+' must be a deliberate contract refusal');
    assert.match(caught.message,/Near receipt input (function|private table) contract differs/);
   });
   await contracts(db,list);await table();assert.equal(await snapshot(),before,label+' leaves facts and reader unchanged');mark(label);
  }
  const drift=[
   ['reader ACL','grant execute on function '+signature+' to anon'],
   ['reader attributes','alter function '+signature+' cost 101'],
   ['reader owner','alter function '+signature+' owner to anon'],
   ['missing reader','drop function '+signature],
   ['reader body',"do $drift$begin execute replace(pg_get_functiondef('"+signature+"'::regprocedure),E'\\nselect case',E'\\n-- deliberate test drift\\nselect case');end $drift$"],
   ['unchanged readiness helper','alter function '+ns+'near_index_ready() cost 101'],
   ['original fallback ACL','grant execute on function '+ns+'read_near_raw(text[])to authenticated'],
   ['private table rights','grant update on '+ns+'near_selection to service_role'],
   ['private column rights','grant update(shape_version)on '+ns+'near_selection to service_role'],
   ['unexpected RLS policy','create policy unexpected on '+ns+'near_selection for select to service_role using(true)'],
   ['private schema rights','grant usage on schema nothingsports_fixture_read_private to anon'],
   ['private RLS','alter table '+ns+'near_selection no force row level security'],
   ['private columns','alter table '+ns+'near_selection add column unexpected text']
  ];
  const before=await snapshot();assert.equal(JSON.parse(before).rows.length,20);
  for(const [label,change]of drift)await negative(install,'forward refuses '+label,change,expected.original);
  await db.exec(install);await contracts(db,expected.candidate);await table();
  const applied=(await db.query('select md5(prosrc)body from pg_proc where oid=$1::regprocedure',[signature])).rows[0].body;
  assert.equal(applied,expected.candidateBodyMd5);assert.equal(await snapshot(),before);mark('actual guarded forward preserves full ordered20-row output and exact function/table contracts');
  await negative(install,'installation replay refused',null,expected.candidate);
  await same('original indexed reader and candidate are identical on aliases');
  await transaction(async()=>{await db.exec('set local role service_role');await same('original indexed reader and candidate are identical as service_role');});
  await same('NULL membership',null);await same('empty membership',[]);
  // Real receipt shapes, including explicit null and non-object JSON, retain SQL merge semantics.
  for(const [label,receipt]of [['SQL NULL',null],['JSON null','null'],['array','[]'],['string','"x"'],['object','{"admitted:0":{"statusCheckedAt":"2000-01-01T00:00:00Z"}}']]){
   await transaction(async()=>{
    await db.query("update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',$1::jsonb)where source_id=$2",[receipt,'near-selection-local']);
    await same('receipt shape '+label);
   });
  }
  for(const receipt of ['null','[]','"x"','0','{}'])await transaction(async()=>{
   await db.query("update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object('admitted:0',$1::jsonb))where source_id=$2",[receipt,'near-selection-local']);
   await same('named fixture receipt '+receipt);
  });
  await transaction(async()=>{
   for(const [i,source]of ['qa-receipt:a','qa-receipt:b','qa-receipt:none'].entries()){
    const checked='200'+(i+2)+'-01-01T00:00:00Z';
    const fixture={id:'shared-receipt-id',status:'live',sourceStale:true,statusCheckedAt:old,scoreCheckedAt:old,homeParticipantId:source+':h',awayParticipantId:source+':a'};
    await db.query('insert into public.nothingsports_fixture_sources(source_id,discovery_report)values($1,$2::jsonb)',[source,JSON.stringify(i===2?{}:{_fixtureObservations:{'shared-receipt-id':{s:checked,t:checked}}})]);
    await db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values($1,$2,$3,$4::jsonb,md5($4::text))',[source,fixture.id,[fixture.id],JSON.stringify(fixture)]);
    await db.query('insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash)values($1,$2,$3::jsonb,md5($3::text))',[source,fixture.id,JSON.stringify({homeScore:0,awayScore:0,statusCheckedAt:old,scoreCheckedAt:old})]);
   }
   await db.exec('set constraints all immediate;set constraints all deferred');
   const got=await same('composite source/fixture receipt binding, absent receipt, zero scores and original observation dates');
   for(const [i,source]of ['qa-receipt:a','qa-receipt:b','qa-receipt:none'].entries()){
    const rows=got.rows.filter(row=>row.source_id===source);assert.equal(rows.length,1);
    const f=rows[0].fixture;assert.equal(f.homeScore,0);assert.equal(f.awayScore,0);assert.equal(f.sourceStale,true);
    assert.equal(Date.parse(f.statusFactObservedAt),Date.parse(old));assert.equal(Date.parse(f.scoreFactObservedAt),Date.parse(old));
    assert.equal(Date.parse(f.statusCheckedAt),Date.parse(i===2?old:'200'+(i+2)+'-01-01T00:00:00Z'));
   }
  });
  // Preserve every existing functional check, with the actual new27-contract expectation.
  const checksBeforeRegression=report.checks;
  await require('./lib/near-selection-regression').regression(db,report,{candidateContracts:expected.candidate});
  report.existingRegression={namedCases:report.regressions.length,derivationControls:6,total:report.checks-checksBeforeRegression};
  assert.deepEqual(report.existingRegression,{namedCases:105,derivationControls:6,total:111});
  for(const [label,change]of drift)await negative(undo,'inverse refuses '+label,change,expected.candidate);
  // Facts written by the normal owner after installation must survive the inverse and reapply.
  await db.query("update public.nothingsports_fixture_current set fixture=fixture||'{\"retainedAfterInstall\":true}'::jsonb where source_id='near-selection-local'and fixture_id='admitted:0'");
  const later=await snapshot();assert(later.includes('retainedAfterInstall'));
  await db.exec(undo);await contracts(db,expected.original);await table();assert.equal(await snapshot(),later);mark('exact inverse retains later canonical observations and original27 contracts');
  await negative(undo,'inverse replay refused',null,expected.original);
  await db.exec(install);await contracts(db,expected.candidate);await table();assert.equal(await snapshot(),later);await same('guarded reapply retains later canonical observations');
  report.passed=true;
 }catch(error){report.failure={message:error.message,code:error.code};throw error;}
 finally{
  fs.writeFileSync(path.join(output,'receipt-join-'+(process.env.PGLITE_MODULE==='pglite-pg17'?'pg17':'pg18')+'.json'),JSON.stringify(report,null,2)+'\n');
  await db.close();
 }
 console.log(JSON.stringify({passed:report.passed,checks:report.checks,existingRegression:report.existingRegression,productionCalls:0,providerCalls:0,nativeSpeedClaim:false}));
}
if(require.main===module)run().catch(error=>{console.error(JSON.stringify({passed:false,error:error.message,code:error.code}));process.exitCode=1;});
module.exports={run};

// Opt-in branch of THIS existing receipt-join test, using its existing database factory.
async function qualifyNearKeys(){
 let db;const report={state:'STARTED_LOCAL_ONLY',passed:false,checks:0,padding:0,productionCalls:0,providerCalls:0,nativeSpeedClaim:false,releaseAcceptance:false};
 const mark=name=>{report.checks++;(report.checksPassed??=[]).push(name);};
 const sourceRoot=process.env.NS_NEAR_KEYS_SOURCE_DIR,output=process.env.NEAR_EVIDENCE_DIR;
 let failure=false,outputAdmitted=false;
 function readBound(file,limit){
  let fd;
  try{
   const parent=fs.lstatSync(path.dirname(file));if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o777)!==0o700)throw Error('Bound private parent refused');
   fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const first=fs.fstatSync(fd);
   if(!first.isFile()||(first.mode&0o777)!==0o600||first.size<1||first.size>limit)throw Error('Bound private input refused');
   const raw=Buffer.alloc(first.size);let at=0;
   while(at<raw.length){const n=fs.readSync(fd,raw,at,raw.length-at,null);if(n<1)throw Error('Bound private input incomplete');at+=n;}
   if(fs.readSync(fd,Buffer.alloc(1),0,1,null)!==0)throw Error('Bound private input grew');
   const last=fs.fstatSync(fd);if(first.dev!==last.dev||first.ino!==last.ino||first.size!==last.size||first.mtimeMs!==last.mtimeMs)throw Error('Bound private input changed');return raw;
  }finally{if(fd!==undefined)fs.closeSync(fd);}
 }
 function same(actual,wanted){if(sha(JSON.stringify(actual))!==sha(JSON.stringify(wanted)))throw Error('Ordered private output differs');}
 try{
  if(process.env.PGLITE_MODULE!=='pglite-pg17')throw Error('Existing target PG17 runtime binding required');
  if(!sourceRoot||!path.isAbsolute(sourceRoot)||!output||!path.isAbsolute(output))throw Error('Bound existing test inputs/output required');
  const relative=path.relative(process.cwd(),output);if(!relative.startsWith('..'+path.sep))throw Error('Private output must remain outside checkout');
  const out=fs.lstatSync(output);if(!out.isDirectory()||out.isSymbolicLink()||(out.mode&0o777)!==0o700||fs.readdirSync(output).length)throw Error('Fresh private output required');
  outputAdmitted=true;
  const manifestHash=process.env.NS_NEAR_KEYS_SOURCE_PINS_SHA;if(!/^[a-f0-9]{64}$/.test(manifestHash||''))throw Error('Source manifest binding required');
  const manifestRaw=readBound(path.join(sourceRoot,'pins-v2.json'),131072);if(sha(manifestRaw)!==manifestHash)throw Error('Source manifest differs');const manifest=JSON.parse(manifestRaw);
  const selected=['pack-near-fixture-keys.helper.sql','reader.expected-before.sql','reader.expected-after.sql','forward.guarded.sql.template','inverse.guarded.sql.template','confirmation.guarded.sql.template'];const sources={};
  for(const name of selected){const raw=readBound(path.join(sourceRoot,name),131072);if(sha(raw)!==manifest.files[name]?.sha256)throw Error('SQL source differs');sources[name]=raw.toString('utf8');}
  const capturePath=process.env.NS_NEAR_KEY_CAPTURE_BODY;if(!capturePath||!path.isAbsolute(capturePath))throw Error('Captured corpus binding required');
  const capture=readBound(capturePath,8388608);if(capture.length!==4778945||sha(capture)!=='8994e7cb4ab362e35dc875cf1bc0da1ea700e6bdf6b2e8db0da33057ce143eb0')throw Error('Captured corpus differs');
  const corpus=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(capture));
  if(corpus.rows.length!==1650||corpus.complete!==true||corpus.scope!=='match-centre')throw Error('Captured corpus shape differs');
  const codec=require('../lib/near-fixture-keys');
  const install=fs.readFileSync('supabase/migrations/'+expected.migration,'utf8');if(sha(install)!==expected.installSha256)throw Error('Existing receipt migration differs');
  db=await require('./lib/near-receipt-join-test-database').database();
  if(Math.floor(Number((await db.query("select current_setting('server_version_num') n")).rows[0].n)/10000)!==17)throw Error('Actual target major differs');
  await db.exec(install);await contracts(db,expected.candidate);
  async function table(){const got=(await db.query(expected.structureSql)).rows[0].contract;same(got,expected.table);}
  await table();mark('actual target PG17 expected09c and all27/table contracts');
  const before=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition;
  if(crypto.createHash('md5').update(before).digest('hex')!=='09c1fb11e09a04dfa5c58350d7153e39')throw Error('Reader preimage differs');
  const reference=before.replace('public.nothingsports_read_match_centre_fixture_bundle(','qa_near_receipt.original_reader(');if(reference===before)throw Error('Reference binding refused');
  await db.exec('create schema qa_near_receipt;revoke all on schema qa_near_receipt from public,anon,authenticated;grant usage on schema qa_near_receipt to service_role;'+reference+';revoke all on function qa_near_receipt.original_reader(text[])from public,anon,authenticated;grant execute on function qa_near_receipt.original_reader(text[])to service_role;');
  // Derive canonical target hashes inside one rolled-back local source-compilation phase.
  await db.exec('begin');let readerHash,helperHash;
  try{
   await db.exec(sources['pack-near-fixture-keys.helper.sql']+sources['reader.expected-after.sql']);
   const hashes=(await db.query("select md5(pg_get_functiondef($1::regprocedure)) reader,md5(pg_get_functiondef('nothingsports_fixture_read_private.pack_near_fixture_keys(jsonb)'::regprocedure)) helper",[signature])).rows[0];readerHash=hashes.reader;helperHash=hashes.helper;
  }finally{await db.exec('rollback');}
  if(!/^[a-f0-9]{32}$/.test(readerHash)||!/^[a-f0-9]{32}$/.test(helperHash))throw Error('Canonical target hashes unavailable');
  const bind=text=>text.replaceAll('__TARGET_PG17_READER_MD5__',readerHash).replaceAll('__TARGET_PG17_HELPER_MD5__',helperHash);
  const forward=bind(sources['forward.guarded.sql.template']),inverse=bind(sources['inverse.guarded.sql.template']),confirmation=bind(sources['confirmation.guarded.sql.template']);
  async function refusal(sql,drift,restored){
   await db.exec('begin');let refused=false;
   try{if(drift)await db.exec(drift);try{await db.exec(body(sql));}catch(e){refused=e.code==='P0001';}}
   finally{await db.exec('rollback');}
   if(!refused)throw Error('Expected local contract refusal absent');await contracts(db,restored);await table();
  }
  const driftedBody=before.replace('AS $function$', 'AS $function$\n-- deliberate local preimage drift');
  if(driftedBody===before)throw Error('Drift fixture binding differs');
  await refusal(forward,driftedBody,expected.candidate);mark('wrong reader definition refuses atomically');
  await refusal(forward,'set local role service_role',expected.candidate);mark('wrong execution role refuses before DDL');
  await refusal(forward,sources['pack-near-fixture-keys.helper.sql'],expected.candidate);mark('unexpected helper refuses without replacement');
  await refusal(forward,'alter function '+signature+' cost 101',expected.candidate);mark('wrong preimage attributes refuse atomically');
  await refusal(forward,'grant execute on function '+signature+' to anon',expected.candidate);mark('wrong reader ACL refuses atomically');
  await refusal(forward,'alter table '+ns+'near_selection no force row level security',expected.candidate);mark('wrong FORCE RLS refuses atomically');
  await db.exec(forward);
  const changed=structuredClone(expected.candidate);changed.find(x=>x.signature===signature).contract.definition=readerHash;await contracts(db,changed);await table();
  const helper=(await db.query("select jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig) contract from pg_proc p where p.oid='nothingsports_fixture_read_private.pack_near_fixture_keys(jsonb)'::regprocedure")).rows[0].contract;
  same(helper,{definition:helperHash,acl:'{postgres=X/postgres,service_role=X/postgres}',owner:'postgres',definer:false,volatile:'i',parallel:'u',strict:false,cost:100,leakproof:false,config:['search_path=""']});mark('guarded forward and sole new helper service-only attributes');
  // Existing correctness regression, padding0 omits its old timing/padding benchmark.
  await require('./lib/near-selection-regression').regression(db,report,{candidateContracts:changed});
  const fixed={id:'qa-near-keys-local',status:'live',homeScore:0,awayScore:null,statusCheckedAt:'2001-01-01T00:00:00Z',unknown:JSON.parse('{"__proto__":null,"é":"🏉","nested":[false,null,0]}')};
  await db.query("insert into public.nothingsports_fixture_sources(source_id)values('qa-near-keys-local');");
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values('qa-near-keys-local',$1,$2,$3::jsonb,md5($3::text))",[fixed.id,[fixed.id],JSON.stringify(fixed)]);
  async function ordered({role='service_role',header='{"x-ns-near-fixture-keys":"v1"}',fallback=false}={}){
   await db.exec('begin');
   try{
    if(fallback)await db.exec('update '+ns+'near_selection set shape_version=0');
    if(role==='service_role')await db.exec('set local role service_role');
    await db.query("select set_config('request.headers',$1,true)",[header]);
    const got=(await db.query('select '+reader+'($1)::text actual,qa_near_receipt.original_reader($1)::text original',[[]])).rows[0];
    const value=JSON.parse(got.actual),original=JSON.parse(got.original);
    if(role==='service_role'&&header.includes('"v1"'))same(codec.decode(value,{textBytes:Buffer.byteLength(got.actual)}),original);else if(got.actual!==got.original)throw Error('Legacy frame changed');
   }finally{await db.exec('rollback');}
  }
  await ordered();mark('opt-in indexed full frame equals original at same statement clock');
  await ordered({fallback:true});mark('opt-in unready rawfallback full frame equals original');
  await ordered({header:'{}'});await ordered({header:'not-json'});await ordered({role:'postgres'});mark('default malformed header and nonservice role retain exact legacy frame');
  const packed=(await db.query('select '+ns+'pack_near_fixture_keys($1::jsonb)::text value',[capture.toString('utf8')])).rows[0].value;
  if(Buffer.byteLength(packed)>4194304)throw Error('Local packed corpus exceeds unchanged wire cap');
  same(codec.decode(JSON.parse(packed),{textBytes:Buffer.byteLength(packed)}),corpus);mark('native helper full1650-row captured frame and property order exact');
  const fixedClock=Date.parse('2026-11-17T07:37:52.910Z'),health=[...new Set(corpus.rows.map(r=>r.source_id))].map(source_id=>({source_id,revision:1,checked_at:new Date(fixedClock).toISOString(),next_due_at:new Date(fixedClock).toISOString(),discovery_report:{}}));
  if(health.length!==16)throw Error('Private source count differs');
  const {createSnapshotStore}=require('../lib/live-fixtures'),{supabaseServiceRequest}=require('../lib/supabase-server');
  const fakeEnvironment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_local_test_not_a_credential'};
  async function consumer(text,nearTransport){
   let calls=0;
   const request=(url,options)=>supabaseServiceRequest(url,{...options,environment:fakeEnvironment,fetchImpl:async(actual,opts)=>{
    const isHealth=actual.endsWith('/rest/v1/rpc/nothingsports_read_fixture_source_health');
    if(opts.method!=='POST'||(!isHealth&&!actual.endsWith('/rest/v1/rpc/nothingsports_read_match_centre_fixture_bundle'))||++calls>2)throw Error('Private native vector request differs');
    return new Response(isHealth?JSON.stringify(health):text,{status:200});
   }});
   const result=await createSnapshotStore({request,nearTransport}).read({scope:'match-centre',interactive:true,now:fixedClock,preserveIds:['qa:native-private:one','qa:native-private:two']});
   if(calls!==2)throw Error('Private native vector request count differs');return result;
  }
  const baselineConsumer=await consumer(capture.toString('utf8')),nativeConsumer=await consumer(packed,codec.CANDIDATE);same(nativeConsumer,baselineConsumer);
  report.privateConsumerSha256=sha(JSON.stringify(nativeConsumer));report.baselinePrivateConsumerSha256=sha(JSON.stringify(baselineConsumer));report.privateCorpusClock='2026-11-17T07:37:52.910Z';report.syntheticHealthAndRequestMembership=true;mark('actual native packed wire restores full appstore consumer at fixed clock');

  const edge={...corpus,fixtureKeys:'original-envelope-collision',rows:[{source_id:'qa',fixture_id:'same',identity_keys:['a','a'],fixture:JSON.parse('{"__proto__":{"safe":true},"constructor":null,"é":"🏉","0":false,"null":null}'),unknownRow:0},{source_id:'qa-other',fixture_id:'same',identity_keys:[],fixture:{status:'newer',score:null,unknown:false}}]};
  const edgeRow=(await db.query('select $1::jsonb::text original,'+ns+'pack_near_fixture_keys($1::jsonb)::text packed',[JSON.stringify(edge)])).rows[0];same(codec.decode(JSON.parse(edgeRow.packed),{textBytes:Buffer.byteLength(edgeRow.packed)}),JSON.parse(edgeRow.original));mark('native Unicode/numeric/unsafe keys/null/collision and source variants');
  const empty={schemaVersion:'current-fixture-bundle.v1',scope:'match-centre',complete:true,rows:[]};const emptyPacked=(await db.query('select '+ns+'pack_near_fixture_keys($1::jsonb)::text v',[JSON.stringify(empty)])).rows[0].v;same(codec.decode(JSON.parse(emptyPacked),{textBytes:Buffer.byteLength(emptyPacked)}),empty);
  const incomplete={...empty,complete:false,rows:Array.from({length:5001},()=>({source_id:'qa',fixture_id:'sentinel',identity_keys:[],fixture:{id:'sentinel'}}))};const incompletePacked=(await db.query('select '+ns+'pack_near_fixture_keys($1::jsonb)::text v',[JSON.stringify(incomplete)])).rows[0].v;let refused=false;try{codec.decode(JSON.parse(incompletePacked),{textBytes:Buffer.byteLength(incompletePacked)});}catch{refused=true;}if(!refused)throw Error('Incomplete sentinel admitted');mark('empty frame preserved and5001sentinel not made complete');
  await refusal(inverse,'grant execute on function '+ns+'pack_near_fixture_keys(jsonb) to authenticated',changed);mark('inverse refuses helper ACL drift');
  await db.exec(confirmation);mark('bound exact metadata confirmation succeeds');
  await db.query("update public.nothingsports_fixture_current set fixture=fixture||'{\"laterObservationRetained\":true}'::jsonb where source_id='qa-near-keys-local'");
  const later=(await db.query('select '+reader+'($1)::text v',[[]])).rows[0].v;
  await db.exec(inverse);
  if((await db.query('select '+reader+'($1)::text v',[[]])).rows[0].v!==later)throw Error('Inverse changed later facts');
  await contracts(db,expected.candidate);await table();if((await db.query("select to_regprocedure('nothingsports_fixture_read_private.pack_near_fixture_keys(jsonb)') is null gone")).rows[0].gone!==true)throw Error('Helper inverse differs');mark('guarded inverse restores09c/all27/table and removes only helper');
  for(const [name,text]of [['forward.bound.sql',forward],['inverse.bound.sql',inverse],['confirmation.bound.sql',confirmation]])fs.writeFileSync(path.join(output,name),text,{flag:'wx',mode:0o600});
  report.state='PASS_LOCAL_TARGET17_NOT_PRODUCTION';report.readerPostMd5=readerHash;report.helperMd5=helperHash;report.localPackedCorpusBytes=Buffer.byteLength(packed);report.privateBodySha256=sha(capture);report.forwardSha256=sha(forward);report.inverseSha256=sha(inverse);report.confirmationSha256=sha(confirmation);report.benchmarkReplay=false;
 }catch(error){failure=true;report.state='FAIL_LOCAL_STOP';report.failureCode=/^[0-9A-Z]{5}$/.test(error?.code||'')?error.code:null;}
 finally{
  if(db)try{await db.close();}catch{failure=true;report.state='FAIL_CLEANUP_UNCONFIRMED';}
  report.passed=!failure&&report.state==='PASS_LOCAL_TARGET17_NOT_PRODUCTION';
  if(outputAdmitted)try{fs.writeFileSync(path.join(output,'near-keys-pg17.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});}catch{failure=true;}
 }
 if(failure)throw Error('Private near-key target17 qualification failed; details withheld');
 console.log(JSON.stringify({state:report.state,passed:report.passed,checks:report.checks,readerPostMd5:report.readerPostMd5,helperMd5:report.helperMd5,localPackedCorpusBytes:report.localPackedCorpusBytes,productionCalls:0,providerCalls:0}));return report;
}
