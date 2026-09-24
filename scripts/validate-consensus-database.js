'use strict';
// Runs against the isolated PGlite harness in validate-leaderboard-v2-database.
module.exports=async function(db){
 const assert=require('node:assert/strict'),fs=require('node:fs');
 await db.exec(fs.readFileSync('supabase/migrations/20260924103714_consensus_anticipation.sql','utf8'));
 await db.exec('create table nothingsports_fixture_current(identity_keys text[],fixture jsonb,updated_at timestamptz);grant all on nothingsports_fixture_current to service_role;');
 await db.exec('create table nothingsports_inbox(recipient_user_id uuid,kind text,source_key text,event_id text,title text,detail text,unique(recipient_user_id,source_key));grant all on nothingsports_inbox to service_role;');
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 const rate=async(user,phase,rating,status,start,end)=>db.query("select nothingsports_rate_v2($1,'consensus-test',$2,$3,$4,$5,$6,'nrl','men')",[user,phase,rating,start,end,status]);
 await db.exec("update nothingsports_consensus_settings set activated_at=now();set role service_role;");
 const future=new Date(Date.now()+3600000).toISOString(),past=new Date(Date.now()-3600000).toISOString(),end=new Date(Date.now()-1000).toISOString();
 await rate(a,'heat',5,'scheduled',future,null);
 await db.query("update nothingsports_predictions set updated_at=$1 where event_id='consensus-test'",[new Date(Date.now()-7200000).toISOString()]);
 await rate(b,'impact',5,'completed',past,end);await rate(b,'impact',4,'completed',past,end);await rate(b,'impact',5,'completed',past,end);await rate(b,'impact',4,'completed',past,end);await rate(c,'impact',5,'completed',past,end);
 await rate(a,'impact',1,'completed',past,end);
 assert.equal((await db.query("select result from nothingsports_predictions where event_id='consensus-test'")).rows[0].result,'pending');
 assert.equal(+(await db.query("select completed_at from nothingsports_prediction_rules where event_id='consensus-test'")).rows[0].completed_at,Date.parse(end),'completion frozen');
 await db.exec("update nothingsports_consensus_votes set recorded_at=recorded_at-interval '49 hours' where event_id='consensus-test';update nothingsports_prediction_rules set completed_at=completed_at-interval '49 hours',cutoff=cutoff-interval '49 hours' where event_id='consensus-test';");
 await db.query('select nothingsports_settle_consensus_batch()');await db.query('select nothingsports_settle_consensus_batch()');
 const receipt=(await db.query("select * from nothingsports_consensus_receipts where event_id='consensus-test'")).rows[0];
 assert.equal(receipt.result,'success');assert.equal(receipt.benchmark,5);assert.equal(receipt.voter_count,2);assert.equal(Number(receipt.mean),4.5);
 assert.equal((await db.query("select count(*) n from nothingsports_nsc_points where event_id='consensus-test' and action_key='foresight_bonus'")).rows[0].n,1);
 await rate(b,'impact',1,'completed',past,end);
 assert.equal((await db.query("select rating from nothingsports_consensus_votes where event_id='consensus-test' and user_id=$1",[b])).rows[0].rating,4,'late edits cannot rewrite the cutoff vote');
 for(const [event,result,peer] of [['consensus-empty','unscored',null],['consensus-miss','miss',4],['consensus-cancel','cancelled',5],['consensus-single','success',5]]){
  await db.query("select nothingsports_rate_v2($1,$2,'heat',5,$3,null,'scheduled','nrl','men')",[a,event,future]);
  await db.query('update nothingsports_predictions set updated_at=$1 where event_id=$2',[new Date(Date.now()-7200000).toISOString(),event]);
  await db.query("update nothingsports_score_fixtures set status='completed',starts_at=$1,ends_at=$2 where event_id=$3",[past,end,event]);
  if(peer)await db.query("select nothingsports_rate_v2($1,$2,'impact',$3,$4,$5,'completed','nrl','men')",[b,event,peer,past,end]);
  if(result==='cancelled')await db.query("update nothingsports_score_fixtures set status='cancelled' where event_id=$1",[event]);
  await db.query("update nothingsports_consensus_votes set recorded_at=recorded_at-interval '49 hours' where event_id=$1",[event]);
  await db.query("update nothingsports_prediction_rules set completed_at=completed_at-interval '49 hours',cutoff=cutoff-interval '49 hours' where event_id=$1",[event]);
  await db.query('select nothingsports_settle_consensus_batch()');
  assert.equal((await db.query('select result from nothingsports_predictions where event_id=$1',[event])).rows[0].result,result);
 }
 assert.equal((await db.query("select version from nothingsports_prediction_rules where event_id='match'")).rows[0].version,'anticipation.v2','historical fixtures keep their rule');
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from nothingsports_consensus_votes'),/permission denied/);await db.exec('reset role');
 console.log('Consensus database: latest per person, self exclusion, rounded mean, frozen cutoff, delayed/idempotent award and RLS passed.');
};
