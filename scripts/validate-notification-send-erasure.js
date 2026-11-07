#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {guardedSend,suppressed}=require('../lib/notification-send');
async function main(){
 let sends=0,mode='allow',receipts=[];
 const request=async(path,{body})=>{
  if(path.includes('/rpc/')){
   if(mode==='deny')return null;
   if(mode==='offline')throw Error('Unavailable');
   return {leaseId:'lease',subscription:{endpoint:'https://push.invalid',keys:{p256dh:'test',auth:'test'}}};
  }
  if(mode==='receipt_failure')throw Error('Receipt unavailable');
  receipts.push(body);return [];
 };
 const send=async()=>{sends++;if(mode==='transport')throw Error('Ambiguous');if(mode==='rejected')throw {statusCode:503};};
 const run=()=>guardedSend({installationId:'test',payload:'{}',options:{timeout:3000},request,send});
 await run();assert.equal(receipts.at(-1).outcome,'accepted');
 mode='deny';await assert.rejects(run,suppressed);assert.equal(sends,1);
 mode='offline';await assert.rejects(run,e=>e.code==='notification_send_not_started'&&e.statusCode===503);assert.equal(sends,1);
 mode='transport';await assert.rejects(run);assert.equal(receipts.at(-1).outcome,'uncertain');
 mode='rejected';await assert.rejects(run);assert.equal(receipts.at(-1).outcome,'rejected');
 mode='receipt_failure';await assert.rejects(run,e=>e.code==='notification_send_uncertain');
 const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002',device='00000000-0000-4000-8000-000000000003';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create table public.nothingsports_account_erasure_blocks(user_id uuid primary key);
   create table public.nothingsports_push_installations(installation_id uuid primary key,user_id uuid,endpoint text,p256dh text,auth_key text,permission text default 'granted');
   create table public.nothingsports_reminders(id uuid primary key,user_id uuid,installation_id uuid,dispatched_at timestamptz,remind_at timestamptz,claimed_at timestamptz,updated_at timestamptz);
   create table public.nothingsports_social_notifications(id uuid primary key,recipient_user_id uuid,actor_user_id uuid,completed_at timestamptz,claimed_at timestamptz,created_at timestamptz,attempts integer default 0,last_error text);
   grant all on all tables in schema public to service_role;`);
  await db.exec('begin;'+fs.readFileSync('supabase/migrations/20260927151304_notification_send_erasure_leases.sql','utf8')+'commit;');
  await db.query("insert into public.nothingsports_push_installations(installation_id,user_id,endpoint,p256dh,auth_key) values($1,$2,'https://push.invalid','key','auth')",[device,owner]);
  await db.exec('set role authenticated;');
  await assert.rejects(()=>db.query('select public.nothingsports_begin_notification_send($1,$2)',[device,owner]),e=>e.code==='42501');
  await db.exec('reset role;set role service_role;');
  const begin=(expected=owner,related=[])=>db.query('select public.nothingsports_begin_notification_send($1,$2,$3) as lease',[device,expected,related]);
  assert.equal((await begin(peer)).rows[0].lease,null,'Device reassignment rejects stale recipient');
  const admitted=(await begin()).rows[0].lease;assert(admitted.leaseId);
  await db.query('insert into public.nothingsports_account_erasure_blocks values($1)',[owner]);
  assert.equal((await begin()).rows[0].lease,null,'Blocked recipient never obtains a new lease');
  assert.equal((await db.query("select count(*)::int n from public.nothingsports_notification_send_leases where outcome='in_flight'")).rows[0].n,1,'Previously admitted attempt remains visible');
  await db.query("update public.nothingsports_notification_send_leases set outcome='accepted',finished_at=now() where lease_id=$1",[admitted.leaseId]);
  await db.query('update public.nothingsports_push_installations set user_id=$1 where installation_id=$2',[peer,device]);
  assert.equal((await begin(peer,[owner])).rows[0].lease,null,'Deleted actor cannot appear in a new outbound payload');
  assert((await begin(peer)).rows[0].lease,'Unrelated peer can send');
  await db.query('update public.nothingsports_push_installations set user_id=null where installation_id=$1',[device]);
  assert((await begin(null)).rows[0].lease,'Anonymous device remains supported');
  await db.query("update public.nothingsports_push_installations set permission='denied' where installation_id=$1",[device]);
  assert.equal((await begin(null)).rows[0].lease,null,'Revoked permission prevents send');
  // Claim batches must skip blocked accounts rather than poison the entire batch.
  await db.query("insert into public.nothingsports_reminders values($1,$2,$3,null,now(),null,now()),($4,$5,$3,null,now(),null,now())",[owner,owner,device,peer,peer]);
  const reminder=(await db.query("select * from public.nothingsports_claim_due_reminders(now(),now()-interval '1 hour',now()-interval '10 minutes',5)")).rows;
  assert.deepEqual(reminder.map(r=>r.user_id),[peer]);
  await db.query("insert into public.nothingsports_social_notifications(id,recipient_user_id,actor_user_id,created_at) values($1,$1,$2,now()),($2,$2,null,now())",[owner,peer]);
  const social=(await db.query("select * from public.nothingsports_claim_social_notifications(now(),now()-interval '10 minutes',5)")).rows;
  assert.deepEqual(social.map(r=>r.recipient_user_id),[peer]);
 }finally{await db.close();}
 console.log('Notification send erasure: admission/receipt failures, uncertain outcomes, permissions, device reassignment, blocked actor/recipient, peer/anonymous preservation and non-poisoning claim batches passed. No push sent.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
