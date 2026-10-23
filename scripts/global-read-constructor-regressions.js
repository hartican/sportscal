'use strict';
const assert=require('node:assert/strict');
const CONSTRUCTOR='nothingsports_fixture_read_private.global_read_constructor';
const ORIGINAL='nothingsports_fixture_read_private.global_read_original';
// Independent old scalar-gather expiry, NOT the new constructor's metadata.
const expiryOracle=`with built as materialized(select bundle from ${ORIGINAL}),raw_values as materialized(
 select unnest(array[s.score->>'scoreCheckedAt',c.global_fixture->>'scoreCheckedAt',s.score->>'statusCheckedAt',c.global_fixture->>'statusCheckedAt',(src.discovery_report->'_fixtureObservations'->c.fixture_id)->>'s',(src.discovery_report->'_fixtureObservations'->c.fixture_id)->>'t'])value
 from built b cross join lateral json_array_elements(b.bundle->'rows')r
 join public.nothingsports_fixture_current c on c.source_id=r->>'source_id'and c.fixture_id=r->>'fixture_id'
 join public.nothingsports_fixture_sources src using(source_id)left join public.nothingsports_live_scores s using(source_id,fixture_id))
 select least((((statement_timestamp()at time zone 'Australia/Sydney')::date+1)::timestamp at time zone 'Australia/Sydney'),(select min(nothingsports_fixture_read_private.global_read_clock_transition(value))from(select distinct value from raw_values)d))`;
async function constructor({db,service=fn=>fn()}){
 let checks=0;
 const mark=(phase,state,detail={})=>console.log(JSON.stringify({schemaVersion:'global-generation-constructor-phase.v1',phase,state,...detail,constructedOnly:true}));
 const original=(await db.query(`select pg_get_viewdef('${ORIGINAL}'::regclass,true)d`)).rows[0].d;
 const expanded=(await db.query(`select pg_get_viewdef('${CONSTRUCTOR}'::regclass,true)d`)).rows[0].d;
 assert(!expanded.includes('json_array_elements')&&!expanded.includes('json_each'),'No decode of full response in expanded constructor');checks++;
 // Derivation changes only the final output. The full CTE body and original
 // json_build_object/row_to_json/order expression must remain identical.
 const start=original.indexOf('WITH calendar_windows'),end=original.indexOf(' AS json_build_object\n');
 assert(start>0&&end>start);assert(expanded.includes(original.slice(start,end)));checks++;
 const settings=(await db.query("select jsonb_object_agg(name,setting order by name)v from pg_settings where name=any(array['statement_timeout','lock_timeout','jit','work_mem','default_statistics_target','plan_cache_mode','max_parallel_workers_per_gather'])")).rows[0].v;
 mark('settings','observed',{engine:db.engine?.kind||'pglite',settings});
 await db.exec('begin');
 try{
  mark('setup','begin',{caseSize:0});
  await db.exec('delete from public.nothingsports_fixture_sources');
  const today=(await db.query("select(statement_timestamp()at time zone 'Australia/Sydney')::date::text d")).rows[0].d;
  await db.exec("insert into public.nothingsports_fixture_sources(source_id)values('constructor-contract')");
  let existing=0;
  for(const size of [0,1,5000,5001]){
   // Fixture preparation only, in this SAME transaction with every real
   // constraint/context/token trigger enabled. The bulk synthetic INSERT
   // exceeded the unchanged native 6s statement limit before any read. Fixed
   // 100-row setup statements retain the complete 5000/5001 boundary cases.
   for(let first=existing+1;first<=size;first+=100){
    const last=Math.min(first+99,size);mark('setup-batch','begin',{caseSize:size,first,last});
    await db.query(`insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)
     select 'constructor-contract',i::text,array['alias:'||i::text,i::text],jsonb_build_object('id',i::text,'date',$1::text,'status','scheduled','homeScore',0,'awayScore',0),i::text from generate_series($2::int,$3::int)i`,[today,first,last]);
    mark('setup-batch','complete',{caseSize:size,first,last});
   }
   existing=size;
   mark('setup','complete',{caseSize:size});mark('constructor-comparison','begin',{caseSize:size});
   const row=await service(async()=>(await db.query(`select b.bundle::text actual,(select bundle::text from ${ORIGINAL})expected,
    b.schema_version schema,b.complete,b.valid_until::text expiry,(${expiryOracle})::text expected_expiry from ${CONSTRUCTOR} b`)).rows[0]);
   assert.equal(row.actual,row.expected,'Exact canonical payload at '+size);checks++;
   assert.equal(row.schema,'current-fixture-bundle.v1');assert.equal(row.complete,size<=5000);checks+=2;
   assert.equal(JSON.parse(row.actual).rows.length,size);assert.equal(JSON.parse(row.actual).complete,row.complete);checks+=2;
   assert.equal(row.expiry,row.expected_expiry,'Independent raw-clock expiry at '+size);checks++;
   mark('constructor-comparison','complete',{caseSize:size});
  }
  // Exercise the real canonical boundary. Scalars fail generated projection
  // (22023); arrays fail the existing object CHECK (23514). Valid objects reach
  // the constructor. Do not claim malformed rows bypass those original guards.
  mark('shape-reset','begin',{caseSize:existing});
  await db.exec("delete from public.nothingsports_fixture_current where fixture_id<>'1'");
  mark('shape-reset','complete',{caseSize:1});
  for(const shape of [null,7,[],['x'],{}, {id:'1',date:today,status:'live',homeScore:0,awayScore:0,scoreCheckedAt:'bad',statusCheckedAt:'2026-02-30T00:00:00Z'}]){
   mark('shape-setup','begin',{shape});
   await db.exec('savepoint shape_input');
   try{
    await db.query("update public.nothingsports_fixture_current set fixture=$1::jsonb where fixture_id='1'",[JSON.stringify(shape)]);
    await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash)values('constructor-contract','1',$1::jsonb,'shape')on conflict(source_id,fixture_id)do update set score=excluded.score",[JSON.stringify(shape)]);
    assert(shape!==null&&typeof shape==='object'&&!Array.isArray(shape),'Nonobject fixture must be rejected by the unchanged canonical guards');checks++;
   }catch(error){
    assert(shape===null||typeof shape==='number'||Array.isArray(shape),'Unexpected canonical input rejection for '+JSON.stringify(shape)+': '+error.code+' '+error.message);
    assert.equal(error.code,Array.isArray(shape)?'23514':'22023','Unchanged canonical guards reject nonobject input');checks++;
    await db.exec('rollback to shape_input');
   }
   mark('shape-setup','complete',{shape});mark('shape-comparison','begin',{shape});
   const row=await service(async()=>(await db.query(`select b.bundle::text actual,(select bundle::text from ${ORIGINAL})expected,b.valid_until::text expiry,(${expiryOracle})::text expected_expiry from ${CONSTRUCTOR} b`)).rows[0]);
   assert.equal(row.actual,row.expected,'Reachable canonical fixture/score shape '+JSON.stringify(shape));assert.equal(row.expiry,row.expected_expiry);checks+=2;
   mark('shape-comparison','complete',{shape});
  }
 }finally{await db.exec('rollback');}
 return {checks,boundaryCases:4,fixtureShapes:6};
}
// Unlike the retired JSON extraction seam, arbitrary top-level/view metadata is
// impossible through the exact canonical constructor. An edited definition or
// permission must invalidate admission, never become a test-only soft pass.
async function policy({db,build,cached,service}){
 let checks=0;
 for(const mutation of [
  `create or replace view ${CONSTRUCTOR} with(security_invoker=true)as select '{}'::json bundle,'current-fixture-bundle.v1'::text schema_version,true complete,clock_timestamp()+interval '1 day' valid_until`,
  `alter view ${CONSTRUCTOR} set(security_invoker=false)`,
  `grant select on ${CONSTRUCTOR} to anon`,
  `grant select(bundle)on ${CONSTRUCTOR} to authenticated`,
  `revoke select on ${CONSTRUCTOR} from service_role`
 ]){
  await db.exec('begin;'+mutation);
  try{
   assert.equal(await service(async()=>(await db.query('select nothingsports_fixture_read_private.global_generation_policy()p')).rows[0].p),null);checks++;
   assert.equal((await build()).reason,'parser_or_pending');assert.equal(await cached(),null);checks+=2;
  }finally{await db.exec('rollback');}
 }
 for(const input of require('./global-read-generation-regressions').projectionInputs())for(const tokenNull of [false,true]){
  const literal=input===null?'null::json':"'"+input.replaceAll("'","''")+"'::json";
  await db.exec(`begin;create or replace view ${CONSTRUCTOR} with(security_invoker=true)as select ${literal} bundle,'current-fixture-bundle.v1'::text schema_version,true complete,clock_timestamp()+interval '1 day' valid_until`);
  try{
   if(tokenNull)await db.exec('delete from nothingsports_fixture_read_private.global_read_epochs where source_id=(select source_id from nothingsports_fixture_read_private.global_read_epochs order by source_id limit 1)');
   assert.equal((await build()).reason,'parser_or_pending','Edited constructor cannot admit arbitrary top-level JSON, tokenNull='+tokenNull);checks++;
   assert.equal(await cached(),null);checks++;
  }finally{await db.exec('rollback');}
 }
 return checks;
}
async function budgetRollback({db,build,cached}){
 let checks=0;
 // Actual guarded builder, isolated native test DB only. A changed session
 // forces construction without changing any canonical facts or epoch vector.
 // BEFORE INSERT runs once for both a fresh slot and ON CONFLICT replacement.
 // The fixed delay crosses the requested budget while remaining below the
 // existing outer 6s/transport8s limits. No production clock/test flag is added.
 assert.equal((await build()).state,'installed');checks++;
 const priorCached=await cached();assert(priorCached);checks++;
 const state=async()=>(await db.query(`select jsonb_build_object(
  'generations',(select jsonb_agg(jsonb_build_object('row',to_jsonb(g),'payloadText',g.payload::text)order by slot)from nothingsports_fixture_read_private.global_read_generations g),
  'epochs',(select jsonb_agg(to_jsonb(e)order by source_id)from nothingsports_fixture_read_private.global_read_epochs e),
  'current',(select md5(string_agg(row_to_json(c)::text,''order by source_id,fixture_id))from public.nothingsports_fixture_current c),
  'scores',(select md5(string_agg(row_to_json(s)::text,''order by source_id,fixture_id))from public.nothingsports_live_scores s),
  'sources',(select md5(string_agg(row_to_json(s)::text,''order by source_id))from public.nothingsports_fixture_sources s),
  'context',(select md5(string_agg(row_to_json(c)::text,''order by source_id,fixture_id))from nothingsports_fixture_read_private.fixture_context c))v`)).rows[0].v;
 assert.equal((await db.query('select count(*)::int n from nothingsports_fixture_read_private.global_read_generations')).rows[0].n,2);checks++;
 for(const mode of ['INSERT','UPSERT']){
  await db.exec('begin');
  try{
   if(mode==='INSERT')await db.exec(`alter table nothingsports_fixture_read_private.global_read_generations disable trigger global_generation_install_only;
    delete from nothingsports_fixture_read_private.global_read_generations where slot<>(select slot from nothingsports_fixture_read_private.global_read_generations order by installed_at desc,generation_id desc limit 1);
    alter table nothingsports_fixture_read_private.global_read_generations enable trigger global_generation_install_only`);
   // Sequence changes survive rollback to budget_call, unlike table/config
   // markers. The enclosing test transaction still drops this owned sequence.
   // Exactly two nextvals prove entry AND completion of the controlled delay.
   await db.exec(`create sequence public.qa_generation_budget_delay_marker;
    grant usage on sequence public.qa_generation_budget_delay_marker to service_role;
    create function public.qa_generation_budget_delay()returns trigger language plpgsql as $$begin
     perform nextval('public.qa_generation_budget_delay_marker');perform pg_sleep(1.1);perform nextval('public.qa_generation_budget_delay_marker');return new;end$$;
    create trigger qa_generation_budget_delay before insert on nothingsports_fixture_read_private.global_read_generations for each row execute function public.qa_generation_budget_delay();
    set local datestyle='SQL, DMY'`);
   const before=await state();assert.equal(await cached(),null,'Session change really requires a cold construction');checks++;
   await db.exec('savepoint budget_call');let failure,result;
   try{result=await build(1000);}catch(error){failure=error;await db.exec('rollback to budget_call;reset role');}
   const after=await state(),late=await cached();
   const marker=(await db.query('select last_value::text last_value,is_called from public.qa_generation_budget_delay_marker')).rows[0];
   assert.deepEqual(marker,{last_value:'2',is_called:true},mode+' INCONCLUSIVE unless controlled delay entered and completed exactly once');checks++;
   if(!failure){
    assert.equal(result?.reason,'invalidated_after_install',mode+' INCONCLUSIVE: a pre-admission deferral is not this defect');
    assert.notDeepEqual(after.generations,before.generations,mode+' old overrun must actually change generation state');
    assert.notEqual(late,null,mode+' old overrun must leave a reusable late generation');
    console.log(JSON.stringify({schemaVersion:'global-generation-budget-red.v1',mode,delayMarker:marker,resultReason:result.reason,generationStateChanged:true,lateReusable:true,constructedOnly:true}));
   }
   assert.equal(failure?.code,'57014',mode+' crossing soft budget MUST throw, not commit deferred: '+JSON.stringify({result,generationsRestored:JSON.stringify(after)===JSON.stringify(before),lateReusable:late!==null}));checks++;
   assert.equal(failure.message,'Global generation budget exceeded after install',mode+' must be the sanitised postwrite-budget failure, not an outer timeout');checks++;
   assert.deepEqual(after,before,mode+' failure restores complete prior payload bytes, witness, manifest, epochs and canonical facts');checks++;
   assert.equal(late,null,mode+' failure cannot leave a late reusable generation');checks++;
   await db.exec("set local datestyle='ISO, MDY'");assert.deepEqual(await cached(),priorCached,mode+' preserves prior last-good generation');checks++;
  }finally{await db.exec('rollback;reset role');}
 }
 return checks;
}
module.exports={constructor,policy,budgetRollback,expiryOracle};
