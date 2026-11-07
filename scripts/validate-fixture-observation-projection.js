'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
async function run(){
 const {database}=require('./validate-profile-fixture-scope'),db=await database({withReadContext:false});
 try{
  const signature="public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)";
  const original=(await db.query('SELECT pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition;
  await db.exec(original.replace('public.nothingsports_project_fixture_observations','public.ns_test_original_observation_projection'));
  const attributes=async()=>(await db.query('SELECT provolatile,prosecdef,proparallel,proleakproof,proconfig FROM pg_proc WHERE oid=$1::regprocedure',[signature])).rows[0];
  const privileges=async()=>(await db.query("SELECT role,has_function_privilege(role,$1,'EXECUTE') allowed FROM unnest(array['anon','authenticated','service_role']) role ORDER BY role",[signature])).rows;
  const before=await attributes(),grants=await privileges();
  const file=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_flatten_fixture_observation_projection.sql'));assert(file);
  await db.exec('BEGIN;'+fs.readFileSync('supabase/migrations/'+file,'utf8')+'COMMIT;');
  const past=new Date(Date.now()-60000).toISOString(),future=new Date(Date.now()+600000).toISOString();
  // Synthetic values deliberately include SQL NULL and every JSON category.
  const values=[null,'null','{}','[]','[1,{"score":0}]','"text"','0','false',JSON.stringify({id:'local:fixture',homeScore:0,scoreCheckedAt:past,statusCheckedAt:future,sourceCheckedAt:past,nested:{value:null},fixtureObservationSchema:'wrong'})];
  const receipts=[null,'null','{}',JSON.stringify({s:past,t:past}),JSON.stringify({s:future,t:'invalid'}),JSON.stringify({s:'2026-02-30T00:00:00Z',t:'2026-10-15 01:00:00'}),JSON.stringify({s:past,t:null})];
  let checks=0;
  for(const base of values)for(const score of values)for(const receipt of receipts)for(const first of [null,past]){
   const r=(await db.query('SELECT public.ns_test_original_observation_projection($1::jsonb,$2::jsonb,$3::jsonb,$4::timestamptz) original,public.nothingsports_project_fixture_observations($1::jsonb,$2::jsonb,$3::jsonb,$4::timestamptz) candidate',[base,score,receipt,first])).rows[0];
   assert.deepEqual(r.candidate,r.original,'Full observation response for controlled JSON categories');checks++;
  }
  assert.deepEqual(await attributes(),before,'Volatility, invoker, parallel and search-path attributes stay unchanged');
  assert.deepEqual(await privileges(),grants,'Existing service-only execution permissions stay unchanged');
  console.log(JSON.stringify({passed:true,checks,attributesAndGrantsUnchanged:true,scope:'Actual isolated SQL; SQL/JSON null, all JSON types, invalid/future/source timestamps, withdrawals and zero values. Full captured-world timing and live service proof are separate.'}));
  return {checks};
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(JSON.stringify({message:e.message,code:e.code}));process.exitCode=1;});
module.exports={run};
