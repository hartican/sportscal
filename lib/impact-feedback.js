'use strict';
const server=require('./nothingscore-server'),{supabaseServiceRequest}=require('./supabase-server');
const {guardedSend,suppressed}=require('./notification-send'),{workers}=require('./reminder-dispatch-budget');
const identity=require('../config/event-action-identity'),fixtureIdentity=require('../config/fixture-identity');
const MAX_ACCOUNTS=20,MAX_FIXTURES=100;
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
 const missing=ids.filter(id=>!resolved.has(id));if(missing.length)await api.refreshEventSnapshots(missing,{request});
 return ids.map(id=>resolved.get(id)||api.eventFor(id)).filter(Boolean);
}
async function dispatch({now=new Date(),request=supabaseServiceRequest,send,budget={remaining:()=>27000},load=loadFixtures,loadCatalogue}={}){
 const deferred=()=>({checked:0,sent:0,failed:0,deferred:'dispatch_deadline'});
 if(budget.remaining()<8000)return deferred();
 const inventory=await rpc('inventory',{},request);
 if(!inventory.accounts?.length||!inventory.fixtures?.length)return {checked:0,sent:0,failed:0};
 if(inventory.accounts.length>MAX_ACCOUNTS||inventory.fixtures.length>MAX_FIXTURES)throw Error('Invalid Impact inventory');
 const events=await load(inventory.fixtures.map(f=>f.eventId),{request,now,loadCatalogue});
 if(budget.remaining()<5000)return deferred();
 await rpc('reconcile',packets(inventory,events,now),request);
 if(budget.remaining()<5000)return deferred();
 const claims=await rpc('claim',{},request);if(!Array.isArray(claims)||claims.length>2)throw Error('Invalid Impact delivery inventory');
 let sent=0,failed=0,skipped=0;
 await workers(claims,async claim=>{
  const args={batch:claim.batch_id,installation:claim.installation_id,token:claim.claim_token};let outcome='pending';
  try{
   if(budget.remaining()<3500)return;
   const batch=await rpc('begin',args,request);if(!batch?.items?.length){skipped++;return;}
   await guardedSend({installationId:claim.installation_id,expectedUserId:claim.user_id,request,send,payload:JSON.stringify(payload(batch,claim.batch_id)),options:{TTL:3600,urgency:'normal',timeout:3000}});sent++;outcome='sent';
  }catch(error){
   if(suppressed(error)){skipped++;outcome='suppressed';}
   else{failed++;const code=Number(error.statusCode);outcome=code>=500||code===429||error.code==='notification_send_not_started'?'pending':code?'failed':'uncertain';if(code===404||code===410)await request('/rest/v1/nothingsports_push_installations?'+new URLSearchParams({installation_id:'eq.'+claim.installation_id,user_id:'eq.'+claim.user_id}),{method:'DELETE'});}
  }finally{
   if(budget.remaining()>250)await rpc('finish',{...args,outcome},request);
  }
 },2);
 return {checked:claims.length,sent,failed,skipped};
}
module.exports={observation,packets,payload,dispatch,loadFixtures,MAX_ACCOUNTS,MAX_FIXTURES};
