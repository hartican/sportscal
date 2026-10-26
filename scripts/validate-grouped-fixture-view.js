'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=require('./prototypes/grouped-fixture-view'),transport=require('../lib/fixture-source-groups');
const {sampleRows}=require('./lib/grouped-fixture-test-wire');
const {contentHash,overlaySnapshots}=require('../lib/live-fixtures');
let checks=0;
(async()=>{
 const db=await require('./fixture-read-test-baseline').database();
 try{
  await db.exec("set timezone='UTC'");
  const major=Math.floor(Number((await db.query("select current_setting('server_version_num')v")).rows[0].v)/10000);
  const original=(await db.query("select pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)d")).rows[0].d;
  assert.equal(sql.md5(original),sql.ORIGINAL);checks++;
  const functionState=async()=>(await db.query("select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,''),''order by p.oid))h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='public'and p.proname like 'nothingsports_%')or n.nspname='nothingsports_fixture_read_private'")).rows[0].h;
  const functions=await functionState();
  const viewState=async()=>(await db.query("select reloptions,relacl::text,relowner from pg_class where oid='public.nothingsports_current_global_fixture_bundle'::regclass")).rows[0];
  const rights=await viewState();
  const facts=async()=>(await db.query("select md5(coalesce(string_agg(row_to_json(c)::text,''order by source_id,fixture_id),''))h from public.nothingsports_fixture_current c")).rows[0].h;
  await db.exec('create view public.qa_group_legacy with(security_invoker=true)as '+original+';grant select on public.qa_group_legacy to service_role');
  assert.equal((original.match(/LIMIT 5001/g)||[]).length,1);
  await db.exec('create view public.qa_group_full_reference with(security_invoker=true)as '+original.replace('LIMIT 5001','LIMIT 10001')+';grant select on public.qa_group_full_reference to service_role');
  const forward=sql.forward(original),before=await facts();
  for(const change of ["alter view public.nothingsports_current_global_fixture_bundle set(security_invoker=false)","grant select on public.nothingsports_current_global_fixture_bundle to anon","alter function public.nothingsports_fixture_observation_time(text)immutable","alter table public.nothingsports_fixture_current disable row level security"]){
   await db.exec('begin;'+change);await assert.rejects(db.exec(forward),/differ/);await db.exec('rollback');checks++;
  }
  await db.exec('begin;'+forward+'commit');assert.equal(await facts(),before);assert.deepEqual(await viewState(),rights);assert.equal(await functionState(),functions);checks+=3;
  const candidateMd5=(await db.query("select md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h;
  await db.exec('begin');await assert.rejects(db.exec(forward),/differs/);await db.exec('rollback');checks++;
  const headers=async h=>db.query("select set_config('request.headers',$1,false)",[h]);
  const read=async(view='public.nothingsports_current_global_fixture_bundle')=>{await db.exec('set role service_role');try{return(await db.query('select bundle from '+view)).rows[0].bundle;}finally{await db.exec('reset role');}};
  for(const h of ['', '{}','[]','null','not JSON','{"x-ns-fixture-source-groups":"unknown"}','{"X-NS-Fixture-Source-Groups":"v1"}']){
   await headers(h);assert.deepEqual(await read(),await read('public.qa_group_legacy'));checks++;
  }
  await headers(JSON.stringify(transport.HEADERS));assert.deepEqual(transport.decode(await read()).rows,[]);checks++;
  const today=(await db.query("select(statement_timestamp()at time zone'Australia/Sydney')::date::text d")).rows[0].d;
  async function load(rows){
   await db.exec('delete from public.nothingsports_fixture_current');
   await db.query("insert into public.nothingsports_fixture_sources(source_id)select distinct r->>'source_id'from jsonb_array_elements($1::jsonb)r on conflict do nothing",[JSON.stringify(rows)]);
   await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)select r->>'source_id',r->>'fixture_id',case when r->'identity_keys'='null'::jsonb then null else array(select jsonb_array_elements_text(r->'identity_keys'))end,(r->'fixture')||jsonb_build_object('date',$2::text),md5(r::text)from jsonb_array_elements($1::jsonb)r",[JSON.stringify(rows),today]);
  }
  const rows=sampleRows();await load(rows);
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at)values($1,$2,$3::jsonb,'qa-score','2026-10-26T00:00:03.123456Z')",[rows[0].source_id,rows[0].fixture_id,JSON.stringify({status:'completed',homeScore:0,awayScore:1,scoreCheckedAt:'2026-10-26T00:00:00.123456Z',statusCheckedAt:null})]);
  await db.query("update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object($1::text,jsonb_build_object('s','2026-10-26T00:00:02.654321Z','t',null)))where source_id=$2",[rows[0].fixture_id,rows[0].source_id]);
  const grouped=await read(),full=await read('public.qa_group_full_reference'),decoded=transport.decode(grouped);
  assert.equal(grouped.groupCount,2586);assert.equal(grouped.edgeCount,5145);assert.equal(grouped.complete,true);assert.deepEqual(decoded.rows,full.rows);checks+=4;
  assert.equal(contentHash(decoded.rows),contentHash(full.rows));checks++;
  const snapshots=items=>[...new Set(items.map(r=>r.source_id))].map(source_id=>({source_id,fixtures:items.filter(r=>r.source_id===source_id).map(r=>r.fixture)}));
  assert.deepEqual(overlaySnapshots([],snapshots(decoded.rows)),overlaySnapshots([],snapshots(full.rows)));checks++;
  const f=decoded.rows[0].fixture;assert.equal(f.homeScore,0);assert.equal(f.awayScore,1);assert.equal(f.scoreCheckedAt,'2026-10-26T00:00:02.654321+00:00');assert.equal(f.firstConfirmedCompleteAt,'2026-10-26T00:00:03.123456+00:00');checks++;
  await headers('{}');const legacy=await read();assert.equal(legacy.complete,false);assert.equal(legacy.rows.length,5001);assert.deepEqual(legacy,await read('public.qa_group_legacy'));checks++;
  await headers(JSON.stringify(transport.HEADERS));await db.exec("set timezone='Asia/Tokyo'");assert.deepEqual(transport.decode(await read()).rows,(await read('public.qa_group_full_reference')).rows);checks++;await db.exec("set timezone='UTC'");
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select bundle from public.nothingsports_current_global_fixture_bundle'),/permission denied/);await db.exec('reset role');checks++;}
  for(const [keys,edges,complete]of[[5000,5000,true],[5001,5001,false],[5000,10000,true],[5000,10001,false]]){
   await load(sampleRows({keys,edges}));const v=await read();assert.equal(v.complete,complete);if(complete)assert.equal(transport.decode(v).rows.length,edges);else{assert.deepEqual(v.groups,[]);assert.throws(()=>transport.decode(v),/Incomplete/);}checks++;
  }
  for(const n of [16,17]){await load(Array.from({length:n},(_,i)=>({...rows[0],source_id:'fan:'+i})));const v=await read();assert.equal(v.complete,n===16);if(n===16)assert.equal(transport.decode(v).rows.length,16);else assert.deepEqual(v.groups,[]);checks++;}
  // The guarded inverse changes only the view and tolerates intervening fixture facts.
  const inverse=sql.inverse(original,candidateMd5),undoFacts=await facts();await db.exec('begin;'+inverse+'commit');assert.equal(await facts(),undoFacts);assert.deepEqual(await viewState(),rights);assert.equal(await functionState(),functions);checks+=3;
  assert.equal((await db.query("select md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h,sql.ORIGINAL);checks++;
  await db.exec('begin');await assert.rejects(db.exec(inverse),/differs/);await db.exec('rollback');checks++;
  await db.exec('begin;'+forward+'commit');assert.deepEqual(await viewState(),rights);assert.equal(await functionState(),functions);checks++;
  const output=process.env.GROUPED_PROTOTYPE_OUTPUT;if(output){fs.mkdirSync(output,{recursive:true});for(const[name,text]of[['forward.sql',forward],['inverse.sql',inverse]])fs.writeFileSync(path.join(output,'pg'+major+'-'+name),text+'\n');}
  console.log(JSON.stringify({schemaVersion:'grouped-fixture-view-prototype-tests.v1',major,checks,originalMd5:sql.ORIGINAL,candidateMd5,constructedEdges:5145,constructedKeys:2586,fullRowsAndOverlayEqual:true,legacyDefaultsEqual:true,rightsAndFunctionsEqual:true,guardedInverseReapply:true,productionCalls:0,productionWrites:0,actualDeploymentAcceptance:false}));
 }finally{await db.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
