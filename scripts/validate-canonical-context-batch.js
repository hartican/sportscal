'use strict';
// Disposable baseline only. Never change the historical factory's start point.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createRequire}=require('node:module');
const projectRequire=createRequire(path.resolve('package.json'));
const live=projectRequire('./lib/live-fixtures');
const expected=require('./fixtures/canonical-context-batch-contracts.json');
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const sqlName='20261022234325_coalesce_canonical_fixture_context.sql';
const sqlRoot=process.env.CANONICAL_CONTEXT_BATCH_TEST_SQL_DIR;
const install=fs.readFileSync(sqlRoot?path.join(sqlRoot,'install.sql'):path.resolve('supabase/migrations',sqlName),'utf8');
const undo=fs.readFileSync(sqlRoot?path.join(sqlRoot,'undo.sql'):path.resolve('supabase/rollbacks',sqlName),'utf8');
assert.equal(sha(install),expected.installSha256,'Reviewed install bytes');
assert.equal(sha(undo),expected.undoSha256,'Reviewed amended recovery bytes');
// Only remove the outer test transaction, leaving the exact recovery body.
const installBody=install.replace(/^BEGIN;.*$/m,'').replace(/COMMIT;\s*$/,'');
const undoBody=undo.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,'');
assert.notEqual(undoBody,undo);
const source='discovery-canonical-batch-test';
const token='00000000-0000-4000-8000-000000000051';
const wrongToken='00000000-0000-4000-8000-000000000052';
const ids=['batch-regression:0','batch-regression:1'];
const tables=[
 'public.nothingsports_fixture_sources','public.nothingsports_fixture_current',
 'public.nothingsports_live_scores','public.nothingsports_fixture_snapshots',
 'nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.fixture_tokens',
 'nothingsports_fixture_read_private.source_tokens','nothingsports_fixture_read_private.integrity_pending'
];
const checks=[];
let db;
const mark=(name,details={})=>checks.push({name,...details});
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const sig={sync:'nothingsports_fixture_read_private.sync_fixture(text,text)',compact:'public.nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb)',full:'public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)'};
const specs={
 nothingsports_claim_fixture_source:{names:['p_source_id','p_token'],types:['text','uuid']},
 nothingsports_publish_compact_scores:{names:['p_source_id','p_token','p_fixtures','p_scores','p_hash','p_interval_ms','p_report'],types:['text','uuid','jsonb','jsonb','text','integer','jsonb']},
 nothingsports_read_fixture_source_health:{names:[],types:[]},
 nothingsports_read_current_fixtures:{names:['p_fixture_ids'],types:['text[]']},
 nothingsports_read_match_centre_fixture_bundle:{names:['p_membership_ids'],types:['text[]']},
 nothingsports_read_participant_fixture_bundle:{names:['p_sport_keys','p_known_sport_keys','p_participant_ids','p_required_ids'],types:['text[]','text[]','text[]','text[]']}
};
async function facts(){
 const result={};
 for(const table of tables)result[table]=(await db.query('select to_jsonb(t) row from '+table+' t order by to_jsonb(t)::text')).rows.map(r=>r.row);
 return result;
}
async function contracts(list){
 for(const item of list){
  const rows=(await db.query(`select jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),
   'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,
   'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,
   'leakproof',p.proleakproof,'config',p.proconfig) contract
   from pg_proc p where p.oid=to_regprocedure($1)`,[item.signature])).rows;
  assert.equal(rows.length,1,item.signature);
  assert.deepEqual(rows[0].contract,item.contract,item.signature+' complete contract');
 }
}
async function structure(){
 for(const item of expected.triggers){
  const row=(await db.query('select md5(pg_get_triggerdef(t.oid)) digest,t.tgenabled::text enabled from pg_trigger t where t.tgrelid=to_regclass($1)and t.tgname=$2',[item.relation,item.name])).rows[0];
  assert.deepEqual(row,{digest:item.digest,enabled:item.enabled},item.name);
 }
 const row=(await db.query(`select md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) view,
  (select md5(pg_get_expr(d.adbin,d.adrelid))from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture') generated`)).rows[0];
 assert.deepEqual(row,{view:'fbc28299a5bf25428b286adc5ee2e0da',generated:'d7d2f883cba24dc54897fe44f9930365'});
}
async function rpc(url,options={}){
 if(url.includes('?select=bundle'))return(await db.query('select bundle from public.nothingsports_current_global_fixture_bundle')).rows;
 const name=url.split('/').pop(),spec=specs[name];assert(spec,'Unexpected RPC '+name);
 const {names,types}=spec,body=options.body??{};
 assert(body&&typeof body==='object'&&!Array.isArray(body),'Named RPC body '+name);
 assert.deepEqual(Object.keys(body).sort(),[...names].sort(),'Exact named RPC parameters '+name);
 const values=names.map((parameter,index)=>types[index]==='jsonb'&&body[parameter]!==null?JSON.stringify(body[parameter]):body[parameter]);
 assert.equal(values.length,types.length);
 const args=types.map((type,index)=>'$'+(index+1)+'::'+type).join(',');
 const rowset=['nothingsports_claim_fixture_source','nothingsports_read_fixture_source_health','nothingsports_read_current_fixtures'].includes(name);
 return rowset?(await db.query('select * from public.'+name+'('+args+')',values)).rows:(await db.query('select public.'+name+'('+args+') result',values)).rows[0].result;
}
async function service(operation){
 await db.exec('set role service_role');
 let primary;
 try{return await operation();}catch(error){primary=error;throw error;}
 finally{try{await db.exec('reset role');}catch(error){if(!primary)throw error;}}
}
const store=()=>live.createSnapshotStore({request:rpc});
async function readAll(now){
 const result={};
 const requests={global:{scope:'global'},near:{scope:'match-centre',preserveIds:ids,interactive:true},
  selected:{ids},profile:{scope:'participants',sportKeys:['football'],knownSportKeys:['football'],participantIds:['team:batch:home:0'],preserveIds:ids,interactive:true}};
 for(const [kind,args]of Object.entries(requests))result[kind]=await service(()=>store().read({...args,now}));
 return result;
}
async function publish(fixtures,now){
 await db.exec('reset role');
 await db.query('update public.nothingsports_fixture_sources set next_due_at=pg_catalog.clock_timestamp()where source_id=$1',[source]);
 const previous=process.env.MATCH_CENTRE_SCORE_WRITES;
 process.env.MATCH_CENTRE_SCORE_WRITES='true';
 try{return await service(async()=>{
  assert(await store().claim(source,token),'Actual source lease claim');
  return store().publish(source,token,{fixtures,hash:live.contentHash(fixtures),intervalMs:120000,
   coverage:{status:'complete'},observedFixtures:fixtures,observedAt:new Date(now)});
 });}finally{if(previous===undefined)delete process.env.MATCH_CENTRE_SCORE_WRITES;else process.env.MATCH_CENTRE_SCORE_WRITES=previous;}
}
async function drain(){await db.exec('set constraints all immediate;set constraints all deferred');}
async function pending(){return(await db.query('select * from nothingsports_fixture_read_private.integrity_pending order by source_id')).rows;}
async function globalIds(){return(await db.query("select bundle::jsonb->'rows' rows from public.nothingsports_current_global_fixture_bundle")).rows[0].rows.map(r=>r.fixture_id);}
async function counts(){return(await db.query('select fixture_id,count(*)::int n from qa_canonical_batch.builds group by fixture_id order by fixture_id')).rows;}
async function clearWork(){await db.exec('delete from qa_canonical_batch.builds;delete from qa_canonical_batch.dml');}
async function dml(){return(await db.query('select relation,operation,count(*)::int n from qa_canonical_batch.dml group by relation,operation order by relation,operation')).rows;}
async function negative(name,operation,pattern,code){
 await db.exec('savepoint negative');const before=await facts();let error;
 try{await operation();await drain();}catch(caught){error=caught;}
 finally{await db.exec('rollback to savepoint negative;reset role');}
 assert(error,name+' must refuse');if(pattern)assert.match(error.message,pattern,name);if(code)assert.equal(error.code,code,name);
 assert.deepEqual(await facts(),before,name+' cannot change facts');mark(name,{code:error.code});
}
async function instrumentation(){
 const original=(await db.query('select pg_get_functiondef($1::regprocedure) source',[sig.sync])).rows[0].source;
 await db.exec(`create schema qa_canonical_batch;grant usage on schema qa_canonical_batch to service_role;
  create table qa_canonical_batch.builds(source_id text,fixture_id text);
  create table qa_canonical_batch.dml(relation text,operation text);
  grant select,insert,delete on all tables in schema qa_canonical_batch to service_role;`);
 const core=original.replace('nothingsports_fixture_read_private.sync_fixture(', 'qa_canonical_batch.sync_core(');
 assert.notEqual(core,original);await db.exec(core);
 await db.exec(`revoke all on function qa_canonical_batch.sync_core(text,text)from public,anon,authenticated;
  grant execute on function qa_canonical_batch.sync_core(text,text)to service_role;
  create or replace function nothingsports_fixture_read_private.sync_fixture(p_source_id text,p_fixture_id text)returns void
  language plpgsql security invoker set search_path=''as $$begin
   insert into qa_canonical_batch.builds values(p_source_id,p_fixture_id);
   perform qa_canonical_batch.sync_core(p_source_id,p_fixture_id);end$$;
  create function qa_canonical_batch.note_dml()returns trigger language plpgsql set search_path=''as $$begin
   insert into qa_canonical_batch.dml values(tg_table_schema||'.'||tg_table_name,tg_op);return null;end$$;
  revoke all on function qa_canonical_batch.note_dml()from public,anon,authenticated;
  grant execute on function qa_canonical_batch.note_dml()to service_role;`);
 const observed=tables.slice(1,7);
 for(const table of observed)await db.exec('create trigger qa_batch_dml after insert or update or delete on '+table+' for each row execute function qa_canonical_batch.note_dml()');
 return async()=>{await db.exec(original);for(const table of observed)await db.exec('drop trigger qa_batch_dml on '+table);await db.exec('drop schema qa_canonical_batch cascade');};
}
async function run(){
 db=await projectRequire('./scripts/fixture-read-test-baseline').database();
 try{
  const version=Number((await db.query("select current_setting('server_version_num') n")).rows[0].n),major=Math.floor(version/10000);
  assert.equal(major,process.env.PGLITE_MODULE==='pglite-pg17'?17:18);
  await contracts(expected.original);await structure();
  const originalTrigger=(await db.query("select pg_get_functiondef('nothingsports_fixture_read_private.sync_trigger()'::regprocedure) source")).rows[0].source;
  const emptyBefore=await facts();
  await db.exec('begin');let activeError;
  try{assert(await service(()=>store().claim(source,token)));await db.exec(installBody);}catch(error){activeError=error;}
  finally{await db.exec('rollback');}
  assert(activeError);assert.match(activeError.message,/Active source lease/);assert.deepEqual(await facts(),emptyBefore);await contracts(expected.original);
  mark('install refuses an actual active source lease without mutation');
  await db.exec(install);await contracts(expected.candidate);await structure();
  mark('reviewed install and trusted22contracts',{major,version});
  const now=Date.now(),at=new Date(now-600000).toISOString(),scoreAt=new Date(now-540000).toISOString(),statusAt=new Date(now-480000).toISOString();
  const initial=ids.map((id,index)=>({id,eventId:id,sourceEventIds:['batch-alias:'+index],key:'football',
   date:new Date(now).toISOString().slice(0,10),startTimeUtc:new Date(now+3600000).toISOString(),status:'scheduled',
   homeParticipantId:'team:batch:home:'+index,awayParticipantId:'team:batch:away:'+index,homeScore:0,awayScore:0,
   sourceCheckedAt:at,statusCheckedAt:at,scoreCheckedAt:at,title:'Original '+index,
   opaque:{zero:0,clear:null,nested:{keep:'literal'}}}));
  const scoreChange=initial.map((f,i)=>i?f:{...f,homeScore:2,sourceCheckedAt:scoreAt,scoreCheckedAt:scoreAt,statusCheckedAt:scoreAt});
  const bothChange=scoreChange.map((f,i)=>i?f:{...f,title:'Changed',status:'live',sourceCheckedAt:statusAt,scoreCheckedAt:statusAt,statusCheckedAt:statusAt});
  const restore=await instrumentation();
  await db.exec('begin');
  try{
   await clearWork();await publish(initial,now);
   assert.deepEqual(await counts(),ids.map(fixture_id=>({fixture_id,n:1})),'One final derivation per changed identity');
   assert((await pending()).every(p=>p.batch_xid===null&&p.batch_pid===null));await drain();
   const seed=await facts(),snapshot=await readAll(now);
   assert.equal(snapshot.global[0].fixtures.length,2);for(const row of seed['public.nothingsports_fixture_current'])assert.deepEqual(row.fixture.opaque,initial[0].opaque);
   const seedScores=seed['public.nothingsports_live_scores'];assert(seedScores.every(r=>r.score.homeScore===0&&r.score.awayScore===0));
   mark('actual adapter seed: one final context each, zero scores, opaque/null, complete store reads');
   const normalizedAt=(await db.query('select to_jsonb($1::timestamptz) value',[at])).rows[0].value;
   for(const row of seedScores){assert.equal(row.score.scoreCheckedAt,normalizedAt);assert.equal(row.score.statusCheckedAt,normalizedAt);}
   await db.exec('savepoint immediate_owner_negative');
   await db.exec(originalTrigger);await clearWork();
   const extra={...initial[0],id:'batch-regression:negative',eventId:'batch-regression:negative',sourceEventIds:['batch-alias:negative']};
   await publish([...initial,extra],now);
   const repeated=(await counts()).find(r=>r.fixture_id===extra.id);assert(repeated&&repeated.n>1,'Restoring original immediate trigger must fail one-final-derivation regression');
   await db.exec('rollback to savepoint immediate_owner_negative');
   mark('restored original immediate trigger demonstrably repeats derivation',{negativeCount:repeated.n});
   await clearWork();await publish(initial,now);assert.deepEqual(await counts(),[]);assert.deepEqual(await dml(),[],'No factual/history/context/token DML on unchanged input');assert.deepEqual(await pending(),[],'Own bracket-only warning removed');
   mark('unchanged: zero actual fact/history/context/token DML and no new pending');
   const descriptor={hasStatus:true,status:'scheduled',hasDate:true,date:'1900-01-01',hasEndDate:true,endDate:'1900-01-01',hasStartDate:true,startDate:'1900-01-01',hasSchedulingWindow:false,schedulingWindow:null};
   await db.query("update nothingsports_fixture_read_private.fixture_context set score_selection=jsonb_set(score_selection,'{calendarWindow}',$1::jsonb)where fixture_id=$2",[JSON.stringify(descriptor),ids[1]]);await drain();
   const contrary=(await db.query('select to_jsonb(c) row from nothingsports_fixture_read_private.fixture_context c where fixture_id=$1',[ids[1]])).rows[0].row;
   assert(!(await globalIds()).includes(ids[1]),'Valid contrary descriptor governs');await clearWork();await publish(initial,now);
   assert.deepEqual(await counts(),[]);assert.deepEqual(await dml(),[]);assert(!(await globalIds()).includes(ids[1]));
   assert.deepEqual((await db.query('select to_jsonb(c) row from nothingsports_fixture_read_private.fixture_context c where fixture_id=$1',[ids[1]])).rows[0].row,contrary);
   await db.query('update nothingsports_fixture_read_private.fixture_context set base_selection=base_selection where fixture_id=$1',[ids[1]]);
   const warning=await pending();assert.equal(warning.length,1);assert((await globalIds()).includes(ids[1]),'Pending reads use genuine raw fallback');await clearWork();await publish(initial,now);
   assert.deepEqual(await counts(),[]);assert.deepEqual(await dml(),[]);assert.deepEqual(await pending(),warning,'Preexisting warning is preserved');assert((await globalIds()).includes(ids[1]));await drain();assert(!(await globalIds()).includes(ids[1]));
   mark('valid contradictory descriptor, real pending raw fallback and no-op warning provenance');
   await clearWork();await publish(scoreChange,now);assert.deepEqual(await counts(),[{fixture_id:ids[0],n:1}]);await drain();
   const afterScore=await facts(),rawScore=afterScore['public.nothingsports_live_scores'].find(r=>r.fixture_id===ids[0]);
   assert.equal(rawScore.score.homeScore,2);assert.equal(rawScore.score.scoreCheckedAt,(await db.query('select to_jsonb($1::timestamptz) value',[scoreAt])).rows[0].value);assert.equal(rawScore.score.statusCheckedAt,seedScores.find(r=>r.fixture_id===ids[0]).score.statusCheckedAt);
   await clearWork();await publish(bothChange,now);assert.deepEqual(await counts(),[{fixture_id:ids[0],n:1}]);await drain();
   const final=await facts(),row=final['public.nothingsports_live_scores'].find(r=>r.fixture_id===ids[0]);
   assert.equal(row.score.scoreCheckedAt,rawScore.score.scoreCheckedAt,'Unchanged score fact clock retained literally');assert.equal(row.score.statusCheckedAt,(await db.query('select to_jsonb($1::timestamptz) value',[statusAt])).rows[0].value);
   assert.deepEqual(final['public.nothingsports_live_scores'].find(r=>r.fixture_id===ids[1]),seedScores.find(r=>r.fixture_id===ids[1]));
   const receipts=final['public.nothingsports_fixture_sources'][0].discovery_report._fixtureObservations[ids[0]];
   assert.equal(receipts.s,(await db.query('select to_jsonb($1::timestamptz) value',[statusAt])).rows[0].value);assert.equal(receipts.t,receipts.s);
   mark('changed identities only, independent original fact clocks and later verification receipts');
   await clearWork();await service(()=>db.query("update public.nothingsports_live_scores set score=score||'{\"homeScore\":3}'::jsonb where fixture_id=$1",[ids[0]]));assert.deepEqual(await counts(),[],'Original score-only fast return');
   await service(()=>db.query("update public.nothingsports_live_scores set score=score||'{\"status\":\"scheduled\"}'::jsonb where fixture_id=$1",[ids[0]]));assert.deepEqual(await counts(),[{fixture_id:ids[0],n:1}]);await drain();
   mark('direct score-only fast return0 and status derivation1');
   const beforeDeletion=await facts();await db.exec('savepoint direct_deletion');
   await service(()=>db.query('delete from public.nothingsports_fixture_current where fixture_id=$1',[ids[0]]));await drain();
   for(const table of ['public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.fixture_tokens'])assert.equal((await db.query('select count(*)::int n from '+table+' where fixture_id=$1',[ids[0]])).rows[0].n,0);
   await db.exec('rollback to savepoint direct_deletion');assert.deepEqual(await facts(),beforeDeletion);mark('direct deletion cascades current/score/context/tokens and rollback restores all');
   await negative('wrong source lease refuses and rolls back',()=>service(()=>rpc('/rpc/nothingsports_publish_compact_scores',{body:{p_source_id:source,p_token:wrongToken,p_fixtures:[],p_scores:[],p_hash:'wrong',p_interval_ms:120000,p_report:null}})),/Lease expired/,'P0001');
   await negative('direct composite movement retains original FK refusal',async()=>{await db.exec("insert into public.nothingsports_fixture_sources(source_id)values('discovery-batch-other')");await db.query('delete from public.nothingsports_live_scores where fixture_id=$1',[ids[0]]);await db.query("update public.nothingsports_fixture_current set source_id='discovery-batch-other',fixture_id='batch-moved'where fixture_id=$1",[ids[0]]);},null,'23503');
  }finally{await db.exec('rollback');}
  assert(Object.values(await facts()).every(rows=>rows.length===0),'Publication rollback preserves every empty baseline relation');
  await restore();await contracts(expected.candidate);await structure();mark('disposable counters removed; exact product22contracts restored');
  // Settled data/recovery uses exact uninstrumented product functions.
  await db.exec('begin');await publish(initial,now);await drain();await db.exec('commit');
  const before=await facts(),readBefore=await readAll(now);
  await db.exec(`begin;create schema qa_batch_attack;grant usage on schema qa_batch_attack to service_role;
   create function qa_batch_attack.clock_timestamp()returns timestamptz language plpgsql as $$begin raise exception 'Hostile clock reached';end$$;
   create function qa_batch_attack.nothingsports_fixture_observation_time(text)returns timestamptz language plpgsql as $$begin raise exception 'Hostile parser reached';end$$;
   create table qa_batch_attack.nothingsports_fixture_current(source_id text);
   create table qa_batch_attack.integrity_pending(source_id text);
   set local search_path=qa_batch_attack,public,pg_catalog;`);
  try{await publish(initial,now);await drain();const poisonedReads=await readAll(now);for(const value of Object.values(poisonedReads)){assert.equal(value.length,1);assert.equal(value[0].fixtures.length,2);assert(value[0].fixtures.every(f=>f.homeScore===0&&f.awayScore===0));}}
  finally{await db.exec('rollback');}
  assert.deepEqual(await facts(),before);await contracts(expected.candidate);mark('hostile search_path functions/tables cannot redirect actual owner or readers');
  for(const role of ['anon','authenticated']){
   await db.exec('begin');try{
    await negative(role+' public publisher refused',async()=>{await db.exec('set local role '+role);await db.query('select public.nothingsports_publish_fixture_source($1,$2,$3::jsonb,$4,$5)',[source,token,'[]','x',120000]);},/permission denied/,'42501');
    await negative(role+' private publisher refused',async()=>{await db.exec('set local role '+role);await db.query('select nothingsports_fixture_read_private.publish_full_complete($1,$2,$3::jsonb,$4,$5)',[source,token,'[]','x',120000]);},/permission denied/,'42501');
   }finally{await db.exec('rollback');}
  }
  await db.exec('begin');try{await negative('service cannot forge pending marker',()=>service(()=>db.query('update nothingsports_fixture_read_private.integrity_pending set batch_xid=txid_current()')),/permission denied/,'42501');}finally{await db.exec('rollback');}
  async function refusedUndo(name,mutation,pattern){
   await db.exec('begin;set constraints all deferred');let error;
   try{await db.exec(mutation);await db.exec(undoBody);}catch(caught){error=caught;}
   finally{await db.exec('rollback');}
   assert(error,name+' must refuse');assert.match(error.message,pattern);assert.deepEqual(await facts(),before);assert.deepEqual(await readAll(now),readBefore);await contracts(expected.candidate);mark(name,{code:error.code});
  }
  await refusedUndo('undo rejects added anon ACL','grant execute on function '+sig.compact+' to anon',/candidate22.*contract differs/);
  await refusedUndo('undo rejects PUBLIC private-function ACL','grant execute on function nothingsports_fixture_read_private.publish_full_complete(text,uuid,jsonb,text,integer)to public',/candidate22.*contract differs/);
  await refusedUndo('undo rejects unchanged function attribute drift','alter function nothingsports_fixture_read_private.source_index_complete(text)cost 101',/candidate22.*contract differs/);
  await refusedUndo('undo refuses open marker',`insert into nothingsports_fixture_read_private.integrity_pending(source_id,batch_xid,batch_pid)values('${source}',txid_current(),pg_backend_pid())`,/Unclosed batch/);
  await refusedUndo('undo refuses incompatible ordinary pending',"delete from nothingsports_fixture_read_private.fixture_context where fixture_id='"+ids[0]+"'",/Fixture index integrity is incomplete/);
  await db.exec('begin;set constraints all deferred');await db.query('insert into nothingsports_fixture_read_private.integrity_pending(source_id)values($1)',[source]);await db.exec(undoBody);
  assert.deepEqual(await facts(),before);assert.deepEqual(await readAll(now),readBefore);await contracts(expected.original);await db.exec('rollback');await contracts(expected.candidate);
  mark('original deferred owner drains compatible ordinary pending before undo; outer rollback restores22');
  await db.exec(undo);assert.deepEqual(await facts(),before);assert.deepEqual(await readAll(now),readBefore);await contracts(expected.original);await structure();
  const gone=(await db.query("select to_regprocedure('nothingsports_fixture_read_private.publish_full_complete(text,uuid,jsonb,text,integer)')is null a,to_regprocedure('nothingsports_fixture_read_private.publish_compact_complete(text,uuid,jsonb,jsonb,text,integer,jsonb)')is null b")).rows[0];assert(gone.a&&gone.b);
  const columns=(await db.query("select attname from pg_attribute where attrelid='nothingsports_fixture_read_private.integrity_pending'::regclass and attname in('batch_xid','batch_pid')and not attisdropped order by attname")).rows;
  assert.equal(columns.length,2);mark('exact settled undo restores20/removes2 and preserves all facts/history/clocks/readers; marker columns remain');
  console.log(JSON.stringify({schemaVersion:'canonical-context-batch-regression.v1',engine:version,checks,concurrency:'Independent native proof; not claimed by this single embedded connection',productionCalls:0,installSha256:sha(install),undoSha256:sha(undo)}));
 }finally{if(db){await db.exec('rollback').catch(()=>{});await db.close();}}
}
run().catch(error=>{console.error(JSON.stringify({message:error.message,code:error.code,stack:error.stack,completedChecks:checks}));process.exitCode=1;});
