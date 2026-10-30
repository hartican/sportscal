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
