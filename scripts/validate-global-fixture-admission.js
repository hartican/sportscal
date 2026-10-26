'use strict';
// One affected source/DB qualification per pinned engine; never live service work.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const old=require('./prototypes/grouped-fixture-view'),sql=require('./lib/global-fixture-admission');
const {HEADERS,decode}=require('../lib/fixture-source-groups');
const target='public.nothingsports_current_global_fixture_bundle',reference='public.qa_admission_staged';
const settings={enable_seqscan:'on',enable_indexscan:'on',enable_bitmapscan:'on',enable_nestloop:'on',enable_hashjoin:'on',enable_mergejoin:'on',jit:'off',plan_cache_mode:'auto',work_mem:'2184kB',random_page_cost:'1.1',seq_page_cost:'1',effective_cache_size:'384MB',max_parallel_workers_per_gather:'1'};
const normalized={...settings,work_mem:'2184',effective_cache_size:'49152'};
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const strip=s=>s.replace(/^BEGIN;\n/,'').replace(/COMMIT;\n$/,'');
function work(plan){
 const scans=[];function walk(n,stage=null){if(n['Subplan Name']?.startsWith('CTE '))stage=n['Subplan Name'].slice(4);
  if(['scope_keys','current_keys','raw_fallback_keys'].includes(stage)&&n['Relation Name'])scans.push({stage,type:n['Node Type'],relation:n['Relation Name'],rows:n['Actual Rows'],loops:n['Actual Loops'],width:n['Plan Width']});
  for(const child of n.Plans||[])walk(child,stage);
 }walk(plan.Plan);return{scans,scoreInputRows:scans.filter(n=>n.stage==='scope_keys'&&n.relation==='nothingsports_live_scores').reduce((sum,n)=>sum+n.rows*n.loops,0),trustedKeyProbes:scans.filter(n=>n.stage==='scope_keys'&&n.type==='Index Only Scan'&&n.relation==='nothingsports_fixture_current').reduce((sum,n)=>sum+n.loops,0),tempWritten:plan.Plan['Temp Written Blocks'],localExecutionMs:plan['Execution Time']};
}
(async()=>{
 const db=await require('./lib/near-selection-test-database').database(),checks=[];
 const output=process.env.ADMISSION_EVIDENCE_DIR,save=(name,value)=>{if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');}};
 try{
  const major=Math.floor(Number((await db.query("select current_setting('server_version_num')v")).rows[0].v)/10000);assert.equal(major,process.env.PGLITE_MODULE==='pglite-pg17'?17:18);
  await db.exec("set timezone='UTC'");
  const definition=async()=>(await db.query('select pg_get_viewdef($1::regclass,true)d',[target])).rows[0].d;
  const original=await definition();assert.equal(old.md5(original),old.ORIGINAL);
  await db.exec(fs.readFileSync('supabase/migrations/20261024115500_index_match_centre_selection.sql','utf8'));
  const contracts=require('./lib/near-selection-regression'),expected=require('./fixtures/near-selection-contracts.json').candidate;
  await contracts.contracts(db,expected);await db.exec(old.forward(original));const staged=await definition();assert.equal(old.md5(staged),sql.STAGED);
  await db.exec(`create view ${reference} with(security_invoker=true)as ${staged};grant select on ${reference} to service_role`);
  const rights=async()=>(await db.query('select reloptions,relacl::text,relowner from pg_class where oid=$1::regclass',[target])).rows[0];
  const functions=async()=>(await db.query("select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,''),''order by p.oid))h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='public'and p.proname like 'nothingsports_%')or n.nspname='nothingsports_fixture_read_private'")).rows[0].h;
  const factTables=['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','public.nothingsports_fixture_snapshots','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.fixture_tokens','nothingsports_fixture_read_private.source_tokens','nothingsports_fixture_read_private.near_selection','nothingsports_fixture_read_private.integrity_pending'];
  const facts=async()=>{const out={};for(const table of factTables)out[table]=(await db.query('select md5(coalesce(string_agg(row_to_json(t)::text,\'\'order by row_to_json(t)::text),\'\'))h from '+table+' t')).rows[0].h;return out;};
  const priorRights=await rights(),priorFunctions=await functions(),emptyFacts=await facts();
  const forward=fs.readFileSync('supabase/migrations/'+sql.VERSION,'utf8'),inverse=fs.readFileSync('supabase/rollbacks/'+sql.VERSION,'utf8');
  assert.equal(forward,sql.forward(original));assert.equal(inverse,sql.inverse(original,staged,sql.REFINED));checks.push('exact generated migration and inverse bytes');
  const originalBody=sql.qualify(old.candidate(original)),archivedBody=sql.candidate(original),newBody=sql.emittedCandidate(original),seal=sql.seal(originalBody,newBody);
  assert.equal(sha(archivedBody),sql.BODY_SHA256);assert.equal(sha(newBody),sql.EMITTED_BODY_SHA256);assert.equal(archivedBody.length-newBody.length,17);checks.push('exact qualified input and sole whitespace-line deletion binding');
  for(const [name,from,to]of [['payload',"'identity_keys',p.identity_keys","'identity_keys',NULL"],['clock',"'scoreCheckedAt', COALESCE(score_receipt.stamp, score_fact.stamp, base_score_fact.stamp)","'scoreCheckedAt',NULL"],['cap','group_count<=5000','group_count<=4999'],['ordinal','ORDER BY source_id,fixture_id)-1','ORDER BY fixture_id,source_id)-1']]){assert(newBody.includes(from));assert.throws(()=>sql.seal(originalBody,newBody.replace(from,to)),/Changed downstream/);checks.push('source seal refuses '+name);}
  assert.throws(()=>sql.seal(originalBody,newBody.replace("'Australia/Sydney'::text","'UTC'::text")),/Changed shared/);checks.push('source seal refuses shared clock');
  const changes=[['invoker',`alter view ${target} set(security_invoker=false)`],['view ACL',`grant select on ${target} to anon`],['helper',"alter function public.nothingsports_fixture_observation_time(text)immutable"],['RLS','alter table public.nothingsports_fixture_current disable row level security'],['projection','alter table public.nothingsports_fixture_current alter column global_fixture drop expression'],...[['public.nothingsports_fixture_current','nothingsports_fixture_current_pkey'],['public.nothingsports_fixture_sources','nothingsports_fixture_sources_pkey'],['public.nothingsports_live_scores','nothingsports_live_scores_pkey'],['nothingsports_fixture_read_private.fixture_context','fixture_context_pkey']].map(([table,key])=>['lookup '+table,'alter table '+table+' drop constraint '+key+' cascade'])];
  for(const [name,change]of changes){await db.exec('begin;'+change);await assert.rejects(db.exec(strip(forward)),/differ|unique lookup/);await db.exec('rollback');assert.equal(old.md5(await definition()),sql.STAGED);checks.push('install refuses '+name);}
  await db.exec(forward);assert.equal(old.md5(await definition()),sql.REFINED);assert.deepEqual(await rights(),priorRights);assert.equal(await functions(),priorFunctions);assert.deepEqual(await facts(),emptyFacts);checks.push('only staged view changed');
  await db.exec('begin');await assert.rejects(db.exec(strip(forward)),/differs/);await db.exec('rollback');checks.push('forward replay refused');
  async function read(view,role='service_role'){await db.exec('set role '+role);try{return(await db.query('select bundle::text text from '+view)).rows[0].text;}finally{await db.exec('reset role');}}
  for(const h of ['', '{}','[]','null','not JSON','{"x-ns-fixture-source-groups":"unknown"}','{"X-NS-Fixture-Source-Groups":"v1"}']){await db.query("select set_config('request.headers',$1,false)",[h]);assert.equal(await read(target),await read(reference));checks.push('default/unknown/malformed header '+h);}
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify(HEADERS)]);assert.equal(await read(target,'postgres'),await read(reference,'postgres'));checks.push('header cannot opt owner into service branch');
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select bundle from '+target),/permission denied/);await db.exec('reset role');checks.push(role+' remains refused');}
  const focused=await require('./lib/global-fixture-admission-focused-tests').focused(db);save('focused.json',focused);assert.equal(focused.filter(c=>c.state==='FULL_ORDERED_TEXT_EQUAL').length,68);checks.push('80 focused raw/type/null/pending controls');
  for(const [name,change]of changes){await db.exec('begin;'+change);await assert.rejects(db.exec(strip(inverse)),/differ|unique lookup/);await db.exec('rollback');assert.equal(old.md5(await definition()),sql.REFINED);checks.push('inverse refuses '+name);}
  async function same(label,inTransaction=false){
   await db.exec(inTransaction?'savepoint qa_compare':"begin isolation level repeatable read read only");
   try{await db.exec("set local statement_timeout='6s';set local role service_role;");await db.query("select set_config('request.headers',$1,true)",[JSON.stringify(HEADERS)]);const a=(await db.query('select bundle::text text from '+reference)).rows[0].text,b=(await db.query('select bundle::text text from '+target)).rows[0].text;assert.equal(b,a,label);return b;}
   finally{await db.exec(inTransaction?'rollback to savepoint qa_compare':'rollback');}
  }
  const projection='SELECT source_id,fixture_id FROM scope_keys';
  async function difference(refinedProjection){
   const query=`WITH a AS MATERIALIZED(${seal.originalPrefix} ${projection}),b AS MATERIALIZED(${seal.refinedPrefix} ${refinedProjection}),ao AS(SELECT source_id COLLATE pg_catalog."C",fixture_id COLLATE pg_catalog."C" FROM a EXCEPT ALL SELECT source_id COLLATE pg_catalog."C",fixture_id COLLATE pg_catalog."C" FROM b),bo AS(SELECT source_id COLLATE pg_catalog."C",fixture_id COLLATE pg_catalog."C" FROM b EXCEPT ALL SELECT source_id COLLATE pg_catalog."C",fixture_id COLLATE pg_catalog."C" FROM a)SELECT(SELECT count(*)FROM ao)old_only,(SELECT count(*)FROM bo)new_only`;
   await db.exec("begin isolation level repeatable read read only;set local statement_timeout='6s';set local role service_role;set local search_path='';");try{return(await db.query(query)).rows[0];}finally{await db.exec('rollback');}
  }
  assert.deepEqual(await difference(projection),{old_only:0,new_only:0});
  for(const [name,p]of [['omission',projection+' WHERE false'],['multiplicity',projection+' UNION ALL '+projection],['source binding',"SELECT source_id||':changed' AS source_id,fixture_id FROM scope_keys"]]){const d=await difference(p);assert(d.old_only>0||d.new_only>0);checks.push('actual key proof detects '+name);}
  const writerChecks=await require('./lib/global-fixture-admission-writer-tests').writers(db,same);checks.push(...writerChecks);
  await require('./lib/global-fixture-admission-test-fixture').loadLarge(db);const beforeLarge=await facts();
  await db.exec("begin isolation level repeatable read read only;set local statement_timeout='6s';set local lock_timeout='1s';set local search_path='';");for(const [name,value]of Object.entries(settings))await db.query('select set_config($1,$2,true)',[name,value]);await db.exec('set local role service_role');await db.query("select set_config('request.headers',$1,true)",[JSON.stringify(HEADERS)]);
  assert.deepEqual(Object.fromEntries((await db.query('select name,setting from pg_settings where name=any($1::text[])',[Object.keys(normalized)])).rows.map(r=>[r.name,r.setting])),normalized);
  const plans={};for(const [name,view]of [['staged',reference],['refined',target]]){plans[name]=(await db.query('EXPLAIN(ANALYZE,VERBOSE,BUFFERS,SETTINGS,TIMING OFF,FORMAT JSON)select bundle from '+view)).rows[0]['QUERY PLAN'][0];save(name+'-plan.json',plans[name]);}
  const workResult={staged:work(plans.staged),refined:work(plans.refined)};assert.equal(workResult.staged.scoreInputRows,8512);assert.equal(workResult.refined.scoreInputRows,0);assert.equal(workResult.refined.trustedKeyProbes,0);assert.throws(()=>assert.equal(workResult.staged.scoreInputRows,0));checks.push('actual wide admission work RED to narrow GREEN');
  const oldText=(await db.query('select bundle::text text from '+reference)).rows[0].text,newText=(await db.query('select bundle::text text from '+target)).rows[0].text;assert.equal(newText,oldText);const grouped=JSON.parse(newText);assert.equal(grouped.complete,true);assert.equal(grouped.groupCount,2586);assert.equal(grouped.edgeCount,5145);assert.equal(decode(grouped).rows.length,5145);assert(Buffer.byteLength(newText)>12_000_000&&Buffer.byteLength(newText)<16*1024*1024);await db.exec('rollback');checks.push('same snapshot complete 13MB ordered frame');
  await db.query("select set_config('request.headers','{}',false)");assert.equal(await read(target),await read(reference));checks.push('large default legacy 5001 refusal unchanged');await db.query("select set_config('request.headers',$1,false)",[JSON.stringify(HEADERS)]);
  assert.deepEqual(await facts(),beforeLarge);assert.deepEqual(await rights(),priorRights);assert.equal(await functions(),priorFunctions);await contracts.contracts(db,expected);checks.push('all facts and functions unchanged by reads');
  // Exact inverse after genuine intervening fixture/score writes, then replay refusal.
  const beforeUndo=await facts();await db.exec(inverse);assert.equal(await definition(),staged);assert.deepEqual(await facts(),beforeUndo);assert.deepEqual(await rights(),priorRights);assert.equal(await functions(),priorFunctions);checks.push('exact inverse to D3d preserves all facts and rights');
  await db.exec('begin');await assert.rejects(db.exec(strip(inverse)),/differs/);await db.exec('rollback');await db.exec(forward);assert.equal(old.md5(await definition()),sql.REFINED);assert.deepEqual(await facts(),beforeUndo);checks.push('inverse replay refused and guarded reapply');
  const result={state:'PASS_LOCAL_BACKEND_MODULE_NOT_PRODUCTION_ACCEPTANCE',major,checks,focusedControls:focused.length,writerChecks,stagedMd5:sql.STAGED,refinedMd5:sql.REFINED,bodySha256:sql.BODY_SHA256,emittedBodySha256:sql.EMITTED_BODY_SHA256,seal,frameBytes:Buffer.byteLength(newText),frameSha256:sha(newText),work:workResult,migrationSha256:sha(forward),inverseSha256:sha(inverse),currentCoalescedAndNear:true,productionCalls:0,productionWrites:0,sourceReady:false,nativeLatencyAcceptance:false};save('result.json',result);console.log(JSON.stringify({state:result.state,major,checks:checks.length,focused:focused.length,frameBytes:result.frameBytes,refinedMd5:sql.REFINED}));
 }finally{await db.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
