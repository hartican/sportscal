#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
  const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create table public.nothingsports_nsc_profiles(user_id uuid primary key,profile_id uuid default gen_random_uuid(),display_name text,handle text,visibility text default 'visible');
    create table public.nothingsports_nsc_personas(user_id uuid,moderation_flag boolean);
    create table public.nothingsports_nsc_contributions(contribution_id uuid default gen_random_uuid(),user_id uuid,event_id text,phase text,rating integer,updated_at timestamptz default now());
    create table public.nothingsports_nsc_points(user_id uuid,event_id text,action_key text,points integer);
    create table public.nothingsports_nsc_foresight_settlements(user_id uuid,event_id text,result text);
    grant select on all tables in schema public to service_role;`);
  const migration=fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_nothing_score_ladder.sql'));
  assert(migration,'ladder migration exists');await db.exec(fs.readFileSync(`supabase/migrations/${migration}`,'utf8'));
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
  await db.query("insert into nothingsports_nsc_profiles(user_id,display_name,handle) values($1,'First Fan','first'),($2,'Second Fan','second'),($3,'Private Fan','private')",[a,b,c]);
  await db.exec("update nothingsports_nsc_profiles set visibility='hidden' where handle='private'");
  for(const [id,event,phase,version,max] of [[a,'settled','heat','votes.v1',8],[a,'pending','heat','votes.v1',8],[a,'settled','pulse','votes.v1',2],[a,'settled','pulse','votes.v1',2],[a,'old','impact',null,null],[b,'one','impact','votes.v1',2],[c,'secret','impact','votes.v1',2]]){
    await db.query('insert into nothingsports_nsc_contributions(user_id,event_id,phase,rating,scoring_version,maximum_points) values($1,$2,$3,4,$4,$5)',[id,event,phase,version,max]);
  }
  for(const [id,event,key,points] of [[a,'settled','heat_rating',2],[a,'settled','foresight_bonus',6],[a,'settled','pulse_participation',2],[a,'pending','heat_rating',2],[a,'old','impact_rating',3],[a,'settled','first_fixture_like',1],[a,'settled','watching_two_heartbeats',2],[b,'one','impact_rating',2],[c,'secret','impact_rating',2]]){
    await db.query('insert into nothingsports_nsc_points values($1,$2,$3,$4)',[id,event,key,points]);
  }
  await db.query("insert into nothingsports_nsc_foresight_settlements values($1,'settled','contrarian')",[a]);
  await db.exec('set role anon');await assert.rejects(db.query('select public.nothingsports_nsc_ladder(null,0,25)'),/permission denied/);
  await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from public.nothingsports_nsc_ladder_rows'),/permission denied/);
  await db.exec('reset role;set role service_role');
  const payload=(await db.query('select public.nothingsports_nsc_ladder($1,0,1) as result',[b])).rows[0].result;
  assert.equal(payload.entries.length,1);assert.equal(payload.entries[0].points,15,'only voting ledger credits');
  assert.equal(payload.entries[0].fixtures,3,'distinct fixtures, not live update count');
  assert.equal(payload.entries[0].efficiency,1,'pending and unversioned votes excluded, latest live vote counted once');
  assert.equal(payload.viewer.rank,2,'viewer independent of page');assert.equal(payload.viewer.isViewer,true);assert.equal(payload.total,2,'hidden profiles not public');
  assert(!JSON.stringify(payload).includes(a),'private account IDs never exposed');
  const missing=(await db.query('select public.nothingsports_nsc_ladder($1,0,25) as result',['44444444-4444-4444-8444-444444444444'])).rows[0].result;
  assert.equal(missing.viewer,null);
  assert.equal((await db.query('select count(*)::integer as count from nothingsports_nsc_points')).rows[0].count,9,'reading never awards points');
  await db.close();console.log('NSC ladder: paginated public identities, voting-only totals, settled efficiency, old/pending exclusions, viewer rank and service-only read access passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
