'use strict';
// Local physical PostgreSQL factories only. No credentials, network, refresh or runtime installation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const signature='public.nothingsports_read_match_centre_fixture_bundle(text[])';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function work(plan){
 let heapVisits=0,typedVisits=0,readyNodes=0;const scans=[];
 function walk(n,stage=null){stage=n['Subplan Name']?.startsWith('CTE ')?n['Subplan Name'].slice(4):stage;
  if(stage==='near_seed_keys'&&n['Actual Loops']>0)readyNodes++;
  if(['nothingsports_fixture_current','nothingsports_live_scores','near_selection'].includes(n['Relation Name'])){
   const removed=(n['Rows Removed by Filter']||0)+(n['Rows Removed by Index Recheck']||0),visits=(n['Actual Rows']+removed)*n['Actual Loops'];
   const raw=n['Node Type']!=='Index Only Scan'&&!['index_state','candidates'].includes(stage)&&n['Relation Name']!=='near_selection';
   if(raw)heapVisits+=visits;if(n['Relation Name']==='near_selection')typedVisits+=visits;
   scans.push({stage,type:n['Node Type'],relation:n['Relation Name'],index:n['Index Name'],rows:n['Actual Rows'],removed,loops:n['Actual Loops'],visits,heapFetches:n['Heap Fetches']||0,raw});
  }for(const c of n.Plans||[])walk(c,stage);
 }walk(plan.Plan);return {heapVisits,typedVisits,readyNodes,scans};
}
async function run(){
 const red=process.argv.includes('--original-red'),functional=process.argv.includes('--functional-only'),padding=functional?0:Number(process.env.NEAR_PADDING||6400);assert(!functional||!red);assert(Number.isSafeInteger(padding)&&(functional||padding>=6400)&&padding<=64000);
 const output=process.env.NEAR_EVIDENCE_DIR;assert(output&&path.isAbsolute(output));fs.mkdirSync(output,{recursive:true});
 const db=await require('./lib/near-selection-test-database').database(),report={schemaVersion:1,mode:red?'original-red':functional?'functional-only':'candidate',currentCoalescedWriter:true,productionCalls:0,providerCalls:0,padding,checks:0};
 try{
  report.engine=(await db.query('select version() v')).rows[0].v;const definition=(await db.query('select pg_get_functiondef($1::regprocedure) d',[signature])).rows[0].d;assert.equal(crypto.createHash('md5').update(definition).digest('hex'),'d9b49086166c24b3a10b4dc1f7279b7c');
  const now=Date.now(),future=new Date(now+300*86400000).toISOString(),past=new Date(now-86400000).toISOString();
  const values=Array.from({length:20+padding},(_,i)=>({id:i<20?'admitted:'+i:'irrelevant:'+i,status:i<19?'live':'scheduled',startTimeUtc:future,statusCheckedAt:past,homeParticipantId:'home:'+i,awayParticipantId:'away:'+i,fixtureIdAliases:i===19?['preserved:late']:[],retainedWideFact:sha(String(i)).repeat(16)}));
  const start=performance.now();await db.exec("begin;insert into public.nothingsports_fixture_sources(source_id) values('near-selection-local');");
  for(let i=0;i<values.length;i+=256)await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) select 'near-selection-local',e->>'id',array[e->>'id']||array(select jsonb_array_elements_text(e->'fixtureIdAliases')),e,md5(e::text) from jsonb_array_elements($1::jsonb)e",[JSON.stringify(values.slice(i,i+256))]);
  await db.exec('commit;analyze public.nothingsports_fixture_current;analyze public.nothingsports_live_scores;analyze public.nothingsports_fixture_sources;analyze nothingsports_fixture_read_private.fixture_context;analyze nothingsports_fixture_read_private.fixture_tokens;');report.fixtureWriteMs=performance.now()-start;
  const ids=['preserved:late'],reference=(await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1)::text body',[ids])).rows[0].body,parsed=JSON.parse(reference);assert.equal(parsed.complete,true);assert.equal(parsed.rows.length,20);report.original={rows:20,bytes:Buffer.byteLength(reference),sha256:sha(reference)};report.checks++;
  if(!red){
   const t=performance.now();await db.exec(fs.readFileSync('supabase/migrations/20261024115500_index_match_centre_selection.sql','utf8'));report.installMs=performance.now()-t;
   assert.equal((await db.query('select nothingsports_fixture_read_private.near_index_ready() ready')).rows[0].ready,false);
   assert.equal((await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1)::text body',[ids])).rows[0].body,reference,'Unprepared exact fallback');report.checks++;
   const backfill=performance.now();
   for(let i=0;i<values.length;i+=256){
    await db.query("select nothingsports_fixture_read_private.rebuild_near_selection('near-selection-local',id)from unnest($1::text[])id",[values.slice(i,i+256).map(v=>v.id)]);
    if(i===0&&values.length>256){assert.equal((await db.query('select nothingsports_fixture_read_private.near_index_ready()ready')).rows[0].ready,false);assert.equal((await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1)::text body',[ids])).rows[0].body,reference);report.partialPreparationExactFallback=true;report.checks++;}
   }
   report.backfillMs=performance.now()-backfill;await db.exec('analyze nothingsports_fixture_read_private.near_selection');
   assert.equal((await db.query('select nothingsports_fixture_read_private.near_index_ready() ready')).rows[0].ready,true);
   const t2=performance.now(),actual=(await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1)::text body',[ids])).rows[0].body;report.storedCandidateMs=performance.now()-t2;
   assert.equal(actual,reference,'Complete ordered stored text oracle');report.candidate={rows:JSON.parse(actual).rows.length,bytes:Buffer.byteLength(actual),sha256:sha(actual),orderedFullTextEqual:true};report.checks++;
   const readyBody=(await db.query("select prosrc body from pg_proc where oid='nothingsports_fixture_read_private.near_index_ready()'::regprocedure")).rows[0].body;
   const readyPlan=(await db.query('EXPLAIN(ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) '+readyBody)).rows[0]['QUERY PLAN'][0];report.keyReadiness={work:work(readyPlan),executionMs:readyPlan['Execution Time'],scope:'Complete key coverage; no raw fixture/score expressions. Separate from admission work.'};
  }
  const body=(await db.query('select prosrc body from pg_proc where oid=$1::regprocedure',[signature])).rows[0].body;await db.exec("begin;set local work_mem='2184kB';set local jit='off';set local search_path='';set local role service_role;");
  const t=performance.now(),plan=(await db.query('EXPLAIN (ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) '+body.replaceAll('p_membership_ids','$1::text[]'),[ids])).rows[0]['QUERY PLAN'][0];report.boundBodyPlanMs=performance.now()-t;report.work=work(plan);report.workBudget=20*4+10;report.workPass=report.work.heapVisits<=report.workBudget;await db.exec('rollback;');
  report.diskBytes=Number((await db.query("select sum(pg_total_relation_size(c.oid)) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','nothingsports_fixture_read_private')")).rows[0].n);report.rssBytes=process.memoryUsage().rss;
  if(!red){assert(report.work.readyNodes>0,'Actual indexed ready branch must execute');report.workPass=report.workPass&&report.work.typedVisits<=report.workBudget;report.performanceQualified=!functional&&report.workPass;}
  fs.writeFileSync(path.join(output,(red?'original':'candidate')+'-'+(process.env.PGLITE_MODULE==='pglite-pg17'?'pg17':'pg18')+'-'+padding+'.json'),JSON.stringify(report,null,2)+'\n');
  if(!functional)assert(report.workPass,'Ready-path admission must not decode unrelated raw fixture/score rows as padding grows');
  if(!red){const tests=require('./lib/near-selection-regression');await tests.regression(db,report);await tests.inverse(db,report);report.passed=true;fs.writeFileSync(path.join(output,'candidate-'+(process.env.PGLITE_MODULE==='pglite-pg17'?'pg17':'pg18')+'-'+padding+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:report.checks,rawVisits:report.work.heapVisits,typedVisits:report.work.typedVisits,storedCandidateMs:report.storedCandidateMs}));}
 }catch(error){report.failure={message:error.message,code:error.code};fs.writeFileSync(path.join(output,'failure-'+(process.env.PGLITE_MODULE==='pglite-pg17'?'pg17':'pg18')+'-'+padding+'.json'),JSON.stringify(report,null,2)+'\n');throw error;}finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(JSON.stringify({passed:false,error:String(e.message).slice(0,240)}));process.exitCode=1;});
module.exports={run,work};
