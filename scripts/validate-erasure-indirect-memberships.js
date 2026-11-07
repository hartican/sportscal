#!/usr/bin/env node
'use strict';
const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs'),assert=require('node:assert/strict');
const owner='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002',unverified='00000000-0000-4000-8000-000000000003';
async function main(){const db=new PGlite();try{
 await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table nothingsports_account_erasure_blocks(user_id uuid primary key);
 create table nothingsports_nsc_reward_campaigns(id text primary key,eligible_user_ids uuid[] not null);
 create table nothingsports_marquee_subscribers(email_normalized text primary key,suppressed_at timestamptz);`);
 await db.query("insert into auth.users values($1,'Owner@Example.invalid',now()),($2,'peer@example.invalid',now()),($3,'unverified@example.invalid',null)",[owner,peer,unverified]);
 await db.query('insert into nothingsports_nsc_reward_campaigns values($1,$2)', ['qa',[owner,peer,owner]]);
 await db.exec("insert into nothingsports_marquee_subscribers values('owner@example.invalid',null),('peer@example.invalid',now()),('unverified@example.invalid',null)");
 await db.exec('begin');await db.query('delete from auth.users where id=$1',[owner]);assert.equal((await db.query('select cardinality(eligible_user_ids) n from nothingsports_nsc_reward_campaigns')).rows[0].n,3);assert.equal((await db.query('select count(*) n from nothingsports_marquee_subscribers')).rows[0].n,3);await db.exec('rollback');
 await db.exec(fs.readFileSync('supabase/migrations/20260927165945_erase_indirect_account_memberships.sql','utf8'));
 await db.query('insert into nothingsports_account_erasure_blocks values($1)',[owner]);
 await assert.rejects(()=>db.query('insert into nothingsports_nsc_reward_campaigns values($1,$2)',['blocked',[owner]]),/account_erasure_in_progress/);
 await assert.rejects(()=>db.exec("update nothingsports_marquee_subscribers set suppressed_at=now() where email_normalized='owner@example.invalid'"),/account_erasure_in_progress/);
 await db.exec('begin');await db.query('delete from auth.users where id=$1',[owner]);await db.exec('rollback');
 assert.equal((await db.query('select cardinality(eligible_user_ids) n from nothingsports_nsc_reward_campaigns')).rows[0].n,3);
 await db.query('delete from auth.users where id=$1',[owner]);await db.query('delete from auth.users where id=$1',[owner]);
 assert.deepEqual((await db.query('select eligible_user_ids from nothingsports_nsc_reward_campaigns')).rows[0].eligible_user_ids,[peer]);
 assert.deepEqual((await db.query('select email_normalized from nothingsports_marquee_subscribers order by 1')).rows.map(r=>r.email_normalized),['peer@example.invalid','unverified@example.invalid']);
 await assert.rejects(()=>db.query('insert into nothingsports_nsc_reward_campaigns values($1,$2)',['missing',[owner]]),/reward_account_missing/);
 await db.query('delete from auth.users where id=$1',[unverified]);assert.equal((await db.query("select count(*) n from nothingsports_marquee_subscribers where email_normalized='unverified@example.invalid'")).rows[0].n,1,'Unverified address does not establish ownership');
 assert((await db.query("select suppressed_at from nothingsports_marquee_subscribers where email_normalized='peer@example.invalid'")).rows[0].suppressed_at,'Peer suppression remains intact');
 console.log('Indirect erasure: original leftovers reproduced; duplicate IDs, verified email, rollback/retry, frozen links, absent accounts and peer/unverified preservation passed.');
}finally{await db.close();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
