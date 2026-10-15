'use strict';
const fs=require('node:fs');
async function installPartitionedReads(db){
 // This suite also exercises retained reader prototypes. Temporarily install
 // the reviewed guard baselines, then restore both functions under test after
 // the real additive transport and its metadata are installed.
 const signatures=['public.nothingsports_read_current_fixture_bundle(text[])','public.nothingsports_read_match_centre_fixture_bundle(text[])'];
 const definitions=[];for(const signature of signatures)definitions.push((await db.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition);
 await db.exec(fs.readFileSync('supabase/migrations/20261009041722_compact_public_fixture_bundle.sql','utf8'));
 await db.exec('BEGIN;'+fs.readFileSync('supabase/migrations/20261012133505_qualify_match_centre_read_candidates.sql','utf8')+'COMMIT;');
 for(const suffix of ['_scope_participant_fixture_reads.sql','_prepare_participant_fixture_context.sql','_index_participant_fixture_context.sql','_partition_current_fixture_bundle.sql','_reuse_fixture_part_work.sql','_serialize_fixture_part_response.sql','_stabilize_fixture_part_plan.sql','_index_required_fixture_selection.sql','_defer_fixture_payload_projection.sql','_combine_fixture_index_integrity_checks.sql','_enforce_fixture_index_integrity_at_commit.sql','_index_fixture_calendar_selection.sql','_group_fixture_source_sport_keys.sql','_index_match_centre_linked_lookup.sql']){
  const file=fs.readdirSync('supabase/migrations').find(name=>name.endsWith(suffix));
  if(!file)throw Error('Missing fixture read migration '+suffix);
  await db.exec('BEGIN;'+fs.readFileSync('supabase/migrations/'+file,'utf8')+'COMMIT;');
 }
 for(const definition of definitions)await db.exec(definition);
}
module.exports={installPartitionedReads};
