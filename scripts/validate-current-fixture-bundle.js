'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures');
(async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;");
  for(const name of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260914061506_right_size_fixture_runtime.sql','utf8').split('-- One write replaces')[0]);
  for(const name of ['20260924104317_compact_live_scores.sql','20261002171936_preserve_compact_fixture_observations.sql','20261006182007_bound_current_fixture_snapshot.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values ('a-calendar'),('z-current');");
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const events=Array.from({length:1200},(_,i)=>({id:'fixture:'+i,status:'scheduled',date:day}));events.push({id:'late-current',key:'tennis',status:'live',date:day},{id:'expired-history',status:'completed',date:'2020-01-01'},{id:'old-live-uncertain',status:'live',date:'2020-01-01'},{id:'unknown-date',status:'scheduled'},{id:'future-outside-horizon',status:'scheduled',date:'2099-01-01'});
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select case when e->>'id' like 'fixture:%' then 'a-calendar' else 'z-current' end,e->>'id',e,array[e->>'id'],md5(e::text) from jsonb_array_elements($1::jsonb) e",[JSON.stringify(events)]);
  await db.exec('set role service_role');let calls=[];
  const request=async(route,{body})=>{calls.push(route);const name=route.split('/').at(-1),rows=(await db.query(`select * from public.${name}(${body.p_fixture_ids!==undefined?'$1':''})`,body.p_fixture_ids!==undefined?[body.p_fixture_ids]:[])).rows;return name==='nothingsports_read_current_fixture_bundle'?rows[0][name]:rows.slice(0,1000);};
  const store=createSnapshotStore({request}),global=await store.read(),all=global.flatMap(s=>s.fixtures);
  assert.equal(calls.length,2,'The global read preserves the two-query budget');assert.equal(all.length,1203);assert(all.some(e=>e.id==='late-current'),'A later source survives the transport row ceiling');assert(!all.some(e=>e.id==='expired-history'));assert(!all.some(e=>e.id==='future-outside-horizon'));assert(all.some(e=>e.id==='old-live-uncertain'),'Explicit unresolved play retains the existing active-timeline rule');assert(all.some(e=>e.id==='unknown-date'),'Unknown dates are not deleted');
  calls=[];const selected=await store.read({ids:['expired-history']});assert.equal(calls.length,2);assert(selected.flatMap(s=>s.fixtures).some(e=>e.id==='expired-history'),'Explicit selected-ID reads retain archived/source context');assert(calls.some(r=>r.endsWith('nothingsports_read_current_fixtures')));
  const healthy=await readLiveSnapshots({store,now:Date.now(),maxAgeMs:0});const badStore=createSnapshotStore({request:async(route)=>route.endsWith('bundle')?{schemaVersion:'current-fixture-bundle.v1',complete:false,rows:[]}:[]});const retained=await readLiveSnapshots({store:badStore,now:Date.now()+1,maxAgeMs:0});assert(retained.stale);assert.equal(retained.revision,healthy.revision,'Incomplete bundles keep the last-good shared snapshot');
  await db.exec('reset role');assert.equal((await db.query("select has_function_privilege('anon','public.nothingsports_read_current_fixture_bundle(text[])','execute') as allowed")).rows[0].allowed,false);assert.equal((await db.query("select count(*) as n from public.nothingsports_fixture_current")).rows[0].n,1205,'Read filtering preserves stored history');
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'a-calendar','overflow:'||i,jsonb_build_object('id','overflow:'||i,'date',$1::text,'status','scheduled'),array['overflow:'||i],'test' from generate_series(1,4200) i",[day]);const overflow=(await db.query('select public.nothingsports_read_current_fixture_bundle(null) as value')).rows[0].value;assert.equal(overflow.complete,false);assert.equal(overflow.rows.length,5001,'Oversized input is explicitly incomplete, never a silently truncated success');
  console.log('Complete bounded global fixture transfer beyond 1000 rows, two-read budget, retention/explicit IDs, degraded fallback and service-only access passed.');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
