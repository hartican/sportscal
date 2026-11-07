'use strict';
const server=require('./nothingscore-server'),{supabaseServiceRequest}=require('./supabase-server');
const {guardedSend,suppressed}=require('./notification-send'),{workers}=require('./reminder-dispatch-budget');
const identity=require('../config/event-action-identity'),fixtureIdentity=require('../config/fixture-identity');
const MAX_ACCOUNTS=20,MAX_FIXTURES=100,MAX_SELECTED_FIXTURES=60;
// Reserve the unchanged three-second bound for begin, the erasure lease,
// provider contact and both receipts before marking delivery as started.
const SEND_RESERVE_MS=5*3000+250,CLAIM_RESERVE_MS=3000+SEND_RESERVE_MS;
const rpc=(name,body,request)=>request('/rest/v1/rpc/nothingsports_impact_'+name,{method:'POST',body});
function observation(event,now=new Date()){
 const source=event?.statusSourceUrl||event?.statusSource?.sourceUrl||event?.resultSourceUrl||event?.sourceUrl;
 const checked=event?.statusCheckedAt||event?.scoreCheckedAt||event?.sourceCheckedAt||event?.statusFactObservedAt;
 if(!event||!/^https:\/\/[^/@\s]+(?:\/|$)/.test(source||'')||!Number.isFinite(Date.parse(checked))||Date.parse(checked)>+now)return null;
 const completed=require('./nsc-crowd').phaseFor(event,now)==='impact';
 let finished=require('../config/match-centre').completion(event);
 // Reviewed final projections retain their original result receipt separately
 // from schedule/source rechecks. It is confirmation evidence, not finish time.
 if(!Number.isFinite(finished)){
  const receipt=Date.parse(event.resultFactObservedAt||event.resultSourceCheckedAt||''),lastDay=event.endDate||event.date,end=/^\d{4}-\d{2}-\d{2}$/.test(lastDay||'')?Date.parse(lastDay+'T23:59:59Z'):NaN;
  if(Number.isFinite(receipt)&&(!Number.isFinite(end)||receipt<=end+86400000))finished=receipt;
 }
 if(completed&&(!Number.isFinite(finished)||finished>Date.parse(checked)||event.startTimeUtc&&finished<Date.parse(event.startTimeUtc)))return null;
 return {event_id:fixtureIdentity.canonicalFixtureId(event.canonicalEventId||event.eventId||event.id),aliases:identity.aliasesForEvent(event),completed,completion_at:completed?new Date(finished).toISOString():null,source_checked_at:new Date(checked).toISOString(),source_url:source,title:String(event.name||event.displayTitleCompact||'Sporting fixture').slice(0,180)};
}
function packets(inventory,events,now=new Date()){
 if(!Array.isArray(inventory.accounts)||inventory.accounts.length>MAX_ACCOUNTS||!Array.isArray(inventory.fixtures)||inventory.fixtures.length>MAX_FIXTURES)throw Error('Invalid Impact inventory');
 const wanted=new Map(inventory.fixtures.map(f=>[f.eventId,f]));
 const records=events.map(event=>({event,proof:observation(event,now)})).filter(({proof})=>proof&&wanted.has(proof.event_id)&&!(Date.parse(proof.source_checked_at)<Date.parse(wanted.get(proof.event_id).sourceCheckedAt)));
 if(new Set(records.map(r=>r.proof.event_id)).size!==records.length)throw Error('Duplicate canonical Impact fixture');
 const pipeline=require('./server-feed-pipeline'),tennis=require('../data/tennis-feed-parents.v1.json');
 // The same admission/lifecycle classifier runs on one shared bounded set, never
 // a catalogue/provider read for each recipient or a temporary browsing filter.
 const scope={...tennis,parents:[],contests:[]};
 return {observations:records.map(r=>r.proof),packets:inventory.accounts.map(a=>{
  const checked=records.map(r=>r.proof.event_id),actions=identity.migrateActions(a.actions||{}),state={preferences:a.preferences,event_user_state:actions,archived_events:a.archivedEvents||[],updated_at:a.updatedAt},archived=pipeline.archivedEventIds(state),feed=pipeline.buildServerFeed({events:records.map(r=>r.event),userId:a.userId,userState:state,now,limit:MAX_FIXTURES,tennisProjection:scope});
  const admitted=feed.events.filter(event=>{const action=pipeline.eventActionFor(event,actions);return !action.dismissed&&!action.archived&&!action.isPurged&&!identity.aliasesForEvent(event).some(id=>archived.has(id));});
  return {user_id:a.userId,expected_updated:a.updatedAt,checked_ids:checked,eligible_ids:admitted.map(e=>fixtureIdentity.canonicalFixtureId(e.canonicalEventId||e.eventId||e.id)).filter(id=>checked.includes(id))};
 })};
}
function payload(batch,id){
 const single=batch.kind==='immediate',event=batch.items[0];
 return {title:single?'Rate the Impact':'Your Impact ratings',body:single?`${event.title} has finished. How much did it matter?`:`${batch.items.length} fixture${batch.items.length===1?' is':'s are'} ready for your Impact rating.`,tag:'ns-impact-'+id,url:single?'/?impactRequest='+encodeURIComponent(event.eventId):'/?impactInbox='+batch.day};
}
async function loadFixtures(ids,{api=server,request=supabaseServiceRequest,loadCatalogue,now=new Date()}={}){
 const shared=loadCatalogue?await loadCatalogue():null,resolved=new Map();
 for(const id of ids){const event=shared?.resolve(id);if(event&&(observation(event,now)?.completed||Date.parse(event.statusCheckedAt||'')>=+now-300000))resolved.set(id,event);}
 const missing=ids.filter(id=>!resolved.has(id));
 if(missing.length>MAX_SELECTED_FIXTURES)throw Error('Impact missing fixture read exceeds 60-ID capacity');
 if(missing.length){
  const receipt=await api.refreshEventSnapshots(missing,{request});
  const canonical=id=>api.canonicalEventId?api.canonicalEventId(id):fixtureIdentity.canonicalFixtureId(id);
  const checked=new Set(receipt?.stale===false&&Array.isArray(receipt.checkedIds)?receipt.checkedIds:[]);
  for(const id of missing)if(checked.has(canonical(id))){const event=api.eventFor(id);if(event)resolved.set(id,event);}
 }
 return ids.map(id=>resolved.get(id)).filter(Boolean);
}
async function dispatch({now=new Date(),request=supabaseServiceRequest,send,budget={remaining:()=>27000},load=loadFixtures,loadCatalogue,clock=()=>require('node:perf_hooks').performance.now(),diagnostic=()=>{}}={}){
 const deferred=()=>({checked:0,sent:0,failed:0,deferred:'dispatch_deadline'});
 if(budget.remaining()<8000)return deferred();
 const totals={checked:0,sent:0,failed:0,skipped:0};let degraded=false;
 // This boundary accepts fixed phase names only. Never forward arbitrary SQL,
 // provider messages, paths, payloads, recipients or claim identifiers to logs.
 const codes=new Set(['supabase_timeout','dispatch_deadline','notification_send_not_started','notification_send_uncertain','57014','55P03','40001','40P01','42501','PGRST202']);
 const measure=async(phase,operation)=>{
  const started=clock();let failure;
  try{return await operation();}catch(error){failure=error;throw error;}finally{
   const elapsedMs=Math.max(0,Math.round(clock()-started));
   if(!suppressed(failure)&&(failure||elapsedMs>=2000)){
    const code=failure?.payload?.code||failure?.code,status=Number(failure?.status||failure?.statusCode);
    try{diagnostic({phase,outcome:failure?'failed':'slow',code:codes.has(code)?code:failure?'impact_phase_failed':undefined,status:Number.isInteger(status)&&status>=400&&status<=599?status:undefined,elapsedMs,remainingMs:Math.max(0,Math.round(budget.remaining()))});}catch(_error){}
   }
  }
 };
 const trackedRequest=(path,options)=>{
  const name=path.split('/').at(-1),phase={nothingsports_impact_inventory:'inventory',nothingsports_impact_reconcile:'reconcile',nothingsports_impact_claim:'claim',nothingsports_impact_begin:'begin',nothingsports_impact_finish:'finish',nothingsports_begin_notification_send:'notification_admission'}[name]||(path.startsWith('/rest/v1/nothingsports_notification_send_leases?')?'provider_receipt':path.startsWith('/rest/v1/nothingsports_push_installations?')?'installation_cleanup':null);
  return phase?measure(phase,()=>request(path,options)):request(path,options);
 };
 try{
 const inventory=await rpc('inventory',{},trackedRequest);
 await measure('inventory_validation',()=>{if(!inventory||!Array.isArray(inventory.accounts)||inventory.accounts.length>MAX_ACCOUNTS||!Array.isArray(inventory.fixtures)||inventory.fixtures.length>MAX_FIXTURES)throw Error('Invalid Impact inventory');});
 if(!inventory.accounts.length||!inventory.fixtures.length)return totals;
 const events=await measure('load_fixtures',()=>load(inventory.fixtures.map(f=>f.eventId),{request:trackedRequest,now,loadCatalogue}));
 if(budget.remaining()<5000)return deferred();
 const prepared=await measure('prepare',()=>packets(inventory,events,now));
 await rpc('reconcile',prepared,trackedRequest);
 if(budget.remaining()<CLAIM_RESERVE_MS)return deferred();
 const claims=await rpc('claim',{},trackedRequest);
 await measure('claim_inventory',()=>{if(!Array.isArray(claims)||claims.length>2)throw Error('Invalid Impact delivery inventory');});
 totals.checked=claims.length;
 await workers(claims,async claim=>{
  const args={batch:claim.batch_id,installation:claim.installation_id,token:claim.claim_token};let outcome='pending',failed=false;
  try{
   if(budget.remaining()<SEND_RESERVE_MS)return;
   const batch=await rpc('begin',args,trackedRequest);if(!batch?.items?.length){totals.skipped++;return;}
   await measure('guarded_send',()=>guardedSend({installationId:claim.installation_id,expectedUserId:claim.user_id,request:trackedRequest,send:send&&((...args)=>measure('provider',()=>send(...args))),payload:JSON.stringify(payload(batch,claim.batch_id)),options:{TTL:3600,urgency:'normal',timeout:3000}}));totals.sent++;outcome='sent';
  }catch(error){
   if(suppressed(error)){totals.skipped++;outcome='suppressed';}
   else{totals.failed++;failed=true;degraded=true;const code=Number(error.statusCode);outcome=code>=500||code===429||error.code==='notification_send_not_started'?'pending':code?'failed':'uncertain';if(code===404||code===410)await trackedRequest('/rest/v1/nothingsports_push_installations?'+new URLSearchParams({installation_id:'eq.'+claim.installation_id,user_id:'eq.'+claim.user_id}),{method:'DELETE'});}
  }finally{
   try{
    if(budget.remaining()<=250)await measure('finish',()=>{throw Object.assign(Error('Impact receipt deadline reached'),{code:'dispatch_deadline'});});
    else await rpc('finish',{...args,outcome},trackedRequest);
   }catch(_error){if(!failed)totals.failed++;degraded=true;}
  }
 },2);
 }catch(error){
  if(error?.code==='dispatch_deadline'&&!totals.checked)return {...totals,deferred:'dispatch_deadline'};
  degraded=true;
 }
 return {...totals,...(degraded?{error:'impact_request_dispatch_failed'}:{})};
}
module.exports={observation,packets,payload,dispatch,loadFixtures,MAX_ACCOUNTS,MAX_FIXTURES,MAX_SELECTED_FIXTURES};
