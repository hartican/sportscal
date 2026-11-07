#!/usr/bin/env node
'use strict';
// Real Postgres constraints in an isolated WASM database. No credentials/network.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260927131800_preserve_shared_chat_after_account_erasure.sql'),'utf8');
const canonical=fs.readFileSync(path.join(root,'supabase/private-fixture-chat.sql'),'utf8');
const actor='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002';
async function main(){
 const db=new PGlite();
 try{
  await db.exec('create schema auth;create table auth.users(id uuid primary key);');
  // Use the repository schema, not simplified substitutes for constraint behaviour.
  for(const table of ['chat_rooms','chat_members','chat_messages']){
   const sql=canonical.match(new RegExp(`create table if not exists public.nothingsports_${table} \\([\\s\\S]*?\\n\\);`));
   assert(sql,`missing canonical ${table}`);await db.exec(sql[0]);
  }
  await db.query('insert into auth.users values ($1),($2)',[actor,peer]);
  const room=(await db.query(`insert into public.nothingsports_chat_rooms(canonical_fixture_id,fixture_snapshot,room_name,created_by) values('test-fixture','{}','Disposable room',$1) returning id`,[actor])).rows[0].id;
  await db.query('insert into public.nothingsports_chat_members(room_id,user_id,added_by) values($1,$2,$2),($1,$3,$2)',[room,actor,peer]);
  const original=(await db.query(`insert into public.nothingsports_chat_messages(room_id,sender_id,client_id,body) values($1,$2,'original-001','Requester content') returning id`,[room,actor])).rows[0].id;
  await db.query(`insert into public.nothingsports_chat_messages(room_id,sender_id,client_id,body,reply_to_message_id) values($1,$2,'reply-00001','Peer content',$3)`,[room,peer,original]);
  await assert.rejects(()=>db.query('delete from auth.users where id=$1',[actor]),e=>['23001','23503'].includes(e.code));
  await db.exec('begin;'+migration+'commit;');
  await assert.rejects(()=>db.query('delete from auth.users where id=$1',[actor]),e=>['23001','23503'].includes(e.code)&&e.constraint==='nothingsports_chat_messages_sender_id_fkey');
  // An interrupted SQL cleanup must roll back both content and attribution changes.
  await db.exec('begin;');
  await db.query('delete from public.nothingsports_chat_messages where sender_id=$1',[actor]);
  await db.query('delete from auth.users where id=$1',[actor]);
  await assert.rejects(()=>db.exec('select 1/0;'),e=>e.code==='22012');
  await db.exec('rollback;');
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int n from public.nothingsports_chat_messages')).rows[0].n,2);
  // Retry the ordered SQL portion, then retry once more to prove idempotence.
  for(let i=0;i<2;i++){
   await db.exec('begin;');
   await db.query('delete from public.nothingsports_chat_messages where sender_id=$1',[actor]);
   await db.query('delete from auth.users where id=$1',[actor]);
   await db.exec('commit;');
  }
  assert.deepEqual((await db.query('select id from auth.users')).rows,[{id:peer}]);
  assert.deepEqual((await db.query('select id,created_by from public.nothingsports_chat_rooms')).rows,[{id:room,created_by:null}]);
  assert.deepEqual((await db.query('select user_id,added_by from public.nothingsports_chat_members')).rows,[{user_id:peer,added_by:null}]);
  assert.deepEqual((await db.query('select sender_id,body,reply_to_message_id from public.nothingsports_chat_messages')).rows,[{sender_id:peer,body:'Peer content',reply_to_message_id:null}]);
  console.log('Chat database rehearsal passed: message safeguard, rollback, retry, retained room, peer membership and reply. Auth service, Storage, sessions and RLS are outside this rehearsal.');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
