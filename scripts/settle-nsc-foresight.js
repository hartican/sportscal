#!/usr/bin/env node
'use strict';
const server=require('../lib/nothingscore-server'),{supabaseServiceRequest}=require('../lib/supabase-server'),{allRows}=require('../lib/nsc-rankings');
(async()=>{
 const revisions=await allRows('nothingsports_nsc_prediction_revisions',{select:'event_id'});let total=0;
 for(const id of new Set(revisions.map(r=>r.event_id))){const event=server.eventFor(id);if(!event||!['completed','finished','final','cancelled','canceled','abandoned'].includes(event.status))continue;
 // Completion must be confirmed by the source, not inferred merely from elapsed duration.
 const end=event.resultPublishedAt || event.statusUpdatedAt || event.endTimeUtc;
 if(!end||Date.parse(end)>Date.now()-48*3600000)continue;
 total+=Number(await supabaseServiceRequest('/rest/v1/rpc/nothingsports_nsc_settle_foresight',{method:'POST',body:{target_event_id:id,confirmed_end:end,final_status:event.status}}))||0;
 }
 await supabaseServiceRequest('/rest/v1/rpc/nothingsports_nsc_sync_rewards',{method:'POST',body:{}});
 console.log(`Settled ${total} foresight predictions.`);
})().catch(e=>{console.error(e.message);process.exitCode=1});
