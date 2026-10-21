'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const migration=()=>fs.readFileSync('supabase/migrations/20261021110051_read_canonical_match_centre_seed_fields.sql','utf8');
const undo=()=>fs.readFileSync('scripts/sql/rollback-match-centre-direct-seeds.sql','utf8');
const signature='public.nothingsports_read_match_centre_fixture_bundle(text[])';
async function definition(db){return(await db.query('select pg_get_functiondef($1::regprocedure) d',[signature])).rows[0].d;}
async function assertDirectScans(db){
 const body=(await db.query('select prosrc from pg_proc where oid=$1::regprocedure',[signature])).rows[0].prosrc.replaceAll('p_membership_ids',"'{}'::text[]");
 const plan=(await db.query('explain(format json) '+body)).rows[0]['QUERY PLAN'][0];
 let stages=0;
 const noDescriptor=n=>{assert.notEqual(n['Relation Name'],'fixture_context','Initial near scans must not rebuild descriptor selection');for(const c of n.Plans||[])noDescriptor(c);};
 const visit=n=>{if(['CTE seed_inputs','CTE lookup'].includes(n['Subplan Name'])){stages++;noDescriptor(n);}for(const c of n.Plans||[])visit(c);};visit(plan.Plan);
 assert.equal(stages,2,'Real seed and lookup stages must both be inspected; recursive context remains indexed');
}
async function activate(db){
 const before=await definition(db);
 for(const change of ['alter function '+signature+' immutable','grant execute on function '+signature+' to public','grant service_role to anon','revoke execute on function '+signature+' from service_role','alter table public.nothingsports_fixture_current alter column global_fixture drop expression','alter table public.nothingsports_fixture_current disable row level security']){
  await db.exec('begin;'+change);await assert.rejects(db.exec(migration()),/differs from reviewed baseline|differs from private service boundary/);await db.exec('rollback;');
 }
 await db.exec('begin;'+migration()+'commit;');await assertDirectScans(db);
 await db.exec('begin;'+before);await assert.rejects(assertDirectScans(db),/descriptor selection/);await db.exec('rollback;');
 await db.exec('begin;');await assert.rejects(db.exec(migration()),/differs from reviewed baseline/);await db.exec('rollback;');
 return definition(db);
}
async function roundTrip(db,equal){
 const before=(await db.query('select count(*) n from public.nothingsports_fixture_current')).rows[0].n;
 await db.exec('begin;'+undo()+'commit;');
 assert.equal((await db.query('select md5(pg_get_functiondef($1::regprocedure)) h',[signature])).rows[0].h,'d9b49086166c24b3a10b4dc1f7279b7c');await equal();
 await db.exec('begin;'+migration()+'commit;');await equal();await assertDirectScans(db);
 assert.equal((await db.query('select count(*) n from public.nothingsports_fixture_current')).rows[0].n,before,'Committed undo/reapply cannot remove canonical facts');
}
module.exports={activate,roundTrip};
