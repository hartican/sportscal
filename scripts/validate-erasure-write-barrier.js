#!/usr/bin/env node
'use strict';
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
const owner='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002';
async function main(){
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,raw_app_meta_data jsonb);
   create table public.owned(user_id uuid primary key references auth.users on delete cascade,value text);
   create table public.shared(id int primary key,creator uuid references auth.users on delete set null,editor uuid references auth.users on delete set null,value text);
   grant usage on schema auth to service_role;
   grant all on public.owned,public.shared to service_role;`);
  await db.query('insert into auth.users(id) values($1),($2)',[owner,peer]);
  await db.query("insert into public.owned values($1,'owner'),($2,'peer')",[owner,peer]);
  await db.query("insert into public.shared values(1,$1,$1,'shared')",[owner]);
  await db.exec('begin;'+fs.readFileSync('supabase/migrations/20260927144441_guard_account_erasure_writes.sql','utf8')+'commit;');
  await db.exec('begin;'+fs.readFileSync('supabase/migrations/20260927150138_mark_erasure_in_auth_metadata.sql','utf8')+'commit;');
  const currentGuard=fs.readFileSync('supabase/migrations/20260927164938_redact_erased_account_audit_snapshots.sql','utf8').split('create function private.nothingsports_redact_detached_audit_subject()')[0];
  await db.exec('begin;'+currentGuard+'commit;');
  // Reproduce the actual migration order: these two tables arrived after the
  // original blanket guard. Read their real DDL without running any backfill.
  const reminderSchema=fs.readFileSync('supabase/migrations/20261002081559_global_fixture_reminders.sql','utf8');
  const reminderTables=['nothingsports_reminder_intents','nothingsports_reminder_account_checks'];
  for(const table of reminderTables){
   const statement=reminderSchema.match(new RegExp('create table public\\.'+table+'\\([\\s\\S]*?\\);'))?.[0];
   assert(statement,'Actual reminder table DDL must be available');await db.exec(statement);
  }
  await db.exec('grant all on public.nothingsports_reminder_intents,public.nothingsports_reminder_account_checks to service_role;');
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select public.nothingsports_begin_account_erasure($1)',[owner]),e=>e.code==='42501');
  await assert.rejects(()=>db.query('select * from public.nothingsports_account_erasure_blocks'),e=>e.code==='42501');
  await db.exec('reset role;set role service_role;');
  await db.exec('begin;');
  await db.query('select public.nothingsports_begin_account_erasure($1)',[owner]);
  await db.exec('rollback;');
  await db.query("update public.owned set value='rollback preserved' where user_id=$1",[owner]);
  await db.exec('begin isolation level repeatable read;');
  await assert.rejects(()=>db.query("update public.owned set value='stale snapshot' where user_id=$1",[owner]),e=>e.code==='25000');
  await db.exec('rollback;');
  const begin=()=>db.query('select public.nothingsports_begin_account_erasure($1) as started',[owner]);
  const first=(await begin()).rows[0].started;
  assert.deepEqual((await begin()).rows[0].started,first,'begin is idempotent');
  // Before repair, even a service write after the committed freeze succeeds.
  await db.query("insert into public.nothingsports_reminder_intents(user_id,fixture_id,choice,enabled) values($1,'qa-existing','off',false),($2,'qa-existing','off',false)",[owner,peer]);
  await db.query("insert into public.nothingsports_reminder_account_checks values($1,'2026-09-28T00:00:00Z'),($2,'2026-09-28T00:00:00Z')",[owner,peer]);
  const reminderState=async()=>({intents:(await db.query('select * from public.nothingsports_reminder_intents order by user_id,fixture_id')).rows,checks:(await db.query('select * from public.nothingsports_reminder_account_checks order by user_id')).rows});
  const beforeGuard=await reminderState();
  await db.exec('reset role;begin;'+fs.readFileSync('supabase/migrations/20261003184156_guard_reminder_intent_erasure_writes.sql','utf8')+'commit;set role service_role;');
  assert.deepEqual(await reminderState(),beforeGuard,'Installing guards must not edit intent, OFF, clock or peer state');
  const guardBindings=(await db.query("select c.relname,t.tgtype,t.tgenabled,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname=any($1) and t.tgfoid='private.nothingsports_guard_erasure_write()'::regprocedure order by c.relname",[reminderTables])).rows;
  assert.equal(guardBindings.length,2);for(const binding of guardBindings){assert.equal(binding.tgtype,21);assert.equal(binding.tgenabled,'O');assert(binding.definition.includes("('user_id')"));}
  for(const sql of [
   "insert into public.nothingsports_reminder_intents(user_id,fixture_id,choice,enabled) values($1,'qa-new','on',true)",
   "update public.nothingsports_reminder_intents set choice='on',enabled=true where user_id=$1",
   "insert into public.nothingsports_reminder_intents(user_id,fixture_id,choice) values($1,'qa-existing','on') on conflict(user_id,fixture_id) do update set choice=excluded.choice",
   "update public.nothingsports_reminder_account_checks set checked_at=clock_timestamp() where user_id=$1",
   "insert into public.nothingsports_reminder_account_checks values($1,clock_timestamp()) on conflict(user_id) do update set checked_at=excluded.checked_at",
  ])await assert.rejects(()=>db.query(sql,[owner]),e=>e.code==='55000'&&e.message.includes('account_erasure_in_progress'));
  await db.exec('begin;');
  await db.query('delete from public.nothingsports_reminder_account_checks where user_id=$1',[owner]);
  await assert.rejects(()=>db.query('insert into public.nothingsports_reminder_account_checks values($1,clock_timestamp())',[owner]),e=>e.code==='55000');
  await db.exec('rollback;');
  assert.deepEqual(await reminderState(),beforeGuard,'Every rejected write must roll back');
  await db.query("insert into public.nothingsports_reminder_intents(user_id,fixture_id,choice,enabled) values($1,'qa-peer-new','on',true)",[peer]);
  await db.query("update public.nothingsports_reminder_account_checks set checked_at='2026-09-28T00:01:00Z' where user_id=$1",[peer]);
  const peerState=await reminderState();
  await assert.rejects(()=>db.query("update public.owned set value='forbidden' where user_id=$1",[owner]),e=>e.code==='55000');
  await assert.rejects(()=>db.query("insert into public.shared values(2,$1,$2,'forbidden')",[owner,peer]),e=>e.code==='55000');
  await assert.rejects(()=>db.query("update public.shared set value='forbidden' where id=1"),e=>e.code==='55000');
  await db.query("update public.owned set value='peer still writes' where user_id=$1",[peer]);
  await db.exec('reset role;');
  assert((await db.query('select raw_app_meta_data from auth.users where id=$1',[owner])).rows[0].raw_app_meta_data.nothingsport_erasure_started_at);
  await db.query('delete from auth.users where id=$1',[owner]);
  assert.deepEqual((await db.query('select creator,editor,value from public.shared')).rows,[{creator:null,editor:null,value:'shared'}]);
  assert.deepEqual((await db.query('select user_id,value from public.owned')).rows,[{user_id:peer,value:'peer still writes'}]);
  assert.equal((await db.query('select count(*)::int n from public.nothingsports_account_erasure_blocks')).rows[0].n,1,'barrier survives Auth removal');
  const afterDelete=await reminderState();
  assert.deepEqual(afterDelete.intents,peerState.intents.filter(row=>row.user_id===peer));
  assert.deepEqual(afterDelete.checks,peerState.checks.filter(row=>row.user_id===peer));
  console.log('Later reminder tables: reproduced unguarded writes, applied actual guard migration, rejected six frozen-account writes, preserved OFF/clock/peer state and verified Auth cascade in isolated SQL. No live accounts changed.');
  console.log('Erasure write barrier: role restrictions, rollback, retry, service-write rejection, peer preservation and multiple SET NULL attribution passed. Concurrent sessions and Storage are separate gates.');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
