'use strict';
const crypto=require('node:crypto');
function createLookupState({request,environment}){
  const call=(name,body,timeoutMs)=>request('/rest/v1/rpc/nothingsports_'+name,{method:'POST',body,environment,timeoutMs});
  function owner(id,hash){
    const body={p_fixture_id:id,p_query_hash:hash,p_token:crypto.randomUUID()};
    return {
      claim:timeoutMs=>call('claim_youtube_lookup',body,timeoutMs),
      reserve:(bucket,timeoutMs)=>call('reserve_youtube_lookup_quota',{...body,p_bucket:bucket},timeoutMs),
      withdraw:(videoId,timeoutMs)=>call('withdraw_youtube_lookup',{...body,p_video_id:videoId},timeoutMs),
      finish:(outcome,selection,invalidVideoId,timeoutMs)=>call('finish_youtube_lookup',{...body,p_outcome:outcome,p_selection:selection||null,p_invalid_video_id:invalidVideoId||null},timeoutMs)
    };
  }
  return {owner};
}
module.exports={createLookupState};
