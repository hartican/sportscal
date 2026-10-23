'use strict';
// Small offline constructor/definition checks only. Never substitute a codec,
// execute a generation builder, claim native qualification or measure speed.
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('supabase/migrations/20261023161153_shadow_complete_global_generation.sql','utf8');
const definition=name=>{const a=source.indexOf('create function '+name+'(');assert(a>=0);return source.slice(a,source.indexOf('$fn$;',source.indexOf('as $fn$',a)+7)+5);};
const block=tag=>{const a=source.indexOf('do $'+tag+'$');assert(a>=0);return source.slice(a,source.indexOf('end $'+tag+'$;',a)+('end $'+tag+'$;').length);};
async function run(){
 const db=await require('./fixture-read-test-baseline').database();
 try{
  await db.exec("set timezone='UTC';set datestyle='ISO, MDY'");
  await db.exec(definition('nothingsports_fixture_read_private.global_read_clock_transition'));
  await db.exec(block('original'));await db.exec(`grant select on nothingsports_fixture_read_private.global_read_original to service_role`);
  await db.exec(block('constructor'));await db.exec(`revoke all on nothingsports_fixture_read_private.global_read_constructor from public,anon,authenticated;grant select on nothingsports_fixture_read_private.global_read_constructor to service_role`);
  const result=await require('./global-read-constructor-regressions').constructor({db});
  // SQL helper bodies refer to the absent LZ4 store; compilation of stored
  // definitions is explicitly NOT execution or a full migration pass.
  await db.exec('set check_function_bodies=off');
  for(const sql of source.match(/create function [\s\S]*?\$fn\$;/g))await db.exec(sql.replace('create function ','create or replace function '));
  const pins=(await db.query("select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid))md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='nothingsports_fixture_read_private'and p.proname in('touch_global_read_epoch','global_read_epoch_changed','global_read_vector','global_read_clock_transition','global_generation_witness','guard_global_generation_write','global_generation_policy','read_global_generation'))or(n.nspname='public'and p.proname='nothingsports_build_global_generation')order by 1")).rows;
  const view=(await db.query("select md5(pg_get_viewdef('nothingsports_fixture_read_private.global_read_constructor'::regclass,true))md5")).rows[0].md5;
  const inverse=fs.readFileSync('supabase/rollbacks/20261023161153_shadow_complete_global_generation.sql','utf8');
  for(const pin of pins)assert(inverse.includes("'"+pin.md5+"'"),'Inverse binds actual stored helper definition: '+pin.signature);
  assert(inverse.includes("'"+view+"'")&&source.includes("'"+view+"'"),'Forward/policy/inverse bind exact derived view');
  console.log(JSON.stringify({state:'OFFLINE_CONSTRUCTOR_EQUIVALENCE_PASS_NATIVE_AND_MANAGED_PENDING',...result,constructorMd5:view,pins,fullBuilderExecuted:false,fullMigrationExecuted:false,lz4Substitution:false,productionCalls:0,timingPairs:0}));
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1});module.exports={run};
