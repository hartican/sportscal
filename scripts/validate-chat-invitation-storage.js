#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
  create table auth.users(id uuid primary key);
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table public.nothingsports_chat_rooms(id uuid primary key,status text default 'open');
  create table public.nothingsports_chat_members(room_id uuid references public.nothingsports_chat_rooms(id),user_id uuid references auth.users(id),added_by uuid,last_read_at timestamptz,primary key(room_id,user_id));
  create table public.nothingsports_chat_messages(id bigserial primary key,room_id uuid,sender_id uuid,client_id text,message_type text,body text,sender_display_name text);
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20260909143000_chat_fullscreen_receipts_invitations.sql','utf8'));
  const inviter='11111111-1111-4111-8111-111111111111',invitee='22222222-2222-4222-8222-222222222222',room='33333333-3333-4333-8333-333333333333';
  await db.query('insert into auth.users values ($1),($2)',[inviter,invitee]);
  await db.query('insert into public.nothingsports_chat_rooms(id) values ($1)',[room]);
  const {rows:[invitation]}=await db.query('insert into public.nothingsports_chat_invitations(room_id,inviter_id,invitee_id) values ($1,$2,$3) returning invitation_id',[room,inviter,invitee]);
  assert.equal((await db.query('select * from public.nothingsports_chat_members')).rows.length,0,'pending invitation grants no history membership');
  assert.equal((await db.query('select * from public.nothingsports_chat_resolve_invitation($1,$2,$3)',[invitation.invitation_id,inviter,'accepted'])).rows.length,0,'other identity cannot accept');
  for(let i=0;i<2;i++)await db.query('select * from public.nothingsports_chat_resolve_invitation($1,$2,$3)',[invitation.invitation_id,invitee,'accepted']);
  assert.equal((await db.query('select * from public.nothingsports_chat_members')).rows.length,1,'accept retries create one membership');
  await db.query('select public.nothingsports_chat_acknowledge($1,$2,$3,false)',[room,invitee,'2026-09-01T10:00:00Z']);
  await db.query('select public.nothingsports_chat_acknowledge($1,$2,$3,true)',[room,invitee,'2026-09-01T10:00:00Z']);
  await db.query('select public.nothingsports_chat_acknowledge($1,$2,$3,true)',[room,invitee,'2026-09-01T09:00:00Z']);
  const ack=(await db.query('select last_delivered_at,last_read_at from public.nothingsports_chat_members')).rows[0];
  assert.equal(new Date(ack.last_read_at).toISOString(),'2026-09-01T10:00:00.000Z','an old response cannot regress read receipts');
  assert.equal(new Date(ack.last_delivered_at).toISOString(),'2026-09-01T10:00:00.000Z','an old response cannot regress delivery receipts');
  for(let i=0;i<2;i++)await db.query('select public.nothingsports_chat_leave_room($1,$2,$3,$4)',[room,invitee,'Jim','leave-test']);
  assert.equal((await db.query('select * from public.nothingsports_chat_members')).rows.length,0,'leave removes membership');
  const messages=(await db.query('select * from public.nothingsports_chat_messages')).rows;
  assert.equal(messages.length,1,'leave retry inserts one system message');assert.equal(messages[0].body,'‘Jim’ has dogged the chat.');
  await db.query('update public.nothingsports_chat_invitations set status=$1 where invitation_id=$2',['pending',invitation.invitation_id]);
  await db.query('select * from public.nothingsports_chat_resolve_invitation($1,$2,$3)',[invitation.invitation_id,invitee,'rejected']);
  assert.equal((await db.query('select * from public.nothingsports_chat_members')).rows.length,0,'reject grants no membership');
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.nothingsports_chat_invitations'),/permission denied/);
  await assert.rejects(db.query('select * from public.nothingsports_chat_resolve_invitation($1,$2,$3)',[invitation.invitation_id,invitee,'accepted']),/permission denied/);
  console.log('Chat invitation storage: acceptance, identity, retries, rejection, leave message and direct access denial passed.');
 }finally{await db.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
