'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const migration='supabase/migrations/20261013123624_cricket_milestone_alerts.sql';
const user='11111111-1111-4111-8111-111111111111',guest='22222222-2222-4222-8222-222222222222',device='33333333-3333-4333-8333-333333333333',device2='44444444-4444-4444-8444-444444444444';
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,is_anonymous boolean default false);
 create table public.nothingsports_user_state(user_id uuid primary key,preferences jsonb default '{}',event_user_state jsonb default '{}',event_spoiler_state jsonb default '{}',updated_at timestamptz default now());
 create table public.nothingsports_account_erasure_blocks(user_id uuid primary key);
 create table public.nothingsports_push_installations(installation_id uuid primary key,user_id uuid references auth.users(id),permission text default 'granted');
 create table public.nothingsports_fixture_current(source_id text,fixture_id text,fixture jsonb,primary key(source_id,fixture_id));
 create table public.nothingsports_fixture_sources(source_id text primary key,discovery_report jsonb default '{}',failure_count integer default 0);
 create table public.nothingsports_live_scores(source_id text,fixture_id text,score jsonb,content_hash text,first_completed_at timestamptz,primary key(source_id,fixture_id));
 create table public.inbox_maintenance_probe(calls integer);insert into public.inbox_maintenance_probe values(0);create function public.nothingsports_inbox_maintenance() returns void language sql security invoker as 'update public.inbox_maintenance_probe set calls=calls+1';grant execute on function public.nothingsports_inbox_maintenance() to service_role;
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 const observationMigration=fs.readFileSync('supabase/migrations/20261002171936_preserve_compact_fixture_observations.sql','utf8');
 for(const name of ['nothingsports_fixture_observation_time','nothingsports_project_fixture_observations']){const start=observationMigration.indexOf('create or replace function public.'+name+'('),end=observationMigration.indexOf('$$;',start)+3;assert(start>=0&&end>start);await db.exec(observationMigration.slice(start,end));}
 await db.exec('grant execute on function public.nothingsports_fixture_observation_time(text),public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz) to service_role');
 await db.exec(fs.readFileSync(migration,'utf8'));
 await db.query('insert into auth.users values($1,false),($2,true)',[user,guest]);
 await db.query('insert into nothingsports_user_state(user_id) values($1),($2)',[user,guest]);
 await db.query('insert into nothingsports_push_installations values($1,$2,\'granted\'),($3,$2,\'granted\')',[device,user,device2]);
 const guestDevice='55555555-5555-4555-8555-555555555555';await db.query('insert into nothingsports_push_installations values($1,$2,\'granted\')',[guestDevice,guest]);
 await db.exec('set role anon');await assert.rejects(()=>db.exec('select * from public.nothingsports_moments'),/permission denied/);await assert.rejects(()=>db.exec('select * from public.nothingsports_milestone_accounts()'),/permission denied/);
 await db.exec('set role service_role');await assert.rejects(()=>db.exec('select * from auth.users'),/permission denied/);

 const stamp=(await db.query('select updated_at from public.nothingsports_user_state where user_id=$1',[user])).rows[0].updated_at;
 const fixture='fixture:cricket:CA:39990',source='cricket-ca-current';
 await db.query('insert into public.nothingsports_fixture_sources(source_id) values($1)',[source]);
 await db.query('insert into public.nothingsports_fixture_current values($1,$2,$3)',[source,fixture,{id:fixture}]);await db.query('insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values($1,$2,$3,\'score-one\')',[source,fixture,{status:'live'}]);
 const observed=new Date().toISOString(),moment=n=>({schemaVersion:'sport-moment.v1',momentId:n.toString(16).padStart(64,'0'),eventId:fixture,sport:'cricket',family:'centuries',stage:'approaching',observedAt:observed});
 const packet={fixture_id:fixture,previous_hash:null,score_hash:'score-one',state:{id:fixture},moments:[moment(1),moment(2)]};
 assert.equal((await db.query('select public.nothingsports_commit_milestone_observations($1,$2) n',[source,[packet]])).rows[0].n,2);
 assert.equal((await db.query('select public.nothingsports_commit_milestone_observations($1,$2) n',[source,[packet]])).rows[0].n,0,'A concurrent/replayed previous-state revision cannot publish moments twice');
 assert.equal((await db.query('select count(*)::int n from public.nothingsports_moments')).rows[0].n,2);
 assert.deepEqual((await db.query('select user_id from public.nothingsports_milestone_accounts()')).rows.map(r=>r.user_id),[user],'Private eligibility excludes guest accounts without granting Auth reads');
 const row=(await db.query('select * from public.nothingsports_milestone_observations($1,$2)',[source,[fixture]])).rows[0];assert.equal(row.fixture.status,'live');assert.equal(row.previous.id,fixture);
 const claim=async ids=>(await db.query('select public.nothingsports_claim_milestone_group($1,$2,$3,$4,\'score-one\',\'medium\',clock_timestamp()) g',[user,stamp,fixture,ids])).rows[0].g;
 assert.equal(await claim([moment(1).momentId]),null,'Production delivery is gated by default');
 await assert.rejects(()=>db.exec('update public.nothingsports_milestone_rollout set enabled=true'),/check constraint/);
 await db.exec("update public.nothingsports_milestone_rollout set enabled=true,shadow_verified_at=now(),device_verified_at=now(),shadow_evidence='controlled-test-only',device_evidence='controlled-test-only'");
 const concurrent=await Promise.all([claim([moment(1).momentId,moment(2).momentId]),claim([moment(1).momentId,moment(2).momentId])]);assert.equal(concurrent.filter(Boolean).length,1,'Concurrent requests reserve one unique group');const group=concurrent.find(Boolean);assert(group);assert.equal(await claim([moment(1).momentId]),null,'Once per account and milestone, even for approaching/achieved revisions');
 const installation=async(id)=>(await db.query('select public.nothingsports_claim_milestone_installation($1,$2,$3,clock_timestamp()) n',[group,id,stamp])).rows[0].n;
 assert.equal(await installation(device),1);assert.equal(await installation(device),0,'Sending or ambiguous provider outcomes are not reclaimed');assert.equal(await installation(device2),1);
 await db.query("update public.nothingsports_milestone_installations set status='pending' where group_id=$1 and installation_id=$2",[group,device2]);
 await db.query("update public.nothingsports_live_scores set content_hash='changed-source' where fixture_id=$1",[fixture]);assert.equal(await installation(device2),0,'A changed source fences queued device sends');
 await db.query("update public.nothingsports_live_scores set content_hash='score-one' where fixture_id=$1",[fixture]);assert.equal(await installation(device2),2,'The unchanged verified revision remains sendable');
 assert.equal((await db.query('select count(*)::int n from public.nothingsports_milestone_groups')).rows[0].n,1,'Two installations use one account budget slot');
 await db.query('update public.nothingsports_milestone_installations set status=\'pending\' where group_id=$1 and installation_id=$2',[group,device]);assert.equal(await installation(device),2);await db.query('update public.nothingsports_milestone_installations set status=\'pending\' where group_id=$1 and installation_id=$2',[group,device]);assert.equal(await installation(device),3);await db.query('update public.nothingsports_milestone_installations set status=\'pending\' where group_id=$1 and installation_id=$2',[group,device]);assert.equal(await installation(device),0,'Confirmed rejection retries are capped');
 await db.query('insert into public.nothingsports_moments values($1,$2,\'cricket\',$3,now()+interval \'4 minutes\',now())',[moment(3).momentId,fixture,moment(3)]);assert.equal(await claim([moment(3).momentId]),null,'A different moment cannot bypass the account cooldown');
 assert.equal((await db.query('select disposition from public.nothingsports_milestone_receipts where moment_id=$1',[moment(3).momentId])).rows[0].disposition,'budget','Suppressed work is discarded, not replayed later');
 await db.query('update public.nothingsports_user_state set updated_at=now()+interval \'1 second\' where user_id=$1',[user]);assert.equal(await installation(device2),0,'Account edits fence pending device sends');
 // Exercise real rolling SQL limits after the cooldown has elapsed.
 await db.query('update public.nothingsports_user_state set updated_at=$2 where user_id=$1',[user,stamp]);
 for(const [level,count,sameFixture] of [['low',1,true],['medium',3,true],['medium',6,false],['high',6,true],['high',12,false]]){
  await db.query('delete from public.nothingsports_milestone_groups where user_id=$1',[user]);await db.query('delete from public.nothingsports_milestone_receipts where user_id=$1',[user]);
  await db.query('update public.nothingsports_user_state set preferences=$2 where user_id=$1',[user,{followFirst:{notifications:{milestones:{sports:{cricket:{coverage:level}}}}}}]);
  for(let n=0;n<count;n++)await db.query("insert into public.nothingsports_milestone_groups(user_id,fixture_id,score_hash,status,created_at,expires_at) values($1,$2,'score-one','sent',now()-($3::int*interval '80 minutes'),now())",[user,sameFixture?fixture:'other-'+n,n+1]);
  const id=moment(100+count+(level==='high'?20:0)+(sameFixture?0:30)).momentId;
  await db.query("insert into public.nothingsports_moments values($1,$2,'cricket',$3,now()+interval '4 minutes',now()) on conflict(moment_id) do update set expires_at=excluded.expires_at",[id,fixture,{...moment(1),momentId:id}]);
  const cap=(await db.query('select public.nothingsports_claim_milestone_group($1,$2,$3,$4,\'score-one\',$5,clock_timestamp()) g',[user,stamp,fixture,[id],level])).rows[0].g;assert.equal(cap,null,level+' '+(sameFixture?'fixture':'overall')+' cap');
 }
 const oldMoment=moment(999).momentId;await db.query("insert into public.nothingsports_moments values($1,$2,'cricket',$3,now()-interval '31 days',now()-interval '31 days')",[oldMoment,fixture,moment(999)]);await db.query("insert into public.nothingsports_milestone_receipts(user_id,moment_id,disposition,created_at) values($1,$2,'choice',now()-interval '31 days')",[user,oldMoment]);
 await db.exec('select public.nothingsports_inbox_maintenance()');assert.equal((await db.query('select calls from public.inbox_maintenance_probe')).rows[0].calls,1,'The existing inbox body is preserved and remains the single maintenance RPC');assert.equal((await db.query('select count(*)::int n from public.nothingsports_moments where moment_id=$1',[oldMoment])).rows[0].n,0,'30-day retention runs even without another fresh source publication');assert.equal((await db.query('select count(*)::int n from public.nothingsports_milestone_receipts where moment_id=$1',[oldMoment])).rows[0].n,0,'Retention cascades to old receipts');
 await db.exec('reset role');await db.query('delete from public.nothingsports_push_installations where user_id=$1',[user]);await db.query('delete from public.nothingsports_user_state where user_id=$1',[user]);await db.query('delete from auth.users where id=$1',[user]);
 assert.equal((await db.query('select count(*)::int n from public.nothingsports_milestone_receipts')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.nothingsports_milestone_groups')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.nothingsports_milestone_installations')).rows[0].n,0,'Account erasure cascades through every recipient-owned row');
 console.log('Milestone database: RLS, private registration check, rollout gates, replay fencing, grouped account budgets, device claims/retries and erasure passed.');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
