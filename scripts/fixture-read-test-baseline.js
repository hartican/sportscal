'use strict';
// Disposable test databases only. Keep the historical factory unchanged: its
// older starting point is required by the original migration regressions.
const assert=require('node:assert/strict'),fs=require('node:fs');
const migrations=[
 '20261017000518_bound_fixture_snapshot_query_work.sql',
 '20261017004415_defer_match_fixture_payload.sql',
 '20261019034530_include_source_terminal_match_window.sql',
 '20261019010303_add_global_fixture_json_reader.sql',
 '20261019023712_add_global_fixture_json_rows_reader.sql',
 '20261020153215_compact_global_fixture_read_inputs.sql',
 '20261020162724_batch_global_fixture_observation_times.sql',
 '20261020165006_separate_global_and_selected_fixture_key_scopes.sql',
 '20261020171222_let_global_row_reader_own_aggregation.sql',
 '20261020173831_store_global_fixture_projection_with_current_facts.sql',
 '20261020181208_avoid_duplicate_global_fixture_projection_spooling.sql',
 '20261020182931_reuse_existing_calendar_index_for_global_admission.sql',
 '20261020192228_inline_global_fixture_bundle_transport.sql',
 '20261020195509_reuse_stored_match_centre_seed_base.sql'
];
const read=name=>fs.readFileSync('supabase/migrations/'+name,'utf8');
async function database(){
 const db=await require('./validate-profile-fixture-scope').database();
 try{
  const major=Math.floor(Number((await db.query("select current_setting('server_version_num') n")).rows[0].n)/10000);
  assert.equal(major,process.env.PGLITE_MODULE==='pglite-pg17'?17:18,'Assert the actual pinned engine, not a directory label');
  // The historical factory intentionally predates the current publisher.
  await db.exec(read('20261012113815_expire_unchanged_fixture_history.sql').match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/)[0]);
  for(const name of migrations)await db.exec('begin;'+read(name)+'commit;');
  const expected=[
   ['public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])','df1f9773b0f210c122f6c55fe8425f3c'],
   ['public.nothingsports_read_match_centre_fixture_bundle(text[])','d9b49086166c24b3a10b4dc1f7279b7c'],
   ['nothingsports_fixture_read_private.sync_fixture(text,text)','3c20e52d95ebda90af1bb15369939738'],
   ['nothingsports_fixture_read_private.sync_trigger()','6ad06f6cdab54b2eea83c993d094c160']
  ];
  for(const [signature,digest]of expected)assert.equal((await db.query('select md5(pg_get_functiondef($1::regprocedure)) h',[signature])).rows[0].h,digest,signature);
  assert.equal((await db.query("select md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) h")).rows[0].h,'fbc28299a5bf25428b286adc5ee2e0da');
  return db;
 }catch(error){await db.close();throw error;}
}
module.exports={database,migrations};
