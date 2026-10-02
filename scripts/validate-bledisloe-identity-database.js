'use strict';
// Disposable PGlite: current sanitised production schema/functions, fabricated
// accounts, future match and invalid installations. Never a provider or sender.
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const schema=require('./fixtures/bledisloe-identity-schema.json');
const canonical='rugby-australia-new-zealand-2026-10-17',old='fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8',ra='fixture:rugby:ra:949627';
const user='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222',install='33333333-3333-4333-8333-333333333333';
const migrationSource=fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_bledisloe_future_identity_reconciliation.sql')),'utf8');
// Freeze only the disposable fixture's cutover guard; the deployed migration
// always uses the real clock. Also exercise its closing boundary below.
const guard="if clock_timestamp()>='2026-10-17T05:00:00Z'::timestamptz";
assert(migrationSource.includes(guard));
const migration=migrationSource.replace(guard,"if '2026-10-02T12:00:00Z'::timestamptz>='2026-10-17T05:00:00Z'::timestamptz");
const tables=[...new Set(schema.columns.map(x=>x.table_name))];
async function bootstrap(db){
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema nothingsports_recovery;create table nothingsports_recovery.coverage_repair_versions(version text primary key,completed_at timestamptz,inventory jsonb not null default '{}');create table nothingsports_recovery.coverage_repair_rows(version text,table_name text,row_key text,payload jsonb,primary key(version,table_name,row_key));create table nothingsports_push_installations(installation_id uuid primary key,user_id uuid,permission text default 'granted',sporting_reminders_enabled boolean default true);create table nothingsports_reminder_account_checks(user_id uuid primary key references auth.users(id) on delete cascade,checked_at timestamptz not null);create table nothingsports_account_erasure_blocks(user_id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;");
 for(const table of tables){
  const columns=schema.columns.filter(x=>x.table_name===table).map(x=>'"'+x.column_name+'" '+x.type+(x.column_name==='id'&&['nothingsports_nsc_rating_history','nothingsports_nsc_prediction_revisions'].includes(table)?' generated always as identity':'')+(x.not_null?' not null':'')+(x.default_value&&!/nextval/.test(x.default_value)?' default '+x.default_value:'')).join(',');
  await db.exec('create table public."'+table+'"('+columns+');');
 }
 for(const c of schema.constraints.slice().sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY')))){
  // Keep real account, fixture, ledger and reminder foreign keys. Unrelated
  // sender/media/device parents are outside this exact-fixture rehearsal.
  if(c.definition.startsWith('FOREIGN KEY')&&!/REFERENCES (auth\.users|nothingsports_(?:score_fixtures|predictions|push_installations|live_rating_alerts|nsc_prediction_revisions|nsc_points))[( ]/.test(c.definition))continue;
  await db.exec('alter table "'+c.table_name+'" add constraint "'+c.conname+'" '+c.definition);
 }
 await db.exec("create unique index nothingsports_nsc_points_active_action_key on nothingsports_nsc_points(user_id,event_id,action_key) where identity_reconciled_into is null;create table nothingsports_score_epoch(started_at timestamptz);insert into nothingsports_score_epoch values('2026-09-01');create table nothingsports_nsc_personas(user_id uuid,moderation_flag boolean);create table rehearsal_side_effects(name text);create function rehearsal_side_effect() returns trigger language plpgsql as $$begin insert into public.rehearsal_side_effects values(tg_name);return new;end$$;");
 // The already-shipped private recovery subject/cascade contract.
 const prior=fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_rugby_reviewed_identity_reconciliation.sql')),'utf8');
 await db.exec(prior.slice(prior.indexOf('create table if not exists nothingsports_recovery.coverage_repair_subjects'),prior.indexOf('do $preflight$')));
 for(const f of schema.functions)await db.exec(f.definition);
 await db.exec('revoke all on schema nothingsports_recovery from public,anon,authenticated;revoke all on all tables in schema nothingsports_recovery from public,anon,authenticated,service_role;revoke all on all functions in schema nothingsports_recovery from public,anon,authenticated;grant usage on schema nothingsports_recovery to service_role;grant execute on function nothingsports_recovery.fixture_alias_v1(text) to service_role;revoke all on all functions in schema public from public,anon,authenticated;grant execute on all functions in schema public to service_role;grant all on all tables in schema public to service_role;');
 for(const table of tables.filter(x=>schema.columns.some(c=>c.table_name===x&&c.column_name==='event_id')))await db.exec('create trigger fixture_alias_v1 before insert or update of event_id on '+table+' for each row execute function nothingsports_recovery.alias_guard_v1();');
 for(const name of ['consensus_vote','nothingsports_live_rating_alert_outbox','nothingsports_nsc_lock_submitted_contribution','nsc_rating_history','nsc_vote_scoring_version'])await db.exec('create trigger '+name+' after insert or update on nothingsports_nsc_contributions for each row execute function rehearsal_side_effect();');
 await db.exec('create trigger prediction_rule after insert or update on nothingsports_score_fixtures for each row execute function rehearsal_side_effect();');
 await db.exec('create trigger nothingsports_reminder_choices before insert or update of event_user_state on nothingsports_user_state for each row execute function nothingsports_sync_reminder_choices();');
 await db.query('insert into auth.users values($1),($2)',[user,peer]);await db.query('insert into nothingsports_push_installations(installation_id,user_id) values($1,$2)',[install,user]);
 for(const [index,id] of [canonical,old].entries()){
  const start=index?'2026-10-17T05:45:00Z':'2026-10-17T04:45:00Z',end=index?'2026-10-17T08:45:00Z':'2026-10-17T07:45:00Z',stamp=index?'2026-10-01T09:00:00Z':'2026-09-30T09:00:00Z';
  await db.query("insert into nothingsports_score_fixtures(event_id,sport,gender,starts_at,ends_at,status) values($1,'rugby','men',$2,$3,'scheduled')",[id,start,end]);
  await db.query("insert into nothingsports_prediction_rules(event_id,version) values($1,'anticipation.v2')",[id]);
  await db.query("insert into nothingsports_score_votes(user_id,event_id,phase,rating,recorded_at) values($1,$2,'heat',$3,$4)",[user,id,index?3:4,stamp]);
  await db.query("insert into nothingsports_predictions(user_id,event_id,rating,created_at,updated_at) values($1,$2,$3,$4,$4)",[user,id,index?3:4,stamp]);
  await db.query("insert into nothingsports_nsc_contributions(user_id,event_id,phase,rating,submitted_at,updated_at) values($1,$2,'heat',$3,$4,$4)",[user,id,index?3:4,stamp]);
  await db.query("insert into nothingsports_nsc_rating_history(user_id,event_id,phase,rating,recorded_at) values($1,$2,'heat',$3,$4)",[user,id,index?3:4,stamp]);
  await db.query("insert into nothingsports_nsc_prediction_revisions(user_id,event_id,rating,recorded_at,starts_at) values($1,$2,$3,$4,$5)",[user,id,index?3:4,stamp,start]);
  await db.query("insert into nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,sport,awarded_at) values($1,$2,'heat_rating',1,'2026-10-01','rugby',$3)",[user,id,stamp]);
  await db.query("insert into nothingsports_reminders(installation_id,user_id,event_id,title,starts_at,remind_at,attempts) values($1,$2,$3,'Bledisloe',$4,$5,0)",[install,user,id,start,index?'2026-10-17T05:30:00Z':'2026-10-17T04:30:00Z']);
  await db.query("insert into nothingsports_chat_rooms(canonical_fixture_id,fixture_snapshot,room_name,created_by) values($1,'{}','Separate private room',$2)",[id,user]);
 }
 await db.query("insert into nothingsports_user_state(user_id,event_user_state,ratings,event_spoiler_state,archived_events) values($1,$2,$3,'{}',$4)",[user,JSON.stringify({[old]:{reminderRequested:true}}),JSON.stringify({[old]:3}),JSON.stringify([{id:old,privateDraft:'kept'}])]);
 await db.query("insert into nothingsports_reminder_intents(user_id,fixture_id,aliases,choice,enabled,chosen_at) values($1,$2,$3,'on',true,'2026-09-30T10:00:00Z')",[user,canonical,JSON.stringify([canonical])]);
 await db.query("insert into nothingsports_marquee_campaigns(campaign_id,event_id,source_revision,content_hash,state,candidate,draft_copy) values('marquee_0123456789abcdef',$1,'retained',$2,'draft','{}',$3)",[canonical,'a'.repeat(64),JSON.stringify({text:'Original private draft'})]);
 await db.exec('delete from rehearsal_side_effects');
}
async function snapshot(db){const data={};for(const table of tables)data[table]=(await db.query('select to_jsonb(s) value from '+table+' s order by to_jsonb(s)::text')).rows.map(x=>x.value);return data;}
async function rejectScenario(db,sql,params,pattern,before){await db.exec('begin');await db.query(sql,params);await assert.rejects(db.exec(migration),pattern);await db.exec('rollback');assert.deepEqual(await snapshot(db),before,'rejected cutover leaves data intact');}
(async()=>{const db=new PGlite();try{
 await bootstrap(db);const before=await snapshot(db);
 await db.exec('begin');await assert.rejects(db.exec(migrationSource.replace(guard,"if '2026-10-17T05:00:00Z'::timestamptz>='2026-10-17T05:00:00Z'::timestamptz")),/cutover window has closed/);await db.exec('rollback');assert.deepEqual(await snapshot(db),before);
 await rejectScenario(db,'update nothingsports_predictions set resolved_at=now() where event_id=$1',[old],/Settled Bledisloe/,before);
 await rejectScenario(db,"update nothingsports_prediction_rules set version='consensus.v1' where event_id=$1",[old],/rules disagree/,before);
 await rejectScenario(db,'update nothingsports_reminders set claimed_at=now() where event_id=$1',[old],/reminder claim/,before);
 await rejectScenario(db,"update nothingsports_reminders set delivery_mode='broadcast-15' where event_id=$1",[old],/reminder mode/,before);
 await rejectScenario(db,'insert into nothingsports_account_erasure_blocks values($1)',[user],/Erasing Bledisloe/,before);
 // Later explicit OFF beats an older ON and an even newer automatic record.
 await db.exec('begin');await db.query("insert into nothingsports_reminder_intents(user_id,fixture_id,aliases,choice,enabled,chosen_at) values($1,$2,'[]','off',false,'2026-10-01T10:00:00Z'),($1,$3,'[]','automatic',true,'2026-10-02T10:00:00Z')",[user,old,ra]);await db.exec(migration);
 let intent=(await db.query('select * from nothingsports_reminder_intents where user_id=$1',[user])).rows[0];assert.equal(intent.choice,'off');assert.equal(intent.enabled,false);assert.equal(intent.fixture_id,canonical);assert(intent.aliases.includes(old));assert.equal((await db.query('select schedule_state from nothingsports_reminders')).rows[0].schedule_state,'off');await db.exec('rollback');assert.deepEqual(await snapshot(db),before);
 // Preserve every installation's receipt, including unknown external outcomes.
 await db.exec('begin');await db.query("update nothingsports_reminders set delivery_started_at='2026-10-01T11:00:00Z',attempts=2 where event_id=$1",[old]);await db.query("update nothingsports_reminders set dispatched_at='2026-10-01T11:00:02Z',attempts=1 where event_id=$1",[canonical]);await db.exec(migration);
 let reminder=(await db.query('select * from nothingsports_reminders')).rows[0];assert(reminder.dispatched_at&&reminder.delivery_started_at);assert.equal(reminder.attempts,3);assert.equal(Date.parse(reminder.starts_at),Date.parse('2026-10-17T04:45:00Z'),'delivered receipt timing remains historical');await db.exec('rollback');assert.deepEqual(await snapshot(db),before);
 await db.exec('begin');await db.query("update nothingsports_reminders set delivery_started_at='2026-10-01T11:00:00Z',attempts=2 where event_id=$1",[old]);await db.exec(migration);reminder=(await db.query('select * from nothingsports_reminders')).rows[0];assert(reminder.delivery_started_at);assert.equal(reminder.dispatched_at,null);assert.equal(Date.parse(reminder.starts_at),Date.parse('2026-10-17T05:45:00Z'),'unknown external outcome is held with its original timing');await db.exec('rollback');assert.deepEqual(await snapshot(db),before);
 await db.exec('begin');await db.exec(migration);const after=await snapshot(db);await db.exec('commit');
 await db.exec(fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_harden_private_coverage_recovery_rls.sql')),'utf8'));
 assert.equal((await db.query("select bool_and(relrowsecurity and relforcerowsecurity) enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='nothingsports_recovery' and c.relname like 'coverage_repair%' and relkind='r'")).rows[0].enabled,true);
 await db.exec('begin');await db.exec(fs.readFileSync('scripts/fixtures/bledisloe-identity-operator-rollback.sql','utf8'));assert.deepEqual(await snapshot(db),before,'guarded undo restores every original row without replay');await db.exec('rollback');assert.deepEqual(await snapshot(db),after);
 await db.exec('begin');await db.query('update nothingsports_predictions set updated_at=now() where event_id=$1',[canonical]);await assert.rejects(db.exec(fs.readFileSync('scripts/fixtures/bledisloe-identity-operator-rollback.sql','utf8')),/newer activity review/);await db.exec('rollback');
 assert.equal(after.nothingsports_predictions.length,1);assert.equal(after.nothingsports_predictions[0].rating,3);assert.equal(after.nothingsports_predictions[0].result,'pending');assert.equal(after.nothingsports_predictions[0].resolved_at,null);
 assert.equal(after.nothingsports_nsc_contributions.length,1);assert.equal(after.nothingsports_nsc_contributions[0].rating,3);assert.equal(after.nothingsports_nsc_rating_history.length,2);assert.equal(after.nothingsports_nsc_prediction_revisions.length,2);
 for(const p of before.nothingsports_nsc_points){const saved=after.nothingsports_nsc_points.find(x=>x.ledger_id===p.ledger_id);assert(saved);for(const key of ['user_id','points','action_key','sydney_day','awarded_at','sport'])assert.equal(saved[key],p[key]);assert.equal(saved.event_id,canonical);}assert.equal(after.nothingsports_nsc_points.filter(x=>x.identity_reconciled_into).length,1);
 assert.deepEqual(after.nothingsports_chat_rooms,before.nothingsports_chat_rooms);assert.deepEqual(after.nothingsports_user_state,before.nothingsports_user_state);assert.deepEqual(after.nothingsports_marquee_campaigns[0].draft_copy,before.nothingsports_marquee_campaigns[0].draft_copy);assert.equal(after.nothingsports_marquee_campaigns[0].state,'draft');assert(after.nothingsports_marquee_campaigns[0].correction_required);
 reminder=after.nothingsports_reminders[0];assert.equal(after.nothingsports_reminders.length,1);assert.equal(Date.parse(reminder.starts_at),Date.parse('2026-10-17T05:00:00Z'));assert.equal(Date.parse(reminder.remind_at),Date.parse('2026-10-17T04:45:00Z'));assert.equal(reminder.dispatched_at,null);assert.equal(reminder.delivery_started_at,null);assert.equal(reminder.schedule_state,'ready');
 assert.equal((await db.query('select count(*)::integer n from rehearsal_side_effects')).rows[0].n,0);assert.equal((await db.query("select count(*)::integer n from pg_trigger where not tgisinternal and tgenabled='D'")).rows[0].n,0);
 await db.exec('begin');await db.exec(migration);await db.exec('commit');assert.deepEqual(await snapshot(db),after,'unchanged rerun');
 await db.exec('set role service_role');assert.equal((await db.query('select nothingsports_bledisloe_identity_ready() ready')).rows[0].ready,true);
 for(const id of [canonical,old,old.replace(/:/g,'-'),ra,ra.replace(/:/g,'-')]){
  assert.equal((await db.query("select nothingsports_nsc_award_points($1,$2,'heat_rating',1) n",[user,id])).rows[0].n,0);
  const result=(await db.query("select nothingsports_rate_v2($1,$2,'heat',3,'2026-10-17T04:45:00Z','2026-10-17T07:45:00Z','scheduled','rugby','men') result",[user,id])).rows[0].result;assert.equal(result.eventId,canonical);assert.equal(result.pointsAwarded,0);
  const receipt=(await db.query("select * from nothingsports_nsc_submit_rating($1,$2,'heat',3,'{}')",[user,id])).rows[0];assert(receipt.replayed);assert.equal(receipt.event_id,canonical);
 }
 assert.equal((await db.query('select sum(points)::integer n from nothingsports_nsc_points')).rows[0].n,2);assert.equal(Date.parse((await db.query('select starts_at from nothingsports_score_fixtures')).rows[0].starts_at),Date.parse('2026-10-17T05:00:00Z'));
 const saved=(await db.query('select updated_at from nothingsports_user_state where user_id=$1',[user])).rows[0];
 const packet={user_id:user,expected_updated:saved.updated_at,items:[{fixture_id:old,aliases:[old],choice:'on',enabled:true,title:'Bledisloe',starts_at:'2026-10-17T05:45:00Z',precision:'exact'}]};
 await db.query('select nothingsports_reconcile_reminder_accounts($1::jsonb)',[JSON.stringify([packet])]);
 assert.equal((await db.query('select count(*)::integer n from nothingsports_reminders')).rows[0].n,1);assert.equal(Date.parse((await db.query('select starts_at from nothingsports_reminders')).rows[0].starts_at),Date.parse('2026-10-17T05:00:00Z'),'old dispatcher packet cannot restore stale timing');assert.equal((await db.query('select fixture_id from nothingsports_reminder_intents')).rows[0].fixture_id,canonical);
 await db.query('select nothingsports_set_reminder_choice($1,$2,$3::jsonb,false)',[user,ra,JSON.stringify([ra])]);assert.equal((await db.query('select count(*)::integer n from nothingsports_reminder_intents')).rows[0].n,1);assert.equal((await db.query('select choice from nothingsports_reminder_intents')).rows[0].choice,'off');
 const newer=(await db.query('select updated_at from nothingsports_user_state where user_id=$1',[user])).rows[0];packet.expected_updated=newer.updated_at;await db.query('select nothingsports_reconcile_reminder_accounts($1::jsonb)',[JSON.stringify([packet])]);assert.equal((await db.query('select choice from nothingsports_reminder_intents')).rows[0].choice,'off','an old ON packet cannot reverse explicit OFF');assert.equal((await db.query('select schedule_state from nothingsports_reminders')).rows[0].schedule_state,'off');
 await assert.rejects(db.query('select * from nothingsports_recovery.coverage_repair_rows'),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select nothingsports_bledisloe_identity_ready()'),/permission denied/);await db.exec('reset role');
 // Post-cutover OFF via an old saved-state key must cancel the canonical row.
 await db.query("update nothingsports_user_state set event_user_state=$2 where user_id=$1",[user,JSON.stringify({[old]:{reminderChoice:'off',reminderRequested:false,reminderChangedAt:new Date().toISOString()}})]);intent=(await db.query('select * from nothingsports_reminder_intents')).rows[0];assert.equal(intent.fixture_id,canonical);assert.equal(intent.choice,'off');assert.equal((await db.query('select schedule_state from nothingsports_reminders')).rows[0].schedule_state,'off');
 await db.query('update nothingsports_user_state set event_user_state=$2 where user_id=$1',[user,JSON.stringify({[ra]:{reminderChoice:'on',reminderRequested:true,reminderChangedAt:new Date(Date.now()-60000).toISOString()}})]);assert.equal((await db.query('select choice from nothingsports_reminder_intents')).rows[0].choice,'off','older saved ON cannot defeat latest OFF through another alias');assert.equal((await db.query('select event_user_state from nothingsports_user_state')).rows[0].event_user_state[ra].reminderChoice,'off');
 await db.exec('begin');await db.query('delete from auth.users where id=$1',[user]);assert.equal((await db.query("select count(*)::integer n from nothingsports_recovery.coverage_repair_rows where version='bledisloe-identity.20261002' and position($1 in payload::text)>0",[user])).rows[0].n,0);await db.exec('rollback');
 console.log('Bledisloe disposable database: latest unresolved prediction/rating, full history/revisions, original credits, OFF precedence and legacy OFF, pending timing, held unknown outcomes, receipt/no-replay, old dispatcher/choice/saved-state replay, RPC replay/host timing, unchanged rerun, trigger/ACL/private-state preservation and erasure passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
