'use strict';
// Actual dated definitions/constraints, invented users only; no production access.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),fixtureDir=path.join(root,'scripts/fixtures/epl-identity');
const schema=JSON.parse(fs.readFileSync(path.join(fixtureDir,'epl-writer-schema.json')));
const canonicalA='event:premier-league:128968',legacyA='event:football:premier-league:401879273';
const canonicalB='event:premier-league:128969',legacyB='event:football:premier-league:401879272';
const user='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222',peer='33333333-3333-4333-8333-333333333333';
const tables=['nothingsports_score_fixtures','nothingsports_prediction_rules','nothingsports_predictions','nothingsports_nsc_points','nothingsports_nsc_contributions','nothingsports_score_votes','nothingsports_consensus_votes','nothingsports_consensus_receipts','nothingsports_inbox'];
const passed=[];
const realTriggers=true;
const trackedTables=[...tables,...(realTriggers?['nothingsports_nsc_rating_history','nothingsports_friend_activity','nothingsports_live_rating_alerts']:[])];
async function snapshot(db){const result={};for(const table of trackedTables)result[table]=(await db.query('select to_jsonb(t) row from '+table+' t order by to_jsonb(t)::text')).rows.map(x=>x.row);return result;}
async function transaction(db,fn){await db.exec('begin');try{await fn();}finally{await db.exec('rollback');}}
async function setup(db){
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema nothingsports_recovery;create table public.nothingsports_chat_rooms(id uuid primary key);create table public.nothingsports_nsc_personas(user_id uuid,moderation_flag boolean);create table public.nothingsports_score_epoch(started_at timestamptz);insert into public.nothingsports_score_epoch values('2026-09-01');create table public.rehearsal_effects(name text);create function public.rehearsal_audit() returns trigger language plpgsql as $$begin insert into public.rehearsal_effects values(tg_name);return new;end$$;");
 const sourceSchema=require('../fixtures/epl-identity/current-source-relation-schema.json');
 // The parent source ID is a local stub; current-row columns, checks, keys and
 // indexes are the captured real DDL. No source/health writer runs here.
 await db.exec("create table nothingsports_fixture_sources(source_id text primary key);insert into nothingsports_fixture_sources values('live-premier-league');");
 await db.exec('create table nothingsports_fixture_current('+sourceSchema.columns.map(x=>'"'+x.column_name+'" '+x.type+(x.not_null?' not null':'')+(x.default_value?' default '+x.default_value:'')).join(',')+')');
 for(const c of sourceSchema.constraints)await db.exec('alter table nothingsports_fixture_current add constraint "'+c.name+'" '+c.definition);
 for(const i of sourceSchema.indexes)await db.exec(i.replace(/CREATE (UNIQUE )?INDEX /,'$&IF NOT EXISTS '));
 for(const table of tables){const cols=schema.columns.filter(x=>x.table_name===table).map(x=>'"'+x.column_name+'" '+x.type+(x.not_null?' not null':'')+(x.default_value?' default '+x.default_value:''));assert(cols.length);await db.exec('create table public.'+table+'('+cols.join(',')+');');}
 for(const constraint of schema.constraints.filter(x=>tables.includes(x.table_name)).sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY'))))await db.exec('alter table '+constraint.table_name+' add constraint "'+constraint.conname+'" '+constraint.definition);
 for(const index of schema.indexes.filter(x=>tables.includes(x.table_name)))await db.exec(index.definition.replace(/CREATE (UNIQUE )?INDEX /,'$&IF NOT EXISTS '));
 for(const name of ['fixture_alias_v1','alias_guard_v1','nothingsports_nsc_award_points','nothingsports_nsc_submit_rating','nothingsports_rate_v2','nothingsports_resolve_predictions','nothingsports_resolve_predictions_legacy'])await db.exec(schema.functions.find(x=>x.proname===name).definition);
 for(const table of tables)await db.exec('create trigger fixture_alias_v1 before insert or update of event_id on '+table+' for each row execute function nothingsports_recovery.alias_guard_v1();');
 // Trace any cutover write. Real affected effects are installed below; no
 // sender or account replay runs in this disposable test.
 for(const table of tables)await db.exec('create trigger rehearsal_audit after insert or update or delete on '+table+' for each row execute function public.rehearsal_audit();');
 await db.exec('revoke all on schema nothingsports_recovery from public,anon,authenticated;grant usage on schema nothingsports_recovery to service_role;revoke all on all functions in schema nothingsports_recovery from public,anon,authenticated;grant execute on function nothingsports_recovery.fixture_alias_v1(text) to service_role;revoke all on all functions in schema public from public,anon,authenticated;grant execute on all functions in schema public to service_role;grant all on all tables in schema public to service_role;');
 await db.query('insert into auth.users values($1),($2),($3)',[user,second,peer]);
 for(const id of [canonicalA,canonicalB,legacyA,legacyB]){
  const old=id===legacyA||id===legacyB;
  await db.query("insert into nothingsports_score_fixtures values($1,'football','men',$2,$3,$4)",[id,old?'2026-09-19T14:00Z':'2026-09-20T13:00Z',old?'2026-09-19T16:00Z':'2026-09-20T15:00Z',old?'upcoming':'completed']);
  await db.query("insert into nothingsports_prediction_rules(event_id,version) values($1,'anticipation.v2')",[id]);
 }
 const events=require('../fixtures/epl-identity/accepted-source-facts.json').fixtures;
 for(const fixture of events.filter(x=>x.competitionId==='competition:premier-league-2026-27'))await db.query('insert into nothingsports_fixture_current(source_id,fixture_id,fixture,content_hash) values($1,$2,$3,$4)', ['live-premier-league',fixture.id,fixture,'controlled-replay']);
 for(const [id,who,rating,stamp] of [[legacyA,user,3,'2026-09-16T05:17:34Z'],[legacyB,second,3,'2026-09-16T05:16:49Z'],[canonicalB,second,4,'2026-09-20T07:30:11Z']]){
  await db.query("insert into nothingsports_nsc_contributions(event_id,user_id,phase,rating,submitted_at,created_at,updated_at) values($1,$2,'heat',$3,$4,$4,$4)",[id,who,rating,stamp]);
  await db.query("insert into nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,awarded_at,sport) values($1,$2,'heat_rating',1,'2026-09-16',$3,'football')",[who,id,stamp]);
  const settled=id===canonicalB;
  await db.query('insert into nothingsports_predictions(user_id,event_id,rating,created_at,updated_at,result,resolved_at) values($1,$2,$3,$4,$4,$5,$6)',[who,id,rating,stamp,settled?'unscored':'pending',settled?'2026-09-20T16:00Z':null]);
 }
 await db.exec('delete from rehearsal_effects');
}
async function installRealTriggers(db){
 const effects=JSON.parse(fs.readFileSync(path.join(fixtureDir,'current-writer-trigger-effects.json'))),alerts=JSON.parse(fs.readFileSync(path.join(fixtureDir,'current-writer-alert-triggers.json')));
 effects.triggers.push(...alerts.triggers);
 const dependencies=JSON.parse(fs.readFileSync(path.join(fixtureDir,'current-writer-effect-schema.json'))),alertSchema=JSON.parse(fs.readFileSync(path.join(fixtureDir,'current-writer-alert-schema.json')));
 dependencies.columns.push(...alertSchema.columns);dependencies.constraints.push(...alertSchema.constraints);
 await db.exec('drop table nothingsports_nsc_personas;drop table nothingsports_score_epoch;create schema private;');
 for(const table of [...new Set(dependencies.columns.map(x=>x.table_name))]){
  const columns=dependencies.columns.filter(x=>x.table_name===table).map(x=>'"'+x.column_name+'" '+x.type+(x.column_name==='id'&&table==='nothingsports_nsc_rating_history'?' generated always as identity':'')+(x.not_null?' not null':'')+(x.default_value&&!x.default_value.includes('nextval(')?' default '+x.default_value:''));
  await db.exec('create table '+table+'('+columns.join(',')+')');
 }
 for(const constraint of dependencies.constraints.slice().sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY'))))await db.exec('alter table '+constraint.table_name+' add constraint "'+constraint.conname+'" '+constraint.definition);
 for(const index of alertSchema.indexes)await db.exec(index.definition.replace(/CREATE (UNIQUE )?INDEX /,'$&IF NOT EXISTS '));
 await db.exec("insert into nothingsports_score_epoch values('rehearsal','2026-09-01');insert into nothingsports_consensus_settings values(true,'2026-09-01');");
 for(const fn of effects.functions)await db.exec(fn.definition);
 for(const trigger of effects.triggers){await db.exec('drop trigger if exists "'+trigger.name+'" on '+trigger.table_name);await db.exec(trigger.definition);}
 await db.exec('revoke all on schema private from public,anon,authenticated,service_role;revoke all on all functions in schema private from public,anon,authenticated,service_role;revoke all on all functions in schema public from public,anon,authenticated;grant execute on all functions in schema public to service_role;grant all on all tables in schema public to service_role;');
 // Retained fabricated history, under the same real identity/account FKs.
 await db.exec('insert into nothingsports_nsc_rating_history(user_id,event_id,phase,rating,recorded_at) select user_id,event_id,phase,rating,updated_at from nothingsports_nsc_contributions;delete from rehearsal_effects;');
}
async function runWriterChecks(db){
 const before=await snapshot(db);assert.equal((await db.query('select count(*)::int n from rehearsal_effects')).rows[0].n,2);passed.push('exact guarded cutover adds only the required world parent and copied original rule');
 for(const [id,who,rating,points] of [[legacyA,user,3,1],[canonicalA,user,3,1],[legacyB,second,4,2]]){
  const [receipt]=(await db.query("select * from nothingsports_nsc_submit_rating($1,$2,'heat',$3,'{}','2026-10-12T20:00Z')",[who,id,rating])).rows;assert(receipt.replayed);assert.equal(receipt.rating,rating);assert.equal(receipt.points_awarded,points);
 }
 assert.deepEqual(await snapshot(db),before);passed.push('old/new immutable submissions replay latest rating and all original credits');
 await assert.rejects(db.query("select * from nothingsports_nsc_submit_rating($1,$2,'heat',5,'{}')",[user,legacyA]),/nsc_already_submitted/);await assert.rejects(db.query("select * from nothingsports_nsc_submit_rating($1,$2,'heat',3,array['Rivalry'])",[user,legacyA]),/invalid_nsc_submission/);passed.push('immutable disagreement and existing tag validation retained');
 for(const id of [canonicalA,legacyA])assert.equal((await db.query("select nothingsports_nsc_award_points($1,$2,'heat_rating',1) value",[user,id])).rows[0].value,0);
 assert.deepEqual(await snapshot(db),before);passed.push('duplicate awards across old/new identities mint no points');
 await transaction(db,async()=>{await db.query("insert into nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,awarded_at) values($1,$2,'impact_valid_tags',8,'2026-09-16','2026-09-16')",[user,canonicalA]);assert.equal((await db.query("select nothingsports_nsc_award_points($1,$2,'impact_rating',2,'2026-10-12T20:00Z') value",[user,legacyA])).rows[0].value,1);});passed.push('fixture cap counts original old-namespace credits');
 // This first fails until old-host sporting arguments are safely replaced by
 // the current validated primary fact. No deadline/completion is invented.
 await transaction(db,async()=>{await assert.rejects(db.query("select nothingsports_rate_v2($1,$2,'heat',4,'2099-09-19T14:00Z','2099-09-19T16:00Z','upcoming','football','men')",[user,legacyA]),/phase_action_mismatch/);});passed.push('stale old-host timing/status cannot reopen a completed match');
 for(const mutation of ["delete from nothingsports_fixture_current", "update nothingsports_fixture_current set fixture=fixture-'startTimeUtc'", "update nothingsports_fixture_current set fixture=jsonb_set(fixture,'{status}','\"QA_UNKNOWN\"')", "update nothingsports_fixture_current set fixture=jsonb_set(fixture,'{participantIds}','[]')"]){await transaction(db,async()=>{await db.exec(mutation);await assert.rejects(db.query("select nothingsports_rate_v2($1,$2,'impact',4,'2026-09-19','2026-09-20','completed','football','men')",[user,legacyA]),/epl_fixture_evidence_unavailable/);});}passed.push('missing/unknown primary facts and wrong sides reject old-host sporting writes');
 await transaction(db,async()=>{
  const future=require(path.join(root,'scripts/fixtures/epl-provider-identity-20261013.json')).fixtures.find(x=>x.primary.status==='upcoming'),p=future.primary,s=future.secondary;
  // Controlled future clocks keep this regression useful after the captured
  // appointment has passed. They are never sporting evidence or release data.
  const starts=new Date(Math.floor(Date.now()/1000)*1000+30*864e5).toISOString(),ends=new Date(Date.parse(starts)+72e5).toISOString(),obsolete=new Date(Date.parse(starts)+864e5).toISOString();
  await db.query("update nothingsports_fixture_current set fixture=fixture||$2::jsonb where fixture_id=$1",[p.id,JSON.stringify({startTimeUtc:starts,endTimeUtc:ends,status:'upcoming'})]);
  await db.query("select nothingsports_rate_v2($1,$2,'heat',3,$3,$4,'upcoming','football','men')",[peer,s.canonicalEventId,obsolete,obsolete]);
  const world=(await db.query('select * from nothingsports_score_fixtures where event_id=$1',[p.canonicalEventId])).rows[0];assert.equal(Date.parse(world.starts_at),Date.parse(starts));assert.equal(Date.parse(world.ends_at),Date.parse(ends));
 });passed.push('a prospective old-key forecast uses the reviewed current appointment rather than the retained obsolete time');
 await transaction(db,async()=>{
  const future=require(path.join(root,'scripts/fixtures/epl-provider-identity-20261013.json')).fixtures.find(x=>x.primary.status==='upcoming');
  await db.query("update nothingsports_fixture_current set fixture=(fixture-'startTimeUtc'-'endTimeUtc')||'{\"status\":\"live\"}'::jsonb where fixture_id=$1",[future.primary.id]);
  const result=(await db.query("select nothingsports_rate_v2($1,$2,'heat',3,'2099-01-01','2099-01-02','upcoming','football','men') value",[peer,future.secondary.canonicalEventId])).rows[0].value;
  const world=(await db.query('select * from nothingsports_score_fixtures where event_id=$1',[future.primary.canonicalEventId])).rows[0];assert.equal(world.starts_at,null);assert.equal(world.ends_at,null);assert.equal(world.status,'upcoming');assert.equal(result.foresightEligible,false);
 });passed.push('unknown source clocks remain unknown; a raw live enum cannot override the caller’s existing qualification');
 // Drive the actual rewards owner into the exact migrated RPC, without network
 // access. Estimated appointment clocks and actual finish clocks are different.
 const servicePath=require.resolve('../../lib/supabase-server'),rewardPath=require.resolve('../../lib/nsc-rewards');require(servicePath);const serviceModule=require.cache[servicePath],originalService=serviceModule.exports,originalReward=require.cache[rewardPath];
 const timingFailures=[];
 try{
  serviceModule.exports={...originalService,async supabaseServiceRequest(route,{body}){assert.equal(route,'/rest/v1/rpc/nothingsports_rate_v2');return(await db.query('select nothingsports_rate_v2($1,$2,$3,$4,$5,$6,$7,$8,$9) value',[body.target_user_id,body.target_event_id,body.target_phase,body.target_rating,body.fixture_start,body.fixture_end,body.fixture_status,body.fixture_sport,body.fixture_gender])).rows[0].value;}};
  delete require.cache[rewardPath];const rewards=require(rewardPath),fixtures=require('../fixtures/epl-identity/accepted-source-facts.json').fixtures;
  for(const precision of ['estimated','date-only','not-before'])try{await transaction(db,async()=>{
   const fixture={...fixtures.find(x=>x.id==='epl-2026-27-129085'),timePrecision:precision};await db.query('update nothingsports_fixture_current set fixture=$2 where fixture_id=$1',[fixture.id,fixture]);
   const result=await rewards.submit(peer,fixture.canonicalEventId,'heat',3,fixture);assert.equal(result.foresightEligible,false,precision+' does not establish a confirmed prediction clock');
   const world=(await db.query('select * from nothingsports_score_fixtures where event_id=$1',[fixture.canonicalEventId])).rows[0];assert.equal(world.starts_at,null);assert.equal((await db.query('select result from nothingsports_predictions where event_id=$1 and user_id=$2',[fixture.canonicalEventId,peer])).rows[0].result,'unscored');
  });}catch(e){timingFailures.push(e.message);}
  for(const flag of ['timeTbc','startTimeTbc','dateOnly'])try{await transaction(db,async()=>{
   const fixture={...fixtures.find(x=>x.id==='epl-2026-27-129085'),timePrecision:'exact',[flag]:true};await db.query('update nothingsports_fixture_current set fixture=$2 where fixture_id=$1',[fixture.id,fixture]);const result=await rewards.submit(peer,fixture.canonicalEventId,'heat',3,fixture);assert.equal(result.foresightEligible,false,flag+' cannot establish a confirmed start');
  });}catch(e){timingFailures.push(e.message);}
  try{await transaction(db,async()=>{
   const fixture={...fixtures.find(x=>x.id==='epl-2026-27-128968'),actualEndTimeUtc:'2026-09-20T15:11:00Z'};await rewards.submit(peer,legacyA,'impact',5,fixture);
   const world=(await db.query('select * from nothingsports_score_fixtures where event_id=$1',[canonicalA])).rows[0];assert.equal(Date.parse(world.ends_at),Date.parse(fixture.actualEndTimeUtc),'actual rewards finish cannot be replaced by the scheduled two-hour window');
  });}catch(e){timingFailures.push(e.message);}
 }finally{serviceModule.exports=originalService;delete require.cache[rewardPath];if(originalReward)require.cache[rewardPath]=originalReward;}
 assert.deepEqual(timingFailures,[]);passed.push('actual rewards owner keeps estimated/date-only/not-before forecasts unscored and preserves its qualified actual finish');
 await transaction(db,async()=>{
  await db.query("update nothingsports_fixture_current set fixture=fixture||'{\"actualEndTimeUtc\":\"2026-09-20T15:11:00Z\"}'::jsonb where fixture_id='epl-2026-27-128968'");
  await db.query("select nothingsports_rate_v2($1,$2,'impact',5,'2026-09-19T14:00Z','2026-09-19T16:00Z','upcoming','football','men')",[peer,legacyA]);assert.equal(Date.parse((await db.query('select ends_at from nothingsports_score_fixtures where event_id=$1',[canonicalA])).rows[0].ends_at),Date.parse('2026-09-20T15:11Z'));
 });
 for(const invalidEnd of ['2099-01-01T00:00Z','2026-09-20T12:00Z'])await transaction(db,async()=>{await assert.rejects(db.query("select nothingsports_rate_v2($1,$2,'impact',5,'2026-09-20T13:00Z',$3,'completed','football','men')",[peer,legacyA,invalidEnd]),/epl_fixture_evidence_unavailable/);});passed.push('explicit source finish can correct an old host; future or pre-start finish arguments cannot change the world record');
 await transaction(db,async()=>{
  // Model an old PL/pgSQL frame that has passed its host phase/alias checks
  // before waiting on the cutover's existing global lock. Use the captured
  // old body with its old alias result retained, and the new table triggers.
  const oldBody=schema.functions.find(x=>x.proname==='nothingsports_rate_v2').definition.replace('target_event_id:=nothingsports_recovery.fixture_alias_v1(target_event_id);','-- Retained legacy target from the already-running old frame.');
  await db.exec(oldBody);
  await assert.rejects(db.query("select nothingsports_rate_v2($1,$2,'heat',3,'2099-09-19T14:00Z','2099-09-19T16:00Z','upcoming','football','men')",[peer,legacyA]),/phase_action_mismatch/);
 });passed.push('an already-running old writer cannot resume across cutover and reopen a completed primary or award a new forecast');
 await transaction(db,async()=>{
  const definition=schema.functions.find(x=>x.proname==='nothingsports_nsc_submit_rating').definition,alias=/target_event_id\s*:=\s*nothingsports_recovery\.fixture_alias_v1\(target_event_id\);/g;assert.equal([...definition.matchAll(alias)].length,1);
  await db.exec(definition.replace(alias,'-- Retained legacy target in the already-running immutable frame.'));
  await assert.rejects(db.query("select * from nothingsports_nsc_submit_rating($1,$2,'heat',3,'{}')",[peer,legacyA]),/phase_action_mismatch/);
 });passed.push('the already-running immutable writer also cannot create a new late heat contribution');
 await transaction(db,async()=>{
  const future=require(path.join(root,'scripts/fixtures/epl-provider-identity-20261013.json')).fixtures.find(x=>x.primary.status==='upcoming'),starts=new Date(Math.floor(Date.now()/1000)*1000+30*864e5).toISOString(),ends=new Date(Date.parse(starts)+72e5).toISOString();
  await db.query('update nothingsports_fixture_current set fixture=fixture||$2::jsonb where fixture_id=$1',[future.primary.id,JSON.stringify({startTimeUtc:starts,endTimeUtc:ends,status:'upcoming'})]);
  const oldBody=schema.functions.find(x=>x.proname==='nothingsports_rate_v2').definition.replace('target_event_id:=nothingsports_recovery.fixture_alias_v1(target_event_id);','-- Retained old frame target.');await db.exec(oldBody);
  const result=(await db.query("select nothingsports_rate_v2($1,$2,'heat',3,'2099-01-01','2099-01-02','upcoming','football','men') value",[peer,future.secondary.canonicalEventId])).rows[0].value;assert.equal(result.pointsAwarded,1);
  const world=(await db.query('select * from nothingsports_score_fixtures where event_id=$1',[future.primary.canonicalEventId])).rows[0];assert.equal(Date.parse(world.starts_at),Date.parse(starts));assert.equal(Date.parse(world.ends_at),Date.parse(ends));
 });passed.push('a legitimate old-frame future forecast still succeeds once with the accepted current clock');
 await transaction(db,async()=>{
  const fixture=require('../fixtures/epl-identity/accepted-source-facts.json').fixtures.find(x=>x.id==='epl-2026-27-129085');assert.equal(fixture.timePrecision,'estimated');
  const oldBody=schema.functions.find(x=>x.proname==='nothingsports_rate_v2').definition.replace('target_event_id:=nothingsports_recovery.fixture_alias_v1(target_event_id);','-- Retained old frame target.');await db.exec(oldBody);
  await assert.rejects(db.query("select nothingsports_rate_v2($1,$2,'heat',3,'2099-01-01','2099-01-02','upcoming','football','men')",[peer,fixture.canonicalEventId]),/phase_action_mismatch/);
 });passed.push('an old frame cannot return prediction eligibility from an unconfirmed source appointment');
 const settledBefore=(await db.query('select to_jsonb(p) row from nothingsports_predictions p where event_id=$1 and user_id=$2',[canonicalB,second])).rows[0].row;
 await transaction(db,async()=>{
  // A queued old resolver can retain its legacy target before the cutover
  // lock. Model that captured body against the new durable write boundary.
  await db.exec('alter table nothingsports_score_votes disable trigger fixture_alias_v1');
  await db.query("insert into nothingsports_score_votes values($1,$2,'impact',3,'2026-09-19T15:00Z')",[peer,legacyB]);
  await db.exec('alter table nothingsports_score_votes enable trigger fixture_alias_v1');
  const oldBody=schema.functions.find(x=>x.proname==='nothingsports_resolve_predictions_legacy').definition.replace('target_event_id:=nothingsports_recovery.fixture_alias_v1(target_event_id);','-- Retained legacy target from an already-running old resolver.');
  await db.exec(oldBody);
  await assert.rejects(async()=>{
   const result=await db.query('select nothingsports_resolve_predictions_legacy($1)',[legacyB]);
   console.error(JSON.stringify({unexpectedOldResolverResult:result.rows,legacyOutcome:(await db.query('select result from nothingsports_predictions where event_id=$1 and user_id=$2',[legacyB,second])).rows,bonusRows:(await db.query("select action_key,points from nothingsports_nsc_points where user_id=$1 and action_key='foresight_bonus'",[second])).rows}));
  },/epl_prediction_settlement_requires_current_owner/);
 });passed.push('queued old resolver cannot settle or award an alias of an already-settled forecast');
 await transaction(db,async()=>{
  await db.query("update nothingsports_prediction_rules set version='consensus.v1',completed_at='2026-09-19T16:00Z',cutoff='2026-09-21T16:00Z' where event_id in($1,$2)",[legacyB,canonicalB]);
  await db.exec('alter table nothingsports_consensus_votes disable trigger fixture_alias_v1');
  await db.query("insert into nothingsports_consensus_votes values($1,$2,3,'2026-09-20T15:00Z')",[legacyB,peer]);
  await db.exec('alter table nothingsports_consensus_votes enable trigger fixture_alias_v1');
  const oldBody=schema.functions.find(x=>x.proname==='nothingsports_resolve_predictions').definition.replace('target_event_id:=nothingsports_recovery.fixture_alias_v1(target_event_id);','-- Retained old consensus resolver target.');await db.exec(oldBody);
  await assert.rejects(db.query('select nothingsports_resolve_predictions($1)',[legacyB]),/epl_prediction_settlement_requires_current_owner/);
 });passed.push('queued old consensus resolver cannot rewrite a settled sibling or mint a duplicate receipt');
 await transaction(db,async()=>{
  await db.exec('alter table nothingsports_score_votes disable trigger fixture_alias_v1');await db.query("insert into nothingsports_score_votes values($1,$2,'impact',3,'2026-09-19T15:00Z')",[peer,legacyA]);await db.exec('alter table nothingsports_score_votes enable trigger fixture_alias_v1');
  const oldBody=schema.functions.find(x=>x.proname==='nothingsports_resolve_predictions_legacy').definition.replace('target_event_id:=nothingsports_recovery.fixture_alias_v1(target_event_id);','-- Retained old world clock and target.');await db.exec(oldBody);
  await assert.rejects(db.query('select nothingsports_resolve_predictions_legacy($1)',[legacyA]),/epl_prediction_settlement_requires_current_owner/);
 });passed.push('queued old resolver cannot settle from obsolete clocks even without a settled sibling');
 await transaction(db,async()=>{
  await db.query("select set_config('nothingsports.epl_resolver_scope',$1,true)",[canonicalB]);
  await assert.rejects(db.query("update nothingsports_predictions set result='success' where event_id=$1 and user_id=$2",[canonicalB,second]),/epl_prediction_already_settled/);
 });
 await transaction(db,async()=>{
  await db.query("select set_config('nothingsports.epl_resolver_scope',$1,true)",[canonicalB]);
  await assert.rejects(db.query("update nothingsports_predictions set result='success',resolved_at=clock_timestamp() where event_id=$1 and user_id=$2",[legacyB,second]),/epl_prediction_alias_already_settled/);
 });passed.push('durable result-only updates preserve both the original settled outcome and its pending duplicate');
 for(const resolver of ['nothingsports_resolve_predictions','nothingsports_resolve_predictions_legacy'])await transaction(db,async()=>{
  assert.equal((await db.query('select '+resolver+'($1) value',[legacyB])).rows[0].value,0);assert.deepEqual((await db.query('select to_jsonb(p) row from nothingsports_predictions p where event_id=$1 and user_id=$2',[canonicalB,second])).rows[0].row,settledBefore);assert.equal((await db.query('select result from nothingsports_predictions where event_id=$1 and user_id=$2',[legacyB,second])).rows[0].result,'pending');assert.deepEqual((await snapshot(db)).nothingsports_nsc_points,before.nothingsports_nsc_points);
 });passed.push('both resolvers preserve settled alias and never resettle its pending duplicate');
 await transaction(db,async()=>{await db.exec('alter table nothingsports_predictions disable trigger fixture_alias_v1');await db.query("insert into nothingsports_predictions(user_id,event_id,rating,created_at,updated_at) values($1,$2,4,'2026-09-20T14:00Z','2026-09-20T14:00Z')",[user,canonicalA]);await db.exec('alter table nothingsports_predictions enable trigger fixture_alias_v1');await db.query("insert into nothingsports_score_votes values($1,$2,'impact',3,'2026-09-20T14:01Z')",[peer,canonicalA]);assert.equal((await db.query('select nothingsports_resolve_predictions_legacy($1) value',[legacyA])).rows[0].value,0);assert.deepEqual((await snapshot(db)).nothingsports_nsc_points,before.nothingsports_nsc_points);});passed.push('a retained newer ineligible forecast cannot award using an older alias prediction');
 await transaction(db,async()=>{await db.query("insert into nothingsports_score_votes values($1,$2,'impact',3,'2026-09-20T14:00Z')",[peer,canonicalA]);assert.equal((await db.query('select nothingsports_resolve_predictions_legacy($1) value',[legacyA])).rows[0].value,1);const result=(await db.query('select * from nothingsports_predictions where user_id=$1 and event_id=$2',[user,legacyA])).rows[0];assert.equal(result.event_id,legacyA);assert.equal(result.result,'success');assert.equal(result.matched_user_id,peer);assert.equal((await db.query("select coalesce(current_setting('nothingsports.epl_resolver_scope',true),'') scope")).rows[0].scope,'');assert.equal((await db.query('select nothingsports_resolve_predictions_legacy($1) value',[canonicalA])).rows[0].value,0);});passed.push('unrelated valid pending forecast settles normally once, retains original row/key and clears its owner fence');
 await transaction(db,async()=>{await db.exec("alter table nothingsports_consensus_votes disable trigger fixture_alias_v1");await db.query("insert into nothingsports_consensus_votes values($1,$2,1,'2026-09-20T15:01Z'),($3,$2,3,'2026-09-20T15:02Z')",[legacyA,peer,canonicalA]);await db.exec("alter table nothingsports_consensus_votes enable trigger fixture_alias_v1");await db.query("update nothingsports_prediction_rules set version='consensus.v1',completed_at='2026-09-20T15:00Z',cutoff='2026-09-22T15:00Z' where event_id in($1,$2)",[canonicalA,legacyA]);assert.equal((await db.query('select nothingsports_resolve_predictions($1) value',[legacyA])).rows[0].value,1);const receipt=(await db.query('select * from nothingsports_consensus_receipts where event_id=$1',[legacyA])).rows[0];assert.equal(receipt.event_id,legacyA);assert.equal(receipt.voter_count,1);assert.equal(receipt.benchmark,3);assert.equal(receipt.result,'success');});passed.push('consensus counts one effective peer and keeps the original forecast FK/receipt key');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select nothingsports_resolve_predictions($1)',[canonicalA]),/permission denied/);await assert.rejects(db.query('select nothingsports_recovery.epl_operating_ids_v1($1)',[canonicalA]),/permission denied/);await db.exec('reset role');}await db.exec('set role service_role');assert.equal((await db.query('select cardinality(nothingsports_recovery.epl_operating_ids_v1($1)) n',[legacyA])).rows[0].n,4);await db.exec('reset role');passed.push('anonymous/authenticated callers denied; private helpers and service-only writer permissions retained');
 if(realTriggers){
  for(const timezone of ['UTC','Etc/GMT-10'])await transaction(db,async()=>{
   await db.exec("set local timezone='"+timezone+"'");
   await db.query("insert into nothingsports_nsc_profiles(user_id,handle,display_name,visibility) values($1,'epl_rehearsal_peer','QA contributor','visible')",[peer]);
   await db.query('insert into nothingsports_user_follows(follower_user_id,followed_user_id) values($1,$2)',[second,peer]);
   const argumentsList=[peer,legacyA,'impact',5,'2026-09-19T14:00Z','2026-09-19T16:00Z','upcoming','football','men'];
   const result=(await db.query('select nothingsports_rate_v2($1,$2,$3,$4,$5,$6,$7,$8,$9) value',argumentsList)).rows[0].value;assert.equal(result.eventId,canonicalA);assert.equal(result.pointsAwarded,2);
   const beforeReplay=await snapshot(db);const created=beforeReplay.nothingsports_nsc_contributions.find(x=>x.user_id===peer&&x.phase==='impact');assert.equal(Date.parse(created.bucket_start),0,'rating methods use the same UTC identity in both verified-production and alternate local session zones');const receipt=(await db.query("select * from nothingsports_nsc_submit_rating($1,$2,'impact',5,'{}')",[peer,legacyA])).rows[0];assert(receipt.replayed);assert.deepEqual(await snapshot(db),beforeReplay,'immutable replay must not recreate history, points or outbox records');
   assert.equal((await db.query('select count(*)::int n from nothingsports_nsc_rating_history where user_id=$1 and event_id=$2 and phase=$3',[peer,canonicalA,'impact'])).rows[0].n,1);
   assert.equal((await db.query('select count(*)::int n from nothingsports_friend_activity where rater_user_id=$1 and event_id=$2',[peer,canonicalA])).rows[0].n,1);
   assert.equal((await db.query('select count(*)::int n from nothingsports_live_rating_alerts where event_id=$1',[canonicalA])).rows[0].n,1);
   assert.equal((await db.query("select count(*)::int n from nothingsports_inbox where actor_user_id=$1 and event_id=$2 and kind='rating'",[peer,canonicalA])).rows[0].n,1);
   const parent=(await db.query('select * from nothingsports_score_fixtures where event_id=$1',[canonicalA])).rows[0];assert.equal(parent.status,'completed');assert.equal(Date.parse(parent.starts_at),Date.parse('2026-09-20T13:00Z'));
   assert.deepEqual((await db.query('select * from nothingsports_prediction_rules where event_id=$1',[canonicalA])).rows[0].cutoff,null,'an existing anticipation.v2 rule gets no manufactured completion cutoff');
  });passed.push('actual rating/history/scoring/alert/rule triggers accept a new old-key rating and immutable replay creates no duplicate effect');
  await transaction(db,async()=>{await db.query("insert into nothingsports_score_votes values($1,$2,'impact',3,'2026-09-20T14:00Z')",[peer,canonicalA]);assert.equal((await db.query('select nothingsports_resolve_predictions_legacy($1) value',[legacyA])).rows[0].value,1);const receipts=(await db.query("select * from nothingsports_inbox where recipient_user_id=$1 and detail='foresight_bonus'",[user])).rows;assert.equal(receipts.length,1);await db.query('select nothingsports_resolve_predictions_legacy($1)',[legacyA]);assert.equal((await db.query("select count(*)::int n from nothingsports_inbox where recipient_user_id=$1 and detail='foresight_bonus'",[user])).rows[0].n,1);});passed.push('actual points-to-inbox trigger makes one reward receipt during normal settlement');
  await transaction(db,async()=>{await db.query('insert into nothingsports_account_erasure_blocks(user_id) values($1)',[user]);await db.query("insert into nothingsports_score_votes values($1,$2,'impact',3,'2026-09-20T14:00Z')",[peer,canonicalA]);await assert.rejects(db.query('select nothingsports_resolve_predictions_legacy($1)',[legacyA]),/account_erasure_in_progress/);});passed.push('actual erasure barrier prevents forward prediction/reward writes');
  await transaction(db,async()=>{await db.query('delete from auth.users where id=$1',[user]);for(const table of ['nothingsports_predictions','nothingsports_nsc_points','nothingsports_nsc_contributions','nothingsports_nsc_rating_history'])assert.equal((await db.query('select count(*)::int n from '+table+' where user_id=$1',[user])).rows[0].n,0);});passed.push('actual Auth foreign keys erase original legacy prediction/rating/credit/history rows');
  await transaction(db,async()=>{await db.query("insert into nothingsports_score_votes values($1,$2,'impact',3,'2026-09-20T14:00Z')",[peer,canonicalA]);await db.query('select nothingsports_resolve_predictions_legacy($1)',[legacyA]);const settled=(await db.query('select to_jsonb(p) row from nothingsports_predictions p where user_id=$1 and event_id=$2',[user,legacyA])).rows[0].row;await db.query('delete from auth.users where id=$1',[peer]);const detached=(await db.query('select to_jsonb(p) row from nothingsports_predictions p where user_id=$1 and event_id=$2',[user,legacyA])).rows[0].row;assert.equal(detached.matched_user_id,null);assert.deepEqual({...detached,matched_user_id:settled.matched_user_id},settled);});passed.push('erasing a matched peer detaches its identity without changing the surviving settled result or reward');
 }
 return {passed,realTriggers,limits:['fabricated accounts; captured actual affected definitions, nineteen triggers and constraints','no production, provider, sender or customer-data access']};
}
module.exports={setup,installRealTriggers,runWriterChecks,snapshot,tables,root,schema,canonicalA,canonicalB,legacyA,legacyB,user,second,peer};
