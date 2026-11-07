#!/usr/bin/env node
'use strict';
// Isolated real database/schema proof; never connects to production.
const fs=require('node:fs'),assert=require('node:assert/strict');
const view='public.nothingsports_current_global_fixture_bundle';
const migration=fs.readFileSync('supabase/migrations/20261021102641_restore_direct_global_calendar_admission.sql','utf8');
const undo=fs.readFileSync('scripts/sql/rollback-global-direct-calendar.sql','utf8');
(async()=>{
 const db=await require('./fixture-read-test-baseline').database();
 try{
  const report={schemaVersion:'global-direct-calendar.v1',productionCalls:0,checks:[]};
  const check=name=>report.checks.push(name);
  assert(!fs.readdirSync('supabase/migrations').some(n=>/_prepare_global_encoded_fixture_rows.sql$|_activate_global_encoded_fixture_rows.sql$/.test(n)),'A fresh migration chain must not apply the superseded cache experiment');
  check('superseded unshipped cache migrations cannot run on fresh installation');
  report.engine=(await db.query("select current_setting('server_version_num') n")).rows[0].n;
  const original=(await db.query('select pg_get_viewdef($1::regclass,true) sql',[view])).rows[0].sql;
  await db.exec('create view public.qa_direct_calendar_original with(security_invoker=true) as '+original);
  const contracts=async()=>(await db.query("select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'def',pg_get_functiondef(p.oid),'acl',p.proacl::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nothingsports_fixture_read_private' or (n.nspname='public' and p.proname like 'nothingsports_%')),'triggers',(select jsonb_agg(jsonb_build_object('oid',t.oid,'def',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)) from pg_trigger t where not t.tgisinternal),'view',(select jsonb_build_object('owner',relowner,'acl',relacl::text,'options',reloptions) from pg_class where oid=$1::regclass)) c",[view])).rows[0].c;
  const before=await contracts();
  const equal=async()=>assert.equal((await db.query('select (select bundle::jsonb from '+view+')=(select bundle::jsonb from public.qa_direct_calendar_original) same')).rows[0].same,true,'Complete ordered facts and original observations must remain equal');
  for(const change of ['grant select on '+view+' to anon','alter view '+view+' set(security_invoker=false)','create or replace view '+view+" as select '{}'::json bundle"]){
   await db.exec('begin;'+change);await assert.rejects(db.exec(migration),/requires/);await db.exec('rollback;');
  }
  check('wrong view or weakened rights refuse installation atomically');
  if(process.env.NS_DIRECT_CALENDAR_BEFORE!=='1')await db.exec('begin;'+migration+'commit;');
  const frame='with pgrst_source as(select bundle from '+view+' limit 1000 offset 0)select count(t),coalesce(json_agg(t),\'[]\'::json)body from(select * from pgrst_source)t';
  const plan=async()=>(await db.query('explain(analyze,buffers,format json,timing off) '+frame)).rows[0]['QUERY PLAN'][0];
  const noDescriptors=p=>{
   const visit=n=>{assert.notEqual(n['Relation Name'],'fixture_context','Global reads must avoid the measured descriptor scan');assert.notEqual(n['Subplan Name'],'CTE calendar_windows','Global reads must avoid rebuilding calendar descriptors');for(const c of n.Plans||[])visit(c);};visit(p.Plan);
  };
  noDescriptors(await plan());check('actual framed plan removes descriptor scan and shape processing');
  await equal();check('empty bundle remains one complete ordered response');
  const today=(await db.query("select (statement_timestamp() at time zone 'Australia/Sydney')::date::text d")).rows[0].d;
  const fixtures=require('../lib/calendar-catalogue').catalogue().slice(0,1205).map((e,i)=>({...e,id:'qa-direct:'+i,date:today,status:'scheduled'}));
  fixtures.push({id:'qa-direct:zero',date:today,status:'scheduled',homeScore:9,awayScore:9,scoreCheckedAt:'2026-10-01T00:00:00Z'},
   {id:'qa-direct:unknown',date:null,status:'scheduled'},
   {id:'qa-direct:outside',date:'2099-01-01',status:'scheduled'},
   {id:'qa-direct:old-live',date:'2020-01-01',status:'live'},
   {id:'qa-direct:withdrawn-date',date:'2099-01-01',status:'scheduled'});
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('qa-direct');");
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash)select 'qa-direct',f->>'id',f,array[f->>'id','alias:'||(f->>'id')],f->>'id' from jsonb_array_elements($1::jsonb)f",[JSON.stringify(fixtures)]);
  await db.exec("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash)values('qa-direct','qa-direct:zero','{\"status\":\"completed\",\"homeScore\":0,\"awayScore\":0,\"scoreCheckedAt\":\"2026-10-01T01:00:00Z\"}','zero'),('qa-direct','qa-direct:withdrawn-date','{\"date\":null}','null-date');update public.nothingsports_fixture_sources set discovery_report='{\"_fixtureObservations\":{\"qa-direct:zero\":{\"s\":\"2026-10-01T02:00:00Z\",\"t\":\"2026-10-01T02:00:00Z\"}}}' where source_id='qa-direct';");
  await equal();check('over 1000 fixtures retain complete facts, aliases, original clocks and explicit null precedence');
  noDescriptors(await plan());
  await db.exec('begin;create or replace view '+view+' with(security_invoker=true) as '+original);
  await assert.rejects((async()=>noDescriptors(await plan()))(),/descriptor/);await equal();await db.exec('rollback;');
  check('restoring the actual rejected descriptor view fails the work regression');
  const calls=[],load=async(route)=>{
   calls.push(route);if(route.endsWith('?select=bundle'))return(await db.query('select bundle from '+view)).rows;
   assert(route.endsWith('/nothingsports_read_fixture_source_health'));return(await db.query('select * from public.nothingsports_read_fixture_source_health()')).rows;
  };
  await db.exec('set role service_role');
  const rows=await require('./lib/semantic-snapshot-read')({load,resources:[{route:'/rest/v1/rpc/nothingsports_read_fixture_source_health',body:{}},{route:'/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle'}]});
  await db.exec('reset role');
  assert.equal(calls.length,2);const facts=rows.flatMap(s=>s.fixtures),zero=facts.find(f=>f.id==='qa-direct:zero');
  assert.equal(zero.homeScore,0);assert.equal(zero.awayScore,0);assert.equal(Date.parse(zero.scoreFactObservedAt),Date.parse('2026-10-01T01:00:00Z'));assert.equal(Date.parse(zero.scoreCheckedAt),Date.parse('2026-10-01T02:00:00Z'));
  assert(facts.some(f=>f.id==='qa-direct:withdrawn-date'));assert(!facts.some(f=>f.id==='qa-direct:outside'));assert(facts.some(f=>f.id==='qa-direct:old-live'));
  check('actual service-role store retains zero scores, observations, complete membership and two requests');
  await db.exec("update public.nothingsports_fixture_current set fixture=fixture||'{\"date\":\"2099-01-01\",\"status\":\"scheduled\"}'::jsonb where fixture_id='qa-direct:old-live';delete from public.nothingsports_live_scores where fixture_id='qa-direct:withdrawn-date';");await equal();
  check('canonical reschedule and score deletion immediately affect the same snapshot');
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select bundle from '+view),/permission denied/);await db.exec('reset role');}
  check('public and signed-in roles cannot read privileged fixture view');
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('qa-overflow');insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash)select 'qa-overflow','overflow:'||n,jsonb_build_object('id','overflow:'||n,'status','live'),array['overflow:'||n],'overflow:'||n from generate_series(1,5001)n;");
  await equal();const overflow=(await db.query('select bundle from '+view)).rows[0].bundle;assert.equal(overflow.complete,false);assert.equal(overflow.rows.length,5001);check('5001 overflow signal cannot conceal omitted membership');
  assert.deepEqual(await contracts(),before);check('all functions, writers, triggers and view rights remain byte-identical');
  report.activeDigest=(await db.query('select md5(pg_get_viewdef($1::regclass,true)) h',[view])).rows[0].h;
  await db.exec('begin;'+undo+'commit;');assert.equal((await db.query('select md5(pg_get_viewdef($1::regclass,true)) h',[view])).rows[0].h,'fbc28299a5bf25428b286adc5ee2e0da');await equal();assert.deepEqual(await contracts(),before);check('committed exact undo retains subsequent canonical changes and original rights');
  console.log(JSON.stringify(report));
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
