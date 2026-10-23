'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{performance}=require('node:perf_hooks');
const migration='20261023161153_shadow_complete_global_generation.sql';
const forward=fs.readFileSync('supabase/migrations/'+migration,'utf8');
const inverse=()=>fs.readFileSync('supabase/rollbacks/'+migration,'utf8');
const {createSnapshotStore,refreshDueSources,contentHash}=require('../lib/live-fixtures');
async function ownerChecks(){
 let calls=0;const seen=[];const store={dueIds:async()=>[],buildGlobalGeneration:async o=>{calls++;seen.push(o);return{state:'installed'};}};
 const off=await refreshDueSources({sources:[],store,environment:{}});assert.equal(calls,0);assert.equal(off.generation,undefined);
 const on=await refreshDueSources({sources:[],store,environment:{GLOBAL_FIXTURE_GENERATION_SHADOW:'true'}});assert.equal(calls,1);assert.deepEqual(seen,[{timeoutMs:6000}]);assert.equal(on.generation.state,'installed');
 const exhausted=await refreshDueSources({sources:[],store,maxRuntimeMs:5999,environment:{GLOBAL_FIXTURE_GENERATION_SHADOW:'true'}});assert.equal(calls,1);assert.equal(exhausted.generation.reason,'remaining_budget');
 const failed=await refreshDueSources({sources:[],store:{...store,buildGlobalGeneration:async()=>{calls++;throw Error('build unavailable');}},environment:{GLOBAL_FIXTURE_GENERATION_SHADOW:'true'}});assert.equal(calls,2);assert.equal(failed.generation.reason,'build_failed');assert.deepEqual(failed.failed,[]);
 const order=[],source={id:'owner-test',fetch:async()=>{order.push('fetch');return[{id:'owner-event',key:'rugby',date:'2026-10-24',status:'scheduled'}];}};
 await refreshDueSources({sources:[source],store:{...store,claim:async()=>({fixtures:[]}),publish:async()=>order.push('publish'),buildGlobalGeneration:async()=>{order.push('build');return{state:'installed'};}},environment:{GLOBAL_FIXTURE_GENERATION_SHADOW:'true'}});assert.deepEqual(order,['fetch','publish','build']);
 const readCalls=[];await createSnapshotStore({generationShadowRead:true,request:async(p,o)=>{readCalls.push({p,o});return p.endsWith('source_health')?[]:[{bundle:{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[]}}];}}).read();assert.equal(readCalls.length,2);assert.deepEqual(readCalls[1].o.headers,{'x-ns-fixture-generation':'shadow-v1'});assert(readCalls[1].o.timeoutMs<=6000);
 const normal=[];await createSnapshotStore({request:async(p,o)=>{normal.push(o);return p.endsWith('source_health')?[]:[{bundle:{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[]}}];}}).read();assert.deepEqual(normal[1].headers,{'x-ns-fixture-components':'clock-v1'});assert.throws(()=>createSnapshotStore({generationShadowRead:'true'}));return 7;
}
async function run(){
 let checks=await ownerChecks();const db=await require('./fixture-read-test-baseline').database();
 try{
 await db.exec("set timezone='UTC';set datestyle='ISO, MDY'");
 await db.exec(fs.readFileSync('supabase/migrations/20261022234325_coalesce_canonical_fixture_context.sql','utf8'));
 const major=Math.floor(Number((await db.query("select current_setting('server_version_num')n")).rows[0].n)/10000);
 const original=(await db.query("select pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)d")).rows[0].d;
 await db.exec('create view public.qa_generation_original with(security_invoker=true)as '+original+';grant select on public.qa_generation_original to service_role');
 const oldFunctions=(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('def',pg_get_functiondef(p.oid),'acl',p.proacl::text))v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','nothingsports_fixture_read_private')")).rows[0].v;
 for(const mutation of ['alter view public.nothingsports_current_global_fixture_bundle set(security_invoker=false)','grant select on public.nothingsports_current_global_fixture_bundle to anon','alter function public.nothingsports_fixture_observation_time(text)immutable']){await db.exec('begin;'+mutation);await assert.rejects(db.exec(forward),/differ/);await db.exec('rollback');checks++;}
 await db.exec('begin;'+forward+'commit');
 await db.exec('begin');await assert.rejects(db.exec(forward),/Original global view differs|already/);await db.exec('rollback');checks++;
 const header=async h=>db.query("select set_config('request.headers',$1,false)",[h]);
 const service=async fn=>{await db.exec('set role service_role');let failed=false;try{return await fn();}catch(error){failed=true;throw error;}finally{try{await db.exec('reset role');}catch(error){if(!failed)throw error;}}};
 const originalText=async()=>service(async()=>(await db.query('select bundle::text t from public.qa_generation_original')).rows[0].t);
 const candidateText=async()=>service(async()=>(await db.query('select bundle::text t from public.nothingsports_current_global_fixture_bundle')).rows[0].t);
 const equal=async()=>{assert.equal(await candidateText(),await originalText());checks++;};
 const build=async(budget=6000)=>service(async()=>(await db.query('select public.nothingsports_build_global_generation($1)v',[budget])).rows[0].v);
 const cached=async()=>service(async()=>(await db.query('select nothingsports_fixture_read_private.read_global_generation()v')).rows[0].v);
 const vector=async()=>(await db.query('select nothingsports_fixture_read_private.global_read_vector()v')).rows[0].v;
 const shadow=JSON.stringify({'x-ns-fixture-generation':'shadow-v1'});
 for(const value of ['', '{}','[]','null','invalid','{"x-ns-fixture-generation":"unknown"}','{"x-ns-fixture-components":"clock-v1"}',shadow]){await header(value);await equal();}
 assert.equal(await cached(),null);assert.equal((await build()).state,'installed');await header(shadow);await equal();assert(await cached());assert.equal((await build()).state,'unchanged');checks+=4;
 await db.exec("insert into public.nothingsports_fixture_sources(source_id)values('generation-a')");
 const today=(await db.query("select(statement_timestamp()at time zone 'Australia/Sydney')::date::text d")).rows[0].d;
 await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values('generation-a','first',array['first','alias:first'],jsonb_build_object('id','first','date',$1::text,'status','completed','homeScore',0,'awayScore',1,'scoreCheckedAt','2026-10-20T00:00:00.123456Z'),'base')",[today]);
 assert.equal(await cached(),null);await equal();assert.equal((await build()).state,'installed');await equal();checks+=2;
 const legacyWork=node=>(node['Subplan Name']==='CTE patches'?(node['Actual Loops']||0):0)+(node.Plans||[]).reduce((n,p)=>n+legacyWork(p),0);
 const plan=async h=>{await header(h);return service(async()=>(await db.query('explain(analyze,format json,timing off)select bundle from public.nothingsports_current_global_fixture_bundle')).rows[0]['QUERY PLAN'][0].Plan);};
 assert.equal(legacyWork(await plan(shadow)),0,'Hot generation must skip full original construction');assert(legacyWork(await plan('{}'))>0,'Work regression must detect actual original path');await header(shadow);checks++;
 const before=await vector();await db.exec("update public.nothingsports_fixture_sources set lease_until=clock_timestamp()+interval '1 minute',checked_at=clock_timestamp()where source_id='generation-a'");assert.deepEqual(await vector(),before);checks++;
 // Receipt-only changes need a new epoch even with unchanged facts/revision.
 await db.exec("update public.nothingsports_fixture_sources set discovery_report='{\"_fixtureObservations\":{\"first\":{\"s\":\"2026-10-20T01:00:00.654321Z\"}}}'where source_id='generation-a'");assert.notDeepEqual(await vector(),before);assert.equal(await cached(),null);assert.equal((await build()).state,'installed');await equal();assert.equal((await cached()).rows[0].fixture.scoreCheckedAt,'2026-10-20T01:00:00.654321+00:00');checks+=4;
 // One persistent epoch write for repeated changes; a same-TX build must refuse.
 await db.exec('begin');await db.exec("update public.nothingsports_fixture_current set fixture=fixture||'{\"homeScore\":2}'where fixture_id='first'");const one=await vector();await db.exec("update public.nothingsports_fixture_current set fixture=fixture||'{\"homeScore\":3}'where fixture_id='first'");assert.deepEqual(await vector(),one);assert.equal((await build()).reason,'source_transaction');await db.exec('rollback');assert(await cached());checks+=3;
 // Rollback, then delete/recreate same source identity with different facts.
 const incarnation=await vector();await db.exec("delete from public.nothingsports_fixture_sources where source_id='generation-a'");assert.equal(await cached(),null);await db.exec("insert into public.nothingsports_fixture_sources(source_id)values('generation-a')");assert.notDeepEqual(await vector(),incarnation);await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,content_hash)values('generation-a','replacement',jsonb_build_object('id','replacement','date',$1::text),'new')",[today]);assert.equal((await build()).state,'installed');await equal();assert.equal((await cached()).rows[0].fixture.id,'replacement');checks+=4;
 // Same-TX source deletion/recreation also gets a non-reusing incarnation.
 const priorIncarnation=await vector();await db.exec("begin;delete from public.nothingsports_fixture_sources where source_id='generation-a';insert into public.nothingsports_fixture_sources(source_id)values('generation-a')");
 await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,content_hash)values('generation-a','replacement',jsonb_build_object('id','replacement','date',$1::text,'homeScore',7),'recreated')",[today]);assert.notDeepEqual(await vector(),priorIncarnation);assert.equal((await build()).reason,'source_transaction');await db.exec('commit');assert.equal(await cached(),null);assert.equal((await build()).state,'installed');await equal();checks+=4;
 // Source addition, missing epochs, pending metadata, validity/policy/session and
 // disabled hooks always use raw fallback; never search an older slot for reuse.
 for(const mutation of ["insert into public.nothingsports_fixture_sources(source_id)values('generation-added')","insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash)values('generation-a','replacement','{\"id\":\"replacement\",\"status\":\"live\"}','score')","delete from public.nothingsports_fixture_current where fixture_id='replacement'","update nothingsports_fixture_read_private.fixture_context set base_selection=jsonb_set(base_selection,'{calendarWindow,status}','\"live\"')where fixture_id='replacement'","delete from nothingsports_fixture_read_private.global_read_epochs where source_id='generation-a'","insert into nothingsports_fixture_read_private.integrity_pending(source_id)values('generation-a')","alter table public.nothingsports_fixture_current disable trigger global_read_epoch_after_change"]){await db.exec('begin;'+mutation);assert.equal(await cached(),null);await equal();await db.exec('rollback');checks++;}
 await db.exec("set timezone='Asia/Tokyo'");assert.equal(await cached(),null);await equal();await db.exec("set timezone='UTC'");checks++;
 await db.exec("set datestyle='SQL, DMY'");assert.equal(await cached(),null);await equal();await db.exec("set datestyle='ISO, MDY'");checks++;
 // A hot model cannot bypass the ORIGINAL effective service read contract.
 for(const mutation of ['revoke select on public.nothingsports_fixture_current from service_role','revoke select on public.nothingsports_live_scores from service_role','revoke select on public.nothingsports_fixture_sources from service_role','revoke select on nothingsports_fixture_read_private.fixture_context from service_role','revoke execute on function public.nothingsports_fixture_observation_time(text)from service_role']){await db.exec('begin;'+mutation);await assert.rejects(candidateText(),/permission denied/);await db.exec('rollback');checks++;}
 for(const mutation of ['alter table public.nothingsports_fixture_current no force row level security','create policy qa_generation_policy on public.nothingsports_fixture_current for select to service_role using(false)']){await db.exec('begin;'+mutation);assert.equal(await cached(),null);await equal();await db.exec('rollback');checks++;}
 await db.exec('begin;alter role service_role nobypassrls');assert.equal(await cached(),null);await equal();await db.exec('rollback');checks++;
 // Direct accidental edits are forbidden. Even a privileged test bypass of
 // the row guard followed by re-enable cannot relabel payloads/manifests:
 // whole-value witness validation must fail without trusting the epoch alone.
 for(const edit of ["payload='{}'::json","source_vector='[]'::jsonb","valid_until=clock_timestamp()+interval '2 days'","policy='other'"]){await db.exec('begin');await assert.rejects(service(()=>db.exec('update nothingsports_fixture_read_private.global_read_generations set '+edit)),/install-only/);await db.exec('rollback');checks++;}
 for(const edit of ["payload='{}'::json","payload=(select payload from nothingsports_fixture_read_private.global_read_generations order by installed_at asc limit 1),source_vector=nothingsports_fixture_read_private.global_read_vector(),witness=(select witness from nothingsports_fixture_read_private.global_read_generations order by installed_at asc limit 1)","valid_until=clock_timestamp()+interval '2 days'","reference_clock=clock_timestamp()+interval '1 hour'"]){await db.exec('begin;alter table nothingsports_fixture_read_private.global_read_generations disable trigger global_generation_install_only');await db.exec('update nothingsports_fixture_read_private.global_read_generations set '+edit+" where slot=(select slot from nothingsports_fixture_read_private.global_read_generations order by installed_at desc,generation_id desc limit 1)");await db.exec('alter table nothingsports_fixture_read_private.global_read_generations enable trigger global_generation_install_only');assert.equal(await cached(),null);await equal();await db.exec('rollback');checks++;}
 const authorisedEdit=async sql=>service(async()=>{await db.exec("select set_config('nothingsports.generation_install',txid_current()::text||':'||(select generation_id::text from nothingsports_fixture_read_private.global_read_generations order by installed_at desc,generation_id desc limit 1),true)");return db.exec(sql+" where slot=(select slot from nothingsports_fixture_read_private.global_read_generations order by installed_at desc,generation_id desc limit 1)");});
 // Derive the EXACT production eligibility body into a test-only temp function;
 // no production clock arguments/flags or clock rewrites are added.
 const getterBody=forward.match(/create function nothingsports_fixture_read_private\.read_global_generation\(\)returns json[\s\S]*?as \$fn\$\n([\s\S]*?)\n\$fn\$;/)[1];
 await db.exec("create function pg_temp.qa_generation_at(s timestamptz,w timestamptz)returns json language sql stable security invoker set search_path=''as $test$"+getterBody.replaceAll('statement_timestamp()',()=> '($1)').replaceAll('clock_timestamp()',()=> '($2)')+'$test$;grant execute on function pg_temp.qa_generation_at(timestamptz,timestamptz)to service_role');
 for(const c of [
  ['2026-10-03T13:59:59Z','2026-10-03T14:00:01Z','2026-10-03T14:00:00Z','2026-10-04T13:00:00Z','2026-10-04',false],
  ['2026-10-24T01:00:00Z','2026-10-24T01:00:02Z','2026-10-24T01:00:01Z','2026-10-24T13:00:00Z','2026-10-24',false],
  ['2026-10-24T01:00:02Z','2026-10-24T13:00:00Z','2026-10-24T01:00:01Z','2026-10-24T13:00:00Z','2026-10-24',false],
  ['2026-10-24T01:00:01Z','2026-10-24T01:00:01Z','2026-10-24T01:00:01Z','2026-10-24T13:00:00Z','2026-10-24',true]
 ]){await db.exec('begin');await authorisedEdit("update nothingsports_fixture_read_private.global_read_generations set reference_clock='"+c[2]+"',valid_until='"+c[3]+"',sydney_day='"+c[4]+"'");const value=await service(async()=>(await db.query('select pg_temp.qa_generation_at($1,$2)v',[c[0],c[1]])).rows[0].v);assert.equal(value!==null,c[5]);await db.exec('rollback');checks++;}
 // Original parser's within-day transition preserves PG microseconds, invalid
 // dates/strings and timezone offsets. It is expiry, never a new fact clock.
 for(const raw of ['bad','2026-02-30T00:00:00Z',null])assert.equal((await db.query('select nothingsports_fixture_read_private.global_read_clock_transition($1)v',[raw])).rows[0].v,null);checks++;
 const transition=(await db.query("select to_char(nothingsports_fixture_read_private.global_read_clock_transition(to_char(statement_timestamp()+interval '10 minutes','YYYY-MM-DD\"T\"HH24:MI:SS.US')||'Z'),'YYYY-MM-DD\"T\"HH24:MI:SS.US') a,to_char(statement_timestamp()+interval '5 minutes','YYYY-MM-DD\"T\"HH24:MI:SS.US') b")).rows[0];assert.equal(transition.a,transition.b);checks++;
 await db.exec("update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object('replacement',jsonb_build_object('s',to_char(clock_timestamp()+interval '10 minutes','YYYY-MM-DD\"T\"HH24:MI:SS.US')||'Z')))where source_id='generation-a'");assert.equal((await build()).state,'installed');assert((await cached()).rows[0].fixture.scoreCheckedAt===null);const valid=(await db.query("select valid_until<clock_timestamp()+interval '6 minutes'within_day from nothingsports_fixture_read_private.global_read_generations order by installed_at desc limit 1")).rows[0];assert(valid.within_day);await equal();checks+=3;
 // Actual short within-day clock transition: no publication/epoch changes
 // between null-at-build and admissible-on-fallback. This is a constructed
 // expiry test, not source evidence or a new product timer.
 await db.exec("update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object('replacement',jsonb_build_object('s',to_char(clock_timestamp()+interval '5 minutes 2 seconds','YYYY-MM-DD\"T\"HH24:MI:SS.US')||'Z')))where source_id='generation-a'");
 assert.equal((await build()).state,'installed');const clockVector=await vector();assert.equal((await cached()).rows[0].fixture.scoreCheckedAt,null);await new Promise(resolve=>setTimeout(resolve,2100));assert.deepEqual(await vector(),clockVector);assert.equal(await cached(),null);await equal();assert(JSON.parse(await originalText()).rows[0].fixture.scoreCheckedAt);checks+=4;
 // Post-CAS invalidation injection on an owned disposable DB. It proves the
 // fence response; it does not establish actual concurrent backend behavior.
 await db.exec("begin;create function public.qa_generation_race()returns trigger language plpgsql as $$begin update public.nothingsports_fixture_current set fixture=fixture||'{\"homeScore\":99}'where fixture_id='replacement';return new;end$$;create trigger qa_generation_race before insert on nothingsports_fixture_read_private.global_read_generations for each row execute function public.qa_generation_race()");
 assert.equal((await build()).reason,'invalidated_after_install');assert.equal(await cached(),null);await equal();await db.exec('rollback');checks+=2;
 for(const instant of ['2026-10-03T13:59:59Z','2026-10-03T14:00:00Z','2026-10-04T12:59:59Z','2026-10-04T13:00:00Z']){const x=(await db.query("select (((($1::timestamptz at time zone 'Australia/Sydney')::date+1)::timestamp at time zone 'Australia/Sydney')>$1::timestamptz)ok",[instant])).rows[0];assert(x.ok);checks++;}
 // Bound actual stored slots/payloads; failures cannot alter canonical facts.
 await db.exec('begin');await assert.rejects(authorisedEdit("update nothingsports_fixture_read_private.global_read_generations set slot=2"),/payload\/slot cap/);await db.exec('rollback');checks++;
 await db.exec('begin');await assert.rejects(authorisedEdit("update nothingsports_fixture_read_private.global_read_generations set payload=json_build_object('oversize',repeat('x',16777216))"),/payload\/slot cap/);await db.exec('rollback');checks++;
 await assert.rejects(build(0),/Invalid global generation budget/);checks++;
 // Actual existing canonical compact publisher under its eight-second budget.
 const token='00000000-0000-4000-8000-000000000088';const fixtures=Array.from({length:959},(_,i)=>({id:'write:'+i,key:'rugby',date:today,status:'scheduled',homeTeamId:'home:'+i,awayTeamId:'away:'+i}));
 await db.query('select * from public.nothingsports_claim_fixture_source($1,$2)',['generation-budget',token]);const started=performance.now();
 await db.exec("begin;set local statement_timeout='8s';set local lock_timeout='1s'");await db.query('select public.nothingsports_publish_compact_scores($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7::jsonb)',['generation-budget',token,JSON.stringify(fixtures),JSON.stringify(fixtures.map(f=>({id:f.id,status:f.status}))),contentHash(fixtures),120000,'{}']);await db.exec('commit');const publishMs=performance.now()-started;assert(publishMs<8000,'Existing 8s write budget');checks++;assert.equal((await build(1)).reason,'budget');checks++;
 assert.equal((await build()).state,'installed');await equal();assert.equal((await db.query('select count(*)::int n from nothingsports_fixture_read_private.global_read_generations')).rows[0].n,2);checks++;
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from nothingsports_fixture_read_private.global_read_generations'),/permission denied/);await assert.rejects(db.query('select public.nothingsports_build_global_generation()'),/permission denied/);await db.exec('reset role');checks++;}
 // Inverse removes only owned derived state/hooks and preserves canonical facts.
 const facts=(await db.query("select md5(string_agg(row_to_json(c)::text,''order by source_id,fixture_id))h from public.nothingsports_fixture_current c")).rows[0].h;
 await db.exec('begin;'+inverse()+'commit');assert.equal((await db.query("select md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h,'fbc28299a5bf25428b286adc5ee2e0da');assert.equal((await db.query("select md5(string_agg(row_to_json(c)::text,''order by source_id,fixture_id))h from public.nothingsports_fixture_current c")).rows[0].h,facts);checks++;
 const restored=(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('def',pg_get_functiondef(p.oid),'acl',p.proacl::text))v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','nothingsports_fixture_read_private')")).rows[0].v;assert.deepEqual(restored,oldFunctions);checks++;
 await db.exec('begin;'+forward+'commit');await equal();checks++;
 console.log(JSON.stringify({schemaVersion:'global-generation-constructed.v1',major,checks,canonicalPublishFixtures:959,canonicalPublishMs:publishMs,canonicalPublishBudgetMs:8000,logicalSlots:2,perPayloadCap:16777216,defaultOff:true,constructedOnly:true,captureReplays:0,nativeCalls:0,productionCalls:0,physicalStorageOrWalBoundProven:false}));
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1});module.exports={run};
