'use strict';
// PREPARED, UNRUN. Small functional cases never establish current-world loading speed.
const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const source=require('./generated-calendar-source');
const ns='nothingsports_fixture_read_private.',table=ns+'fixture_context';
const live=require('../../lib/live-fixtures'),grouped=require('../../lib/fixture-source-groups');
const allTables=['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','public.nothingsports_fixture_snapshots',table,ns+'fixture_tokens',ns+'source_tokens',ns+'integrity_pending',ns+'near_selection'];
const ident=x=>'"'+x.replaceAll('"','""')+'"';
const sqlBody=s=>s.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,'');
async function regression(db,report){
 const mark=(name,details={})=>report.tests.push({name,...details});
 const expected=require('../fixtures/near-selection-contracts').candidate;
 const sourceId='discovery-generated-calendar-test',secondSource='discovery-generated-calendar-alias',id='gc:original',token='00000000-0000-4000-8000-000000000061';
 const today=new Date().toISOString().slice(0,10),old='2026-10-01T01:02:03.456789+00:00';
 const event=(extra={})=>({id,status:'live',date:today,startDate:today,endDate:today,startTimeUtc:today+'T12:17:00Z',homeParticipantId:'gc:home',awayParticipantId:'gc:away',sourceEventIds:['gc:alias'],statusCheckedAt:old,opaque:{keep:'unchanged'},...extra});
 const spec={nothingsports_claim_fixture_source:[['p_source_id','text'],['p_token','uuid']],nothingsports_publish_fixture_source:[['p_source_id','text'],['p_token','uuid'],['p_fixtures','jsonb'],['p_hash','text'],['p_interval_ms','integer']],nothingsports_publish_fixture_source_report:[['p_source_id','text'],['p_token','uuid'],['p_fixtures','jsonb'],['p_hash','text'],['p_interval_ms','integer'],['p_report','jsonb']],nothingsports_publish_compact_scores:[['p_source_id','text'],['p_token','uuid'],['p_fixtures','jsonb'],['p_scores','jsonb'],['p_hash','text'],['p_interval_ms','integer'],['p_report','jsonb']]};
 const request=async(url,{body})=>{const name=url.split('/').pop(),args=spec[name];assert(args,'Only actual existing publisher/claim RPCs');assert.deepEqual(Object.keys(body).sort(),args.map(x=>x[0]).sort());const values=args.map(([key,type])=>type==='jsonb'&&body[key]!==null?JSON.stringify(body[key]):body[key]);const query='SELECT public.'+name+'('+args.map(([,type],i)=>'$'+(i+1)+'::'+type).join(',')+') value';return name==='nothingsports_claim_fixture_source'?(await db.query('SELECT * FROM public.'+name+'($1::text,$2::uuid)',values)).rows:(await db.query(query,values)).rows[0].value;};
 async function service(fn){await db.exec('SET ROLE service_role');let primary;try{return await fn();}catch(e){primary=e;throw e;}finally{try{await db.exec('RESET ROLE');}catch(e){if(!primary)throw e;}}}
 async function publish(fixtures,{compact=false,which=sourceId}={}){
  await db.exec("SET statement_timeout='8s';SET lock_timeout='1s'");
  await db.query('UPDATE public.nothingsports_fixture_sources SET next_due_at=clock_timestamp()WHERE source_id=$1',[which]);
  const previous=process.env.MATCH_CENTRE_SCORE_WRITES;process.env.MATCH_CENTRE_SCORE_WRITES=String(compact);
  try{const store=live.createSnapshotStore({request});return await service(async()=>{assert(await store.claim(which,token));return store.publish(which,token,{fixtures,hash:live.contentHash(fixtures),intervalMs:120000,coverage:{status:'complete'},observedFixtures:fixtures,observedAt:new Date()});});}
  finally{if(previous===undefined)delete process.env.MATCH_CENTRE_SCORE_WRITES;else process.env.MATCH_CENTRE_SCORE_WRITES=previous;}
 }
 async function drain(){await db.exec('SET CONSTRAINTS ALL IMMEDIATE;SET CONSTRAINTS ALL DEFERRED');}
 const originalColumns={};for(const t of allTables)originalColumns[t]=(await db.query('SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum',[t])).rows.map(r=>r.attname);
 async function facts(){const out={};for(const t of allTables){const fields=originalColumns[t].flatMap(n=>["'"+n+"'",'t.'+ident(n)]).join(',');out[t]=(await db.query('SELECT coalesce(jsonb_agg(r ORDER BY r::text),\'[]\'::jsonb)rows FROM(SELECT jsonb_build_object('+fields+')r FROM '+t+' t)q')).rows[0].rows;}return out;}
 async function functions(){for(const item of expected){const row=(await db.query("SELECT jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig)contract FROM pg_proc p WHERE oid=to_regprocedure($1)",[item.signature])).rows[0];assert.deepEqual(row?.contract,item.contract,item.signature);}}
 async function derived(){
  const bad=(await db.query('SELECT count(*)::int n FROM '+table+' ctx WHERE global_base_window IS DISTINCT FROM(base_selection->\'calendarWindow\')OR global_score_window IS DISTINCT FROM(score_selection->\'calendarWindow\')OR global_window_valid IS DISTINCT FROM('+source.predicate.replaceAll('ctx.base_window',"(ctx.base_selection->'calendarWindow')").replaceAll('ctx.score_window',"(ctx.score_selection->'calendarWindow')")+')')).rows[0].n;
  assert.equal(bad,0,'Every generated value follows actual original parent columns');
 }
 async function consumer(text,health,now){
  const store=live.createSnapshotStore({transport:grouped.CANDIDATE,request:async(url,options)=>{const raw=url===live.GLOBAL_BUNDLE_PATH?'[{"bundle":'+text+'}]':health;assert(url===live.GLOBAL_BUNDLE_PATH||url==='/rest/v1/rpc/nothingsports_read_fixture_source_health');options.onTiming?.({phase:'text-ready',elapsedMs:0,bytes:Buffer.byteLength(raw),format:'json'});return JSON.parse(raw);}});
  const snapshot=await live.readLiveSnapshots({store,scope:'global',now,maxAgeMs:0});assert.equal(snapshot.stale,false);assert.equal(snapshot.readFailure,undefined);return snapshot;
 }
 async function same(label,header=true,reference='public.qa_gc_original',candidate='public.nothingsports_current_global_fixture_bundle'){
  await db.query('SELECT set_config(\'request.headers\',$1,false)',[JSON.stringify(header?grouped.HEADERS:{})]);
  await db.exec("SET statement_timeout='6s'");
  const row=await service(async()=>(await db.query("SELECT(SELECT bundle FROM "+reference+")::text a,(SELECT bundle FROM "+candidate+")::text b,(SELECT coalesce(json_agg(row_to_json(h)),'[]'::json)::text FROM public.nothingsports_read_fixture_source_health()h)health")).rows[0]);
  assert.equal(row.a,row.b,label+' complete ordered wire at SAME statement clock');
  if(header){const now=Date.now();assert.deepEqual(grouped.decode(JSON.parse(row.a)),grouped.decode(JSON.parse(row.b)));assert.deepEqual(await consumer(row.a,row.health,now),await consumer(row.b,row.health,now));}
  mark(label,{grouped:header,bytes:Buffer.byteLength(row.a)});return JSON.parse(row.a);
 }
 async function negative(label,operation,pattern){
  const before=await facts(),beforeView=(await db.query("SELECT md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h;
  await db.exec('SAVEPOINT gc_negative');let error;
  try{await operation();}catch(e){error=e;}finally{await db.exec('ROLLBACK TO SAVEPOINT gc_negative;RELEASE SAVEPOINT gc_negative;RESET ROLE');}
  assert(error,label+' must refuse');let diagnostic;
  if(typeof pattern==='function')diagnostic=await pattern(error);else assert.match(error.message,pattern);
  assert.deepEqual(await facts(),before,label+' original-column facts unchanged');assert.equal((await db.query("SELECT md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h,beforeView);mark(label,{refused:true,code:error.code,...diagnostic});
 }
 async function witnessCollisions(phase){
  await db.exec('BEGIN');try{for(const [kind,name]of [['TABLE','ns_gc_expected_context'],['VIEW','ns_gc_expected_view']]){
   await db.exec(kind==='TABLE'?"CREATE TEMP TABLE "+name+"(sentinel text);INSERT INTO pg_temp."+name+" VALUES('untouched')":"CREATE TEMP VIEW "+name+" AS SELECT 'untouched'::text sentinel");
   await negative(phase+' refuses existing temporary '+kind.toLowerCase(),()=>db.exec(sqlBody(source.render()[phase])),/temporary witness name already exists/);
   assert.equal((await db.query('SELECT sentinel FROM pg_temp.'+name)).rows[0].sentinel,'untouched','Foreign temporary witness is not reused or removed');
   await db.exec('DROP '+kind+' pg_temp.'+name);
  }}finally{await db.exec('ROLLBACK');}
 }
 await db.query('INSERT INTO public.nothingsports_fixture_sources(source_id)VALUES($1),($2)',[sourceId,secondSource]);
 await publish([event()]);await publish([event({opaque:{keep:'second-source'}})],{which:secondSource});
 await db.exec('CREATE VIEW public.qa_gc_original WITH(security_invoker=true)AS '+source.original+';REVOKE ALL ON public.qa_gc_original FROM PUBLIC,anon,authenticated;GRANT SELECT ON public.qa_gc_original TO service_role');
 const beforeInstall=await facts();await functions();
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_attribute WHERE attrelid=$1::regclass AND attname=ANY($2)AND NOT attisdropped",[table,source.COLUMNS])).rows[0].n,0,'Original structural RED: owned generated fields absent');mark('original derived-field structural RED',{speedProof:false});
 await witnessCollisions('install');
 const at=performance.now();await db.exec(source.render().install);report.installMs=performance.now()-at;report.installScope='Tiny functional fixtures only; actual 8646-row rewrite/storage not qualified';assert(report.installMs<=3000,'Whole guarded module install <=3s');
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_statistic s JOIN pg_attribute a ON a.attrelid=s.starelid AND a.attnum=s.staattnum WHERE a.attrelid=$1::regclass AND a.attname='global_window_valid'",[table])).rows[0].n,1,'Real ordinary Boolean statistics prepared');
 assert.deepEqual(await facts(),beforeInstall,'Install changes NO original column');await functions();await derived();await same('initial complete grouped values/aliases/consumer');await same('unchanged default legacy values',false);
 await db.exec('BEGIN');
 try{
  // Raw fallback is deliberately OUTSIDE the horizon, so a contrary valid live
  // descriptor must actually change admission; equal raw/descriptor states are too weak.
  await db.query("UPDATE public.nothingsports_fixture_current SET fixture=fixture||jsonb_build_object('status','scheduled','date','2099-01-01','startDate','2099-01-01','endDate','2099-01-01')WHERE source_id=$1 AND fixture_id=$2",[sourceId,id]);await drain();
  const valid={hasStatus:true,status:'live',hasEndDate:false,endDate:null,hasDate:false,date:null,hasStartDate:false,startDate:null,hasSchedulingWindow:false,schedulingWindow:null};
  const cases=[['JSON-null parent',null],['scalar parent',17],['array parent',[]],['missing window',{}],['JSON-null window',{calendarWindow:null}],['scalar window',{calendarWindow:17}],['array window',{calendarWindow:[]}],['empty object',{calendarWindow:{}}],['valid nullable flags',{calendarWindow:{...valid,hasStatus:null,status:null}}],['poison hasStatus',{calendarWindow:{...valid,hasStatus:'notbool'}}],['numeric status',{calendarWindow:{...valid,status:5}}],['whole scheduling object',{calendarWindow:{...valid,status:'scheduled',hasSchedulingWindow:true,schedulingWindow:{startsOn:'2099-99-99',endsOn:'0000-00-00'}}}],['malformed scheduling value remains exact',{calendarWindow:{...valid,status:'scheduled',hasSchedulingWindow:true,schedulingWindow:7}}],['explicit empty date',{calendarWindow:{...valid,status:'scheduled',hasDate:true,date:''}}],['contrary valid live descriptor',{calendarWindow:valid}],['score explicit null and future date override base',{calendarWindow:valid},{calendarWindow:{...valid,hasStatus:true,status:null,hasDate:true,date:'2099-01-01'}}],['score whole-window replacement',{calendarWindow:{...valid,status:'scheduled',hasSchedulingWindow:true,schedulingWindow:{startsOn:'2099-01-01',endsOn:'2099-01-01'}}},{calendarWindow:{...valid,hasStatus:false,status:null,hasSchedulingWindow:true,schedulingWindow:{}}}]];
  for(const [name,descriptor,scoreDescriptor]of cases){await db.exec('SAVEPOINT gc_case');try{
   await db.query('UPDATE '+table+' SET base_selection=$1::jsonb,score_selection=$2::jsonb WHERE source_id=$3 AND fixture_id=$4',[JSON.stringify(descriptor),JSON.stringify(scoreDescriptor||{calendarWindow:{...valid,hasStatus:false,status:null}}),sourceId,id]);await drain();await derived();const bundle=await same(name);
   if(name==='contrary valid live descriptor')assert(grouped.decode(bundle).rows.some(r=>r.source_id===sourceId&&r.fixture_id===id),'Valid contrary descriptor governs despite future raw fixture');
   if(name==='missing window')assert.equal((await db.query('SELECT global_window_valid IS NULL unknown,global_base_window IS NULL missing FROM '+table+' WHERE source_id=$1 AND fixture_id=$2',[sourceId,id])).rows[0].unknown,true);
   if(name==='JSON-null window')assert.equal((await db.query("SELECT jsonb_typeof(global_base_window)t FROM "+table+' WHERE source_id=$1 AND fixture_id=$2',[sourceId,id])).rows[0].t,'null');
  }finally{await db.exec('ROLLBACK TO SAVEPOINT gc_case;RELEASE SAVEPOINT gc_case');}}
  for(const [name,sql]of [['missing context','DELETE FROM '+table+' WHERE source_id=$1 AND fixture_id=$2'],['wrong shape version','UPDATE '+table+' SET shape_version=0 WHERE source_id=$1 AND fixture_id=$2']]){
   // Rollback-only metadata fault model, not a supported production write or repair.
   await db.exec("SAVEPOINT gc_fault;SET LOCAL session_replication_role='replica'");try{await db.query(sql,[sourceId,id]);await same(name+' with no pending marker retains raw fallback');}finally{await db.exec('ROLLBACK TO SAVEPOINT gc_fault;RELEASE SAVEPOINT gc_fault');}
  }
  for(const boundary of [
   {label:'Sydney midnight',before:'2026-10-21T12:59:59.999Z',after:'2026-10-21T13:00:00.000Z',end:'2026-10-14'},
   {label:'DST transition day',before:'2026-10-03T13:59:59.999Z',after:'2026-10-03T14:00:00.000Z',end:'2026-09-26'},
   {label:'year boundary',before:'2026-12-31T12:59:59.999Z',after:'2026-12-31T13:00:00.000Z',end:'2026-12-24'},
   {label:'leap day',before:'2028-02-28T12:59:59.999Z',after:'2028-02-28T13:00:00.000Z',end:'2028-02-21'}]){
   await db.exec('SAVEPOINT gc_clock');try{
    const fixture=event({id:'gc:clock',sourceEventIds:[],status:'scheduled',date:boundary.end,startDate:boundary.end,endDate:boundary.end});
    await db.query("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)VALUES($1,'gc:clock',ARRAY['gc:clock'],$2::jsonb,md5($2::text))",[sourceId,JSON.stringify(fixture)]);await drain();
    const stable=await facts();let beforeCount;
    for(const [phase,clock]of [['before',boundary.before],['after',boundary.after]]){
     for(const [suffix,select]of [['a',source.original],['b',source.candidate]]){
      const injected=select.replace('statement_timestamp()',"'"+clock+"'::timestamptz");assert.notEqual(injected,select);
      await db.exec('CREATE OR REPLACE VIEW public.qa_gc_clock_'+suffix+' WITH(security_invoker=true)AS '+injected+';REVOKE ALL ON public.qa_gc_clock_'+suffix+' FROM PUBLIC,anon,authenticated;GRANT SELECT ON public.qa_gc_clock_'+suffix+' TO service_role');
     }
     const bundle=await same(boundary.label+' '+phase+' modeled selection clock',true,'public.qa_gc_clock_a','public.qa_gc_clock_b');
     const count=grouped.decode(bundle).rows.filter(r=>r.source_id===sourceId&&r.fixture_id==='gc:clock').length;
     assert.equal(count,phase==='before'?1:0);if(phase==='before')beforeCount=count;
    }
    assert.equal(beforeCount,1);assert.deepEqual(await facts(),stable,'Clock movement changes no canonical/context/token/observation value');await derived();
   }finally{await db.exec('ROLLBACK TO SAVEPOINT gc_clock;RELEASE SAVEPOINT gc_clock');}
  }
  const generatedState=async()=>(await db.query('SELECT fixture_id,global_base_window::text AS base_window,global_score_window::text AS score_window,global_window_valid AS valid FROM '+table+' WHERE source_id=$1 ORDER BY fixture_id',[sourceId])).rows;
  const beforeRefusal=await generatedState();assert.equal(beforeRefusal.length,1,'A real generated row must be protected');
  await negative('generated validity cannot be forged',()=>db.query('UPDATE '+table+' SET global_window_valid=true WHERE source_id=$1',[sourceId]),async error=>{
   assert.equal(error.code,'428C9','Require actual generated_always SQLSTATE, not English wording');
   assert.deepEqual(await generatedState(),beforeRefusal,'Prohibited assignment leaves every derived value unchanged');
   return {message:error.message,derivedStateUnchanged:true};
  });
  for(const role of ['anon','authenticated']){
   await negative(role+' cannot read private generated metadata',async()=>{await db.exec('SET ROLE '+role);await db.query('SELECT global_window_valid FROM '+table);},/permission denied/i);
   await negative(role+' cannot read service-only GLOBAL view',async()=>{await db.exec('SET ROLE '+role);await db.query('SELECT bundle FROM public.nothingsports_current_global_fixture_bundle');},/permission denied/i);
  }
  await negative('pending canonical warning refuses inverse',async()=>{await db.query('UPDATE '+table+' SET base_selection=base_selection WHERE source_id=$1',[sourceId]);await same('pending global raw fallback');await db.exec(sqlBody(source.render().undo));},/pending canonical work/);
  await negative('wrong generated expression refuses inverse',async()=>{await db.exec('ALTER TABLE '+table+' ALTER COLUMN global_window_valid SET EXPRESSION AS(false)');await db.exec(sqlBody(source.render().undo));},/column\/expression\/ACL preimage/);
  await negative('changed generated column grant refuses inverse',async()=>{await db.exec('GRANT SELECT(global_window_valid)ON '+table+' TO anon');await db.exec(sqlBody(source.render().undo));},/column\/expression\/ACL preimage/);
  await negative('changed view refuses inverse before recovery',async()=>{await db.exec("CREATE OR REPLACE VIEW public.nothingsports_current_global_fixture_bundle WITH(security_invoker=true)AS SELECT '{}'::json bundle");await db.exec(sqlBody(source.render().undo));},/exact candidate view differs/);
  await negative('dependent object prevents broad inverse drop',async()=>{await db.exec('CREATE VIEW public.qa_gc_dependency AS SELECT global_window_valid FROM '+table);await db.exec(sqlBody(source.render().undo));},/depend|cannot drop/i);
  await negative('later same-table index is not silently auto-dropped',async()=>{await db.exec('CREATE INDEX qa_gc_later_index ON '+table+'(global_window_valid)');await db.exec(sqlBody(source.render().undo));},/unreviewed column dependency/);
  await negative('active lease refuses inverse',async()=>{await db.query("UPDATE public.nothingsports_fixture_sources SET lease_token=$1,lease_until=clock_timestamp()+interval'1 minute'WHERE source_id=$2",[token,sourceId]);await db.exec(sqlBody(source.render().undo));},/active source lease/);
  await negative('canonical failure rolls back original and derived context',async()=>{
   await db.exec("CREATE FUNCTION pg_temp.qa_gc_refuse_context()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'generated calendar injected writer failure';END$$;CREATE TRIGGER qa_gc_refuse_context AFTER INSERT OR UPDATE ON "+table+' FOR EACH ROW EXECUTE FUNCTION pg_temp.qa_gc_refuse_context()');
   await publish([event({status:'completed'})],{compact:true});
  },/injected writer failure/);await derived();
 }finally{await db.exec('ROLLBACK;RESET ROLE');}
 // Exercise actual existing full/compact adapters after the table rowtype changes.
 let firstCompleted;
 for(const [name,fixtures,compact]of [['full changed parent',[event({opaque:{keep:'later real write'}})],false],['compact completed',[event({status:'completed',homeScore:0,awayScore:0,scoreCheckedAt:old})],true],['compact corrected score',[event({status:'completed',homeScore:2,awayScore:0,scoreCheckedAt:old})],true]]){
  const begin=performance.now();await publish(fixtures,{compact});const elapsed=performance.now()-begin;assert(elapsed<=8000,'Whole local writer <=8s');await derived();await same(name);
  if(compact){const stamp=(await db.query('SELECT first_completed_at::text stamp FROM public.nothingsports_live_scores WHERE source_id=$1 AND fixture_id=$2',[sourceId,id])).rows[0].stamp;assert(stamp);if(firstCompleted)assert.equal(stamp,firstCompleted,'Corrected scores retain exact first completion');else firstCompleted=stamp;}
  mark(name+' actual adapter',{elapsedMs:elapsed,maximumWriterQualified:false});
 }
 const contextVersion=async()=>(await db.query('SELECT xmin::text xmin,ctid::text ctid FROM '+table+' WHERE source_id=$1 AND fixture_id=$2',[sourceId,id])).rows[0];
 const version=await contextVersion(),repeat=[event({status:'completed',homeScore:2,awayScore:0,scoreCheckedAt:old})];await publish(repeat,{compact:true});assert.deepEqual(await contextVersion(),version,'Unchanged descriptor cannot cause another context row rewrite');await derived();mark('actual compact no-op retains context tuple',{zeroGenerationCostClaim:false});
 // Own inverse compares the state immediately BEFORE undo, preserving later writes.
 await witnessCollisions('undo');
 const beforeUndo=await facts(),readBefore=await same('later-write snapshot before own inverse');await functions();const undoAt=performance.now();await db.exec(source.render().undo);report.undoMs=performance.now()-undoAt;assert(report.undoMs<=3000,'Whole guarded inverse <=3s');
 assert.deepEqual(await facts(),beforeUndo,'Recovery preserves subsequent writes, original clocks/first completion/D7/tokens');await functions();
 assert.equal((await db.query('SELECT count(*)::int n FROM pg_attribute WHERE attrelid=$1::regclass AND attname=ANY($2)AND NOT attisdropped',[table,source.COLUMNS])).rows[0].n,0);assert.equal((await db.query("SELECT md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h,'d3d5341fcf5dc901c3e1240145b3acd7');assert.deepEqual(await same('complete post-inverse read'),readBefore);mark('own guarded inverse exact reader then RESTRICT drop; no row replay');
}
module.exports={regression};
