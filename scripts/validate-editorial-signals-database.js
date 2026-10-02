'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
async function main(){
  const db=new PGlite();
  try{
    await db.exec(`create schema auth;create schema private;
      create role anon;create role authenticated;create role service_role;
      create table auth.users(id uuid primary key,raw_app_meta_data jsonb default '{}',is_anonymous boolean default false);
      create table public.nothingsports_nsc_pilot_members(user_id uuid primary key,suspended boolean default false);
      create table public.nothingsports_nsc_contributions(contribution_id uuid default gen_random_uuid(),event_id text,user_id uuid,phase text,rating smallint,updated_at timestamptz);
      insert into auth.users(id,raw_app_meta_data,is_anonymous) values
        ('00000000-0000-4000-8000-000000000001','{"role":"admin"}',false),
        ('00000000-0000-4000-8000-000000000002','{}',false),
        ('00000000-0000-4000-8000-000000000003','{}',false),
        ('00000000-0000-4000-8000-000000000004','{}',true),
        ('00000000-0000-4000-8000-000000000005','{}',false);
      insert into public.nothingsports_nsc_pilot_members values('00000000-0000-4000-8000-000000000005',true);
      insert into public.nothingsports_nsc_contributions(event_id,user_id,phase,rating,updated_at) values
        ('source-old','00000000-0000-4000-8000-000000000002','heat',5,now()-interval '2 days'),
        ('source-new','00000000-0000-4000-8000-000000000002','heat',3,now()-interval '1 day'),
        ('source-old','00000000-0000-4000-8000-000000000003','heat',5,now()-interval '1 day'),
        ('source-old','00000000-0000-4000-8000-000000000004','heat',5,now()-interval '1 day'),
        ('source-old','00000000-0000-4000-8000-000000000005','heat',5,now()-interval '1 day'),
        ('source-old','00000000-0000-4000-8000-000000000001','pulse',5,now()-interval '1 day'),
        ('owner-fixture','00000000-0000-4000-8000-000000000001','heat',5,now()-interval '1 day'),
        ('owner-fixture','00000000-0000-4000-8000-000000000002','heat',1,now()-interval '1 day'),
        ('single-fixture','00000000-0000-4000-8000-000000000003','heat',5,now()-interval '1 day');`);
    await db.exec(fs.readFileSync('supabase/migrations/20261002102853_adaptive_editorial.sql','utf8'));
    const groups=[{event_id:'canonical',aliases:['source-old','source-new']},{event_id:'owner-fixture',aliases:['owner-fixture']},{event_id:'single-fixture',aliases:['single-fixture']}];
    const {rows}=await db.query('select * from public.nothingsports_editorial_signals($1::jsonb)',[JSON.stringify(groups)]);
    const aliased=rows.find(r=>r.event_id==='canonical');assert.equal(Number(aliased.count),2);assert.equal(Number(aliased.mean),4);assert.equal(Number(aliased.five_count),1);assert.equal(aliased.owner_five,false);
    const owner=rows.find(r=>r.event_id==='owner-fixture');assert.equal(owner.owner_five,true);assert.equal(Number(owner.mean),3);
    const single=rows.find(r=>r.event_id==='single-fixture');assert.equal(Number(single.count),1);assert.equal(Number(single.mean),5);
    const privileges=await db.query(`select has_table_privilege('anon','public.nothingsports_editorial_maintenance','select') as anon_read,has_table_privilege('authenticated','public.nothingsports_editorial_maintenance','select') as user_read,has_function_privilege('anon','public.nothingsports_editorial_signals(jsonb)','execute') as anon_rpc`);
    assert.deepEqual(privileges.rows[0],{anon_read:false,user_read:false,anon_rpc:false});
    console.log('Editorial database signals passed: aliases/latest vote per person, registered non-pilot accounts, anonymous/suspended exclusion, owner exception, one-voter mean and denied public access.');
  }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
