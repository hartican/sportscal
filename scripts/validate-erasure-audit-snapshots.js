#!/usr/bin/env node
'use strict';
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
const owner='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002';
async function main(){const db=new PGlite();try{
 await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role bypassrls;
 create table auth.users(id uuid primary key);
 create table nothingsports_nsc_admin_audit(audit_id text primary key,actor_user_id uuid references auth.users on delete set null,target_user_id uuid references auth.users on delete set null,action text,created_at timestamptz default now(),before_state jsonb,after_state jsonb);`);
 await db.query('insert into auth.users values($1),($2)',[owner,peer]);
 await db.query(`insert into nothingsports_nsc_admin_audit(audit_id,actor_user_id,target_user_id,action,before_state,after_state) values
 ('owner',$2,$1,'hide-profile','{"status":"open","resolution":"owner-private"}','{"status":"dismissed","resolution":"owner-private"}'),
 ('peer',$1,$2,'hide-profile','{"status":"open","resolution":"peer"}','{"status":"dismissed","resolution":"peer"}'),
 ('self',$1,$1,'hide-profile','{"status":"open","resolution":"owner-private"}','{}')`,[owner,peer]);
 await db.exec(fs.readFileSync('supabase/migrations/20260927144441_guard_account_erasure_writes.sql','utf8'));
 await db.exec('begin');await db.query('delete from auth.users where id=$1',[owner]);
 assert.equal((await db.query("select before_state from nothingsports_nsc_admin_audit where audit_id='owner'")).rows[0].before_state.resolution,'owner-private','Original cascade leaves copied personal state');await db.exec('rollback');
 await db.exec(fs.readFileSync('supabase/migrations/20260927164938_redact_erased_account_audit_snapshots.sql','utf8'));
 await db.query('select nothingsports_begin_account_erasure($1)',[owner]);
 await assert.rejects(()=>db.exec("update nothingsports_nsc_admin_audit set action='other' where audit_id='owner'"),/account_erasure_in_progress/);
 await assert.rejects(()=>db.exec("update nothingsports_nsc_admin_audit set target_user_id=null,action='other' where audit_id='self'"),/account_erasure_in_progress/);
 await db.exec('begin');await db.query('delete from auth.users where id=$1',[owner]);await db.exec('rollback');
 assert.equal((await db.query("select before_state from nothingsports_nsc_admin_audit where audit_id='owner'")).rows[0].before_state.resolution,'owner-private','Rollback restores state and identity together');
 await db.query('delete from auth.users where id=$1',[owner]);await db.query('delete from auth.users where id=$1',[owner]);
 const rows=(await db.query('select * from nothingsports_nsc_admin_audit order by audit_id')).rows;
 assert.equal(rows.length,3);
 for(const row of rows){assert.equal(row.action,'hide-profile');assert(row.created_at);if(row.audit_id==='peer'){assert.equal(row.target_user_id,peer);assert.equal(row.actor_user_id,null);assert.equal(row.before_state.resolution,'peer');}else{assert.equal(row.target_user_id,null);assert.deepEqual(row.before_state,{});assert.deepEqual(row.after_state,{});}}
 assert.equal(rows.find(r=>r.audit_id==='owner').actor_user_id,peer);
 console.log('Audit erasure: original retained snapshot reproduced; frozen subject redaction, rollback/retry, self-attribution and peer audit preservation passed.');
}finally{await db.close();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
