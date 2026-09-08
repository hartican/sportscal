#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
async function main(){
  if(!process.env.PGLITE_MODULE)throw new Error("Set PGLITE_MODULE to a local @electric-sql/pglite installation.");
  const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;");
  const migration=fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_live_fixture_snapshots.sql'));
  assert(migration,'live fixture migration exists');
  await db.exec(fs.readFileSync(`supabase/migrations/${migration}`,'utf8'));
  const token="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from public.nothingsports_fixture_sources"),/permission denied/);
  await assert.rejects(db.query("select * from public.nothingsports_claim_fixture_source('test',$1)",[token]),/permission denied/);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(db.query("insert into public.nothingsports_fixture_sources(source_id) values('test')"),/permission denied/);
  await db.exec("reset role; set role service_role");
  assert.equal((await db.query("select * from public.nothingsports_claim_fixture_source('test',$1)",[token])).rows.length,1);
  assert.equal((await db.query("select * from public.nothingsports_claim_fixture_source('test',$1)",[other])).rows.length,0,"a second invocation cannot obtain the lease");
  await assert.rejects(db.query("select public.nothingsports_publish_fixture_source('test',$1,'[{\"id\":\"fixture\"}]','hash',60000)",[other]),/Lease expired/);
  const first=await db.query("select public.nothingsports_publish_fixture_source('test',$1,'[{\"id\":\"fixture\"}]','hash',60000) as revision",[token]);
  assert.equal(first.rows[0].revision,1);
  await db.exec("update public.nothingsports_fixture_sources set next_due_at='-infinity'");
  await db.query("select * from public.nothingsports_claim_fixture_source('test',$1)",[other]);
  assert.equal((await db.query("select public.nothingsports_publish_fixture_source('test',$1,'[{\"id\":\"fixture\"}]','hash',60000) as revision",[other])).rows[0].revision,1,"unchanged content keeps its revision");
  await db.exec("update public.nothingsports_fixture_sources set next_due_at='-infinity'");
  await db.query("select * from public.nothingsports_claim_fixture_source('test',$1)",[token]);
  await db.query("select public.nothingsports_fail_fixture_source('test',$1,300000)",[token]);
  assert.equal((await db.query("select fixtures->0->>'id' as id from public.nothingsports_fixture_sources")).rows[0].id,"fixture");
  assert.equal((await db.query("select count(*)::integer as count from public.nothingsports_fixture_snapshots")).rows[0].count,1);
  const discovery=fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_discovery_source_health.sql'));
  if(discovery){
    await db.exec('reset role');await db.exec(fs.readFileSync(`supabase/migrations/${discovery}`,'utf8'));await db.exec('set role service_role');
    await db.query("select * from public.nothingsports_claim_fixture_source('discovery-empty',$1)",[token]);
    await db.query("select public.nothingsports_publish_fixture_source('discovery-empty',$1,'[]','empty',21600000)",[token]);
    const empty=await db.query("select jsonb_array_length(fixtures) as size,extract(epoch from next_due_at-checked_at)::integer as interval from public.nothingsports_fixture_sources where source_id='discovery-empty'");
    assert.equal(empty.rows[0].size,0);assert.equal(empty.rows[0].interval,21600,'six-hour discovery cadence is not silently clamped to one hour');
    await db.exec("update public.nothingsports_fixture_sources set next_due_at='-infinity' where source_id='discovery-empty'");
    await db.query("select * from public.nothingsports_claim_fixture_source('discovery-empty',$1)",[token]);
    await db.query("select public.nothingsports_publish_fixture_source_report('discovery-empty',$1,'[]','empty',21600000,'{\"cursor\":8,\"status\":\"checked\"}')",[token]);
    assert.equal((await db.query("select discovery_report->>'cursor' as cursor from public.nothingsports_fixture_sources where source_id='discovery-empty'")).rows[0].cursor,'8');
    await assert.rejects(db.query("select public.nothingsports_fail_fixture_source_report('discovery-empty',$1,21600000,'{\"cursor\":0}')",[other]),/Lease expired/,'a stale worker cannot overwrite discovery progress');
    await db.exec("update public.nothingsports_fixture_sources set next_due_at='-infinity'");
    await db.query("select * from public.nothingsports_claim_fixture_source('test',$1)",[token]);
    await assert.rejects(db.query("select public.nothingsports_publish_fixture_source('test',$1,'[]','empty',60000)",[token]),/Invalid snapshot/);
    await db.exec('reset role;set role anon');await assert.rejects(db.query('select discovery_report from public.nothingsports_fixture_sources'),/permission denied/);
  }
  await db.close();console.log("Postgres fixture store: anonymous/authenticated denial, service access, fenced leases, unchanged revisions, empty discovery and failed-source preservation passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
