#!/usr/bin/env node
'use strict';
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
const owner='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002';
async function main(){
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key);
   create table public.owned(user_id uuid primary key references auth.users on delete cascade,value text);
   create table public.shared(id int primary key,creator uuid references auth.users on delete set null,editor uuid references auth.users on delete set null,value text);
   grant usage on schema auth to service_role;
   grant all on public.owned,public.shared to service_role;`);
  await db.query('insert into auth.users values($1),($2)',[owner,peer]);
  await db.query("insert into public.owned values($1,'owner'),($2,'peer')",[owner,peer]);
  await db.query("insert into public.shared values(1,$1,$1,'shared')",[owner]);
  await db.exec('begin;'+fs.readFileSync('supabase/migrations/20260927144441_guard_account_erasure_writes.sql','utf8')+'commit;');
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
  await assert.rejects(()=>db.query("update public.owned set value='forbidden' where user_id=$1",[owner]),e=>e.code==='55000');
  await assert.rejects(()=>db.query("insert into public.shared values(2,$1,$2,'forbidden')",[owner,peer]),e=>e.code==='55000');
  await assert.rejects(()=>db.query("update public.shared set value='forbidden' where id=1"),e=>e.code==='55000');
  await db.query("update public.owned set value='peer still writes' where user_id=$1",[peer]);
  await db.exec('reset role;');
  await db.query('delete from auth.users where id=$1',[owner]);
  assert.deepEqual((await db.query('select creator,editor,value from public.shared')).rows,[{creator:null,editor:null,value:'shared'}]);
  assert.deepEqual((await db.query('select user_id,value from public.owned')).rows,[{user_id:peer,value:'peer still writes'}]);
  assert.equal((await db.query('select count(*)::int n from public.nothingsports_account_erasure_blocks')).rows[0].n,1,'barrier survives Auth removal');
  console.log('Erasure write barrier: role restrictions, rollback, retry, service-write rejection, peer preservation and multiple SET NULL attribution passed. Concurrent sessions and Storage are separate gates.');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
