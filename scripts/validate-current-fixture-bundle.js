'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures');
(async()=>{
 const db=await require('./validate-profile-fixture-scope').database();
 try{
  const pgMajor=Number((await db.query("select current_setting('server_version_num') v")).rows[0].v)/10000|0;
  if(process.env.PGLITE_MODULE==='pglite-pg17')assert.equal(pgMajor,17,'Pinned production-parity runtime must remain PostgreSQL 17');
  // Output-only: actual existing private schema, writer hooks and integrity checks.
  const originalNear=fs.readFileSync('supabase/migrations/20261009082136_short_circuit_match_centre_snapshot.sql','utf8').match(/create or replace function[\s\S]*?\$\$;/)[0];
  await db.exec(originalNear);
  await db.exec(originalNear.replace('nothingsports_read_match_centre_fixture_bundle','qa_reference_match_centre_bundle'));
  await db.exec(fs.readFileSync('supabase/migrations/20261010140637_materialize_match_centre_read_receipts.sql','utf8'));
  const nearEquivalent=async ids=>assert.equal((await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1)=public.qa_reference_match_centre_bundle($1) as same',[ids])).rows[0].same,true,'Materialising source receipts preserves every current fixture field and original observation');
  const reference=fs.readFileSync('supabase/migrations/20261009041722_compact_public_fixture_bundle.sql','utf8').match(/create or replace function[\s\S]*?\$\$;/)[0].replace('nothingsports_read_current_fixture_bundle','qa_reference_fixture_bundle');await db.exec(reference);
  const currentPublisher=fs.readFileSync('supabase/migrations/20261012113815_expire_unchanged_fixture_history.sql','utf8').match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/)[0];await db.exec(currentPublisher);
  const aggregationMigration=fs.readFileSync('supabase/migrations/20261019010303_add_global_fixture_json_reader.sql','utf8');
  const globalSignature='public.nothingsports_read_current_fixture_bundle(text[])',wireSignature='public.nothingsports_read_current_fixture_bundle_json(text[])';
  const globalDefinition=(await db.query('select pg_get_functiondef($1::regprocedure) as definition',[globalSignature])).rows[0].definition;
  await db.exec(globalDefinition.replace('public.nothingsports_read_current_fixture_bundle','public.qa_reference_global_aggregation'));
  await db.exec('revoke all on function public.qa_reference_global_aggregation(text[]) from public,anon,authenticated;grant execute on function public.qa_reference_global_aggregation(text[]) to service_role;');
  const globalAttributes=async()=>(await db.query(`select p.provolatile,p.prosecdef,p.proparallel,p.proleakproof,p.proconfig,p.proacl::text as acl,l.lanname from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=$1::regprocedure`,[globalSignature])).rows[0];
  const originalAttributes=await globalAttributes();
  const retainedContracts=async()=>(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) contracts from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'nothingsports_%' and p.proname<>'nothingsports_read_current_fixture_bundle_json'")).rows[0].contracts;
  const beforeRetainedContracts=await retainedContracts();
  for(const mutation of [
   'alter function public.nothingsports_read_current_fixture_bundle(text[]) security definer',
   'alter function public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz) immutable',
   'grant execute on function public.nothingsports_read_current_fixture_bundle(text[]) to anon',
   'grant execute on function public.nothingsports_read_current_fixture_bundle(text[]) to public',
   'revoke execute on function public.nothingsports_read_current_fixture_bundle(text[]) from service_role',
   "create function public.nothingsports_read_current_fixture_bundle_json(p_fixture_ids text) returns json language sql as $$ select '{}'::json $$",
   'create role qa_unexpected_json_grantee;alter default privileges grant execute on functions to qa_unexpected_json_grantee'
  ]){
   await db.exec('begin;'+mutation+';');
   await assert.rejects(db.exec(aggregationMigration),/differs from reviewed baseline|permissions differ from service-only baseline|already exists/,'Changed definition/helper/permissions must refuse the migration');
   await db.exec('rollback;');assert.deepEqual(await globalAttributes(),originalAttributes);
  }
  await db.exec('begin;'+aggregationMigration+'commit;');
  assert.deepEqual(await globalAttributes(),originalAttributes,'Aggregation preserves exact ACL, language and all function attributes');
  assert.equal((await db.query('select pg_get_functiondef($1::regprocedure) as definition',[globalSignature])).rows[0].definition,globalDefinition,'Existing JSONB definition remains byte-identical');
  const originalBody=(await db.query('select prosrc from pg_proc where oid=$1::regprocedure',[globalSignature])).rows[0].prosrc;
  const wireBody=(await db.query('select prosrc from pg_proc where oid=$1::regprocedure',[wireSignature])).rows[0].prosrc;
  assert.equal(wireBody,originalBody.replace("select jsonb_build_object('schemaVersion'","select json_build_object('schemaVersion'").replace("jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb","json_agg(row_to_json(projected) order by source_id,fixture_id),'[]'::json"),'Only terminal JSON wire representation differs');
  const wireAttributes=(await db.query(`select p.provolatile,p.prosecdef,p.proparallel,p.proleakproof,p.proconfig,p.proacl::text as acl,l.lanname,p.prorettype::regtype::text as returns from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=$1::regprocedure`,[wireSignature])).rows[0];
  assert.equal((await db.query('select pg_get_function_arguments($1::regprocedure)=pg_get_function_arguments($2::regprocedure) as same',[globalSignature,wireSignature])).rows[0].same,true,'JSON RPC preserves parameter name/type/default');
  assert.equal(wireAttributes.returns,'json');const {returns:wireReturn,...wireContract}=wireAttributes;assert.deepEqual(wireContract,originalAttributes,'Additive reader retains the same service-only ACL and function contract');
  assert.deepEqual(await retainedContracts(),beforeRetainedContracts,'All existing readers/helpers retain exact definitions and ACLs');
  assert.equal(originalAttributes.provolatile,'s');assert.equal(originalAttributes.prosecdef,false);assert.equal(originalAttributes.lanname,'sql');assert.deepEqual(originalAttributes.proconfig,['search_path=""']);
  await db.exec('begin;');await assert.rejects(db.exec(aggregationMigration),/already exists/,'Migration cannot replay against an already changed reader');await db.exec('rollback;');
  const rowSignature='public.nothingsports_read_current_fixture_bundle_json_rows(text[])';
  const rowMigration=fs.readFileSync('supabase/migrations/20261019023712_add_global_fixture_json_rows_reader.sql','utf8');
  const oldRowDependencies=async()=>(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) contracts from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'nothingsports_%' and p.proname<>'nothingsports_read_current_fixture_bundle_json_rows'")).rows[0].contracts;
  const beforeRowDependencies=await oldRowDependencies();
  for(const mutation of [
   'alter function public.nothingsports_read_current_fixture_bundle(text[]) security definer',
   'alter function public.nothingsports_read_current_fixture_bundle_json(text[]) immutable',
   'alter function public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz) immutable',
   'grant execute on function public.nothingsports_read_current_fixture_bundle_json(text[]) to anon',
   'revoke execute on function public.nothingsports_read_current_fixture_bundle_json(text[]) from service_role',
   "create function public.nothingsports_read_current_fixture_bundle_json_rows(p_fixture_ids text) returns setof json language sql as $$ select '{}'::json $$",
   'create role qa_unexpected_json_row_grantee;alter default privileges grant execute on functions to qa_unexpected_json_row_grantee'
  ]){
   await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(rowMigration),/differ from reviewed baseline|permissions differ|already exists/);await db.exec('rollback;');assert.deepEqual(await oldRowDependencies(),beforeRowDependencies);
  }
  await db.exec('begin;'+rowMigration+'commit;');assert.deepEqual(await oldRowDependencies(),beforeRowDependencies,'Old JSONB/JSON/near/selected/helper contracts and ACLs remain byte-identical');
  const rowContract=(await db.query(`select p.provolatile,p.prosecdef,p.proparallel,p.proleakproof,p.proconfig,p.proacl::text as acl,l.lanname,p.prorettype::regtype::text as returns,p.proretset,p.prorows,pg_get_function_arguments(p.oid) args,md5(pg_get_functiondef(p.oid)) digest from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=$1::regprocedure`,[rowSignature])).rows[0];
  const {returns:rowReturn,proretset,prorows,args,digest:rowDigest,...rowAttributes}=rowContract;
  assert.equal(rowReturn,'json');assert.equal(proretset,true);assert.equal(prorows,1);assert.deepEqual(rowAttributes,originalAttributes);assert.equal(args,(await db.query('select pg_get_function_arguments($1::regprocedure) args',[wireSignature])).rows[0].args);
  await db.exec('begin;');await assert.rejects(db.exec(rowMigration),/already exists/);await db.exec('rollback;');
  const beforeCompactContracts=await retainedContracts(),beforeCompactAttributes=wireAttributes;
  for(const migrationName of ['20261020153215_compact_global_fixture_read_inputs.sql','20261020162724_batch_global_fixture_observation_times.sql','20261020165006_separate_global_and_selected_fixture_key_scopes.sql']){
  const compactMigration=fs.readFileSync('supabase/migrations/'+migrationName,'utf8');
  for(const mutation of [
   'alter function public.nothingsports_read_current_fixture_bundle_json(text[]) immutable',
   'alter function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) rows 2',
   'alter function public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz) immutable',
   'alter function public.nothingsports_fixture_observation_time(text) strict',
   'grant execute on function public.nothingsports_read_current_fixture_bundle_json(text[]) to public',
   'grant execute on function public.nothingsports_read_current_fixture_bundle_json(text[]) to anon',
   'create role qa_unexpected_compact_grantee;grant execute on function public.nothingsports_read_current_fixture_bundle_json(text[]) to qa_unexpected_compact_grantee',
   'revoke execute on function public.nothingsports_read_current_fixture_bundle_json(text[]) from service_role'
  ]){
   await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(compactMigration),/differ from reviewed baseline|permissions differ/);await db.exec('rollback;');
   assert.deepEqual(await retainedContracts(),beforeCompactContracts,'Refused changes roll back without modifying any retained reader/helper');
  }
  await db.exec('begin;'+compactMigration+'commit;');
  assert.deepEqual(await retainedContracts(),beforeCompactContracts,'Only the global JSON scalar changes; selected/near/rows/projector/time helper and ACLs stay exact');
  assert.deepEqual((await db.query(`select p.provolatile,p.prosecdef,p.proparallel,p.proleakproof,p.proconfig,p.proacl::text as acl,l.lanname,p.prorettype::regtype::text as returns from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=$1::regprocedure`,[wireSignature])).rows[0],beforeCompactAttributes,'Replacement keeps exact function attributes and grants');
  await db.exec('begin;');await assert.rejects(db.exec(compactMigration),/differ from reviewed baseline/);await db.exec('rollback;');
  }
  // Preserve the actual prior caller chain as a local regression control.
  const ownershipBeforeScalar=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[wireSignature])).rows[0].definition;
  const ownershipBeforeRows=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[rowSignature])).rows[0].definition;
  await db.exec(ownershipBeforeScalar.replace('public.nothingsports_read_current_fixture_bundle_json(', 'public.qa_previous_global_scalar('));
  await db.exec(ownershipBeforeRows.replace('public.nothingsports_read_current_fixture_bundle_json_rows(', 'public.qa_previous_global_rows(').replace('public.nothingsports_read_current_fixture_bundle_json(', 'public.qa_previous_global_scalar('));
  await db.exec('revoke all on function public.qa_previous_global_scalar(text[]),public.qa_previous_global_rows(text[]) from public,anon,authenticated;grant execute on function public.qa_previous_global_scalar(text[]),public.qa_previous_global_rows(text[]) to service_role;');
  const ownershipMigration=fs.readFileSync('supabase/migrations/20261020171222_let_global_row_reader_own_aggregation.sql','utf8');
  const retainedOwnershipContracts=async()=>(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) contracts from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'nothingsports_%' and p.proname not in('nothingsports_read_current_fixture_bundle_json','nothingsports_read_current_fixture_bundle_json_rows')")).rows[0].contracts;
  const beforeOwnershipContracts=await retainedOwnershipContracts();
  const ownerAttributes=async signature=>(await db.query("select p.provolatile,p.prosecdef,p.proparallel,p.proleakproof,p.proconfig,p.proacl::text as acl,l.lanname,p.prorettype::regtype::text as returns,p.proretset,p.prorows,pg_get_function_arguments(p.oid) args from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=$1::regprocedure",[signature])).rows[0];
  const beforeOwnerAttributes=await Promise.all([wireSignature,rowSignature].map(ownerAttributes));
  for(const mutation of [
   'alter function public.nothingsports_read_current_fixture_bundle_json(text[]) immutable',
   'alter function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) rows 2',
   'alter function public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz) immutable',
   'alter function public.nothingsports_fixture_observation_time(text) strict',
   ...[wireSignature,rowSignature].flatMap(signature=>[
    'grant execute on function '+signature+' to public',
    'grant execute on function '+signature+' to anon',
    'revoke execute on function '+signature+' from service_role',
    'create role qa_unexpected_owner_grantee;grant execute on function '+signature+' to qa_unexpected_owner_grantee'
   ])
  ]){
   await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(ownershipMigration),/differ from reviewed baseline|permissions differ/);await db.exec('rollback;');
   assert.deepEqual(await retainedOwnershipContracts(),beforeOwnershipContracts);
  }
  await db.exec('begin;'+ownershipMigration+'commit;');
  assert.deepEqual(await retainedOwnershipContracts(),beforeOwnershipContracts,'Only existing global row/scalar bodies change; all other definitions and rights stay exact');
  assert.deepEqual(await Promise.all([wireSignature,rowSignature].map(ownerAttributes)),beforeOwnerAttributes,'Both existing signatures, types, one-row hint, attributes and service-only grants stay exact');
  await db.exec('begin;');await assert.rejects(db.exec(ownershipMigration),/differ from reviewed baseline/);await db.exec('rollback;');
  const projectionMigration=fs.readFileSync('supabase/migrations/20261020173831_store_global_fixture_projection_with_current_facts.sql','utf8');
  const projectionOtherContracts=async()=>(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) contracts from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'nothingsports_%' and p.proname<>'nothingsports_read_current_fixture_bundle_json_rows'")).rows[0].contracts;
  const beforeProjectionContracts=await projectionOtherContracts(),beforeProjectionRowAttributes=await ownerAttributes(rowSignature);
  const relationContract=async()=>(await db.query("select relowner,relacl::text acl,relrowsecurity,relforcerowsecurity from pg_class where oid='public.nothingsports_fixture_current'::regclass")).rows[0];
  const beforeProjectionRelation=await relationContract();
  for(const mutation of [
   'alter function public.nothingsports_read_current_fixture_bundle_json(text[]) immutable',
   'alter function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) rows 2',
   'alter function public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz) immutable',
   'alter function public.nothingsports_fixture_observation_time(text) strict',
   'grant execute on function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) to anon',
   'revoke execute on function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) from service_role',
   'alter table public.nothingsports_fixture_current add column global_fixture jsonb',
   'alter table public.nothingsports_fixture_current disable row level security',
   'grant select on public.nothingsports_fixture_current to anon'
  ]){
   await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(projectionMigration),/differ from reviewed baseline|permissions differ|already exists/);await db.exec('rollback;');
   assert.deepEqual(await projectionOtherContracts(),beforeProjectionContracts);assert.deepEqual(await relationContract(),beforeProjectionRelation);
  }
  const projectionFixture=(await db.query("select jsonb_build_object('id','before-projection','date',(statement_timestamp() at time zone 'Australia/Sydney')::date::text,'status','scheduled','kind','tournament','fullSpiel','pre-existing full copy','scoreCheckedAt','2026-10-01T00:00:00Z','storyline',jsonb_build_object('stakes',4,'hookSpoilerOff','pre-existing hook'),'subEvents',jsonb_build_array(jsonb_build_object('id','before-detail'))) fixture")).rows[0].fixture;
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('qa-stored-projection');");
  const publishProjection=async(fixture,hash)=>{
   await db.exec("update public.nothingsports_fixture_sources set lease_token='00000000-0000-4000-8000-000000000001',lease_until=clock_timestamp()+interval '1 minute' where source_id='qa-stored-projection';");
   await db.query("select public.nothingsports_publish_fixture_source('qa-stored-projection','00000000-0000-4000-8000-000000000001'::uuid,$1::jsonb,$2,120000)",[JSON.stringify([fixture]),hash]);
  };
  await publishProjection(projectionFixture,'qa-before');
  const projectionData=async derived=>(await db.query("select md5(jsonb_agg("+ (derived?"to_jsonb(c)-'global_fixture'":"to_jsonb(c)")+" order by source_id,fixture_id)::text) digest from public.nothingsports_fixture_current c")).rows[0].digest;
  const beforeProjectionData=await projectionData(false);
  const projectionEqual=async()=>assert.equal((await db.query("select public.qa_reference_global_aggregation(null::text[])=(select value::jsonb from public.nothingsports_read_current_fixture_bundle_json_rows(null::text[]) t(value)) same")).rows[0].same,true,'Stored projection must match the complete original membership and facts');
  await db.exec('begin;'+projectionMigration+'commit;');
  assert.equal(await projectionData(true),beforeProjectionData,'Backfill preserves every original stored field, ID, content hash and observation clock');
  assert.deepEqual(await projectionOtherContracts(),beforeProjectionContracts,'Only the existing row reader body changes; canonical writer and all other functions/ACLs stay exact');
  assert.deepEqual(await ownerAttributes(rowSignature),beforeProjectionRowAttributes);assert.deepEqual(await relationContract(),beforeProjectionRelation);
  assert.equal((await db.query("select attgenerated from pg_attribute where attrelid='public.nothingsports_fixture_current'::regclass and attname='global_fixture'")).rows[0].attgenerated,'s');
  await projectionEqual();
  await publishProjection(projectionFixture,'qa-before');
  assert.equal(await projectionData(true),beforeProjectionData,'Unchanged canonical checks preserve current facts, original clocks and the stored projection');
  const baseProjectionDigest=(await db.query("select md5(global_fixture::text) digest from public.nothingsports_fixture_current where source_id='qa-stored-projection'")).rows[0].digest;
  await db.exec("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('qa-stored-projection','before-projection','{\"status\":\"completed\",\"homeScore\":0,\"awayScore\":1,\"scoreCheckedAt\":\"2026-10-03T00:00:00Z\"}'::jsonb,'qa-score');update public.nothingsports_fixture_sources set discovery_report='{\"_fixtureObservations\":{\"before-projection\":{\"s\":\"2026-10-04T00:00:00Z\",\"t\":\"2026-10-04T00:00:00Z\"}}}'::jsonb where source_id='qa-stored-projection';");
  await projectionEqual();
  const freshProjection=(await db.query("select value::jsonb bundle from public.nothingsports_read_current_fixture_bundle_json_rows(null::text[]) t(value)")).rows[0].bundle.rows[0].fixture;
  assert.equal(freshProjection.homeScore,0);assert.equal(Date.parse(freshProjection.scoreFactObservedAt),Date.parse('2026-10-03T00:00:00Z'));assert.equal(Date.parse(freshProjection.scoreCheckedAt),Date.parse('2026-10-04T00:00:00Z'),'A fresh receipt does not replace the original score fact clock');
  assert.equal((await db.query("select md5(global_fixture::text) digest from public.nothingsports_fixture_current where source_id='qa-stored-projection'")).rows[0].digest,baseProjectionDigest,'Live score and receipt changes do not require rewriting the stored base');
  await db.exec("delete from public.nothingsports_live_scores where source_id='qa-stored-projection';");
  const movedProjectionFixture={...projectionFixture,date:'2099-01-01',fullSpiel:'new retained full copy'};
  await db.exec('begin;alter table public.nothingsports_fixture_current alter column global_fixture drop expression;');
  await publishProjection(movedProjectionFixture,'qa-moved');
  await assert.rejects(projectionEqual(),/complete original membership and facts/,'A stale manual copy must fail the actual canonical-writer lifecycle comparison');await db.exec('rollback;');
  await publishProjection(movedProjectionFixture,'qa-moved');await projectionEqual();
  const selectedProjection=(await db.query("select value::jsonb bundle from public.nothingsports_read_current_fixture_bundle_json_rows(array['before-projection']) t(value)")).rows[0].bundle;
  assert.equal(selectedProjection.rows[0].fixture.fullSpiel,'new retained full copy');assert.equal(Date.parse(selectedProjection.rows[0].fixture.scoreFactObservedAt),Date.parse(projectionFixture.scoreCheckedAt),'Canonical updates do not renew the original fact clock, regardless of session time zone');
  await db.exec("delete from public.nothingsports_fixture_current where source_id='qa-stored-projection';delete from public.nothingsports_fixture_snapshots where source_id='qa-stored-projection';delete from public.nothingsports_fixture_sources where source_id='qa-stored-projection';");
  await db.exec('begin;');await assert.rejects(db.exec(projectionMigration),/differ from reviewed baseline|already exists/);await db.exec('rollback;');
  const spoolMigration=fs.readFileSync('supabase/migrations/20261020181208_avoid_duplicate_global_fixture_projection_spooling.sql','utf8');
  const beforeSpoolContracts=await projectionOtherContracts(),beforeSpoolRowAttributes=await ownerAttributes(rowSignature),beforeSpoolRelation=await relationContract();
  const generatedContract=async()=>(await db.query("select a.attgenerated,a.attnotnull,a.attacl::text acl,pg_get_expr(d.adbin,d.adrelid) expression from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture'")).rows[0];
  const beforeSpoolGenerated=await generatedContract();
  for(const mutation of [
   'alter function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) rows 2',
   'alter function public.nothingsports_fixture_observation_time(text) strict',
   'grant execute on function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) to anon',
   'revoke execute on function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) from service_role',
   'alter table public.nothingsports_fixture_current alter column global_fixture drop expression',
   'alter table public.nothingsports_fixture_current disable row level security',
   'grant select on public.nothingsports_fixture_current to anon'
  ]){
   await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(spoolMigration),/differ.*reviewed baseline|permissions differ/);await db.exec('rollback;');
   assert.deepEqual(await projectionOtherContracts(),beforeSpoolContracts);assert.deepEqual(await generatedContract(),beforeSpoolGenerated);
  }
  await db.exec('begin;'+spoolMigration+'commit;');
  assert.deepEqual(await projectionOtherContracts(),beforeSpoolContracts,'Only the existing global row body changes; all other functions and ACLs stay exact');
  assert.deepEqual(await ownerAttributes(rowSignature),beforeSpoolRowAttributes);assert.deepEqual(await relationContract(),beforeSpoolRelation);assert.deepEqual(await generatedContract(),beforeSpoolGenerated);
  await projectionEqual();
  await db.exec('begin;');await assert.rejects(db.exec(spoolMigration),/differ from reviewed baseline/);await db.exec('rollback;');
  const indexedAdmissionMigration=fs.readFileSync('supabase/migrations/20261020182931_reuse_existing_calendar_index_for_global_admission.sql','utf8');
  const privateIndexContract=async()=>(await db.query("select jsonb_build_object('functions',(select jsonb_object_agg(p.oid::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) from pg_proc p where p.pronamespace='nothingsports_fixture_read_private'::regnamespace),'triggers',(select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgrelid::regclass::text,t.tgname) from pg_trigger t where not t.tgisinternal and t.tgname in('fixture_current_integrity_after_change','fixture_read_context_after_current','fixture_context_integrity_after_change','fixture_token_membership_after_change','fixture_tokens_integrity_after_change','fixture_integrity_at_commit','source_tokens_integrity_after_change','fixture_read_context_after_score')),'tables',(select jsonb_agg(jsonb_build_object('relation',c.oid::regclass::text,'owner',c.relowner,'acl',c.relacl::text,'rls',c.relrowsecurity,'forcedRls',c.relforcerowsecurity) order by c.oid::regclass::text) from pg_class c where c.oid in('nothingsports_fixture_read_private.fixture_context'::regclass,'nothingsports_fixture_read_private.integrity_pending'::regclass)),'schema',(select jsonb_build_object('owner',nspowner,'acl',nspacl::text) from pg_namespace where oid='nothingsports_fixture_read_private'::regnamespace)) contract")).rows[0].contract;
  const beforeIndexContract=await privateIndexContract(),beforeIndexedOtherContracts=await projectionOtherContracts(),beforeIndexedRowAttributes=await ownerAttributes(rowSignature),beforeIndexedGenerated=await generatedContract();
  for(const mutation of [
   'alter function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) rows 2',
   'alter function nothingsports_fixture_read_private.window_fields(jsonb) strict',
   'grant select on nothingsports_fixture_read_private.fixture_context to anon',
   'grant usage on schema nothingsports_fixture_read_private to anon',
   'alter table public.nothingsports_fixture_current disable trigger fixture_read_context_after_current',
   'alter table nothingsports_fixture_read_private.integrity_pending disable trigger fixture_integrity_at_commit',
   'alter table public.nothingsports_fixture_current alter column global_fixture drop expression'
  ]){
   await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(indexedAdmissionMigration),/differ.*reviewed baseline/);await db.exec('rollback;');
   assert.deepEqual(await privateIndexContract(),beforeIndexContract);assert.deepEqual(await projectionOtherContracts(),beforeIndexedOtherContracts);
  }
  await db.exec('begin;'+indexedAdmissionMigration+'commit;');
  assert.deepEqual(await privateIndexContract(),beforeIndexContract,'Every existing private index helper, trigger, table and schema right remains exact');
  assert.deepEqual(await projectionOtherContracts(),beforeIndexedOtherContracts);assert.deepEqual(await ownerAttributes(rowSignature),beforeIndexedRowAttributes);assert.deepEqual(await generatedContract(),beforeIndexedGenerated);
  await db.exec('begin;');await assert.rejects(db.exec(indexedAdmissionMigration),/differ from reviewed baseline/);await db.exec('rollback;');
  // The actual canonical publisher and score hooks maintain the reused fields.
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('qa-stored-projection');");
  const publishIndexedScore=async(fixture,score,hash)=>{
   await db.exec("update public.nothingsports_fixture_sources set lease_token='00000000-0000-4000-8000-000000000001',lease_until=clock_timestamp()+interval '1 minute' where source_id='qa-stored-projection';");
   await db.query("select public.nothingsports_publish_compact_scores('qa-stored-projection','00000000-0000-4000-8000-000000000001'::uuid,$1::jsonb,$2::jsonb,$3,120000,'{}'::jsonb)",[JSON.stringify([fixture]),JSON.stringify([score]),hash]);
  };
  const indexedScore={id:'before-projection',status:'scheduled',statusCheckedAt:'2026-10-02T00:00:00Z',homeScore:0,scoreCheckedAt:'2026-10-02T00:00:00Z',observationSchema:'fixture-observations.v1',statusObserved:true,scoreObserved:true};
  await publishIndexedScore(projectionFixture,indexedScore,'qa-indexed-original');await projectionEqual();
  await publishIndexedScore({...projectionFixture,date:'2099-01-01'},indexedScore,'qa-indexed-moved');await projectionEqual();
  await publishIndexedScore({...projectionFixture,date:'2099-01-01'},{...indexedScore,status:'live',statusCheckedAt:'2026-10-03T00:00:00Z'},'qa-indexed-moved');await projectionEqual();
  await db.exec("delete from public.nothingsports_live_scores where source_id='qa-stored-projection';");

  await publishProjection({...projectionFixture,date:'2099-01-01'},'qa-indexed-moved');await projectionEqual();
  await db.exec("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('qa-stored-projection','before-projection','{\"status\":\"live\",\"date\":null,\"homeScore\":0}'::jsonb,'qa-indexed-score');");await projectionEqual();
  await publishProjection(projectionFixture,'qa-indexed-returned');
  await db.exec("delete from public.nothingsports_live_scores where source_id='qa-stored-projection';");await projectionEqual();
  await db.exec("begin;delete from nothingsports_fixture_read_private.fixture_context where source_id='qa-stored-projection';");
  assert((await db.query('select count(*)::int n from nothingsports_fixture_read_private.integrity_pending')).rows[0].n>0);await projectionEqual();
  await assert.rejects(db.exec('commit;'),e=>e.code==='23514','Missing index metadata cannot commit; pending metadata uses original facts');await db.exec('rollback;');
  // Isolate each fallback branch in a local copy while retaining real canonical lifecycle proof above.
  await publishProjection({...projectionFixture,date:'2099-01-01'},'qa-indexed-fallback');await db.exec("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('qa-stored-projection','before-projection','{\"status\":\"scheduled\",\"date\":null}'::jsonb,'qa-null-date');");await projectionEqual();
  await db.exec('create temp table qa_global_context as table nothingsports_fixture_read_private.fixture_context;create temp table qa_global_pending as select * from nothingsports_fixture_read_private.integrity_pending with no data;');
  const indexedDefinition=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[rowSignature])).rows[0].definition;
  const fallbackDefinition=indexedDefinition.replace('public.nothingsports_read_current_fixture_bundle_json_rows(', 'public.qa_indexed_fallback_rows(').replaceAll('nothingsports_fixture_read_private.fixture_context','pg_temp.qa_global_context').replaceAll('nothingsports_fixture_read_private.integrity_pending','pg_temp.qa_global_pending');await db.exec(fallbackDefinition);
  await db.exec('revoke all on function public.qa_indexed_fallback_rows(text[]) from public,anon,authenticated;');
  const fallbackEqual=async()=>assert.equal((await db.query('select public.qa_reference_global_aggregation(null::text[])=(select value::jsonb from public.qa_indexed_fallback_rows(null::text[]) t(value)) same')).rows[0].same,true,'Indexed fallback retains complete original membership and facts');
  const incompleteDateFlag="update pg_temp.qa_global_context set score_selection=jsonb_set(score_selection,'{calendarWindow}',(score_selection->'calendarWindow')-'hasDate')";
  const shapeGuard=indexedAdmissionMigration.match(/   -- Complete descriptor shape:[\s\S]*?   -- End complete descriptor shape.\n/)[0];
  await db.exec('begin;'+incompleteDateFlag+';'+fallbackDefinition.replace(shapeGuard,''));await assert.rejects(fallbackEqual(),/complete original membership/,'Restoring the incomplete-object trust must reproduce the lost explicit-null match');await db.exec('rollback;');
  for(const mutation of ["delete from pg_temp.qa_global_context","update pg_temp.qa_global_context set shape_version=2","update pg_temp.qa_global_context set base_selection=base_selection-'calendarWindow'","update pg_temp.qa_global_context set score_selection=jsonb_set(score_selection,'{calendarWindow}','null'::jsonb)",incompleteDateFlag,"update pg_temp.qa_global_context set score_selection=jsonb_set(score_selection,'{calendarWindow,hasDate}','\"invalid\"'::jsonb)","update pg_temp.qa_global_context set score_selection=jsonb_set(score_selection,'{calendarWindow,hasDate}','[]'::jsonb)","update pg_temp.qa_global_context set score_selection=jsonb_set(score_selection,'{calendarWindow,hasDate}','0'::jsonb)","update pg_temp.qa_global_context set score_selection=jsonb_set(score_selection,'{calendarWindow}',(score_selection->'calendarWindow')-'date')"]){await db.exec('begin;'+mutation+';');await fallbackEqual();await db.exec('rollback;');}

  const staleIndex="update pg_temp.qa_global_context set score_selection=jsonb_set(score_selection,'{calendarWindow,date}','\"2099-01-01\"')";
  await db.exec('begin;'+staleIndex+';');await assert.rejects(fallbackEqual(),/complete original membership/,'A stale index without its integrity signal must fail whole-output comparison');await db.exec("insert into pg_temp.qa_global_pending values('qa-stored-projection');");await fallbackEqual();await db.exec('rollback;');
  await db.exec('drop function public.qa_indexed_fallback_rows(text[]);drop table pg_temp.qa_global_context,pg_temp.qa_global_pending;');
  await db.exec("delete from public.nothingsports_fixture_current where source_id='qa-stored-projection';delete from public.nothingsports_fixture_snapshots where source_id='qa-stored-projection';delete from public.nothingsports_fixture_sources where source_id='qa-stored-projection';");
  const transportView='public.nothingsports_current_global_fixture_bundle';
  const transportMigration=fs.readFileSync('supabase/migrations/20261020192228_inline_global_fixture_bundle_transport.sql','utf8');
  const beforeTransportOthers=await projectionOtherContracts(),beforeTransportRowAttributes=await ownerAttributes(rowSignature),beforeTransportPrivate=await privateIndexContract(),beforeTransportGenerated=await generatedContract();
  for(const mutation of [
   'alter function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) rows 2',
   'alter function public.nothingsports_read_current_fixture_bundle(text[]) immutable',
   'create view public.nothingsports_current_global_fixture_bundle as select null::json bundle',
   'create role qa_unexpected_view_grantee;alter default privileges grant select on tables to qa_unexpected_view_grantee',
   'alter function nothingsports_fixture_read_private.window_fields(jsonb) strict'
  ]){
   await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(transportMigration),/differ.*reviewed baseline|permissions differ|already exists/);await db.exec('rollback;');
   assert.equal((await db.query('select to_regclass($1) missing',[transportView])).rows[0].missing,null,'A rejected migration must not leave a view');
  }
  await db.exec('begin;'+transportMigration+'commit;');
  assert.deepEqual(await projectionOtherContracts(),beforeTransportOthers,'All other existing functions remain exact');
  assert.deepEqual(await ownerAttributes(rowSignature),beforeTransportRowAttributes,'Legacy row RPC keeps its exact attributes, grants, signature and type');
  assert.deepEqual(await privateIndexContract(),beforeTransportPrivate);assert.deepEqual(await generatedContract(),beforeTransportGenerated);
  const viewContract=(await db.query("select c.relkind,c.reloptions,pg_get_userbyid(c.relowner) owner,c.relacl::text acl from pg_class c where c.oid=$1::regclass",[transportView])).rows[0];
  assert.equal(viewContract.relkind,'v');assert.equal(viewContract.owner,'postgres');assert.deepEqual(viewContract.reloptions,['security_invoker=true']);
  for(const role of ['anon','authenticated']){
   assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT') allowed",[role,transportView])).rows[0].allowed,false);
   await db.exec('set role '+role);await assert.rejects(db.query('select * from '+transportView),/permission denied/);await db.exec('reset role');
  }
  assert.equal((await db.query("select has_table_privilege('service_role',$1,'SELECT') allowed",[transportView])).rows[0].allowed,true);
  assert.equal((await db.query("select has_table_privilege('service_role',$1,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') allowed",[transportView])).rows[0].allowed,false);
  await db.exec('begin;');await assert.rejects(db.exec(transportMigration),/already exists|differ.*reviewed baseline/);await db.exec('rollback;');
  const aggregationEquivalent=async(ids,expectedCount,expectedComplete=true)=>{
   const r=(await db.query(`with old as materialized(select public.qa_reference_global_aggregation($1::text[]) v), current as materialized(select public.nothingsports_read_current_fixture_bundle_json($1::text[])::jsonb v), emitted as materialized(select value from public.nothingsports_read_current_fixture_bundle_json_rows($1::text[]) t(value)), payload as materialized(select json_agg(value) wire,count(*) row_count from emitted)
    select old.v=current.v and old.v=(payload.wire::jsonb->0) as same,payload.row_count,json_array_length(payload.wire) array_length,jsonb_array_length(current.v->'rows') as n,current.v->'complete'='true'::jsonb as complete,current.v->>'schemaVersion' as schema from old,current,payload`,[ids])).rows[0];
   assert.equal(r.row_count,1,'SETOF reader emits exactly one row even with empty fixture membership');assert.equal(r.array_length,1);
   assert.equal(r.same,true,'Whole ordered JSONB output equals the original current reader, including exact numerics');assert.equal(r.schema,'current-fixture-bundle.v1');
   if(expectedCount!==undefined){assert.equal(r.n,expectedCount);assert.equal(r.complete,expectedComplete);}
   if(ids===null)assert.equal((await db.query('select bundle::jsonb=public.qa_reference_global_aggregation(null::text[]) same from '+transportView)).rows[0].same,true,'Complete view equals original global membership and exact facts');
  };
  const viewEquivalent=async()=>assert.equal((await db.query('select bundle::jsonb=public.qa_reference_global_aggregation(null::text[]) same from '+transportView)).rows[0].same,true,'View transport preserves every ordered fixture, exact numeric and original clock');
  await viewEquivalent();
  await aggregationEquivalent(null,0);await aggregationEquivalent([],0);await aggregationEquivalent(['missing'],0);
  const equivalent=async ids=>assert.equal((await db.query('select public.nothingsports_read_current_fixture_bundle($1)=public.qa_reference_fixture_bundle($1) as same',[ids])).rows[0].same,true,'Optimised shared read preserves every fixture field and original observation');
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values ('a-calendar'),('z-current');");
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const events=Array.from({length:1200},(_,i)=>({id:'fixture:'+i,status:'scheduled',date:day}));events.push({id:'late-current',key:'tennis',status:'live',date:day},{id:'expired-history',status:'completed',date:'2020-01-01'},{id:'old-live-uncertain',status:'live',date:'2020-01-01'},{id:'unknown-date',status:'scheduled'},{id:'future-outside-horizon',status:'scheduled',date:'2099-01-01'});
  const factAt=new Date(Date.now()-120000).toISOString(),receiptAt=new Date(Date.now()-60000).toISOString();
  events.push({id:'large-parent',kind:'tournament',date:day,status:'scheduled',participants:[{id:'player:1',name:'Player One'}],sourceUrl:'https://example.test/official',canonicalEventId:'canonical:parent',fixtureIdAliases:['alias:parent'],subEvents:Array.from({length:300},(_,i)=>({id:'draw:'+i,detail:'x'.repeat(1000)})),editorialNarrative:'e'.repeat(50000),storyline:{stakes:4},fullSpiel:'full context',selectedSentence:'selected',spiel:'spiel'},
   {id:'team-tie',kind:'fixture',date:day,status:'scheduled',subEvents:[{id:'rubber:1',participants:['player:1','player:2']}],rubbers:[{id:'rubber:1',score:'6-4'}]});
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select case when e->>'id' like 'fixture:%' then 'a-calendar' else 'z-current' end,e->>'id',e,array[e->>'id'],md5(e::text) from jsonb_array_elements($1::jsonb) e",[JSON.stringify(events)]);
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at) values('z-current','large-parent',$1::jsonb,'score',$2::timestamptz)",[JSON.stringify({id:'large-parent',status:'completed',homeScore:2,scoreCheckedAt:factAt,statusCheckedAt:factAt}),factAt]);
  await db.query("update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object('large-parent',jsonb_build_object('s',$1::text,'t',$1::text))) where source_id='z-current'",[receiptAt]);
  await db.exec('set role service_role');let calls=[];
  const request=async(route,{body}={})=>{calls.push(route);if(route==='/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle')return (await db.query('select bundle from '+transportView)).rows;const name=route.split('/').at(-1),parameter=body.p_membership_ids!==undefined?body.p_membership_ids:body.p_fixture_ids,rows=(await db.query(`select * from public.${name}(${parameter!==undefined?'$1':''})`,parameter!==undefined?[parameter]:[])).rows;return name==='nothingsports_read_current_fixture_bundle_json_rows'?rows.map(row=>row[name]):(name.endsWith('_fixture_bundle')||name.endsWith('_fixture_bundle_json'))?rows[0][name]:rows.slice(0,1000);};
  const preparedRead=async(options={},load=request)=>{
   const ids=[...new Set((options.ids||[]).map(String).filter(Boolean))].slice(0,60);
   const scope=options.scope||'global';assert(['global','match-centre'].includes(scope));
   const near=scope==='match-centre'&&!ids.length;
   const route=ids.length?'/rest/v1/rpc/nothingsports_read_current_fixtures':near?'/rest/v1/rpc/nothingsports_read_match_centre_fixture_bundle':'/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle';
   const body=ids.length?{p_fixture_ids:ids}:near?{p_membership_ids:[...new Set((options.preserveIds||[]).map(String))].sort()}:undefined;
   return require('./lib/semantic-snapshot-read')({load,options,resources:[{route:'/rest/v1/rpc/nothingsports_read_fixture_source_health',body:{}},{route,body}]});
  };
  const store={read:preparedRead},global=await store.read(),all=global.flatMap(s=>s.fixtures);
  assert(calls.some(r=>r==='/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle'),'Unselected store uses the computed view directly, not a copied RPC result');
  const originalStore={read:options=>preparedRead(options,async(route,requestOptions)=>route==='/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle'?[{bundle:await request('/rest/v1/rpc/nothingsports_read_current_fixture_bundle',{...requestOptions,body:{p_fixture_ids:null}})}]:request(route,requestOptions))};
  const normalizedOriginal=await originalStore.read();assert.deepEqual(global,normalizedOriginal,'JSON wire and JSONB wire normalize to identical source records and original observations');
  const {contentHash}=require('../lib/live-fixtures');assert.equal(contentHash(global),contentHash(normalizedOriginal),'Object-key order cannot change normalized content hashes');calls.splice(2);

  assert.equal(calls.length,2,'The global read preserves the two-query budget');assert.equal(all.length,1205);assert(all.some(e=>e.id==='late-current'),'A later source survives the transport row ceiling');assert(!all.some(e=>e.id==='expired-history'));assert(!all.some(e=>e.id==='future-outside-horizon'));assert(all.some(e=>e.id==='old-live-uncertain'),'Explicit unresolved play retains the existing active-timeline rule');assert(all.some(e=>e.id==='unknown-date'),'Unknown dates are not deleted');
  const compact=all.find(e=>e.id==='large-parent');for(const field of ['subEvents','editorialNarrative','fullSpiel','selectedSentence','spiel'])assert.equal(compact[field],undefined,'Global parents omit duplicated '+field);assert.deepEqual(compact.storyline,{stakes:4},'Sporting priority metadata survives copy compaction');
  assert.deepEqual(compact.participants,events.at(-2).participants);assert.deepEqual(compact.fixtureIdAliases,['alias:parent']);assert.equal(compact.canonicalEventId,'canonical:parent');assert.equal(compact.sourceUrl,'https://example.test/official');assert.equal(compact.status,'completed');assert.equal(compact.homeScore,2);
  assert.equal(Date.parse(compact.scoreFactObservedAt),Date.parse(factAt));assert.equal(Date.parse(compact.statusFactObservedAt),Date.parse(factAt));assert.equal(Date.parse(compact.scoreCheckedAt),Date.parse(receiptAt));assert.equal(Date.parse(compact.firstConfirmedCompleteAt),Date.parse(factAt));
  assert.deepEqual(all.find(e=>e.id==='team-tie').subEvents,events.at(-1).subEvents,'Real team rubbers remain');assert.deepEqual(all.find(e=>e.id==='team-tie').rubbers,events.at(-1).rubbers);
  for(let read=0;read<7;read++)await equivalent(null);
  await equivalent(['large-parent']);await equivalent(['expired-history','unknown-date']);await equivalent(['missing-fixture']);await equivalent([]);
  // Exercise listing reuse through the actual SQL observation projection and
  // store, rather than only a hand-written snapshot stub.
  const observedNow=Date.now(),current={id:'late-current',key:'tennis',tournamentLevel:'WTA1000',date:day,status:'live',homeParticipantId:'player:one',awayParticipantId:'player:two',startTimeUtc:new Date(observedNow-600000).toISOString(),sets:[{home:6,away:3}],scoreCheckedAt:new Date(observedNow).toISOString(),statusCheckedAt:new Date(observedNow).toISOString()};
  await db.query("update public.nothingsports_fixture_current set fixture=$1::jsonb where fixture_id='late-current'",[JSON.stringify(current)]);
  const {createMatchCentreHandler}=require('../lib/match-centre-handler'),response=()=>({setHeader(){},status(){return this;},json(body){this.body=body;return this;}});
  calls=[];const listing=createMatchCentreHandler({enabled:()=>true,clock:()=>observedNow,published:()=>[],request,snapshotRead:async()=>({sources:await store.read(),readAt:observedNow,stale:false})}),listed=response();await listing({url:'/api/match-centre?membership=everything'},listed);
  assert.equal(calls.length,2,'Fresh listing ends after the existing two parallel membership reads');assert(!calls.some(route=>route.endsWith('nothingsports_read_match_scores')),'No duplicate score query after the real global projection');assert.equal(listed.body.fixtures.length,1);assert.deepEqual(listed.body.fixtures[0].score.sets,[{home:6,away:3}]);assert.equal(listed.body.fixtures[0].stale,false);
  calls=[];const polled=response();await listing({url:'/api/match-centre?ids=late-current'},polled);assert.equal(calls.length,1);assert(calls[0].endsWith('nothingsports_read_match_scores'),'Visible polling retains its selected-only database path');assert.deepEqual(polled.body.fixtures,listed.body.fixtures,'Both actual SQL paths return the same scores, sides, freshness and result provenance');
  const full=(await store.read({ids:['large-parent']})).flatMap(s=>s.fixtures).find(e=>e.id==='large-parent');assert.deepEqual(full.subEvents,events.at(-2).subEvents);assert.equal(full.editorialNarrative,events.at(-2).editorialNarrative);
  const selectedBundle=(await db.query('select public.nothingsports_read_current_fixture_bundle($1) as value',[['large-parent']])).rows[0].value;assert.equal(selectedBundle.rows[0].fixture.subEvents.length,300,'Explicit bundle IDs also retain context');
  await aggregationEquivalent(['large-parent'],1);
  const wireSelected=(await db.query('select public.nothingsports_read_current_fixture_bundle_json($1)::jsonb as value',[['large-parent']])).rows[0].value;assert.equal(wireSelected.rows[0].fixture.subEvents.length,300,'JSON selected IDs retain full parent context');assert.equal(wireSelected.rows[0].fixture.editorialNarrative,events.at(-2).editorialNarrative);
  const ordered=(await db.query('select public.nothingsports_read_current_fixture_bundle(null) as value')).rows[0].value.rows.map(r=>r.source_id+':'+r.fixture_id);assert.deepEqual(ordered,[...ordered].sort(),'Global transfer has deterministic source/fixture order');
  await db.query("update public.nothingsports_fixture_current set fixture=jsonb_set(fixture,'{date}','\"2020-01-01\"') where fixture_id='fixture:0'");
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('a-calendar','fixture:0',$1::jsonb,'date-overlay')",[JSON.stringify({id:'fixture:0',date:day})]);
  assert((await store.read()).flatMap(s=>s.fixtures).some(e=>e.id==='fixture:0'),'Effective score-overlay dates determine retention');
  calls=[];const selected=await store.read({ids:['expired-history']});assert.equal(calls.length,2);assert(selected.flatMap(s=>s.fixtures).some(e=>e.id==='expired-history'),'Explicit selected-ID reads retain archived/source context');assert(calls.some(r=>r.endsWith('nothingsports_read_current_fixtures')));
  // The near read drops only safely distant schedules, never corrections to
  // a known member, live-only arrivals, results, pauses or uncertain clocks.
  const scopedNow=Date.now(),nearStart=new Date(scopedNow+20*60000).toISOString(),farStart=new Date(scopedNow+4*3600000).toISOString(),checkAt=new Date(scopedNow).toISOString();
  const cases=[
   {id:'scope-near',status:'upcoming',startTimeUtc:nearStart},
   {id:'scope-far',status:'scheduled',startTimeUtc:farStart},
   {id:'scope-far-offset',status:'upcoming',startTimeUtc:new Date(scopedNow+4*3600000).toISOString().replace('Z','+00:00')},
   {id:'scope-rescheduled',status:'scheduled',startTimeUtc:farStart},
   {id:'scope-null-time',status:'upcoming',startTimeUtc:null},
   {id:'scope-malformed-time',status:'scheduled',startTimeUtc:'2026-02-30T12:00:00Z'},
   {id:'scope-no-zone',status:'scheduled',startTimeUtc:'2099-01-01T12:00:00'},
   {id:'scope-paused',status:'stumps',startTimeUtc:farStart},
   {id:'scope-final',status:'completed',startTimeUtc:farStart,completedAt:checkAt,homeScore:0,awayScore:0},
   {id:'scope-unknown-state',status:'unreviewed',startTimeUtc:farStart},
   {id:'scope-boundary',status:'scheduled',startTimeUtc:new Date(scopedNow+30.5*60000).toISOString()},
   {id:'scope-overlay-soon',status:'scheduled',startTimeUtc:farStart},
   {id:'scope-overlay-far',status:'scheduled',startTimeUtc:nearStart},
  ].map(e=>({key:'nrl',date:day,homeParticipantId:'team:'+e.id,awayParticipantId:'team:other',scoreCheckedAt:checkAt,statusCheckedAt:checkAt,...e}));
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'z-current',e->>'id',e,array[e->>'id',case when e->>'id'='scope-rescheduled' then 'alias:rescheduled' else e->>'id' end],md5(e::text) from jsonb_array_elements($1::jsonb) e",[JSON.stringify(cases)]);
  for(const [id,start] of [['scope-overlay-soon',nearStart],['scope-overlay-far',farStart]])await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('z-current',$1,jsonb_build_object('id',$1::text,'status','scheduled','startTimeUtc',$2::text),'clock-overlay')",[id,start]);
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'a-calendar','distant:'||i,jsonb_build_object('id','distant:'||i,'date',$1::text,'status','scheduled','startTimeUtc',$2::text),array['distant:'||i],'test' from generate_series(1,1200) i",[day,farStart]);
  calls=[];const nearSnapshot=await store.read({scope:'match-centre',preserveIds:['alias:rescheduled']}),nearEvents=nearSnapshot.flatMap(s=>s.fixtures),nearIds=new Set(nearEvents.map(e=>e.id));
  assert.equal(calls.length,2);assert(calls.some(route=>route.endsWith('nothingsports_read_match_centre_fixture_bundle')));
  for(const id of ['scope-near','scope-rescheduled','scope-null-time','scope-malformed-time','scope-no-zone','scope-paused','scope-final','scope-unknown-state','scope-boundary','scope-overlay-soon','late-current'])assert(nearIds.has(id),'Near read retains '+id);
  assert(!nearIds.has('scope-far'));assert(!nearIds.has('scope-far-offset'));assert(!nearIds.has('scope-overlay-far'));assert(!nearEvents.some(e=>e.id.startsWith('distant:')));
  assert.equal(nearEvents.find(e=>e.id==='scope-final').homeScore,0);assert.equal(nearEvents.find(e=>e.id==='scope-final').awayScore,0);
  assert.equal(nearEvents.find(e=>e.id==='scope-near').startTimeUtc,nearStart);assert.equal(Date.parse(nearEvents.find(e=>e.id==='scope-near').scoreCheckedAt),Date.parse(checkAt),'Reading does not renew original facts');
  const fullFuture=await store.read();assert(fullFuture.flatMap(s=>s.fixtures).some(e=>e.id==='distant:1199'),'Other readers retain the full future horizon');
  const publishedSoon={...cases.find(e=>e.id==='scope-rescheduled'),startTimeUtc:nearStart,fixtureIdAliases:['alias:rescheduled']};let scopeOptions;
  const corrected=createMatchCentreHandler({clock:()=>scopedNow,enabled:()=>true,published:()=>[publishedSoon],request,snapshotRead:async options=>{scopeOptions=options;return {sources:await store.read(options),readAt:scopedNow,stale:false};}}),correctedResponse=response();
  await corrected({url:'/api/match-centre?membership=everything'},correctedResponse);assert.equal(scopeOptions.scope,'match-centre');assert(scopeOptions.preserveIds.includes('scope-rescheduled'));assert(scopeOptions.preserveIds.includes('alias:rescheduled'),'Retained fixture aliases also protect corrective updates');assert(!correctedResponse.body.fixtures.some(e=>e.id==='scope-rescheduled'),'A source reschedule still removes the known upcoming card before pagination');assert(correctedResponse.body.fixtures.some(e=>e.id==='late-current'),'A genuinely new live source member survives the narrow read');
  const model=require('../config/match-centre');assert.deepEqual(model.select(nearEvents,scopedNow).map(model.id),model.select(fullFuture.flatMap(s=>s.fixtures),scopedNow).map(model.id),'Real SQL paths preserve the same current sporting membership');
  await nearEquivalent(null);await nearEquivalent(['alias:rescheduled']);
  await equivalent(null);await equivalent(['alias:rescheduled','scope-overlay-soon','scope-overlay-far']);
  const tooMany=(await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1) as value',[Array.from({length:5001},(_,i)=>'fixture:'+i)])).rows[0].value;assert.equal(tooMany.complete,false,'Invalid identity budget cannot claim a complete empty result');
  // Exclude only the SQL-preparation wrapper from this cache semantics clock.
  // Real outer revision/deadline acceptance is exercised by validate-global-read-budget.
  const healthy=await readLiveSnapshots({store,timer:()=>0,now:Date.now(),maxAgeMs:0});const badStore=createSnapshotStore({request:async(route)=>route.endsWith('bundle')?{schemaVersion:'current-fixture-bundle.v1',complete:false,rows:[]}:[]});const retained=await readLiveSnapshots({store:badStore,now:Date.now()+1,maxAgeMs:0});assert(retained.stale);assert.equal(retained.revision,healthy.revision,'Incomplete bundles keep the last-good shared snapshot');
  await db.exec('reset role');for(const role of ['anon','authenticated'])for(const name of ['nothingsports_read_current_fixture_bundle','nothingsports_read_match_centre_fixture_bundle'])assert.equal((await db.query("select has_function_privilege($1,$2,'execute') as allowed",[role,'public.'+name+'(text[])'])).rows[0].allowed,false);assert.equal((await db.query("select count(*) as n from public.nothingsports_fixture_current")).rows[0].n,2420,'Read filtering preserves stored history');
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'a-calendar','overflow:'||i,jsonb_build_object('id','overflow:'||i,'date',$1::text,'status','scheduled'),array['overflow:'||i],'test' from generate_series(1,4200) i",[day]);const overflow=(await db.query('select public.nothingsports_read_current_fixture_bundle(null) as value')).rows[0].value;assert.equal(overflow.complete,false);assert.equal(overflow.rows.length,5001,'Oversized input is explicitly incomplete, never a silently truncated success');
  const nearOverflow=(await db.query('select public.nothingsports_read_match_centre_fixture_bundle(null) as value')).rows[0].value;assert.equal(nearOverflow.complete,false);assert.equal(nearOverflow.rows.length,5001,'Uncertain near rows retain the explicit incomplete sentinel');
  await nearEquivalent(null);
  await equivalent(null);
  await require('./lib/match-centre-read-rehearsal').run(db);
  // Isolate aggregation edge cases after the unchanged store/near regressions.
  // All numeric equality stays inside PostgreSQL, never JSON.parse/JS Number.
  await db.exec('reset role;truncate public.nothingsports_live_scores,public.nothingsports_fixture_current,public.nothingsports_fixture_snapshots,public.nothingsports_fixture_sources restart identity cascade;');
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('aggregation-a'),('aggregation-z');");
  const edgeAt=new Date(Date.now()-300000).toISOString(),edgeCheck=new Date(Date.now()-60000).toISOString(),futureAt=new Date(Date.now()+3600000).toISOString();
  await db.query(`insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)
   values('aggregation-a','numeric',array['numeric','alias:numeric'],jsonb_build_object(
    'id','numeric','date',$1::text,'status','completed','homeScore',0,'awayScore',-1,
    'large',900719925474099312345678901234567890::numeric,'decimal',12345678901234567890.123456789::numeric,
    'nested',jsonb_build_array(null,0,-3,0.125,jsonb_build_object('empty',jsonb_build_array(),'unicode','🎾 Ελληνικά 日本語','escaped',E'quote"\\line\nnext')),
    'scoreCheckedAt',$2::text,'statusCheckedAt',$3::text,'nullable',null),'edge')`,[day,edgeAt,futureAt]);
  await db.exec('set role service_role;');
  await aggregationEquivalent(null,1);await aggregationEquivalent(['numeric'],1);await aggregationEquivalent(['alias:numeric'],1);await aggregationEquivalent([],0);await aggregationEquivalent(['missing'],0);
  assert.equal((await db.query(`select f->'large'='900719925474099312345678901234567890'::jsonb and f->'decimal'='12345678901234567890.123456789'::jsonb and f->'nullable'='null'::jsonb and f->'homeScore'='0'::jsonb and f->'awayScore'='-1'::jsonb and f->'statusFactObservedAt'='null'::jsonb as exact from (select v->'rows'->0->'fixture' f from (select public.nothingsports_read_current_fixture_bundle_json(null)::jsonb v) q) q`)).rows[0].exact,true,'Full aggregation retains exact large/decimal/negative/zero/nested-null values and future-clock rejection');
  await db.exec('reset role;');
  await db.query(`insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at) values('aggregation-a','numeric',jsonb_build_object('id','numeric','homeScore',0,'awayScore',null,'scoreCheckedAt',$1::text,'statusCheckedAt','invalid'),'edge',$1::timestamptz)`,[edgeAt]);
  await db.query(`update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object('numeric',jsonb_build_object('s',$1::text,'t','2026-01-01T00:00:00'))) where source_id='aggregation-a'`,[edgeCheck]);
  await db.exec('set role service_role;');await aggregationEquivalent(null,1);
  assert.equal((await db.query(`select (f->>'scoreCheckedAt')::timestamptz=$1::timestamptz and (f->>'scoreFactObservedAt')::timestamptz=$2::timestamptz and (f->>'firstConfirmedCompleteAt')::timestamptz=$2::timestamptz and f->'statusCheckedAt'='null'::jsonb and f->'awayScore'='null'::jsonb as exact from (select v->'rows'->0->'fixture' f from (select public.nothingsports_read_current_fixture_bundle_json(null)::jsonb v) q) q`,[edgeCheck,edgeAt])).rows[0].exact,true,'Receipt/fact/first-completion, missing/invalid/no-zone/future clocks and explicit null scores survive exactly');
  await db.exec('reset role;');
  await db.exec('begin;');
  await db.query(`update public.nothingsports_live_scores set score=score||jsonb_build_object('scoreCheckedAt','invalid-shared-clock','statusCheckedAt','invalid-shared-clock') where source_id='aggregation-a' and fixture_id='numeric'`);
  await db.query(`update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object('numeric',jsonb_build_object('s','invalid-shared-clock','t','invalid-shared-clock'))) where source_id='aggregation-a'`);
  await aggregationEquivalent(null,1);
  assert.equal((await db.query(`select (f->>'scoreCheckedAt')::timestamptz=$1::timestamptz and f->'statusCheckedAt'='null'::jsonb as exact from (select public.nothingsports_read_current_fixture_bundle_json(null)::jsonb->'rows'->0->'fixture' f) q`,[edgeAt])).rows[0].exact,true,'Invalid shared timestamps fall back to valid base facts; JSON null never blocks coalesce');
  await db.exec('rollback;');
  await db.exec("begin;set local timezone='Pacific/Auckland';set local role service_role;");await aggregationEquivalent(null,1);await db.exec('rollback;');
  // Malformed maps must keep the original two text-key JSON operators: numeric
  // fixture IDs must never turn an array into an indexed receipt lookup.
  await db.query(`insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) values('aggregation-z','0',array['0'],jsonb_build_object('id','0','date',$1::text),'edge')`,[day]);
  for(const map of [null,[],[{s:edgeCheck}],0,'malformed',{0:{s:edgeCheck,t:edgeAt}}]){
   await db.query(`update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',$1::jsonb) where source_id='aggregation-z'`,[JSON.stringify(map)]);
   await db.exec('set role service_role;');await aggregationEquivalent(null,2);await aggregationEquivalent(['0'],1);await db.exec('reset role;');
  }
  await db.exec("delete from public.nothingsports_fixture_current where source_id='aggregation-z';update public.nothingsports_fixture_sources set discovery_report='{}' where source_id='aggregation-z';");
  const compactViewDefinition='create or replace view '+transportMigration.split('create view ')[1].split('revoke all on ')[0];
  assert.equal((compactViewDefinition.match(/r\.receipts->c\.fixture_id/g)||[]).length,2,'Receipt counterexample must mutate the actual current query owner');
  await db.exec('begin;'+compactViewDefinition.replaceAll('r.receipts->c.fixture_id',"'{}'::jsonb"));
  await assert.rejects(aggregationEquivalent(null,1),/Whole ordered JSONB output/,'Equivalence detects a lost original receipt');await db.exec('rollback;');
  await db.query(`insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)
   select case when i%2=0 then 'aggregation-a' else 'aggregation-z' end,'ordered:'||lpad(i::text,5,'0'),array['ordered:'||lpad(i::text,5,'0')],jsonb_build_object('id','ordered:'||i,'date',$1::text,'status','scheduled','storyline',jsonb_build_object('stakes',4),'subEvents',jsonb_build_array(jsonb_build_object('id','rubber:'||i))),'edge' from generate_series(1,4999) i`,[day]);
  await db.exec('set role service_role;');await aggregationEquivalent(null,5000,true);
  await aggregationEquivalent(['numeric','alias:numeric','ordered:00001','ordered:04999'],3,true);
  await db.exec('reset role;');
  await db.query(`insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) values('aggregation-z','zz:overflow',array['zz:overflow'],jsonb_build_object('id','zz:overflow','date',$1::text),'edge')`,[day]);
  await db.exec('set role service_role;');await aggregationEquivalent(null,5001,false);
  await aggregationEquivalent([],0,true);await aggregationEquivalent(['zz:overflow'],1,true);
  await db.exec('reset role;');
  for(const role of ['anon','authenticated']){
   assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,wireSignature])).rows[0].allowed,false);
   await db.exec('set role '+role+';');await assert.rejects(db.query('select public.nothingsports_read_current_fixture_bundle_json(null)::jsonb'),/permission denied/);await db.exec('reset role;');
  }
  await db.exec('set role service_role;');await aggregationEquivalent(null,5001,false);await db.exec('reset role;');
  assert.deepEqual(await globalAttributes(),originalAttributes);
  console.log(JSON.stringify({schemaVersion:'global-aggregation-regression.v1',readerMd5:(await db.query('select md5(pg_get_functiondef($1::regprocedure)) digest',[wireSignature])).rows[0].digest,projectorMd5:(await db.query("select md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)) digest")).rows[0].digest,exactNumericComparison:'PostgreSQL JSONB equality',cardinalityCases:[0,1,5000,5001],productionRequests:0}));
  for(const role of ['anon','authenticated']){
   assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,rowSignature])).rows[0].allowed,false);await db.exec('set role '+role+';');await assert.rejects(db.query('select * from public.nothingsports_read_current_fixture_bundle_json_rows(null)'),/permission denied/);await db.exec('reset role;');
  }
  await db.exec('set role service_role;');await aggregationEquivalent(null,5001,false);await db.exec('reset role;');
  assert.equal((await db.query('select md5(pg_get_functiondef($1::regprocedure)) digest',[globalSignature])).rows[0].digest,'ef1658b2eb58a376f368ede88730ad43');
  assert.notEqual((await db.query('select md5(pg_get_functiondef($1::regprocedure)) digest',[wireSignature])).rows[0].digest,'a15bc809eaf15601a52855cb667f7b9f','Compact scalar is installed in the actual reader used throughout the regression');
  console.log(JSON.stringify({schemaVersion:'global-json-row-regression.v1',rowDigest:(await db.query('select md5(pg_get_functiondef($1::regprocedure)) digest',[rowSignature])).rows[0].digest,rowsHint:1,oneRowCardinality:true,exactSQLNumericEquality:true,oldDependenciesUnchanged:true,productionCalls:0}));
  if(pgMajor===17){
   // Pressure the real prior/current RPC caller with the same wide factual rows.
   // Only temporary-work counts are gated; noisy execution times are not.
   await db.exec("begin;set local work_mem='2184kB';set local statement_timeout='3s';update public.nothingsports_fixture_current set fixture=fixture||jsonb_build_object('qaWideFact',repeat('x',2048));");
   const plan=async name=>(await db.query('explain(analyze,buffers,format json,timing off) select value from public.'+name+'(null::text[]) t(value)')).rows[0]['QUERY PLAN'][0];
   const baseline=await plan('qa_previous_global_rows'),current=await plan('nothingsports_read_current_fixture_bundle_json_rows');
   const check=actual=>assert(actual.Plan['Temp Written Blocks']<baseline.Plan['Temp Written Blocks'],'Global RPC must avoid the extra whole-result materialisation');
   check(current);await aggregationEquivalent(null,5001,false);
   const currentRows=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[rowSignature])).rows[0].definition;
   await db.exec(ownershipBeforeRows.replace('public.nothingsports_read_current_fixture_bundle_json(', 'public.qa_previous_global_scalar('));
   await assert.rejects((async()=>check(await plan('nothingsports_read_current_fixture_bundle_json_rows')))(),/extra whole-result materialisation/,'Restoring the actual old caller chain must fail the temporary-work regression');
   await db.exec(currentRows);await db.exec('rollback;');
   console.log(JSON.stringify({schemaVersion:'global-pg17-copy-regression.v1',pgMajor,rows:5001,baselineTempBlocks:baseline.Plan['Temp Written Blocks'],currentTempBlocks:current.Plan['Temp Written Blocks'],negativeControl:true,productionCalls:0}));
  }
  if(pgMajor===17){
   await db.exec("begin;set local work_mem='2184kB';set local statement_timeout='3s';update public.nothingsports_fixture_current set fixture=fixture||jsonb_build_object('qaRetainedFact',repeat(md5(fixture_id),64));");
   const inlineDefinition=indexedDefinition;
   const currentTransportDefinition=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[rowSignature])).rows[0].definition;
   assert.equal((inlineDefinition.match(/projected as not materialized/g)||[]).length,1);
   const spooledDefinition=inlineDefinition.replace('projected as not materialized','projected as materialized');
   await db.exec(spooledDefinition.replace('public.nothingsports_read_current_fixture_bundle_json_rows(', 'public.qa_spooled_global_rows('));
   await db.exec('revoke all on function public.qa_spooled_global_rows(text[]) from public,anon,authenticated;grant execute on function public.qa_spooled_global_rows(text[]) to service_role;');
   const framePlan=async name=>(await db.query("explain(analyze,buffers,format json,timing off) select coalesce(json_agg(t.value),'[]'::json) from public."+name+'(null::text[]) t(value)')).rows[0]['QUERY PLAN'][0];
   const spooled=await framePlan('qa_spooled_global_rows'),inline=await framePlan('nothingsports_read_current_fixture_bundle_json_rows');
   const checkSpool=actual=>assert(actual.Plan['Temp Written Blocks']<spooled.Plan['Temp Written Blocks'],'Global RPC frame must avoid duplicate compact projection spooling');
   checkSpool(inline);await aggregationEquivalent(null,5001,false);
   await db.exec(spooledDefinition);await assert.rejects((async()=>checkSpool(await framePlan('nothingsports_read_current_fixture_bundle_json_rows')))(),/duplicate compact projection spooling/,'Restoring the actual materialized projection must fail the work regression');
   await db.exec(currentTransportDefinition);await db.exec('rollback;');
   console.log(JSON.stringify({schemaVersion:'global-pg17-projection-spool-regression.v1',pgMajor,rows:5001,spooledTempBlocks:spooled.Plan['Temp Written Blocks'],inlineTempBlocks:inline.Plan['Temp Written Blocks'],restoredActualReaderNegative:true,productionCalls:0}));
  }
  if(pgMajor===17){
   await db.exec("begin;set local work_mem='2184kB';set local statement_timeout='3s';update public.nothingsports_fixture_current set fixture=fixture||jsonb_build_object('qaViewFact',repeat(md5(fixture_id),64));");
   await db.exec(indexedDefinition.replace('public.nothingsports_read_current_fixture_bundle_json_rows(', 'public.qa_before_view_rows('));
   const viewDefinition=(await db.query('select pg_get_viewdef($1::regclass,true) definition',[transportView])).rows[0].definition;
   const viewFrame="with pgrst_source as(select bundle from "+transportView+" limit 1000 offset 0) select coalesce(json_agg(t),'[]'::json) from(select * from pgrst_source) t";
   const rpcFrame="with pgrst_source as(select public.qa_before_view_rows(null::text[]) value) select coalesce(json_agg(value),'[]'::json) from pgrst_source";
   const framedPlan=async q=>(await db.query('explain(analyze,buffers,format json,timing off) '+q)).rows[0]['QUERY PLAN'][0];
   const baseline=await framedPlan(rpcFrame),direct=await framedPlan(viewFrame);
   const checkView=actual=>assert(actual.Plan['Temp Written Blocks']<baseline.Plan['Temp Written Blocks'],'Direct view frame must avoid the RPC whole-result spool');
   checkView(direct);await viewEquivalent();
   await db.exec('create or replace view '+transportView+' with(security_invoker=true) as select public.qa_before_view_rows(null::text[]) bundle;');
   await assert.rejects((async()=>checkView(await framedPlan(viewFrame)))(),/RPC whole-result spool/,'Restoring an RPC result behind the view must fail the actual frame regression');
   await db.exec('create or replace view '+transportView+' with(security_invoker=true) as '+viewDefinition);await viewEquivalent();await db.exec('rollback;');
   console.log(JSON.stringify({schemaVersion:'global-pg17-view-transport-regression.v1',pgMajor,rows:5001,rpcTempBlocks:baseline.Plan['Temp Written Blocks'],viewTempBlocks:direct.Plan['Temp Written Blocks'],actualSpoolingNegative:true,productionCalls:0}));
  }
  console.log(JSON.stringify({schemaVersion:'global-reader-owner-contract.v1',pgMajor,scalarMd5:(await db.query('select md5(pg_get_functiondef($1::regprocedure)) digest',[wireSignature])).rows[0].digest,rowsMd5:(await db.query('select md5(pg_get_functiondef($1::regprocedure)) digest',[rowSignature])).rows[0].digest,unchangedOtherContracts:true,productionCalls:0}));
  console.log('Global aggregation: exact SQL numerics/whole-output NULL, empty, alias, selected, 0/1/5000/5001, clocks/nulls/Unicode, replay/mismatch/security guards and unchanged ACL passed.');
  console.log('Global/near transfer beyond 1000 rows, preserved current membership and reschedules, uncertain clocks, parent/detail isolation, observations/aliases/rubbers, score-overlay retention, two-read budget, degraded fallback, service-only access and complete SQL equivalence passed.');
 }finally{await db.close();}
 require('node:child_process').execFileSync(process.execPath,['scripts/validate-match-centre-snapshot-scope.js'],{stdio:'inherit'});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
