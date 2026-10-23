'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const transport=require('../lib/fixture-clock-components');
const {createSnapshotStore,readLiveSnapshots,contentHash,GLOBAL_BUNDLE_PATH}=require('../lib/live-fixtures');
const forward=fs.readFileSync('supabase/migrations/20261022100230_header_gated_fixture_components.sql','utf8');
const inverse=fs.readFileSync('supabase/rollbacks/20261022100230_header_gated_fixture_components.sql','utf8');
const schema=transport.SCHEMA,headers=JSON.stringify(transport.HEADERS),empty={schemaVersion:schema,complete:true,rows:[],parsed_clocks:[]};
let checks=0;
const check=(name,fn)=>{fn();checks++;};
(async()=>{
 const db=await require('./fixture-read-test-baseline').database();
 try{
 await db.exec("set timezone='UTC'");
 const major=Number((await db.query("select current_setting('server_version_num')v")).rows[0].v)/10000|0;
 const original=(await db.query("select pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)d")).rows[0].d;
 const functions=async()=>(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text))v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='public'and p.proname like 'nothingsports_%')or n.nspname='nothingsports_fixture_read_private'")).rows[0].v;
 const oldFunctions=await functions();
 const facts=async()=>(await db.query("select jsonb_build_object('current',(select md5(string_agg(md5(row_to_json(c)::text),''order by source_id,fixture_id))from public.nothingsports_fixture_current c),'scores',(select md5(string_agg(md5(row_to_json(s)::text),''order by source_id,fixture_id))from public.nothingsports_live_scores s),'sources',(select md5(string_agg(md5(row_to_json(s)::text),''order by source_id))from public.nothingsports_fixture_sources s))v")).rows[0].v;
 await db.exec('create view public.qa_original_component_reference with(security_invoker=true)as '+original+';grant select on public.qa_original_component_reference to service_role');
 for(const mutation of [
  "create or replace view public.nothingsports_current_global_fixture_bundle as select '{}'::json bundle",
  'alter view public.nothingsports_current_global_fixture_bundle set(security_invoker=false)',
  'grant select on public.nothingsports_current_global_fixture_bundle to anon',
  'grant select on public.nothingsports_current_global_fixture_bundle to public',
  'grant select(bundle) on public.nothingsports_current_global_fixture_bundle to anon',
  'revoke select on public.nothingsports_current_global_fixture_bundle from service_role',
  'create role qa_component_grantee;grant select on public.nothingsports_current_global_fixture_bundle to qa_component_grantee',
  'alter function public.nothingsports_fixture_observation_time(text) immutable',
  'grant execute on function public.nothingsports_fixture_observation_time(text) to anon',
  'revoke execute on function public.nothingsports_fixture_observation_time(text) from service_role',
  'alter table public.nothingsports_fixture_current disable row level security',
  'alter table public.nothingsports_fixture_current alter column global_fixture drop expression'
 ]){await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(forward),/differs|differ/);await db.exec('rollback;');checks++;}
 await db.exec('begin;'+forward+'commit;');assert.deepEqual(await functions(),oldFunctions);checks++;
 await db.exec('begin;');await assert.rejects(db.exec(forward),/Original global view differs/);await db.exec('rollback;');checks++;
 const setHeaders=async value=>db.query("select set_config('request.headers',$1,false)",[value]);
 const read=async()=>{await db.exec('set role service_role');try{return(await db.query('select bundle from public.nothingsports_current_global_fixture_bundle')).rows[0].bundle;}finally{await db.exec('reset role');}};
 const legacyEqual=async()=>{const v=(await db.query('select (select bundle::text from public.qa_original_component_reference)=(select bundle::text from public.nothingsports_current_global_fixture_bundle) same')).rows[0].same;assert(v,'Legacy default must preserve exact JSON text');checks++;};
 for(const h of ['', '{}','[]','null','not JSON','{"x-ns-fixture-components":"unknown"}','{"X-NS-Fixture-Components":"clock-v1"}']){await setHeaders(h);await legacyEqual();assert.equal((await read()).schemaVersion,'current-fixture-bundle.v1');checks++;}
 await setHeaders(headers);check('Empty gated shape',()=>assert.deepEqual(transport.decode(empty),{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[]}));assert.deepEqual(await read(),empty);checks++;
 await setHeaders('{}');await db.exec('begin');await db.query("select set_config('request.headers',$1,true)",[headers]);assert.equal((await read()).schemaVersion,schema);await db.exec('commit');await legacyEqual();checks++;
 await db.exec("insert into public.nothingsports_fixture_sources(source_id)values('component-a'),('component-z')");
 const today=(await db.query("select (statement_timestamp()at time zone 'Australia/Sydney')::date::text d")).rows[0].d;
 const fact='2026-10-20T00:00:00.123456Z',receipt='2026-10-20T01:00:00.654321Z';
 await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values('component-a','first',array['first','alias:first'],jsonb_build_object('id','first','key','tennis','date',$1::text,'status','scheduled','homeScore',0,'awayScore',0,'scoreCheckedAt',$2::text,'statusCheckedAt',$2::text,'editorialNarrative','private prose'),'one')",[today,fact]);
 await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at)values('component-a','first',jsonb_build_object('status','completed','homeScore',0,'awayScore',1,'scoreCheckedAt',$1::text,'statusCheckedAt',null),'score',$2::timestamptz)",[fact,receipt]);
 await db.query("update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object('first',jsonb_build_object('s',$1::text,'t',$1::text)))where source_id='component-a'",[receipt]);
 const compare=async()=>{
  await setHeaders('{}');const legacy=await read();await legacyEqual();await setHeaders(headers);const wire=await read(),decoded=transport.decode(wire);assert.deepEqual(decoded,legacy);assert.equal(contentHash(decoded.rows.map(r=>r.fixture)),contentHash(legacy.rows.map(r=>r.fixture)));checks+=2;return{wire,legacy,decoded};
 };
 let pair=await compare();check('Exact original observation and completion',()=>{const f=pair.decoded.rows[0].fixture;assert.equal(f.homeScore,0);assert.equal(f.scoreFactObservedAt,'2026-10-20T00:00:00.123456+00:00');assert.equal(f.scoreCheckedAt,'2026-10-20T01:00:00.654321+00:00');assert.equal(f.firstConfirmedCompleteAt,'2026-10-20T01:00:00.654321+00:00');assert(!Object.hasOwn(f,'editorialNarrative'));});
 const plan=async h=>{await setHeaders(h);return(await db.query('explain(analyze,buffers,format json,timing off) select bundle from public.nothingsports_current_global_fixture_bundle')).rows[0]['QUERY PLAN'][0];};
 const patchLoops=node=>(node['Subplan Name']==='CTE patches'?node['Actual Loops']:0)+(node.Plans||[]).reduce((n,p)=>n+patchLoops(p),0);
 const legacyPlan=await plan('{}'),componentPlan=await plan(headers);
 const noLegacyPatchWork=p=>assert.equal(patchLoops(p.Plan),0,'Gated transport must not execute legacy patch assembly');
 assert(patchLoops(legacyPlan.Plan)>0);noLegacyPatchWork(componentPlan);assert.throws(()=>noLegacyPatchWork(legacyPlan),/Gated transport must not execute/);checks++;
 await db.exec("set timezone='Asia/Tokyo'");const offset=await compare();assert.equal(offset.decoded.rows[0].fixture.scoreFactObservedAt,'2026-10-20T09:00:00.123456+09:00');checks++;await db.exec("set timezone='UTC'");
 // Same API and source-hash result on new SQL, old SQL and app-first deployment.
 const manifest=[{source_id:'component-a',revision:1},{source_id:'component-z',revision:1}];
 const storeRead=async(bundle,opts={})=>{const calls=[];const sources=await createSnapshotStore({request:async(path,options={})=>{calls.push({path,options});if(path.endsWith('nothingsports_read_fixture_source_health'))return manifest;assert.equal(path,GLOBAL_BUNDLE_PATH);return[{bundle}];}}).read(opts);assert.equal(calls.length,2);assert.deepEqual(calls[1].options.headers,transport.ADMISSION_HEADERS);assert(calls[1].options.timeoutMs>0&&calls[1].options.timeoutMs<=6000);return sources;};
 assert.deepEqual(await storeRead(pair.wire),await storeRead(pair.legacy));checks++;
 for(const scope of ['selected','match-centre','participants']){
  const calls=[];const options=scope==='selected'?{ids:['first']}:scope==='match-centre'?{scope,interactive:true}:{scope,interactive:true,sportKeys:['tennis'],knownSportKeys:['tennis'],participantIds:['p:first']};
  await createSnapshotStore({request:async(path,opts)=>{calls.push({path,opts});if(path.endsWith('nothingsports_read_fixture_source_health'))return manifest;return scope==='selected'?[]:{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[],scope,...(scope==='participants'?{sportKeys:['tennis'],knownSportKeys:['tennis'],participantIds:['p:first'],requiredIds:[]}:{})};}}).read(options);
  assert.equal(calls.length,2);assert(calls.every(c=>c.opts.headers===undefined&&c.opts.maxResponseBytes===undefined));if(scope==='selected')assert.equal(calls[1].opts.timeoutMs,3000);else assert(calls[1].opts.timeoutMs>0&&calls[1].opts.timeoutMs<=5000);checks++;
 }
 const malformed=structuredClone(pair.wire);malformed.parsed_clocks=[];await assert.rejects(storeRead(malformed),/Missing parsed fixture clock/);checks++;
 const invalid=structuredClone(pair.wire);delete invalid.rows[0].base_is_sql_null;await assert.rejects(storeRead(invalid),/Invalid fixture component row/);checks++;
 for(const change of [wire=>{wire.parsed_clocks.push({...wire.parsed_clocks[0]});},wire=>{wire.parsed_clocks[0].stamp='invented clock';},wire=>{wire.rows[0].raw.pop();},wire=>{delete wire.rows[0].score_is_sql_null;}]){
  const wire=structuredClone(pair.wire);change(wire);await assert.rejects(storeRead(wire),/Invalid/);checks++;
 }
 let liveWire=pair.wire;
 const failureStore=createSnapshotStore({request:async path=>path.endsWith('nothingsports_read_fixture_source_health')?manifest:[{bundle:liveWire}]});
 const lastGood=await readLiveSnapshots({store:failureStore,now:10000});liveWire=malformed;
 const retained=await readLiveSnapshots({store:failureStore,now:41001});assert.equal(retained.stale,true);assert.equal(retained.readAt,lastGood.readAt);assert.deepEqual(retained.sources,lastGood.sources);checks++;
 // All validation must finish before any reconstruction, even a late missing map key.
 let reconstructed=0;const earlyBase={};Object.defineProperty(earlyBase,'mergeWitness',{enumerable:true,get(){reconstructed++;return 0;}});
 const early={...pair.wire.rows[0],base:earlyBase,raw:Array(6).fill(null)};
 const late={...pair.wire.rows[0],raw:['last-row-missing',null,null,null,null,null]};assert.throws(()=>transport.decode({...pair.wire,rows:[early,late]}),/Missing parsed fixture clock/);assert.equal(reconstructed,0);checks++;
 // Construct the SQL reference, retaining all null distinctions rather than coercing JS dates.
 const bases=[{sql:true,value:null},...[{}, {zero:0,nested:{a:null}},[],[0,null],null,false,0,'base',JSON.parse('{"__proto__":{"safe":true},"constructor":0}')].map(value=>({sql:false,value}))];
 const scores=[{sql:true,value:null},...[null,{}, {zero:null,nested:{b:0}},[],[0],false,0,'score'].map(value=>({sql:false,value}))];
 const cases=[];for(const b of bases)for(const s of scores)cases.push({source_id:'unit',fixture_id:String(cases.length),identity_keys:[null,'alias'],base:b.value,base_is_sql_null:b.sql,score:s.value,score_is_sql_null:s.sql,raw:cases.length%4===0?Array(6).fill(null):pair.wire.rows[0].raw,first_completed_at:cases.length%3===0?pair.wire.rows[0].first_completed_at:null});
 const clockMap=Object.fromEntries(pair.wire.parsed_clocks.map(e=>[e.value,e.stamp]));
 const expected=(await db.query(`with input as(select value r from jsonb_array_elements($1::jsonb)),t as(select r,
 case when(r->>'base_is_sql_null')::boolean then null::jsonb else r->'base'end base,
 case when(r->>'score_is_sql_null')::boolean then null::jsonb else r->'score'end score,
 jsonb_build_object('fixtureObservationSchema','fixture-observations.v1',
 'scoreFactObservedAt',coalesce($2::jsonb->>(r->'raw'->>0),$2::jsonb->>(r->'raw'->>1)),
 'statusFactObservedAt',coalesce($2::jsonb->>(r->'raw'->>2),$2::jsonb->>(r->'raw'->>3)),
 'scoreCheckedAt',coalesce($2::jsonb->>(r->'raw'->>4),$2::jsonb->>(r->'raw'->>0),$2::jsonb->>(r->'raw'->>1)),
 'statusCheckedAt',coalesce($2::jsonb->>(r->'raw'->>5),$2::jsonb->>(r->'raw'->>2),$2::jsonb->>(r->'raw'->>3))) patch,
 case when r->'first_completed_at'='null'::jsonb then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',r->'first_completed_at')end completion from input)
 select case when jsonb_typeof(base)='object'and(score is null or jsonb_typeof(score)='object')then base||((coalesce(score,'{}'::jsonb)||patch)||completion)else((base||coalesce(score,'{}'::jsonb))||patch)||completion end fixture from t`,[JSON.stringify(cases),JSON.stringify(clockMap)])).rows;
 const unitDecoded=transport.decode({schemaVersion:schema,complete:true,rows:cases,parsed_clocks:pair.wire.parsed_clocks});for(let i=0;i<cases.length;i++)assert.deepEqual(unitDecoded.rows[i].fixture,expected[i].fixture,'SQL concat/null case '+i);checks+=cases.length;
 assert(unitDecoded.rows.slice(0,scores.length).every(r=>r.fixture===null));checks++;
 // Private transport stays inaccessible even with the opt-in header.
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select bundle from public.nothingsports_current_global_fixture_bundle'),/permission denied/);await db.exec('reset role');checks++;}
 const oldTargeted=(await db.query("select * from public.nothingsports_read_current_fixture_bundle_json_rows(array['alias:first'])")).rows;
 await setHeaders('{}');assert.deepEqual((await db.query("select * from public.nothingsports_read_current_fixture_bundle_json_rows(array['alias:first'])")).rows,oldTargeted);checks++;
 await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)select 'component-z','bulk:'||lpad(i::text,5,'0'),array['bulk:'||i],jsonb_build_object('id','bulk:'||i,'date',$1::text,'status','scheduled'),'bulk'from generate_series(1,4999)i",[today]);
 pair=await compare();assert.equal(pair.wire.rows.length,5000);assert.equal(pair.wire.complete,true);checks++;
 await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,content_hash)values('component-z','zz:overflow',jsonb_build_object('id','overflow','date',$1::text),'overflow')",[today]);
 pair=await compare();assert.equal(pair.wire.rows.length,5001);assert.equal(pair.wire.complete,false);await assert.rejects(storeRead(pair.wire),/Incomplete current fixture bundle/);checks++;
 // Rollback is committed, tolerates intervening facts, and the new app consumes legacy.
 const beforeUndo=await facts();await db.exec('begin;'+inverse+'commit;');assert.deepEqual(await facts(),beforeUndo);assert.equal((await db.query("select md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h,'fbc28299a5bf25428b286adc5ee2e0da');checks++;
 await db.exec("delete from public.nothingsports_fixture_current where source_id='component-z'and fixture_id='zz:overflow'");
 assert.equal((await storeRead(await read())).flatMap(source=>source.fixtures).length,5000);checks++;
 await db.exec('begin;');await assert.rejects(db.exec(inverse),/rollback baseline/);await db.exec('rollback;');checks++;
 const beforeReapply=await facts();await db.exec('begin;'+forward+'commit;');assert.deepEqual(await facts(),beforeReapply);await setHeaders('{}');await legacyEqual();assert.deepEqual(await functions(),oldFunctions);checks++;
 // The actual service helper forwards the trusted header without exposing credentials to app inputs.
 let fetchOptions;await require('../lib/supabase-server').supabaseServiceRequest('/rest/v1/example',{environment:{SUPABASE_URL:'https://example.test',SUPABASE_SECRET_KEY:'sb_secret_fixture_test'},headers:transport.HEADERS,fetchImpl:async(_url,opts)=>{fetchOptions=opts;return{ok:true,status:200,text:async()=>'{"ok":true}'};}});assert.equal(fetchOptions.headers['x-ns-fixture-components'],'clock-v1');assert.equal(fetchOptions.headers.apikey,'sb_secret_fixture_test');checks++;
 console.log(JSON.stringify({schemaVersion:'fixture-clock-components-regression.v1',major,checks,constructedSqlCases:cases.length,cardinalities:[0,1,5000,5001],allInputsBeforeProjection:true,productionWrites:0,productionCalls:0,guardedUndoReapply:true,legacyTextEqual:true,unchangedFunctions:true}));
 }finally{await db.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
