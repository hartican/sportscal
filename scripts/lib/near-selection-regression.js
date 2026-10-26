'use strict';
const assert=require('node:assert/strict');
const ns='nothingsports_fixture_read_private.',reader='public.nothingsports_read_match_centre_fixture_bundle';
const contractSql="jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig)";
async function contracts(db,list){for(const item of list){assert.deepEqual((await db.query('select '+contractSql+' contract from pg_proc p where oid=to_regprocedure($1)',[item.signature])).rows[0]?.contract,item.contract,item.signature);}}
async function regression(db,report){
 const checks=report.regressions=[];const mark=name=>checks.push(name),source='near-selection-local';
 const rawDefinition=(await db.query('select pg_get_functiondef($1::regprocedure)definition',[ns+'read_near_raw(text[])'])).rows[0].definition;
 assert.equal(rawDefinition.replace(ns+'read_near_raw(',reader+'('),require('../fixtures/near-selection-originals.json').reader);mark('reference fallback is exact original D9 definition apart from private name');
 const ready=async expected=>assert.equal((await db.query('select '+ns+'near_index_ready() ready')).rows[0].ready,expected);
 const drain=async()=>db.exec('set constraints all immediate;set constraints all deferred;');
 async function same(label,ids=[]){
  const r=(await db.query('select '+reader+'($1)::text actual,'+ns+'read_near_raw($1)::text original',[ids])).rows[0];
  assert.equal(r.actual,r.original,label+' full ordered text');mark(label);return JSON.parse(r.actual);
 }
 async function transaction(fn){await db.exec('begin');try{await fn();}finally{await db.exec('rollback');}}
 const insert=async(f,keys=[f.id])=>db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)values($1,$2,$3,$4::jsonb,md5($4::text))',[source,f.id,keys,JSON.stringify(f)]);
 const patch=async(id,fields)=>db.query('update public.nothingsports_fixture_current set fixture=fixture||$2::jsonb where source_id=$1 and fixture_id=$3',[source,JSON.stringify(fields),id]);
 const score=async(id,s,first=null)=>db.query('insert into public.nothingsports_live_scores(source_id,fixture_id,score,first_completed_at,content_hash)values($1,$2,$3::jsonb,$4,md5($3::text))on conflict(source_id,fixture_id)do update set score=excluded.score,first_completed_at=excluded.first_completed_at,content_hash=excluded.content_hash',[source,id,JSON.stringify(s),first]);
 const future=new Date(Date.now()+10*86400000).toISOString(),recent=new Date(Date.now()-60000).toISOString(),old='2001-01-01T00:00:00Z';
 const base=id=>({id,status:'scheduled',startTimeUtc:future,homeParticipantId:id+':h',awayParticipantId:id+':a',statusCheckedAt:old});
 await same('existing complete oracle and alias',['preserved:late']);await ready(true);
 await transaction(async()=>{
  const statuses=['live','in-progress','in_progress','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing','scheduled','upcoming','completed','finished','final','cancelled','canceled','abandoned',null,'other'];
  for(let i=0;i<statuses.length;i++)await insert({...base('edge:'+i),status:statuses[i]});
  await drain();await ready(true);await same('all status spellings and null');
  for(const start of [null,'','TBD','2026-99-99T01:01:01Z','2026-11-01T09:12Z','2026-11-01T09:12:13Z','2026-11-01T09:12:13.123+11:00']){
   await patch('edge:10',{startTimeUtc:start});await drain();await ready(true);await same('strict versus lookup clock '+String(start));
  }
  for(const field of ['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','resultPublishedAt','statusCheckedAt']){
   for(const value of [recent,'unqualified',null,'']){
    await patch('edge:12',{[field]:value});await drain();await ready(true);await same('base completion '+field+' '+String(value));
    await score('edge:12',{[field]:null,status:'completed'});await drain();await ready(true);await same('score presence-null completion '+field);
    await score('edge:12',{[field]:value,status:'completed'});await drain();await ready(true);await same('score completion '+field+' '+String(value));
   }
  }
  await score('edge:13',{status:'completed',statusCheckedAt:old},old);await drain();await ready(true);
  const before=(await db.query('select score_selection from '+ns+'fixture_context where fixture_id=$1',['edge:13'])).rows[0];
  await db.query('update public.nothingsports_live_scores set first_completed_at=$1 where fixture_id=$2',[recent,'edge:13']);await drain();await ready(true);
  assert.deepEqual((await db.query('select score_selection from '+ns+'fixture_context where fixture_id=$1',['edge:13'])).rows[0],before);
  assert((await same('first-complete-only update')).rows.some(r=>r.fixture_id==='edge:13'));
  await db.query('delete from public.nothingsports_live_scores where fixture_id=$1',['edge:13']);await drain();await ready(true);await same('score deletion');
  await patch('edge:14',{status:'completed',statusCheckedAt:recent});await drain();await ready(true);await same('base status-check-only update');
  await db.query('delete from public.nothingsports_fixture_current where fixture_id=$1',['edge:14']);await drain();await ready(true);await same('current deletion and metadata cascade');
 });
 await ready(true);await same('rollback preserves complete original snapshot');
 await transaction(async()=>{
  await insert({...base('current-move:old'),status:'live'});await drain();await ready(true);
  await db.exec('savepoint current_move');let blocked;try{await db.query('update public.nothingsports_fixture_current set fixture_id=$1 where fixture_id=$2',['current-move:new','current-move:old']);}catch(e){blocked=e;}await db.exec('rollback to savepoint current_move');assert.equal(blocked?.code,'23503');mark('original current/context FK movement refusal retained');
  await db.query('delete from '+ns+'fixture_context where fixture_id=$1',['current-move:old']);
  await db.query('update public.nothingsports_fixture_current set fixture_id=$1 where fixture_id=$2',['current-move:new','current-move:old']);await drain();await ready(true);
  assert.deepEqual((await db.query('select fixture_id,shape_version from '+ns+"near_selection where fixture_id like 'current-move:%'")).rows,[{fixture_id:'current-move:new',shape_version:1}]);await same('allowed current composite movement cascades typed metadata');
  await db.exec("insert into public.nothingsports_fixture_sources(source_id)values('near-move-other')");
  await db.query('delete from '+ns+'fixture_context where fixture_id=$1',['current-move:new']);
  await db.query("update public.nothingsports_fixture_current set source_id='near-move-other',fixture_id='current-move:other'where fixture_id='current-move:new'");await drain();await ready(true);
  assert.deepEqual((await db.query('select source_id,fixture_id,shape_version from '+ns+"near_selection where fixture_id like 'current-move:%'")).rows,[{source_id:'near-move-other',fixture_id:'current-move:other',shape_version:1}]);
  assert.equal((await db.query("select count(*)::int n from "+ns+"fixture_tokens where source_id=$1 and fixture_id like 'current-move:%'",[source])).rows[0].n,0);await same('allowed source-and-fixture movement leaves no stale near/token key');
 });
 await ready(true);assert.equal((await db.query('select count(*)::int n from '+ns+"near_selection where fixture_id like 'current-move:%'")).rows[0].n,0);await same('current composite movements and metadata roll back together');
 await db.exec('begin');
 await insert(base('deferred-move:old'));await db.query('delete from '+ns+'fixture_context where fixture_id=$1',['deferred-move:old']);
 await db.query("update public.nothingsports_fixture_current set fixture_id='deferred-move:new'where fixture_id='deferred-move:old'");await db.exec('commit');
 await ready(true);assert.equal((await db.query('select count(*)::int n from '+ns+"near_selection where fixture_id='deferred-move:new'and shape_version=1")).rows[0].n,1);await same('allowed current movement passes original deferred commit owner');
 await db.exec("begin;delete from public.nothingsports_fixture_current where fixture_id='deferred-move:new';commit");
 await ready(true);assert.equal((await db.query('select count(*)::int n from '+ns+"near_selection where fixture_id like 'deferred-move:%'")).rows[0].n,0);await same('committed cleanup removes moved context/token/near entries');
 await transaction(async()=>{
  const pubSource='discovery-near-coalesced',token='00000000-0000-4000-8000-000000000091';
  await db.query('insert into public.nothingsports_fixture_sources(source_id)values($1)',[pubSource]);
  await db.exec('create temporary table qa_near_derivations(fixture_id text);create function pg_temp.qa_near_context()returns trigger language plpgsql set search_path=\'\'as $$begin insert into pg_temp.qa_near_derivations values(new.fixture_id);return null;end$$;create trigger qa_near_context after insert or update on '+ns+'fixture_context for each row execute function pg_temp.qa_near_context()');
  const f={...base('coalesced:0'),key:'football',status:'scheduled',sourceCheckedAt:old,scoreCheckedAt:old};
  async function publish(fixture,overlay){
   await db.query("update public.nothingsports_fixture_sources set lease_token=$2,lease_until=clock_timestamp()+interval '5 minutes'where source_id=$1",[pubSource,token]);
   return db.query('select public.nothingsports_publish_compact_scores($1,$2,$3::jsonb,$4::jsonb,md5($3::text),120000,null)',[pubSource,token,JSON.stringify([fixture]),JSON.stringify([overlay])]);
  }
  const overlay={id:f.id,status:'scheduled',homeScore:0,awayScore:0,scoreCheckedAt:old,statusCheckedAt:old};
  await publish(f,overlay);await drain();await ready(true);await same('actual coalesced compact publisher seed');
  assert.deepEqual((await db.query('select * from qa_near_derivations')).rows,[{fixture_id:f.id}]);
  await db.exec('delete from qa_near_derivations');await publish(f,overlay);await drain();await ready(true);
  assert.equal((await db.query('select count(*)::int n from qa_near_derivations')).rows[0].n,0);await same('coalesced unchanged publisher retains fast return');
  await publish({...f,title:'corrected',status:'live',statusCheckedAt:recent},{...overlay,status:'live',homeScore:2,scoreCheckedAt:recent,statusCheckedAt:recent});await drain();await ready(true);
  assert.deepEqual((await db.query('select * from qa_near_derivations')).rows,[{fixture_id:f.id}]);
  const got=await same('coalesced combined base-score change derives one final context');assert(got.rows.some(r=>r.fixture_id===f.id));
  assert.equal((await db.query('select count(*)::int n from '+ns+'integrity_pending where batch_xid is not null or batch_pid is not null')).rows[0].n,0);
 });
 await ready(true);await same('coalesced rollback preserves prior snapshot');
 await transaction(async()=>{
  const previous=(await db.query('select status from '+ns+"near_selection where fixture_id='admitted:19'")).rows[0].status;
  await db.query('insert into '+ns+'integrity_pending(source_id,batch_xid,batch_pid)values($1,txid_current(),pg_backend_pid())',[source]);
  await patch('admitted:19',{status:'live'});await score('admitted:19',{status:'live',homeScore:3,awayScore:1});
  assert.equal((await db.query('select status from '+ns+"near_selection where fixture_id='admitted:19'")).rows[0].status,previous);
  await ready(false);await same('owned batch defers metadata and reads original raw facts');
 });
 await ready(true);await same('owned batch rollback restores settled view');
 await transaction(async()=>{
  await insert({...base('closure:a'),status:'live',homeParticipantId:'x|y',awayParticipantId:'z'},['closure:a','chain:1']);
  await insert({...base('closure:b')},['closure:b','chain:1','chain:2']);
  await insert({...base('closure:c')},['closure:c','chain:2']);
  await insert({...base('closure:same'),homeParticipantId:'z',awayParticipantId:'x|y'});
  await insert({...base('closure:collision'),homeParticipantId:'x',awayParticipantId:'y|z'});
  await insert({...base('closure:uncertain'),status:'unknown',startTimeUtc:'TBD'});
  await drain();await ready(true);const got=await same('transitive aliases, exact side arrays and independent uncertain clocks');
  const ids=new Set(got.rows.map(r=>r.fixture_id));for(const id of ['closure:a','closure:b','closure:c','closure:same','closure:uncertain'])assert(ids.has(id));assert(!ids.has('closure:collision'));
  await same('NULL membership',null);const over=await same('5001 membership refusal',Array.from({length:5001},(_,i)=>'m:'+i));assert.equal(over.complete,false);assert.equal(over.rows.length,0);
 });
 await transaction(async()=>{
  await insert({...base('context:a'),status:'live'});await insert(base('context:b'));await drain();await ready(true);
  await db.query('update '+ns+"fixture_context set base_selection=base_selection||'{\"starts\":\"TBD\"}'::jsonb where fixture_id='context:b'");
  await ready(false);await same('direct contrary context falls back while pending');
  await db.query('select '+ns+'rebuild_near_selection($1,$2)',[source,'context:b']);await ready(false);await drain();await ready(false);await same('service helper cannot bless contrary context');
  await db.query('select '+ns+'sync_fixture($1,$2)',[source,'context:b']);await drain();await ready(true);await same('legitimate writer restores canonical context');
  await db.exec('create temporary table qa_context as select * from '+ns+"fixture_context where fixture_id='context:b';create temporary table qa_tokens as select * from "+ns+"fixture_tokens where fixture_id='context:b'");
  await db.query('delete from '+ns+'fixture_context where fixture_id=$1',['context:b']);await ready(false);await same('direct context deletion fallback');
  await db.exec('insert into '+ns+'fixture_context select * from qa_context;insert into '+ns+'fixture_tokens select * from qa_tokens');await drain();await ready(false);await same('direct context insertion stays unready');
  await db.query('select '+ns+'sync_fixture($1,$2)',[source,'context:b']);await drain();await ready(true);
  await db.query('delete from '+ns+'fixture_context where fixture_id=$1',['context:a']);
  await db.exec('savepoint keymove');let blocked;try{await db.query('update '+ns+'fixture_context set fixture_id=$1 where fixture_id=$2',['context:a','context:b']);}catch(e){blocked=e;}await db.exec('rollback to savepoint keymove');assert.equal(blocked?.code,'23503');mark('original context FK movement refusal retained');
  await db.query('delete from '+ns+'fixture_tokens where fixture_id=$1',['context:b']);
  await db.query('update '+ns+'fixture_context set fixture_id=$1 where fixture_id=$2',['context:a','context:b']);await ready(false);await same('context composite movement invalidates OLD and NEW');
  assert.equal((await db.query('select count(*)::int n from '+ns+"near_selection where fixture_id in('context:a','context:b')and shape_version=0")).rows[0].n,2);
 });
 await transaction(async()=>{
  await db.exec('create temporary table qa_near_dml(n int);create function pg_temp.qa_near_dml()returns trigger language plpgsql set search_path=\'\'as $$begin insert into pg_temp.qa_near_dml values(1);return null;end$$;create trigger qa_near_dml after update on '+ns+'near_selection for each row execute function pg_temp.qa_near_dml()');
  await db.query('update '+ns+'fixture_context set base_selection=base_selection where fixture_id=$1',['admitted:1']);await ready(false);
  await db.query('update '+ns+'fixture_context set base_selection=base_selection where fixture_id=$1',['admitted:1']);
  assert.equal((await db.query('select count(*)::int n from qa_near_dml')).rows[0].n,1);mark('repeated context invalidation does not rewrite unready metadata');
 });
 await transaction(async()=>{
  await db.query("update "+ns+"fixture_context set score_selection=score_selection||'{\"hasStart\":\"invalid-boolean\"}'::jsonb where fixture_id='admitted:1'");
  await drain();await ready(false);const errors=[];
  for(const fn of [reader,ns+'read_near_raw']){await db.exec('savepoint malformed');let caught;try{await db.query('select '+fn+'($1)',[[]]);}catch(e){caught=e;}await db.exec('rollback to savepoint malformed');assert(caught);errors.push(caught.code);}
  assert.deepEqual(errors,['22P02','22P02']);mark('original malformed-descriptor error preserved');
 });
 const expected=require('../fixtures/canonical-context-batch-contracts.json').candidate;
 await contracts(db,expected.filter(x=>!['sync_fixture','sync_trigger','mark_integrity_pending'].some(n=>x.signature.startsWith(ns+n+'('))));mark('all19 untouched current function contracts');
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query('select has_schema_privilege($1,$2,\'usage\')allowed',[role,'nothingsports_fixture_read_private'])).rows[0].allowed,false);
  assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\')allowed',[role,reader+'(text[])'])).rows[0].allowed,false);
 }
 const rights=(await db.query("select relrowsecurity rls,relforcerowsecurity forced,has_table_privilege('service_role',c.oid,'SELECT')read,has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')write from pg_class c where oid='"+ns+"near_selection'::regclass")).rows[0];assert.deepEqual(rights,{rls:true,forced:true,read:true,write:false});mark('private RLS and service SELECT-only table');
 await transaction(async()=>{await db.exec('set local role service_role');await same('actual service reader');let error;try{await db.exec('update '+ns+'near_selection set shape_version=0');}catch(e){error=e;}assert.equal(error?.code,'42501');});mark('actual service DML refused');
 if(report.padding>=6400){
  await transaction(async()=>{
   const t=performance.now();for(let i=0;i<256;i++)await insert({...base('write-cost:'+i),retainedWideFact:'x'.repeat(1024)});
   await drain();report.candidateWriteCost={rows:256,elapsedMs:performance.now()-t,scope:'Actual current owner plus typed-index maintenance; local warmed per-row writes, not a paired native throughput claim.'};await ready(true);await same('new canonical writes keep all admission metadata ready');
  });
  await transaction(async()=>{
   // Reuse the already-constructed padding; no new provider/source collection.
   await db.query("update public.nothingsports_fixture_current set fixture=fixture||'{\"status\":\"live\"}'::jsonb where fixture_id like 'irrelevant:%'");await drain();await ready(true);
   const over=await same('complete 5001 sentinel on actual stored response');assert.equal(over.complete,false);assert.equal(over.rows.length,5001);
  });
 }
 await require('./near-write-derivation-regression').regression(db,report);mark('canonical owner reuses one authoritative derivation; guarded direct/no-op paths remain');
 await contracts(db,require('../fixtures/near-selection-contracts.json').candidate);mark('exact27 candidate contracts after instrumentation rollback');
 report.checks+=checks.length;
}
async function inverse(db,report){
 const fs=require('node:fs'),expected=require('../fixtures/near-selection-contracts.json'),original=require('../fixtures/canonical-context-batch-contracts.json').candidate;
 const install=fs.readFileSync('supabase/migrations/20261024115500_index_match_centre_selection.sql','utf8'),undo=fs.readFileSync('supabase/rollbacks/20261024115500_index_match_centre_selection.sql','utf8');
 const body=s=>s.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,'');
 const checks=report.inverse=[];const same=async()=>{const r=(await db.query('select '+reader+"('{preserved:late}')::text body")).rows[0].body;return r;};
 const before=await same();
 for(const [name,sql]of [['public helper ACL',"grant execute on function "+ns+'rebuild_near_selection(text,text)to public'],['unchanged function attributes','alter function '+ns+'source_index_complete(text)cost 101'],['near table columns','alter table '+ns+'near_selection add column unexpected text'],['active lease',"update public.nothingsports_fixture_sources set lease_until=clock_timestamp()+interval '5 minutes'"]]){
  await db.exec('begin');let caught;try{await db.exec(sql);await db.exec(body(undo));}catch(e){caught=e;}finally{await db.exec('rollback');}
  assert(caught,name+' undo must refuse');assert.match(caught.message,/contract differs|Active source lease/);await contracts(db,expected.candidate);assert.equal(await same(),before);checks.push('inverse refuses '+name);
 }
 await db.exec('begin');let replay;try{await db.exec(body(install));}catch(e){replay=e;}finally{await db.exec('rollback');}assert.match(replay?.message||'',/Near artifacts already exist/);checks.push('installation replay refused');
 const table=(await db.query(expected.structureSql)).rows[0].contract;assert.deepEqual(table,expected.table);checks.push('sealed near table columns/indexes/constraints/RLS/ACL');
 await db.exec(undo);await contracts(db,original);
 assert.equal((await db.query('select md5(pg_get_functiondef($1::regprocedure))digest',[reader+'(text[])'])).rows[0].digest,'d9b49086166c24b3a10b4dc1f7279b7c');
 assert.equal(await same(),before);assert.equal((await db.query("select to_regclass('"+ns+"near_selection')name")).rows[0].name,null);checks.push('actual inverse restores exact original22 and D9, removes all new artifacts, preserves complete ordered result');
 for(const [name,sql]of [
  ['original reader ACL','grant execute on function '+reader+'(text[])to anon'],
  ['original function attributes','alter function '+ns+'source_index_complete(text)cost 101'],
  ['original trigger','alter table '+ns+'fixture_context disable trigger fixture_context_integrity_after_change'],
  ['generated compact base','alter table public.nothingsports_fixture_current alter column global_fixture drop expression'],
  ['private table rights','grant update on '+ns+'integrity_pending to service_role'],
  ['pending marker schema','alter table '+ns+'integrity_pending drop column batch_pid'],
  ['private schema boundary','grant usage on schema nothingsports_fixture_read_private to anon']]){
  await db.exec('begin');let caught;try{await db.exec(sql);await db.exec(body(install));}catch(e){caught=e;}finally{await db.exec('rollback');}
  assert(caught,name+' install must refuse');assert.match(caught.message,/differs|differ/);await contracts(db,original);assert.equal(await same(),before);checks.push('install refuses '+name);
 }
 await db.exec(install);await contracts(db,expected.candidate);assert.equal(await same(),before);checks.push('guarded reapply retains exact unprepared fallback and all27 contracts');
 report.checks+=checks.length;
}
module.exports={regression,inverse,contracts,contractSql};
