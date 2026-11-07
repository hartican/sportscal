'use strict';
// Explicit opt-in to the current coalesced writer; historical factory stays unchanged.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
async function database(){
 const db=await require('../fixture-read-test-baseline').database();
 try{
  const expected=require('../fixtures/canonical-context-batch-contracts.json'),sql=fs.readFileSync('supabase/migrations/20261022234325_coalesce_canonical_fixture_context.sql','utf8');assert.equal(crypto.createHash('sha256').update(sql).digest('hex'),expected.installSha256);await db.exec(sql);
  for(const item of expected.candidate){const row=(await db.query("select jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig) contract from pg_proc p where p.oid=to_regprocedure($1)",[item.signature])).rows[0];assert.deepEqual(row?.contract,item.contract,item.signature);}
  return db;
 }catch(e){await db.close();throw e;}
}
module.exports={database};
