#!/usr/bin/env node
'use strict';
// Read-only operator checkpoint. Never starts erasure or deletes data.
const {supabaseServiceRequest}=require('../lib/supabase-server');
const {storageCheckpoint}=require('../lib/account-erasure-storage');
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--user'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(args[1]))throw Error('Usage: node scripts/account-erasure-storage-checkpoint.js --user UUID');
 const rows=await supabaseServiceRequest(`/rest/v1/nothingsports_account_erasure_blocks?user_id=eq.${args[1]}&select=started_at`);
 if(rows?.length!==1)throw Error('No committed erasure marker; cannot infer a safe Storage checkpoint.');
 console.log(JSON.stringify(storageCheckpoint(rows[0].started_at),null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
