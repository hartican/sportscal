'use strict';
// Disposable PGlite only. Schema/functions are sanitised production DDL, never
// account rows. The production cutover additionally rehearses a full ROLLBACK.
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const canonical='rugby-australia-south-africa-2026-09-27',old='fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945';
const user='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222';
const schema=require('./fixtures/rugby-identity-schema.json');
const migration=fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_rugby_reviewed_identity_reconciliation.sql')),'utf8');
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
async function bootstrap(db){
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema nothingsports_recovery;create table nothingsports_recovery.coverage_repair_versions(version text primary key,completed_at timestamptz,inventory jsonb not null default '{}');create table nothingsports_recovery.coverage_repair_rows(version text,table_name text,row_key text,payload jsonb,primary key(version,table_name,row_key));create table nothingsports_push_installations(installation_id uuid primary key);");
 await db.exec("create function auth.uid() returns uuid language sql as $$select null::uuid$$;");
 const tables=[...new Set(schema.columns.map(x=>x.table_name))];
 for(const table of tables){
  const columns=schema.columns.filter(x=>x.table_name===table).map(x=>'"'+x.column_name+'" '+x.type+(x.column_name==='id'&&['nothingsports_nsc_rating_history','nothingsports_nsc_prediction_revisions'].includes(table)?' generated always as identity':'')+(x.not_null?' not null':'')+(x.default_value&&!/nextval/.test(x.default_value)?' default '+x.default_value:'')).join(',');
  await db.exec('create table public."'+table+'"('+columns+');');
 }
 const seen=new Set();
 for(const c of schema.constraints.slice().sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY')))){
  if(c.definition.startsWith('CREATE UNIQUE INDEX')||seen.has(c.table_name+':'+c.conname))continue;
  // All account, fixture, ledger and reminder constraints are real. Unrelated
  // chat sender/storage references are outside this bounded identity rehearsal.
  if(c.definition.startsWith('FOREIGN KEY')&&!/REFERENCES (auth\.users|nothingsports_(?:score_fixtures|predictions|push_installations|live_rating_alerts|nsc_prediction_revisions))[( ]/.test(c.definition))continue;
  await db.exec('alter table "'+c.table_name+'" add constraint "'+c.conname+'" '+c.definition);
  seen.add(c.table_name+':'+c.conname);
 }
 await db.exec("create table nothingsports_score_epoch(started_at timestamptz);insert into nothingsports_score_epoch values('2026-09-01');create table nothingsports_nsc_personas(user_id uuid,moderation_flag boolean);create table rehearsal_side_effects(name text);create function rehearsal_side_effect() returns trigger language plpgsql as $$begin insert into public.rehearsal_side_effects values(tg_name);return new;end$$;");
 const selected=['fixture_alias_v1','alias_guard_v1','nothingsports_nsc_award_points','nothingsports_nsc_submit_rating','nothingsports_nsc_record_unconfirmed_opinion','nothingsports_rate_v2','nothingsports_resolve_predictions','nothingsports_resolve_predictions_legacy'];
 for(const f of schema.functions.filter(x=>selected.includes(x.proname))){
  await db.exec(f.definition);
  if(f.schema==='public')await db.exec('revoke all on function '+f.schema+'.'+f.proname+'('+f.args.split(', ').map(x=>x.replace(/^\w+ /,'')).join(',')+') from public,anon,authenticated;grant execute on function '+f.schema+'.'+f.proname+'('+f.args.split(', ').map(x=>x.replace(/^\w+ /,'')).join(',')+') to service_role;');
 }
 await db.exec('revoke all on schema nothingsports_recovery from public,anon,authenticated;revoke all on all tables in schema nothingsports_recovery from public,anon,authenticated,service_role;revoke all on all functions in schema nothingsports_recovery from public,anon,authenticated;grant all on all tables in schema public to service_role;');
 for(const table of tables.filter(x=>schema.columns.some(c=>c.table_name===x&&c.column_name==='event_id'))){
  await db.exec('create trigger fixture_alias_v1 before insert or update of event_id on '+table+' for each row execute function nothingsports_recovery.alias_guard_v1();');
 }
 for(const name of ['consensus_vote','nothingsports_live_rating_alert_outbox','nothingsports_nsc_lock_submitted_contribution','nsc_rating_history','nsc_vote_scoring_version']){
  await db.exec('create trigger '+name+' after insert or update on nothingsports_nsc_contributions for each row execute function rehearsal_side_effect();');
 }
 await db.exec('create trigger prediction_rule after insert or update on nothingsports_score_fixtures for each row execute function rehearsal_side_effect();');
 await db.query('insert into auth.users values($1),($2)',[user,peer]);
 for(const id of [canonical,old]){
  await db.query("insert into nothingsports_score_fixtures(event_id,sport,gender,starts_at,ends_at,status) values($1,$2,'men',$3,'2026-09-27T11:40:00Z','completed')",[id,id===old?'rugby':'rugby-open',id===old?'2026-09-27T09:30:00Z':'2026-09-27T09:45:00Z']);
  await db.query("insert into nothingsports_prediction_rules(event_id,version) values($1,'anticipation.v2')",[id]);
  for(const [phase,rating] of [['heat',4],['impact',5]]){
   await db.query("insert into nothingsports_nsc_contributions(event_id,user_id,phase,rating,submitted_at,updated_at) values($1,$2,$3,$4,'2026-09-27T12:00:00Z',$5)",[id,user,phase,rating,id===old?'2026-09-28T11:00:00Z':'2026-09-27T13:00:00Z']);
   await db.query("insert into nothingsports_nsc_rating_history(id,user_id,event_id,phase,rating,recorded_at) overriding system value values($1,$2,$3,$4,$5,'2026-09-27T12:00:00Z')",[phase==='heat'?(id===old?3:1):(id===old?4:2),user,id,phase,rating]);
  }
  await db.query("insert into nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,sport,awarded_at) values($1,$2,'impact_rating',2,'2026-09-27',$3,'2026-09-27T12:00:00Z')",[user,id,id===old?'rugby':'rugby-open']);
  await db.query("insert into nothingsports_score_votes(user_id,event_id,phase,rating,recorded_at) values($1,$2,'impact',5,'2026-09-27T12:00:00Z')",[user,id]);
 }
 await db.query("insert into nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,sport,awarded_at) values($1,$2,'pulse_participation',2,'2026-09-28','rugby-open','2026-09-28T12:00:00Z')",[user,canonical]);
 const install='33333333-3333-4333-8333-333333333333';
 await db.query('insert into nothingsports_push_installations values($1)',[install]);
 for(const id of [canonical,old])await db.query("insert into nothingsports_reminders(installation_id,user_id,event_id,title,starts_at,remind_at,dispatched_at) values($1,$2,$3,'Past Rugby','2026-09-27T09:45:00Z','2026-09-27T09:30:00Z','2026-09-27T09:30:01Z')",[install,user,id]);
 // Distinct private rooms are deliberately present on both IDs.
 for(const id of [canonical,old])await db.query("insert into nothingsports_chat_rooms(canonical_fixture_id,fixture_snapshot,room_name,created_by) values($1,'{}','Private Rugby',$2)",[id,user]);
 await db.query("insert into nothingsports_user_state(user_id,event_user_state,ratings,event_spoiler_state,archived_events) values($1,$2,$3,$4,$5)",[user,JSON.stringify({[old]:{reminderRequested:true}}),JSON.stringify({[old]:5}),JSON.stringify({[old]:{revealed:true}}),JSON.stringify([{id:old,privateDraft:'retained'}])]);
 await db.exec('delete from rehearsal_side_effects');
}
async function snapshot(db){
 const tables=[...new Set(schema.columns.map(x=>x.table_name))];
 const data={};for(const table of tables)data[table]=(await db.query('select to_jsonb(s) value from '+table+' s order by to_jsonb(s)::text')).rows.map(x=>x.value);
 return data;
}
(async()=>{const db=new PGlite();try{
 await bootstrap(db);const before=await snapshot(db);
 // Reject new unresolved activity without leaving schema or data behind.
 await db.exec('begin');
 await db.query("insert into nothingsports_predictions(user_id,event_id,rating) values($1,$2,4)",[user,old]);
 await assert.rejects(db.exec(migration),/additional activity review: nothingsports_predictions/);await db.exec('rollback');
 assert.deepEqual(await snapshot(db),before,'rejected reconciliation rolls back');
 await db.exec('begin');
 await db.query('update nothingsports_reminders set dispatched_at=null where event_id=$1',[old]);
 await assert.rejects(db.exec(migration),/reminder delivery state needs review/);await db.exec('rollback');
 assert.deepEqual(await snapshot(db),before,'pending reminders cannot be replayed by repair');
 await db.exec('begin');
 await db.query("update nothingsports_nsc_contributions set rating=3 where event_id=$1 and phase='impact'",[old]);
 await db.exec(migration);
 assert.equal((await db.query("select rating from nothingsports_nsc_contributions where event_id=$1 and phase='impact'",[canonical])).rows[0].rating,3,'latest differing rating survives');
 await db.exec('rollback');assert.deepEqual(await snapshot(db),before,'successful rehearsal is reversible');
 await db.exec('delete from rehearsal_side_effects');
 await db.exec('begin');await db.exec(migration);await db.exec('commit');
 const after=await snapshot(db);
 await db.exec('begin');await db.exec(fs.readFileSync('scripts/fixtures/rugby-identity-operator-rollback.sql','utf8'));
 const undone=await snapshot(db);undone.nothingsports_nsc_points.forEach(row=>delete row.identity_reconciled_into);
 assert.deepEqual(undone,before,'guarded operator undo restores original rows without replay');
 await db.exec('rollback');assert.deepEqual(await snapshot(db),after,'undo rehearsal itself rolls back');
 await db.exec('begin');await db.query("update nothingsports_nsc_contributions set updated_at='2026-10-02T05:00:00Z' where event_id=$1",[canonical]);
 await assert.rejects(db.exec(fs.readFileSync('scripts/fixtures/rugby-identity-operator-rollback.sql','utf8')),/newer activity review/);await db.exec('rollback');
 assert.equal((await db.query('select public.nothingsports_rugby_identity_ready() ready')).rows[0].ready,true);

 assert.equal(after.nothingsports_nsc_points.length,3,'each earned ledger row retained');
 for(const p of before.nothingsports_nsc_points){const saved=after.nothingsports_nsc_points.find(x=>x.ledger_id===p.ledger_id);assert(saved);for(const key of ['user_id','points','action_key','sydney_day','awarded_at','sport'])assert.equal(saved[key],p[key],key+' remains original');assert.equal(saved.event_id,canonical);}
 assert.equal(after.nothingsports_nsc_points.filter(x=>x.identity_reconciled_into).length,1);
 assert.equal(after.nothingsports_nsc_contributions.length,2);
 assert(after.nothingsports_nsc_contributions.every(x=>Date.parse(x.updated_at)===Date.parse('2026-09-28T11:00:00Z')),'latest phase ratings survive');
 assert.equal(after.nothingsports_nsc_rating_history.length,4);
 assert.deepEqual(after.nothingsports_chat_rooms,before.nothingsports_chat_rooms,'private room boundaries and payloads unchanged');
 assert.deepEqual(after.nothingsports_user_state,before.nothingsports_user_state,'saved ratings, spoiler state, archives and drafts unchanged');
 assert.equal(after.nothingsports_reminders.length,1);assert(after.nothingsports_reminders[0].dispatched_at,'no replay');
 assert.equal((await db.query('select count(*)::integer n from rehearsal_side_effects')).rows[0].n,0,'no rating/prediction/notification side effects');
 assert.equal((await db.query("select count(*)::integer n from pg_trigger where not tgisinternal and tgenabled='D'")).rows[0].n,0);
 const recovery=(await db.query("select inventory from nothingsports_recovery.coverage_repair_versions where version='rugby-identity.20261002'")).rows[0].inventory;
 assert.equal(recovery.creditsBefore,6);assert.equal(recovery.creditsAfter,6);
 const archived=(await db.query("select table_name,payload from nothingsports_recovery.coverage_repair_rows where version='rugby-identity.20261002' and table_name<>'@function'")).rows;
 assert(archived.some(x=>x.table_name==='nothingsports_nsc_contributions'&&x.payload.event_id===old),'superseded state recoverable');
 await db.exec('begin');await db.exec(migration);await db.exec('commit');assert.deepEqual(await snapshot(db),after,'repeat changes nothing');
 await db.exec('set role service_role');
 for(const id of [canonical,old,old.replace(/:/g,'-'),'fixture:rugby:ra:949625','fixture-rugby-ra-949625']){
  assert.equal((await db.query("select nothingsports_nsc_award_points($1,$2,'impact_rating',2) n",[user,id])).rows[0].n,0,'legacy or canonical reward cannot repeat');
  const result=(await db.query("select nothingsports_rate_v2($1,$2,'impact',5,'2026-09-27T09:30:00Z','2026-09-27T11:40:00Z','completed','rugby','men') result",[user,id])).rows[0].result;
  assert.equal(result.eventId,canonical);assert.equal(result.pointsAwarded,0);
  const r=(await db.query("select * from nothingsports_nsc_submit_rating($1,$2,'heat',4,'{}')",[user,id])).rows[0];
  assert.equal(r.event_id,canonical);assert.equal(r.replayed,true);
  await assert.rejects(db.query("select * from nothingsports_nsc_submit_rating($1,$2,'heat',3,'{}')",[user,id]),/nsc_already_submitted/);
 }
 assert.equal((await db.query("select coalesce(sum(points),0)::integer n from nothingsports_nsc_points")).rows[0].n,6);
 assert.equal(Date.parse((await db.query('select starts_at from nothingsports_score_fixtures where event_id=$1',[canonical])).rows[0].starts_at),Date.parse('2026-09-27T09:45:00Z'),'old deployed API cannot restore the wrong kickoff');
 await assert.rejects(db.query('select * from nothingsports_recovery.coverage_repair_rows'),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query("select nothingsports_rate_v2($1,$2,'impact',5,null,null,'completed','rugby','men')",[user,old]),/permission denied/);
 await assert.rejects(db.query('select * from nothingsports_recovery.coverage_repair_subjects'),/permission denied/);await db.exec('reset role');
 await db.exec('begin');await db.query('delete from auth.users where id=$1',[user]);assert.equal((await db.query("select count(*)::integer n from nothingsports_recovery.coverage_repair_subjects where user_id=$1",[user])).rows[0].n,0);assert.equal((await db.query("select count(*)::integer n from nothingsports_recovery.coverage_repair_rows where version='rugby-identity.20261002' and position($1 in payload::text)>0",[user])).rows[0].n,0,'erasure removes copied personal preimages');await db.exec('rollback');
 assert((await db.query("select count(*)::integer n from nothingsports_recovery.coverage_repair_rows where version='rugby-identity.20261002' and table_name='@function'")).rows[0].n>0,'non-personal rollback definitions survive');
 console.log('Rugby database: original ledgers/day/category, latest ratings/full history, private rooms/saved state, delivered reminders, old RPC replays, fixed kickoff, trigger/ACL preservation, private recovery and disposable erasure/rollback passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
