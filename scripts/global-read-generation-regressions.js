'use strict';
// Constructed, disposable PostgreSQL only. Call through the real invoker builder.
// No provider facts, clock overrides, production transport or timing claims.
const assert=require('node:assert/strict');
const GEN='nothingsports_fixture_read_private.global_read_generations';
async function receipts({db,build,equal,today}){
 let checks=0;
 const sid='generation-gather-regression';
 await db.query('insert into public.nothingsports_fixture_sources(source_id)values($1)',[sid]);
 // Numeric-looking identifiers stay TEXT keys, even against array receipt maps.
 for(const id of ['0','01','1','-1','word'])await db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values($1,$2,$3,$4::jsonb,$2)',[sid,id,[id,'alias:'+id],JSON.stringify({id,date:today,status:'scheduled'})]);
 await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,content_hash)values($1,'outside',jsonb_build_object('id','outside','date','2000-01-01','status','completed'),'outside')",[sid]);
 const stamp=(await db.query("select to_char(clock_timestamp()+interval '10 minutes','YYYY-MM-DD\"T\"HH24:MI:SS.US')||'Z'v")).rows[0].v;
 const earlier=(await db.query("select to_char(clock_timestamp()+interval '6 minutes','YYYY-MM-DD\"T\"HH24:MI:SS.US')||'Z'v")).rows[0].v;
 const invalid='2026-02-30T00:00:00Z';
 const cases=[
  {label:'SQL NULL report',report:null},
  {label:'missing map',report:{}},
  {label:'JSON null map',report:{_fixtureObservations:null}},
  {label:'scalar map',report:{_fixtureObservations:'not-an-object'}},
  {label:'array map must not index numeric identifiers',report:{_fixtureObservations:[{s:stamp,t:stamp},{s:stamp}]}},
  {label:'mixed object maps',report:{_fixtureObservations:{0:{s:stamp},'01':{t:stamp},1:null,'-1':['bad',stamp],word:{s:invalid,t:'bad'},outside:{s:earlier}}}},
  ...['baseScore','scoreScore','baseStatus','scoreStatus','receiptScore','receiptStatus'].map(input=>({label:input,input,report:{_fixtureObservations:{0:{s:input==='receiptScore'?stamp:invalid,t:input==='receiptStatus'?stamp:'bad'},outside:{s:earlier}}}}))
 ];
 for(const c of cases){
  await db.query('update public.nothingsports_fixture_sources set discovery_report=$2::jsonb where source_id=$1',[sid,c.report===null?null:JSON.stringify(c.report)]);
  await db.query("update public.nothingsports_fixture_current set fixture=fixture||jsonb_build_object('scoreCheckedAt',$2::text,'statusCheckedAt',$3::text)where source_id=$1 and fixture_id='0'",[sid,c.input==='baseScore'?stamp:invalid,c.input==='baseStatus'?stamp:'bad']);
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash)values($1,'0',jsonb_build_object('id','0','scoreCheckedAt',$2::text,'statusCheckedAt',$3::text),'gather')on conflict(source_id,fixture_id)do update set score=excluded.score",[sid,c.input==='scoreScore'?stamp:null,c.input==='scoreStatus'?stamp:null]);
  // Old scalar receipt gather is the independent expiry oracle. Use fixed future raw stamps without source mutations in the
  // comparison transaction. Both statements retain their genuine clocks;
  // midnight and raw-stamp-minus-five-minute expiry compare exactly.
  await db.exec('begin');
  try{
   const expected=(await db.query(`with built as materialized(select bundle from public.qa_generation_original),raw_values as materialized(
    select unnest(array[s.score->>'scoreCheckedAt',c.global_fixture->>'scoreCheckedAt',s.score->>'statusCheckedAt',c.global_fixture->>'statusCheckedAt',(src.discovery_report->'_fixtureObservations'->c.fixture_id)->>'s',(src.discovery_report->'_fixtureObservations'->c.fixture_id)->>'t'])value
    from built b cross join lateral json_array_elements(b.bundle->'rows')r
    join public.nothingsports_fixture_current c on c.source_id=r->>'source_id'and c.fixture_id=r->>'fixture_id'
    join public.nothingsports_fixture_sources src using(source_id)left join public.nothingsports_live_scores s using(source_id,fixture_id))
    select least((((statement_timestamp()at time zone 'Australia/Sydney')::date+1)::timestamp at time zone 'Australia/Sydney'),(select min(nothingsports_fixture_read_private.global_read_clock_transition(value))from(select distinct value from raw_values)d))::text expiry`)).rows[0].expiry;
   assert.equal((await build()).state,'installed',c.label);checks++;
   const actual=(await db.query(`select valid_until::text expiry from ${GEN} order by installed_at desc,generation_id desc limit 1`)).rows[0].expiry;
   assert.equal(actual,expected,c.label+' exact scalar-gather expiry');checks++;
   await equal();
   if(c.input){
    // All six inputs must independently bound expiry; absent/invalid values and
    // out-of-window rows cannot manufacture an earlier transition.
    const row=(await db.query(`select valid_until=least($1::timestamptz-interval '5 minutes',(((statement_timestamp()at time zone 'Australia/Sydney')::date+1)::timestamp at time zone 'Australia/Sydney'))ok from ${GEN} order by installed_at desc,generation_id desc limit 1`,[stamp])).rows[0];
    assert.equal(row.ok,true,c.label+' remains a future transition');checks++;
   }
  }finally{await db.exec('commit');}
 }
 // Out-of-scope source receipts cannot affect the selected complete response.
 await db.query("insert into public.nothingsports_fixture_sources(source_id,discovery_report)values('generation-excluded-source',jsonb_build_object('_fixtureObservations',jsonb_build_object('outside',jsonb_build_object('s',$1::text))))",[earlier]);
 await db.exec("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,content_hash)values('generation-excluded-source','outside','{\"id\":\"outside\",\"date\":\"2000-01-01\",\"status\":\"completed\"}','outside')");
 assert.equal((await build()).state,'installed');await equal();checks++;
 await db.query('delete from public.nothingsports_fixture_sources where source_id=any($1)',[[sid,'generation-excluded-source']]);
 return checks;
}
async function codec({db,build,equal,today}){
 let checks=0;
 const sid='generation-lz4-regression';
 await db.query('insert into public.nothingsports_fixture_sources(source_id)values($1)',[sid]);
 // Real builder INSERT and ON CONFLICT replacements, large enough to require
 // actual TOAST compression. Never infer codec from column metadata alone.
 for(let i=0;i<3;i++){
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values($1,'compressible',array['compressible','alias:compressed'],jsonb_build_object('id','compressible','date',$2::text,'status','scheduled','name',repeat('constructed-snapshot-',6000),'homeScore',$3::int),'codec')on conflict(source_id,fixture_id)do update set fixture=excluded.fixture",[sid,today,i]);
  assert.equal((await build()).state,'installed');checks++;
  const row=(await db.query(`select pg_column_compression(payload) codec,pg_column_size(payload)<octet_length(payload::text) compressed,payload::text=(select bundle::text from public.qa_generation_original) whole_value from ${GEN} order by installed_at desc,generation_id desc limit 1`)).rows[0];
  assert.equal(row.codec,'lz4','actual private payload codec through builder');assert.equal(row.compressed,true);assert.equal(row.whole_value,true);checks+=3;await equal();
 }
 await db.query('delete from public.nothingsports_fixture_sources where source_id=$1',[sid]);
 return checks;
}
module.exports={receipts,codec};
