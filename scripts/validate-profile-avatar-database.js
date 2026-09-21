#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text);
 create table public.nothingsports_nsc_profiles(user_id uuid primary key references auth.users(id) on delete cascade,visibility text default 'visible',avatar_url text,updated_at timestamptz);
 grant usage on schema public,auth,storage to service_role;grant all on public.nothingsports_nsc_profiles to service_role;`);
 await db.exec(fs.readFileSync('supabase/migrations/20260921133117_profile_picture_privacy.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260921134048_avatar_upload_cleanup_retention.sql','utf8'));
 const user='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333',c='44444444-4444-4444-8444-444444444444';
 await db.query('insert into auth.users values($1)',[user]);await db.query('insert into nothingsports_nsc_profiles(user_id) values($1)',[user]);
 await db.exec('set role service_role');
 async function prepare(id,base=null){
  await db.query("insert into nothingsports_avatar_uploads(upload_id,user_id,base_version,byte_size,original_path,status) values($1,$2,$3,200,$4,'processing')",[id,user,base,`${user}/${id}`]);
  for(const bucket of ['nothingsports-avatar-originals','nothingsports-avatar-thumbnails','nothingsports-avatar-expanded'])await db.query("insert into nothingsports_avatar_cleanup(bucket,object_path,not_before) values($1,$2,now()+interval '1 day')",[bucket,`${user}/${id}${bucket.endsWith('originals')?'':'.webp'}`]);
 }
 const publish=id=>db.query('select nothingsports_publish_avatar($1,$2,12000,90000,$3) result',[user,id,`https://example.com/${id}.webp`]);
 await prepare(a);await prepare(b);assert.equal((await publish(a)).rows[0].result,true);
 await assert.rejects(publish(b),/avatar_changed_retry/);
 assert.equal((await db.query('select version from nothingsports_avatar_assets')).rows[0].version,a);
 assert.equal((await publish(a)).rows[0].result,true,'retry after lost response is idempotent');
 assert.equal((await db.query('select count(*) n from nothingsports_avatar_cleanup where object_path=$1',[`${user}/${a}.webp`])).rows[0].n,0,'active derivatives never queued for deletion');
 await prepare(c,a);await publish(c);
 assert.equal((await db.query('select count(*) n from nothingsports_avatar_cleanup where object_path=$1 and not_before<=now()',[`${user}/${a}.webp`])).rows[0].n,2,'old versions queued atomically');
 await db.query("update nothingsports_nsc_profiles set visibility='deleted' where user_id=$1",[user]);
 assert.equal((await db.query('select avatar_url from nothingsports_nsc_profiles')).rows[0].avatar_url,null);
 assert.equal((await db.query('select count(*) n from nothingsports_avatar_assets')).rows[0].n,0);
 assert.equal((await db.query('select count(*) n from nothingsports_avatar_cleanup where object_path=$1',[`${user}/${c}.webp`])).rows[0].n,2);
 await db.exec('reset role;set role anon');
 for(const table of ['assets','uploads','cleanup'])await assert.rejects(db.query(`select * from nothingsports_avatar_${table}`),/permission denied/);
 await assert.rejects(publish(a),/permission denied/);
 await db.exec('reset role;set role authenticated');await assert.rejects(publish(a),/permission denied/);
 await db.close();console.log('Avatar database: atomic publication, concurrent-save conflict, idempotency, cleanup, deletion and private-table access passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
