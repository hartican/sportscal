'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const transport=require('../lib/fixture-clock-components');
const {createSnapshotStore,readLiveSnapshots,contentHash,GLOBAL_BUNDLE_PATH}=require('../lib/live-fixtures');
const filename='20261023152338_node_global_admission_envelope.sql';
const forward=fs.readFileSync('supabase/migrations/'+filename,'utf8');
const inverse=fs.readFileSync('supabase/rollbacks/'+filename,'utf8');
async function byteLimitChecks(){
 const {supabaseServiceRequest}=require('../lib/supabase-server');
 const environment={SUPABASE_URL:'https://local-only.invalid',SUPABASE_SECRET_KEY:'sb_secret_constructed_only'};
 let checks=0,calls=0;
 const request=(body,options={})=>supabaseServiceRequest('/rest/v1/constructed',{environment,fetchImpl:async()=>{calls++;return{ok:true,status:200,text:async()=>body};},...options});
 const body='{"v":"é 🇦🇺"}',size=Buffer.byteLength(body);
 assert.deepEqual(await request(body,{maxResponseBytes:size}),JSON.parse(body));checks++;
 const events=[];await assert.rejects(request(body,{maxResponseBytes:size-1,onTiming:e=>events.push(e.phase)}),e=>e.payload?.code==='supabase_response_too_large'&&e.status===502);assert(!events.includes('parse-start'));checks++;
 assert.deepEqual(await request(body),JSON.parse(body));assert.deepEqual(await request('bad JSON',{maxResponseBytes:8}),{message:'bad JSON'});assert.equal(await request('',{maxResponseBytes:1}),null);checks+=3;
 const before=calls;for(const value of [0,-1,1.5,Infinity,NaN,'20',Number.MAX_SAFE_INTEGER+1]){await assert.rejects(request('{}',{maxResponseBytes:value}),/Invalid Supabase response byte limit/);checks++;}assert.equal(calls,before);checks++;
 const controller=new AbortController();controller.abort(new Error('caller aborted'));await assert.rejects(request('{}',{signal:controller.signal,maxResponseBytes:2}));assert.equal(calls,before);checks++;
 const bodyAbort=new AbortController();let abortedCalls=0;await assert.rejects(request('{}',{signal:bodyAbort.signal,maxResponseBytes:2,fetchImpl:async()=>{abortedCalls++;return{ok:true,status:200,text:async()=>{bodyAbort.abort(new Error('body abort'));return new Promise(()=>{});}};}}));assert.equal(abortedCalls,1);checks++;
 await assert.rejects(request('',{maxResponseBytes:2,fetchImpl:async()=>({ok:false,status:409,text:async()=>'{}'})}),e=>e.status===409);checks++;
 await assert.rejects(request('',{maxResponseBytes:2,fetchImpl:async()=>({ok:true,status:200,text:async()=>{throw Error('constructed body failure');}})}),/constructed body failure/);checks++;
 await assert.rejects(request('',{maxResponseBytes:2,fetchImpl:async()=>{throw Error('constructed fetch failure');}}),e=>e.status===502&&e.payload?.message==='constructed fetch failure');checks++;
 return checks;
}
async function run(){
 let checks=await byteLimitChecks(),comparisons=0;
 const db=await require('./fixture-read-test-baseline').database();
 try{
 await db.exec("set timezone='UTC';set datestyle='ISO, MDY'");
 const major=Math.floor(Number((await db.query("select current_setting('server_version_num')n")).rows[0].n)/10000);
 const original=(await db.query("select pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)d")).rows[0].d;
 await db.exec('create view public.qa_admission_original with(security_invoker=true)as '+original+';grant select on public.qa_admission_original to service_role;');
 const contracts=async()=>(await db.query(`select jsonb_build_object('functions',(select jsonb_object_agg(p.oid::text,jsonb_build_object('def',pg_get_functiondef(p.oid),'acl',p.proacl::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='public'and p.proname like 'nothingsports_%')or n.nspname='nothingsports_fixture_read_private'),'tables',(select jsonb_object_agg(c.oid::text,jsonb_build_object('acl',c.relacl::text,'rls',c.relrowsecurity,'force',c.relforcerowsecurity))from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and(n.nspname='public'or n.nspname='nothingsports_fixture_read_private')))v`)).rows[0].v;
 const facts=async()=>(await db.query("select jsonb_build_object('current',(select md5(string_agg(md5(row_to_json(c)::text),''order by source_id,fixture_id))from public.nothingsports_fixture_current c),'scores',(select md5(string_agg(md5(row_to_json(s)::text),''order by source_id,fixture_id))from public.nothingsports_live_scores s),'sources',(select md5(string_agg(md5(row_to_json(s)::text),''order by source_id))from public.nothingsports_fixture_sources s))v")).rows[0].v;
 const initialContracts=await contracts();
 for(const mutation of ["create or replace view public.nothingsports_current_global_fixture_bundle as select '{}'::json bundle",'alter view public.nothingsports_current_global_fixture_bundle set(security_invoker=false)','grant select on public.nothingsports_current_global_fixture_bundle to anon','grant select(bundle) on public.nothingsports_current_global_fixture_bundle to authenticated','grant select on public.nothingsports_current_global_fixture_bundle to public','revoke select on public.nothingsports_current_global_fixture_bundle from service_role','alter function public.nothingsports_fixture_observation_time(text) immutable','grant execute on function public.nothingsports_fixture_observation_time(text) to anon','alter table public.nothingsports_fixture_current disable row level security','alter table public.nothingsports_fixture_current alter column global_fixture drop expression']){
  await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(forward),/differ/);await db.exec('rollback');checks++;
 }
 await db.exec('begin;'+forward+'commit;');assert.deepEqual(await contracts(),initialContracts);checks++;
 await db.exec('begin');await assert.rejects(db.exec(forward),/Original global view differs/);await db.exec('rollback');checks++;
 const header=async value=>db.query("select set_config('request.headers',$1,false)",[value]);
 const read=async()=>{await db.exec('set role service_role');try{return(await db.query('select bundle from public.nothingsports_current_global_fixture_bundle')).rows[0].bundle;}finally{await db.exec('reset role');}};
 const legacyEqual=async()=>{assert.equal((await db.query('select(select bundle::text from public.qa_admission_original)=(select bundle::text from public.nothingsports_current_global_fixture_bundle)same')).rows[0].same,true);checks++;};
 for(const value of ['', '{}','[]','null','invalid','{"x-ns-fixture-components":"unknown"}',JSON.stringify(transport.HEADERS),'{"X-NS-Fixture-Components":"admission-v1"}']){await header(value);await legacyEqual();}
 const compare=async()=>{
  await header('{}');await legacyEqual();const legacy=await read();await header(JSON.stringify(transport.ADMISSION_HEADERS));const wire=await read(),decoded=transport.decode(wire);
  assert.deepEqual(decoded,legacy);assert.equal(contentHash(decoded.rows.map(r=>r.fixture)),contentHash(legacy.rows.map(r=>r.fixture)));comparisons++;checks+=2;return{wire,legacy,decoded};
 };
 let pair=await compare();assert.equal(pair.wire.input_count,0);checks++;
 await db.exec("insert into public.nothingsports_fixture_sources(source_id)values('admission-a'),('admission-z')");
 const dates=(await db.query("select((statement_timestamp()at time zone 'Australia/Sydney')::date-7)::text lo,((statement_timestamp()at time zone 'Australia/Sydney')::date+interval '1 year')::date::text hi,(statement_timestamp()at time zone 'Australia/Sydney')::date::text today")).rows[0];
 const cases=[
  {id:'today',date:dates.today,status:'scheduled',homeScore:0,awayScore:0,scoreCheckedAt:'2026-10-20T00:00:00.123456Z'},
  {id:'old',date:'1900-01-01'}, {id:'future',date:'2099-01-01'}, {id:'old-live',date:'1900-01-01',status:'live'},
  {id:'no-date'}, {id:'lower',date:dates.lo}, {id:'upper',date:dates.hi},
  {id:'end-wins',date:'1900-01-01',endDate:dates.today}, {id:'start',startDate:dates.today},
  {id:'window',schedulingWindow:{startsOn:dates.today,endsOn:dates.today}},
  {id:'empty-date',date:'',startDate:dates.today}, {id:'null-date',date:null},
  {id:'number-date',date:20260101}, {id:'object-date',date:{x:1}}, {id:'array-date',date:['1900-01-01']},
  {id:'newline-old',date:'1900-01-01\n'}, {id:'newline-future',date:'2099-01-01\n'},
  {id:'window-object',schedulingWindow:{startsOn:{z:0,a:1},endsOn:[true,0]}},
  {id:'score-old',date:dates.today}, {id:'score-null',date:'1900-01-01'},
  {id:'score-array',date:'1900-01-01'}, {id:'proto',date:dates.today,__proto__:null,constructor:0},
  {id:'zero',date:dates.today,homeScore:0}, {id:'unicode',date:dates.today,label:'é 🇦🇺'},
 ];
 for(let i=0;i<cases.length;i++){
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values('admission-a',$1,array[$1,'alias:'||$1],$2::jsonb,'base')",[String(i).padStart(3,'0'),JSON.stringify(cases[i])]);
 }
 const scores=[['018',{date:'1900-01-01',status:'completed',homeScore:0,awayScore:1,scoreCheckedAt:'2026-10-20T00:00:00.654321Z',statusCheckedAt:null}],['019',{date:null}]];
 for(const [id,score]of scores)await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at)values('admission-a',$1,$2::jsonb,'score','2026-10-20T01:00:00.123456Z')",[id,JSON.stringify(score)]);
 await db.exec("update public.nothingsports_fixture_sources set discovery_report='{\"_fixtureObservations\":{\"018\":{\"s\":\"2026-10-20T02:00:00.123456Z\",\"t\":\"invalid\"}}}' where source_id='admission-a'");
 pair=await compare();assert.equal(pair.wire.input_count,cases.length);assert(pair.decoded.rows.some(r=>r.fixture?.id==='newline-old'));assert(!pair.decoded.rows.some(r=>r.fixture?.id==='old'));checks+=3;
 const executedLegacy=node=>(['CTE calendar_windows','CTE candidates','CTE clock_inputs','CTE patches'].includes(node['Subplan Name'])?(node['Actual Loops']||0):0)+(node.Plans||[]).reduce((sum,child)=>sum+executedLegacy(child),0);
 await header(JSON.stringify(transport.ADMISSION_HEADERS));const newPlan=(await db.query('explain(analyze,format json,timing off)select bundle from public.nothingsports_current_global_fixture_bundle')).rows[0]['QUERY PLAN'][0];
 assert.equal(executedLegacy(newPlan.Plan),0,'New header must skip all legacy admission/clock/patch CTEs');
 await header('{}');const oldPlan=(await db.query('explain(analyze,format json,timing off)select bundle from public.nothingsports_current_global_fixture_bundle')).rows[0]['QUERY PLAN'][0];assert(executedLegacy(oldPlan.Plan)>0,'The work regression must detect the actual old path');checks++;
 // Missing, malformed, poisoned and valid indexed windows must follow the
 // original SQL's guard/fallback, including globally pending integrity.
 for(const poison of [null,{},[],{calendarWindow:null},{calendarWindow:{status:'live'}},{calendarWindow:{hasStatus:true,status:'live',hasEndDate:false,endDate:null,hasDate:false,date:null,hasStartDate:false,startDate:null,hasSchedulingWindow:false,schedulingWindow:null}}, {calendarWindow:{hasStatus:'true',status:'live',hasEndDate:false,endDate:null,hasDate:false,date:null,hasStartDate:false,startDate:null,hasSchedulingWindow:false,schedulingWindow:null}}, {calendarWindow:{hasStatus:null,status:null,hasEndDate:null,endDate:'',hasDate:null,date:'2099-01-01',hasStartDate:null,startDate:null,hasSchedulingWindow:true,schedulingWindow:{startsOn:{a:1},endsOn:0}}}]){
  await db.exec('begin');await db.query("update nothingsports_fixture_read_private.fixture_context set base_selection=$1::jsonb,score_selection=$1::jsonb where source_id='admission-a'and fixture_id='001'",[JSON.stringify(poison)]);await db.exec('delete from nothingsports_fixture_read_private.integrity_pending');await compare();await db.exec('rollback');
 }
 for(const mutation of ["delete from nothingsports_fixture_read_private.fixture_context where source_id='admission-a'and fixture_id='001'", "update nothingsports_fixture_read_private.fixture_context set shape_version=2 where source_id='admission-a'and fixture_id='001'", "insert into nothingsports_fixture_read_private.integrity_pending(source_id)values('admission-a')on conflict do nothing"]){await db.exec('begin;'+mutation);await compare();await db.exec('rollback');}
 // Constructed temp relations bypass current-table shape constraints solely
 // to compare SQL NULL/nonobject JSONB semantics with the actual original view
 // expression, rather than a second JavaScript version of the same algorithm.
 await db.exec("create temp table qa_admission_raw_current(source_id text,fixture_id text,identity_keys text[],fixture jsonb,global_fixture jsonb);create temp table qa_admission_raw_scores(source_id text,fixture_id text,score jsonb,first_completed_at timestamptz);create temp table qa_admission_raw_sources(source_id text,discovery_report jsonb);insert into qa_admission_raw_sources values('unit_raw','{}')");
 const rawValues=[null,{},[],['date'],false,0,'date',{date:'1900-01-01'},{date:dates.today},{date:null},{status:'live',date:'2099-01-01'},{schedulingWindow:{startsOn:{z:0,a:1},endsOn:[0,null]}}];
 let rawCases=0;
 for(const base of [{sql:true,value:null},...rawValues.map(value=>({sql:false,value}))])for(const score of [{sql:true,value:null},...rawValues.map(value=>({sql:false,value}))]){
  const id=String(rawCases++).padStart(3,'0');
  await db.query("insert into qa_admission_raw_current values('unit_raw',$1,array[$1],$2::jsonb,$2::jsonb)",[id,base.sql?null:JSON.stringify(base.value)]);
  await db.query("insert into qa_admission_raw_scores values('unit_raw',$1,$2::jsonb,null)",[id,score.sql?null:JSON.stringify(score.value)]);
 }
 const substitute=sql=>sql.replace(/(?:public\.)?nothingsports_fixture_current\b/g,'pg_temp.qa_admission_raw_current').replace(/(?:public\.)?nothingsports_live_scores\b/g,'pg_temp.qa_admission_raw_scores').replace(/(?:public\.)?nothingsports_fixture_sources\b/g,'pg_temp.qa_admission_raw_sources').replace(/;\s*$/,'');
 const actualDefinition=(await db.query("select pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)d")).rows[0].d;
 const rawOriginal=(await db.query('select bundle from('+substitute(original)+')q')).rows[0].bundle;
 await header(JSON.stringify(transport.ADMISSION_HEADERS));const rawWire=(await db.query('select bundle from('+substitute(actualDefinition)+')q')).rows[0].bundle;
 assert.equal(rawWire.input_count,rawCases);assert.deepEqual(transport.decode(rawWire),rawOriginal);comparisons++;checks+=2;
 // SQL retains exact ->> text even for values JavaScript numbers cannot hold.
 await db.exec('begin');await db.exec("update public.nothingsports_fixture_current set fixture=jsonb_build_object('id','big','date',9007199254740993::numeric,'schedulingWindow',jsonb_build_object('startsOn',1e30::numeric,'endsOn',jsonb_build_object('z',0,'a',1)))where fixture_id='000';delete from nothingsports_fixture_read_private.integrity_pending");await compare();await db.exec('rollback');
 await db.exec("set timezone='Asia/Tokyo'");await compare();await db.exec("set timezone='UTC'");
 // Decoder uses statement-owned bounds, including Sydney midnight/DST/leap
 // day/year windows; the SQL admission expression remains the oracle.
 for(const instant of ['2026-10-03T13:59:59Z','2026-10-03T14:00:00Z','2026-10-04T12:59:59Z','2026-10-04T13:00:00Z','2028-02-29T12:59:59Z','2028-02-29T13:00:00Z']){
  const bounds=(await db.query("select (($1::timestamptz at time zone 'Australia/Sydney')::date-7)::text lo,(($1::timestamptz at time zone 'Australia/Sydney')::date+interval '1 year')::date::text hi",[instant])).rows[0];
  const wire=structuredClone(pair.wire);wire.lower_date=bounds.lo;wire.upper_date=bounds.hi;wire.integrity_clear=false;
  const expected=(await db.query(`select value->>'fixture_id' id from jsonb_array_elements($1::jsonb)with ordinality as t(value,ord)
   cross join lateral(select value->'fallback'->>0 status,coalesce(nullif(value->'fallback'->>1,''),nullif(value->'fallback'->>2,''),nullif(value->'fallback'->>3,''),value->'fallback'->>4,'')ends_on,coalesce(nullif(value->'fallback'->>2,''),nullif(value->'fallback'->>3,''),value->'fallback'->>5,'')starts_on)f
   where f.status='live'or(f.ends_on!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'or f.ends_on>=$2)and(f.starts_on!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'or f.starts_on<=$3)order by ord limit 5001`,[JSON.stringify(wire.rows),bounds.lo,bounds.hi])).rows.map(r=>r.id);
  assert.deepEqual(transport.decode(wire).rows.map(r=>r.fixture_id),expected);checks++;
 }
 const bad=structuredClone(pair.wire);bad.rows.at(-1).raw[0]='missing-map-key';
 for(const change of [w=>{w.input_count--;},w=>{w.complete=false;},w=>{w.rows.push(w.rows[0]);w.input_count++;},w=>{w.rows.at(-1).fallback.pop();},w=>{w.rows.at(-1).context={shape_version:1,base_window:{},score_window:{},edges:[]};},w=>{w.parsed_clocks.push({...w.parsed_clocks[0]});}]){const wire=structuredClone(pair.wire);change(wire);assert.throws(()=>transport.decode(wire),/Invalid/);checks++;}
 assert.throws(()=>transport.decode(bad),/Missing parsed fixture clock/);checks++;
 let reconstructed=0;const earlyBase={};Object.defineProperty(earlyBase,'witness',{enumerable:true,get(){reconstructed++;return 1;}});
 const allBeforeProjection=structuredClone(pair.wire);allBeforeProjection.rows[0].base=earlyBase;allBeforeProjection.rows.at(-1).fallback=[];
 assert.throws(()=>transport.decode(allBeforeProjection),/Invalid fixture admission row/);assert.equal(reconstructed,0);checks++;
 const manifest=[{source_id:'admission-a',revision:1},{source_id:'admission-z',revision:1}];
 const calls=[];let current=pair.wire;
 const store=createSnapshotStore({request:async(path,opts)=>{calls.push({path,opts});return path.endsWith('nothingsports_read_fixture_source_health')?manifest:[{bundle:current}];}});
 const good=await readLiveSnapshots({store,now:10000});assert.equal(good.stale,false);assert.equal(calls.length,2);assert.deepEqual(calls[1].opts.headers,transport.ADMISSION_HEADERS);assert.equal(calls[1].opts.maxResponseBytes,64*1024*1024);assert.equal(calls[0].opts.maxResponseBytes,undefined);checks++;
 current=bad;const stale=await readLiveSnapshots({store,now:41001});assert(stale.stale);assert.equal(stale.readAt,good.readAt);assert.deepEqual(stale.sources,good.sources);assert.equal(calls.length,4);checks++;
 // Preserve all raw rows before admission: 5001 excluded rows cannot hide a
 // later valid row. Once 5001 ARE admitted, retain the original failure signal.
 const sourceRow=structuredClone(pair.wire.rows[0]);sourceRow.context=null;sourceRow.raw=Array(6).fill(null);
 const many={...pair.wire,parsed_clocks:[],integrity_clear:false,rows:[]};
 for(let i=0;i<5001;i++)many.rows.push({...sourceRow,fixture_id:'old:'+i,fallback:['scheduled','1900-01-01','1900-01-01',null,null,null]});
 many.rows.push({...sourceRow,fixture_id:'later',fallback:['live',null,null,null,null,null]});many.input_count=many.rows.length;
 assert.deepEqual(transport.decode(many).rows.map(r=>r.fixture_id),['later']);checks++;
 for(let i=0;i<5001;i++)many.rows[i].fallback=['live',null,null,null,null,null];
 assert.equal(transport.decode(many).rows.length,5001);assert.equal(transport.decode(many).complete,false);checks++;
 // Actual SQL >5001 raw rows are NOT truncated; compare the first 5001 after
 // original admission, then prove complete with exactly 5000 admitted rows.
 await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,content_hash)select 'admission-z','bulk:'||lpad(i::text,5,'0'),jsonb_build_object('id','bulk:'||i,'status','live'),'bulk'from generate_series(1,5001)i");
 pair=await compare();assert(pair.wire.rows.length>5001);assert.equal(pair.decoded.rows.length,5001);assert.equal(pair.decoded.complete,false);checks++;
 await db.exec("delete from public.nothingsports_fixture_current where source_id='admission-a';delete from public.nothingsports_fixture_current where source_id='admission-z'and fixture_id='bulk:05001'");pair=await compare();assert.equal(pair.decoded.rows.length,5000);assert.equal(pair.decoded.complete,true);checks++;
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select bundle from public.nothingsports_current_global_fixture_bundle'),/permission denied/);await db.exec('reset role');checks++;}
 const oldFacts=await facts();await db.exec('begin;'+inverse+'commit');assert.deepEqual(await facts(),oldFacts);assert.deepEqual(await contracts(),initialContracts);assert.equal((await db.query("select md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h,'fbc28299a5bf25428b286adc5ee2e0da');checks++;
 await header(JSON.stringify(transport.ADMISSION_HEADERS));assert.equal((await read()).schemaVersion,'current-fixture-bundle.v1');checks++;
 await db.exec('begin');await assert.rejects(db.exec(inverse),/rollback baseline/);await db.exec('rollback');checks++;
 await db.exec('begin;'+forward+'commit');assert.deepEqual(await facts(),oldFacts);assert.deepEqual(await contracts(),initialContracts);checks++;
 console.log(JSON.stringify({schemaVersion:'fixture-admission-components-regression.v1',major,checks,fullSqlComparisons:comparisons,constructedRawSqlCases:rawCases,constructedOnly:true,productionCalls:0,captureReplays:0,capturedFullConsumerInvocations:0,legacyTextEqual:true,guardedUndoReapply:true,rawInputsBeforeAdmission:true}));
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1});
module.exports={run};
