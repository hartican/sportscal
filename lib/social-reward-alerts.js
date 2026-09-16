'use strict';

const webpush=require('web-push');
const {supabaseServiceRequest}=require('./supabase-server');

const CLAIM_STALE_MS=10*60*1000;

function payload(notification,actorName='A Nothinger'){
 const points=Number(notification.points||0);
 if(notification.kind==='follows_copied')return{
  title:`${actorName} copied your follows`,
  body:`They copied some of your sporting follows.${points?` You earned a once-off ${points} points.`:''}`,
  tag:`social-${notification.id}`,
  url:'/?nothingFriends=1',
 };
 return{
  title:`${actorName} followed you`,
  body:`They followed your Nothing Sport profile.${points?` You earned ${points} point${points===1?'':'s'}.`:''}`,
  tag:`social-${notification.id}`,
  url:'/?nothingFriends=1',
 };
}

async function patchNotification(id,body,request=supabaseServiceRequest){
 return request(`/rest/v1/nothingsports_social_notifications?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body});
}

async function dispatch({now=new Date(),api=require('./nothingscore-server'),request=supabaseServiceRequest,send=webpush.sendNotification.bind(webpush)}={}){
 const claimedAt=now.toISOString(),staleBefore=new Date(now.getTime()-CLAIM_STALE_MS).toISOString();
 const claimed=await request('/rest/v1/rpc/nothingsports_claim_social_notifications',{method:'POST',body:{claim_at:claimedAt,stale_before:staleBefore,batch_limit:100}});
 const notifications=Array.isArray(claimed)?claimed:[];
 if(!notifications.length)return{checked:0,sent:0,failed:0,skipped:0};
 const identities=await api.identityMaps([...new Set(notifications.map(item=>item.actor_user_id).filter(Boolean))]);
 let sent=0,failed=0,skipped=0;
 for(const notification of notifications){
  const actor=identities.profiles.get(notification.actor_user_id);
  const actorName=actor?.visibility==='visible'&&!identities.personas.get(notification.actor_user_id)?.moderation_flag?actor.display_name:'A Nothinger';
  const installations=await api.rows('nothingsports_push_installations',{user_id:`eq.${notification.recipient_user_id}`,permission:'eq.granted',social_alerts_enabled:'eq.true',select:'installation_id,endpoint,p256dh,auth_key'});
  if(!installations.length){await patchNotification(notification.id,{claimed_at:null,completed_at:now.toISOString()},request);skipped++;continue;}
  await request('/rest/v1/nothingsports_social_notification_deliveries?on_conflict=notification_id,installation_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:installations.map(installation=>({notification_id:notification.id,installation_id:installation.installation_id}))});
  const deliveries=await api.rows('nothingsports_social_notification_deliveries',{notification_id:`eq.${notification.id}`,select:'notification_id,installation_id,status,attempts'});
  const byInstallation=new Map(deliveries.map(item=>[item.installation_id,item]));
  let pending=false;
  for(const installation of installations){
   const delivery=byInstallation.get(installation.installation_id)||{status:'pending',attempts:0};
   if(['sent','uncertain','failed'].includes(delivery.status))continue;
   let status='sent',lastError=null;
   try{
    await send({endpoint:installation.endpoint,keys:{p256dh:installation.p256dh,auth:installation.auth_key}},JSON.stringify(payload(notification,actorName)),{TTL:86400,urgency:'normal'});
    sent++;
   }catch(error){
    failed++;lastError=String(error?.message||'Push delivery failed.').slice(0,500);
    const code=Number(error?.statusCode||0),attempts=Number(delivery.attempts||0)+1;
    status=code>=500||code===429?'pending':code?'failed':'uncertain';
    if(attempts>=3&&status==='pending')status='failed';
    if(code===404||code===410)await request(`/rest/v1/nothingsports_push_installations?installation_id=eq.${encodeURIComponent(installation.installation_id)}`,{method:'DELETE'});
   }
   pending||=status==='pending';
   await request(`/rest/v1/nothingsports_social_notification_deliveries?notification_id=eq.${notification.id}&installation_id=eq.${installation.installation_id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status,attempts:Number(delivery.attempts||0)+1,updated_at:now.toISOString()}});
   if(lastError)await patchNotification(notification.id,{last_error:lastError},request);
  }
  await patchNotification(notification.id,pending?{claimed_at:null}:{claimed_at:null,completed_at:now.toISOString()},request);
 }
 return{checked:notifications.length,sent,failed,skipped};
}

module.exports={CLAIM_STALE_MS,dispatch,payload};
