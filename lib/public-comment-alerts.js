'use strict';
const webpush=require('web-push'),{supabaseServiceRequest,supabaseMaintenanceMode,userStateFromRow}=require('./supabase-server');
const {guardedSend,suppressed}=require('./notification-send');
const url=(table,q)=>'/rest/v1/nothingsports_'+table+'?'+new URLSearchParams(q);
function inFeed(event,state,now=new Date()){
 if(!event||!state)return false;
 const pipeline=require('./server-feed-pipeline'),lifecycle=require('../config/card-lifecycle'),resolver=require('./follow-fixture-resolver');
 const normalized=pipeline.normalizeUserFollowState(state),fixture=pipeline.normalizeEvent(event,now),action=pipeline.eventActionFor(fixture,normalized.eventUserState||normalized.event_user_state||{});
 if(action.dismissed||action.archived||action.isPurged)return false;
 if(!['active','saved'].includes(lifecycle.lifecycleState(fixture,{action,now,feed:true}).state))return false;
 return pipeline.shouldEnrichEvent(fixture,normalized.preferences,action,resolver.expandedFollowEntityIds({preferences:normalized.preferences},{event:fixture}),now);
}
function payload(run,handle){return{kind:'public-comment',title:`${handle} commented on a fixture`,body:'Open Nothing Sport to read the discussion.',tag:`public-comment-${run.id}`,url:`/?discussion=${encodeURIComponent(run.event_id)}`};}
async function dispatch({now=new Date(),api=null,request=supabaseServiceRequest,send=null,environment=process.env,eligible=inFeed,budget=null}={}){
 if(supabaseMaintenanceMode(environment))return{checked:0,sent:0,failed:0,deferred:'supabase_maintenance'};
 if(!budget){budget=require('./reminder-dispatch-budget').budget({request,limitMs:12000});request=budget.request;}
 const at=now.toISOString(),stale=new Date(+now-600000).toISOString();
 const runs=await request('/rest/v1/rpc/nothingsports_claim_public_comment_runs',{method:'POST',body:{claim_at:at,stale_before:stale,batch_limit:2}});
 if(!runs?.length)return{checked:0,sent:0,failed:0};
 api ||= require('./nothingscore-server');
 const rows=async(table,q)=>(await request(url(table,q)))||[];let sent=0,failed=0,skipped=0;
 const ready=!!send||!!(environment.VAPID_PUBLIC_KEY&&environment.VAPID_PRIVATE_KEY);
 if(environment.VAPID_PUBLIC_KEY&&environment.VAPID_PRIVATE_KEY)webpush.setVapidDetails(environment.VAPID_SUBJECT||'https://nothingsport.vercel.app/',environment.VAPID_PUBLIC_KEY,environment.VAPID_PRIVATE_KEY);
 const transport=budget.send(send||webpush.sendNotification.bind(webpush));
 for(const run of runs){
  const failuresBefore=failed;
  try{
  const finish=()=>request(url('public_comment_runs',{id:'eq.'+run.id,claimed_at:'eq.'+run.claimed_at}),{method:'PATCH',body:{completed_at:at,claimed_at:null}});
  const [profiles,personas,follows,states]=await Promise.all([
   rows('nsc_profiles',{user_id:'eq.'+run.actor_user_id,visibility:'eq.visible',select:'handle',limit:'1'}),
   rows('nsc_personas',{user_id:`in.(${run.actor_user_id},${run.recipient_user_id})`,select:'moderation_flag'}),
   rows('user_follows',{follower_user_id:'eq.'+run.recipient_user_id,followed_user_id:'eq.'+run.actor_user_id,select:'followed_user_id',limit:'1'}),
   rows('user_state',{user_id:'eq.'+run.recipient_user_id,select:'preferences,event_user_state,archived_events',limit:'1'})]);
  const state=userStateFromRow(states[0]),preferences=state?.preferences?.followFirst?.notifications;
  if(!profiles[0]?.handle||personas.some(p=>p.moderation_flag)||!follows.length||preferences?.enabled===false||preferences?.commentAlertsEnabled===false||!eligible(api.eventFor(run.event_id),state,now)){await finish();skipped++;continue;}
  await request('/rest/v1/nothingsports_inbox?on_conflict=recipient_user_id,source_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{recipient_user_id:run.recipient_user_id,actor_user_id:run.actor_user_id,kind:'system',phase:'public-comments',source_key:'public-comment:'+run.id,event_id:run.event_id,title:'New fixture comments',detail:'Open this fixture to read the discussion.',message_count:1}});
  await request(url('public_comment_deliveries',{run_id:'eq.'+run.id,status:'eq.sending',started_at:'lt.'+stale}),{method:'PATCH',body:{status:'uncertain'}});
  const installations=await request('/rest/v1/rpc/nothingsports_public_comment_installations',{method:'POST',body:{target_run:run.id}});
  if(installations.length&&!ready){await request(url('public_comment_runs',{id:'eq.'+run.id,claimed_at:'eq.'+run.claimed_at}),{method:'PATCH',body:{claimed_at:null}});continue;}
  let pending=installations.length>5;
  for(const installation of installations.slice(0,5)){
   if(budget.remaining()<4000){pending=true;break;}
   const key={run_id:'eq.'+run.id,installation_id:'eq.'+installation.installation_id};
   await request('/rest/v1/nothingsports_public_comment_deliveries?on_conflict=run_id,installation_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{run_id:run.id,installation_id:installation.installation_id}});
   // A stale send may already have reached its provider. Never replay it.
   await request(url('public_comment_deliveries',{...key,status:'eq.sending',started_at:'lt.'+stale}),{method:'PATCH',body:{status:'uncertain'}});
   const claimed=await request(url('public_comment_deliveries',{...key,status:'eq.pending',attempts:'lt.3'}),{method:'PATCH',headers:{Prefer:'return=representation'},body:{status:'sending',started_at:at}});
   if(!claimed?.length)continue;
   const attempts=Number(claimed[0].attempts||0)+1;let status='sent';
   try{await guardedSend({installationId:installation.installation_id,expectedUserId:run.recipient_user_id,relatedUserIds:[run.actor_user_id],request,send:transport,payload:JSON.stringify(payload(run,'@'+profiles[0].handle)),options:{TTL:3600,urgency:'normal',timeout:3000},environment});sent++;}
   catch(error){if(suppressed(error)){status='failed';skipped++;}else{failed++;const code=Number(error.statusCode||0);status=(code>=500||code===429)&&attempts<3?'pending':code?'failed':'uncertain';}}
   pending ||= status==='pending';
   await request(url('public_comment_deliveries',{...key,status:'eq.sending',started_at:'eq.'+at}),{method:'PATCH',body:{status,attempts}});
  }
  if(pending)await request(url('public_comment_runs',{id:'eq.'+run.id,claimed_at:'eq.'+run.claimed_at}),{method:'PATCH',body:{claimed_at:null}});else await finish();
  }catch(error){return{checked:runs.length,sent,failed:Math.max(failed,failuresBefore+1),skipped,error:'public_comment_dispatch_failed'};}
 }
 return{checked:runs.length,sent,failed,skipped};
}
async function maintain({now=new Date(),api=null,request=supabaseServiceRequest}={}){
 const threads=await request(url('public_threads',{closed:'eq.false',checked_at:'lt.'+new Date(+now-1800000).toISOString(),order:'checked_at.asc,event_id.asc',select:'event_id',limit:'2'}));
 if(!threads?.length)return{checked:0,retired:0};api ||= require('./nothingscore-server');
 await api.refreshEventSnapshots(threads.map(t=>t.event_id));let retired=0;
 for(const thread of threads){const event=api.eventFor(thread.event_id);if(!event){await request(url('public_threads',{event_id:'eq.'+thread.event_id}),{method:'PATCH',body:{checked_at:now.toISOString()}});continue;}const archive=require('./epic-classics'),fixture={...archive.recordFor(event,{now}).fixture,retirementEligible:archive.policy.retired(event,now)};const result=await request('/rest/v1/rpc/nothingsports_retire_public_comments',{method:'POST',body:{target_fixture:thread.event_id,verified_fixture:fixture}});retired+=result.retired?1:0;}
 return{checked:threads.length,retired};
}
async function scheduled(options){const delivery=await dispatch(options);if(delivery.error)return delivery;let retirement={checked:0,deferred:'dispatch_deadline'};if(options.budget.remaining()>10000)try{retirement=await maintain(options);}catch{return{...delivery,error:'public_comment_retirement_failed'};}return{...delivery,retirement};}
module.exports={dispatch,maintain,scheduled,inFeed,payload};
