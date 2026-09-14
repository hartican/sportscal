#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const {PGlite}=require("@electric-sql/pglite");

(async()=>{
  const db=new PGlite();
  const token="11111111-1111-4111-8111-111111111111";
  const user="22222222-2222-4222-8222-222222222222";
  try{
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); grant usage on schema public to anon,authenticated,service_role;");
    await db.exec(fs.readFileSync("supabase/migrations/20260908093906_live_fixture_snapshots.sql","utf8"));
    await db.exec(fs.readFileSync("supabase/migrations/20260908110529_discovery_source_health.sql","utf8"));
    await db.exec(`
      create table public.nothingsports_nsc_presence(
        event_id text not null,user_id uuid not null references auth.users(id),watching_started_at timestamptz not null default now(),last_heartbeat_at timestamptz not null default now(),heartbeat_count integer not null default 1,primary key(event_id,user_id)
      );
      create table public.nothingsports_live_rating_alerts(
        id uuid primary key default gen_random_uuid(),recipient_user_id uuid,event_id text,created_at timestamptz default now(),ready_at timestamptz not null default (now()+interval '60 seconds'),completed_at timestamptz
      );
      create table public.nothingsports_reminders(
        id uuid primary key default gen_random_uuid(),installation_id uuid,user_id uuid,event_id text,title text,starts_at timestamptz,remind_at timestamptz,viewing_url text,fallback_to_broadcast boolean default false,dispatched_at timestamptz,claimed_at timestamptz,attempts integer default 0,last_error text,created_at timestamptz default now(),updated_at timestamptz default now(),delivery_mode text default 'match-15'
      );
      insert into auth.users values('${user}');
      insert into public.nothingsports_fixture_sources(source_id,revision,fixtures,content_hash,checked_at,next_due_at)
      values('f1',1,'[{"id":"race","eventId":"event-race","status":"scheduled"}]','old-hash','2026-09-14T00:00:00Z','-infinity');
    `);
    await db.exec(fs.readFileSync("supabase/migrations/20260914061506_right_size_fixture_runtime.sql","utf8"));

    await db.exec("set role service_role");
    let rows=(await db.query("select fixture_id,fixture->>'status' as status from public.nothingsports_read_current_fixtures(array['event-race'])")).rows;
    assert.deepEqual(rows,[{fixture_id:"race",status:"scheduled"}],"legacy source rows backfill into the bounded current projection");

    await db.query("select * from public.nothingsports_claim_fixture_source('f1',$1)",[token]);
    const unchanged=await db.query("select public.nothingsports_publish_fixture_source('f1',$1,'[{\"id\":\"race\",\"eventId\":\"event-race\",\"status\":\"scheduled\"}]','old-hash',1800000) as revision",[token]);
    assert.equal(unchanged.rows[0].revision,1);
    assert.equal((await db.query("select count(*)::integer as count from public.nothingsports_fixture_snapshots")).rows[0].count,0,"unchanged facts create no history write");

    await db.exec("update public.nothingsports_fixture_sources set next_due_at='-infinity' where source_id='f1'");
    await db.query("select * from public.nothingsports_claim_fixture_source('f1',$1)",[token]);
    await db.query("select public.nothingsports_publish_fixture_source('f1',$1,'[{\"id\":\"race\",\"eventId\":\"event-race\",\"status\":\"live\"}]','new-hash',120000)",[token]);
    assert.equal((await db.query("select fixture->>'status' as status from public.nothingsports_fixture_current where fixture_id='race'")).rows[0].status,"live");

    assert.equal((await db.query("select heartbeat_count from public.nothingsports_record_watching_heartbeat('race',$1,'2026-09-14T00:00:00Z')",[user])).rows[0].heartbeat_count,1);
    assert.equal((await db.query("select heartbeat_count from public.nothingsports_record_watching_heartbeat('race',$1,'2026-09-14T00:01:00Z')",[user])).rows[0].heartbeat_count,2);

    await db.exec("insert into public.nothingsports_reminders(installation_id,event_id,title,starts_at,remind_at) values(gen_random_uuid(),'due','Due','2026-09-14T01:00:00Z','2026-09-14T00:00:00Z'),(gen_random_uuid(),'later','Later','2026-09-15T01:00:00Z','2026-09-15T00:00:00Z')");
    rows=(await db.query("select event_id from public.nothingsports_claim_due_reminders('2026-09-14T00:05:00Z','2026-09-13T23:00:00Z','2026-09-13T22:00:00Z',100)")).rows;
    assert.deepEqual(rows,[{event_id:"due"}],"one RPC claims only due reminders");

    await db.exec("reset role");
    const alert=(await db.query("insert into public.nothingsports_live_rating_alerts(recipient_user_id,event_id) values($1,'race') returning extract(epoch from ready_at-created_at)::integer as delay",[user])).rows[0];
    assert.equal(alert.delay,300,"EPIC alerts group for five minutes");

    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.nothingsports_fixture_current"),/permission denied/);
    await assert.rejects(db.query("select * from public.nothingsports_read_current_fixtures(null)"),/permission denied/);
    console.log("Backend database efficiency: backfill, bounded reads, no-op publishing, heartbeats, reminder batching and RLS passed.");
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
