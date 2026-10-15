'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
async function run(){
 const db=await require('./validate-profile-fixture-scope').database();let checks=0;
 try{
  const original=fs.readFileSync('supabase/migrations/20261012133505_qualify_match_centre_read_candidates.sql','utf8').match(/create or replace function[\s\S]*?\$\$;/)[0];
  await db.exec(original.replace('public.nothingsports_read_match_centre_fixture_bundle','public.qa_unindexed_near'));
  const now=(await db.query('select statement_timestamp() as now')).rows[0].now;
  const clock=offset=>new Date(Date.parse(now)+offset*60000).toISOString();
  const fixtures=[
   {id:'seed',status:'live',startTimeUtc:clock(-20),homeParticipantId:'a',awayParticipantId:'b',fixtureIdAliases:['alias:seed']},
   {id:'same-sides',status:'scheduled',startTimeUtc:clock(100),homeParticipantId:'b',awayParticipantId:'a'},
   {id:'alias-child',status:'scheduled',startTimeUtc:clock(100)},
   {id:'pipe-seed',status:'live',startTimeUtc:clock(-20),homeParticipantId:'A|B',awayParticipantId:'C'},
   {id:'pipe-unrelated',status:'scheduled',startTimeUtc:clock(100),homeParticipantId:'A',awayParticipantId:'B|C'},
   {id:'uncertain',status:'scheduled',startTimeUtc:'unconfirmed'},
   {id:'nullable',status:'scheduled',startTimeUtc:clock(10),homeParticipantId:'a',awayParticipantId:'b'},
   {id:'zero-final',status:'completed',date:'2026-01-01',statusCheckedAt:clock(-20),homeScore:0,awayScore:0}
  ];
  for(let i=0;i<1200;i++)fixtures.push({id:'future:'+i,status:'scheduled',startTimeUtc:clock(100),homeParticipantId:'home:'+i,awayParticipantId:'away:'+i});
  await db.query("insert into public.nothingsports_fixture_sources(source_id) values('near-test')");
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'near-test',e->>'id',e,case when e->>'id'='seed' then array['seed','alias:seed'] when e->>'id'='alias-child' then array['alias-child','alias:seed'] else array[e->>'id'] end,e->>'id' from jsonb_array_elements($1::jsonb) e",[JSON.stringify(fixtures)]);
  const read=async(name,ids)=>(await db.query('select public.'+name+'($1) v',[ids])).rows[0].v;
  async function equal(label,ids=[]){const expected=await read('qa_unindexed_near',ids),got=await read('nothingsports_read_match_centre_fixture_bundle',ids);assert.deepEqual(got,expected,label);checks++;return got;}
  const got=await equal('Complete published fields, aliases, sides, uncertain clocks and zeros');
  const ids=new Set(got.rows.map(r=>r.fixture_id));for(const id of ['seed','same-sides','alias-child','pipe-seed','uncertain','nullable','zero-final'])assert(ids.has(id),id);assert(!ids.has('pipe-unrelated'),'Lossy side-token collision cannot admit unrelated fixture');checks++;
  await equal('Caller-preserved distant correction',['future:1199']);
  for(const override of [{status:null,startTimeUtc:null,homeParticipantId:null},{status:'completed',statusCheckedAt:clock(-20),homeScore:0,awayScore:0},{status:'scheduled',startTimeUtc:'invalid',awayParticipantId:'changed'}]){
   await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('near-test','nullable',$1::jsonb,'update') on conflict(source_id,fixture_id) do update set score=excluded.score",[JSON.stringify(override)]);await equal('Canonical score override '+checks);
  }
  await db.exec('begin');await db.query("delete from nothingsports_fixture_read_private.fixture_context where source_id='near-test' and fixture_id='same-sides'");await equal('Pending/missing private metadata uses original raw closure');await db.exec('rollback');
  await db.exec('begin');await db.query("update public.nothingsports_fixture_current set fixture=fixture||jsonb_build_object('startTimeUtc',$1::text) where fixture_id='same-sides'",[clock(10)]);await equal('Read within pending canonical transaction');await db.exec('rollback');
  await db.query("delete from public.nothingsports_fixture_current where fixture_id='alias-child'");await equal('Canonical delete removes linked row');
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(read('nothingsports_read_match_centre_fixture_bundle',[]),/permission denied/);await db.exec('reset role');checks++;}
  await db.exec('set role service_role');await equal('Existing service-only reader');await db.exec('reset role');
  console.log(JSON.stringify({passed:true,checks,fixtures:fixtures.length,actualSql:true,completeOutputAgreement:true,pendingFallback:true,productionChanged:false}));
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
