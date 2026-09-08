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
  await db.close();console.log("Postgres fixture store: anonymous/authenticated denial, service access, fenced leases, unchanged revisions and failed-source preservation passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
