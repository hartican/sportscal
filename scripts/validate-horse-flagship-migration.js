'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const actualSync=require('../config/user-state-sync'),guard=require('../lib/horse-follow-rollout'),sync={...actualSync,applyPatch:(base,patch)=>{const next=actualSync.applyPatch(base,patch);guard.preserveHorseRollout(base,actualSync.normalizePatch(patch),next);return next;}},follow=require('../config/follow-first');
const sql=fs.readFileSync('supabase/migrations/20261013080856_horse_flagship_existing_accounts.sql','utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
(async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,is_anonymous boolean default false);
 create table public.nothingsports_account_erasure_blocks(user_id uuid primary key);
 create table public.nothingsports_user_state(user_id uuid primary key references auth.users(id) on delete cascade,preferences jsonb not null default '{}',updated_at timestamptz not null default now(),ratings jsonb not null default '{}');`);
 for(let n=1;n<=5;n++)await db.query('insert into auth.users values($1,$2)',[id(n),n===4]);
 await db.query('insert into public.nothingsports_account_erasure_blocks values($1)',[id(5)]);
 const p={theme:'night',selectedSelectorEntityIds:['sport:tennis'],followedSports:['tennis'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:tennis',enabled:true}],entityFollows:[{participantId:'athlete:tennis:alex-de-minaur',followLevel:'unfollow'}]},followFirst:{notifications:{enabled:false,autoRemindersEnabled:false},eventEditionDecisions:{states:{'event:horse-racing:melbourne-cup:2026':'excluded'}},excludedMajorEventIds:['melbourne-cup-carnival']}};
 await db.query("insert into public.nothingsports_user_state values($1,$2,'2026-10-01','{\"saved\":5}')",[id(1),p]);
 const refusal={...p,preferenceGraph:{...p.preferenceGraph,domainPreferences:[{sportDomainId:'sport:horse-racing',enabled:false}]}};
 await db.query("insert into public.nothingsports_user_state(user_id,preferences) values($1,$2)",[id(2),refusal]);
 await db.exec(sql);
 const rows=(await db.query('select * from public.nothingsports_user_state order by user_id')).rows;
 assert.equal(rows.length,3);const migrated=rows[0].preferences;
 assert.deepEqual(migrated.selectedSelectorEntityIds,['sport:tennis','sport:horse-racing']);
 assert.deepEqual(migrated.followedSports,['tennis','horse-racing']);
 assert.deepEqual(migrated.preferenceGraph,p.preferenceGraph);assert.deepEqual(migrated.followFirst.notifications,p.followFirst.notifications);assert.deepEqual(migrated.followFirst.eventEditionDecisions,p.followFirst.eventEditionDecisions);assert.deepEqual(migrated.followFirst.excludedMajorEventIds,p.followFirst.excludedMajorEventIds);assert.deepEqual(rows[0].ratings,{saved:5});assert(Date.parse(rows[0].updated_at)>Date.parse('2026-10-01'));
 assert.deepEqual(rows[1].preferences.selectedSelectorEntityIds,refusal.selectedSelectorEntityIds);assert.equal(rows[1].preferences.followFirst.horseRacingRollout.enabled,false);
 assert.deepEqual(rows[2].preferences.selectedSelectorEntityIds,['sport:horse-racing']);
 const snapshots=(await db.query('select * from private.nothingsports_horse_flagship_cohort order by user_id')).rows;
 assert.deepEqual(snapshots[0].prior_preferences,p);assert.equal(snapshots[2].prior_preferences,null);assert.equal(snapshots[2].created_state,true);
 assert((await db.query('select completed_at from private.nothingsports_horse_flagship_runs')).rows[0].completed_at);
 assert.equal((await db.query("select has_table_privilege('authenticated','private.nothingsports_horse_flagship_cohort','select') as allowed")).rows[0].allowed,false);
 // Actual existing patch owner: unrelated offline sport edit merges the rollout.
 const offline={...p,selectedSelectorEntityIds:[...p.selectedSelectorEntityIds,'sport:nba'],followedSports:[...p.followedSports,'nba']};
 const patch=sync.createPatch({preferences:p},{preferences:offline});
 const Ajv=require('ajv/dist/2020'),ajv=new Ajv({strict:false});require('ajv-formats')(ajv);const validate=ajv.compile(JSON.parse(fs.readFileSync('schemas/user-state-patch.schema.json')));assert(validate(patch),JSON.stringify(validate.errors));
 const merged=sync.applyPatch({preferences:migrated},patch).preferences;
 assert(merged.selectedSelectorEntityIds.includes('sport:horse-racing'));assert(merged.selectedSelectorEntityIds.includes('sport:nba'));assert.equal(merged.theme,'night');
 const unfollow={...migrated,selectedSelectorEntityIds:['sport:tennis'],followedSports:['tennis']};
 const later=sync.applyPatch({preferences:migrated},sync.createPatch({preferences:migrated},{preferences:unfollow})).preferences;
 assert.equal(later.followFirst.horseRacingRollout.enabled,false);assert(!later.selectedSelectorEntityIds.includes('sport:horse-racing'));
 const stale=sync.applyPatch({preferences:later},sync.createPatch({preferences:migrated},{preferences:{...migrated,selectedSelectorEntityIds:[...migrated.selectedSelectorEntityIds,'sport:nba']}})).preferences;
 assert(!stale.selectedSelectorEntityIds.includes('sport:horse-racing'),'A stale ON device cannot restore a subsequent unfollow');
 const legacy=sync.applyPatch({preferences:migrated},{schemaVersion:sync.PATCH_SCHEMA_VERSION,changes:[{path:['preferences','selectedSelectorEntityIds'],value:['sport:nba']}]}).preferences;
 assert(legacy.selectedSelectorEntityIds.includes('sport:horse-racing'),'A legacy replacement without explicit intent retains rollout choice');
 // An unrelated offline graph edit is not a new Horse decision.
 for(const currentChoice of [true,false])for(const currentRow of [true,false])for(const oldDomainId of ['sport:horse-racing','horse-racing']){
  const horse={sportDomainId:'sport:horse-racing',enabled:currentChoice};
  const graph=currentRow?[horse]:[];
  const current={...migrated,selectedSelectorEntityIds:['sport:tennis',...(currentChoice?['sport:horse-racing']:[])],followedSports:['tennis',...(currentChoice?['horse-racing']:[])],preferenceGraph:{domainPreferences:graph},followFirst:{...migrated.followFirst,horseRacingRollout:{version:1,enabled:currentChoice,source:'settings'}}};
  const oldChoice=!currentChoice;
  const oldDevice={...current,selectedSelectorEntityIds:['sport:tennis',...(oldChoice?['sport:horse-racing']:[])],followedSports:['tennis',...(oldChoice?['horse-racing']:[])],preferenceGraph:{domainPreferences:[{sportDomainId:oldDomainId,enabled:oldChoice}]}};
  const edited={...oldDevice,selectedSelectorEntityIds:[...oldDevice.selectedSelectorEntityIds,'sport:nba'],followedSports:[...oldDevice.followedSports,'nba'],preferenceGraph:{domainPreferences:[...oldDevice.preferenceGraph.domainPreferences,{sportDomainId:'sport:nba',enabled:true}]}};
  const accepted=sync.applyPatch({preferences:current},sync.createPatch({preferences:oldDevice},{preferences:edited})).preferences;
  assert.equal(accepted.followFirst.horseRacingRollout.enabled,currentChoice,'Unchanged old graph must not undo newer Horse choice');
  assert.equal(accepted.selectedSelectorEntityIds.includes('sport:horse-racing'),currentChoice);
  assert.deepEqual(accepted.preferenceGraph.domainPreferences.filter(p=>['sport:horse-racing','horse-racing'].includes(p.sportDomainId)),graph,'Retain the current Horse graph row, including its absence');
  assert(accepted.preferenceGraph.domainPreferences.some(p=>p.sportDomainId==='sport:nba'&&p.enabled),'Accept the unrelated NBA edit');
  const explicit={...current,selectedSelectorEntityIds:['sport:tennis',...(!currentChoice?['sport:horse-racing']:[])],followedSports:['tennis',...(!currentChoice?['horse-racing']:[])]};
  const changed=sync.applyPatch({preferences:current},sync.createPatch({preferences:current},{preferences:explicit})).preferences;
  assert.equal(changed.followFirst.horseRacingRollout.enabled,!currentChoice,'A genuine later Horse switch wins');
  assert(changed.preferenceGraph.domainPreferences.filter(p=>['sport:horse-racing','horse-racing'].includes(p.sportDomainId)).every(p=>p.enabled===!currentChoice),'The graph cannot contradict the genuine switch');
 }
 await db.query('update public.nothingsports_user_state set preferences=$2,updated_at=clock_timestamp() where user_id=$1',[id(1),later]);
 await db.query('insert into auth.users values($1,false)',[id(6)]);await db.exec(sql);
 assert.deepEqual((await db.query('select preferences from public.nothingsports_user_state where user_id=$1',[id(1)])).rows[0].preferences,later);
 assert.equal((await db.query('select count(*)::int as n from private.nothingsports_horse_flagship_cohort')).rows[0].n,3);
 await db.query('delete from auth.users where id=$1',[id(1)]);assert.equal((await db.query('select count(*)::int as n from private.nothingsports_horse_flagship_cohort')).rows[0].n,2);
 assert(!follow.migratePreferences({}).selectedSelectorEntityIds.includes('sport:horse-racing'),'Future onboarding unchanged');
 console.log('Horse rollout: frozen registered cohort, absent-state creation, refusals, snapshots, retry/new-account exclusion, erasure, untouched choices, offline delta and later unfollow passed. Local PostgreSQL/actual sync owner; production migration not applied.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
