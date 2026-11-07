'use strict';
// Account-specific Auth shutdown. This does not revoke stateless Storage URLs,
// replace direct database guards, or establish shutdown of every legacy issuer.
async function stopAccountAuthentication({accountId,call,now=Date.now}){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(accountId||''))throw Error('Exact erasure account required.');
 const endpoint=`/auth/v1/admin/users/${accountId}`;
 const user=await call(endpoint);
 const started=Date.parse(user?.app_metadata?.nothingsport_erasure_started_at);
 if(user?.id!==accountId||!Number.isFinite(started)||started>now())throw Error('Committed account erasure marker is required before Auth shutdown.');
 // Re-read after an uncertain acknowledgement; never infer success from intent.
 let verified=user;
 if(!(Date.parse(user.banned_until)>now()+86400000)){
  await call(endpoint,{method:'PUT',body:{ban_duration:'876000h'}});
  verified=await call(endpoint);
 }
 if(verified?.id!==accountId||!(Date.parse(verified.banned_until)>now()+86400000))throw Error('Account Auth shutdown was not confirmed.');
 return {checkedAt:new Date(now()).toISOString(),bannedUntil:verified.banned_until};
}
module.exports={stopAccountAuthentication};
