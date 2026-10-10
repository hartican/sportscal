'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {contentHash,splitScores}=require('../lib/live-fixtures');
module.exports=async function validateCadence(){
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;");
  for(const name of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql','20260914061506_right_size_fixture_runtime.sql','20260924104317_compact_live_scores.sql','20261002171936_preserve_compact_fixture_observations.sql','20261010140633_align_live_source_refresh_cadence.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8').split('-- One write replaces')[0]);
  const token='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
  const claim=async source=>(await db.query('select * from public.nothingsports_claim_fixture_source($1,$2)',[source,token])).rows[0];
  const read=async source=>(await db.query("select *,extract(epoch from next_due_at) as due from public.nothingsports_fixture_sources where source_id=$1",[source])).rows[0];
  const base={id:'fixture:cadence',key:'nrl',status:'live',homeParticipantId:'home',awayParticipantId:'away',homeScore:7,awayScore:0,sourceCheckedAt:new Date(Date.now()-60000).toISOString()};
  const publish=async(source,fixture=base,interval=120000)=>{
   const parts=splitScores([fixture],{observedFixtures:[fixture],now:new Date()});
   return (await db.query('select public.nothingsports_publish_compact_scores($1,$2,$3,$4,$5,$6,$7) as revision',[source,token,JSON.stringify(parts.fixtures),JSON.stringify(parts.scores),contentHash(parts.fixtures),interval,null])).rows[0].revision;
  };
  await db.exec('set role service_role');
  const leased=await claim('live-test'),due=+new Date(leased.lease_until)+30000;
  assert(Math.abs(+new Date(leased.lease_until)-Date.now()-90000)<1500,'The existing lease stays ninety seconds');
  const revision=await publish('live-test'),first=await read('live-test');
  assert(Math.abs(Number(first.due)*1000-due)<1,'Live cadence is exactly claim start plus two minutes');
  assert.equal(first.lease_token,null);assert.equal(first.failure_count,0);assert.equal(await claim('live-test'),undefined,'A second owner cannot claim before the two-minute minimum');
  const before=(await db.query("select c.ctid::text as core_ctid,s.ctid::text as score_ctid,s.score,(select count(*) from public.nothingsports_fixture_snapshots) as history from public.nothingsports_fixture_current c join public.nothingsports_live_scores s using(source_id,fixture_id) where c.source_id='live-test'")).rows[0];
  await db.query("update public.nothingsports_fixture_sources set next_due_at=clock_timestamp()-interval '1 second' where source_id='live-test'");
  const again=await claim('live-test');
  assert.equal(await publish('live-test',{...base,sourceCheckedAt:new Date().toISOString()}),revision,'Unchanged facts do not create history');
  const after=(await db.query("select c.ctid::text as core_ctid,s.ctid::text as score_ctid,s.score,(select count(*) from public.nothingsports_fixture_snapshots) as history from public.nothingsports_fixture_current c join public.nothingsports_live_scores s using(source_id,fixture_id) where c.source_id='live-test'")).rows[0];
  assert.equal(after.core_ctid,before.core_ctid);assert.equal(after.score_ctid,before.score_ctid);assert.equal(after.history,before.history);assert.deepEqual(after.score,before.score,'Polling preserves original score fact clocks');
  assert(Math.abs(Number((await read('live-test')).due)*1000-+new Date(again.lease_until)-30000)<1,'Unchanged publication uses the same live cadence');
  await claim('quiet-test');const quietStart=Date.now();await publish('quiet-test',base,1800000);const quiet=await read('quiet-test');assert(Number(quiet.due)*1000>=quietStart+1800000,'Quiet sources retain their thirty-minute publication interval');
  await claim('failed-test');const failureStart=Date.now();await db.query('select public.nothingsports_fail_fixture_source($1,$2,$3)',['failed-test',token,300000]);const failed=await read('failed-test');assert.equal(failed.failure_count,1);assert(Number(failed.due)*1000>=failureStart+300000,'Failure backoff is unchanged');
  await claim('fenced-test');await assert.rejects(db.query('select public.nothingsports_publish_fixture_source($1,$2,$3,$4,$5)',['fenced-test',other,JSON.stringify([base]),'wrong',120000]),/Lease expired/);
  await assert.rejects(db.query('select public.nothingsports_publish_fixture_source($1,$2,$3,$4,$5)',['fenced-test',token,'[]','empty',120000]),/Invalid snapshot/);
  await db.query("update public.nothingsports_fixture_sources set lease_until=clock_timestamp()-interval '1 second' where source_id='fenced-test'");await assert.rejects(publish('fenced-test'),/Lease expired/);
  await db.exec('reset role');for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)','execute') as allowed",[role])).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('service_role','public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)','execute') as allowed")).rows[0].allowed,true);
  console.log('Real SQL live start-to-start minimum, unchanged compact facts/history, quiet interval, failure backoff, lease fencing and service-only access passed.');
 }finally{await db.close();}
};
if(require.main===module)module.exports().catch(e=>{console.error(e.message);process.exitCode=1;});

