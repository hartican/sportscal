'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{splitScores,contentHash}=require('../lib/live-fixtures');
(async()=>{const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;');
 for(const path of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+path,'utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260914061506_right_size_fixture_runtime.sql','utf8').split('-- One write replaces')[0]);
 await db.exec(fs.readFileSync('supabase/migrations/20260924104317_compact_live_scores.sql','utf8'));
 const token='11111111-1111-4111-8111-111111111111';
 const publish=async score=>{const split=splitScores([{id:'match',key:'nrl',status:'live',homeScore:score,awayScore:4}]);await db.query("insert into nothingsports_fixture_sources(source_id,lease_token,lease_until) values('test',$1,now()+interval '1 hour') on conflict(source_id) do update set lease_token=excluded.lease_token,lease_until=excluded.lease_until",[token]);return db.query('select nothingsports_publish_compact_scores($1,$2,$3,$4,$5,$6)', ['test',token,JSON.stringify(split.fixtures),JSON.stringify(split.scores),contentHash(split.fixtures),120000]);};
 await db.exec('set role service_role');await publish(12);await publish(18);await publish(18);
 assert.equal((await db.query('select count(*) n from nothingsports_fixture_snapshots')).rows[0].n,1,'score-only changes never create full snapshots');
 assert.equal((await db.query('select count(*) n from nothingsports_live_scores')).rows[0].n,1);
 const score=(await db.query("select * from nothingsports_read_match_scores(array['match'])")).rows[0];assert.equal(score.fixture.homeScore,18);assert(score.checked_at);
 assert.equal((await db.query("select * from nothingsports_read_current_fixtures(array['match'])")).rows[0].fixture.homeScore,18,'Feed retains compact scores');
 assert.equal((await db.query("select count(*) n from nothingsports_read_match_scores(array[]::text[])")).rows[0].n,0);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from nothingsports_live_scores'),/permission denied/);
 console.log('Compact score SQL: changed-only rows, no score-tick history, Feed compatibility, bounded reads and RLS passed.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
