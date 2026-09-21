'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
// Account/system producers supply a stable source key. User clients cannot publish.
async function systemNotice({recipientId,key,title,detail},request=supabaseServiceRequest){
 if(!/^[0-9a-f-]{36}$/i.test(recipientId)||!key||!title)throw new Error('A recipient, stable key and title are required.');
 return request('/rest/v1/nothingsports_inbox?on_conflict=recipient_user_id,source_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{recipient_user_id:recipientId,kind:'system',source_key:`system:${String(key).slice(0,180)}`,title:String(title).slice(0,180),detail:String(detail||'').slice(0,1000)}});
}
module.exports={systemNotice};
