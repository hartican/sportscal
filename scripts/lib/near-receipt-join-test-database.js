'use strict';
// Opt in to the actual indexed reader; historical factories keep their original contracts.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
async function database(){
 const db=await require('./near-selection-test-database').database();
 try{
  const expected=require('../fixtures/near-selection-contracts.json');
  const sql=fs.readFileSync('supabase/migrations/20261024115500_index_match_centre_selection.sql','utf8');
  assert.equal(crypto.createHash('sha256').update(sql).digest('hex'),'37ed52b20aeae5f99951965b6c497a226762a99481f51703e5572820531ac485');
  await db.exec(sql);
  await require('./near-selection-regression').contracts(db,expected.candidate);
  return db;
 }catch(error){await db.close();throw error;}
}
module.exports={database};
