'use strict';
const assert=require('node:assert/strict');
async function run(){
 const db=await require('./validate-profile-fixture-scope').database(),source='discovery-local-commit-integrity',id='lab:commit:fixture';let checks=0;
 try{
  await db.query('INSERT INTO public.nothingsports_fixture_sources(source_id) VALUES($1)',[source]);
  await db.exec('SET ROLE service_role');
  const fixture={id,key:'tennis',status:'upcoming',date:new Date().toISOString().slice(0,10),participantIds:['lab:commit:player']};
  await db.query('INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) VALUES($1,$2,$3,ARRAY[$2],$2)',[source,id,JSON.stringify(fixture)]);checks++;
  const pending=async()=>Number((await db.query('SELECT count(*) n FROM nothingsports_fixture_read_private.integrity_pending')).rows[0].n);
  assert.equal(await pending(),0,'The real service writer commits a fully checked index');checks++;
  for(const sql of ['DELETE FROM nothingsports_fixture_read_private.integrity_pending','INSERT INTO nothingsports_fixture_read_private.integrity_pending VALUES(\'lab:bypass\')','TRUNCATE nothingsports_fixture_read_private.integrity_pending']){
   await assert.rejects(db.exec(sql),/permission denied/);checks++;
  }
  await db.exec('RESET ROLE');
  const read=async()=>(await db.query("SELECT public.nothingsports_read_fixture_bundle_part('participants',0,ARRAY['tennis'],ARRAY['tennis'],ARRAY['lab:commit:player'],'{}') value")).rows[0].value;
  for(const [label,sql] of [
   ['missing context','DELETE FROM nothingsports_fixture_read_private.fixture_context WHERE source_id=$1'],
   ['unsupported context','UPDATE nothingsports_fixture_read_private.fixture_context SET shape_version=2 WHERE source_id=$1'],
   ['missing identity','DELETE FROM nothingsports_fixture_read_private.fixture_tokens WHERE source_id=$1'],
   ['extra identity',"INSERT INTO nothingsports_fixture_read_private.fixture_tokens VALUES($1,'lab:commit:fixture',1,'lab:commit:extra')"],
   ['wrong source link',"UPDATE nothingsports_fixture_read_private.source_tokens SET token='lab:commit:wrong' WHERE source_id=$1"]
  ]){
   await db.exec('BEGIN');await db.query(sql,[source]);assert((await pending())>0,label+' records pending validation');
   const broken=await read();assert.equal(broken.complete,false,label+' is never returned as complete inside the transaction');assert.equal(broken.rows.length,0);
   await assert.rejects(db.exec('COMMIT'),error=>error.code==='23514',label+' cannot persist');await db.exec('ROLLBACK');
   assert.equal(await pending(),0);assert.equal((await read()).complete,true,label+' rollback retains last-good data');checks++;
  }
  await db.exec('BEGIN');
  await db.query('DELETE FROM nothingsports_fixture_read_private.fixture_tokens WHERE source_id=$1',[source]);
  await db.query('INSERT INTO nothingsports_fixture_read_private.fixture_tokens VALUES($1,$2,1,$2)',[source,id]);
  assert.equal((await read()).complete,false,'Uncommitted repaired rows still await validation');
  await db.exec('COMMIT');assert.equal(await pending(),0);assert.equal((await read()).complete,true,'A correct repair can commit without a reset');checks++;
  await db.exec('SET ROLE service_role');await db.query('DELETE FROM public.nothingsports_fixture_current WHERE source_id=$1',[source]);
  assert.equal(await pending(),0,'Canonical deletion validates cascades and final token removal');checks++;
  await db.exec('RESET ROLE');
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT * FROM nothingsports_fixture_read_private.integrity_pending'),/permission denied/);await db.exec('RESET ROLE');checks++;
  }
  console.log(JSON.stringify({passed:true,checks,actualSql:true,serviceWriter:true,commitRefusal:true,productionChanged:false}));
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
