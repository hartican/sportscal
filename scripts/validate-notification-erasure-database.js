'use strict';
// Isolated PostgreSQL constraint proof: no credentials, network or real accounts.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const actor='00000000-0000-4000-8000-000000000011';
const peer='00000000-0000-4000-8000-000000000012';
const installs=['00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000023'];
(async()=>{
 const db=new PGlite();
 try{
  await db.exec('create schema auth; create table auth.users(id uuid primary key);');
  const canonical=fs.readFileSync(path.join(root,'supabase/follow-first-user-meta-and-notifications.sql'),'utf8');
  for(const table of ['push_installations','reminders']){
   const ddl=canonical.match(new RegExp(`create table if not exists public.nothingsports_${table} \\([\\s\\S]*?\\n\\);`));
   assert(ddl,`canonical ${table} definition required`);await db.exec(ddl[0]);
  }
  await db.query('insert into auth.users values ($1),($2)',[actor,peer]);
  for(let i=0;i<installs.length;i++)await db.query(`insert into public.nothingsports_push_installations(installation_id,user_id,secret_hash,endpoint,p256dh,auth_key) values($1,$2,$3,$4,'test','test')`,[installs[i],[actor,peer,null][i],'0'.repeat(64),`https://push.example.invalid/${i}`]);
  for(const [index,user,event] of [[0,actor,'own'],[0,null,'own-install-anonymous'],[1,actor,'old-account-on-reassigned-device'],[1,peer,'peer'],[2,null,'anonymous']]){
   await db.query(`insert into public.nothingsports_reminders(installation_id,user_id,event_id,title,starts_at,remind_at) values($1,$2,$3,'Disposable',now()+interval '2 days',now()+interval '1 day')`,[installs[index],user,event]);
  }
  // Reproduce the original defect, then restore the same populated fixture.
  await db.exec('begin');await db.query('delete from auth.users where id=$1',[actor]);
  assert.equal((await db.query('select count(*)::int n from public.nothingsports_reminders')).rows[0].n,5);
  await db.exec('rollback');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260927142249_remove_account_owned_notification_data_on_erasure.sql'),'utf8');
  await db.exec('begin;'+migration+'commit;');
  // An interrupted transaction must roll back all dependent deletions.
  await db.exec('begin');await db.query('delete from auth.users where id=$1',[actor]);
  await assert.rejects(()=>db.exec('select 1/0'));await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from public.nothingsports_reminders')).rows[0].n,5);
  await db.query('delete from auth.users where id=$1',[actor]);
  await db.query('delete from auth.users where id=$1',[actor]);
  assert.deepEqual((await db.query('select installation_id from public.nothingsports_push_installations order by installation_id')).rows.map(r=>r.installation_id),installs.slice(1));
  assert.deepEqual((await db.query('select event_id from public.nothingsports_reminders order by event_id')).rows.map(r=>r.event_id),['anonymous','peer']);
  assert.equal((await db.query('select id from auth.users')).rows[0].id,peer);
  console.log('Notification erasure: original orphan reproduced; rollback/retry, owned/reassigned-device cleanup and peer/anonymous preservation passed.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
