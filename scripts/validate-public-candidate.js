'use strict';
const assert=require('node:assert/strict');
function run(){
 const {parseOptions}=require('./update-cards');
 assert.throws(()=>parseOptions(['--public-candidate','--candidate-input=/not-read','--candidate-output=/not-created'],{SUPABASE_SECRET_KEY:'synthetic-only'}),/CANDIDATE_CREDENTIAL/,'A preparation process must refuse managed credentials before any input read or write');
 console.log('Public candidate credential preflight passed.');
}
if(require.main===module)run();
module.exports={run};
