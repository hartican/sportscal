'use strict';
const webpush=require('web-push');
const {supabaseServiceRequest}=require('./supabase-server');
const suppressed=error=>error?.code==='notification_send_suppressed'||error?.payload?.code==='55000';
async function guardedSend({installationId,expectedUserId=null,relatedUserIds=[],payload,options,request=supabaseServiceRequest,send=webpush.sendNotification.bind(webpush),environment=process.env}){
 let lease;
 try{lease=await request('/rest/v1/rpc/nothingsports_begin_notification_send',{method:'POST',environment,body:{target_installation:installationId,expected_user:expectedUserId,related_users:relatedUserIds.filter(Boolean)}});}
 catch(error){if(suppressed(error))throw error;throw Object.assign(new Error('Notification admission failed before contacting provider.'),{code:'notification_send_not_started',statusCode:503});}
 if(!lease?.leaseId||!lease?.subscription)throw Object.assign(new Error('Notification suppressed during account change or erasure.'),{code:'notification_send_suppressed'});
 let outcome='accepted',failure,result;
 try{result=await send(lease.subscription,payload,options);}catch(error){failure=error;outcome=Number(error.statusCode)?'rejected':'uncertain';}
 try{await request(`/rest/v1/nothingsports_notification_send_leases?lease_id=eq.${encodeURIComponent(lease.leaseId)}`,{method:'PATCH',environment,body:{finished_at:new Date().toISOString(),outcome}});}
 catch(error){if(!failure)failure=Object.assign(new Error('Provider outcome recorded incompletely; do not blindly retry.'),{code:'notification_send_uncertain'});}
 if(failure)throw failure;
 return result;
}
module.exports={guardedSend,suppressed};
