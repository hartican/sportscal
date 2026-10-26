'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=require('./lib/generated-calendar-source');
function staticCheck(){
 const rendered=source.render();
 for(const [folder,text]of [['migrations',rendered.install],['rollbacks',rendered.undo]])assert.equal(source.read('supabase/'+folder+'/'+source.NAME),text,'Exact reviewed source render '+folder);
 const start=source.original.indexOf(',\n group_keys AS MATERIALIZED');
 assert.equal(source.candidate.slice(source.candidate.indexOf(',\n group_keys AS MATERIALIZED')),source.original.slice(start),'Payload, clocks, caps, ordering and full legacy branch unchanged');
 function mechanism(select){const head=select.slice(0,select.indexOf(',\n group_keys AS MATERIALIZED'));assert(!head.includes('jsonb_typeof'),'Recurring pre-admission JSON type validation remains');assert(!head.includes("selection -> 'calendarWindow'"),'Recurring parent descriptor extraction remains');for(const name of source.COLUMNS)assert(head.includes('ctx.'+name),'Stored derived field is actually consumed');}
 assert.throws(()=>mechanism(source.original),/Recurring pre-admission/,'Deterministic original source RED, not a speed test');mechanism(source.candidate);
 assert.equal(source.definitions.length,3);assert.equal((source.generatedPredicate.match(/jsonb_typeof/g)||[]).length,20);
 for(const name of source.COLUMNS)assert(!source.generatedPredicate.includes(name),'No generated-column chaining');
 assert(!source.generatedPredicate.includes('::boolean')&&!source.generatedPredicate.includes('coalesce('),'Exact nullable validity, no throwing cast or unknown coercion');
 assert(!/statement_timestamp|clock_timestamp|SELECT|current_user/.test(source.generatedPredicate),'Only immutable current-row derivation');
 const ddl=rendered.install,undo=rendered.undo;
 assert.equal((ddl.match(/ADD COLUMN global_/g)||[]).length,3);
 assert.equal((ddl.match(/ANALYZE nothingsports_fixture_read_private.fixture_context\(global_window_valid\)/g)||[]).length,1,'Gather ordinary Boolean stats within the same unchanged install bound');
 assert.equal((undo.match(/DROP COLUMN global_/g)||[]).length,3);
 assert(undo.indexOf('EXECUTE $gc_restore$')<undo.indexOf('DROP COLUMN global_'),'Restore current reader before removing metadata');
 assert(!/CASCADE|DROP EXPRESSION|SET (?:LOCAL )?(?:work_mem|enable_|jit)/i.test(ddl+undo),'No broad drop, stale ordinary flag or planner/memory change');
 assert(!/CREATE (?:OR REPLACE )?FUNCTION|CREATE INDEX|UPDATE public\.|INSERT INTO public\.|CREATE TRIGGER/i.test(ddl+undo),'No new persistent helper/index/owner or sporting write');
 assert(undo.includes('unreviewed column dependency'),'Do not auto-drop later same-table indexes/constraints with the owned columns');
 for(const text of [ddl,undo]){assert(text.indexOf("SET LOCAL statement_timeout='3s'")<text.indexOf('DO $generated_calendar$'));assert(text.includes("SET LOCAL lock_timeout='1s'"));assert.equal((text.match(/DO \$generated_calendar\$/g)||[]).length,1);assert(text.includes('current27 owner/function contract differs'));assert(text.includes('canonical trigger contract differs'));assert(text.includes('pending canonical work'));assert(text.includes('active source lease'));assert(text.indexOf('temporary witness name already exists')<text.indexOf('CREATE TEMP TABLE'));assert(!/CREATE TEMP (?:TABLE|VIEW) IF NOT EXISTS/.test(text)&&!text.includes('CREATE OR REPLACE TEMP'),'Never reuse or replace a foreign witness');}
 const legacy=source.original.slice(source.original.indexOf('ELSE(SELECT value AS bundle'));
 return {state:'PASS_SOURCE_STATIC_ONLY',database:'NOT_RUN',speed:'NOT_MEASURED',originalSourceRed:true,candidateSourceProperty:true,installSha256:source.sha(ddl),undoSha256:source.sha(undo),candidateViewSha256:source.sha(source.candidate),legacySha256:source.sha(legacy)};
}
async function run(){
 assert(process.argv.includes('--static')||process.argv.includes('--functional'),'Choose --static or explicitly allocated --functional');
 const result=staticCheck();
 if(process.argv.includes('--static')){assert(!process.argv.includes('--functional'));console.log(JSON.stringify(result));return;}
 assert.equal(process.env.GENERATED_CALENDAR_TEST_ALLOCATION,'ROOT_ALLOCATED_ONE_CACHED_FUNCTIONAL_WINDOW','No engine creation without ROOT allocation');
 assert.equal(process.env.PGLITE_MODULE,'pglite-pg17','First proposed window is existing cached PG17 only');
 const out=process.env.GENERATED_CALENDAR_EVIDENCE_DIR;assert(out&&path.isAbsolute(out),'Dated evidence directory required');
 fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'result.json'))&&!fs.existsSync(path.join(out,'started.json')),'One allocated attempt; no overwrite/retry');
 const report={...result,state:'FUNCTIONAL_STARTED',database:'ALLOCATED_LOCAL_PG17',speed:'NOT_MEASURED',tests:[],productionWrites:0,providerCalls:0,networkCalls:0};let db;
 fs.writeFileSync(path.join(out,'started.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 globalThis.fetch=()=>{report.networkCalls++;throw Error('Network forbidden in cached functional window');};
 for(const name of ['http','https'])for(const method of ['request','get'])require('node:'+name)[method]=()=>{report.networkCalls++;throw Error('Network forbidden');};
 try{
  // Existing cached factory imported ONLY after allocation checks; no downloads.
  db=await require('./lib/near-selection-test-database').database();
  await db.exec(source.read('supabase/migrations/20261024115500_index_match_centre_selection.sql'));
  await db.exec('BEGIN;'+source.read('supabase/migrations/'+source.ORIGINAL)+'COMMIT;');
  await db.exec("SET statement_timeout='8s';SET lock_timeout='1s'");
  await require('./lib/generated-calendar-regression').regression(db,report);
  report.state='PASS_LOCAL_FUNCTIONAL_ONLY';report.database='LOCAL_PG17_FUNCTIONAL_PASS';
 }catch(error){report.state='STOPPED_FIRST_FUNCTIONAL_FAILURE';report.failure={message:error.message,code:error.code};throw error;}
 finally{if(db){await db.exec('ROLLBACK;RESET ROLE').catch(()=>{});try{await db.close();report.engineClosed=true;}catch(error){report.state='FUNCTIONAL_CLEANUP_UNCONFIRMED';report.cleanupError=error.message;process.exitCode=1;}}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({state:report.state,tests:report.tests.length,speed:report.speed}));
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={staticCheck,run};
