'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const name='nothingsports_read_match_centre_fixture_bundle',signature='public.'+name+'(text[])';
(async()=>{
 const db=await require('./validate-profile-fixture-scope').database();let checks=0;
 try{
  const pgMajor=Math.floor(Number((await db.query("select current_setting('server_version_num') v")).rows[0].v)/10000);
  if(process.env.PGLITE_MODULE==='pglite-pg17')assert.equal(pgMajor,17);
  for(const suffix of ['_bound_fixture_snapshot_query_work.sql','_defer_match_fixture_payload.sql','_include_source_terminal_match_window.sql']){
   const files=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith(suffix));assert.equal(files.length,1);await db.exec('begin;'+fs.readFileSync('supabase/migrations/'+files[0],'utf8')+'commit;');
  }
  const beforeDefinition=(await db.query('select pg_get_functiondef($1::regprocedure) d',[signature])).rows[0].d;
  assert.equal((await db.query('select md5(pg_get_functiondef($1::regprocedure)) h',[signature])).rows[0].h,'1ac31f8804665e54862e50838614b9df');
  await db.exec(beforeDefinition.replace('public.'+name+'(', 'public.qa_original_seed_reader('));
  await db.exec('revoke all on function public.qa_original_seed_reader(text[]) from public,anon,authenticated;grant execute on function public.qa_original_seed_reader(text[]) to service_role;');
  // Reuse the exact already-qualified canonical generated-column DDL.
  const stored=fs.readFileSync('supabase/migrations/20261020173831_store_global_fixture_projection_with_current_facts.sql','utf8').match(/alter table public\.nothingsports_fixture_current add column global_fixture[\s\S]*?\n\) stored;/)[0];
  await db.exec(stored);
  const migration=fs.readFileSync('supabase/migrations/20261020195509_reuse_stored_match_centre_seed_base.sql','utf8');
  const contracts=async()=>(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='nothingsports_fixture_read_private' or n.nspname='public' and p.proname like 'nothingsports_%') and p.oid<>$1::regprocedure",[signature])).rows[0].v;
  const attrs=async()=>(await db.query('select provolatile,prosecdef,proparallel,proleakproof,proconfig,proacl::text acl,prorettype,proretset,prorows,proargnames from pg_proc where oid=$1::regprocedure',[signature])).rows[0];
  const beforeContracts=await contracts(),beforeAttributes=await attrs();
  for(const mutation of [
   'alter function '+signature+' immutable',
   'grant execute on function '+signature+' to public',
   'grant service_role to anon',
   'revoke execute on function '+signature+' from service_role',
   'alter table public.nothingsports_fixture_current alter column global_fixture drop expression',
   'alter table public.nothingsports_fixture_current disable row level security',
   'grant select on public.nothingsports_fixture_current to authenticated'
  ]){
   await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(migration),/differs from reviewed baseline|differs from private service boundary/);await db.exec('rollback;');checks++;
  }
  await db.exec('begin;'+migration+'commit;');
  assert.deepEqual(await contracts(),beforeContracts,'No other public/private helper or grant changes');assert.deepEqual(await attrs(),beforeAttributes,'Near signature, scalar type, language attributes and rights remain exact');
  let afterDefinition=(await db.query('select pg_get_functiondef($1::regprocedure) d',[signature])).rows[0].d;
  const seam=', seeds as materialized (';const at=beforeDefinition.indexOf(seam);assert(at>0);
  assert.equal(afterDefinition,beforeDefinition.slice(0,at).replace(/c\.fixture\b/g,'c.global_fixture')+beforeDefinition.slice(at),'Only seed-input base accesses change; all output, identity, context, completion and admission logic stays exact');
  await db.exec('begin;');await assert.rejects(db.exec(migration),/differs from reviewed baseline/);await db.exec('rollback;');checks++;
  // Run the complete existing semantic suite through the latest direct-field
  // reader, while the independent original raw reader stays the reference.
  afterDefinition=await require('./lib/match-centre-direct-fields-tests').activate(db);
  assert.deepEqual(await contracts(),beforeContracts);assert.deepEqual(await attrs(),beforeAttributes);checks++;
  const now=Date.parse((await db.query('select statement_timestamp() t')).rows[0].t),time=m=>new Date(now+m*60000).toISOString();
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('qa-seed-base'),('qa-seed-publish');");
  const fixture=(id,extra={})=>({id,key:'nrl',status:'scheduled',date:new Date(now).toISOString().slice(0,10),startTimeUtc:time(20),homeParticipantId:id+':home',awayParticipantId:id+':away',fullSpiel:'retained full detail '.repeat(100),storyline:{stakes:4,hookSpoilerOff:'original hook'},...extra});
  const insert=async e=>db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) values('qa-seed-base',$1,$2,$3::jsonb,$1)",[e.id,[e.id,...(e.fixtureIdAliases||[])],JSON.stringify(e)]);
  const score=async(id,value)=>db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('qa-seed-base',$1,$2::jsonb,'qa-score') on conflict(source_id,fixture_id) do update set score=excluded.score",[id,JSON.stringify(value)]);
  const equal=async(ids=[])=>{
   assert.equal((await db.query('select public.qa_original_seed_reader($1)=public.'+name+'($1) same',[ids])).rows[0].same,true,'Stored seed base preserves complete membership, context, every output fact and original observation');checks++;
  };
  await equal();
  for(const status of ['live','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing','scheduled','upcoming','completed','finished','final','cancelled','canceled','abandoned'])await insert(fixture('status:'+status,{status,statusCheckedAt:time(-20)}));
  for(const field of ['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','resultPublishedAt','statusCheckedAt']){
   for(const [label,value]of [['old',time(-1440)],['recent',time(-20)],['unknown','unconfirmed'],['null',null],['numeric',0],['object',{unknown:true}]]){
    const id=field+':'+label;await insert(fixture(id,{status:'completed',statusCheckedAt:time(-1440),[field]:value}));await equal();
    await score(id,{[field]:null,homeScore:0,awayScore:0});await equal();
   }
  }
  await insert(fixture('far:kept',{startTimeUtc:time(2000),fixtureIdAliases:['alias:far']}));await equal(['alias:far']);
  await insert(fixture('alias:context',{fixtureIdAliases:['status:live'],status:'scheduled',startTimeUtc:time(2000)}));await equal();
  await insert(fixture('unknown:start',{startTimeUtc:'unconfirmed'}));await equal();
  for(const [index,value] of [null,0,{unknown:true},'2026-02-30T10:00:00Z',''].entries()){
   await insert(fixture('raw:start:'+index,{startTimeUtc:value}));await equal();
  }
  await insert(fixture('relation:one',{status:'live',fixtureIdAliases:['relation:a']}));
  await insert(fixture('relation:two',{startTimeUtc:time(2000),fixtureIdAliases:['relation:a','relation:b']}));
  await insert(fixture('relation:three',{startTimeUtc:time(2000),fixtureIdAliases:['relation:b']}));await equal();
  const related=(await db.query('select public.'+name+"('{}') body")).rows[0].body.rows;assert(related.some(r=>r.fixture_id==='relation:three'),'A real three-hop context survives direct selection');checks++;
  await score('status:completed',{status:'scheduled',startTimeUtc:null,statusCheckedAt:null});await equal();
  await db.exec("begin;delete from nothingsports_fixture_read_private.fixture_context where source_id='qa-seed-base' and fixture_id='status:live';");await equal();await db.exec('rollback;');
  // Corrupting the actual derived input must expose a lost match; never merely compare two delegates.
  await insert(fixture('negative:receipt',{status:'completed',statusCheckedAt:time(-20)}));await equal();
  await db.exec("begin;alter table public.nothingsports_fixture_current alter column global_fixture drop expression;update public.nothingsports_fixture_current set global_fixture=global_fixture-'statusCheckedAt' where fixture_id='negative:receipt';");
  await assert.rejects(equal(),/preserves complete membership/,'A missing original completion clock in the derived input must fail the actual reader');await db.exec('rollback;');
  // Actual canonical saves and reschedules compute the reused value atomically.
  await db.exec(fs.readFileSync('supabase/migrations/20261012113815_expire_unchanged_fixture_history.sql','utf8').match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/)[0]);
  const publish=async e=>{
   await db.exec("update public.nothingsports_fixture_sources set lease_token='00000000-0000-4000-8000-000000000001',lease_until=clock_timestamp()+interval '1 minute' where source_id='qa-seed-publish';");
   await db.query("select public.nothingsports_publish_fixture_source('qa-seed-publish','00000000-0000-4000-8000-000000000001'::uuid,$1::jsonb,$2,120000)",[JSON.stringify([e]),e.startTimeUtc]);await equal();
  };
  const published=fixture('canonical:seed');await publish(published);await publish(published);await publish({...published,startTimeUtc:time(2000)});await publish({...published,status:'completed',statusCheckedAt:time(-20)});
  const calls=[],options={scope:'match-centre',interactive:true,preserveIds:['alias:far']};
  const got=await require('./lib/semantic-snapshot-read')({timer:()=>0,options,
   inspect:(path,o)=>{calls.push({path,o});assert.equal(o.timeoutMs,5000);},
   resources:[{route:'/rest/v1/rpc/nothingsports_read_fixture_source_health',body:{}},{route:'/rest/v1/rpc/'+name,body:{p_membership_ids:['alias:far']}}],
   load:async(path,o)=>path.endsWith('source_health')?(await db.query('select * from public.nothingsports_read_fixture_source_health()')).rows:(await db.query('select public.'+name+'($1) body',[o.body.p_membership_ids])).rows[0].body,
  });
  assert.equal(calls.length,2);assert(got.flatMap(s=>s.fixtures).some(f=>f.id==='far:kept'));checks++;
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);await assert.rejects(db.query('select public.'+name+"('{}')"),/permission denied/);await db.exec('reset role');checks++;
  }
  // Full scalar reader and seed scan with non-compressible irrelevant detail.
  await db.exec("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) select 'qa-seed-base','wide:'||i,array['wide:'||i],jsonb_build_object('id','wide:'||i,'key','nrl','status','completed','startTimeUtc',(statement_timestamp()-interval '1 day'),'statusCheckedAt',(statement_timestamp()-interval '1 day'),'fullSpiel',(select string_agg(md5(i::text||':'||j),'') from generate_series(1,128) j)),'qa-wide' from generate_series(1,1000) i;");
  await equal();
  await db.exec("begin;set local work_mem='2184kB';set local statement_timeout='3s';");
  const plan=async fn=>(await db.query("explain(analyze,buffers,format json,timing off) select public."+fn+"('{}'::text[])" )).rows[0]['QUERY PLAN'][0];
  const raw=await plan('qa_original_seed_reader'),compact=await plan(name);
  // Require at least one avoided buffer access per constructed wide row;
  // tiny catalog/plan-cache differences cannot make the old scan pass.
  const check=actual=>assert(actual.Plan['Shared Hit Blocks']<=raw.Plan['Shared Hit Blocks']-1000,'Stored seed scan must avoid repeatedly reading irrelevant TOAST detail');
  check(compact);await db.exec(beforeDefinition);await assert.rejects((async()=>check(await plan(name)))(),/irrelevant TOAST detail/,'Restoring the actual original seed scan must fail the work regression');await db.exec(afterDefinition);await db.exec('rollback;');
  await equal(Array(5001).fill('far:kept'));
  assert.equal((await db.query('select public.'+name+'($1) body',[Array(5001).fill('far:kept')])).rows[0].body.complete,false,'Oversized preservation cannot become healthy');
  await db.exec("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) select 'qa-seed-base','cap:'||i,array['cap:'||i],jsonb_build_object('id','cap:'||i,'key','nrl','status','live'),'qa-cap' from generate_series(1,5002) i;");
  await equal();const overflow=(await db.query('select public.'+name+"('{}') body")).rows[0].body;assert.equal(overflow.complete,false);assert.equal(overflow.rows.length,5001,'Full context overflow keeps the incomplete sentinel');checks++;
  await require('./lib/match-centre-direct-fields-tests').roundTrip(db,equal);checks++;
  console.log(JSON.stringify({schemaVersion:'match-centre-stored-seeds.v1',pgMajor,checks,readerMd5:(await db.query('select md5(pg_get_functiondef($1::regprocedure)) h',[signature])).rows[0].h,wholePayloadEqual:true,canonicalPublisher:true,negativeCompletionOmission:true,rawSharedHits:raw.Plan['Shared Hit Blocks'],compactSharedHits:compact.Plan['Shared Hit Blocks'],rawMs:raw['Execution Time'],compactMs:compact['Execution Time'],actualOldScanNegative:true,productionCalls:0}));
 }finally{await db.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
